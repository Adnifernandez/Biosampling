import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button-link";
import { ArrowLeft, MapPin, User, Pencil } from "lucide-react";
import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/types";
import { REGIONS } from "@/lib/chile-data";
import { DeleteProjectButton } from "@/components/proyectos/DeleteProjectButton";

export default async function ProyectoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) notFound();

  const region = REGIONS.find((r) => r.id === project.region);

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Link href="/proyectos" className="text-gray-400 hover:text-gray-600 mt-1">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                project.status === "ACTIVE" ? "bg-green-100 text-green-800" :
                project.status === "COMPLETED" ? "bg-blue-100 text-blue-800" :
                "bg-gray-100 text-gray-600"
              }`}>
                {PROJECT_STATUS_LABELS[project.status as ProjectStatus]}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {region?.name ?? project.region} · {project.commune}
              </span>
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" /> {project.responsible}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <ButtonLink href={`/proyectos/${project.id}/editar`} variant="outline" size="sm">
            <Pencil className="h-4 w-4" />
          </ButtonLink>
          <DeleteProjectButton id={project.id} />
        </div>
      </div>

      {project.description && (
        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3">{project.description}</p>
      )}
    </div>
  );
}
