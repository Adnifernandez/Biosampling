import type { Prisma, PrismaClient } from "@prisma/client";

// Family given to species added from the field with "¿No está la especie? ¡Agrégala!"
export const PENDING_FAMILY = "Por clasificar";

export function isPendingFamily(family: string | null | undefined): boolean {
  return normalizeName(family ?? "") === normalizeName(PENDING_FAMILY);
}

// Lowercase, no accents, single spaces, no trailing dots ("sp." == "sp")
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\.+$/, "");
}

// Trims both parts and drops the genus when it was also typed in the species field
// ("Adesmia" + "Adesmia eremophila" → "Adesmia" + "eremophila").
export function cleanScientificName(genus: string, species: string) {
  const g = genus.trim().replace(/\s+/g, " ");
  let s = species.trim().replace(/\s+/g, " ");
  if (g && normalizeName(s).startsWith(normalizeName(g) + " ")) {
    s = s.slice(g.length).trim();
  }
  return { genus: g, species: s };
}

type NameQuery = { type: string; genus: string; species: string; excludeId?: string };

// Other species of the same type with the same scientific name, oldest first
export async function findAllSameNameSpecies<T extends Prisma.SpeciesInclude>(
  prisma: PrismaClient,
  { type, genus, species, excludeId }: NameQuery,
  include: T,
) {
  const name = cleanScientificName(genus, species);
  const target = normalizeName(name.species);
  const candidates = await prisma.species.findMany({
    where: {
      type,
      genus: { equals: name.genus, mode: "insensitive" },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    include,
    orderBy: { createdAt: "asc" },
  });
  return candidates.filter((c) => normalizeName(cleanScientificName(c.genus, c.species).species) === target);
}

// Prefers a complete species over one still "Por clasificar"
export async function findSameNameSpecies<T extends Prisma.SpeciesInclude>(
  prisma: PrismaClient,
  query: NameQuery,
  include: T,
) {
  const matches = await findAllSameNameSpecies(prisma, query, include);
  return matches.find((m) => !isPendingFamily(m.family)) ?? matches[0] ?? null;
}
