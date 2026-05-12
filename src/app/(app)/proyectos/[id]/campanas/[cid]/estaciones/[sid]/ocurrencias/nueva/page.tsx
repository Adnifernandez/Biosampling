import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { OccurrenceForm } from "@/components/ocurrencias/OccurrenceForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function NuevaOcurrenciaPage({
  params,
}: {
  params: { id: string; cid: string; sid: string };
}) {
  const station = await prisma.station.findUnique({
    where: { id: params.sid },
    include: {
      campaign: {
        select: { id: true, name: true, surveyType: true, methodology: true, projectId: true },
      },
    },
  });
  if (!station || station.campaign.projectId !== params.id) notFound();

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href={`/proyectos/${params.id}/campanas/${params.cid}/estaciones/${params.sid}`}
          className="text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nueva Ocurrencia</h1>
          <p className="text-sm text-gray-500">
            {station.name} · {station.campaign.name}
          </p>
        </div>
      </div>
      <OccurrenceForm
        projectId={params.id}
        campaignId={params.cid}
        stationId={params.sid}
        surveyType={station.campaign.surveyType as "FLORA" | "FAUNA"}
        methodology={station.campaign.methodology}
      />
    </div>
  );
}
