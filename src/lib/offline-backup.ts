"use client";

import { toast } from "sonner";
import { getDb } from "@/lib/db";
import type {
  PendingOccurrence, PendingCampaign, PendingStation,
  CachedProject, CachedCampaign, CachedStation,
} from "@/lib/db";

export interface LocalData {
  occurrences: PendingOccurrence[];
  campaigns: PendingCampaign[];
  stations: PendingStation[];
  cachedProjects: CachedProject[];
  cachedCampaigns: CachedCampaign[];
  cachedStations: CachedStation[];
}

export async function loadLocalData(): Promise<LocalData | null> {
  const db = getDb();
  if (!db) return null;
  const [occurrences, campaigns, stations, cachedProjects, cachedCampaigns, cachedStations] = await Promise.all([
    db.pendingOccurrences.toArray(),
    db.pendingCampaigns.toArray(),
    db.pendingStations.toArray(),
    db.projects.toArray(),
    db.campaigns.toArray(),
    db.stations.toArray(),
  ]);
  return { occurrences, campaigns, stations, cachedProjects, cachedCampaigns, cachedStations };
}

function buildBackup(data: LocalData) {
  const projectIds  = new Set([...data.occurrences.map(o => o.projectId), ...data.campaigns.map(c => c.projectId)]);
  const campaignIds = new Set([...data.occurrences.map(o => o.campaignId), ...data.stations.map(s => s.campaignId)]);
  const stationIds  = new Set(data.occurrences.map(o => o.stationId));
  const stationRefs = data.cachedStations.filter(s => stationIds.has(s.id));
  // Include parent transects of grilla points so the backup is self-describing
  const parentIds = new Set(stationRefs.map(s => s.parentId).filter(Boolean));

  return {
    exportedAt: new Date().toISOString(),
    origin: window.location.origin,
    userAgent: navigator.userAgent,
    pendingOccurrences: data.occurrences,
    pendingCampaigns: data.campaigns,
    pendingStations: data.stations,
    reference: {
      projects: data.cachedProjects.filter(p => projectIds.has(p.id)),
      campaigns: data.cachedCampaigns.filter(c => campaignIds.has(c.id)),
      stations: data.cachedStations.filter(s => stationIds.has(s.id) || parentIds.has(s.id)),
    },
  };
}

function backupFileName() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `biosampling-respaldo-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
}

// Shares (phone) or downloads the backup file. Returns true once the file left the app.
export async function downloadBackup(): Promise<boolean> {
  const fresh = await loadLocalData();
  if (!fresh) { toast.error("No se pudo acceder al almacenamiento local"); return false; }
  const json = JSON.stringify(buildBackup(fresh), null, 2);
  const name = backupFileName();
  const file = new File([json], name, { type: "application/json" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Respaldo BioSampling" });
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return false;
      // fall through to download
    }
  }

  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  toast.success("Respaldo descargado");
  return true;
}
