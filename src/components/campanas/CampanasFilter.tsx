"use client";

import { useRouter } from "next/navigation";
import { SearchableSelect } from "@/components/ui/searchable-select";

type Project = { id: string; name: string };

export function CampanasFilter({ projects, selectedProjectId }: { projects: Project[]; selectedProjectId: string }) {
  const router = useRouter();

  return (
    <SearchableSelect
      className="max-w-xs"
      value={selectedProjectId}
      options={projects.map((p) => ({ value: p.id, label: p.name }))}
      allLabel="Todos los proyectos"
      onChange={(v) => {
        if (v) {
          router.push(`/campanas?projectId=${v}`);
        } else {
          router.push("/campanas");
        }
      }}
    />
  );
}
