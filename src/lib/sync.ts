"use client";

import { getDb } from "@/lib/db";
import {
  createOccurrence,
  createGrillaOccurrences,
} from "@/app/(app)/proyectos/[id]/campanas/[cid]/estaciones/[sid]/ocurrencias/actions";

export async function syncPendingOccurrences(): Promise<{ synced: number; failed: number }> {
  const db = getDb();
  if (!db) return { synced: 0, failed: 0 };
  const pending = await db.pendingOccurrences.where("status").equals("pending").toArray();
  let synced = 0;
  let failed = 0;

  for (const record of pending) {
    try {
      const { projectId, campaignId, stationId, payload } = record;
      let result: { success?: boolean; error?: unknown } = {};

      if (payload.kind === "single") {
        result = await createOccurrence(projectId, campaignId, stationId, payload.data);
      } else if (payload.kind === "grilla") {
        result = await createGrillaOccurrences(projectId, campaignId, stationId, payload.data);
      } else if (payload.kind === "sherman") {
        const { speciesId, detectionMethod, deviceId, latitude, longitude, notes, methodologyData, captures } = payload.data;
        let lastResult: typeof result = {};
        for (const capture of captures) {
          lastResult = await createOccurrence(projectId, campaignId, stationId, {
            speciesId,
            date: capture.date,
            abundance: capture.abundance,
            detectionMethod,
            latitude,
            longitude,
            notes,
            methodologyData,
          });
        }
        result = lastResult;
      }

      if ("error" in result && result.error) {
        await db.pendingOccurrences.update(record.localId!, {
          status: "error",
          errorMessage: String(result.error),
        });
        failed++;
      } else {
        await db.pendingOccurrences.delete(record.localId!);
        synced++;
      }
    } catch (err) {
      await db.pendingOccurrences.update(record.localId!, {
        status: "error",
        errorMessage: err instanceof Error ? err.message : "Error desconocido",
      });
      failed++;
    }
  }

  return { synced, failed };
}

export async function seedLocalCache(): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    const res = await fetch("/api/seed-cache");
    if (!res.ok) return;
    const { projects, campaigns, stations, species } = await res.json();
    await Promise.all([
      db.projects.bulkPut(projects),
      db.campaigns.bulkPut(campaigns),
      db.stations.bulkPut(stations),
      db.species.bulkPut(species),
    ]);
  } catch {
    // silently fail — offline or auth issue
  }
}
