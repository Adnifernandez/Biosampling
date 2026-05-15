import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button-link";
import { ArrowLeft, CalendarDays, Pencil, Layers } from "lucide-react";
import { SURVEY_TYPE_LABELS, CAMPAIGN_STATUS_LABELS, type SurveyType, type CampaignStatus } from "@/lib/types";
import { METHODOLOGIES } from "@/lib/methodologies";
import { DeleteCampaignButton } from "@/components/campanas/DeleteCampaignButton";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default async function CampanaDetailPage({
  params,
}: {
  params: Promise<{ cid: string }>;
}) {
  const { cid } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id: cid },
    include: {
      project: { select: { id: true, name: true } },
    },
  });
  if (!campaign) notFound();

  const methodology = METHODOLOGIES.find((m) => m.id === campaign.methodology);

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Link href="/campanas" className="text-gray-400 hover:text-gray-600 mt-1">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="text-xs text-gray-500">{campaign.project.name}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{campaign.name}</h1>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                campaign.surveyType === "FLORA" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
              }`}>
                {SURVEY_TYPE_LABELS[campaign.surveyType as SurveyType]}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                campaign.status === "ACTIVE" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"
              }`}>
                {CAMPAIGN_STATUS_LABELS[campaign.status as CampaignStatus]}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" /> {methodology?.name ?? campaign.methodology}
              </span>
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {format(new Date(campaign.startDate), "d MMM yyyy", { locale: es })} –{" "}
                {format(new Date(campaign.endDate), "d MMM yyyy", { locale: es })}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <ButtonLink href={`/campanas/${campaign.id}/editar`} variant="outline" size="sm">
            <Pencil className="h-4 w-4" />
          </ButtonLink>
          <DeleteCampaignButton projectId={campaign.project.id} campaignId={campaign.id} />
        </div>
      </div>

      {campaign.notes && (
        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3">{campaign.notes}</p>
      )}
    </div>
  );
}
