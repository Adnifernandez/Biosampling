"use client";

import { useOnlineSync } from "@/hooks/useOnlineSync";

// Mounts sync logic for the entire app session. Renders nothing visible.
export function SyncManager() {
  useOnlineSync();
  return null;
}
