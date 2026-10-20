"use client";

import { useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { getDb } from "@/lib/db";
import type { PendingOccurrence, PendingStation, PendingCampaign } from "@/lib/db";
import { canDeleteLocal } from "@/lib/recovery-access";
import { loadLocalData, downloadBackup, type LocalData } from "@/lib/offline-backup";
import { retryRejected, subscribeSync, getSyncState, getServerSyncState } from "@/lib/sync-robust";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Clock, CloudUpload, Loader2, ShieldCheck, LogIn, Trash2 } from "lucide-react";

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
}

// Server/old-sync messages → what the person should do
function friendly(msg?: string): string {
  if (!msg) return "";
  if (/fetch|network|load failed|conexi/i.test(msg)) return "Falló la conexión. Toca «Subir ahora» para reintentar.";
  if (/autorizado|sesi[oó]n/i.test(msg)) return "La sesión había expirado. Toca «Subir ahora».";
  if (/cerrado/i.test(msg)) return "El proyecto está cerrado. Pide que lo reabran y vuelve a tocar «Subir ahora».";
  if (/ya no existe/i.test(msg)) return `${msg}. Avísale al administrador.`;
  if (/temporal/i.test(msg)) return "El servidor tuvo un problema momentáneo. Toca «Subir ahora» en un rato.";
  return msg;
}

type Tone = "ok" | "wait" | "bad";
interface Outcome { tone: Tone; text: string; hint?: string }

function describe(o: PendingOccurrence, data: LocalData): Outcome {
  if (o.status === "synced") {
    return o.alreadyOnServer
      ? { tone: "ok", text: "Ya estaba en el servidor — no se duplicó" }
      : { tone: "ok", text: "Subido" };
  }
  if (o.status === "error") return { tone: "bad", text: "No se pudo subir", hint: friendly(o.errorMessage) };

  if (o.stationLocalKey) {
    const st = data.stations.find(s => s.localKey === o.stationLocalKey);
    if (!st) return { tone: "bad", text: "Su réplica no está en este teléfono", hint: "Avísale al administrador." };
    if (st.status === "error") return { tone: "bad", text: `Su réplica «${st.name}» no se pudo subir`, hint: friendly(st.errorMessage) };
    const camp = st.campaignLocalKey ? data.campaigns.find(c => c.localKey === st.campaignLocalKey) : null;
    if (!st.campaignId && !camp) return { tone: "bad", text: `Su réplica «${st.name}» no tiene campaña asignada`, hint: "Avísale al administrador." };
    if (camp?.status === "error") return { tone: "bad", text: `Su campaña «${camp.name}» no se pudo subir`, hint: friendly(camp.errorMessage) };
    return { tone: "wait", text: `Espera que suba su réplica «${st.name}»` };
  }
  if (!o.stationId || o.stationId === "pending") {
    return { tone: "bad", text: "No tiene réplica asignada", hint: "Avísale al administrador." };
  }
  return { tone: "wait", text: "Pendiente", hint: o.errorMessage ? friendly(o.errorMessage) : undefined };
}

