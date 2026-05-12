import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ProjectForm } from "@/components/proyectos/ProjectForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function EditarProyectoPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) notFound();

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-center gap-2">
        <Link href={`/proyectos/${project.id}`} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Editar Proyecto</h1>
          <p className="text-sm text-gray-500">{project.name}</p>
        </div>
      </div>
      <ProjectForm
        projectId={project.id}
        defaultValues={{
          name: project.name,
          region: project.region,
          commune: project.commune,
          responsible: project.responsible,
          description: project.description ?? "",
        }}
      />
    </div>
  );
}
