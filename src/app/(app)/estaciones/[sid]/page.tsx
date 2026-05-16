import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button-link";
import { ArrowLeft, MapPin, Pencil } from "lucide-react";
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
        select: { id: true, name: true, surveyType: true, projectId: true },
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
    </div>
  );
}
