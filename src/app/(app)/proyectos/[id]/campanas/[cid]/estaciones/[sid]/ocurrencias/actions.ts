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

export async function getStationBBSpeciesIds(stationId: string): Promise<string[]> {
  const rows = await prisma.occurrence.findMany({
    where: { stationId },
    select: { speciesId: true },
  });
  return rows.map(r => r.speciesId);
}

export async function getStationTransectoRegistrations(stationId: string): Promise<{
  id: string; speciesId: string; abundance: string | null; conCoordenadas: boolean; detectionMethod: string | null;
}[]> {
  const rows = await prisma.occurrence.findMany({
    where: { stationId },
    select: { id: true, speciesId: true, abundance: true, latitude: true, longitude: true, detectionMethod: true },
  });
  return rows.map(r => ({
    id: r.id,
    speciesId: r.speciesId,
    abundance: r.abundance != null ? String(r.abundance) : null,
    conCoordenadas: !!(r.latitude && r.longitude),
    detectionMethod: r.detectionMethod,
  }));
}

export async function updateTransectoOccurrenceAbundance(
  id: string,
  newAbundance: string
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");
  await prisma.occurrence.update({
    where: { id },
    data: { abundance: newAbundance ? parseInt(newAbundance) : null },
  });
  revalidatePath("/ocurrencias");
}

// Aviso amarillo del transecto de fauna (2026-11-13; primero sólo ADMIN, luego para todos):
// más individuos de una especie ya registrada en el transecto. Se guardan como otro registro de la
// misma especie, con las coordenadas nuevas o sin coordenadas; el registro anterior no se toca.
export async function addTransectoSighting(
  baseOccurrenceId: string,
  data: {
    abundance: string;
    latitude?: number | null;
    longitude?: number | null;
    date: string;
    time?: string;
    detectionMethod?: string;
    notes?: string;
  }
): Promise<{ error?: string; id?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "No autorizado" };

  const abundance = parseInt(data.abundance);
  if (!Number.isInteger(abundance) || abundance < 1) return { error: "Cantidad no válida" };
  const conCoordenadas = data.latitude != null && data.longitude != null;
  if (conCoordenadas && (!Number.isFinite(data.latitude) || !Number.isFinite(data.longitude))) {
    return { error: "Coordenadas no válidas" };
  }

  const base = await prisma.occurrence.findUnique({
    where: { id: baseOccurrenceId },
    select: {
      stationId: true,
      speciesId: true,
      detectionMethod: true,
      station: { select: { campaignId: true, campaign: { select: { projectId: true, project: { select: { status: true } } } } } },
    },
  });
  if (!base) return { error: "No se encontró el registro anterior" };
  if (base.station.campaign.project.status === "COMPLETED") return { error: "El proyecto está cerrado y no permite cambios" };

  const nueva = await prisma.occurrence.create({
    data: {
      stationId: base.stationId,
      speciesId: base.speciesId,
      userId: session.user.id,
      date: data.date ? new Date(data.date) : new Date(),
      latitude: conCoordenadas ? data.latitude : null,
      longitude: conCoordenadas ? data.longitude : null,
      abundance,
      detectionMethod: data.detectionMethod || base.detectionMethod,
      notes: data.notes || null,
      methodologyData: data.time ? JSON.stringify({ time: data.time }) : null,
    },
  });

  revalidatePath(`/proyectos/${base.station.campaign.projectId}/campanas/${base.station.campaignId}/estaciones/${base.stationId}`);
  revalidatePath("/ocurrencias");
  return { id: nueva.id };
}

export async function getCampaignSpecies(campaignId: string): Promise<{
  id: string; genus: string; species: string;
  commonName: string | null; family: string; conservationStatus: string | null;
}[]> {
  const rows = await prisma.occurrence.findMany({
    where: { station: { campaignId } },
    select: {
      speciesId: true,
      species: { select: { id: true, genus: true, species: true, commonName: true, family: true, conservationStatus: true } },
    },
  });
  const map = new Map<string, {
    sp: { id: string; genus: string; species: string; commonName: string | null; family: string; conservationStatus: string | null };
    count: number;
  }>();
  for (const r of rows) {
    const existing = map.get(r.speciesId);
    if (existing) existing.count++;
    else map.set(r.speciesId, { sp: r.species, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count).map((v) => v.sp);
}

// Species already registered at this station — across every trap/point and every date,
// so Sherman/camera-trap entries can suggest species seen in other traps or on previous days.
export async function getStationSpecies(stationId: string): Promise<{
  id: string; genus: string; species: string;
  commonName: string | null; family: string; conservationStatus: string | null;
}[]> {
  const rows = await prisma.occurrence.findMany({
    where: { stationId },
    select: {
      speciesId: true,
      species: { select: { id: true, genus: true, species: true, commonName: true, family: true, conservationStatus: true } },
    },
  });
  const map = new Map<string, {
    sp: { id: string; genus: string; species: string; commonName: string | null; family: string; conservationStatus: string | null };
    count: number;
  }>();
  for (const r of rows) {
    const existing = map.get(r.speciesId);
    if (existing) existing.count++;
    else map.set(r.speciesId, { sp: r.species, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count).map((v) => v.sp);
}

export async function searchSpecies(query: string, surveyType: string) {
  const pattern = `%${query}%`;
  return prisma.$queryRaw<Array<{
    id: string; genus: string; species: string;
    commonName: string | null; family: string; conservationStatus: string | null;
  }>>`
    SELECT id, genus, species, "commonName", family, "conservationStatus"
    FROM "Species"
    WHERE "type" = ${surveyType}
      AND (
        unaccent(genus || ' ' || species) ILIKE unaccent(${pattern}) OR
        unaccent(genus)        ILIKE unaccent(${pattern}) OR
        unaccent(species)      ILIKE unaccent(${pattern}) OR
        unaccent("commonName") ILIKE unaccent(${pattern}) OR
        unaccent(family)       ILIKE unaccent(${pattern}) OR
        unaccent(COALESCE(orden, ''))     ILIKE unaccent(${pattern}) OR
        unaccent(COALESCE(clase, ''))     ILIKE unaccent(${pattern}) OR
        unaccent(COALESCE(division, ''))  ILIKE unaccent(${pattern}) OR
        unaccent(COALESCE(habito, ''))              ILIKE unaccent(${pattern}) OR
        unaccent(COALESCE(origen, ''))              ILIKE unaccent(${pattern}) OR
        unaccent(COALESCE("conservationStatus", '')) ILIKE unaccent(${pattern}) OR
        unaccent(COALESCE("macrofitasHabito", ''))   ILIKE unaccent(${pattern}) OR
        unaccent(COALESCE(category, ''))             ILIKE unaccent(${pattern})
      )
    ORDER BY genus
    LIMIT 50
  `;
}
