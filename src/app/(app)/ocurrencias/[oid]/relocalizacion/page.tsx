import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { RelocationForm } from "@/components/ocurrencias/RelocationForm";

export default async function RelocalizacionPage({
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
      relocation: true,
      station: {
        include: {
          campaign: { select: { id: true, projectId: true, name: true, methodology: true } },
        },
      },
    },
  });

  if (!occurrence) notFound();

  const { id: campaignId, projectId, name: campaignName } = occurrence.station.campaign;
  const backHref = stationId
    ? `/ocurrencias?projectId=${projectId}&campaignId=${campaignId}&stationId=${stationId}`
    : `/ocurrencias?projectId=${projectId}&campaignId=${campaignId}`;

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-center gap-2">
        <Link href={backHref} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Relocalización</h1>
          <p className="text-sm text-gray-500">{occurrence.station.name} · {campaignName}</p>
        </div>
      </div>

      <RelocationForm
        projectId={projectId}
        campaignId={campaignId}
        stationId={occurrence.stationId}
        occurrenceId={oid}
        species={occurrence.species}
        individualCode={occurrence.individualCode ?? ""}
        existingRelocation={occurrence.relocation
          ? {
              latitude: occurrence.relocation.latitude,
              longitude: occurrence.relocation.longitude,
              notes: occurrence.relocation.notes,
            }
          : null}
        backHref={backHref}
      />
    </div>
  );
}
