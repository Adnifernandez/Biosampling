"use client";

import { useOnlineSync } from "@/hooks/useOnlineSync";
import { useRobustSyncTriggers } from "@/hooks/useRobustSync";

function LegacySync() {
  useOnlineSync();
  return null;
}

function RobustSync() {
  useRobustSyncTriggers();
  return null;
}

// Mounts sync logic for the entire app session. Renders nothing visible.
// Admins get the robust sync while it's being tested.
export function SyncManager({ robust }: { robust: boolean }) {
  return robust ? <RobustSync /> : <LegacySync />;
}
