"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function createEstacionData(data: {
  campaignId: string;
  name: string;
  type: string;
  area?: number;
  length?: number;
  width?: number;
  latitude?: number;
  longitude?: number;
  notes?: string;
}) {
  const session = await auth();
  if (!session) throw new Error("No autorizado");

  const campaign = await prisma.campaign.findUnique({
    where: { id: data.campaignId },
    select: { projectId: true, project: { select: { status: true } } },
  });
  if (!campaign) return { error: "Campaña no encontrada" };
  if (campaign.project?.status === "COMPLETED") return { error: "El proyecto está cerrado y no permite cambios" };

  const station = await prisma.station.create({
    data: {
      campaignId: data.campaignId,
      name: data.name,
      type: data.type as "PARCELA" | "TRANSECTO",
      area: data.area ?? null,
      length: data.length ?? null,
      width: data.width ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      notes: data.notes ?? null,
    },
  });

  revalidatePath("/estaciones");
  revalidatePath(`/proyectos/${campaign.projectId}/campanas/${data.campaignId}`);
  return { success: true, id: station.id, projectId: campaign.projectId };
}
