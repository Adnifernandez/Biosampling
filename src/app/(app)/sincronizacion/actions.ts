"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import type { SingleOccurrenceData } from "@/lib/db";
import type {
  SyncCampaignItem, SyncStationItem, SyncOccurrenceItem,
  SyncItemResult, SyncBatchResponse,
} from "@/lib/sync-types";

// Never duplicate:
// - Every create uses the id fixed on the device + skipDuplicates, so sending the
//   same record twice (e.g. the response was lost to a signal drop) is harmless.
// - Before creating, an identical record already on the server (same campaign/
//   réplica name, or same occurrence data) is reused instead. This also covers
//   records an older sync uploaded without telling the phone.

const MSG_CLOSED = "El proyecto está cerrado y no permite cambios";

function fail(key: string, message: string, retry = false): SyncItemResult {
  return { key, ok: false, retry, message };
}

function dbFailure(key: string, err: unknown): SyncItemResult {
  if (err instanceof Prisma.PrismaClientKnownRequestError || err instanceof Prisma.PrismaClientValidationError) {
    const code = err instanceof Prisma.PrismaClientKnownRequestError ? ` (${err.code})` : "";
    return fail(key, `El servidor rechazó los datos de este registro${code}`);
  }
  return fail(key, "Error temporal del servidor", true);
}

function float(v?: string | null): number | null {
  if (!v) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function int(v?: string | number | null): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? Math.trunc(v) : parseInt(v);
  return Number.isFinite(n) ? n : null;
}

