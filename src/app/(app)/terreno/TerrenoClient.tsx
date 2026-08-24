"use client";

import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import type { CachedProject, CachedCampaign, CachedStation } from "@/lib/db";
import { OccurrenceForm } from "@/components/ocurrencias/OccurrenceForm";
import { cn } from "@/lib/utils";
import { ChevronLeft, Wifi, WifiOff, RefreshCw, CheckCircle2, MapPin } from "lucide-react";

type Step = "project" | "campaign" | "station" | "substation" | "form";
interface SessionOcc { localId: number; label: string; }

export function TerrenoClient() {
  const [step, setStep]         = useState<Step>("project");
  const [project, setProject]   = useState<CachedProject | null>(null);
  const [campaign, setCampaign] = useState<CachedCampaign | null>(null);
  const [station, setStation]   = useState<CachedStation | null>(null);
  const [subStation, setSubStation] = useState<CachedStation | null>(null);
  const [sessionOccs, setSessionOccs] = useState<SessionOcc[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing]   = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const projects = useLiveQuery(
    async (): Promise<CachedProject[]> => {
      const db = getDb();
      if (!db) return [];
      return db.projects.filter(p => p.status !== "COMPLETED").toArray();
    },
    [],
    [] as CachedProject[]
  );

  const campaigns = useLiveQuery(
    async (): Promise<CachedCampaign[]> => {
      const db = getDb();
      if (!db || !project) return [];
      return db.campaigns.where("projectId").equals(project.id).filter(c => c.status !== "COMPLETED").toArray();
    },
    [project?.id],
    [] as CachedCampaign[]
  );

  const allStations = useLiveQuery(
    async (): Promise<CachedStation[]> => {
      const db = getDb();
      if (!db || !campaign) return [];
      return db.stations.where("campaignId").equals(campaign.id).toArray();
    },
    [campaign?.id],
    [] as CachedStation[]
  );

  const pendingCount = useLiveQuery(
    () => getDb()?.pendingOccurrences.where("status").equals("pending").count() ?? Promise.resolve(0),
    [],
    0
  );

  const isGrilla = campaign?.methodology === "GRILLA";
  const sorted = (arr: CachedStation[]) =>
    [...arr].sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }));
  const parentStations = sorted((allStations ?? []).filter(s => s.parentId === null));
  const childStations  = station ? sorted((allStations ?? []).filter(s => s.parentId === station.id)) : [];
  const flatStations   = sorted((allStations ?? []).filter(s => s.parentId === null));

  const formStationId   = isGrilla ? (subStation?.id ?? "") : (station?.id ?? "");
  const formTransectoId = isGrilla ? station?.id : undefined;
  const noCache = projects !== undefined && projects.length === 0;

  function goBack() {
    if (step === "form") {
      setSessionOccs([]);
      if (isGrilla) { setSubStation(null); setStep("substation"); }
      else           { setStation(null);   setStep("station");    }
    } else if (step === "substation") { setSubStation(null); setSessionOccs([]); setStep("station");  }
    else if (step === "station")      { setStation(null);   setStep("campaign"); }
    else if (step === "campaign")     { setCampaign(null);  setStep("project");  }
  }

  async function handleSync() {
    if (!isOnline || syncing) return;
    setSyncing(true);
    try {
      const { syncPendingOccurrences } = await import("@/lib/sync");
      await syncPendingOccurrences();
    } finally {
      setSyncing(false);
    }
  }

  const subtitle: Record<Step, string> = {
    project:    "Selecciona proyecto",
    campaign:   project?.name ?? "",
    station:    campaign?.name ?? "",
    substation: `${campaign?.name} › ${station?.name}`,
    form:       isGrilla ? `${station?.name} › ${subStation?.name}` : (station?.name ?? ""),
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          {step !== "project" && (
            <button onClick={goBack} className="p-1 -ml-1 text-gray-500 hover:text-gray-700 flex-shrink-0">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
              <h1 className="text-sm font-semibold text-gray-900">Modo Terreno</h1>
            </div>
            <p className="text-xs text-gray-500 truncate">{subtitle[step]}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {(pendingCount ?? 0) > 0 && (
            <button
              onClick={handleSync}
              disabled={!isOnline || syncing}
              className={cn(
                "flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium",
                isOnline ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-400 opacity-60"
              )}
            >
              <RefreshCw className={cn("w-3 h-3", syncing && "animate-spin")} />
              {pendingCount} pend.
            </button>
          )}
          <div className={cn("flex items-center text-xs font-medium", isOnline ? "text-green-600" : "text-red-500")}>
            {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 max-w-lg w-full mx-auto space-y-2">

        {/* Sin caché */}
        {noCache && step === "project" && (
          <div className="text-center py-16">
            <WifiOff className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">Sin datos en caché</p>
            <p className="text-xs text-gray-400 mt-1">Abre la app con internet al menos una vez para cargar los proyectos</p>
          </div>
        )}

        {/* Proyectos */}
        {step === "project" && !noCache && (projects ?? []).map(p => (
          <button
            key={p.id}
            onClick={() => { setProject(p); setStep("campaign"); }}
            className="w-full text-left bg-white border border-gray-200 rounded-xl px-4 py-3.5 hover:border-green-400 hover:bg-green-50 transition-colors"
          >
            <p className="text-sm font-medium text-gray-900">{p.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{p.commune} · {p.region}</p>
          </button>
        ))}

        {/* Campañas */}
        {step === "campaign" && (
          <>
            {(campaigns ?? []).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">Sin campañas activas en caché</p>
            )}
            {(campaigns ?? []).map(c => (
              <button
                key={c.id}
                onClick={() => { setCampaign(c); setStep("station"); }}
                className="w-full text-left bg-white border border-gray-200 rounded-xl px-4 py-3.5 hover:border-green-400 hover:bg-green-50 transition-colors"
              >
                <p className="text-sm font-medium text-gray-900">{c.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{c.surveyType} · {c.methodology.replace(/_/g, " ").toLowerCase()}</p>
              </button>
            ))}
          </>
        )}

        {/* Estaciones */}
        {step === "station" && (
          <>
            {(isGrilla ? parentStations : flatStations).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">Sin estaciones en caché</p>
            )}
            {(isGrilla ? parentStations : flatStations).map(s => (
              <button
                key={s.id}
                onClick={() => { setStation(s); setSessionOccs([]); setStep(isGrilla ? "substation" : "form"); }}
                className="w-full text-left bg-white border border-gray-200 rounded-xl px-4 py-3.5 hover:border-green-400 hover:bg-green-50 transition-colors"
              >
                <p className="text-sm font-medium text-gray-900">{s.name}</p>
              </button>
            ))}
          </>
        )}

        {/* Sub-estaciones (solo GRILLA) */}
        {step === "substation" && (
          <>
            {childStations.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">Sin sub-estaciones en caché</p>
            )}
            {childStations.map(s => (
              <button
                key={s.id}
                onClick={() => { setSubStation(s); setSessionOccs([]); setStep("form"); }}
                className="w-full text-left bg-white border border-gray-200 rounded-xl px-4 py-3.5 hover:border-green-400 hover:bg-green-50 transition-colors"
              >
                <p className="text-sm font-medium text-gray-900">{s.name}</p>
              </button>
            ))}
          </>
        )}

        {/* Formulario */}
        {step === "form" && campaign && project && (
          <div className="space-y-3">
            {sessionOccs.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-green-700 mb-2">
                  Registrados esta sesión ({sessionOccs.length})
                </p>
                <ul className="space-y-1">
                  {sessionOccs.map(o => (
                    <li key={o.localId} className="flex items-center gap-2 text-xs text-green-800">
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-green-600" />
                      {o.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!isOnline && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center gap-2 text-xs text-orange-700">
                <WifiOff className="w-4 h-4 flex-shrink-0" />
                Sin internet — los registros se guardan localmente y se subirán al reconectarse
              </div>
            )}

            <OccurrenceForm
              projectId={project.id}
              campaignId={campaign.id}
              stationId={formStationId}
              transectoId={formTransectoId}
              surveyType={campaign.surveyType as "FLORA" | "FAUNA"}
              methodology={campaign.methodology}
              shermanTrapCount={campaign.shermanTrapCount ?? undefined}
              cameraTrapCount={campaign.cameraTrapCount ?? undefined}
              forceOffline={true}
              onRegistered={(label, _payload, localId) => {
                setSessionOccs(prev => [...prev, { localId, label }]);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
