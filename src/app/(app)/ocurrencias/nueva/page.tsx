import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { OccurrenceForm } from "@/components/ocurrencias/OccurrenceForm";

export default async function NuevaOcurrenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const { stationId } = await searchParams;
  if (!stationId) notFound();

  const station = await prisma.station.findUnique({
    where: { id: stationId },
    include: {
      campaign: {
        select: { id: true, name: true, surveyType: true, methodology: true, projectId: true, shermanTrapCount: true, cameraTrapCount: true },
      },
    },
  });
  if (!station) notFound();

  const isGrilla = station.campaign.methodology === "GRILLA";
  const isBB = station.campaign.methodology === "BRAUN_BLANQUET";

  const [transectoStation, bbOccurrences] = await Promise.all([
    isGrilla && station.parentId
      ? prisma.station.findUnique({
          where: { id: station.parentId },
          select: { id: true, latitude: true, longitude: true },
        })
      : Promise.resolve(null),
    isBB
      ? prisma.occurrence.findMany({ where: { stationId }, select: { speciesId: true } })
      : Promise.resolve([]),
  ]);

  const existingBBSpeciesIds = bbOccurrences.map(o => o.speciesId);

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href={`/ocurrencias?projectId=${station.campaign.projectId}&campaignId=${station.campaignId}&stationId=${stationId}`}
          className="text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nueva Ocurrencia</h1>
          <p className="text-sm text-gray-500">{station.name} · {station.campaign.name}</p>
        </div>
      </div>

      <OccurrenceForm
        projectId={station.campaign.projectId}
        campaignId={station.campaignId}
        stationId={stationId}
        surveyType={station.campaign.surveyType as "FLORA" | "FAUNA"}
        methodology={station.campaign.methodology}
        transectoId={transectoStation?.id ?? undefined}
        transectoCoords={transectoStation ? { latitude: transectoStation.latitude, longitude: transectoStation.longitude } : undefined}
        shermanTrapCount={station.campaign.shermanTrapCount ?? 0}
        cameraTrapCount={station.campaign.cameraTrapCount ?? 0}
        existingBBSpeciesIds={existingBBSpeciesIds.length > 0 ? existingBBSpeciesIds : undefined}
      />
    </div>
  );
}
