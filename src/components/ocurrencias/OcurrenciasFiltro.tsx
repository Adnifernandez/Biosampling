"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Props {
  projects: { id: string; name: string }[];
  campaigns: { id: string; name: string; surveyType: string }[];
  stations: { id: string; name: string }[];
  selectedProjectId: string;
  selectedCampaignId: string;
  selectedStationId: string;
}

export function OcurrenciasFiltro({
  projects,
  campaigns,
  stations,
  selectedProjectId,
  selectedCampaignId,
  selectedStationId,
}: Props) {
  const router = useRouter();

  const projectName = projects.find((p) => p.id === selectedProjectId)?.name;
  const campaignName = campaigns.find((c) => c.id === selectedCampaignId)?.name;
  const stationName = stations.find((s) => s.id === selectedStationId)?.name;

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
    router.push(
      v
        ? `/ocurrencias?projectId=${selectedProjectId}&campaignId=${selectedCampaignId}&stationId=${v}`
        : `/ocurrencias?projectId=${selectedProjectId}&campaignId=${selectedCampaignId}`
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-gray-500">Proyecto</Label>
        <Select value={selectedProjectId || undefined} onValueChange={onProjectChange}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {projectName
                ? projectName
                : <span className="text-muted-foreground">Seleccionar proyecto...</span>}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-gray-500">Campaña</Label>
        <Select
          value={selectedCampaignId || undefined}
          onValueChange={onCampaignChange}
          disabled={!selectedProjectId}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {campaignName
                ? campaignName
                : <span className="text-muted-foreground">{selectedProjectId ? "Seleccionar campaña..." : "Primero elige proyecto"}</span>}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-gray-500">Estación</Label>
        <Select
          value={selectedStationId || undefined}
          onValueChange={onStationChange}
          disabled={!selectedCampaignId}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {stationName
                ? stationName
                : <span className="text-muted-foreground">{selectedCampaignId ? "Seleccionar estación..." : "Primero elige campaña"}</span>}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {stations.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
