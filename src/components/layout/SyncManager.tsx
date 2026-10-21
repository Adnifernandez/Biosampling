"use client";

import { useRobustSyncTriggers } from "@/hooks/useRobustSync";

// Mounts sync logic for the entire app session. Renders nothing visible.
export function SyncManager() {
  useRobustSyncTriggers();
  return null;
}
