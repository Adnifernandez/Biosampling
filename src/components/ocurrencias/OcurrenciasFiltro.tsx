"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
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

  function onProjectChange(val: string | null) {
    const v = val ?? "";
    router.push(v ? `/ocurrencias?projectId=${v}` : `/ocurrencias`);
  }

  function onCampaignChange(val: string | null) {
    const v = val ?? "";
    router.push(v ? `/ocurrencias?projectId=${selectedProjectId}&campaignId=${v}` : `/ocurrencias?projectId=${selectedProjectId}`);
  }

  function onStationChange(val: string | null) {
    const v = val ?? "";
    if (isGrilla) {
      router.push(
        v
          ? `/ocurrencias?projectId=${selectedProjectId}&campaignId=${selectedCampaignId}&transectoId=${v}`
          : `/ocurrencias?projectId=${selectedProjectId}&campaignId=${selectedCampaignId}`
      );
    } else {
      router.push(
        v
          ? `/ocurrencias?projectId=${selectedProjectId}&campaignId=${selectedCampaignId}&stationId=${v}`
          : `/ocurrencias?projectId=${selectedProjectId}&campaignId=${selectedCampaignId}`
      );
    }
  }

  function onGrillaChange(val: string | null) {
    const v = val ?? "";
    router.push(
      v
        ? `/ocurrencias?projectId=${selectedProjectId}&campaignId=${selectedCampaignId}&transectoId=${selectedTransectoId}&stationId=${v}`
        : `/ocurrencias?projectId=${selectedProjectId}&campaignId=${selectedCampaignId}&transectoId=${selectedTransectoId}`
    );
  }

  const cols = isGrilla ? "grid-cols-1 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-3";

  return (
    <div className={`grid ${cols} gap-3`}>
      <div className="space-y-1.5">
        <Label className="text-xs text-gray-500">Proyecto</Label>
        <SearchableSelect
          className="w-full"
          value={selectedProjectId}
          options={projects.map((p) => ({ value: p.id, label: p.name }))}
          placeholder="Seleccionar proyecto..."
          onChange={onProjectChange}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-gray-500">Campaña</Label>
        <Select value={selectedCampaignId} onValueChange={onCampaignChange} disabled={!selectedProjectId}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {campaignName
                ? <>{campaignName}{campaignMethodology && <span className="text-gray-400 ml-1">· {campaignMethodology}</span>}</>
                : <span className="text-muted-foreground">{selectedProjectId ? "Seleccionar campaña..." : "Primero elige proyecto"}</span>}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="min-w-max">
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
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
  );
}
