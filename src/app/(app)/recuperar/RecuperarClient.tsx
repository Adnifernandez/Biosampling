"use client";

import { useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import type {
  PendingOccurrence, PendingCampaign, PendingStation,
  CachedProject, CachedCampaign, CachedStation,
} from "@/lib/db";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  LifeBuoy, Download, RefreshCw, AlertCircle, Clock, CheckCircle2, Wifi, WifiOff,
} from "lucide-react";

interface LocalData {
  occurrences: PendingOccurrence[];
  campaigns: PendingCampaign[];
  stations: PendingStation[];
  cachedProjects: CachedProject[];
  cachedCampaigns: CachedCampaign[];
  cachedStations: CachedStation[];
}

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
}

async function loadLocalData(): Promise<LocalData | null> {
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

function StatusBadge({ status }: { status: "pending" | "synced" | "error" }) {
  if (status === "pending") return (
    <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 rounded px-1.5 py-0.5">
      <Clock className="h-3 w-3" /> Pendiente
    </span>
  );
  if (status === "synced") return (
    <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 rounded px-1.5 py-0.5">
      <CheckCircle2 className="h-3 w-3" /> Subido
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 rounded px-1.5 py-0.5">
      <AlertCircle className="h-3 w-3" /> Error
    </span>
  );
}

export function RecuperarClient() {
  const isOnline = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [backupDone, setBackupDone] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const data = useLiveQuery(loadLocalData, [], undefined);

  if (data === undefined) {
    return <p className="text-sm text-gray-400 text-center py-16">Leyendo datos del dispositivo…</p>;
  }
  if (data === null) {
    return <p className="text-sm text-red-600 text-center py-16">No se pudo acceder al almacenamiento local</p>;
  }

  const projectName  = (id: string) => data.cachedProjects.find(p => p.id === id)?.name ?? `Proyecto ${id}`;
  const campaignName = (id?: string) => (id && data.cachedCampaigns.find(c => c.id === id)?.name) || "Campaña sin nombre en caché";
  function stationName(o: PendingOccurrence) {
    if (o.stationLocalKey) {
      return data!.stations.find(s => s.localKey === o.stationLocalKey)?.name ?? "Réplica creada en terreno";
    }
    const s = data!.cachedStations.find(st => st.id === o.stationId);
    if (!s) return `Estación ${o.stationId}`;
    const parent = s.parentId ? data!.cachedStations.find(st => st.id === s.parentId) : null;
    return parent ? `${parent.name} › ${s.name}` : s.name;
  }

  const notSynced = {
    occurrences: data.occurrences.length,
    campaigns: data.campaigns.filter(c => c.status !== "synced").length,
    stations: data.stations.filter(s => s.status !== "synced").length,
  };
  const errorCount =
    data.occurrences.filter(o => o.status === "error").length +
    data.campaigns.filter(c => c.status === "error").length +
    data.stations.filter(s => s.status === "error").length;
  const totalNotSynced = notSynced.occurrences + notSynced.campaigns + notSynced.stations;

  // Group occurrences by project › campaign for display
  const groups = new Map<string, { title: string; subtitle: string; items: PendingOccurrence[] }>();
  for (const o of [...data.occurrences].sort((a, b) => a.createdAt - b.createdAt)) {
    const key = `${o.projectId}|${o.campaignId}`;
    if (!groups.has(key)) groups.set(key, { title: projectName(o.projectId), subtitle: campaignName(o.campaignId), items: [] });
    groups.get(key)!.items.push(o);
  }

  async function handleBackup() {
    const fresh = await loadLocalData();
    if (!fresh) { toast.error("No se pudo acceder al almacenamiento local"); return; }
    const json = JSON.stringify(buildBackup(fresh), null, 2);
    const name = backupFileName();
    const file = new File([json], name, { type: "application/json" });

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Respaldo BioSampling" });
        setBackupDone(true);
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
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
    setBackupDone(true);
    toast.success("Respaldo descargado");
  }

  async function handleRetry() {
    const db = getDb();
    if (!db || retrying || !navigator.onLine) return;
    if (!window.confirm(
      "Se volverán a enviar al servidor todos los registros pendientes y con error.\n\n" +
      "Si alguno alcanzó a subir parcialmente antes de fallar, podría quedar duplicado. ¿Continuar?"
    )) return;

    setRetrying(true);
    try {
      await db.transaction("rw", db.pendingCampaigns, db.pendingStations, db.pendingOccurrences, async () => {
        await db.pendingCampaigns.where("status").equals("error").modify({ status: "pending", errorMessage: undefined });
        await db.pendingStations.where("status").equals("error").modify({ status: "pending", errorMessage: undefined });
        await db.pendingOccurrences.where("status").equals("error").modify({ status: "pending", errorMessage: undefined });
      });
      const { syncPendingOccurrences } = await import("@/lib/sync");
      const { synced, failed } = await syncPendingOccurrences();
      if (synced > 0) toast.success(`${synced} registro${synced > 1 ? "s" : ""} sincronizado${synced > 1 ? "s" : ""}`);
      if (failed > 0) toast.error(`${failed} no se pudo${failed > 1 ? "ieron" : ""} sincronizar — revisa el detalle`);
      if (synced === 0 && failed === 0) toast.info("No había registros listos para enviar");
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <LifeBuoy className="h-5 w-5 text-teal-700" />
          <h1 className="text-xl font-bold text-gray-900">Recuperar datos de terreno</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Registros guardados en este dispositivo que aún no están en el servidor.
        </p>
      </div>

      <div className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm border",
        isOnline ? "bg-green-50 border-green-200 text-green-700" : "bg-yellow-50 border-yellow-200 text-yellow-700"
      )}>
        {isOnline ? <Wifi className="h-4 w-4 shrink-0" /> : <WifiOff className="h-4 w-4 shrink-0" />}
        {isOnline ? "Con internet" : "Sin conexión — puedes descargar el respaldo, pero no reintentar el envío"}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Ocurrencias", value: notSynced.occurrences },
          { label: "Réplicas",    value: notSynced.stations },
          { label: "Campañas",    value: notSynced.campaigns },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500">{s.label} sin subir</p>
          </div>
        ))}
      </div>

      {totalNotSynced === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
          <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">No hay registros pendientes en este dispositivo</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">1. Descarga un respaldo</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Guarda o envía el archivo (WhatsApp, correo) antes de reintentar. No borres los datos del navegador.
            </p>
            <button
              onClick={handleBackup}
              className="mt-2 w-full flex items-center justify-center gap-2 rounded-lg bg-teal-700 text-white text-sm font-medium py-2.5 hover:bg-teal-800"
            >
              <Download className="h-4 w-4" />
              Descargar respaldo
            </button>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">2. Reintenta el envío</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {errorCount > 0
                ? `${errorCount} registro${errorCount > 1 ? "s" : ""} con error se volverán a enviar.`
                : "Se enviarán los registros pendientes."}
            </p>
            <button
              onClick={handleRetry}
              disabled={!backupDone || !isOnline || retrying}
              className="mt-2 w-full flex items-center justify-center gap-2 rounded-lg border border-teal-700 text-teal-700 text-sm font-medium py-2.5 hover:bg-teal-50 disabled:opacity-40 disabled:pointer-events-none"
            >
              <RefreshCw className={cn("h-4 w-4", retrying && "animate-spin")} />
              {retrying ? "Enviando…" : "Reintentar envío"}
            </button>
            {!backupDone && <p className="text-xs text-gray-400 mt-1">Disponible después de descargar el respaldo</p>}
          </div>
        </div>
      )}

      {(data.campaigns.length > 0 || data.stations.length > 0) && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-gray-900">Campañas y réplicas creadas en terreno</p>
          {data.campaigns.map(c => (
            <div key={`c${c.localId}`} className="text-xs border-t pt-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-gray-800">Campaña: {c.name}</span>
                <StatusBadge status={c.status} />
              </div>
              <p className="text-gray-400">{projectName(c.projectId)}</p>
              {c.errorMessage && <p className="text-red-600 mt-0.5">{c.errorMessage}</p>}
            </div>
          ))}
          {data.stations.map(s => (
            <div key={`s${s.localId}`} className="text-xs border-t pt-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-gray-800">Réplica: {s.name}</span>
                <StatusBadge status={s.status} />
              </div>
              <p className="text-gray-400">{campaignName(s.campaignId)}</p>
              {s.errorMessage && <p className="text-red-600 mt-0.5">{s.errorMessage}</p>}
            </div>
          ))}
        </div>
      )}

      {[...groups.values()].map(g => (
        <div key={g.title + g.subtitle} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
          <div>
            <p className="text-sm font-semibold text-gray-900">{g.title}</p>
            <p className="text-xs text-gray-500">{g.subtitle} · {g.items.length} registro{g.items.length > 1 ? "s" : ""}</p>
          </div>
          {g.items.map(o => (
            <div key={o.localId} className="text-xs border-t pt-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-gray-800">{o.speciesLabel}</span>
                <StatusBadge status={o.status} />
              </div>
              <p className="text-gray-400">
                {stationName(o)} · {new Date(o.createdAt).toLocaleString("es-CL")}
                {o.payload.kind === "sherman" && ` · ${o.payload.data.captures.length} captura${o.payload.data.captures.length > 1 ? "s" : ""}`}
                {o.stationLocalKey && " · espera que suba su réplica"}
              </p>
              {o.errorMessage && <p className="text-red-600 mt-0.5">{o.errorMessage}</p>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
