import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { StationForm } from "@/components/estaciones/StationForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function EditarEstacionPage({
  params,
}: {
  params: Promise<{ sid: string }>;
}) {
  const { sid } = await params;
  const station = await prisma.station.findUnique({
    where: { id: sid },
    include: { campaign: { select: { surveyType: true, projectId: true, id: true } } },
  });
  if (!station) notFound();

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-center gap-2">
        <Link href={`/estaciones/${sid}`} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Editar Estación</h1>
          <p className="text-sm text-gray-500">{station.name}</p>
        </div>
      </div>
      <StationForm
        projectId={station.campaign.projectId}
        campaignId={station.campaign.id}
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
