"use client";

import { useRouter } from "next/navigation";
import { navigate } from "@/lib/offline-nav";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { getMethodologyById } from "@/lib/methodologies";

type Campaign = { id: string; name: string; surveyType: string; methodology: string | null };
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

  function handleProjectChange(v: string) {
    navigate(router, v ? `/estaciones?projectId=${v}` : "/estaciones");
  }

  function handleCampaignChange(v: string | null) {
    const val = v ?? "";
    navigate(
      router,
      val && val !== "all"
        ? `/estaciones?projectId=${selectedProjectId}&campaignId=${val}`
        : `/estaciones?projectId=${selectedProjectId}`
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      <SearchableSelect
        className="max-w-xs w-full sm:w-auto"
        value={selectedProjectId}
        options={projects.map((p) => ({ value: p.id, label: p.name }))}
        allLabel="Todos los proyectos"
        onChange={handleProjectChange}
      />

      {selectedProjectId && campaigns.length > 0 && (
        <Select value={selectedCampaignId} onValueChange={handleCampaignChange}>
          <SelectTrigger className="w-full sm:w-auto sm:min-w-[220px]">
            <SelectValue>
              {(() => {
                const c = campaigns.find((c) => c.id === selectedCampaignId);
                if (!c) return <span className="text-gray-500">Todas las campañas</span>;
                const metodName = c.methodology ? getMethodologyById(c.methodology)?.name : null;
                return <>{c.name}{metodName && <span className="text-gray-400 ml-1">· {metodName}</span>}</>;
              })()}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="min-w-max">
            <SelectItem value="all">Todas las campañas</SelectItem>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
                {c.methodology && <span className="text-gray-400 ml-1">· {getMethodologyById(c.methodology)?.name ?? c.methodology}</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
