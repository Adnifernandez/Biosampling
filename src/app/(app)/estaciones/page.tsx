import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button-link";
import { Card, CardContent } from "@/components/ui/card";
import { LayoutList, Plus, MapPin, Leaf, Bird, ChevronRight } from "lucide-react";
import { EstacionesFiltro } from "@/components/estaciones/EstacionesFiltro";
import { STATION_TYPE_LABELS, type StationType } from "@/lib/types";

export default async function EstacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; campaignId?: string }>;
}) {
  const { projectId, campaignId } = await searchParams;

  const projects = await prisma.project.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      campaigns: {
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, surveyType: true },
      },
    },
  });

  const stations = campaignId
    ? await prisma.station.findMany({
        where: { campaignId },
        orderBy: { name: "asc" },
        include: {
          campaign: {
            select: { id: true, name: true, surveyType: true, projectId: true },
          },
        },
      })
    : [];

  // Find the selected campaign for context
  const selectedCampaign = campaignId
    ? projects
        .flatMap((p) => p.campaigns)
        .find((c) => c.id === campaignId)
    : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estaciones / Réplicas</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {campaignId
              ? `${stations.length} estación${stations.length !== 1 ? "es" : ""}`
              : "Selecciona una campaña para ver estaciones"}
          </p>
        </div>
        {campaignId && projectId && (
          <ButtonLink
            href={`/estaciones/nueva?projectId=${projectId}&campaignId=${campaignId}`}
            className="bg-green-700 hover:bg-green-800 text-white gap-2"
          >
            <Plus className="h-4 w-4" /> Nueva
          </ButtonLink>
        )}
      </div>

      <EstacionesFiltro
        projects={projects}
        selectedProjectId={projectId ?? ""}
        selectedCampaignId={campaignId ?? ""}
      />

      {selectedCampaign && (
        <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg w-fit ${
          selectedCampaign.surveyType === "FLORA"
            ? "bg-green-50 text-green-700"
            : "bg-blue-50 text-blue-700"
        }`}>
          {selectedCampaign.surveyType === "FLORA"
            ? <Leaf className="h-4 w-4 shrink-0" />
            : <Bird className="h-4 w-4 shrink-0" />}
          <span>
            Campaña de {selectedCampaign.surveyType === "FLORA" ? "Flora" : "Fauna"} ·{" "}
            {selectedCampaign.surveyType === "FLORA" ? "Parcelas" : "Transectos"}
          </span>
        </div>
      )}

      {!campaignId ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <LayoutList className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Selecciona un proyecto y una campaña para ver sus estaciones.</p>
          </CardContent>
        </Card>
      ) : stations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <MapPin className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>No hay estaciones en esta campaña.</p>
            {projectId && (
              <ButtonLink
                href={`/estaciones/nueva?projectId=${projectId}&campaignId=${campaignId}`}
                size="sm"
                className="mt-3 inline-flex bg-green-700 hover:bg-green-800 text-white"
              >
                <Plus className="h-4 w-4 mr-1" /> Crear estaciones
              </ButtonLink>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {stations.map((s) => (
            <Link key={s.id} href={`/estaciones/${s.id}`}>
              <Card className="hover:shadow-sm transition-shadow">
                <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-xs font-bold px-2 py-1 rounded font-mono shrink-0 ${
                      s.type === "PARCELA"
                        ? "bg-green-100 text-green-800"
                        : "bg-blue-100 text-blue-800"
                    }`}>
                      {s.name}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {STATION_TYPE_LABELS[s.type as StationType]}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {s.type === "PARCELA" ? (
                          s.area
                            ? `${s.area} m²`
                            : s.length && s.width
                            ? `${s.length} × ${s.width} m`
                            : "Sin dimensiones"
                        ) : (
                          s.length ? `${s.length} m largo` : "Sin dimensiones"
                        )}
                        {s.latitude && s.longitude && " · GPS ✓"}
                      </p>
                      {s.notes && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{s.notes}</p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
