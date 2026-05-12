import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { CampaignForm } from "@/components/campanas/CampaignForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function NuevaCampanaPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id }, select: { id: true, name: true } });
  if (!project) notFound();

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-center gap-2">
        <Link href={`/proyectos/${project.id}`} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nueva Campaña</h1>
          <p className="text-sm text-gray-500">{project.name}</p>
        </div>
      </div>
      <CampaignForm projectId={project.id} />
    </div>
  );
}
