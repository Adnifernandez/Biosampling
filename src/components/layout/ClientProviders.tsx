"use client";

import { SessionProvider } from "next-auth/react";
import dynamic from "next/dynamic";
import type { Session } from "next-auth";

const SyncManager = dynamic(
  () => import("@/components/layout/SyncManager").then((m) => m.SyncManager),
  { ssr: false }
);

const OfflineNavFix = dynamic(
  () => import("@/components/layout/OfflineNavFix").then((m) => m.OfflineNavFix),
  { ssr: false }
);

export function ClientProviders({
  session,
  children,
}: {
  session: Session | null;
  children: React.ReactNode;
}) {
  return (
    <SessionProvider session={session}>
      <SyncManager />
      <OfflineNavFix />
      {children}
    </SessionProvider>
  );
}
