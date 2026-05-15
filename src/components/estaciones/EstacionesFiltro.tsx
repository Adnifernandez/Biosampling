"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Campaign = { id: string; name: string; surveyType: string };
type Project = { id: string; name: string; campaigns: Campaign[] };

interface EstacionesFiltroProps {
  projects: Project[];
  selectedProjectId: string;
  selectedCampaignId: string;
}

export function EstacionesFiltro({
  projects,
  selectedProjectId,
  selectedCampaignId,
}: EstacionesFiltroProps) {
  const router = useRouter();

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const campaigns = selectedProject?.campaigns ?? [];

  function handleProjectChange(v: string | null) {
    const val = v ?? "";
    if (val && val !== "all") {
      router.push(`/estaciones?projectId=${val}`);
    } else {
      router.push("/estaciones");
    }
  }

  function handleCampaignChange(v: string | null) {
    const val = v ?? "";
    if (val && val !== "all") {
      router.push(`/estaciones?projectId=${selectedProjectId}&campaignId=${val}`);
    } else {
      router.push(`/estaciones?projectId=${selectedProjectId}`);
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Select value={selectedProjectId} onValueChange={handleProjectChange}>
        <SelectTrigger className="max-w-xs w-full sm:w-auto">
          <SelectValue>
            {selectedProjectId
              ? (projects.find((p) => p.id === selectedProjectId)?.name ?? "Todos los proyectos")
              : <span className="text-gray-500">Todos los proyectos</span>}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los proyectos</SelectItem>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedProjectId && campaigns.length > 0 && (
        <Select value={selectedCampaignId} onValueChange={handleCampaignChange}>
          <SelectTrigger className="max-w-xs w-full sm:w-auto">
            <SelectValue>
              {selectedCampaignId
                ? (campaigns.find((c) => c.id === selectedCampaignId)?.name ?? "Todas las campañas")
                : <span className="text-gray-500">Todas las campañas</span>}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las campañas</SelectItem>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
