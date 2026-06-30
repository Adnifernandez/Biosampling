"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderOpen, Layers } from "lucide-react";
import { navigate } from "@/lib/offline-nav";
import { saveLastProject, getLastProject } from "@/lib/project-persistence";

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
  const selectedCampaign = selectedProject?.campaigns.find((c) => c.id === selectedCampaignId);

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

  return (
    <div className="space-y-2">
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
          <Link href="/proyectos" className="text-teal-700 font-medium hover:underline">Proyectos</Link>
        </div>
      )}

      {/* Campaign badge */}
      {selectedProjectId && (selectedCampaign ? (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
          <Layers className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="font-medium text-blue-900 text-sm">{selectedCampaign.name}</span>
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
    </div>
  );
}
