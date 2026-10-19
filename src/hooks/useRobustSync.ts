"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import {
  runRobustSync, syncNow, subscribeSync, getSyncState, getServerSyncState,
} from "@/lib/sync-robust";
import { precachePages, runSeedCache } from "@/hooks/useOnlineSync";

const PERIODIC_MS = 60_000;

// Mounted once per session (admins). Same caching duties as useOnlineSync,
// plus the robust sync triggers.
export function useRobustSyncTriggers() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    // Ask the browser not to evict local data when the phone is low on space
    navigator.storage?.persist?.().catch(() => {});

    const onOnline = () => { syncNow(); runSeedCache(); };
    const onVisible = () => { if (document.visibilityState === "visible" && navigator.onLine) void runRobustSync(); };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    const interval = setInterval(async () => {
      const db = getDb();
      if (!db || !navigator.onLine) return;
      if (await db.pendingOccurrences.where("status").equals("pending").count() > 0
        || await db.pendingStations.where("status").equals("pending").count() > 0
        || await db.pendingCampaigns.where("status").equals("pending").count() > 0) {
        void runRobustSync();
      }
    }, PERIODIC_MS);

    if (navigator.onLine) {
      runSeedCache();
      precachePages();
      void runRobustSync();
    }

    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, []);
}

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
}

export interface SyncOverview {
  pending: number;    // waiting to be uploaded (includes those waiting for their réplica)
  rejected: number;   // the server rejected them; need review
  synced: number;     // confirmed by the server (kept 30 days)
}

const EMPTY: SyncOverview = { pending: 0, rejected: 0, synced: 0 };

// Live view of the local queue + engine state, for the status pill, Terreno and /sincronizacion.
export function useSyncOverview() {
  const engine = useSyncExternalStore(subscribeSync, getSyncState, getServerSyncState);
  const isOnline = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const counts = useLiveQuery(async (): Promise<SyncOverview> => {
    const db = getDb();
    if (!db) return EMPTY;
    const [po, eo, so, pc, ec, ps, es] = await Promise.all([
      db.pendingOccurrences.where("status").equals("pending").count(),
      db.pendingOccurrences.where("status").equals("error").count(),
      db.pendingOccurrences.where("status").equals("synced").count(),
      db.pendingCampaigns.where("status").equals("pending").count(),
      db.pendingCampaigns.where("status").equals("error").count(),
      db.pendingStations.where("status").equals("pending").count(),
      db.pendingStations.where("status").equals("error").count(),
    ]);
    return { pending: po + pc + ps, rejected: eo + ec + es, synced: so };
  }, [], EMPTY) ?? EMPTY;
  return { ...counts, engine, isOnline };
}
