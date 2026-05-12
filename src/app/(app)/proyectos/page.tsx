import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button-link";
import { Button } from "@/components/ui/button";
import { Plus, FolderOpen, MapPin, User } from "lucide-react";
import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/types";

const STATUS_COLORS: Record<ProjectStatus, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-gray-100 text-gray-600",
  COMPLETED: "bg-blue-100 text-blue-800",
};

export default async function ProyectosPage() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      campaigns: {
        select: { id: true, surveyType: true, status: true },
      },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Proyectos</h1>
          <p className="text-sm text-gray-500">{projects.length} proyecto{projects.length !== 1 ? "s" : ""}</p>
        </div>
        <ButtonLink href="/proyectos/nuevo" size="sm" className="bg-green-700 hover:bg-green-800 text-white">
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
            <ButtonLink href="/proyectos/nuevo" className="mt-4 inline-flex bg-green-700 hover:bg-green-800 text-white" size="sm">
              <Plus className="h-4 w-4 mr-1" /> Crear proyecto
            </ButtonLink>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => {
            const activeCampaigns = p.campaigns.filter((c) => c.status === "ACTIVE").length;
            return (
              <Link key={p.id} href={`/proyectos/${p.id}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
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
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" /> {p.responsible}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-bold text-gray-800">{p.campaigns.length}</p>
                        <p className="text-xs text-gray-400">
                          campaña{p.campaigns.length !== 1 ? "s" : ""}
                        </p>
                        {activeCampaigns > 0 && (
                          <span className="text-xs text-green-600">{activeCampaigns} activa{activeCampaigns !== 1 ? "s" : ""}</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
