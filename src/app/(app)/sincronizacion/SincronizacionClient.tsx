"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { getDb } from "@/lib/db";
import type { PendingOccurrence, PendingStation, PendingCampaign } from "@/lib/db";
import { useSyncOverview } from "@/hooks/useRobustSync";
import { syncNow, retryRejected } from "@/lib/sync-robust";
import { downloadBackup } from "@/lib/offline-backup";
import { cn } from "@/lib/utils";
import {
  Trash2, CloudUpload, CheckCircle2, AlertCircle, WifiOff, Loader2, RefreshCw, Download, ShieldCheck, Clock, LogIn,
} from "lucide-react";

interface Lists {
  rejectedOcc: PendingOccurrence[];
  rejectedSta: PendingStation[];
  rejectedCamp: PendingCampaign[];
  pendingSta: PendingStation[];
  pendingCamp: PendingCampaign[];
  recent: PendingOccurrence[];
  projectNames: Map<string, string>;
  campaignNames: Map<string, string>;
  stationNames: Map<string, string>;
}

async function loadLists(): Promise<Lists | null> {
  const db = getDb();
  if (!db) return null;
  const [rejectedOcc, rejectedSta, rejectedCamp, pendingSta, pendingCamp, recent, projects, campaigns, stations] = await Promise.all([
    db.pendingOccurrences.where("status").equals("error").toArray(),
    db.pendingStations.where("status").equals("error").toArray(),
    db.pendingCampaigns.where("status").equals("error").toArray(),
    db.pendingStations.where("status").equals("pending").toArray(),
    db.pendingCampaigns.where("status").equals("pending").toArray(),
    db.pendingOccurrences.where("status").equals("synced").reverse().limit(20).toArray(),
    db.projects.toArray(),
    db.campaigns.toArray(),
    db.stations.toArray(),
  ]);

  const stationNames = new Map<string, string>();
  const byId = new Map(stations.map(s => [s.id, s]));
  for (const s of stations) {
    const parent = s.parentId ? byId.get(s.parentId) : null;
    stationNames.set(s.id, parent ? `${parent.name} › ${s.name}` : s.name);
  }
  const localStations = await db.pendingStations.toArray();
  for (const s of localStations) {
    stationNames.set(s.localKey, s.name);
    if (s.serverId) stationNames.set(s.serverId, s.name);
  }

  return {
    rejectedOcc, rejectedSta, rejectedCamp, pendingSta, pendingCamp, recent,
    projectNames: new Map(projects.map(p => [p.id, p.name])),
    campaignNames: new Map(campaigns.map(c => [c.id, c.name])),
    stationNames,
  };
}

interface PendingGroup { key: string; projectId: string; campaignId: string; count: number; waiting: number }

