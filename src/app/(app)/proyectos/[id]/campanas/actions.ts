"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const campaignSchema = z.object({
  name: z.string().min(2),
  surveyType: z.enum(["FLORA", "FAUNA"]),
  methodology: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  notes: z.string().optional(),
});

export async function createCampaign(projectId: string, formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("No autorizado");

  const parsed = campaignSchema.safeParse({
    name: formData.get("name"),
    surveyType: formData.get("surveyType"),
    methodology: formData.get("methodology"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const campaign = await prisma.campaign.create({
    data: {
      ...parsed.data,
      projectId,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
    },
  });
  revalidatePath(`/proyectos/${projectId}`);
  return { success: true, id: campaign.id };
}

export async function updateCampaign(projectId: string, campaignId: string, formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("No autorizado");

  const parsed = campaignSchema.safeParse({
    name: formData.get("name"),
    surveyType: formData.get("surveyType"),
    methodology: formData.get("methodology"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      ...parsed.data,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
    },
  });
  revalidatePath(`/proyectos/${projectId}/campanas/${campaignId}`);
  revalidatePath(`/proyectos/${projectId}`);
  return { success: true };
}

export async function deleteCampaign(projectId: string, campaignId: string) {
  const session = await auth();
  if (!session) throw new Error("No autorizado");

  await prisma.campaign.delete({ where: { id: campaignId } });
  revalidatePath(`/proyectos/${projectId}`);
  return { success: true };
}
