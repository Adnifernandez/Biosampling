import { ProjectForm } from "@/components/proyectos/ProjectForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NuevoProyectoPage() {
  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/proyectos" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nuevo Proyecto</h1>
          <p className="text-sm text-gray-500">Completa los datos del proyecto</p>
        </div>
      </div>
      <ProjectForm />
    </div>
  );
}
