"use client";

import { toast } from "sonner";
import type { Table } from "dexie";
import { getDb } from "@/lib/db";
import type { BioSamplingDB, OccurrencePayload, PendingOccurrence, PendingStation } from "@/lib/db";
import type { SyncBatchResponse, SyncItemResult, SyncOccurrenceItem } from "@/lib/sync-types";
import {
  syncCampaignsBatch, syncStationsBatch, syncOccurrencesBatch,
} from "@/app/(app)/sincronizacion/actions";

// Robust sync. Guarantees:
// - A local record is never deleted: it is marked "synced" only after the server
//   confirms it, and purged SYNCED_RETENTION_MS later.
// - Server ids are fixed on the device before the first attempt, so retries after
//   a lost response never duplicate data.
// - Network/server problems keep records pending and retry with backoff;
//   only records the server rejects go to "error", shown for a person to review.
// - Uploads in batches, so thousands of records sync in minutes.

const BATCH_MAX_ITEMS = 40;
const BATCH_MAX_CHARS = 600_000;   // stays under the 1 MB Server Action body limit (grilla photos)
const BACKOFF_MS = [5_000, 15_000, 30_000, 60_000, 120_000, 300_000];
const SYNCED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export type SyncProblem = null | "network" | "auth" | "server";

export interface SyncState {
  running: boolean;
  total: number;
  done: number;
  lastRunAt: number | null;
  lastSuccessAt: number | null;
  problem: SyncProblem;
  nextRetryAt: number | null;
}

const INITIAL_STATE: SyncState = {
  running: false, total: 0, done: 0,
  lastRunAt: null, lastSuccessAt: null, problem: null, nextRetryAt: null,
};

let state: SyncState = INITIAL_STATE;
const listeners = new Set<() => void>();

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach(l => l());
}