// Reads every pending record (photos included), so it's skipped while a sync
// is running — that's when records change the most.
async function loadPendingGroups(): Promise<PendingGroup[]> {
  const db = getDb();
  if (!db) return [];
  const groups = new Map<string, PendingGroup>();
  await db.pendingOccurrences.where("status").equals("pending").each(o => {
    const key = `${o.projectId}|${o.campaignId}`;
    const g = groups.get(key) ?? { key, projectId: o.projectId, campaignId: o.campaignId, count: 0, waiting: 0 };
    g.count++;
    if (o.stationLocalKey) g.waiting++;
    groups.set(key, g);
  });
  return [...groups.values()];
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function SincronizacionClient() {
  const { pending, rejected, synced, engine, isOnline } = useSyncOverview();
  const lists = useLiveQuery(loadLists, [], undefined);
  const pendingGroups = useLiveQuery(
    async () => (engine.running ? null : loadPendingGroups()),
    [engine.running],
    null,
  );
  const now = useNow(5_000);
  // Only admins may throw away records that can never be uploaded (e.g. their campaign
  // no longer exists on the server). Deleting never touches the server.
  const isAdmin = useSession().data?.user?.role === "ADMIN";

  async function deleteOccurrence(o: PendingOccurrence) {
    if (!window.confirm(`¿Eliminar «${o.speciesLabel}» de este teléfono?\n\nNo se subirá y no se podrá recuperar.`)) return;
    await getDb()?.pendingOccurrences.delete(o.localId!);
    toast.success("Registro eliminado del teléfono");
  }

  async function deleteStation(st: PendingStation) {
    const db = getDb();
    if (!db) return;
    const n = await db.pendingOccurrences.where("stationLocalKey").equals(st.localKey).count();
    const extra = n > 0 ? ` y sus ${n} registro${n > 1 ? "s" : ""}` : "";
    if (!window.confirm(`¿Eliminar la réplica «${st.name}»${extra} de este teléfono?\n\nNo se subirá y no se podrá recuperar.`)) return;
    await db.transaction("rw", db.pendingStations, db.pendingOccurrences, async () => {
      await db.pendingOccurrences.where("stationLocalKey").equals(st.localKey).delete();
      await db.pendingStations.delete(st.localId!);
    });
    toast.success("Réplica eliminada del teléfono");
  }

  async function deleteCampaign(c: PendingCampaign) {
    const db = getDb();
    if (!db) return;
    const stations = await db.pendingStations.where("campaignLocalKey").equals(c.localKey).toArray();
    let n = 0;
    for (const st of stations) n += await db.pendingOccurrences.where("stationLocalKey").equals(st.localKey).count();
    const parts = [
      stations.length > 0 ? `${stations.length} réplica${stations.length > 1 ? "s" : ""}` : "",
      n > 0 ? `${n} registro${n > 1 ? "s" : ""}` : "",
    ].filter(Boolean).join(" y ");
    if (!window.confirm(`¿Eliminar la campaña «${c.name}»${parts ? ` con sus ${parts}` : ""} de este teléfono?\n\nNo se subirá y no se podrá recuperar.`)) return;
    await db.transaction("rw", db.pendingCampaigns, db.pendingStations, db.pendingOccurrences, async () => {
      for (const st of stations) await db.pendingOccurrences.where("stationLocalKey").equals(st.localKey).delete();
      await db.pendingStations.bulkDelete(stations.map(st => st.localId!));
      await db.pendingCampaigns.delete(c.localId!);
    });
    toast.success("Campaña eliminada del teléfono");
  }

  const projectName  = (id?: string) => (id && lists?.projectNames.get(id)) || "Proyecto";
  const campaignName = (id?: string) => (id && lists?.campaignNames.get(id)) || "Campaña creada en terreno";
  const stationName  = (o: PendingOccurrence) =>
    lists?.stationNames.get(o.stationLocalKey ?? o.stationId) ?? "Réplica";

  // ── Headline ──
  let tone: "ok" | "busy" | "warn" | "bad";
  let title: string;
  let detail: string;
  if (engine.running) {
    tone = "busy";
    title = `Subiendo datos… ${Math.min(engine.done, engine.total)} de ${engine.total}`;
    detail = "Puedes seguir usando la app. Si se corta la señal, se retoma solo.";
  } else if (engine.problem === "auth" && pending > 0) {
    tone = "bad";
    title = "Tu sesión expiró";
    detail = `${pending} registro${pending > 1 ? "s" : ""} siguen guardados en el teléfono. Inicia sesión para subirlos.`;
  } else if (rejected > 0) {
    tone = "bad";
    title = `${rejected} registro${rejected > 1 ? "s" : ""} necesita${rejected > 1 ? "n" : ""} revisión`;
    detail = "El servidor no los aceptó. Siguen guardados en el teléfono; revisa el motivo abajo.";
  } else if (pending > 0 && !isOnline) {
    tone = "warn";
    title = `${pending} registro${pending > 1 ? "s" : ""} guardado${pending > 1 ? "s" : ""} en el teléfono`;
    detail = "Sin señal. Se subirán solos apenas vuelva la conexión.";
  } else if (pending > 0) {
    tone = "warn";
    title = `${pending} registro${pending > 1 ? "s" : ""} por subir`;
    detail = engine.nextRetryAt
      ? `La conexión está inestable. Próximo intento automático en ${Math.max(0, Math.ceil((engine.nextRetryAt - now) / 1000))} s.`
      : "Se subirán automáticamente en unos segundos.";
  } else {
    tone = "ok";
    title = "Todo está subido";
    detail = "El servidor confirmó todos los registros de este teléfono.";
  }

  const HeadIcon = { ok: CheckCircle2, busy: Loader2, warn: isOnline ? Clock : WifiOff, bad: AlertCircle }[tone];
  const progress = engine.total > 0 ? Math.round((Math.min(engine.done, engine.total) / engine.total) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <CloudUpload className="h-5 w-5 text-teal-700" />
        <h1 className="text-xl font-bold text-gray-900">Sincronización</h1>
      </div>

      {/* Estado */}
      <div className={cn(
        "rounded-xl border p-4",
        tone === "ok"   && "bg-green-50 border-green-200",
        tone === "busy" && "bg-sky-50 border-sky-200",
        tone === "warn" && "bg-yellow-50 border-yellow-200",
        tone === "bad"  && "bg-red-50 border-red-200",
      )}>
        <div className="flex items-start gap-3">
          <HeadIcon className={cn(
            "h-8 w-8 shrink-0",
            tone === "ok" && "text-green-600", tone === "busy" && "text-sky-600 animate-spin",
            tone === "warn" && "text-yellow-600", tone === "bad" && "text-red-600",
          )} />
          <div className="min-w-0">
            <p className="text-base font-semibold text-gray-900">{title}</p>
            <p className="text-sm text-gray-600 mt-0.5">{detail}</p>
          </div>
        </div>
        {engine.running && (
          <div className="mt-3 h-2 rounded-full bg-sky-100 overflow-hidden">
            <div className="h-full bg-sky-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        {engine.lastSuccessAt && (
          <p className="text-xs text-gray-500 mt-3">
            Última sincronización completa: {formatDistanceToNow(engine.lastSuccessAt, { addSuffix: true, locale: es })}
          </p>
        )}
      </div>

      {/* Acciones */}
      <div className="grid grid-cols-2 gap-2">
        {engine.problem === "auth" && pending > 0 ? (
          <a href="/login" className="flex items-center justify-center gap-2 rounded-lg bg-teal-700 text-white text-sm font-medium py-2.5 hover:bg-teal-800">
            <LogIn className="h-4 w-4" /> Iniciar sesión
          </a>
        ) : (
          <button
            onClick={() => syncNow()}
            disabled={!isOnline || engine.running}
            className="flex items-center justify-center gap-2 rounded-lg bg-teal-700 text-white text-sm font-medium py-2.5 hover:bg-teal-800 disabled:opacity-40 disabled:pointer-events-none"
          >
            <RefreshCw className={cn("h-4 w-4", engine.running && "animate-spin")} />
            Sincronizar ahora
          </button>
        )}
        <button
          onClick={() => void downloadBackup()}
          className="flex items-center justify-center gap-2 rounded-lg border border-teal-700 text-teal-700 text-sm font-medium py-2.5 hover:bg-teal-50"
        >
          <Download className="h-4 w-4" /> Descargar respaldo
        </button>
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Por subir", value: pending, cls: "text-yellow-700" },
          { label: "Por revisar", value: rejected, cls: rejected > 0 ? "text-red-600" : "text-gray-900" },
          { label: "Subidos (30 días)", value: synced, cls: "text-green-700" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-center">
            <p className={cn("text-2xl font-bold", s.cls)}>{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 rounded-xl bg-white border border-gray-200 p-3 text-xs text-gray-600">
        <ShieldCheck className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
        <p>
          Cada registro queda guardado en este teléfono hasta que el servidor confirma que lo recibió.
          Si se corta la señal se reintenta solo, y un registro nunca se sube dos veces.
        </p>
      </div>

      {/* Por revisar */}
      {lists && (lists.rejectedOcc.length + lists.rejectedSta.length + lists.rejectedCamp.length) > 0 && (
        <div className="bg-white border border-red-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900">Necesitan revisión</p>
            <button
              onClick={() => void retryRejected()}
              disabled={!isOnline || engine.running}
              className="text-xs font-medium text-teal-700 hover:underline disabled:opacity-40"
            >
              Reintentar todos
            </button>
          </div>
          {lists.rejectedCamp.map(c => (
            <ProblemRow key={`c${c.localId}`} title={`Campaña: ${c.name}`} place={projectName(c.projectId)}
              message={c.errorMessage} disabled={!isOnline || engine.running}
              onRetry={() => retryRejected({ campaigns: [c.localId!] })}
              onDelete={isAdmin ? () => deleteCampaign(c) : undefined} />
          ))}
          {lists.rejectedSta.map(s => (
            <ProblemRow key={`s${s.localId}`} title={`Réplica: ${s.name}`} place={campaignName(s.campaignId)}
              message={s.errorMessage} disabled={!isOnline || engine.running}
              onRetry={() => retryRejected({ stations: [s.localId!] })}
              onDelete={isAdmin ? () => deleteStation(s) : undefined} />
          ))}
          {lists.rejectedOcc.map(o => (
            <ProblemRow key={`o${o.localId}`} title={o.speciesLabel}
              place={`${projectName(o.projectId)} · ${stationName(o)} · ${format(o.createdAt, "dd-MM-yyyy HH:mm")}`}
              message={o.errorMessage} disabled={!isOnline || engine.running}
              onRetry={() => retryRejected({ occurrences: [o.localId!] })}
              onDelete={isAdmin ? () => deleteOccurrence(o) : undefined} />
          ))}
        </div>
      )}

      {/* Por subir */}
      {lists && !engine.running && ((pendingGroups?.length ?? 0) + lists.pendingSta.length + lists.pendingCamp.length) > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-gray-900">Esperando para subir</p>
          {lists.pendingCamp.length > 0 && (
            <p className="text-xs text-gray-600 border-t pt-2">{lists.pendingCamp.length} campaña{lists.pendingCamp.length > 1 ? "s" : ""} creada{lists.pendingCamp.length > 1 ? "s" : ""} en terreno</p>
          )}
          {lists.pendingSta.length > 0 && (
            <p className="text-xs text-gray-600 border-t pt-2">{lists.pendingSta.length} réplica{lists.pendingSta.length > 1 ? "s" : ""} creada{lists.pendingSta.length > 1 ? "s" : ""} en terreno</p>
          )}
          {(pendingGroups ?? []).map(g => (
            <div key={g.key} className="text-xs border-t pt-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-gray-800">{projectName(g.projectId)}</span>
                <span className="text-yellow-700 font-medium">{g.count} registro{g.count > 1 ? "s" : ""}</span>
              </div>
              <p className="text-gray-400">
                {campaignName(g.campaignId)}
                {g.waiting > 0 && ` · ${g.waiting} esperan que suba su réplica`}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Subidos */}
      {lists && lists.recent.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-gray-900">Subidos recientemente</p>
          {lists.recent.map(o => (
            <div key={o.localId} className="flex items-center gap-2 text-xs border-t pt-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
              <span className="font-medium text-gray-800 truncate">{o.speciesLabel}</span>
              <span className="text-gray-400 truncate">· {stationName(o)}</span>
              {o.syncedAt && <span className="ml-auto text-gray-400 shrink-0">{format(o.syncedAt, "dd-MM HH:mm")}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProblemRow({ title, place, message, onRetry, onDelete, disabled }: {
  title: string; place: string; message?: string; onRetry: () => void; onDelete?: () => void; disabled: boolean;
}) {
  return (
    <div className="text-xs border-t pt-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-gray-800">{title}</span>
        <button onClick={onRetry} disabled={disabled}
          className="shrink-0 text-teal-700 font-medium hover:underline disabled:opacity-40">
          Reintentar
        </button>
      </div>
      <p className="text-gray-400">{place}</p>
      {message && <p className="text-red-600 mt-0.5">{message}</p>}
      {onDelete && (
        <button onClick={onDelete} disabled={disabled}
          className="mt-1 inline-flex items-center gap-1 text-red-600 font-medium hover:underline disabled:opacity-40">
          <Trash2 className="h-3.5 w-3.5" /> Eliminar del teléfono
        </button>
      )}
    </div>
  );
}
