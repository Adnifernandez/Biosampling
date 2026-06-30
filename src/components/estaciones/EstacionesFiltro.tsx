"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderOpen } from "lucide-react";
import { navigate } from "@/lib/offline-nav";
import { saveLastProject, getLastProject } from "@/lib/project-persistence";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  useEffect(() => {
    if (selectedProjectId) {
      saveLastProject(selectedProjectId);
    } else {
      const last = getLastProject();
      if (last && projects.some((p) => p.id === last)) {
        navigate(router, `/estaciones?projectId=${last}`);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div className="space-y-3">
      {/* Project badge */}
      {selectedProjectId ? (
        <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg px-4 py-2.5">
          <FolderOpen className="h-4 w-4 text-teal-600 shrink-0" />
          <span className="font-medium text-teal-900 text-sm">{selectedProject?.name ?? ""}</span>
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

      {/* Campaign selector */}
      {selectedProjectId && campaigns.length > 0 && (
        <Select value={selectedCampaignId} onValueChange={handleCampaignChange}>
          <SelectTrigger className="w-full sm:max-w-xs">
            <SelectValue>
              {(() => {
                const c = campaigns.find((c) => c.id === selectedCampaignId);
                if (!c) return <span className="text-gray-500">Seleccionar campaña...</span>;
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
                <span className="text-gray-400 ml-1">· {c.surveyType === "FLORA" ? "Flora" : "Fauna"}</span>
                {c.methodology && <span className="text-gray-400 ml-1">· {getMethodologyById(c.methodology)?.name ?? c.methodology}</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
