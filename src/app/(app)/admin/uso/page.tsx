import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { UsoClient } from "@/components/admin/UsoClient";

export default async function UsoPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/proyectos");

  const [users, projects, campaigns, occurrences] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, email: true, active: true },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      select: { id: true, name: true, createdBy: true },
      orderBy: { name: "asc" },
    }),
    prisma.campaign.findMany({
      select: {
        id: true,
        name: true,
        projectId: true,
        responsible: true,
        status: true,
        startDate: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.occurrence.findMany({
      select: {
        id: true,
        userId: true,
        date: true,
        createdAt: true,
        station: { select: { campaign: { select: { id: true, projectId: true } } } },
      },
    }),
  ]);

  const records = occurrences.map((o) => ({
    id: o.id,
    userId: o.userId,
    campaignId: o.station.campaign.id,
    projectId: o.station.campaign.projectId,
    date: o.date,
    createdAt: o.createdAt,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Uso de la App</h1>
        <p className="text-sm text-gray-500">Seguimiento de actividad por proyecto, campaña y usuario</p>
      </div>
      <UsoClient users={users} projects={projects} campaigns={campaigns} records={records} />
    </div>
  );
}
