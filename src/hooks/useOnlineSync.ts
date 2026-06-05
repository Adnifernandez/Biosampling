"use client";

import { useState, useEffect, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import { toast } from "sonner";

async function runSync() {
  const { syncPendingOccurrences } = await import("@/lib/sync");
  return syncPendingOccurrences();
}

async function runSeedCache() {
  const { seedLocalCache } = await import("@/lib/sync");
  return seedLocalCache();
}

export function useOnlineSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const pendingCount = useLiveQuery(
    () => getDb()?.pendingOccurrences.where("status").equals("pending").count() ?? Promise.resolve(0),
    [],
    0
  );

  const errorCount = useLiveQuery(
    () => getDb()?.pendingOccurrences.where("status").equals("error").count() ?? Promise.resolve(0),
    [],
    0
  );

  const sync = useCallback(async () => {
    const db = getDb();
    if (!db || isSyncing || !navigator.onLine) return;
    const count = await db.pendingOccurrences.where("status").equals("pending").count();
    if (count === 0) return;

    setIsSyncing(true);
    try {
      const { synced, failed } = await runSync();
      if (synced > 0) toast.success(`${synced} registro${synced > 1 ? "s" : ""} sincronizado${synced > 1 ? "s" : ""}`);
      if (failed > 0) toast.error(`${failed} no se pudo${failed > 1 ? "ieron" : ""} sincronizar`);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOnline(navigator.onLine);

    const handleOnline = () => { setIsOnline(true); sync(); runSeedCache(); };
    const handleOffline = () => setIsOnline(false);
    const handleVisibility = () => { if (document.visibilityState === "visible" && navigator.onLine) sync(); };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);
    if (navigator.onLine) {
      runSeedCache();
      // Pre-cache key pages in background so they work offline
      const KEY_PAGES = ["/proyectos", "/campanas", "/estaciones", "/ocurrencias"];
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        KEY_PAGES.forEach((url) => fetch(url, { credentials: "same-origin" }).catch(() => {}));
      }
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [sync]);

  return { isOnline, isSyncing, pendingCount: pendingCount ?? 0, errorCount: errorCount ?? 0, sync };
}
