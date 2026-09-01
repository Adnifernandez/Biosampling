"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Prisma } from "@prisma/client";

const INCLUDE = {
  _count: { select: { occurrences: true } },
  createdBy: { select: { name: true } },
  updatedBy: { select: { name: true } },
} as const;

type SpeciesData = {
  type: string;
  genus: string;
  species: string;
  family: string;
  commonName?: string;
  clase?: string;
  orden?: string;
  origen?: string;
  conservationStatus?: string;
  habito?: string;
  macrofitasHabito?: string;
  division?: string;
  category?: string;
  endemic?: boolean;
};

// Every field is required except macrofitasHabito (only meaningful for aquatic macrophytes)
function missingRequiredField(data: SpeciesData): boolean {
  return !data.type || !data.genus || !data.species || !data.family
    || !data.commonName || !data.clase || !data.orden || !data.origen
    || !data.conservationStatus || !data.habito || !data.division || !data.category;
}

function buildData(data: SpeciesData, userId: string | null) {
  return {
    type: data.type,
    genus: data.genus.trim(),
    species: data.species.trim(),
    family: data.family.trim(),
    commonName: data.commonName?.trim() || null,
    clase: data.clase?.trim() || null,
    orden: data.orden?.trim() || null,
    origen: data.origen?.trim() || null,
    conservationStatus: data.conservationStatus?.trim() || null,
    habito: data.habito?.trim() || null,
    macrofitasHabito: data.macrofitasHabito?.trim() || null,
    division: data.division?.trim() || null,
    category: data.category?.trim() || null,
    endemic: data.endemic ?? false,
  };
}

export async function createSpecies(data: SpeciesData) {
  if (missingRequiredField(data)) {
    return { error: "Todos los campos son obligatorios, excepto Hábito macrófitas" };
  }
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const created = await prisma.species.create({
    data: { ...buildData(data, userId), createdById: userId, updatedById: userId },
    include: INCLUDE,
  });
  return { success: true, species: created };
}

// Quick-add from the occurrence form: only asks for scientific + common name.
// Family/clase/etc. are left for an admin to fill in later from Especies.
export async function quickCreateSpecies(input: { scientificName: string; commonName?: string; type: string }) {
  const parts = input.scientificName.trim().split(/\s+/);
  if (parts.length < 2) {
    return { error: "Escribe género y especie, ej: Puma concolor" };
  }
  const genus = parts[0];
  const species = parts.slice(1).join(" ");

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const created = await prisma.species.create({
    data: {
      type: input.type,
      genus,
      species,
      family: "Por clasificar",
      commonName: input.commonName?.trim() || null,
      createdById: userId,
      updatedById: userId,
    },
    include: INCLUDE,
  });
  return { success: true, species: created };
}

export async function updateSpecies(id: string, data: SpeciesData) {
  if (missingRequiredField(data)) {
    return { error: "Todos los campos son obligatorios, excepto Hábito macrófitas" };
  }
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const updated = await prisma.species.update({
    where: { id },
    data: { ...buildData(data, userId), updatedById: userId },
    include: INCLUDE,
  });
  return { success: true, species: updated };
}

export async function searchSpecies(query: string, type: string) {
  const q = query.trim();
  if (!q && type === "ALL") return [];

  const term = `%${q}%`;
  const typeClause = type !== "ALL" ? Prisma.sql`AND type = ${type}` : Prisma.empty;

  if (q) {
    // Try accent-insensitive search via unaccent; fall back to ILIKE if unavailable
    try {
      const ids = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Species"
        WHERE (
          unaccent(genus)        ILIKE unaccent(${term})
          OR unaccent(species)   ILIKE unaccent(${term})
          OR unaccent(family)    ILIKE unaccent(${term})
          OR unaccent("commonName") ILIKE unaccent(${term})
          OR unaccent(clase)     ILIKE unaccent(${term})
        )
        ${typeClause}
        ORDER BY type, genus, species
        LIMIT 80
      `;
      return prisma.species.findMany({
        where: { id: { in: ids.map((r) => r.id) } },
        orderBy: [{ type: "asc" }, { genus: "asc" }, { species: "asc" }],
        include: INCLUDE,
      });
    } catch {
      // unaccent not available — fall back to regular case-insensitive search
      return prisma.species.findMany({
        where: {
          ...(type !== "ALL" ? { type } : {}),
          OR: [
            { genus: { contains: q, mode: "insensitive" } },
            { species: { contains: q, mode: "insensitive" } },
            { family: { contains: q, mode: "insensitive" } },
            { commonName: { contains: q, mode: "insensitive" } },
            { clase: { contains: q, mode: "insensitive" } },
          ],
        },
        orderBy: [{ type: "asc" }, { genus: "asc" }, { species: "asc" }],
        take: 80,
        include: INCLUDE,
      });
    }
  }

  // Solo filtro por tipo, sin texto
  return prisma.species.findMany({
    where: { type },
    orderBy: [{ type: "asc" }, { genus: "asc" }, { species: "asc" }],
    take: 80,
    include: INCLUDE,
  });
}

export async function deleteSpecies(id: string) {
  const count = await prisma.occurrence.count({ where: { speciesId: id } });
  if (count > 0) {
    return { error: `No se puede eliminar: tiene ${count} ocurrencia${count !== 1 ? "s" : ""} asociada${count !== 1 ? "s" : ""}` };
  }
  await prisma.species.delete({ where: { id } });
  return { success: true };
}
