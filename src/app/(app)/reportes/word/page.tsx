import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ReporteWordClient } from "@/components/reportes/ReporteWordClient";

export default async function ReporteWordPage({
  searchParams,
}: {
  searchParams: Promise<{ proyecto?: string; campana?: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/reportes");

  const { proyecto, campana } = await searchParams;

  const projects = await prisma.project.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      region: true,
      campaigns: {
        orderBy: { startDate: "desc" },
        select: { id: true, name: true, surveyType: true, methodology: true, startDate: true },
      },
    },
  });

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Reporte Word</h1>
        <p className="text-sm text-gray-500">
          Completa lo que la app no guarda; el resto se llena con los datos de terreno.
        </p>
      </div>
      <ReporteWordClient
        projects={projects}
        initialProjectId={proyecto ?? ""}
        initialCampaignId={campana ?? ""}
      />
    </div>
  );
}
