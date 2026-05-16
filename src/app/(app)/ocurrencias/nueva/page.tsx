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
        select: { id: true, name: true, surveyType: true, methodology: true, projectId: true },
      },
    },
  });
  if (!station) notFound();

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
      />
    </div>
  );
}
