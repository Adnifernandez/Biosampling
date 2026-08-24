import { prisma } from "@/lib/prisma";
import { NuevaCampanaForm } from "@/components/campanas/NuevaCampanaForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function NuevaCampanaPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;

  const [projects, preselectedProject] = await Promise.all([
    prisma.project.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    projectId
      ? prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true } })
      : null,
  ]);

  return (
    <div className="max-w-lg space-y-5">
      <div className="flex items-center gap-2">
        <Link href={projectId ? `/campanas?projectId=${projectId}` : "/campanas"} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Nueva Campaña</h1>
      </div>
      <NuevaCampanaForm projects={projects} preselectedProject={preselectedProject ?? undefined} />
    </div>
  );
}
