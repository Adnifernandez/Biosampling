import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportesClient } from "@/components/reportes/ReportesClient";

export default async function ReportesPage() {
  const projects = await prisma.project.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      region: true,
      commune: true,
      campaigns: {
        select: {
          id: true,
          name: true,
          surveyType: true,
          methodology: true,
          startDate: true,
          endDate: true,
          responsible: true,
          notes: true,
        },
      },
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Reportes</h1>
        <p className="text-sm text-gray-500">Resumen de datos por proyecto y campaña</p>
      </div>
      <ReportesClient projects={projects} />
    </div>
  );
}
