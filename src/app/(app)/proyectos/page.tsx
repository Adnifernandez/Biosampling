import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ButtonLink } from "@/components/ui/button-link";
import { Plus } from "lucide-react";
import { ProjectsListClient } from "@/components/proyectos/ProjectsListClient";

export default async function ProyectosPage() {
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Proyectos</h1>
          <p className="text-sm text-gray-500">{projects.length} proyecto{projects.length !== 1 ? "s" : ""}</p>
        </div>
        <ButtonLink href="/proyectos/nuevo" size="sm" className="bg-teal-700 hover:bg-teal-800 text-white">
          <Plus className="h-4 w-4 mr-1" />
          Nuevo
        </ButtonLink>
      </div>

      <ProjectsListClient projects={projects} isAdmin={isAdmin} />
    </div>
  );
}
