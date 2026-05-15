import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { StationForm } from "@/components/estaciones/StationForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function NuevaEstacionPage({ params }: { params: Promise<{ id: string; cid: string }> }) {
  const { id, cid } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id: cid },
    select: { id: true, name: true, surveyType: true, projectId: true },
  });
  if (!campaign || campaign.projectId !== id) notFound();

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-center gap-2">
        <Link href={`/proyectos/${id}/campanas/${cid}`} className="text-gray-400 hover:text-gray-600">
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
        projectId={id}
        campaignId={cid}
        surveyType={campaign.surveyType as "FLORA" | "FAUNA"}
      />
    </div>
  );
}
