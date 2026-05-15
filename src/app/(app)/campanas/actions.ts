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

  if (!projectId || !season || !surveyType || !methodology || !startDate || !endDate) {
    return { error: "Completa todos los campos requeridos" };
  }

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

  if (!season || !surveyType || !methodology || !startDate || !endDate) {
    return { error: "Completa todos los campos requeridos" };
  }

  const name = suffix ? `${season} ${year} — ${suffix}` : `${season} ${year}`;

  const campaign = await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      name,
      surveyType,
      methodology,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      notes: notes || null,
    },
  });

  revalidatePath("/campanas");
  revalidatePath(`/proyectos/${campaign.projectId}/campanas/${campaignId}`);
  return { success: true, id: campaign.id, projectId: campaign.projectId };
}
