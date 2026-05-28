import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { NuevaCampanaForm } from "@/components/campanas/NuevaCampanaForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

export default async function EditarCampanaPage({ params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id: cid },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!campaign) notFound();

  return (
    <div className="max-w-lg space-y-5">
      <div className="flex items-center gap-2">
        <Link href={`/campanas/${cid}`} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Editar Campaña</h1>
          <p className="text-sm text-gray-500">{campaign.name}</p>
        </div>
      </div>
      <NuevaCampanaForm
        projects={[]}
        preselectedProject={campaign.project}
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
