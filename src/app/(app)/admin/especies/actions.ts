"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Prisma } from "@prisma/client";
import {
  PENDING_FAMILY,
  cleanScientificName,
  findSameNameSpecies,
  isPendingFamily,
  normalizeName,
} from "@/lib/species-names";

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

// Every field is required except habito and macrofitasHabito
function missingRequiredField(data: SpeciesData): boolean {
  return !data.type || !data.genus || !data.species || !data.family
    || !data.commonName || !data.clase || !data.orden || !data.origen
    || !data.conservationStatus || !data.division || !data.category;
}

const DUPLICATE_ERROR = "Esta especie ya existe en el listado";
const PENDING_FAMILY_ERROR = `Escribe la familia: no puede quedar "${PENDING_FAMILY}"`;

function buildData(data: SpeciesData, userId: string | null) {
  const name = cleanScientificName(data.genus, data.species);
  return {
    type: data.type,
    genus: name.genus,
    species: name.species,
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
    return { error: "Todos los campos son obligatorios, excepto Hábito y Hábito macrófitas" };
  }
  if (isPendingFamily(data.family)) return { error: PENDING_FAMILY_ERROR };

  const existing = await findSameNameSpecies(prisma, data, INCLUDE);
  if (existing) return { error: DUPLICATE_ERROR, existing };

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

  // Already in the list (maybe under another common name): use that one instead of a duplicate
  const existing = await findSameNameSpecies(prisma, { type: input.type, genus, species }, INCLUDE);
  if (existing) return { success: true, species: existing, existing: true };

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const created = await prisma.species.create({
    data: {
      type: input.type,
      genus,
      species,
      family: PENDING_FAMILY,
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
    return { error: "Todos los campos son obligatorios, excepto Hábito y Hábito macrófitas" };
  }
  if (isPendingFamily(data.family)) return { error: PENDING_FAMILY_ERROR };

  // Only check for duplicates when the name changes, so species that already have a twin
  // (from the initial list) can still be corrected
  const current = await prisma.species.findUnique({ where: { id } });
  if (!current) return { error: "La especie ya no existe" };
  const nameKey = (t: string, g: string, s: string) => {
    const n = cleanScientificName(g, s);
    return `${t}|${normalizeName(n.genus)} ${normalizeName(n.species)}`;
  };
  if (nameKey(current.type, current.genus, current.species) !== nameKey(data.type, data.genus, data.species)) {
    const existing = await findSameNameSpecies(prisma, { ...data, excludeId: id }, INCLUDE);
    if (existing) return { error: DUPLICATE_ERROR, existing };
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

// APP: added by someone from the app · INICIAL: from the initial list (no author) · PENDIENTE: still "Por clasificar"
export type SpeciesOrigin = "ALL" | "APP" | "INICIAL" | "PENDIENTE";

function originWhere(origin: SpeciesOrigin): Prisma.SpeciesWhereInput {
  if (origin === "APP") return { createdById: { not: null } };
  if (origin === "INICIAL") return { createdById: null };
  if (origin === "PENDIENTE") return { family: PENDING_FAMILY };
  return {};
}

function originSql(origin: SpeciesOrigin) {
  if (origin === "APP") return Prisma.sql`AND "createdById" IS NOT NULL`;
  if (origin === "INICIAL") return Prisma.sql`AND "createdById" IS NULL`;
  if (origin === "PENDIENTE") return Prisma.sql`AND family = ${PENDING_FAMILY}`;
  return Prisma.empty;
}

export async function searchSpecies(query: string, type: string, origin: SpeciesOrigin = "ALL") {
  const q = query.trim();
  if (!q && type === "ALL" && origin === "ALL") return [];

  const term = `%${q}%`;
  const typeClause = type !== "ALL" ? Prisma.sql`AND type = ${type}` : Prisma.empty;
  const typeWhere = type !== "ALL" ? { type } : {};

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
        ${originSql(origin)}
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
          ...typeWhere,
          ...originWhere(origin),
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

  // Solo filtros, sin texto. Las agregadas en la app son pocas: se muestran todas
  return prisma.species.findMany({
    where: { ...typeWhere, ...originWhere(origin) },
    orderBy: [{ type: "asc" }, { genus: "asc" }, { species: "asc" }],
    take: origin === "APP" || origin === "PENDIENTE" ? 500 : 80,
    include: INCLUDE,
  });
}

// Species still "Por clasificar", oldest first, flagging the ones whose name already
// exists as a separate, complete species (those are duplicates, not species to complete)
export async function listPendingSpecies() {
  const pending = await prisma.species.findMany({
    where: { family: PENDING_FAMILY },
    orderBy: { createdAt: "asc" },
    include: INCLUDE,
  });
  return Promise.all(
    pending.map(async (sp) => {
      // A twin that is also "Por clasificar" doesn't count: one of the two still has to be completed
      const twin = await findSameNameSpecies(prisma, { ...sp, excludeId: sp.id }, {});
      return { ...sp, hasTwin: !!twin && !isPendingFamily(twin.family) };
    }),
  );
}

export async function deleteSpecies(id: string) {
  const count = await prisma.occurrence.count({ where: { speciesId: id } });
  if (count > 0) {
    return { error: `No se puede eliminar: tiene ${count} ocurrencia${count !== 1 ? "s" : ""} asociada${count !== 1 ? "s" : ""}` };
  }
  await prisma.species.delete({ where: { id } });
  return { success: true };
}
