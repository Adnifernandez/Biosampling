import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { OccurrenceForm } from "@/components/ocurrencias/OccurrenceForm";
import { format } from "date-fns";

export default async function EditarOcurrenciaPage({
  params,
  searchParams,
}: {
  params: Promise<{ oid: string }>;
  searchParams: Promise<{ stationId?: string }>;
}) {
  const { oid } = await params;
  const { stationId } = await searchParams;

  const occurrence = await prisma.occurrence.findUnique({
    where: { id: oid },
    include: {
      station: {
        include: {
          campaign: {
            select: { id: true, name: true, surveyType: true, methodology: true, projectId: true },
          },
        },
      },
    },
  });
  if (!occurrence) notFound();

  const sid = stationId ?? occurrence.stationId;

  const defaultValues: Record<string, string> = {
    speciesId: occurrence.speciesId,
    date: format(new Date(occurrence.date), "yyyy-MM-dd"),
    latitude: occurrence.latitude?.toString() ?? "",
    longitude: occurrence.longitude?.toString() ?? "",
    abundance: occurrence.abundance?.toString() ?? "",
    cover: occurrence.cover?.toString() ?? "",
    height: occurrence.height?.toString() ?? "",
    stratum: occurrence.stratum ?? "",
    phenology: occurrence.phenology ?? "",
    distance: occurrence.distance?.toString() ?? "",
    bearing: occurrence.bearing?.toString() ?? "",
    groupSize: occurrence.groupSize?.toString() ?? "",
    behavior: occurrence.behavior ?? "",
    detectionMethod: occurrence.detectionMethod ?? "",
    notes: occurrence.notes ?? "",
  };

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href={`/ocurrencias?projectId=${occurrence.station.campaign.projectId}&campaignId=${occurrence.station.campaignId}&stationId=${occurrence.stationId}`}
          className="text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Editar Ocurrencia</h1>
          <p className="text-sm text-gray-500">{occurrence.station.name} · {occurrence.station.campaign.name}</p>
        </div>
      </div>

      <OccurrenceForm
        projectId={occurrence.station.campaign.projectId}
        campaignId={occurrence.station.campaignId}
        stationId={occurrence.stationId}
        surveyType={occurrence.station.campaign.surveyType as "FLORA" | "FAUNA"}
        methodology={occurrence.station.campaign.methodology}
        occurrenceId={oid}
        defaultValues={defaultValues}
      />
    </div>
  );
}
