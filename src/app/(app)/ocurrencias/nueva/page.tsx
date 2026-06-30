import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { OccurrenceForm } from "@/components/ocurrencias/OccurrenceForm";

export default async function NuevaOcurrenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const { stationId } = await searchParams;
  if (!stationId) notFound();

  const station = await prisma.station.findUnique({
    where: { id: stationId },
    include: {
      campaign: {
        select: { id: true, name: true, surveyType: true, methodology: true, projectId: true, shermanTrapCount: true, cameraTrapCount: true },
      },
    },
  });
  if (!station) notFound();

  const isGrilla = station.campaign.methodology === "GRILLA";
  const isBB = station.campaign.methodology === "BRAUN_BLANQUET";
  const isTransectoFauna = station.campaign.methodology === "TRANSECTO_LINEAL_FAUNA";

  const [transectoStation, bbOccurrences, transectoOccurrences, rawCampaignSpecies] = await Promise.all([
    isGrilla && station.parentId
      ? prisma.station.findUnique({
          where: { id: station.parentId },
          select: { id: true, latitude: true, longitude: true },
        })
      : Promise.resolve(null),
    isBB
      ? prisma.occurrence.findMany({ where: { stationId }, select: { speciesId: true } })
      : Promise.resolve([]),
    isTransectoFauna
      ? prisma.occurrence.findMany({ where: { stationId }, select: { id: true, speciesId: true, abundance: true } })
      : Promise.resolve([]),
    prisma.occurrence.findMany({
      where: { station: { campaignId: station.campaignId } },
      select: {
        speciesId: true,
        species: { select: { id: true, genus: true, species: true, commonName: true, family: true, conservationStatus: true } },
      },
    }),
  ]);

  // Deduplicate and sort by frequency across the campaign
  const speciesCountMap = new Map<string, { sp: typeof rawCampaignSpecies[0]["species"]; count: number }>();
  for (const r of rawCampaignSpecies) {
    const existing = speciesCountMap.get(r.speciesId);
    if (existing) existing.count++;
    else speciesCountMap.set(r.speciesId, { sp: r.species, count: 1 });
  }
  const campaignSpecies = [...speciesCountMap.values()]
    .sort((a, b) => b.count - a.count)
    .map((v) => v.sp);

  const existingBBSpeciesIds = bbOccurrences.map(o => o.speciesId);
  const existingTransectoRegistrations = transectoOccurrences.map(o => ({
    speciesId: o.speciesId,
    abundance: o.abundance != null ? String(o.abundance) : undefined,
    key: o.id,
  }));

  async function adjustTransectoAbundance(key: string, newAbundance: string) {
    "use server";
    await prisma.occurrence.update({
      where: { id: key },
      data: { abundance: newAbundance ? parseInt(newAbundance) : null },
    });
    revalidatePath("/ocurrencias");
  }

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href={`/ocurrencias?projectId=${station.campaign.projectId}&campaignId=${station.campaignId}&stationId=${stationId}`}
          className="text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nueva Ocurrencia</h1>
          <p className="text-sm text-gray-500">{station.name} · {station.campaign.name}</p>
        </div>
      </div>

      <OccurrenceForm
        projectId={station.campaign.projectId}
        campaignId={station.campaignId}
        stationId={stationId}
        surveyType={station.campaign.surveyType as "FLORA" | "FAUNA"}
        methodology={station.campaign.methodology}
        transectoId={transectoStation?.id ?? undefined}
        transectoCoords={transectoStation ? { latitude: transectoStation.latitude, longitude: transectoStation.longitude } : undefined}
        shermanTrapCount={station.campaign.shermanTrapCount ?? 0}
        cameraTrapCount={station.campaign.cameraTrapCount ?? 0}
        existingBBSpeciesIds={existingBBSpeciesIds.length > 0 ? existingBBSpeciesIds : undefined}
        existingRegistrations={existingTransectoRegistrations.length > 0 ? existingTransectoRegistrations : undefined}
        onAdjustAbundance={existingTransectoRegistrations.length > 0 ? adjustTransectoAbundance : undefined}
        campaignSpecies={campaignSpecies.length > 0 ? campaignSpecies : undefined}
      />
    </div>
  );
}
