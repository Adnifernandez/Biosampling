import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { OccurrenceForm } from "@/components/ocurrencias/OccurrenceForm";
import { format } from "date-fns";

export default async function EditarOcurrenciaPage({
  params,
  searchParams,
}: {
  params: Promise<{ oid: string }>;
  searchParams: Promise<{ stationId?: string }>;
}) {
  const { oid } = await params;
  const { stationId } = await searchParams;

  const occurrence = await prisma.occurrence.findUnique({
    where: { id: oid },
    include: {
      species: { select: { genus: true, species: true, commonName: true } },
      station: {
        include: {
          campaign: {
            select: { id: true, name: true, surveyType: true, methodology: true, projectId: true },
          },
        },
      },
    },
  });
  if (!occurrence) notFound();

  const isGrilla = occurrence.station.campaign.methodology === "GRILLA";

  // For GRILLA: load all occurrences for this grilla station to pre-populate the grid
  const grillaOccurrences = isGrilla
    ? await prisma.occurrence.findMany({
        where: { stationId: occurrence.stationId },
        include: { species: { select: { genus: true, species: true, commonName: true } } },
      })
    : [];

  // For GRILLA: get the parent transecto id and its coordinates
  const parentId = isGrilla ? (occurrence.station.parentId ?? null) : null;
  const transectoStation = isGrilla && parentId
    ? await prisma.station.findUnique({
        where: { id: parentId },
        select: { latitude: true, longitude: true },
      })
    : null;

  const defaultValues: Record<string, string> = {
    speciesId: occurrence.speciesId,
    speciesLabel: `${occurrence.species.genus} ${occurrence.species.species}${occurrence.species.commonName ? ` · ${occurrence.species.commonName}` : ""}`,
    date: format(new Date(occurrence.date), "yyyy-MM-dd"),
    latitude: occurrence.latitude?.toString() ?? "",
    longitude: occurrence.longitude?.toString() ?? "",
    abundance: occurrence.abundance?.toString() ?? "",
    cover: occurrence.cover?.toString() ?? "",
    height: occurrence.height?.toString() ?? "",
    stratum: occurrence.stratum ?? "",
    phenology: occurrence.phenology ?? "",
    distance: occurrence.distance?.toString() ?? "",
    bearing: occurrence.bearing?.toString() ?? "",
    groupSize: occurrence.groupSize?.toString() ?? "",
    behavior: occurrence.behavior ?? "",
    detectionMethod: occurrence.detectionMethod ?? "",
    notes: occurrence.notes ?? "",
    methodologyData: occurrence.methodologyData ?? "",
  };

  const { projectId: pid, id: cid } = occurrence.station.campaign;
  const backHref = isGrilla && parentId
    ? `/ocurrencias?projectId=${pid}&campaignId=${cid}&transectoId=${parentId}&stationId=${occurrence.stationId}`
    : `/ocurrencias?projectId=${pid}&campaignId=${cid}&stationId=${occurrence.stationId}`;

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-center gap-2">
        <Link href={backHref} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Editar Ocurrencia</h1>
          <p className="text-sm text-gray-500">{occurrence.station.name} · {occurrence.station.campaign.name}</p>
        </div>
      </div>

      <OccurrenceForm
        projectId={pid}
        campaignId={cid}
        stationId={occurrence.stationId}
        surveyType={occurrence.station.campaign.surveyType as "FLORA" | "FAUNA" | "RESCATE"}
        methodology={occurrence.station.campaign.methodology}
        occurrenceId={oid}
        defaultValues={defaultValues}
        grillaOccurrences={grillaOccurrences.map((o) => ({
          speciesId: o.speciesId,
          abundance: o.abundance ?? 0,
          label: `${o.species.genus} ${o.species.species}${o.species.commonName ? ` · ${o.species.commonName}` : ""}`,
          individuos: o.groupSize ?? undefined,
        }))}
        transectoId={parentId ?? undefined}
        transectoCoords={transectoStation ? { latitude: transectoStation.latitude, longitude: transectoStation.longitude } : undefined}
      />
    </div>
  );
}
