import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderOpen, Layers, MapPin, FileText } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();

  const [proyectos, campanas, estaciones, ocurrencias] = await Promise.all([
    prisma.project.count({ where: { status: "ACTIVE" } }),
    prisma.campaign.count({ where: { status: "ACTIVE" } }),
    prisma.station.count(),
    prisma.occurrence.count(),
  ]);

  const recentProjects = await prisma.project.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { campaigns: { select: { id: true } } },
  });

  const stats = [
    { label: "Proyectos activos", value: proyectos, icon: FolderOpen, href: "/proyectos", color: "text-green-600" },
    { label: "Campañas activas", value: campanas, icon: Layers, href: "/proyectos", color: "text-blue-600" },
    { label: "Estaciones", value: estaciones, icon: MapPin, href: "/proyectos", color: "text-orange-600" },
    { label: "Ocurrencias", value: ocurrencias, icon: FileText, href: "/reportes", color: "text-purple-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Hola, {session?.user?.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">Resumen de actividad en campo</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-700">
            {new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <p className="text-xs text-gray-400">
            {new Date().toLocaleDateString("es-CL", { year: "numeric" })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(({ label, value, icon: Icon, href, color }) => (
          <Link key={label} href={href}>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-500 leading-tight">{label}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
                  </div>
                  <Icon className={`h-5 w-5 ${color} mt-0.5`} />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">Proyectos recientes</h2>
          <Link href="/proyectos" className="text-sm text-green-700 hover:underline">
            Ver todos
          </Link>
        </div>
        {recentProjects.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-400">
              <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>No hay proyectos todavía.</p>
              <Link href="/proyectos/nuevo" className="text-sm text-green-700 hover:underline mt-1 block">
                Crear primer proyecto
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentProjects.map((p) => (
              <Link key={p.id} href={`/proyectos/${p.id}`}>
                <Card className="hover:shadow-sm transition-shadow">
                  <CardContent className="py-3 px-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.region} · {p.commune}</p>
                    </div>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {p.campaigns.length} campaña{p.campaigns.length !== 1 ? "s" : ""}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
