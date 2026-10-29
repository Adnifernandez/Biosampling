"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { CampanaReporte } from "@/lib/reporte-word/datos";

const OCCURRENCE_SELECT = {
  abundance: true,
  groupSize: true,
  species: {
    select: {
      id: true,
      family: true,
      genus: true,
      species: true,
      commonName: true,
      conservationStatus: true,
      clase: true,
      orden: true,
      habito: true,
      origen: true,
    },
  },
} as const;

// Datos de terreno de las campañas elegidas para el reporte Word (sólo administradores)
export async function getCampanasReporteWord(campaignIds: string[]): Promise<CampanaReporte[]> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Sólo los administradores pueden generar el reporte Word");
  if (campaignIds.length === 0) return [];

  const campaigns = await prisma.campaign.findMany({
    where: { id: { in: campaignIds } },
    orderBy: { startDate: "asc" },
    select: {
      id: true,
      name: true,
      surveyType: true,
      methodology: true,
      startDate: true,
      endDate: true,
      responsible: true,
      notes: true,
      shermanTrapCount: true,
      cameraTrapCount: true,
      stations: {
        // Las grillas (G1…G4) cuelgan de su transecto; se leen a través de él
        where: { parentId: null },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          length: true,
          width: true,
          area: true,
          occurrences: { select: OCCURRENCE_SELECT },
          children: {
            select: { id: true, name: true, occurrences: { select: OCCURRENCE_SELECT } },
          },
        },
      },
    },
  });

  return campaigns.map((c) => ({
    ...c,
    startDate: c.startDate.toISOString().slice(0, 10),
    endDate: c.endDate.toISOString().slice(0, 10),
  }));
}
