"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createCampana(formData: FormData) {
  const projectId = formData.get("projectId") as string;
  const season = formData.get("season") as string;
  const suffix = (formData.get("suffix") as string)?.trim();
  const year = new Date().getFullYear();
  const surveyType = formData.get("surveyType") as string;
  const methodology = formData.get("methodology") as string;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;
  const notes = formData.get("notes") as string;
  const responsible = (formData.get("responsible") as string) || null;
  const shermanTrapCount = formData.get("shermanTrapCount") ? parseInt(formData.get("shermanTrapCount") as string) : null;
  const cameraTrapCount = formData.get("cameraTrapCount") ? parseInt(formData.get("cameraTrapCount") as string) : null;

  if (!projectId || !season || !surveyType || !methodology || !startDate || !endDate) {
    return { error: "Completa todos los campos requeridos" };
  }

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { status: true } });
  if (project?.status === "COMPLETED") return { error: "El proyecto está cerrado y no permite cambios" };

  const name = suffix ? `${season} ${year} — ${suffix}` : `${season} ${year}`;

  const campaign = await prisma.campaign.create({
    data: {
      projectId,
      name,
      surveyType,
      methodology,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      notes: notes || null,
      responsible,
      shermanTrapCount,
      cameraTrapCount,
      status: "ACTIVE",
    },
  });

  revalidatePath("/campanas");
  revalidatePath(`/proyectos/${projectId}`);
  return { success: true, id: campaign.id, projectId };
}

export async function updateCampana(campaignId: string, formData: FormData) {
  const season = formData.get("season") as string;
  const suffix = (formData.get("suffix") as string)?.trim();
  const year = new Date().getFullYear();
  const surveyType = formData.get("surveyType") as string;
  const methodology = formData.get("methodology") as string;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;
  const notes = formData.get("notes") as string;
  const responsible = (formData.get("responsible") as string) || null;
  const shermanTrapCount = formData.get("shermanTrapCount") ? parseInt(formData.get("shermanTrapCount") as string) : null;
  const cameraTrapCount = formData.get("cameraTrapCount") ? parseInt(formData.get("cameraTrapCount") as string) : null;

  if (!season || !surveyType || !methodology || !startDate || !endDate) {
    return { error: "Completa todos los campos requeridos" };
  }

  const name = suffix ? `${season} ${year} — ${suffix}` : `${season} ${year}`;

  const existing = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { project: { select: { status: true } } } });
  if (existing?.project?.status === "COMPLETED") return { error: "El proyecto está cerrado y no permite cambios" };

  const campaign = await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      name,
      surveyType,
      methodology,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      notes: notes || null,
      responsible,
      shermanTrapCount,
      cameraTrapCount,
    },
  });

  revalidatePath("/campanas");
  revalidatePath(`/proyectos/${campaign.projectId}/campanas/${campaignId}`);
  return { success: true, id: campaign.id, projectId: campaign.projectId };
}
