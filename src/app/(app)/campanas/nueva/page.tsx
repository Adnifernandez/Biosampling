import { prisma } from "@/lib/prisma";
import { NuevaCampanaForm } from "@/components/campanas/NuevaCampanaForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function NuevaCampanaPage() {
  const projects = await prisma.project.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="max-w-lg space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/campanas" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Nueva Campaña</h1>
      </div>
      <NuevaCampanaForm projects={projects} />
    </div>
  );
}
