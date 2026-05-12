import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { CampaignForm } from "@/components/campanas/CampaignForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

export default async function EditarCampanaPage({ params }: { params: { id: string; cid: string } }) {
  const campaign = await prisma.campaign.findUnique({ where: { id: params.cid } });
  if (!campaign || campaign.projectId !== params.id) notFound();

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-center gap-2">
        <Link href={`/proyectos/${params.id}/campanas/${params.cid}`} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Editar Campaña</h1>
          <p className="text-sm text-gray-500">{campaign.name}</p>
        </div>
      </div>
      <CampaignForm
        projectId={params.id}
        campaignId={campaign.id}
        defaultValues={{
          name: campaign.name,
          surveyType: campaign.surveyType as "FLORA" | "FAUNA",
          methodology: campaign.methodology,
          startDate: format(new Date(campaign.startDate), "yyyy-MM-dd"),
          endDate: format(new Date(campaign.endDate), "yyyy-MM-dd"),
          notes: campaign.notes ?? "",
        }}
      />
    </div>
  );
}
