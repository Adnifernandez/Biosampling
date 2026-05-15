"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function createOccurrence(
  projectId: string,
  campaignId: string,
  stationId: string,
  data: {
    speciesId: string;
    date: string;
    latitude?: string;
    longitude?: string;
    abundance?: string;
    cover?: string;
    height?: string;
    stratum?: string;
    phenology?: string;
    distance?: string;
    bearing?: string;
    groupSize?: string;
    behavior?: string;
    detectionMethod?: string;
    notes?: string;
    methodologyData?: string;
  }
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");

  const occurrence = await prisma.occurrence.create({
    data: {
      stationId,
      speciesId: data.speciesId,
      userId: session.user.id,
      date: data.date ? new Date(data.date) : new Date(),
      latitude: data.latitude ? parseFloat(data.latitude) : null,
      longitude: data.longitude ? parseFloat(data.longitude) : null,
      abundance: data.abundance ? parseInt(data.abundance) : null,
      cover: data.cover ? parseFloat(data.cover) : null,
      height: data.height ? parseFloat(data.height) : null,
      stratum: data.stratum || null,
      phenology: data.phenology || null,
      distance: data.distance ? parseFloat(data.distance) : null,
      bearing: data.bearing ? parseFloat(data.bearing) : null,
      groupSize: data.groupSize ? parseInt(data.groupSize) : null,
      behavior: data.behavior || null,
      detectionMethod: data.detectionMethod || null,
      notes: data.notes || null,
      methodologyData: data.methodologyData || null,
    },
  });

  revalidatePath(`/proyectos/${projectId}/campanas/${campaignId}/estaciones/${stationId}`);
  return { success: true, id: occurrence.id };
}

export async function updateOccurrence(
  projectId: string,
  campaignId: string,
  stationId: string,
  occurrenceId: string,
  data: {
    speciesId: string;
    date: string;
    latitude?: string;
    longitude?: string;
    abundance?: string;
    cover?: string;
    height?: string;
    stratum?: string;
    phenology?: string;
    distance?: string;
    bearing?: string;
    groupSize?: string;
    behavior?: string;
    detectionMethod?: string;
    notes?: string;
    methodologyData?: string;
  }
) {
  const session = await auth();
  if (!session) throw new Error("No autorizado");

  await prisma.occurrence.update({
    where: { id: occurrenceId },
    data: {
      speciesId: data.speciesId,
      date: data.date ? new Date(data.date) : new Date(),
      latitude: data.latitude ? parseFloat(data.latitude) : null,
      longitude: data.longitude ? parseFloat(data.longitude) : null,
      abundance: data.abundance ? parseInt(data.abundance) : null,
      cover: data.cover ? parseFloat(data.cover) : null,
      height: data.height ? parseFloat(data.height) : null,
      stratum: data.stratum || null,
      phenology: data.phenology || null,
      distance: data.distance ? parseFloat(data.distance) : null,
      bearing: data.bearing ? parseFloat(data.bearing) : null,
      groupSize: data.groupSize ? parseInt(data.groupSize) : null,
      behavior: data.behavior || null,
      detectionMethod: data.detectionMethod || null,
      notes: data.notes || null,
      methodologyData: data.methodologyData || null,
    },
  });

  revalidatePath(`/proyectos/${projectId}/campanas/${campaignId}/estaciones/${stationId}`);
  return { success: true };
}

export async function deleteOccurrence(
  projectId: string,
  campaignId: string,
  stationId: string,
  occurrenceId: string
) {
  const session = await auth();
  if (!session) throw new Error("No autorizado");

  await prisma.occurrence.delete({ where: { id: occurrenceId } });
  revalidatePath(`/proyectos/${projectId}/campanas/${campaignId}/estaciones/${stationId}`);
  return { success: true };
}

export async function searchSpecies(query: string, surveyType: string) {
  const species = await prisma.species.findMany({
    where: {
      type: surveyType,
      OR: [
        { genus: { contains: query, mode: "insensitive" } },
        { species: { contains: query, mode: "insensitive" } },
        { commonName: { contains: query, mode: "insensitive" } },
        { family: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      genus: true,
      species: true,
      commonName: true,
      family: true,
      conservationStatus: true,
    },
    take: 15,
    orderBy: { genus: "asc" },
  });
  return species;
}
