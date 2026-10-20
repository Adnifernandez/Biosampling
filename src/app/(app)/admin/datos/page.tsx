import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DatosClient, type DatosPayload } from "@/components/admin/DatosClient";

// Strategic view of the database (admins). Occurrences are pre-aggregated in SQL
// by réplica × species × month, so the page stays light with many thousands of records.
export default async function DatosPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/proyectos");

  const [projects, campaigns, stations, agg] = await Promise.all([
    prisma.project.findMany({
      select: { id: true, name: true, region: true, commune: true, status: true },
      orderBy: { name: "asc" },
    }),
    prisma.campaign.findMany({
      select: {
        id: true, name: true, projectId: true, surveyType: true, methodology: true,
        status: true, startDate: true, endDate: true,
      },
      orderBy: { startDate: "desc" },
    }),
    prisma.station.findMany({ select: { id: true, campaignId: true, parentId: true } }),
    prisma.$queryRaw<{ stationId: string; speciesId: string; month: string; n: number; ab: number }[]>`
      SELECT o."stationId" AS "stationId",
             o."speciesId" AS "speciesId",
             to_char(o."date", 'YYYY-MM') AS month,
             COUNT(*)::int AS n,
             COALESCE(SUM(o."abundance"), 0)::int AS ab
      FROM "Occurrence" o
      GROUP BY 1, 2, 3
    `,
  ]);

  const speciesIds = [...new Set(agg.map(r => r.speciesId))];
  const species = await prisma.species.findMany({
    where: { id: { in: speciesIds } },
    select: {
      id: true, genus: true, species: true, commonName: true, family: true, type: true,
      conservationStatus: true, origen: true, clase: true, orden: true,
    },
  });

  // Compact payload: rows reference projects/campaigns/stations/species by index
  const campaignIdx = new Map(campaigns.map((c, i) => [c.id, i]));
  const stationById = new Map(stations.map(s => [s.id, s]));
  const stationIdx = new Map<string, number>();
  const stationList: { c: number; r: number }[] = [];   // campaign index, réplica index
  const replicaIdx = new Map<string, number>();
  const speciesIdx = new Map(species.map((s, i) => [s.id, i]));

  function stationRef(id: string): number | null {
    if (stationIdx.has(id)) return stationIdx.get(id)!;
    const st = stationById.get(id);
    if (!st) return null;
    const c = campaignIdx.get(st.campaignId);
    if (c === undefined) return null;
    // Grilla points are child stations; the réplica is the parent transect
    const replicaId = st.parentId ?? st.id;
    if (!replicaIdx.has(replicaId)) replicaIdx.set(replicaId, replicaIdx.size);
    stationList.push({ c, r: replicaIdx.get(replicaId)! });
    stationIdx.set(id, stationList.length - 1);
    return stationList.length - 1;
  }

  const rows: DatosPayload["rows"] = [];
  for (const r of agg) {
    const s = stationRef(r.stationId);
    const sp = speciesIdx.get(r.speciesId);
    if (s === null || sp === undefined) continue;
    rows.push([s, sp, r.month, r.n, r.ab]);
  }

  const payload: DatosPayload = {
    projects,
    campaigns: campaigns.map(c => ({
      ...c,
      projectIdx: projects.findIndex(p => p.id === c.projectId),
      startDate: c.startDate.toISOString().slice(0, 10),
      endDate: c.endDate.toISOString().slice(0, 10),
    })),
    stations: stationList,
    species: species.map(s => ({
      name: `${s.genus} ${s.species}`,
      commonName: s.commonName,
      family: s.family,
      type: s.type,
      conservation: s.conservationStatus,
      origen: s.origen,
      clase: s.clase,
    })),
    rows,
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Datos</h1>
        <p className="text-sm text-gray-500">Qué se ha registrado: proyectos, campañas, especies, flora y fauna</p>
      </div>
      <DatosClient data={payload} />
    </div>
  );
}
