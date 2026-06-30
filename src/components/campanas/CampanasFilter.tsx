"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderOpen } from "lucide-react";
import { navigate } from "@/lib/offline-nav";
import { saveLastProject, getLastProject } from "@/lib/project-persistence";

type Project = { id: string; name: string };

export function CampanasFilter({ projects, selectedProjectId }: { projects: Project[]; selectedProjectId: string }) {
  const router = useRouter();

  useEffect(() => {
    if (selectedProjectId) {
      saveLastProject(selectedProjectId);
    } else {
      const last = getLastProject();
      if (last && projects.some((p) => p.id === last)) {
        navigate(router, `/campanas?projectId=${last}`);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!selectedProjectId) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
        <FolderOpen className="h-4 w-4 shrink-0" />
        <span>Selecciona un proyecto desde</span>
        <Link href="/proyectos" className="text-teal-700 font-medium hover:underline">
          Proyectos
        </Link>
      </div>
    );
  }

  const projectName = projects.find((p) => p.id === selectedProjectId)?.name ?? "";

  return (
    <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg px-4 py-2.5">
      <FolderOpen className="h-4 w-4 text-teal-600 shrink-0" />
      <span className="font-medium text-teal-900 text-sm">{projectName}</span>
      <Link href="/proyectos" className="ml-auto text-xs text-teal-600 hover:text-teal-800 hover:underline shrink-0">
        cambiar proyecto
      </Link>
    </div>
  );
}
