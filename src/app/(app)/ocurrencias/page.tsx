import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button-link";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, ClipboardList, Pencil, MapPin } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { OcurrenciasFiltro } from "@/components/ocurrencias/OcurrenciasFiltro";
import { DeleteOccurrenceButton } from "@/components/ocurrencias/DeleteOccurrenceButton";
import { DeleteGrillaButton } from "@/components/ocurrencias/DeleteGrillaButton";

type OccurrenceRow = {
  id: string;
  date: Date;
  abundance: number | null;
  cover: number | null;
  methodologyData: string | null;
  individualCode: string | null;
  species: { genus: string; species: string; commonName: string | null };
  user: { name: string };
  station: { name: string; campaign: { methodology: string } };
  relocation: { id: string } | null;
};

export default async function OcurrenciasPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; campaignId?: string; stationId?: string; transectoId?: string }>;
}) {
  const { projectId, campaignId, stationId, transectoId } = await searchParams;

  // All queries start simultaneously — no sequential waiting
  const [projects, campaigns, stations, occurrences] = await Promise.all([
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    projectId
      ? prisma.campaign.findMany({
          where: { projectId },
          orderBy: { name: "asc" },
          select: { id: true, name: true, surveyType: true, methodology: true },
        })
      : ([] as { id: string; name: string; surveyType: string; methodology: string | null }[]),
    campaignId
      ? prisma.station.findMany({
          where: { campaignId, parentId: null },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : ([] as { id: string; name: string }[]),
    stationId
      ? prisma.occurrence.findMany({
          where: { stationId },
          orderBy: { date: "desc" },
          select: {
            id: true,
            date: true,
            abundance: true,
            cover: true,
            methodologyData: true,
            individualCode: true,
            species: { select: { genus: true, species: true, commonName: true } },
            user: { select: { name: true } },
            station: { select: { name: true, campaign: { select: { methodology: true } } } },
            relocation: { select: { id: true } },
          },
        })
      : ([] as OccurrenceRow[]),
  ]);

  const selectedCampaign = campaignId ? campaigns.find((c) => c.id === campaignId) : null;
  const isGrillaCampaign = selectedCampaign?.methodology === "GRILLA";

  // For GRILLA: load child grilla stations for the selected transecto
  const grillaStations = isGrillaCampaign && transectoId
    ? await prisma.station.findMany({
        where: { parentId: transectoId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];

  const selectedStation = stationId
    ? (isGrillaCampaign ? grillaStations : stations).find((s) => s.id === stationId)
    : null;

  // Pre-compute GRILLA summary (all occurrences = one session)
  const grillaSummary = isGrillaCampaign && stationId && occurrences.length > 0
    ? (() => {
        const totalSpeciesPoints = occurrences.reduce((s, o) => s + (o.abundance ?? 0), 0);
        const sinVeg = Math.max(0, 16 - totalSpeciesPoints);
        const sorted = [...occurrences].sort((a, b) =>
          `${a.species.genus} ${a.species.species}`.localeCompare(`${b.species.genus} ${b.species.species}`)
        );
        return { sorted, sinVeg, date: occurrences[0].date, user: occurrences[0].user.name, firstId: occurrences[0].id };
      })()
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ocurrencias</h1>
          {stationId && selectedStation && (
            <p className="text-sm text-gray-500">{selectedStation.name}</p>
          )}
        </div>
        {/* Nueva button: hide for GRILLA when data already exists */}
        {stationId && !(isGrillaCampaign && occurrences.length > 0) && (
          <ButtonLink
            href={`/ocurrencias/nueva?stationId=${stationId}`}
            size="sm"
            className="bg-green-700 hover:bg-green-800 text-white"
          >
            <Plus className="h-4 w-4 mr-1" />
            Nueva
          </ButtonLink>
        )}
      </div>

      <OcurrenciasFiltro
        projects={projects}
        campaigns={campaigns}
        stations={stations}
        grillaStations={grillaStations}
        selectedProjectId={projectId ?? ""}
        selectedCampaignId={campaignId ?? ""}
        selectedTransectoId={transectoId}
        selectedStationId={stationId ?? ""}
      />

      {!stationId ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">Selecciona una estación</p>
            <p className="text-sm text-gray-400 mt-1">Filtra por proyecto, campaña y estación para ver las ocurrencias</p>
          </CardContent>
        </Card>
      ) : occurrences.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">No hay ocurrencias registradas</p>
            <ButtonLink
              href={`/ocurrencias/nueva?stationId=${stationId}`}
              size="sm"
              className="mt-4 inline-flex bg-green-700 hover:bg-green-800 text-white"
            >
              <Plus className="h-4 w-4 mr-1" /> Registrar
            </ButtonLink>
          </CardContent>
        </Card>

      ) : grillaSummary ? (
        /* ── GRILLA: single session card ── */
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {grillaSummary.sorted.length} especie{grillaSummary.sorted.length !== 1 ? "s" : ""} registrada{grillaSummary.sorted.length !== 1 ? "s" : ""}
                  {grillaSummary.sinVeg > 0 && (
                    <span className="text-gray-400"> · {grillaSummary.sinVeg} sin vegetación</span>
                  )}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {format(new Date(grillaSummary.date), "d MMM yyyy", { locale: es })} · {grillaSummary.user}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Link
                  href={`/ocurrencias/${grillaSummary.firstId}/editar?stationId=${stationId}`}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Link>
                <DeleteGrillaButton
                  projectId={projectId ?? ""}
                  campaignId={campaignId ?? ""}
                  stationId={stationId}
                  transectoId={transectoId}
                />
              </div>
            </div>
          </CardContent>
        </Card>

      ) : (
        /* ── Non-GRILLA: individual occurrence cards ── */
        <div className="space-y-2">
          {occurrences.map((o) => {
            const isRescate = o.station.campaign.methodology === "RESCATE_TRANSECTO" || o.station.campaign.methodology === "RESCATE_MICRORUTEO";
            return (
              <Card key={o.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 italic">
                        {o.species.genus} {o.species.species}
                      </p>
                      {o.species.commonName && (
                        <p className="text-xs text-gray-500">{o.species.commonName}</p>
                      )}
                      {o.individualCode && (
                        <p className="text-xs font-mono text-orange-600 font-semibold mt-0.5">{o.individualCode}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">{o.user.name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        {o.abundance != null && (
                          <p className="text-sm font-semibold text-gray-700">{o.abundance} ind.</p>
                        )}
                        {o.cover != null && (
                          <p className="text-sm font-semibold text-gray-700">{o.cover}%</p>
                        )}
                        <p className="text-xs text-gray-400">
                          {format(new Date(o.date), "d MMM yyyy", { locale: es })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {isRescate && (
                          <Link
                            href={`/ocurrencias/${o.id}/relocalizacion?stationId=${stationId}`}
                            className={`inline-flex items-center justify-center h-8 w-8 rounded-md border transition-colors ${
                              o.relocation
                                ? "border-orange-300 bg-orange-50 text-orange-600 hover:bg-orange-100"
                                : "border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-600"
                            }`}
                            title={o.relocation ? "Ver relocalización" : "Relocalizar"}
                          >
                            <MapPin className="h-3.5 w-3.5" />
                          </Link>
                        )}
                        <Link
                          href={`/ocurrencias/${o.id}/editar?stationId=${stationId}`}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                        <DeleteOccurrenceButton
                          projectId={projectId ?? ""}
                          campaignId={campaignId ?? ""}
                          stationId={stationId ?? ""}
                          occurrenceId={o.id}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
