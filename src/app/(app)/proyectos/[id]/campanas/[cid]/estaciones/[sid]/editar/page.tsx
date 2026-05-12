import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { StationForm } from "@/components/estaciones/StationForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function EditarEstacionPage({
  params,
}: {
  params: { id: string; cid: string; sid: string };
}) {
  const station = await prisma.station.findUnique({
    where: { id: params.sid },
    include: { campaign: { select: { surveyType: true, projectId: true } } },
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
          <h1 className="text-xl font-bold text-gray-900">Editar Estación</h1>
          <p className="text-sm text-gray-500">{station.name}</p>
        </div>
      </div>
      <StationForm
        projectId={params.id}
        campaignId={params.cid}
        surveyType={station.campaign.surveyType as "FLORA" | "FAUNA"}
        stationId={station.id}
        defaultValues={{
          name: station.name,
          area: station.area?.toString() ?? "",
          length: station.length?.toString() ?? "",
          width: station.width?.toString() ?? "",
          latitude: station.latitude?.toString() ?? "",
          longitude: station.longitude?.toString() ?? "",
          notes: station.notes ?? "",
        }}
      />
    </div>
  );
}
