"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Project = { id: string; name: string };

export function CampanasFilter({ projects, selectedProjectId }: { projects: Project[]; selectedProjectId: string }) {
  const router = useRouter();

  return (
    <Select
      value={selectedProjectId}
      onValueChange={(v) => {
        if (v && v !== "all") {
          router.push(`/campanas?projectId=${v}`);
        } else {
          router.push("/campanas");
        }
      }}
    >
      <SelectTrigger className="max-w-xs">
        <SelectValue>
          {selectedProjectId
            ? projects.find((p) => p.id === selectedProjectId)?.name ?? "Todos los proyectos"
            : <span className="text-gray-500">Todos los proyectos</span>}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos los proyectos</SelectItem>
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