export function RecuperarClient() {
  const isOnline = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const engine = useSyncExternalStore(subscribeSync, getSyncState, getServerSyncState);
  const data = useLiveQuery(loadLocalData, [], undefined);
  // Records shown when "Subir ahora" was pressed, so their result stays visible afterwards
  const [ranIds, setRanIds] = useState<Set<number> | null>(null);
  // Only some accounts may throw away records that can never be uploaded
  const canDelete = canDeleteLocal(useSession().data?.user?.email);

  if (data === undefined) {
    return <p className="text-sm text-gray-400 text-center py-16">Leyendo datos del teléfono…</p>;
  }
  if (data === null) {
    return <p className="text-sm text-red-600 text-center py-16">No se pudo acceder a los datos del teléfono</p>;
  }

  const unsynced = data.occurrences.filter(o => o.status !== "synced");
  const otherUnsynced = data.campaigns.filter(c => c.status !== "synced").length
    + data.stations.filter(s => s.status !== "synced").length;
  const total = unsynced.length + otherUnsynced;
  const shown = data.occurrences
    .filter(o => o.status !== "synced" || ranIds?.has(o.localId!))
    .sort((a, b) => a.createdAt - b.createdAt);

  const projectName = (id: string) => data.cachedProjects.find(p => p.id === id)?.name ?? "Proyecto";
  function stationName(o: PendingOccurrence) {
    if (o.stationLocalKey) return data!.stations.find(s => s.localKey === o.stationLocalKey)?.name ?? "Réplica";
    const s = data!.cachedStations.find(st => st.id === o.stationId);
    if (!s) return data!.stations.find(st => st.serverId === o.stationId)?.name ?? "Réplica";
    const parent = s.parentId ? data!.cachedStations.find(st => st.id === s.parentId) : null;
    return parent ? `${parent.name} › ${s.name}` : s.name;
  }

  // ── Delete from this phone (records that can't be uploaded, e.g. their campaign
  // no longer exists). Never touches the server. ──
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

  const pendingCampaigns = data.campaigns.filter(c => c.status !== "synced");
  const pendingStations = data.stations.filter(st => st.status !== "synced");

  async function handleUpload() {
    setRanIds(new Set(data!.occurrences.filter(o => o.status !== "synced").map(o => o.localId!)));
    // Everything not uploaded gets another try, including earlier failures
    await retryRejected();
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Recuperar datos</h1>

      {/* Estado + botón */}
      {total === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
          <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-2" />
          <p className="text-base font-semibold text-gray-900">{ranIds ? "¡Listo! Todo quedó subido" : "Todo está subido"}</p>
          <p className="text-sm text-gray-600 mt-0.5">No queda nada pendiente en este teléfono.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-base font-semibold text-gray-900">
            {total} registro{total > 1 ? "s" : ""} sin subir
          </p>
          <button
            onClick={handleUpload}
            disabled={!isOnline || engine.running}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-700 text-white text-base font-semibold py-3.5 hover:bg-teal-800 disabled:opacity-50 disabled:pointer-events-none"
          >
            {engine.running
              ? <><Loader2 className="h-5 w-5 animate-spin" /> Subiendo… {Math.min(engine.done, engine.total)} de {engine.total}</>
              : <><CloudUpload className="h-5 w-5" /> Subir ahora</>}
          </button>
          {!isOnline && <p className="text-xs text-yellow-700 text-center">Conéctate a internet para subir.</p>}
        </div>
      )}

      {engine.problem === "auth" && total > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-red-700">Tu sesión expiró. Los datos siguen en el teléfono.</p>
          <a href="/login" className="shrink-0 flex items-center gap-1 text-sm font-medium text-teal-700">
            <LogIn className="h-4 w-4" /> Iniciar sesión
          </a>
        </div>
      )}

      {/* Lista */}
      {shown.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl divide-y">
          {shown.map(o => {
            const r = describe(o, data);
            const Icon = r.tone === "ok" ? CheckCircle2 : r.tone === "bad" ? AlertCircle : Clock;
            return (
              <div key={o.localId} className="flex gap-3 p-3">
                <Icon className={cn(
                  "h-5 w-5 shrink-0 mt-0.5",
                  r.tone === "ok" && "text-green-600", r.tone === "bad" && "text-red-600", r.tone === "wait" && "text-yellow-600",
                )} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{o.speciesLabel}</p>
                  <p className="text-xs text-gray-500">
                    {projectName(o.projectId)} · {stationName(o)} · {new Date(o.createdAt).toLocaleDateString("es-CL")}
                  </p>
                  <p className={cn(
                    "text-xs mt-1 font-medium",
                    r.tone === "ok" && "text-green-700", r.tone === "bad" && "text-red-700", r.tone === "wait" && "text-yellow-700",
                  )}>
                    {r.text}
                  </p>
                  {r.hint && <p className="text-xs text-gray-600">{r.hint}</p>}
                  {canDelete && o.status !== "synced" && (
                    <DeleteButton onClick={() => deleteOccurrence(o)} disabled={engine.running} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Campañas y réplicas creadas en terreno que no han subido */}
      {(pendingCampaigns.length + pendingStations.length) > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl divide-y">
          <p className="p-3 text-sm font-semibold text-gray-900">Creadas en terreno, sin subir</p>
          {pendingCampaigns.map(c => (
            <div key={`c${c.localId}`} className="p-3">
              <p className="text-sm font-medium text-gray-900">Campaña: {c.name}</p>
              <p className="text-xs text-gray-500">{projectName(c.projectId)}</p>
              {c.errorMessage && <p className="text-xs text-red-700 mt-1">{friendly(c.errorMessage)}</p>}
              {canDelete && <DeleteButton onClick={() => deleteCampaign(c)} disabled={engine.running} />}
            </div>
          ))}
          {pendingStations.map(st => (
            <div key={`s${st.localId}`} className="p-3">
              <p className="text-sm font-medium text-gray-900">Réplica: {st.name}</p>
              {st.errorMessage && <p className="text-xs text-red-700 mt-1">{friendly(st.errorMessage)}</p>}
              {canDelete && <DeleteButton onClick={() => deleteStation(st)} disabled={engine.running} />}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 text-xs text-gray-500">
        <ShieldCheck className="h-4 w-4 text-teal-600 shrink-0" />
        <p>
          No se duplica nada: si un registro ya estaba en el servidor, se marca como subido sin crear otro.
          Nada se borra del teléfono hasta que el servidor lo confirma.
        </p>
      </div>

      <button onClick={() => void downloadBackup()} className="text-xs text-teal-700 underline">
        Descargar copia de seguridad
      </button>
    </div>
  );
}

function DeleteButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline disabled:opacity-40"
    >
      <Trash2 className="h-3.5 w-3.5" /> Eliminar del teléfono
    </button>
  );
}