function parseDate(v?: string): Date | null {
  if (!v) return new Date();
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// ── Campaigns ──
export async function syncCampaignsBatch(items: SyncCampaignItem[]): Promise<SyncBatchResponse> {
  const session = await auth();
  if (!session?.user?.id) return { authError: true };

  const projects = await prisma.project.findMany({
    where: { id: { in: [...new Set(items.map(i => i.projectId))] } },
    select: { id: true, status: true },
  });
  const projectStatus = new Map(projects.map(p => [p.id, p.status]));

  const results: SyncItemResult[] = [];
  for (const c of items) {
    const status = projectStatus.get(c.projectId);
    const startDate = parseDate(c.startDate);
    const endDate = parseDate(c.endDate);
    if (!status) { results.push(fail(c.key, "El proyecto ya no existe en el servidor")); continue; }
    if (status === "COMPLETED") { results.push(fail(c.key, MSG_CLOSED)); continue; }
    if (!c.name || !c.surveyType || !c.methodology || !c.startDate || !c.endDate || !startDate || !endDate) {
      results.push(fail(c.key, "Faltan datos de la campaña (tipo, metodología o fechas)"));
      continue;
    }
    try {
      const same = await prisma.campaign.findFirst({
        where: {
          OR: [
            { id: c.id },
            { projectId: c.projectId, name: c.name, surveyType: c.surveyType, methodology: c.methodology, startDate },
          ],
        },
        select: { id: true },
      });
      if (same) { results.push({ key: c.key, ok: true, id: same.id, existing: true }); continue; }
      await prisma.campaign.createMany({
        data: [{
          id: c.id,
          projectId: c.projectId,
          name: c.name,
          surveyType: c.surveyType,
          methodology: c.methodology,
          startDate,
          endDate,
          notes: c.notes || null,
          responsible: c.responsible || null,
          shermanTrapCount: c.shermanTrapCount ?? null,
          cameraTrapCount: c.cameraTrapCount ?? null,
          status: "ACTIVE",
        }],
        skipDuplicates: true,
      });
      results.push({ key: c.key, ok: true, id: c.id });
    } catch (err) {
      results.push(dbFailure(c.key, err));
    }
  }

  revalidatePath("/campanas");
  for (const id of new Set(items.map(i => i.projectId))) revalidatePath(`/proyectos/${id}`);
  return { results };
}

// ── Stations / réplicas ──
export async function syncStationsBatch(items: SyncStationItem[]): Promise<SyncBatchResponse> {
  const session = await auth();
  if (!session?.user?.id) return { authError: true };

  const campaigns = await prisma.campaign.findMany({
    where: { id: { in: [...new Set(items.map(i => i.campaignId))] } },
    select: { id: true, projectId: true, project: { select: { status: true } } },
  });
  const campaignById = new Map(campaigns.map(c => [c.id, c]));

  const results: SyncItemResult[] = [];
  for (const s of items) {
    const campaign = campaignById.get(s.campaignId);
    if (!campaign) { results.push(fail(s.key, "La campaña ya no existe en el servidor")); continue; }
    if (campaign.project.status === "COMPLETED") { results.push(fail(s.key, MSG_CLOSED)); continue; }
    if (!s.name || !s.type) { results.push(fail(s.key, "Faltan datos de la réplica (nombre o tipo)")); continue; }
    try {
      const same = await prisma.station.findFirst({
        where: { OR: [{ id: s.id }, { campaignId: s.campaignId, name: s.name, parentId: null }] },
        select: { id: true },
      });
      if (same) { results.push({ key: s.key, ok: true, id: same.id, existing: true }); continue; }
      await prisma.station.createMany({
        data: [{
          id: s.id,
          campaignId: s.campaignId,
          name: s.name,
          type: s.type,
          area: s.area ?? null,
          length: s.length ?? null,
          width: s.width ?? null,
          latitude: s.latitude ?? null,
          longitude: s.longitude ?? null,
          notes: s.notes ?? null,
        }],
        skipDuplicates: true,
      });
      results.push({ key: s.key, ok: true, id: s.id });
    } catch (err) {
      results.push(dbFailure(s.key, err));
    }
  }

  revalidatePath("/estaciones");
  for (const c of campaigns) revalidatePath(`/proyectos/${c.projectId}/campanas/${c.id}`);
  return { results };
}

// ── Occurrences ──
type Row = Prisma.OccurrenceCreateManyInput;

function singleRow(id: string, stationId: string, userId: string, d: SingleOccurrenceData, date: Date): Row {
  return {
    id, stationId, userId,
    speciesId: d.speciesId,
    date,
    latitude: float(d.latitude),
    longitude: float(d.longitude),
    abundance: int(d.abundance),
    cover: float(d.cover),
    height: float(d.height),
    stratum: d.stratum || null,
    phenology: d.phenology || null,
    distance: float(d.distance),
    bearing: float(d.bearing),
    groupSize: int(d.groupSize),
    behavior: d.behavior || null,
    detectionMethod: d.detectionMethod || null,
    notes: d.notes || null,
    methodologyData: d.methodologyData || null,
  };
}

// Builds the rows exactly like createOccurrence / createGrillaOccurrences do,
// or returns the reason the record can't be saved.
function buildRows(item: SyncOccurrenceItem, userId: string): Row[] | string {
  const { payload, ids, stationId } = item;

  if (payload.kind === "single") {
    const date = parseDate(payload.data.date);
    if (!date) return "La fecha del registro no es válida";
    if (!payload.data.speciesId) return "El registro no tiene especie";
    if (ids.length < 1) return "Faltan identificadores del registro";
    return [singleRow(ids[0], stationId, userId, payload.data, date)];
  }

  if (payload.kind === "grilla") {
    const d = payload.data as typeof payload.data & { utmNorth?: string; utmEast?: string; utmZone?: string };
    const date = parseDate(d.date);
    if (!date) return "La fecha de la grilla no es válida";
    if (d.species.length === 0 && d.sinVegetacion === 0) return "Grilla vacía: sin especies ni puntos sin vegetación";
    if (ids.length < d.species.length) return "Faltan identificadores del registro";
    const methodologyData = JSON.stringify({
      sinVegetacion: d.sinVegetacion,
      totalIntersections: 16,
      ...(d.utmNorth ? { utm_north: d.utmNorth, utm_east: d.utmEast, utm_zone: d.utmZone } : {}),
      ...(d.photo ? { photo: d.photo } : {}),
    });
    return d.species.map((s, i) => ({
      id: ids[i], stationId, userId,
      speciesId: s.speciesId,
      date,
      abundance: s.count,
      groupSize: s.individuos ?? null,
      notes: d.notes || null,
      methodologyData,
    }));
  }

  // sherman: one occurrence per capture
  const d = payload.data;
  if (ids.length < d.captures.length) return "Faltan identificadores del registro";
  const rows: Row[] = [];
  for (let i = 0; i < d.captures.length; i++) {
    const date = parseDate(d.captures[i].date);
    if (!date) return "La fecha de una captura no es válida";
    rows.push(singleRow(ids[i], stationId, userId, {
      speciesId: d.speciesId,
      date: d.captures[i].date,
      abundance: d.captures[i].abundance,
      detectionMethod: d.detectionMethod,
      latitude: d.latitude,
      longitude: d.longitude,
      notes: d.notes,
      methodologyData: d.methodologyData,
    }, date));
  }
  return rows;
}

// Fields that make two occurrences "the same record" (everything but id/user/timestamps)
const SIG_FIELDS = {
  stationId: true, speciesId: true, date: true, abundance: true, cover: true, height: true,
  stratum: true, phenology: true, distance: true, bearing: true, groupSize: true,
  behavior: true, detectionMethod: true, notes: true, methodologyData: true,
  latitude: true, longitude: true,
} as const;

type SigSource = {
  stationId: string; speciesId: string; date?: Date | string | null;
  abundance?: number | null; cover?: number | null; height?: number | null;
  stratum?: string | null; phenology?: string | null; distance?: number | null; bearing?: number | null;
  groupSize?: number | null; behavior?: string | null; detectionMethod?: string | null;
  notes?: string | null; methodologyData?: string | null;
  latitude?: number | null; longitude?: number | null;
};

function signature(o: SigSource): string {
  const date = o.date ? new Date(o.date).toISOString() : null;
  return JSON.stringify([
    o.stationId, o.speciesId, date, o.abundance ?? null, o.cover ?? null, o.height ?? null,
    o.stratum ?? null, o.phenology ?? null, o.distance ?? null, o.bearing ?? null,
    o.groupSize ?? null, o.behavior ?? null, o.detectionMethod ?? null, o.notes ?? null,
    o.methodologyData ?? null, o.latitude ?? null, o.longitude ?? null,
  ]);
}

export async function syncOccurrencesBatch(items: SyncOccurrenceItem[]): Promise<SyncBatchResponse> {
  const session = await auth();
  if (!session?.user?.id) return { authError: true };
  const userId = session.user.id;

  const stations = await prisma.station.findMany({
    where: { id: { in: [...new Set(items.map(i => i.stationId))] } },
    select: { id: true, campaignId: true, campaign: { select: { projectId: true, project: { select: { status: true } } } } },
  });
  const stationById = new Map(stations.map(s => [s.id, s]));

  const built: { key: string; rows: Row[] }[] = [];
  const results: SyncItemResult[] = [];
  for (const item of items) {
    const station = stationById.get(item.stationId);
    if (!station) { results.push(fail(item.key, "La réplica o estación ya no existe en el servidor")); continue; }
    if (station.campaign.project.status === "COMPLETED") { results.push(fail(item.key, MSG_CLOSED)); continue; }
    const rows = buildRows(item, userId);
    if (typeof rows === "string") { results.push(fail(item.key, rows)); continue; }
    built.push({ key: item.key, rows });
  }

  // Species must exist (a quick-added species may have been deleted meanwhile)
  const speciesIds = [...new Set(built.flatMap(b => b.rows.map(r => r.speciesId)))];
  const existing = new Set((await prisma.species.findMany({
    where: { id: { in: speciesIds } }, select: { id: true },
  })).map(s => s.id));
  const valid: typeof built = [];
  for (const b of built) {
    if (b.rows.some(r => !existing.has(r.speciesId))) results.push(fail(b.key, "Una especie del registro ya no existe en el catálogo"));
    else valid.push(b);
  }

  // Drop rows the server already has: same id (an earlier attempt got through)
  // or identical data at the same réplica (uploaded by an older sync, or the
  // same record saved twice on the phone).
  const allRows = valid.flatMap(b => b.rows);
  const knownIds = new Set((await prisma.occurrence.findMany({
    where: { id: { in: allRows.map(r => r.id!) } }, select: { id: true },
  })).map(o => o.id));
  const knownSigs = new Set((await prisma.occurrence.findMany({
    where: {
      stationId: { in: [...new Set(allRows.map(r => r.stationId))] },
      speciesId: { in: [...new Set(allRows.map(r => r.speciesId))] },
    },
    select: SIG_FIELDS,
  })).map(signature));

  const toInsert: { key: string; rows: Row[]; existing: boolean }[] = [];
  for (const b of valid) {
    const fresh: Row[] = [];
    for (const r of b.rows) {
      const sig = signature(r);
      if (knownIds.has(r.id!) || knownSigs.has(sig)) continue;
      knownSigs.add(sig);
      fresh.push(r);
    }
    toInsert.push({ key: b.key, rows: fresh, existing: fresh.length === 0 && b.rows.length > 0 });
  }

  // Fast path: everything in one insert. If it fails, insert one by one so a
  // single bad record doesn't hold back the rest.
  try {
    await prisma.occurrence.createMany({ data: toInsert.flatMap(b => b.rows), skipDuplicates: true });
    for (const b of toInsert) results.push({ key: b.key, ok: true, existing: b.existing });
  } catch {
    for (const b of toInsert) {
      try {
        await prisma.occurrence.createMany({ data: b.rows, skipDuplicates: true });
        results.push({ key: b.key, ok: true, existing: b.existing });
      } catch (err) {
        results.push(dbFailure(b.key, err));
      }
    }
  }

  revalidatePath("/ocurrencias");
  for (const s of stations) {
    revalidatePath(`/proyectos/${s.campaign.projectId}/campanas/${s.campaignId}/estaciones/${s.id}`);
  }
  return { results };
}
