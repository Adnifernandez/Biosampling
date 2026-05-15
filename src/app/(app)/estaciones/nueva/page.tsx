import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { NuevasEstacionesForm } from "@/components/estaciones/NuevasEstacionesForm";

export default async function NuevaEstacionPage({
  searchParams,
}: {
  searchParams: Promise<{ campaignId?: string; projectId?: string }>;
}) {
  const { campaignId, projectId } = await searchParams;

  if (!campaignId || !projectId) notFound();

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      name: true,
      surveyType: true,
      projectId: true,
      project: { select: { name: true } },
    },
  });

  if (!campaign || campaign.projectId !== projectId) notFound();

  const stationType = campaign.surveyType === "FLORA" ? "PARCELA" : "TRANSECTO";
  const prefix = campaign.surveyType === "FLORA" ? "P" : "T";
  const regex = new RegExp(`^${prefix}(\\d+)$`);

  const existingStations = await prisma.station.findMany({
    where: { campaignId },
    select: { name: true },
  });

  let maxNum = 0;
  for (const s of existingStations) {
    const match = s.name.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  const nextNumber = maxNum + 1;

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href={`/estaciones?projectId=${projectId}&campaignId=${campaignId}`}
          className="text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Nuevas {stationType === "PARCELA" ? "Parcelas" : "Transectos"}
          </h1>
          <p className="text-sm text-gray-500">{campaign.name}</p>
        </div>
      </div>

      <NuevasEstacionesForm
        campaignId={campaignId}
        projectId={projectId}
        surveyType={campaign.surveyType as "FLORA" | "FAUNA"}
        nextNumber={nextNumber}
        campaignName={campaign.name}
      />
    </div>
  );
}
