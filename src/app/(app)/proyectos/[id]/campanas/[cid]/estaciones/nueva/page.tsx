import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { NuevasEstacionesForm } from "@/components/estaciones/NuevasEstacionesForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function NuevaEstacionPage({ params }: { params: Promise<{ id: string; cid: string }> }) {
  const { id, cid } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id: cid },
    select: { id: true, name: true, surveyType: true, projectId: true },
  });
  if (!campaign || campaign.projectId !== id) notFound();

  const prefix = campaign.surveyType === "FLORA" ? "P" : "T";
  const existing = await prisma.station.findMany({
    where: { campaignId: cid },
    select: { name: true },
  });
  const maxNum = existing.reduce((max, s) => {
    const m = s.name.match(new RegExp(`^${prefix}(\\d+)$`));
    return m ? Math.max(max, parseInt(m[1])) : max;
  }, 0);

  return (
    <div className="max-w-lg space-y-5">
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
      <NuevasEstacionesForm
        campaignId={cid}
        projectId={id}
        surveyType={campaign.surveyType as "FLORA" | "FAUNA"}
        nextNumber={maxNum + 1}
        campaignName={campaign.name}
      />
    </div>
  );
}
