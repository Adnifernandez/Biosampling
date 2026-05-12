import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { StationForm } from "@/components/estaciones/StationForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function NuevaEstacionPage({ params }: { params: { id: string; cid: string } }) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: params.cid },
    select: { id: true, name: true, surveyType: true, projectId: true },
  });
  if (!campaign || campaign.projectId !== params.id) notFound();

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-center gap-2">
        <Link href={`/proyectos/${params.id}/campanas/${params.cid}`} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Nueva {campaign.surveyType === "FLORA" ? "Parcela" : "Transecto"}
          </h1>
          <p className="text-sm text-gray-500">{campaign.name}</p>
        </div>
      </div>
      <StationForm
        projectId={params.id}
        campaignId={params.cid}
        surveyType={campaign.surveyType as "FLORA" | "FAUNA"}
      />
    </div>
  );
}
