"use client";

import { useState, useEffect, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { syncPendingOccurrences, seedLocalCache } from "@/lib/sync";
import { toast } from "sonner";

export function useOnlineSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const pendingCount = useLiveQuery(
    () => db ? db.pendingOccurrences.where("status").equals("pending").count() : Promise.resolve(0),
    [],
    0
  );

  const errorCount = useLiveQuery(
    () => db ? db.pendingOccurrences.where("status").equals("error").count() : Promise.resolve(0),
    [],
    0
  );

  const sync = useCallback(async () => {
    if (!db || isSyncing || !navigator.onLine) return;
    const count = await db.pendingOccurrences.where("status").equals("pending").count();
    if (count === 0) return;

    setIsSyncing(true);
    try {
      const { synced, failed } = await syncPendingOccurrences();
      if (synced > 0) toast.success(`${synced} registro${synced > 1 ? "s" : ""} sincronizado${synced > 1 ? "s" : ""}`);
      if (failed > 0) toast.error(`${failed} registro${failed > 1 ? "s" : ""} no se pudo${failed > 1 ? "ieron" : ""} sincronizar`);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  useEffect(() => {
    if (typeof window === "undefined" || !db) return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      sync();
      seedLocalCache();
    };
    const handleOffline = () => setIsOnline(false);
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && navigator.onLine) sync();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);

    if (navigator.onLine) seedLocalCache();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [sync]);

  return { isOnline, isSyncing, pendingCount: pendingCount ?? 0, errorCount: errorCount ?? 0, sync };
}
