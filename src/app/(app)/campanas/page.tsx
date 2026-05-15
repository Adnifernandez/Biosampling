import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button-link";
import { Card, CardContent } from "@/components/ui/card";
import { Layers, Plus, Leaf, Bird } from "lucide-react";
import { CAMPAIGN_STATUS_LABELS, type CampaignStatus } from "@/lib/types";
import { CampanasFilter } from "@/components/campanas/CampanasFilter";

export default async function CampanasPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;

  const [projects, campaigns] = await Promise.all([
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.campaign.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { id: true, name: true } },
        stations: { select: { id: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campañas</h1>
          <p className="text-gray-500 text-sm mt-0.5">{campaigns.length} campaña{campaigns.length !== 1 ? "s" : ""}</p>
        </div>
        <ButtonLink href="/campanas/nueva" className="bg-green-700 hover:bg-green-800 text-white gap-2">
          <Plus className="h-4 w-4" /> Nueva
        </ButtonLink>
      </div>

      <CampanasFilter projects={projects} selectedProjectId={projectId ?? ""} />

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <Layers className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>{projectId ? "No hay campañas en este proyecto." : "No hay campañas todavía."}</p>
            <ButtonLink href="/campanas/nueva" size="sm" className="mt-3 inline-flex bg-green-700 hover:bg-green-800 text-white">
              <Plus className="h-4 w-4 mr-1" /> Crear campaña
            </ButtonLink>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c) => (
            <Link key={c.id} href={`/proyectos/${c.project.id}/campanas/${c.id}`}>
              <Card className="hover:shadow-sm transition-shadow">
                <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${c.surveyType === "FLORA" ? "bg-green-100" : "bg-blue-100"}`}>
                      {c.surveyType === "FLORA"
                        ? <Leaf className="h-4 w-4 text-green-700" />
                        : <Bird className="h-4 w-4 text-blue-700" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-500 truncate">{c.project.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-400 hidden sm:block">
                      {c.stations.length} estación{c.stations.length !== 1 ? "es" : ""}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      c.status === "ACTIVE" ? "bg-yellow-100 text-yellow-700" :
                      c.status === "COMPLETED" ? "bg-gray-100 text-gray-600" : "bg-red-100 text-red-700"
                    }`}>
                      {CAMPAIGN_STATUS_LABELS[c.status as CampaignStatus]}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
