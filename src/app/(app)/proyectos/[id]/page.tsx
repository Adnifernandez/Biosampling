import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Plus, MapPin, User, Layers, Pencil } from "lucide-react";
import { PROJECT_STATUS_LABELS, CAMPAIGN_STATUS_LABELS, SURVEY_TYPE_LABELS, type ProjectStatus, type CampaignStatus, type SurveyType } from "@/lib/types";
import { REGIONS } from "@/lib/chile-data";
import { DeleteProjectButton } from "@/components/proyectos/DeleteProjectButton";

export default async function ProyectoDetailPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      campaigns: {
        orderBy: { createdAt: "desc" },
        include: { stations: { select: { id: true } } },
      },
    },
  });
  if (!project) notFound();

  const region = REGIONS.find((r) => r.id === project.region);

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Link href="/proyectos" className="text-gray-400 hover:text-gray-600 mt-1">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                project.status === "ACTIVE" ? "bg-green-100 text-green-800" :
                project.status === "COMPLETED" ? "bg-blue-100 text-blue-800" :
                "bg-gray-100 text-gray-600"
              }`}>
                {PROJECT_STATUS_LABELS[project.status as ProjectStatus]}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {region?.name ?? project.region} · {project.commune}
              </span>
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" /> {project.responsible}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <ButtonLink href={`/proyectos/${project.id}/editar`} variant="outline" size="sm">
            <Pencil className="h-4 w-4" />
          </ButtonLink>
          <DeleteProjectButton id={project.id} />
        </div>
      </div>

      {project.description && (
        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3">{project.description}</p>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-gray-500" />
            <h2 className="font-semibold text-gray-800">
              Campañas ({project.campaigns.length})
            </h2>
          </div>
          <ButtonLink href={`/proyectos/${project.id}/campanas/nueva`} size="sm" className="bg-green-700 hover:bg-green-800 text-white">
            <Plus className="h-4 w-4 mr-1" /> Nueva
          </ButtonLink>
        </div>

        {project.campaigns.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Layers className="h-10 w-10 mx-auto mb-2 text-gray-300" />
              <p className="text-gray-500 text-sm">No hay campañas en este proyecto</p>
              <ButtonLink href={`/proyectos/${project.id}/campanas/nueva`} size="sm" className="mt-3 inline-flex bg-green-700 hover:bg-green-800 text-white">
                <Plus className="h-4 w-4 mr-1" /> Crear campaña
              </ButtonLink>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {project.campaigns.map((c) => (
              <Link key={c.id} href={`/proyectos/${project.id}/campanas/${c.id}`}>
                <Card className="hover:shadow-sm transition-shadow">
                  <CardContent className="py-3 px-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-gray-900">{c.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          c.surveyType === "FLORA" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {SURVEY_TYPE_LABELS[c.surveyType as SurveyType]}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          c.status === "ACTIVE" ? "bg-yellow-100 text-yellow-700" :
                          c.status === "COMPLETED" ? "bg-gray-100 text-gray-600" : "bg-red-100 text-red-700"
                        }`}>
                          {CAMPAIGN_STATUS_LABELS[c.status as CampaignStatus]}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-700">{c.stations.length}</p>
                      <p className="text-xs text-gray-400">estación{c.stations.length !== 1 ? "es" : ""}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
