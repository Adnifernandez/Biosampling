import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { OccurrenceForm } from "@/components/ocurrencias/OccurrenceForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { DeleteOccurrenceButton } from "@/components/ocurrencias/DeleteOccurrenceButton";

export default async function EditarOcurrenciaPage({
  params,
}: {
  params: Promise<{ sid: string; oid: string }>;
}) {
  const { sid, oid } = await params;
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
      species: { select: { id: true, genus: true, species: true, commonName: true } },
    },
  });
  if (!occurrence || occurrence.stationId !== sid) notFound();

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
    <div className="max-w-xl space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href={`/estaciones/${sid}`} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Editar Ocurrencia</h1>
            <p className="text-sm text-gray-500 italic">
              {occurrence.species.genus} {occurrence.species.species}
            </p>
          </div>
        </div>
        <DeleteOccurrenceButton
          projectId={occurrence.station.campaign.projectId}
          campaignId={occurrence.station.campaign.id}
          stationId={sid}
          occurrenceId={oid}
        />
      </div>
      <OccurrenceForm
        projectId={occurrence.station.campaign.projectId}
        campaignId={occurrence.station.campaign.id}
        stationId={sid}
        surveyType={occurrence.station.campaign.surveyType as "FLORA" | "FAUNA"}
        methodology={occurrence.station.campaign.methodology}
        occurrenceId={occurrence.id}
        defaultValues={defaultValues}
      />
    </div>
  );
}
