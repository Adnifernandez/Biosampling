import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button-link";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { OcurrenciasFiltro } from "@/components/ocurrencias/OcurrenciasFiltro";

export default async function OcurrenciasPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; campaignId?: string; stationId?: string }>;
}) {
  const { projectId, campaignId, stationId } = await searchParams;

  const projects = await prisma.project.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const campaigns = projectId
    ? await prisma.campaign.findMany({
        where: { projectId },
        orderBy: { name: "asc" },
        select: { id: true, name: true, surveyType: true },
      })
    : [];

  const stations = campaignId
    ? await prisma.station.findMany({
        where: { campaignId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];

  const occurrences = stationId
    ? await prisma.occurrence.findMany({
        where: { stationId },
        orderBy: { date: "desc" },
        include: {
          species: { select: { genus: true, species: true, commonName: true } },
          user: { select: { name: true } },
          station: { select: { name: true } },
        },
      })
    : [];

  const selectedStation = stationId ? stations.find((s) => s.id === stationId) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ocurrencias</h1>
          {stationId && (
            <p className="text-sm text-gray-500">
              {occurrences.length} ocurrencia{occurrences.length !== 1 ? "s" : ""}
              {selectedStation ? ` · ${selectedStation.name}` : ""}
            </p>
          )}
        </div>
        {stationId && (
          <ButtonLink
            href={`/ocurrencias/nueva?stationId=${stationId}`}
            size="sm"
            className="bg-green-700 hover:bg-green-800 text-white"
          >
            <Plus className="h-4 w-4 mr-1" />
            Nueva
          </ButtonLink>
        )}
      </div>

      <OcurrenciasFiltro
        projects={projects}
        campaigns={campaigns}
        stations={stations}
        selectedProjectId={projectId ?? ""}
        selectedCampaignId={campaignId ?? ""}
        selectedStationId={stationId ?? ""}
      />

      {!stationId ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">Selecciona una estación</p>
            <p className="text-sm text-gray-400 mt-1">Filtra por proyecto, campaña y estación para ver las ocurrencias</p>
          </CardContent>
        </Card>
      ) : occurrences.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">No hay ocurrencias registradas</p>
            <ButtonLink
              href={`/ocurrencias/nueva?stationId=${stationId}`}
              size="sm"
              className="mt-4 inline-flex bg-green-700 hover:bg-green-800 text-white"
            >
              <Plus className="h-4 w-4 mr-1" /> Registrar ocurrencia
            </ButtonLink>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {occurrences.map((o) => (
            <Link key={o.id} href={`/ocurrencias/${o.id}/editar?stationId=${stationId}`}>
              <Card className="hover:shadow-sm transition-shadow">
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm text-gray-900 italic">
                        {o.species.genus} {o.species.species}
                      </p>
                      {o.species.commonName && (
                        <p className="text-xs text-gray-500">{o.species.commonName}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">{o.user.name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {o.abundance != null && (
                        <p className="text-sm font-semibold text-gray-700">{o.abundance} ind.</p>
                      )}
                      {o.cover != null && (
                        <p className="text-sm font-semibold text-gray-700">{o.cover}%</p>
                      )}
                      <p className="text-xs text-gray-400">
                        {format(new Date(o.date), "d MMM yyyy", { locale: es })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
