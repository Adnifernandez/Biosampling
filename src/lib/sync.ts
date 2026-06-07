"use client";

import { getDb } from "@/lib/db";
import type { PendingOccurrence, PendingCampaign, PendingStation } from "@/lib/db";
import {
  createOccurrence,
  createGrillaOccurrences,
} from "@/app/(app)/proyectos/[id]/campanas/[cid]/estaciones/[sid]/ocurrencias/actions";
import { createCampanaData } from "@/app/(app)/campanas/actions";
import { createEstacionData } from "@/app/(app)/estaciones/actions-offline";

export async function syncPendingOccurrences(): Promise<{ synced: number; failed: number }> {
  const db = getDb();
  if (!db) return { synced: 0, failed: 0 };
  let synced = 0;
  let failed = 0;

  // ── 1. Sync pending campaigns ──
  const pendingCampaigns = await db.pendingCampaigns.where("status").equals("pending").toArray();
  for (const campaign of pendingCampaigns) {
    try {
      const result = await createCampanaData({
        projectId: campaign.projectId,
        name: campaign.name,
        surveyType: campaign.surveyType,
        methodology: campaign.methodology,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        notes: campaign.notes,
        responsible: campaign.responsible,
        shermanTrapCount: campaign.shermanTrapCount,
        cameraTrapCount: campaign.cameraTrapCount,
      });

      if ("error" in result && result.error) {
        await db.pendingCampaigns.update(campaign.localId!, {
          status: "error", errorMessage: String(result.error),
        });
        failed++;
      } else if ("success" in result && result.id) {
        const serverId = result.id;
        await db.pendingCampaigns.update(campaign.localId!, { status: "synced", serverId });
        // Update dependent stations: replace campaignLocalKey with real campaignId
        await db.pendingStations
          .where("campaignLocalKey").equals(campaign.localKey)
          .modify((s: PendingStation) => { s.campaignId = serverId; delete s.campaignLocalKey; });
        synced++;
      }
    } catch (err) {
      await db.pendingCampaigns.update(campaign.localId!, {
        status: "error", errorMessage: err instanceof Error ? err.message : "Error desconocido",
      });
      failed++;
    }
  }

  // ── 2. Sync pending stations (only those with a resolved campaignId) ──
  const pendingStations = await db.pendingStations.where("status").equals("pending").toArray();
  for (const station of pendingStations) {
    if (!station.campaignId) continue; // campaign not synced yet
    try {
      const result = await createEstacionData({
        campaignId: station.campaignId,
        name: station.name,
        type: station.type,
        area: station.area,
        length: station.length,
        width: station.width,
        latitude: station.latitude ?? undefined,
        longitude: station.longitude ?? undefined,
        notes: station.notes,
      });

      if ("error" in result && result.error) {
        await db.pendingStations.update(station.localId!, {
          status: "error", errorMessage: String(result.error),
        });
        failed++;
      } else if ("success" in result && result.id) {
        const serverId = result.id;
        await db.pendingStations.update(station.localId!, { status: "synced", serverId });
        // Update dependent occurrences: replace stationLocalKey with real stationId
        await db.pendingOccurrences
          .where("stationLocalKey").equals(station.localKey)
          .modify((o: PendingOccurrence) => { o.stationId = serverId; delete o.stationLocalKey; });
        synced++;
      }
    } catch (err) {
      await db.pendingStations.update(station.localId!, {
        status: "error", errorMessage: err instanceof Error ? err.message : "Error desconocido",
      });
      failed++;
    }
  }

  // ── 3. Sync pending occurrences (only those with resolved IDs) ──
  const pending = await db.pendingOccurrences.where("status").equals("pending").toArray();
  for (const record of pending) {
    if (record.stationLocalKey) continue; // station not synced yet

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
          status: "error", errorMessage: String(result.error),
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
