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

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { status: true } });
  if (project?.status === "COMPLETED") return { error: "El proyecto está cerrado y no permite cambios" };

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

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { status: true } });
  if (project?.status === "COMPLETED") return { error: "El proyecto está cerrado y no permite cambios" };

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

export async function createGrillaOccurrences(
  projectId: string,
  campaignId: string,
  stationId: string,
  data: {
    date: string;
    notes?: string;
    sinVegetacion: number;
    utmNorth?: string;
    utmEast?: string;
    utmZone?: string;
    photo?: string;
    species: { speciesId: string; count: number; individuos?: number }[];
  }
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { status: true } });
  if (project?.status === "COMPLETED") return { error: "El proyecto está cerrado y no permite cambios" };

  if (data.species.length === 0 && data.sinVegetacion === 0) return { error: "Agrega al menos una especie o puntos sin vegetación" };

  const userId = session.user.id;
  const methodologyData = JSON.stringify({
    sinVegetacion: data.sinVegetacion,
    totalIntersections: 16,
    ...(data.utmNorth ? { utm_north: data.utmNorth, utm_east: data.utmEast, utm_zone: data.utmZone } : {}),
    ...(data.photo ? { photo: data.photo } : {}),
  });

  if (data.species.length > 0) {
    await prisma.occurrence.createMany({
      data: data.species.map((s) => ({
        stationId,
        speciesId: s.speciesId,
        userId,
        date: data.date ? new Date(data.date) : new Date(),
        abundance: s.count,
        groupSize: s.individuos ?? null,
        notes: data.notes || null,
        methodologyData,
      })),
    });
  }

  revalidatePath(`/proyectos/${projectId}/campanas/${campaignId}/estaciones/${stationId}`);
  revalidatePath("/ocurrencias");
  return { success: true, count: data.species.length };
}

export async function deleteGrillaOccurrences(
  projectId: string,
  campaignId: string,
  stationId: string,
) {
  const session = await auth();
  if (!session) throw new Error("No autorizado");
  await prisma.occurrence.deleteMany({ where: { stationId } });
  revalidatePath(`/proyectos/${projectId}/campanas/${campaignId}/estaciones/${stationId}`);
  revalidatePath("/ocurrencias");
  return { success: true };
}

export async function updateGrillaOccurrences(
  projectId: string,
  campaignId: string,
  stationId: string,
  data: {
    date: string;
    notes?: string;
    sinVegetacion: number;
    utmNorth?: string;
    utmEast?: string;
    utmZone?: string;
    photo?: string;
    species: { speciesId: string; count: number; individuos?: number }[];
  }
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { status: true } });
  if (project?.status === "COMPLETED") return { error: "El proyecto está cerrado y no permite cambios" };

  const userId = session.user.id;
  const methodologyData = JSON.stringify({
    sinVegetacion: data.sinVegetacion,
    totalIntersections: 16,
    ...(data.utmNorth ? { utm_north: data.utmNorth, utm_east: data.utmEast, utm_zone: data.utmZone } : {}),
    ...(data.photo ? { photo: data.photo } : {}),
  });

  await prisma.occurrence.deleteMany({ where: { stationId } });

  if (data.species.length > 0) {
    await prisma.occurrence.createMany({
      data: data.species.map((s) => ({
        stationId,
        speciesId: s.speciesId,
        userId,
        date: data.date ? new Date(data.date) : new Date(),
        abundance: s.count,
        groupSize: s.individuos ?? null,
        notes: data.notes || null,
        methodologyData,
      })),
    });
  }

  revalidatePath(`/proyectos/${projectId}/campanas/${campaignId}/estaciones/${stationId}`);
  revalidatePath("/ocurrencias");
  return { success: true };
}

export async function updateTransectoCoordinates(
  transectoId: string,
  latitude: number,
  longitude: number
) {
  const session = await auth();
  if (!session) throw new Error("No autorizado");
  await prisma.station.update({ where: { id: transectoId }, data: { latitude, longitude } });
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
