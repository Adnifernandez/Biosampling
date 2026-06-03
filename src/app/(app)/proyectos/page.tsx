import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button-link";
import { Plus, FolderOpen, MapPin, User, Pencil } from "lucide-react";
import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/types";
import { DeleteProjectButton } from "@/components/proyectos/DeleteProjectButton";
import { CloseProjectButton } from "@/components/proyectos/CloseProjectButton";

const STATUS_COLORS: Record<ProjectStatus, string> = {
  ACTIVE: "bg-teal-100 text-teal-800",
  INACTIVE: "bg-gray-100 text-gray-600",
  COMPLETED: "bg-blue-100 text-blue-800",
};

export default async function ProyectosPage() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Proyectos</h1>
          <p className="text-sm text-gray-500">{projects.length} proyecto{projects.length !== 1 ? "s" : ""}</p>
        </div>
        <ButtonLink href="/proyectos/nuevo" size="sm" className="bg-teal-700 hover:bg-teal-800 text-white">
          <Plus className="h-4 w-4 mr-1" />
          Nuevo
        </ButtonLink>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">No hay proyectos</p>
            <p className="text-sm text-gray-400 mt-1">Crea tu primer proyecto para comenzar</p>
            <ButtonLink href="/proyectos/nuevo" className="mt-4 inline-flex bg-teal-700 hover:bg-teal-800 text-white" size="sm">
              <Plus className="h-4 w-4 mr-1" /> Crear proyecto
            </ButtonLink>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <Card key={p.id}>
              <CardContent className="py-4 px-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-gray-900 truncate">{p.name}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status as ProjectStatus]}`}>
                      {PROJECT_STATUS_LABELS[p.status as ProjectStatus]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {p.region} · {p.commune}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <CloseProjectButton id={p.id} status={p.status} />
                  {p.status !== "COMPLETED" && (
                    <ButtonLink href={`/proyectos/${p.id}/editar`} variant="outline" size="sm">
                      <Pencil className="h-4 w-4" />
                    </ButtonLink>
                  )}
                  <DeleteProjectButton id={p.id} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