export function subscribeSync(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
export function getSyncState() { return state; }
export function getServerSyncState() { return INITIAL_STATE; }

// ── Helpers ──

class AuthError extends Error {}

function newId(): string {
  // randomUUID only exists on https/localhost; fall back to raw random bytes
  if (typeof crypto.randomUUID === "function") return "off" + crypto.randomUUID().replace(/-/g, "");
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return "off" + Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

function rowCount(payload: OccurrencePayload): number {
  if (payload.kind === "single") return 1;
  if (payload.kind === "grilla") return payload.data.species.length;
  return payload.data.captures.length;
}

function chunkBySize<T>(items: T[]): T[][] {
  const chunks: T[][] = [];
  let current: T[] = [];
  let chars = 0;
  for (const item of items) {
    const size = JSON.stringify(item).length;
    if (current.length > 0 && (current.length >= BATCH_MAX_ITEMS || chars + size > BATCH_MAX_CHARS)) {
      chunks.push(current);
      current = [];
      chars = 0;
    }
    current.push(item);
    chars += size;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

async function send<T>(fn: (items: T[]) => Promise<SyncBatchResponse>, items: T[]): Promise<SyncItemResult[]> {
  const res = await fn(items);
  if (res.authError) throw new AuthError();
  return res.results;
}

// Fix server ids for campaigns/réplicas (few) before anything is sent, reset
// records the old sync left in "error" (it never retried them), and purge
// long-confirmed records. Occurrence ids are fixed per slice in doRun.
let legacyMigrated = false;
async function prepare(db: BioSamplingDB) {
  await db.transaction("rw", db.pendingCampaigns, db.pendingStations, db.pendingOccurrences, async () => {
    await db.pendingCampaigns.filter(c => !c.clientId && c.status !== "synced").modify(c => { c.clientId = newId(); });
    await db.pendingStations.filter(s => !s.clientId && s.status !== "synced").modify(s => { s.clientId = newId(); });

    // Réplicas/records created after their campaign/réplica was already uploaded
    // still point to its local key; link them to the server id or they'd wait forever.
    for (const c of await db.pendingCampaigns.where("status").equals("synced").toArray()) {
      if (!c.serverId) continue;
      await db.pendingStations.where("campaignLocalKey").equals(c.localKey)
        .modify((s: PendingStation) => { s.campaignId = c.serverId; delete s.campaignLocalKey; });
    }
    for (const s of await db.pendingStations.where("status").equals("synced").toArray()) {
      if (!s.serverId) continue;
      await db.pendingOccurrences.where("stationLocalKey").equals(s.localKey)
        .modify((o: PendingOccurrence) => { o.stationId = s.serverId!; delete o.stationLocalKey; });
    }

    // Records that can never be sent (no réplica, or a réplica/campaign missing on
    // this phone) would otherwise sit "pending" forever: surface them for review.
    const orphan = (message: string) => (r: { status: string; errorMessage?: string; attempts?: number }) => {
      r.status = "error"; r.errorMessage = message; r.attempts = (r.attempts ?? 0) + 1;
    };
    for (const missing of ["", "pending"]) {
      await db.pendingOccurrences.where("stationId").equals(missing)
        .filter(o => o.status === "pending" && !o.stationLocalKey).modify(orphan("No tiene réplica asignada"));
    }
    const stationKeys = new Set((await db.pendingStations.toArray()).map(s => s.localKey));
    for (const key of (await db.pendingOccurrences.orderBy("stationLocalKey").uniqueKeys()) as string[]) {
      if (stationKeys.has(key)) continue;
      await db.pendingOccurrences.where("stationLocalKey").equals(key)
        .filter(o => o.status === "pending").modify(orphan("Su réplica no está en este teléfono"));
    }
    const campaignKeys = new Set((await db.pendingCampaigns.toArray()).map(c => c.localKey));
    await db.pendingStations
      .filter(s => s.status === "pending" && !s.campaignId && !(s.campaignLocalKey && campaignKeys.has(s.campaignLocalKey)))
      .modify(orphan("La réplica no tiene campaña asignada"));

    if (!legacyMigrated) {
      // Errors written by the old sync have no `attempts`; give them a fresh try
      const reset = (r: { status: string; attempts?: number; errorMessage?: string }) => {
        if (r.status === "error" && r.attempts === undefined) { r.status = "pending"; r.attempts = 0; }
      };
      await db.pendingCampaigns.where("status").equals("error").modify(reset);
      await db.pendingStations.where("status").equals("error").modify(reset);
      await db.pendingOccurrences.where("status").equals("error").modify(reset);
    }

    const cutoff = Date.now() - SYNCED_RETENTION_MS;
    await db.pendingOccurrences.where("status").equals("synced").filter(o => (o.syncedAt ?? 0) < cutoff).delete();
  });
  legacyMigrated = true;
}

interface RunCounts { synced: number; existing: number; rejected: number; transient: number; }

async function applyFailure(
  table: "pendingCampaigns" | "pendingStations" | "pendingOccurrences",
  db: BioSamplingDB, localId: number, r: Extract<SyncItemResult, { ok: false }>, counts: RunCounts,
) {
  const t = db[table] as unknown as Table<{ attempts?: number; status: string; errorMessage?: string }, number>;
  const attempts = ((await t.get(localId))?.attempts ?? 0) + 1;
  if (r.retry) {
    await t.update(localId, { errorMessage: r.message, attempts });
    counts.transient++;
  } else {
    await t.update(localId, { status: "error", errorMessage: r.message, attempts });
    counts.rejected++;
  }
}

async function sendOccurrenceChunk(db: BioSamplingDB, chunk: SyncOccurrenceItem[], counts: RunCounts) {
  const results = await send(syncOccurrencesBatch, chunk);
  await db.transaction("rw", db.pendingOccurrences, async () => {
    for (const r of results) {
      const localId = Number(r.key);
      if (r.ok) {
        // The server has it now: keep a light copy (no photo) for the history
        await db.pendingOccurrences.where("localId").equals(localId).modify((o: PendingOccurrence) => {
          o.status = "synced";
          o.syncedAt = Date.now();
          o.alreadyOnServer = !!r.existing;
          delete o.errorMessage;
          if (o.payload.kind === "grilla") delete o.payload.data.photo;
        });
        counts.synced++;
        if (r.existing) counts.existing++;
      } else {
        await applyFailure("pendingOccurrences", db, localId, r, counts);
      }
    }
  });
}

// ── The sync run ──

let running = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let backoffIdx = 0;

function scheduleRetry() {
  if (retryTimer) clearTimeout(retryTimer);
  const delay = BACKOFF_MS[Math.min(backoffIdx, BACKOFF_MS.length - 1)];
  backoffIdx++;
  setState({ nextRetryAt: Date.now() + delay });
  retryTimer = setTimeout(() => { retryTimer = null; void runRobustSync(); }, delay);
}

function clearRetry() {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  backoffIdx = 0;
  setState({ nextRetryAt: null });
}

async function doRun(db: BioSamplingDB, manual: boolean) {
  await prepare(db);
  const counts: RunCounts = { synced: 0, existing: 0, rejected: 0, transient: 0 };

  const [nCamp, nSta, nOcc] = await Promise.all([
    db.pendingCampaigns.where("status").equals("pending").count(),
    db.pendingStations.where("status").equals("pending").count(),
    db.pendingOccurrences.where("status").equals("pending").count(),
  ]);
  const total = nCamp + nSta + nOcc;
  if (total === 0) {
    clearRetry();
    setState({ problem: null, lastSuccessAt: Date.now() });
    if (manual) toast.success("Todo está subido al servidor");
    return;
  }

  setState({ running: true, total, done: 0, problem: null });
  const tick = (n: number) => setState({ done: state.done + n });

  try {
    // 1. Campaigns
    const campaigns = await db.pendingCampaigns.where("status").equals("pending").toArray();
    for (const chunk of chunkBySize(campaigns)) {
      const results = await send(syncCampaignsBatch, chunk.map(c => ({
        key: String(c.localId), id: c.clientId!, projectId: c.projectId, name: c.name,
        surveyType: c.surveyType, methodology: c.methodology, startDate: c.startDate, endDate: c.endDate,
        notes: c.notes, responsible: c.responsible,
        shermanTrapCount: c.shermanTrapCount, cameraTrapCount: c.cameraTrapCount,
      })));
      await db.transaction("rw", db.pendingCampaigns, db.pendingStations, async () => {
        for (const r of results) {
          const c = chunk.find(x => String(x.localId) === r.key)!;
          if (r.ok) {
            const serverId = r.id ?? c.clientId!;   // an identical campaign may already exist
            await db.pendingCampaigns.update(c.localId!, { status: "synced", serverId, syncedAt: Date.now(), errorMessage: undefined });
            await db.pendingStations.where("campaignLocalKey").equals(c.localKey)
              .modify((s: PendingStation) => { s.campaignId = serverId; delete s.campaignLocalKey; });
            counts.synced++;
          } else {
            await applyFailure("pendingCampaigns", db, c.localId!, r, counts);
          }
        }
      });
      tick(chunk.length);
    }

    // 2. Stations whose campaign already exists on the server
    const stations = (await db.pendingStations.where("status").equals("pending").toArray()).filter(s => s.campaignId);
    for (const chunk of chunkBySize(stations)) {
      const results = await send(syncStationsBatch, chunk.map(s => ({
        key: String(s.localId), id: s.clientId!, campaignId: s.campaignId!, name: s.name, type: s.type,
        area: s.area, length: s.length, width: s.width,
        latitude: s.latitude, longitude: s.longitude, notes: s.notes,
      })));
      await db.transaction("rw", db.pendingStations, db.pendingOccurrences, async () => {
        for (const r of results) {
          const s = chunk.find(x => String(x.localId) === r.key)!;
          if (r.ok) {
            const serverId = r.id ?? s.clientId!;   // an identical réplica may already exist
            await db.pendingStations.update(s.localId!, { status: "synced", serverId, syncedAt: Date.now(), errorMessage: undefined });
            await db.pendingOccurrences.where("stationLocalKey").equals(s.localKey)
              .modify((o: PendingOccurrence) => { o.stationId = serverId; delete o.stationLocalKey; });
            counts.synced++;
          } else {
            await applyFailure("pendingStations", db, s.localId!, r, counts);
          }
        }
      });
      tick(chunk.length);
    }

    // 3. Occurrences whose station already exists on the server, oldest first.
    // Read in slices (keys only up front) so thousands of records with photos
    // never sit in memory at once.
    const keys = (await db.pendingOccurrences.where("status").equals("pending").primaryKeys()) as number[];
    keys.sort((a, b) => a - b);
    for (let i = 0; i < keys.length; i += BATCH_MAX_ITEMS) {
      const slice = (await db.pendingOccurrences.bulkGet(keys.slice(i, i + BATCH_MAX_ITEMS)))
        .filter((o): o is PendingOccurrence => !!o && o.status === "pending");
      const ready = slice.filter(o => !o.stationLocalKey && o.stationId && o.stationId !== "pending");
      tick(slice.length - ready.length);
      if (ready.length === 0) continue;

      // Fix the server ids on the device BEFORE sending, so a retry reuses them
      await db.transaction("rw", db.pendingOccurrences, async () => {
        for (const o of ready) {
          const ids = o.clientIds ?? [];
          if (ids.length >= rowCount(o.payload)) continue;
          while (ids.length < rowCount(o.payload)) ids.push(newId());
          o.clientIds = ids;
          await db.pendingOccurrences.update(o.localId!, { clientIds: ids });
        }
      });

      const items: SyncOccurrenceItem[] = ready.map(o => ({
        key: String(o.localId), ids: o.clientIds!, stationId: o.stationId, payload: o.payload,
      }));
      for (const chunk of chunkBySize(items)) {
        await sendOccurrenceChunk(db, chunk, counts);
        tick(chunk.length);
      }
    }

    // Records still waiting on a réplica/campaign with problems are counted in
    // `total` but not sent; close the progress bar anyway.
    setState({ done: state.total });
    if (counts.transient > 0) {
      setState({ problem: "server" });
      scheduleRetry();
    } else {
      clearRetry();
      setState({ problem: null, lastSuccessAt: Date.now() });
    }
  } catch (err) {
    if (err instanceof AuthError) {
      setState({ problem: "auth" });
      toast.error("Tu sesión expiró", {
        description: "Los datos siguen guardados en el teléfono. Inicia sesión de nuevo para subirlos.",
        action: { label: "Iniciar sesión", onClick: () => { window.location.href = "/login"; } },
        duration: 15_000,
      });
    } else {
      setState({ problem: navigator.onLine ? "server" : "network" });
      scheduleRetry();
      if (manual || counts.synced > 0) {
        toast.warning("Se cortó la conexión", {
          description: "Lo que falta sigue guardado en el teléfono y se reintentará solo.",
        });
      }
    }
  }

  if (counts.synced > 0) {
    toast.success(`${counts.synced} registro${counts.synced > 1 ? "s" : ""} subido${counts.synced > 1 ? "s" : ""} al servidor`, {
      description: counts.existing > 0
        ? `${counts.existing} ya estaba${counts.existing > 1 ? "n" : ""} en el servidor y no se duplicaron.`
        : undefined,
    });
  }
  if (counts.rejected > 0) {
    toast.error(`${counts.rejected} registro${counts.rejected > 1 ? "s" : ""} necesita${counts.rejected > 1 ? "n" : ""} revisión`, {
      description: "Siguen guardados en el teléfono.",
      // Pages that already list the problems don't need the link
      action: window.location.pathname === "/sincronizacion"
        ? undefined
        : { label: "Ver detalle", onClick: () => { window.location.href = "/sincronizacion"; } },
      duration: 15_000,
    });
  }
}

type RetryTarget = "all" | { occurrences?: number[]; stations?: number[]; campaigns?: number[] };

// Give records the server rejected another chance (after fixing the cause).
async function resetRejected(db: BioSamplingDB, target: RetryTarget) {
  const reset = { status: "pending" as const, errorMessage: undefined };
  await db.transaction("rw", db.pendingCampaigns, db.pendingStations, db.pendingOccurrences, async () => {
    if (target === "all") {
      await db.pendingCampaigns.where("status").equals("error").modify(reset);
      await db.pendingStations.where("status").equals("error").modify(reset);
      await db.pendingOccurrences.where("status").equals("error").modify(reset);
      return;
    }
    for (const id of target.campaigns ?? []) await db.pendingCampaigns.update(id, reset);
    for (const id of target.stations ?? []) await db.pendingStations.update(id, reset);
    for (const id of target.occurrences ?? []) await db.pendingOccurrences.update(id, reset);
  });
}

export async function runRobustSync(opts: { manual?: boolean; retry?: RetryTarget } = {}): Promise<void> {
  const db = getDb();
  if (!db || running) return;
  if (!navigator.onLine) {
    setState({ problem: "network" });
    if (opts.manual) toast.warning("Sin conexión", { description: "Los datos quedan guardados en el teléfono hasta que vuelva la señal." });
    return;
  }

  running = true;
  try {
    // Resetting happens inside the lock, so the old sync can't grab those records meanwhile
    const run = async () => {
      if (opts.retry) await resetRejected(db, opts.retry);
      await doRun(db, !!opts.manual);
    };
    // One sync at a time (also across tabs and with the old sync). A button press
    // waits for the other one to finish; automatic runs just skip.
    if (typeof navigator !== "undefined" && navigator.locks) {
      if (opts.manual) await navigator.locks.request("biosampling-sync", run);
      else await navigator.locks.request("biosampling-sync", { ifAvailable: true }, async lock => { if (lock) await run(); });
    } else {
      await run();
    }
  } finally {
    running = false;
    setState({ running: false, lastRunAt: Date.now() });
  }
}

// Called right after a record is saved locally: upload soon if there's signal.
let soonTimer: ReturnType<typeof setTimeout> | null = null;
export function requestSyncSoon() {
  if (soonTimer) clearTimeout(soonTimer);
  soonTimer = setTimeout(() => { soonTimer = null; if (navigator.onLine) void runRobustSync(); }, 2_000);
}

// Signal is back: retry right away instead of waiting for the backoff.
export function syncNow() {
  clearRetry();
  void runRobustSync();
}

// Upload now, giving rejected records (all, or the given ones) another chance.
export async function retryRejected(localIds?: { occurrences?: number[]; stations?: number[]; campaigns?: number[] }) {
  clearRetry();
  await runRobustSync({ manual: true, retry: localIds ?? "all" });
}
