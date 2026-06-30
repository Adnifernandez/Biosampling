"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderOpen } from "lucide-react";
import { navigate } from "@/lib/offline-nav";
import { saveLastProject, getLastProject } from "@/lib/project-persistence";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { getMethodologyById } from "@/lib/methodologies";

interface Props {
  projects: { id: string; name: string }[];
  campaigns: { id: string; name: string; surveyType: string; methodology: string | null }[];
  stations: { id: string; name: string }[];
  grillaStations?: { id: string; name: string }[];
  selectedProjectId: string;
  selectedCampaignId: string;
  selectedTransectoId?: string;
  selectedStationId: string;
}

export function OcurrenciasFiltro({
  projects,
  campaigns,
  stations,
  grillaStations,
  selectedProjectId,
  selectedCampaignId,
  selectedTransectoId,
  selectedStationId,
}: Props) {
  const router = useRouter();

  useEffect(() => {
    if (selectedProjectId) {
      saveLastProject(selectedProjectId);
    } else {
      const last = getLastProject();
      if (last && projects.some((p) => p.id === last)) {
        navigate(router, `/ocurrencias?projectId=${last}`);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const projectName = projects.find((p) => p.id === selectedProjectId)?.name;
  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);
  const campaignName = selectedCampaign?.name;
  const campaignMethodology = selectedCampaign?.methodology
    ? getMethodologyById(selectedCampaign.methodology)?.name
    : null;
  const isGrilla = selectedCampaign?.methodology === "GRILLA";

  const stationName = isGrilla
    ? stations.find((s) => s.id === selectedTransectoId)?.name
    : stations.find((s) => s.id === selectedStationId)?.name;
  const grillaName = grillaStations?.find((s) => s.id === selectedStationId)?.name;

  function onCampaignChange(val: string | null) {
    const v = val ?? "";
    navigate(router, v ? `/ocurrencias?projectId=${selectedProjectId}&campaignId=${v}` : `/ocurrencias?projectId=${selectedProjectId}`);
  }

  function onStationChange(val: string | null) {
    const v = val ?? "";
    if (isGrilla) {
      navigate(
        router,
        v
          ? `/ocurrencias?projectId=${selectedProjectId}&campaignId=${selectedCampaignId}&transectoId=${v}`
          : `/ocurrencias?projectId=${selectedProjectId}&campaignId=${selectedCampaignId}`
      );
    } else {
      navigate(
        router,
        v
          ? `/ocurrencias?projectId=${selectedProjectId}&campaignId=${selectedCampaignId}&stationId=${v}`
          : `/ocurrencias?projectId=${selectedProjectId}&campaignId=${selectedCampaignId}`
      );
    }
  }

  function onGrillaChange(val: string | null) {
    const v = val ?? "";
    navigate(
      router,
      v
        ? `/ocurrencias?projectId=${selectedProjectId}&campaignId=${selectedCampaignId}&transectoId=${selectedTransectoId}&stationId=${v}`
        : `/ocurrencias?projectId=${selectedProjectId}&campaignId=${selectedCampaignId}&transectoId=${selectedTransectoId}`
    );
  }

  return (
    <div className="space-y-3">
      {/* Project badge */}
      {selectedProjectId ? (
        <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg px-4 py-2.5">
          <FolderOpen className="h-4 w-4 text-teal-600 shrink-0" />
          <span className="font-medium text-teal-900 text-sm">{projectName}</span>
          <Link href="/proyectos" className="ml-auto text-xs text-teal-600 hover:text-teal-800 hover:underline shrink-0">
            cambiar proyecto
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
          <FolderOpen className="h-4 w-4 shrink-0" />
          <span>Selecciona un proyecto desde</span>
          <Link href="/proyectos" className="text-teal-700 font-medium hover:underline">
            Proyectos
          </Link>
        </div>
      )}

      {/* Campaign + station selectors */}
      {selectedProjectId && (
        <div className={`grid gap-3 ${isGrilla ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Campaña</Label>
            <Select value={selectedCampaignId} onValueChange={onCampaignChange} disabled={!selectedProjectId}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {campaignName
                    ? <>{campaignName}{campaignMethodology && <span className="text-gray-400 ml-1">· {campaignMethodology}</span>}</>
                    : <span className="text-muted-foreground">Seleccionar campaña...</span>}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="min-w-max">
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    <span className="text-gray-400 ml-1">· {c.surveyType === "FLORA" ? "Flora" : "Fauna"}</span>
                    {c.methodology && <span className="text-gray-400 ml-1">· {getMethodologyById(c.methodology)?.name ?? c.methodology}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">{isGrilla ? "Transecto" : "Estación"}</Label>
            <Select
              value={isGrilla ? (selectedTransectoId ?? "") : selectedStationId}
              onValueChange={onStationChange}
              disabled={!selectedCampaignId}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {stationName
                    ? stationName
                    : <span className="text-muted-foreground">{selectedCampaignId ? `Seleccionar ${isGrilla ? "transecto" : "estación"}...` : "Primero elige campaña"}</span>}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {stations.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isGrilla && (
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Grilla</Label>
              <Select
                value={selectedStationId}
                onValueChange={onGrillaChange}
                disabled={!selectedTransectoId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {grillaName
                      ? grillaName
                      : <span className="text-muted-foreground">{selectedTransectoId ? "Seleccionar grilla..." : "Primero elige transecto"}</span>}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(grillaStations ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
