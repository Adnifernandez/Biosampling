"use client";

import { getDb } from "@/lib/db";

// Downloads projects, campaigns, réplicas and species so Modo Terreno works offline.
// Uploading records lives in sync-robust.ts.
export async function seedLocalCache(): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    const res = await fetch("/api/seed-cache");
    if (!res.ok) return;
    const { projects, campaigns, stations, species } = await res.json();

    const serverProjectIds  = new Set<string>(projects.map((p: { id: string }) => p.id));
    const serverCampaignIds = new Set<string>(campaigns.map((c: { id: string }) => c.id));
    const serverStationIds  = new Set<string>(stations.map((s: { id: string }) => s.id));
    const serverSpeciesIds  = new Set<string>(species.map((sp: { id: string }) => sp.id));

    const [cachedProjectIds, cachedCampaignIds, cachedStationIds, cachedSpeciesIds] = await Promise.all([
      db.projects.toCollection().primaryKeys(),
      db.campaigns.toCollection().primaryKeys(),
      db.stations.toCollection().primaryKeys(),
      db.species.toCollection().primaryKeys(),
    ]);

    await Promise.all([
      db.projects.bulkDelete(cachedProjectIds.filter(id => !serverProjectIds.has(id as string))),
      db.campaigns.bulkDelete(cachedCampaignIds.filter(id => !serverCampaignIds.has(id as string))),
      db.stations.bulkDelete(cachedStationIds.filter(id => !serverStationIds.has(id as string))),
      db.species.bulkDelete(cachedSpeciesIds.filter(id => !serverSpeciesIds.has(id as string))),
    ]);

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
