import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button-link";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Plus, FileText, MapPin, Pencil } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DeleteStationButton } from "@/components/estaciones/DeleteStationButton";

export default async function EstacionDetailPage({
  params,
}: {
  params: Promise<{ sid: string }>;
}) {
  const { sid } = await params;
  const station = await prisma.station.findUnique({
    where: { id: sid },
    include: {
      campaign: {
        select: { id: true, name: true, surveyType: true, methodology: true, projectId: true },
      },
      occurrences: {
        orderBy: { date: "desc" },
        include: {
          species: { select: { genus: true, species: true, commonName: true } },
          user: { select: { name: true } },
        },
      },
    },
  });
  if (!station) notFound();

  const isFlora = station.campaign.surveyType === "FLORA";
  const label = isFlora ? "Parcela" : "Transecto";

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Link
            href={`/estaciones?projectId=${station.campaign.projectId}&campaignId=${station.campaignId}`}
            className="text-gray-400 hover:text-gray-600 mt-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="text-xs text-gray-500">{station.campaign.name}</p>
            <h1 className="text-xl font-bold text-gray-900">{station.name}</h1>
            <div className="flex flex-wrap gap-2 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {isFlora
                  ? station.area
                    ? `${station.area} m²`
                    : station.length && station.width
                    ? `${station.length} × ${station.width} m`
                    : label
                  : station.length
                  ? `${station.length} m largo${station.width ? ` × ${station.width} m` : ""}`
                  : label}
              </span>
              {station.latitude && station.longitude && (
                <span className="text-green-600">
                  GPS: {station.latitude.toFixed(4)}, {station.longitude.toFixed(4)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <ButtonLink href={`/estaciones/${sid}/editar`} variant="outline" size="sm">
            <Pencil className="h-4 w-4" />
          </ButtonLink>
          <DeleteStationButton
            projectId={station.campaign.projectId}
            campaignId={station.campaignId}
            stationId={sid}
          />
        </div>
      </div>

      {station.notes && (
        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3">{station.notes}</p>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-500" />
            <h2 className="font-semibold text-gray-800">
              Ocurrencias ({station.occurrences.length})
            </h2>
          </div>
          <ButtonLink
            href={`/estaciones/${sid}/ocurrencias/nueva`}
            size="sm"
            className="bg-green-700 hover:bg-green-800 text-white"
          >
            <Plus className="h-4 w-4 mr-1" /> Nueva
          </ButtonLink>
        </div>

        {station.occurrences.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <FileText className="h-10 w-10 mx-auto mb-2 text-gray-300" />
              <p className="text-gray-500 text-sm">No hay ocurrencias registradas</p>
              <ButtonLink
                href={`/estaciones/${sid}/ocurrencias/nueva`}
                size="sm"
                className="mt-3 inline-flex bg-green-700 hover:bg-green-800 text-white"
              >
                <Plus className="h-4 w-4 mr-1" /> Registrar ocurrencia
              </ButtonLink>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {station.occurrences.map((o) => (
              <Link key={o.id} href={`/estaciones/${sid}/ocurrencias/${o.id}/editar`}>
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
                      </div>
                      <div className="text-right">
                        {o.abundance && (
                          <p className="text-sm font-semibold text-gray-700">{o.abundance} ind.</p>
                        )}
                        {o.cover && (
                          <p className="text-sm font-semibold text-gray-700">{o.cover}%</p>
                        )}
                        <p className="text-xs text-gray-400">
                          {format(new Date(o.date), "d MMM", { locale: es })}
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
    </div>
  );
}
