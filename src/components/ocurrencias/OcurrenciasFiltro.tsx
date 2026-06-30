"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderOpen, Layers, LayoutList } from "lucide-react";
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

  const selectedStation = isGrilla
    ? stations.find((s) => s.id === selectedTransectoId)
    : stations.find((s) => s.id === selectedStationId);
  const selectedGrilla = grillaStations?.find((s) => s.id === selectedStationId);

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
    <div className="space-y-2">
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
          <Link href="/proyectos" className="text-teal-700 font-medium hover:underline">Proyectos</Link>
        </div>
      )}

      {/* Campaign badge */}
      {selectedProjectId && (campaignName ? (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
          <Layers className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="font-medium text-blue-900 text-sm">
            {campaignName}
            {campaignMethodology && <span className="text-blue-500 font-normal ml-1.5">· {campaignMethodology}</span>}
          </span>
          <Link
            href={`/campanas?projectId=${selectedProjectId}`}
            className="ml-auto text-xs text-blue-600 hover:text-blue-800 hover:underline shrink-0"
          >
            cambiar campaña
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
          <Layers className="h-4 w-4 shrink-0" />
          <span>Elige una campaña desde</span>
          <Link href={`/campanas?projectId=${selectedProjectId}`} className="text-teal-700 font-medium hover:underline">
            Campañas
          </Link>
        </div>
      ))}

      {/* Station badge (if already selected via guided nav) or selector */}
      {selectedCampaignId && (
        selectedStation && !isGrilla ? (
          <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-4 py-2.5">
            <LayoutList className="h-4 w-4 text-purple-600 shrink-0" />
            <span className="font-medium text-purple-900 text-sm">{selectedStation.name}</span>
            <Link
              href={`/estaciones?projectId=${selectedProjectId}&campaignId=${selectedCampaignId}`}
              className="ml-auto text-xs text-purple-600 hover:text-purple-800 hover:underline shrink-0"
            >
              cambiar estación
            </Link>
          </div>
        ) : (
          <div className={`grid gap-3 ${isGrilla ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">{isGrilla ? "Transecto" : "Estación"}</Label>
              <Select
                value={isGrilla ? (selectedTransectoId ?? "") : selectedStationId}
                onValueChange={onStationChange}
              >
                <SelectTrigger className="w-full sm:max-w-xs">
                  <SelectValue>
                    <span className="text-muted-foreground">
                      {`Seleccionar ${isGrilla ? "transecto" : "estación"}...`}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {stations.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isGrilla && selectedTransectoId && (
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">Grilla</Label>
                <Select value={selectedStationId} onValueChange={onGrillaChange}>
                  <SelectTrigger className="w-full sm:max-w-xs">
                    <SelectValue>
                      {selectedGrilla
                        ? selectedGrilla.name
                        : <span className="text-muted-foreground">Seleccionar grilla...</span>}
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
        )
      )}
    </div>
  );
}
