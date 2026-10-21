"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useSyncOverview } from "@/hooks/useRobustSync";
import { CheckCircle2, Loader2, AlertCircle, CloudUpload, WifiOff } from "lucide-react";

// Always-visible sync status. Taps open /sincronizacion.
// Designed for the dark teal TopBar / Sidebar.
export function SyncStatusPill({ className }: { className?: string }) {
  const { pending, rejected, engine, isOnline } = useSyncOverview();

  let tone: "ok" | "busy" | "warn" | "bad";
  let Icon = CheckCircle2;
  let label: string;

  if (engine.running) {
    tone = "busy"; Icon = Loader2;
    label = `Subiendo ${Math.min(engine.done, engine.total)}/${engine.total}`;
  } else if (engine.problem === "auth" && pending > 0) {
    tone = "bad"; Icon = AlertCircle; label = "Inicia sesión para subir";
  } else if (rejected > 0) {
    tone = "bad"; Icon = AlertCircle; label = `${rejected} por revisar`;
  } else if (pending > 0) {
    tone = "warn"; Icon = isOnline ? CloudUpload : WifiOff;
    label = isOnline ? `${pending} por subir` : `${pending} en el teléfono`;
  } else if (!isOnline) {
    tone = "warn"; Icon = WifiOff; label = "Sin conexión";
  } else {
    tone = "ok"; label = "Todo subido";
  }

  return (
    <Link
      href="/sincronizacion"
      className={cn(
        "flex items-center gap-1 rounded-full px-2 py-0.5 border text-xs whitespace-nowrap",
        tone === "ok"   && "bg-green-500/20 border-green-400/40 text-green-100",
        tone === "busy" && "bg-sky-500/20 border-sky-400/40 text-sky-100",
        tone === "warn" && "bg-yellow-500/20 border-yellow-400/40 text-yellow-200",
        tone === "bad"  && "bg-red-500/30 border-red-400/50 text-red-100",
        className,
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", engine.running && "animate-spin")} />
      {label}
    </Link>
  );
}
