"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const stationSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  type: z.enum(["PARCELA", "TRANSECTO"]),
  area: z.string().optional(),
  length: z.string().optional(),
  width: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  notes: z.string().optional(),
});

export async function createStation(projectId: string, campaignId: string, formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("No autorizado");

  const parsed = stationSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    area: formData.get("area"),
    length: formData.get("length"),
    width: formData.get("width"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const station = await prisma.station.create({
    data: {
      campaignId,
      name: parsed.data.name,
      type: parsed.data.type,
      area: parsed.data.area ? parseFloat(parsed.data.area) : null,
      length: parsed.data.length ? parseFloat(parsed.data.length) : null,
      width: parsed.data.width ? parseFloat(parsed.data.width) : null,
      latitude: parsed.data.latitude ? parseFloat(parsed.data.latitude) : null,
      longitude: parsed.data.longitude ? parseFloat(parsed.data.longitude) : null,
      notes: parsed.data.notes || null,
    },
  });
  revalidatePath(`/proyectos/${projectId}/campanas/${campaignId}`);
  return { success: true, id: station.id };
}

export async function updateStation(projectId: string, campaignId: string, stationId: string, formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("No autorizado");

  const parsed = stationSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    area: formData.get("area"),
    length: formData.get("length"),
    width: formData.get("width"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.station.update({
    where: { id: stationId },
    data: {
      name: parsed.data.name,
      type: parsed.data.type,
      area: parsed.data.area ? parseFloat(parsed.data.area) : null,
      length: parsed.data.length ? parseFloat(parsed.data.length) : null,
      width: parsed.data.width ? parseFloat(parsed.data.width) : null,
      latitude: parsed.data.latitude ? parseFloat(parsed.data.latitude) : null,
      longitude: parsed.data.longitude ? parseFloat(parsed.data.longitude) : null,
      notes: parsed.data.notes || null,
    },
  });
  revalidatePath(`/proyectos/${projectId}/campanas/${campaignId}/estaciones/${stationId}`);
  return { success: true };
}

export async function deleteStation(projectId: string, campaignId: string, stationId: string) {
  const session = await auth();
  if (!session) throw new Error("No autorizado");

  await prisma.station.delete({ where: { id: stationId } });
  revalidatePath(`/proyectos/${projectId}/campanas/${campaignId}`);
  return { success: true };
}
