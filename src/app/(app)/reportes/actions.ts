"use server";

import { prisma } from "@/lib/prisma";

// Only the Species columns ReportesClient actually renders — keeps the payload small.
const SPECIES_SELECT = {
  id: true,
  family: true,
  genus: true,
  species: true,
  commonName: true,
  type: true,
  conservationStatus: true,
  division: true,
  clase: true,
  orden: true,
  habito: true,
  origen: true,
  macrofitasHabito: true,
} as const;

export async function getCampaignStations(campaignId: string) {
  return prisma.station.findMany({
    where: { campaignId },
    relationLoadStrategy: "join",
    include: {
      occurrences: {
        include: {
          species: { select: SPECIES_SELECT },
          user: { select: { name: true } },
        },
      },
      children: {
        orderBy: { name: "asc" },
        include: {
          occurrences: {
            include: {
              species: { select: SPECIES_SELECT },
              user: { select: { name: true } },
            },
          },
        },
      },
    },
  });
}
