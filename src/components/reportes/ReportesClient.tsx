"use client";

import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Download, BarChart2, ListTree, Leaf, Bird, Loader2, AlertTriangle, FileSpreadsheet } from "lucide-react";
// ExcelJS loaded dynamically inside exportXLSX to avoid SSR issues
import { SURVEY_TYPE_LABELS } from "@/lib/types";
import { getMethodologyById } from "@/lib/methodologies";
import { getCampaignStations } from "@/app/(app)/reportes/actions";
import { toast } from "sonner";

type SpeciesRow = {
  id: string;
  family: string;
  genus: string;
  species: string;
  commonName: string | null;
  type: string;
  conservationStatus: string | null;
  division: string | null;
  clase: string | null;
  orden: string | null;
  habito: string | null;
  origen: string | null;
  macrofitasHabito: string | null;
  category: string | null;
};

type OccurrenceRow = {
  id: string;
  date: Date | string;
  abundance: number | null;
  cover: number | null;
  groupSize: number | null;
  methodologyData: string | null;
  individualCode: string | null;
  detectionMethod: string | null;
  latitude: number | null;
  longitude: number | null;
  species: SpeciesRow;
  user: { name: string };
};

type StationRow = {
  id: string;
  name: string;
  occurrences: OccurrenceRow[];
  children: { id: string; name: string; occurrences: OccurrenceRow[] }[];
};

type CampaignRow = {
  id: string;
  name: string;
  surveyType: string;
  methodology: string;
  startDate: Date | string;
  endDate: Date | string;
  responsible: string | null;
  notes: string | null;
};

type ProjectRow = {
  id: string;
  name: string;
  region: string;
  commune: string;
  campaigns: CampaignRow[];
};

function fmtDateDMY(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// "TS3" → "TS-03" — matches the trap-code format the SAG banding report expects
function formatTrapLabel(trapId: string): string {
  const m = trapId.match(/^([A-Za-z]+)(\d+)$/);
  if (!m) return trapId || "—";
  return `${m[1]}-${m[2].padStart(2, "0")}`;
}

// Same projection used for Microruteo's GPS capture — reused here to turn a Sherman
// trap's lat/long into the UTM Este/Sur/Huso the SAG report requires.
function latLngToUTM(lat: number, lng: number): { north: number; east: number; zone: string } {
  const a = 6378137.0, f = 1 / 298.257223563;
  const b = a * (1 - f), e2 = 1 - (b * b) / (a * a), k0 = 0.9996;
  const zoneNum = Math.floor((lng + 180) / 6) + 1;
  const zone = `${zoneNum}${lat >= 0 ? "N" : "S"}`;
  const lr = (lat * Math.PI) / 180;
  const lo = (((zoneNum - 1) * 6 - 180 + 3) * Math.PI) / 180;
  const N = a / Math.sqrt(1 - e2 * Math.sin(lr) ** 2);
  const T = Math.tan(lr) ** 2, C = (e2 / (1 - e2)) * Math.cos(lr) ** 2;
  const A = Math.cos(lr) * ((lng * Math.PI) / 180 - lo);
  const M = a * ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * lr
    - ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * lr)
    + ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * lr)
    - ((35 * e2 ** 3) / 3072) * Math.sin(6 * lr));
  const east = k0 * N * (A + ((1 - T + C) * A ** 3) / 6 + ((5 - 18 * T + T ** 2 + 72 * C - 58 * (e2 / (1 - e2))) * A ** 5) / 120) + 500000;
  let north = k0 * (M + N * Math.tan(lr) * (A ** 2 / 2 + ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24 + ((61 - 58 * T + T ** 2 + 600 * C - 330 * (e2 / (1 - e2))) * A ** 6) / 720));
  if (lat < 0) north += 10000000;
  return { north: Math.round(north), east: Math.round(east), zone };
}

// Left-to-right alphabetical sort: División → Clase → Familia → Especie
function spSort(a: SpeciesRow, b: SpeciesRow): number {
  const d = (a.division || "").localeCompare(b.division || "", "es");
  if (d !== 0) return d;
  const c = (a.clase || "").localeCompare(b.clase || "", "es");
  if (c !== 0) return c;
  const f = (a.family || "").localeCompare(b.family || "", "es");
  if (f !== 0) return f;
  return `${a.genus} ${a.species}`.localeCompare(`${b.genus} ${b.species}`, "es");
}

function primaryStatus(raw: string | null): string {
  if (!raw) return "";
  const m = raw.match(/^(CR|EN|VU|NT|LC|DD|EW|EX|NE|NA)/i);
  return m ? m[1].toUpperCase() : raw;
}

// "VU (XV-XIV), NT (X-XII)" → each comma-separated entry kept intact, joined with " ; "
function allStatusesText(raw: string | null): string {
  if (!raw) return "";
  return raw.split(",").map((s) => s.trim()).filter(Boolean).join(" ; ");
}

function statusColor(code: string): string {
  return (
    code === "CR" ? "bg-red-100 text-red-700" :
    code === "EN" ? "bg-orange-100 text-orange-700" :
    code === "VU" ? "bg-yellow-100 text-yellow-700" :
    code === "NT" ? "bg-blue-50 text-blue-600" :
    code === "LC" ? "bg-gray-100 text-gray-500" :
    "bg-gray-100 text-gray-600"
  );
}

// Parse "VU (XV-XIV), NT (X-XII)" → one badge per comma-separated entry
function statusBadge(raw: string | null) {
  if (!raw) {
    return <span className="text-gray-300 text-xs">—</span>;
  }
  const entries = raw.split(",").map((s) => s.trim()).filter(Boolean).map((part) => {
    const m = part.match(/^(CR|EN|VU|NT|LC|DD|EW|EX|NE|NA)\b/i);
    return { code: m ? m[1].toUpperCase() : part, label: part };
  });
  return (
    <span className="inline-flex flex-wrap gap-0.5">
      {entries.map(({ code, label }, i) => (
        <span
          key={i}
          className={`text-xs px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${statusColor(code)}`}
          title={raw}
        >
          {label}
        </span>
      ))}
    </span>
  );
}

export function ReportesClient({ projects }: { projects: ProjectRow[] }) {
  const [projectId, setProjectId] = useState<string>("");
  const [campaignId, setCampaignId] = useState<string>("");
  const [stations, setStations] = useState<StationRow[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);
  const [shermanDialogOpen, setShermanDialogOpen] = useState(false);
  const [shermanResNumber, setShermanResNumber] = useState("");
  const [shermanResDate, setShermanResDate] = useState("");

  useEffect(() => {
    if (!campaignId) {
      setStations([]);
      setLoadingStations(false);
      return;
    }
    let cancelled = false;
    setStations([]);
    setLoadingStations(true);
    getCampaignStations(campaignId).then((data) => {
      if (!cancelled) {
        setStations(data);
        setLoadingStations(false);
      }
    });
    return () => { cancelled = true; };
  }, [campaignId]);

  const selectedProject = projects.find((p) => p.id === projectId);
  const campaigns = selectedProject?.campaigns ?? [];
  const selectedCampaign = campaigns.find((c) => c.id === campaignId);
  const isBB = selectedCampaign?.methodology === "BRAUN_BLANQUET";
  const isMicroruteo = selectedCampaign?.methodology === "MICRORUTEO";
  const isPF = selectedCampaign?.methodology === "PARCELAS_FORESTALES";
  const isGrilla = selectedCampaign?.methodology === "GRILLA";
  const isTransectoFauna = selectedCampaign?.methodology === "TRANSECTO_LINEAL_FAUNA";
  const isRescate = selectedCampaign?.methodology === "RESCATE_RELOC";
  const isFauna = selectedCampaign?.surveyType === "FAUNA";

  // ── Summary stats (all methodologies) ──
  const stats = (() => {
    if (!selectedCampaign) return null;
    const allOcc = isGrilla
      ? stations.flatMap((s) => (s.children ?? []).flatMap((c) => c.occurrences))
      : stations.flatMap((s) => s.occurrences);
    const speciesMap = new Map<string, { sp: SpeciesRow; count: number; abundance: number }>();
    for (const occ of allOcc) {
      const key = occ.species.id;
      const n = occ.abundance ?? occ.groupSize ?? 1;
      const ex = speciesMap.get(key);
      if (ex) { ex.count++; ex.abundance += n; }
      else speciesMap.set(key, { sp: occ.species, count: 1, abundance: n });
    }
    const speciesList = Array.from(speciesMap.values()).sort((a, b) => spSort(a.sp, b.sp));
    const stationData = isGrilla
      ? stations
          .flatMap((s) => s.children ?? [])
          .sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }))
          .map((g) => ({
            name: g.name,
            ocurrencias: g.occurrences.reduce((sum, o) => sum + (o.abundance ?? 0), 0),
          }))
      : stations.map((s) => ({
          name: s.name.length > 8 ? s.name.slice(0, 8) + "…" : s.name,
          ocurrencias: s.occurrences.length,
        }));
    const endangered = speciesList.filter((s) =>
      ["CR", "EN", "VU"].includes(primaryStatus(s.sp.conservationStatus))
    );
    return {
      totalSpecies: speciesMap.size,
      totalOccurrences: allOcc.length,
      totalIndividuals: allOcc.reduce((s, o) => s + (o.abundance ?? o.groupSize ?? 1), 0),
      totalStations: isGrilla
        ? stations.reduce((sum, s) => sum + (s.children?.length ?? 0), 0)
        : stations.length,
      speciesList,
      stationData,
      endangered,
    };
  })();

  // Species added via the quick-add button ("¿No está la especie? ¡Agrégala!") and never
  // completed — family is left as "Por clasificar" until an admin fills in the rest.
  // Species that predate the required-fields rule are left alone even if they're missing data.
  const incompleteSpecies = (stats?.speciesList ?? [])
    .map(({ sp }) => sp)
    .filter((sp) => sp.family === "Por clasificar");

  // ── Parcelas (Braun-Blanquet) matrix ──
  const bbData = (() => {
    if (!selectedCampaign || !isBB) return null;
    const sortedStations = [...stations].sort((a, b) =>
      a.name.localeCompare(b.name, "es", { numeric: true })
    );
    const speciesMap = new Map<string, { sp: SpeciesRow; stMap: Map<string, string> }>();
    for (const station of sortedStations) {
      for (const occ of station.occurrences) {
        const key = occ.species.id;
        if (!speciesMap.has(key)) speciesMap.set(key, { sp: occ.species, stMap: new Map() });
        const entry = speciesMap.get(key)!;
        if (!entry.stMap.has(station.id) && occ.methodologyData) {
          try {
            const md = JSON.parse(occ.methodologyData);
            if (md.bbcover) entry.stMap.set(station.id, md.bbcover);
          } catch {}
        }
      }
    }
    const rows = Array.from(speciesMap.values()).sort((a, b) => spSort(a.sp, b.sp));
    // Summary counts
    const habitoCounts = new Map<string, number>();
    const origenCounts = new Map<string, number>();
    for (const { sp } of rows) {
      if (sp.habito) habitoCounts.set(sp.habito, (habitoCounts.get(sp.habito) ?? 0) + 1);
      if (sp.origen) {
        const o = sp.origen === "Endemico" ? "Endémico" : sp.origen;
        origenCounts.set(o, (origenCounts.get(o) ?? 0) + 1);
      }
    }
    const habitoRows = Array.from(habitoCounts.entries()).sort((a, b) => a[0].localeCompare(b[0], "es"));
    const origenRows = Array.from(origenCounts.entries()).sort((a, b) => a[0].localeCompare(b[0], "es"));

    return { sortedStations, rows, habitoRows, origenRows };
  })();

  // ── Microruteo: one row per occurrence with UTM ──
  const microData = (() => {
    if (!selectedCampaign || !isMicroruteo) return null;

    type MRow = { sp: SpeciesRow; individuo: number; utmEast: number | null; utmNorth: number | null };

    const raw: Omit<MRow, "individuo">[] = [];
    for (const station of stations) {
      for (const o of station.occurrences) {
        let utmEast: number | null = null;
        let utmNorth: number | null = null;
        if (o.methodologyData) {
          try {
            const md = JSON.parse(o.methodologyData);
            utmEast = md.utm_east != null ? Number(md.utm_east) : null;
            utmNorth = md.utm_north != null ? Number(md.utm_north) : null;
          } catch {}
        }
        raw.push({ sp: o.species, utmEast, utmNorth });
      }
    }

    raw.sort((a, b) => spSort(a.sp, b.sp));

    const speciesCounts = new Map<string, number>();
    const rows: MRow[] = raw.map((o) => {
      const n = (speciesCounts.get(o.sp.id) ?? 0) + 1;
      speciesCounts.set(o.sp.id, n);
      return { ...o, individuo: n };
    });

    const habitoCounts = new Map<string, number>();
    const origenCounts = new Map<string, number>();
    const seen = new Set<string>();
    for (const row of rows) {
      if (!seen.has(row.sp.id)) {
        seen.add(row.sp.id);
        if (row.sp.habito) habitoCounts.set(row.sp.habito, (habitoCounts.get(row.sp.habito) ?? 0) + 1);
        if (row.sp.origen) {
          const o = row.sp.origen === "Endemico" ? "Endémico" : row.sp.origen;
          origenCounts.set(o, (origenCounts.get(o) ?? 0) + 1);
        }
      }
    }
    const habitoRows = Array.from(habitoCounts.entries()).sort((a, b) => a[0].localeCompare(b[0], "es"));
    const origenRows = Array.from(origenCounts.entries()).sort((a, b) => a[0].localeCompare(b[0], "es"));

    return { rows, habitoRows, origenRows };
  })();

  // ── Grilla: species × grilla matrix + hydrophyte summary ──
  const grillaData = (() => {
    if (!selectedCampaign || !isGrilla) return null;

    const transectos = [...stations].sort((a, b) =>
      a.name.localeCompare(b.name, "es", { numeric: true })
    );

    // All grilla child stations in order
    const grillaStations = transectos.flatMap((t) =>
      [...(t.children ?? [])].sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }))
    );

    // speciesId → { sp, perGrilla: Map<grillaId, count> }
    const speciesMap = new Map<string, { sp: SpeciesRow; perGrilla: Map<string, number> }>();

    for (const grilla of grillaStations) {
      for (const occ of grilla.occurrences) {
        const abund = occ.abundance ?? 0;
        const key = occ.species.id;
        if (!speciesMap.has(key)) speciesMap.set(key, { sp: occ.species, perGrilla: new Map() });
        const entry = speciesMap.get(key)!;
        entry.perGrilla.set(grilla.id, (entry.perGrilla.get(grilla.id) ?? 0) + abund);
      }
    }

    // sinVegetacion = 16 - sum(species abundances) for each grilla (only if data exists)
    const sinVegPerGrilla = new Map<string, number>();
    const grillaHasData = new Set<string>();
    for (const grilla of grillaStations) {
      if (grilla.occurrences.length > 0) {
        grillaHasData.add(grilla.id);
        const totalSpecies = grilla.occurrences.reduce((s, o) => s + (o.abundance ?? 0), 0);
        sinVegPerGrilla.set(grilla.id, Math.max(0, 16 - totalSpecies));
      }
    }

    const rows = Array.from(speciesMap.values()).sort((a, b) => spSort(a.sp, b.sp));

    // Hydrophyte summary per transecto
    const hydroByTransecto = transectos
      .filter((t) => (t.children ?? []).length > 0)
      .map((t) => {
        const grillas = [...(t.children ?? [])].sort((a, b) =>
          a.name.localeCompare(b.name, "es", { numeric: true })
        );
        const siCounts = grillas.map((g) =>
          grillaHasData.has(g.id)
            ? Array.from(speciesMap.values())
                .filter(({ sp }) => !!sp.macrofitasHabito)
                .reduce((sum, { perGrilla }) => sum + (perGrilla.get(g.id) ?? 0), 0)
            : 0
        );
        const noCounts = grillas.map((g, i) =>
          grillaHasData.has(g.id) ? 16 - siCounts[i] : 0
        );
        const siTotal = siCounts.reduce((a, b) => a + b, 0);
        const noTotal = noCounts.reduce((a, b) => a + b, 0);
        const grandTotal = siTotal + noTotal;
        const siPct = grandTotal > 0 ? Math.round((siTotal / grandTotal) * 100) : 0;
        return { transectoName: t.name, grillas, siCounts, noCounts, siTotal, noTotal, grandTotal, siPct, noPct: 100 - siPct };
      });

    return { grillaStations, rows, sinVegPerGrilla, grillaHasData, hydroByTransecto };
  })();

  // ── XLSX export with full styling (ExcelJS) ──
  async function exportXLSX() {
    if (!selectedCampaign || !stats || !selectedProject) return;
    if (incompleteSpecies.length > 0) {
      toast.error("Completa los datos de las especies pendientes antes de exportar el reporte");
      return;
    }

    // Dynamic import — ExcelJS is browser-compatible
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();

    const safe = (s: string) => s.replace(/[/\\?*[\]]/g, "-").replace(/\s+/g, "_");
    const fname = `${safe(selectedProject.name)}-${safe(selectedCampaign.name)}`;

    const HDR_BG  = "FF08697E"; // teal header fill (ARGB)
    const HDR_FG  = "FFFFFFFF"; // white header font
    const BASE    = { name: "Tahoma", size: 10 } as const;

    /**
     * addSheet — creates a styled worksheet.
     * @param boldFromBottom  number of trailing data rows to bold (e.g. 2 for Sin veg + Total)
     * @param boldLastRow     bold only the very last row
     */
    function addSheet(
      sheetName: string,
      data: (string | number | null | undefined)[][],
      boldLastRow = false,
      boldFromBottom = 0,
    ) {
      if (data.length === 0) return;
      const ws = wb.addWorksheet(sheetName);

      const headers   = data[0] as string[];
      // Column indices (0-based) for key columns
      const cnIdx = headers.findIndex((h) => h === "Nombre Común");
      const spIdx = headers.findIndex((h) => h === "Especie");

      // Auto column widths
      ws.columns = headers.map((_, ci) => ({
        width: Math.min(50, Math.max(8,
          Math.max(...data.map((r) => String(r[ci] ?? "").length)) + 2,
        )),
      }));

      data.forEach((rowData, ri) => {
        const exRow = ws.addRow(rowData.map((v) => v ?? ""));
        const isHdr  = ri === 0;
        const isBold =
          (boldLastRow && ri === data.length - 1) ||
          (boldFromBottom > 0 && ri >= data.length - boldFromBottom);

        const borderStyle = { style: "thin" as const, color: { argb: "FF000000" } };
        const allBorders = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };

        exRow.eachCell({ includeEmpty: true }, (cell, col) => {
          const ci = col - 1; // 0-based

          cell.border = allBorders;

          if (isHdr) {
            // ── Header row ──
            cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: HDR_BG } };
            cell.font  = { ...BASE, bold: true, color: { argb: HDR_FG } };
            cell.alignment = { horizontal: "center", vertical: "middle" };
          } else {
            // ── Data rows ──
            const isSpeciesCol = spIdx >= 0 && ci === spIdx;
            cell.font = {
              ...BASE,
              italic: isSpeciesCol,
              bold:   isBold,
            };
            // Center data cells that are after "Nombre Común"
            if (cnIdx >= 0 && ci > cnIdx) {
              cell.alignment = { horizontal: "center", vertical: "middle" };
            }
          }
        });
      });
    }

    // ── Generate sheets ──

    // Sheet 0: project + campaign metadata
    {
      const ws = wb.addWorksheet("Información");
      ws.properties.defaultColWidth = 30;

      const fmt = (d: Date | string | null | undefined) => {
        if (!d) return "";
        const date = d instanceof Date ? d : new Date(d);
        return date.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
      };

      const rows: [string, string][] = [
        ["PROYECTO", ""],
        ["Código", selectedProject.name],
        ["Región", selectedProject.region],
        ["Comuna", selectedProject.commune],
        ["", ""],
        ["CAMPAÑA", ""],
        ["Nombre", selectedCampaign.name],
        ["Tipo", selectedCampaign.surveyType === "FLORA" ? "Flora" : "Fauna"],
        ["Metodología", getMethodologyById(selectedCampaign.methodology)?.name ?? selectedCampaign.methodology],
        ["Fecha inicio", fmt(selectedCampaign.startDate)],
        ["Fecha término", fmt(selectedCampaign.endDate)],
        ["Responsable", selectedCampaign.responsible ?? ""],
        ["Notas", selectedCampaign.notes ?? ""],
        ["", ""],
        ["ESTADÍSTICAS", ""],
        ["Especies únicas", String(stats.totalSpecies)],
        ["Ocurrencias", String(stats.totalOccurrences)],
        ["Individuos", String(stats.totalIndividuals)],
        [isGrilla ? "Grillas" : "Estaciones", String(stats.totalStations)],
      ];

      rows.forEach(([label, value], i) => {
        const row = ws.addRow([label, value]);
        const isSection = label === "PROYECTO" || label === "CAMPAÑA" || label === "ESTADÍSTICAS";
        row.getCell(1).font = { name: "Tahoma", size: 10, bold: true, color: isSection ? { argb: HDR_FG } : { argb: "FF000000" } };
        row.getCell(2).font = { name: "Tahoma", size: 10 };
        if (isSection) {
          row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HDR_BG } };
          row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HDR_BG } };
        }
        if (i > 0 && !isSection && label !== "") {
          const border = { style: "thin" as const, color: { argb: "FFE5E7EB" } };
          row.getCell(1).border = { bottom: border };
          row.getCell(2).border = { bottom: border };
        }
      });

      ws.getColumn(1).width = 22;
      ws.getColumn(2).width = 45;
    }

    if (isBB && bbData) {
      const { sortedStations, rows, habitoRows, origenRows } = bbData;
      addSheet("Parcelas BB", [
        ["División","Clase","Familia","Especie","Nombre Común","Hábito","Origen","Estado Conservación",...sortedStations.map((s)=>s.name)],
        ...rows.map(({sp,stMap})=>[
          sp.division??"",sp.clase??"",sp.family,`${sp.genus} ${sp.species}`,
          sp.commonName??"",sp.habito??"",sp.origen??"",allStatusesText(sp.conservationStatus),
          ...sortedStations.map((s)=>stMap.get(s.id)??""),
        ]),
      ]);
      addSheet("Hábito",  [["Hábito","N° Especies"],...habitoRows.map(([h,n])=>[h,n])]);
      addSheet("Origen",  [["Origen","N° Especies"],...origenRows.map(([o,n])=>[o,n])]);
    }

    if (isMicroruteo && microData) {
      const { rows, habitoRows, origenRows } = microData;
      addSheet("Microruteo", [
        ["División","Clase","Familia","Especie","Nombre Común","Hábito","Origen","Estado Conservación","Individuo","Este (m E)","Norte (m S)"],
        ...rows.map(({sp,individuo,utmEast,utmNorth})=>[
          sp.division??"",sp.clase??"",sp.family,`${sp.genus} ${sp.species}`,
          sp.commonName??"",sp.habito??"",sp.origen??"",allStatusesText(sp.conservationStatus),
          individuo,
          utmEast!=null?Math.round(utmEast):"",
          utmNorth!=null?Math.round(utmNorth):"",
        ]),
      ]);
      addSheet("Hábito", [["Hábito","N° Especies"],...habitoRows.map(([h,n])=>[h,n])]);
      addSheet("Origen", [["Origen","N° Especies"],...origenRows.map(([o,n])=>[o,n])]);
    }

    if (isPF && pfData) {
      const { speciesRows, individualRows } = pfData;
      addSheet("Especies", [
        ["División","Clase","Familia","Especie","Nombre Común","Hábito","Origen","Estado Conservación"],
        ...speciesRows.map((sp)=>[
          sp.division??"",sp.clase??"",sp.family,`${sp.genus} ${sp.species}`,
          sp.commonName??"",sp.habito??"",sp.origen??"",allStatusesText(sp.conservationStatus),
        ]),
      ]);
      addSheet("Individuos", [
        ["Parcela","Especie","Individuo","DAP (cm)","DAT (cm)","Altura (m)"],
        ...individualRows.map((r)=>[
          r.parcela,`${r.sp.genus} ${r.sp.species}`,r.individuo,r.dap??"",r.dat??"",r.altura??"",
        ]),
      ]);
    }

    if (isGrilla && grillaData) {
      const { grillaStations, rows, sinVegPerGrilla, grillaHasData, hydroByTransecto } = grillaData;
      const gNames = grillaStations.map((g)=>g.name);
      addSheet("Grilla", [
        ["División","Clase","Familia","Especie","Nombre Común","Hábito","Hábito Hidrófito","Origen","E.C.",...gNames],
        ...rows.map(({sp,perGrilla})=>[
          sp.division??"",sp.clase??"",sp.family,`${sp.genus} ${sp.species}`,
          sp.commonName??"",sp.habito??"",sp.macrofitasHabito??"",sp.origen??"",
          allStatusesText(sp.conservationStatus),
          ...grillaStations.map((g)=>perGrilla.get(g.id)??""),
        ]),
        ["","","","","","","","","Sin vegetación",...grillaStations.map((g)=>grillaHasData.has(g.id)?(sinVegPerGrilla.get(g.id)??0):"")],
        ["","","","","","","","","Total",...grillaStations.map((g)=>grillaHasData.has(g.id)?16:"")],
      ], false, 2); // last 2 rows bold

      if (hydroByTransecto.length > 0) {
        const hydroRows: (string|number)[][] = [["Transecto","Grilla","Intersecciones Hidrófitas","Sin Hidrófitas","Total"]];
        for (const {transectoName,grillas,siCounts,noCounts} of hydroByTransecto) {
          for (let i=0;i<grillas.length;i++) {
            hydroRows.push([transectoName,grillas[i].name,siCounts[i],noCounts[i],siCounts[i]+noCounts[i]]);
          }
        }
        addSheet("Hidrófitas", hydroRows);
        addSheet("Condición Humedal", [
          ["Transecto","Intersecciones Hidrófitas","Total Intersecciones","% Hidrófitas","Condición"],
          ...hydroByTransecto.map(({transectoName,siTotal,grandTotal,siPct})=>[
            transectoName,siTotal,grandTotal,siPct/100,siPct>50?"Humedal":"No Humedal",
          ]),
        ]);
      }
    }

    if (isTransectoFauna && transectoFaunaData) {
      const { rows, totalAbundance, sortedStations } = transectoFaunaData;
      const stationNames = sortedStations.map((s) => s.name);
      addSheet("Consolidado", [
        ["Clase","Orden","Familia","Especie","Nombre Común","Origen","E.C.",...stationNames,"Total"],
        ...rows.map(({sp,abundance,perStation})=>[
          sp.clase??"",sp.orden??"",sp.family,
          `${sp.genus} ${sp.species}`,sp.commonName??"",
          sp.origen??"",allStatusesText(sp.conservationStatus),
          ...sortedStations.map((s) => perStation.get(s.id) ?? 0),
          abundance,
        ]),
        ["","","","","","","Total",...sortedStations.map((s) => rows.reduce((sum, r) => sum + (r.perStation.get(s.id) ?? 0), 0)),totalAbundance],
      ], true); // last row bold
    }

    if (isTransectoFauna && communityParamsData && communityParamsData.length > 0) {
      addSheet("Parámetros", [
        ["Transecto","Riqueza (S)","Abundancia (N)","Shannon (H')","Equidad (J')"],
        ...communityParamsData.map((r)=>[r.name,r.S,r.N,r.H,r.J ?? ""]),
      ]);
    }

    if (isTransectoFauna && transectoFaunaData && transectoFaunaData.origenRows.length > 0) {
      addSheet("Origen", [
        ["Origen","Cantidad de especies"],
        ...transectoFaunaData.origenRows.map(([o,n])=>[o,n]),
      ]);
    }

    if (!isBB && !isMicroruteo && !isPF && !isGrilla && !isTransectoFauna) {
      addSheet("Lista de Especies", [
        ["Familia","Género","Especie","Nombre Común","Tipo","Estado Conservación","Nº Registros","Abundancia Total"],
        ...stats.speciesList.map(({sp,count,abundance})=>[
          sp.family,sp.genus,sp.species,sp.commonName??"",sp.type,
          allStatusesText(sp.conservationStatus),count,abundance,
        ]),
      ]);
    }

    // ── Por Clase (FAUNA only) ──
    if (isFauna && claseData && claseData.rows.length > 0) {
      addSheet("Por Clase", [
        ["Clase","N° Especies","% Especies","N° Individuos","% Individuos"],
        ...claseData.rows.map((r) => [r.clase, r.nEspecies, r.pctEspecies / 100, r.abundance, r.pctAbundancia / 100]),
        ["Total", claseData.totalSpecies, 1, claseData.totalAbundance, 1],
      ], true); // last row bold
    }

    // ── RESCATE: captures table ──
    if (isRescate && rescateData && rescateData.rows.length > 0) {
      addSheet("Capturas", [
        ["Clase","Orden","Familia","Especie","Nombre Común","Código","Estación","Estado Conservación"],
        ...rescateData.rows.map((r) => [
          r.sp.clase ?? "", r.sp.orden ?? "", r.sp.family,
          `${r.sp.genus} ${r.sp.species}`, r.sp.commonName ?? "",
          r.individualCode, r.stationName, allStatusesText(r.sp.conservationStatus),
        ]),
      ]);
    }

    if (stats.endangered.length > 0) {
      addSheet("Conservación", [
        ["Familia","Especie","Nombre Común","Estado Conservación"],
        ...stats.endangered.map(({sp})=>[
          sp.family,`${sp.genus} ${sp.species}`,sp.commonName??"",allStatusesText(sp.conservationStatus),
        ]),
      ]);
    }

    // Trigger download
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${fname}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Parcelas Forestales: species list + individuals ──
  const pfData = (() => {
    if (!selectedCampaign || !isPF) return null;

    type PFRow = { parcela: string; sp: SpeciesRow; individuo: number; dap: string; dat: string; altura: string };

    const individualRows: PFRow[] = [];
    const sortedStations = [...stations].sort((a, b) =>
      a.name.localeCompare(b.name, "es", { numeric: true })
    );

    for (const station of sortedStations) {
      const countPerSpecies = new Map<string, number>();
      // Sort occurrences by species name for consistent ordering
      const occs = [...station.occurrences].sort((a, b) =>
        `${a.species.genus} ${a.species.species}`.localeCompare(`${b.species.genus} ${b.species.species}`)
      );
      for (const occ of occs) {
        let inds: { dat: string; dap: string; altura: string }[] = [];
        if (occ.methodologyData) {
          try { inds = JSON.parse(occ.methodologyData).individuals ?? []; } catch {}
        }
        for (const ind of inds) {
          if (!ind.dat && !ind.dap && !ind.altura) continue;
          const n = (countPerSpecies.get(occ.species.id) ?? 0) + 1;
          countPerSpecies.set(occ.species.id, n);
          individualRows.push({ parcela: station.name, sp: occ.species, individuo: n, dap: ind.dap, dat: ind.dat, altura: ind.altura });
        }
      }
    }

    // Unique species sorted by family then species
    const speciesMap = new Map<string, SpeciesRow>();
    for (const row of individualRows) {
      if (!speciesMap.has(row.sp.id)) speciesMap.set(row.sp.id, row.sp);
    }
    const speciesRows = Array.from(speciesMap.values()).sort(spSort);

    return { individualRows, speciesRows };
  })();

  // ── Transecto Fauna: consolidated species table ──
  const transectoFaunaData = (() => {
    if (!selectedCampaign || !isTransectoFauna) return null;
    const sortedStations = [...stations]
      .sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }));
    const speciesMap = new Map<string, { sp: SpeciesRow; perStation: Map<string, number> }>();
    for (const station of sortedStations) {
      for (const occ of station.occurrences) {
        const key = occ.species.id;
        const n = occ.abundance ?? 1;
        if (!speciesMap.has(key)) speciesMap.set(key, { sp: occ.species, perStation: new Map() });
        const entry = speciesMap.get(key)!;
        entry.perStation.set(station.id, (entry.perStation.get(station.id) ?? 0) + n);
      }
    }
    const rows = Array.from(speciesMap.values()).sort((a, b) => {
      const c = (a.sp.clase ?? "").localeCompare(b.sp.clase ?? "");
      if (c !== 0) return c;
      const o = (a.sp.orden ?? "").localeCompare(b.sp.orden ?? "");
      if (o !== 0) return o;
      const f = (a.sp.family || "").localeCompare(b.sp.family || "");
      if (f !== 0) return f;
      return `${a.sp.genus} ${a.sp.species}`.localeCompare(`${b.sp.genus} ${b.sp.species}`);
    }).map(({ sp, perStation }) => ({
      sp,
      perStation,
      abundance: Array.from(perStation.values()).reduce((s, n) => s + n, 0),
    }));
    const totalAbundance = rows.reduce((sum, r) => sum + r.abundance, 0);
    const origenCounts = new Map<string, number>();
    for (const { sp } of rows) {
      if (sp.origen) {
        const o = sp.origen === "Endemico" ? "Endémico" : sp.origen;
        origenCounts.set(o, (origenCounts.get(o) ?? 0) + 1);
      }
    }
    const origenRows = Array.from(origenCounts.entries()).sort((a, b) => a[0].localeCompare(b[0], "es"));
    return { rows, totalAbundance, origenRows, sortedStations };
  })();

  // ── Parámetros comunitarios por transecto ──
  const communityParamsData = (() => {
    if (!selectedCampaign || !isTransectoFauna) return null;
    const sortedStations = [...stations]
      .sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }));
    return sortedStations
      .map((station) => {
        const speciesAbundance = new Map<string, number>();
        for (const occ of station.occurrences) {
          const n = occ.abundance ?? 1;
          speciesAbundance.set(occ.species.id, (speciesAbundance.get(occ.species.id) ?? 0) + n);
        }
        const S = speciesAbundance.size;
        const N = Array.from(speciesAbundance.values()).reduce((s, n) => s + n, 0);
        let H = 0;
        if (N > 0) {
          for (const ni of speciesAbundance.values()) {
            const pi = ni / N;
            if (pi > 0) H -= pi * Math.log(pi);
          }
        }
        const J: number | null = S > 1 ? H / Math.log(S) : S === 1 ? 0 : null;
        return {
          name: station.name, S, N,
          H: Math.round(H * 1000) / 1000,
          J: J !== null ? Math.round(J * 1000) / 1000 : null,
        };
      });
  })();

  // ── Clase taxonómica — aplica a campañas de fauna (transecto, rescate, etc.) ──
  const claseData = (() => {
    if (!selectedCampaign || (!isTransectoFauna && !isRescate)) return null;
    const allOcc = isGrilla
      ? stations.flatMap((s) => (s.children ?? []).flatMap((c) => c.occurrences))
      : stations.flatMap((s) => s.occurrences);

    // Unique species and total abundance
    const speciesMap = new Map<string, { sp: SpeciesRow; abundance: number }>();
    for (const occ of allOcc) {
      const key = occ.species.id;
      const n = occ.abundance ?? occ.groupSize ?? 1;
      const ex = speciesMap.get(key);
      if (ex) { ex.abundance += n; }
      else speciesMap.set(key, { sp: occ.species, abundance: n });
    }

    // Group by clase
    const claseMap = new Map<string, { speciesIds: Set<string>; abundance: number }>();
    for (const { sp, abundance } of speciesMap.values()) {
      const clase = sp.clase || "Sin clasificar";
      if (!claseMap.has(clase)) claseMap.set(clase, { speciesIds: new Set(), abundance: 0 });
      const entry = claseMap.get(clase)!;
      entry.speciesIds.add(sp.id);
      entry.abundance += abundance;
    }

    const totalSpecies = speciesMap.size;
    const totalAbundance = Array.from(speciesMap.values()).reduce((s, v) => s + v.abundance, 0);

    const rows = Array.from(claseMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "es"))
      .map(([clase, { speciesIds, abundance }]) => ({
        clase,
        nEspecies: speciesIds.size,
        abundance,
        pctEspecies: totalSpecies > 0 ? Math.round((speciesIds.size / totalSpecies) * 100) : 0,
        pctAbundancia: totalAbundance > 0 ? Math.round((abundance / totalAbundance) * 100) : 0,
      }));

    return { rows, totalSpecies, totalAbundance };
  })();

  // ── RESCATE: capturas individuales agrupadas por clase ──
  const rescateData = (() => {
    if (!selectedCampaign || !isRescate) return null;
    const rows: { individualCode: string; sp: SpeciesRow; stationName: string }[] = [];
    for (const station of stations) {
      for (const occ of station.occurrences) {
        if (occ.individualCode) {
          rows.push({ individualCode: occ.individualCode, sp: occ.species, stationName: station.name });
        }
      }
    }
    rows.sort((a, b) => {
      const c = (a.sp.clase ?? "").localeCompare(b.sp.clase ?? "", "es");
      if (c !== 0) return c;
      const s = `${a.sp.genus} ${a.sp.species}`.localeCompare(`${b.sp.genus} ${b.sp.species}`, "es");
      if (s !== 0) return s;
      return a.individualCode.localeCompare(b.individualCode);
    });
    return { rows };
  })();

  // ── SAG banding report: one row per specimen caught in a Sherman trap ──
  const shermanData = (() => {
    if (!selectedCampaign) return null;
    type ShermanRow = {
      key: string;
      sp: SpeciesRow;
      date: Date | string;
      trapLabel: string;
      utm: { east: number; north: number; zone: string } | null;
    };
    const rows: ShermanRow[] = [];
    for (const station of stations) {
      for (const occ of station.occurrences) {
        if (occ.detectionMethod !== "Trampa Sherman") continue;
        let trapId = "";
        if (occ.methodologyData) {
          try { trapId = JSON.parse(occ.methodologyData).trapId ?? ""; } catch {}
        }
        const utm = occ.latitude != null && occ.longitude != null
          ? latLngToUTM(occ.latitude, occ.longitude)
          : null;
        const specimens = Math.max(1, occ.abundance ?? 1);
        for (let i = 0; i < specimens; i++) {
          rows.push({
            key: `${occ.id}-${i}`,
            sp: occ.species,
            date: occ.date,
            trapLabel: formatTrapLabel(trapId),
            utm,
          });
        }
      }
    }
    rows.sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime() ||
      a.trapLabel.localeCompare(b.trapLabel, "es", { numeric: true })
    );
    const unresolvedSpecies = Array.from(
      new Map(rows.filter((r) => !r.sp.origen).map((r) => [r.sp.id, r.sp])).values()
    );
    return { rows, unresolvedSpecies };
  })();

  function estadoFinalFor(sp: SpeciesRow): string {
    if (!sp.origen) return "—";
    return sp.origen === "Introducido" ? "Eutanasia" : "Liberación";
  }

  // ── SAG banding report export (separate workbook, separate button) ──
  async function exportShermanSAG() {
    if (!selectedCampaign || !selectedProject || !shermanData) return;
    if (!shermanResNumber.trim() || !shermanResDate.trim()) {
      toast.error("Ingresa el N° de Resolución SAG y su fecha");
      return;
    }
    if (shermanData.unresolvedSpecies.length > 0) {
      toast.error("Completa el origen (Nativo/Introducido) de las especies pendientes antes de exportar");
      return;
    }

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Anillamiento SAG");

    const BASE = { name: "Calibri", size: 11, color: { argb: "FF000000" } } as const;
    const BANNER_BG = "FF9BC2E6";
    const NOTE_BG = "FFA6A6A6";
    const HEADER_BG = "FFBDD7EE";
    const border = { style: "thin" as const, color: { argb: "FF000000" } };
    const allBorders = { top: border, left: border, bottom: border, right: border };

    const CAPTURE_COLS = 15; // A..O
    const RELEASE_COLS = 7;  // P..V
    const headers = [
      "N° Resolución SAG", "Fecha Resolución SAG", "Taxón", "Nombre Científico", "Sexo", "Edad",
      "Marca", "Código (Marca)", "Fecha Captura", "Nombre Sitio Captura", "Comuna Captura",
      "Region Captura", "Coordenadas Este Captura", "Coordenadas Sur Captura", "Huso Captura",
      "Fecha Liberación", "Nombre sitio Liberación", "Comuna Liberación", "Region Liberación",
      "Coordenadas Norte Liberación", "Coordenadas Este Liberación", "Huso Liberación",
      "Estado final", "Observaciones",
    ];
    const colWidths = [14, 16, 16, 24, 12, 12, 12, 14, 13, 16, 14, 14, 16, 16, 11, 14, 18, 14, 14, 18, 18, 12, 12, 20];
    ws.columns = colWidths.map((width) => ({ width }));

    // Row 1 — blue banner over the capture columns, relocation note over the release columns.
    // Fill/border are applied to every cell in each merged range, not just the master cell,
    // so the merged block renders as one continuous bordered box.
    ws.mergeCells(1, 1, 1, CAPTURE_COLS);
    for (let c = 1; c <= CAPTURE_COLS; c++) {
      const cell = ws.getCell(1, c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BANNER_BG } };
      cell.border = allBorders;
    }
    const bannerCell = ws.getCell(1, 1);
    bannerCell.value = "Ingresar un registro (fila) por cada ejemplar.\n"
      + "Los datos de aves anilladas deben ser ingresados al Sistema Nacional de Anillamiento de Aves Silvestres, no en este documento";
    bannerCell.font = { ...BASE, bold: true };
    bannerCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

    ws.mergeCells(1, CAPTURE_COLS + 1, 1, CAPTURE_COLS + RELEASE_COLS);
    for (let c = CAPTURE_COLS + 1; c <= CAPTURE_COLS + RELEASE_COLS; c++) {
      const cell = ws.getCell(1, c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NOTE_BG } };
      cell.border = allBorders;
    }
    const noteCell = ws.getCell(1, CAPTURE_COLS + 1);
    noteCell.value = "Solo llenar en caso de actividades de Relocalización, es decir cuando el sitio de captura es distinto al de liberación.";
    noteCell.font = { ...BASE };
    noteCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    ws.getRow(1).height = 48;

    // Row 2 — column headers, same fill across the whole row
    headers.forEach((h, i) => {
      const cell = ws.getCell(2, i + 1);
      cell.value = h;
      cell.font = { ...BASE, bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
      cell.border = allBorders;
    });
    ws.getRow(2).height = 30;

    // Data rows
    shermanData.rows.forEach((row) => {
      const values = [
        shermanResNumber, shermanResDate, "Micromamíferos", `${row.sp.genus} ${row.sp.species}`,
        "Indefinido", "Indefinido", "Sin Marca", "-",
        fmtDateDMY(row.date), row.trapLabel, selectedProject.commune, selectedProject.region,
        row.utm?.east ?? "", row.utm?.north ?? "", row.utm ? row.utm.zone.replace(/[NS]$/, "") : "",
        "", "", "", "", "", "", "",
        estadoFinalFor(row.sp), "Sin observaciones",
      ];
      const exRow = ws.addRow(values);
      exRow.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.border = allBorders;
        cell.font = { ...BASE, italic: col === 4 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });
    });

    const safe = (s: string) => s.replace(/[/\\?*[\]]/g, "-").replace(/\s+/g, "_");
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SAG-Sherman-${safe(selectedProject.name)}-${safe(selectedCampaign.name)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    setShermanDialogOpen(false);
  }

  const fmt3 = (n: number) => n.toFixed(3).replace(".", ",");

  return (
    <div className="space-y-4">

      {/* Selectors */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Proyecto</label>
              <SearchableSelect
                value={projectId}
                options={projects.map((p) => ({ value: p.id, label: p.name }))}
                placeholder="Seleccionar proyecto..."
                onChange={(v) => { setProjectId(v); setCampaignId(""); }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Campaña</label>
              <Select
                value={campaignId}
                onValueChange={(v) => setCampaignId(v ?? "")}
                disabled={!selectedProject}
              >
                <SelectTrigger>
                  <SelectValue>
                    {selectedCampaign
                      ? `${selectedCampaign.name} · ${selectedCampaign.surveyType === "FLORA" ? "Flora" : "Fauna"} · ${getMethodologyById(selectedCampaign.methodology)?.name ?? selectedCampaign.methodology}`
                      : <span className="text-muted-foreground">
                          {selectedProject ? "Seleccionar campaña..." : "Primero elige proyecto"}
                        </span>}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="min-w-max">
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      <span className="text-gray-400 ml-1">· {c.surveyType === "FLORA" ? "Flora" : "Fauna"}</span>
                      <span className="text-gray-400 ml-1">· {getMethodologyById(c.methodology)?.name ?? c.methodology}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedCampaign && loadingStations && (
        <Card>
          <CardContent className="py-10 text-center text-gray-400">
            <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
            <p>Cargando datos de la campaña…</p>
          </CardContent>
        </Card>
      )}

      {stats && selectedCampaign && !loadingStations && (
        <div className="space-y-4">

          {/* Incomplete species warning — blocks export */}
          {incompleteSpecies.length > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-orange-800">
                      Hay {incompleteSpecies.length} especie{incompleteSpecies.length !== 1 ? "s" : ""} sin datos completos — no se puede exportar el reporte
                    </p>
                    <p className="text-xs text-orange-700 mt-0.5">
                      Completa la familia y demás datos taxonómicos en{" "}
                      <a href="/admin/especies" className="underline font-medium">Especies</a> antes de generar el reporte.
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {incompleteSpecies.map((sp) => (
                        <span key={sp.id} className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full italic">
                          {sp.genus} {sp.species}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Export button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={exportXLSX}
              disabled={incompleteSpecies.length > 0}
            >
              <Download className="h-4 w-4" /> Exportar XLSX
            </Button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Especies únicas",  value: stats.totalSpecies,     icon: selectedCampaign.surveyType === "FLORA" ? Leaf : Bird, color: "text-teal-600" },
              { label: "Ocurrencias",      value: stats.totalOccurrences,  icon: ListTree,   color: "text-blue-600" },
              { label: "Individuos",       value: stats.totalIndividuals,  icon: BarChart2,  color: "text-orange-600" },
              { label: isGrilla ? "Grillas" : "Estaciones", value: stats.totalStations, icon: BarChart2, color: "text-purple-600" },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label}>
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
            ))}
          </div>

          {/* Bar chart */}
          {stats.stationData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {isGrilla ? "Intersecciones con especie por Grilla" : "Ocurrencias por Estación"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.stationData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} domain={isGrilla ? [0, 16] : [0, "auto"]} />
                      <Tooltip />
                      <Bar dataKey="ocurrencias" fill="#16a34a" name={isGrilla ? "Intersecciones" : "Ocurrencias"} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Endangered alert */}
          {stats.endangered.length > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="py-3 px-4">
                <p className="text-sm font-medium text-orange-800 mb-1">
                  Especies de conservación prioritaria: {stats.endangered.length}
                </p>
                <div className="flex flex-wrap gap-1">
                  {stats.endangered.map((e) => (
                    <span key={e.sp.id} className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                      {e.sp.genus} {e.sp.species} ({primaryStatus(e.sp.conservationStatus)})
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── PARCELAS table (Braun-Blanquet) ── */}
          {isBB && bbData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Tabla de Parcelas · Braun-Blanquet</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">División</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Clase</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Familia</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap italic">Especie</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Nombre Común</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Hábito</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Origen</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Estado Conservación</th>
                        {bbData.sortedStations.map((s) => (
                          <th key={s.id} className="text-center px-2 py-2.5 font-semibold text-gray-600 whitespace-nowrap">{s.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {bbData.rows.map(({ sp, stMap }) => (
                        <tr key={sp.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-500">{sp.division ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-500">{sp.clase ?? "—"}</td>
                          <td className="px-3 py-2">{sp.family}</td>
                          <td className="px-3 py-2 italic font-medium whitespace-nowrap">{sp.genus} {sp.species}</td>
                          <td className="px-3 py-2 text-gray-500">{sp.commonName ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-500">{sp.habito ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-500">{sp.origen ?? "—"}</td>
                          <td className="px-3 py-2">{statusBadge(sp.conservationStatus)}</td>
                          {bbData.sortedStations.map((s) => (
                            <td key={s.id} className="px-2 py-2 text-center font-mono font-semibold text-gray-800">
                              {stMap.get(s.id) ?? ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {bbData.rows.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-8">Sin registros en esta campaña</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── BB summary tables: Hábito + Origen ── */}
          {isBB && bbData && (bbData.habitoRows.length > 0 || bbData.origenRows.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {bbData.habitoRows.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-gray-700">
                      Tabla resumen del hábito de las especies
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left px-4 py-2 font-semibold text-gray-600">Hábito</th>
                          <th className="text-right px-4 py-2 font-semibold text-gray-600">Cantidad de especies</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {bbData.habitoRows.map(([habito, count]) => (
                          <tr key={habito} className="hover:bg-gray-50">
                            <td className="px-4 py-2">{habito}</td>
                            <td className="px-4 py-2 text-right font-medium">{count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}

              {bbData.origenRows.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-gray-700">
                      Tabla resumen del origen de las especies
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left px-4 py-2 font-semibold text-gray-600">Origen</th>
                          <th className="text-right px-4 py-2 font-semibold text-gray-600">Cantidad de especies</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {bbData.origenRows.map(([origen, count]) => (
                          <tr key={origen} className="hover:bg-gray-50">
                            <td className="px-4 py-2">{origen}</td>
                            <td className="px-4 py-2 text-right font-medium">{count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ── MICRORUTEO table ── */}
          {isMicroruteo && microData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Tabla de Microruteo</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">División</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Clase</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Familia</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap italic">Especie</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Nombre Común</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Hábito</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Origen</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Estado Conservación</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Individuo</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Este (m E)</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Norte (m S)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {microData.rows.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-500">{row.sp.division ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-500">{row.sp.clase ?? "—"}</td>
                          <td className="px-3 py-2">{row.sp.family}</td>
                          <td className="px-3 py-2 italic font-medium whitespace-nowrap">{row.sp.genus} {row.sp.species}</td>
                          <td className="px-3 py-2 text-gray-500">{row.sp.commonName ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-500">{row.sp.habito ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-500">{row.sp.origen ?? "—"}</td>
                          <td className="px-3 py-2">{statusBadge(row.sp.conservationStatus)}</td>
                          <td className="px-3 py-2 text-center font-mono font-semibold">{row.individuo}</td>
                          <td className="px-3 py-2 text-right font-mono">{row.utmEast != null ? row.utmEast.toFixed(0) : "—"}</td>
                          <td className="px-3 py-2 text-right font-mono">{row.utmNorth != null ? row.utmNorth.toFixed(0) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {microData.rows.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-8">Sin registros en esta campaña</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Microruteo summary tables: Hábito + Origen ── */}
          {isMicroruteo && microData && (microData.habitoRows.length > 0 || microData.origenRows.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {microData.habitoRows.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-gray-700">
                      Tabla resumen del hábito de las especies
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left px-4 py-2 font-semibold text-gray-600">Hábito</th>
                          <th className="text-right px-4 py-2 font-semibold text-gray-600">Cantidad de especies</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {microData.habitoRows.map(([habito, count]) => (
                          <tr key={habito} className="hover:bg-gray-50">
                            <td className="px-4 py-2">{habito}</td>
                            <td className="px-4 py-2 text-right font-medium">{count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
              {microData.origenRows.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-gray-700">
                      Tabla resumen del origen de las especies
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left px-4 py-2 font-semibold text-gray-600">Origen</th>
                          <th className="text-right px-4 py-2 font-semibold text-gray-600">Cantidad de especies</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {microData.origenRows.map(([origen, count]) => (
                          <tr key={origen} className="hover:bg-gray-50">
                            <td className="px-4 py-2">{origen}</td>
                            <td className="px-4 py-2 text-right font-medium">{count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ── PARCELAS FORESTALES: species table ── */}
          {isPF && pfData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Tabla general de especies</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">División</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Clase</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Familia</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap italic">Especie</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Nombre Común</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Hábito</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Origen</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Estado Conservación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pfData.speciesRows.map((sp) => (
                        <tr key={sp.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-500">{sp.division ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-500">{sp.clase ?? "—"}</td>
                          <td className="px-3 py-2">{sp.family}</td>
                          <td className="px-3 py-2 italic font-medium whitespace-nowrap">{sp.genus} {sp.species}</td>
                          <td className="px-3 py-2 text-gray-500">{sp.commonName ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-500">{sp.habito ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-500">{sp.origen ?? "—"}</td>
                          <td className="px-3 py-2">{statusBadge(sp.conservationStatus)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {pfData.speciesRows.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-8">Sin registros en esta campaña</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── PARCELAS FORESTALES: individuals table ── */}
          {isPF && pfData && pfData.individualRows.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Tabla de individuos por parcela</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Parcela</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap italic">Especie</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Individuo</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">DAP (cm)</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">DAT (cm)</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Altura (m)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pfData.individualRows.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium">{row.parcela}</td>
                          <td className="px-3 py-2 italic whitespace-nowrap">{row.sp.genus} {row.sp.species}</td>
                          <td className="px-3 py-2 text-center font-mono font-semibold">{row.individuo}</td>
                          <td className="px-3 py-2 text-right font-mono">{row.dap || "—"}</td>
                          <td className="px-3 py-2 text-right font-mono">{row.dat || "—"}</td>
                          <td className="px-3 py-2 text-right font-mono">{row.altura || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── GRILLA: species × grilla matrix ── */}
          {isGrilla && grillaData && (
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-base">Tabla de Grilla</CardTitle>
                <p className="text-xs text-gray-400 mt-0.5">Números = intersecciones del punto de muestreo con la especie (máx. 16 por grilla)</p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">División</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Clase</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Familia</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap italic">Especie</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Nombre Común</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Hábito</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Hábito Hidrófito</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Origen</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">E.C</th>
                        {grillaData.grillaStations.map((g) => (
                          <th key={g.id} className="text-center px-2 py-2.5 font-semibold text-gray-600 whitespace-nowrap">{g.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {grillaData.rows.map(({ sp, perGrilla }) => (
                        <tr key={sp.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-500">{sp.division ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-500">{sp.clase ?? "—"}</td>
                          <td className="px-3 py-2">{sp.family}</td>
                          <td className="px-3 py-2 italic font-medium whitespace-nowrap">{sp.genus} {sp.species}</td>
                          <td className="px-3 py-2 text-gray-500">{sp.commonName ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-500">{sp.habito ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-500">{sp.macrofitasHabito ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-500">{sp.origen ?? "—"}</td>
                          <td className="px-3 py-2 text-center">{statusBadge(sp.conservationStatus)}</td>
                          {grillaData.grillaStations.map((g) => (
                            <td key={g.id} className="px-2 py-2 text-center font-mono font-semibold text-gray-800">
                              {perGrilla.get(g.id) ? perGrilla.get(g.id) : ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {/* Sin vegetación row */}
                      <tr className="bg-gray-50 border-t border-gray-200">
                        <td colSpan={9} className="px-3 py-2 text-center text-gray-500 italic text-xs">Sin vegetación</td>
                        {grillaData.grillaStations.map((g) => {
                          const sinVeg = grillaData.sinVegPerGrilla.get(g.id) ?? 0;
                          const hasData = grillaData.grillaHasData.has(g.id);
                          return (
                            <td key={g.id} className="px-2 py-2 text-center font-mono text-gray-600">
                              {!hasData ? <span className="text-gray-300">—</span> : sinVeg > 0 ? sinVeg : ""}
                            </td>
                          );
                        })}
                      </tr>
                      {/* Totals row */}
                      <tr className="bg-gray-100 border-t-2 border-gray-300">
                        <td colSpan={9} className="px-3 py-2 text-right text-gray-600 font-semibold text-xs">Total</td>
                        {grillaData.grillaStations.map((g) => (
                          <td key={g.id} className="px-2 py-2 text-center font-mono font-bold text-gray-800">
                            {grillaData.grillaHasData.has(g.id) ? 16 : <span className="text-gray-300 font-normal">—</span>}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                  {grillaData.rows.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-8">Sin registros en esta campaña</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── GRILLA: hydrophyte summary per transecto ── */}
          {isGrilla && grillaData && grillaData.hydroByTransecto.length > 0 && (
            <div className="space-y-4">
              {grillaData.hydroByTransecto.map(({ transectoName, grillas, siCounts, noCounts, siTotal, noTotal, grandTotal, siPct, noPct }) => (
                <Card key={transectoName}>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-teal-700 text-white">
                            <th className="text-center px-3 py-2 font-semibold whitespace-nowrap">Transecto</th>
                            <th className="text-center px-3 py-2 font-semibold whitespace-nowrap">Hábito Hidrófito</th>
                            {grillas.map((g) => (
                              <th key={g.id} className="text-center px-3 py-2 font-semibold whitespace-nowrap">{g.name}</th>
                            ))}
                            <th className="text-center px-3 py-2 font-semibold whitespace-nowrap">Total de Intersecciones</th>
                            <th className="text-center px-3 py-2 font-semibold whitespace-nowrap">%</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          <tr>
                            <td rowSpan={3} className="px-3 py-2 text-center font-bold border-r bg-gray-50">{transectoName.replace(/^T/i, "")}</td>
                            <td className="px-3 py-2 text-center">Si</td>
                            {siCounts.map((v, i) => (
                              <td key={i} className="px-3 py-2 text-center font-mono">{v}</td>
                            ))}
                            <td className="px-3 py-2 text-center font-mono font-semibold">{siTotal}</td>
                            <td className="px-3 py-2 text-center font-mono font-semibold">{siPct}</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2 text-center">No</td>
                            {noCounts.map((v, i) => (
                              <td key={i} className="px-3 py-2 text-center font-mono">{v}</td>
                            ))}
                            <td className="px-3 py-2 text-center font-mono font-semibold">{noTotal}</td>
                            <td className="px-3 py-2 text-center font-mono font-bold">{noPct}</td>
                          </tr>
                          <tr className="bg-gray-50 font-semibold border-t border-gray-300">
                            <td className="px-3 py-2 text-center text-gray-400"></td>
                            {grillas.map((g) => (
                              <td key={g.id} className="px-3 py-2 text-center font-mono font-bold">16</td>
                            ))}
                            <td className="px-3 py-2 text-center font-mono font-bold">{grandTotal}</td>
                            <td className="px-3 py-2 text-center font-mono font-bold">100</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* ── GRILLA: wetland condition determination ── */}
          {isGrilla && grillaData && grillaData.hydroByTransecto.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Determinación de Condición de Humedal</CardTitle>
                <p className="text-xs text-gray-500 mt-1">
                  Se determina Humedal cuando la cobertura de especies hidrófitas supera el 50% de las intersecciones del transecto.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Transecto</th>
                        <th className="text-center px-4 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Intersecciones Hidrófitas</th>
                        <th className="text-center px-4 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Total Intersecciones</th>
                        <th className="text-center px-4 py-2.5 font-semibold text-gray-600 whitespace-nowrap">% Hidrófitas</th>
                        <th className="text-center px-4 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Condición</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {grillaData.hydroByTransecto.map(({ transectoName, siTotal, grandTotal, siPct }) => {
                        const isHumedal = siPct > 50;
                        return (
                          <tr key={transectoName} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-medium">{transectoName}</td>
                            <td className="px-4 py-2.5 text-center font-mono">{siTotal}</td>
                            <td className="px-4 py-2.5 text-center font-mono">{grandTotal}</td>
                            <td className="px-4 py-2.5 text-center font-mono font-semibold">{siPct}%</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                                isHumedal
                                  ? "bg-teal-100 text-teal-800"
                                  : "bg-gray-100 text-gray-600"
                              }`}>
                                {isHumedal ? "Humedal" : "No Humedal"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── TRANSECTO FAUNA: consolidated table + por clase ── */}
          {isTransectoFauna && transectoFaunaData && (
            <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Consolidado de Fauna — Transecto</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Clase</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Orden</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Familia</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap italic">Especie</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Nombre Común</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Origen</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">E.C.</th>
                        {transectoFaunaData.sortedStations.map((st) => (
                          <th key={st.id} className="text-right px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">{st.name}</th>
                        ))}
                        <th className="text-right px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {transectoFaunaData.rows.map(({ sp, abundance, perStation }) => (
                        <tr key={sp.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2">{sp.clase ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-600">{sp.orden ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-600">{sp.family}</td>
                          <td className="px-3 py-2 italic font-medium whitespace-nowrap">{sp.genus} {sp.species}</td>
                          <td className="px-3 py-2 text-gray-600">{sp.commonName ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-600">{sp.origen ?? "—"}</td>
                          <td className="px-3 py-2 text-center">{statusBadge(sp.conservationStatus)}</td>
                          {transectoFaunaData.sortedStations.map((st) => {
                            const n = perStation.get(st.id) ?? 0;
                            return (
                              <td key={st.id} className={`px-3 py-2 text-right ${n === 0 ? "text-gray-300" : ""}`}>{n}</td>
                            );
                          })}
                          <td className="px-3 py-2 text-right font-semibold">{abundance}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 bg-gray-100">
                        <td colSpan={7} className="px-3 py-2.5 text-right font-bold text-gray-800">Total</td>
                        {transectoFaunaData.sortedStations.map((st) => (
                          <td key={st.id} className="px-3 py-2.5 text-right font-bold text-gray-900">
                            {transectoFaunaData.rows.reduce((sum, r) => sum + (r.perStation.get(st.id) ?? 0), 0)}
                          </td>
                        ))}
                        <td className="px-3 py-2.5 text-right font-bold text-gray-900">{transectoFaunaData.totalAbundance}</td>
                      </tr>
                    </tfoot>
                  </table>
                  {transectoFaunaData.rows.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-8">Sin registros en esta campaña</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ── Por Clase (inside the same transectoFaunaData guard) ── */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Riqueza y Abundancia por Clase Taxonómica</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Clase</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-gray-600">N° Especies</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-gray-600">% Esp.</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-gray-600">N° Individuos</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-gray-600">% Ind.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(() => {
                        const clMap = new Map<string, {n: number; ab: number}>();
                        for (const {sp, abundance} of transectoFaunaData.rows) {
                          const cl = sp.clase ?? "Sin clasificar";
                          const e = clMap.get(cl) ?? {n: 0, ab: 0};
                          e.n++; e.ab += abundance;
                          clMap.set(cl, e);
                        }
                        const totN = transectoFaunaData.rows.length;
                        const totAb = transectoFaunaData.totalAbundance;
                        return Array.from(clMap.entries())
                          .sort((a, b) => a[0].localeCompare(b[0], "es"))
                          .map(([cl, {n, ab}]) => (
                            <tr key={cl} className="hover:bg-gray-50">
                              <td className="px-4 py-2 font-medium">{cl}</td>
                              <td className="px-4 py-2 text-right">{n}</td>
                              <td className="px-4 py-2 text-right text-gray-500">{totN > 0 ? Math.round(n/totN*100) : 0}%</td>
                              <td className="px-4 py-2 text-right">{ab}</td>
                              <td className="px-4 py-2 text-right text-gray-500">{totAb > 0 ? Math.round(ab/totAb*100) : 0}%</td>
                            </tr>
                          ));
                      })()}
                    </tbody>
                    <tfoot>
                      <tr className="font-bold border-t-2 border-gray-300 bg-gray-50">
                        <td className="px-4 py-2">Total</td>
                        <td className="px-4 py-2 text-right">{transectoFaunaData.rows.length}</td>
                        <td className="px-4 py-2 text-right">100%</td>
                        <td className="px-4 py-2 text-right">{transectoFaunaData.totalAbundance}</td>
                        <td className="px-4 py-2 text-right">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
            </>
          )}


          {/* ── TRANSECTO FAUNA: parámetros comunitarios ── */}
          {isTransectoFauna && communityParamsData && communityParamsData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Parámetros Comunitarios por Transecto</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Transectos</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Riqueza (S)</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Abundancia (N)</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Shannon (H&apos;)</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Equidad (J&apos;)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {communityParamsData.map((row) => (
                        <tr key={row.name} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium">{row.name}</td>
                          <td className="px-3 py-2 text-right font-mono">{row.S}</td>
                          <td className="px-3 py-2 text-right font-mono">{row.N}</td>
                          <td className="px-3 py-2 text-right font-mono">{fmt3(row.H)}</td>
                          <td className="px-3 py-2 text-right font-mono">{row.J !== null ? fmt3(row.J) : <span className="text-gray-300 font-mono">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── TRANSECTO FAUNA: origen summary ── */}
          {isTransectoFauna && transectoFaunaData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Tabla resumen del origen de las especies
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left px-4 py-2 font-semibold text-gray-600">Origen</th>
                        <th className="text-right px-4 py-2 font-semibold text-gray-600">Cantidad de especies</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {transectoFaunaData.origenRows.map(([origen, count]) => (
                        <tr key={origen} className="hover:bg-gray-50">
                          <td className="px-4 py-2">{origen}</td>
                          <td className="px-4 py-2 text-right font-medium">{count}</td>
                        </tr>
                      ))}
                      {transectoFaunaData.origenRows.length === 0 && (
                        <tr><td colSpan={2} className="px-4 py-4 text-center text-gray-400 text-xs">Sin datos de origen</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── SAG: reporte de anillamiento para trampas Sherman ── */}
          {shermanData && shermanData.rows.length > 0 && (
            <>
              {shermanData.unresolvedSpecies.length > 0 && (
                <Card className="border-orange-200 bg-orange-50">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-orange-800">
                          {shermanData.unresolvedSpecies.length} especie{shermanData.unresolvedSpecies.length !== 1 ? "s" : ""} sin origen definido — no se puede exportar el reporte SAG
                        </p>
                        <p className="text-xs text-orange-700 mt-0.5">
                          El &quot;Estado final&quot; depende del origen (Nativo/Introducido). Complétalo en{" "}
                          <a href="/admin/especies" className="underline font-medium">Especies</a>.
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {shermanData.unresolvedSpecies.map((sp) => (
                            <span key={sp.id} className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full italic">
                              {sp.genus} {sp.species}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">Reporte SAG — Anillamiento (Trampas Sherman)</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setShermanDialogOpen(true)}
                    disabled={shermanData.unresolvedSpecies.length > 0}
                  >
                    <FileSpreadsheet className="h-4 w-4" /> Exportar SAG
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <p className="text-xs text-gray-500 px-4 pb-2">
                    Un registro por ejemplar capturado. Las columnas de liberación solo se llenan en actividades de relocalización.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          {["N° Res. SAG", "Fecha Res. SAG", "Taxón", "Nombre Científico", "Sexo", "Edad", "Marca", "Cód. (Marca)",
                            "Fecha Captura", "Sitio Captura", "Comuna", "Región", "Este Captura", "Sur Captura", "Huso"].map((h) => (
                            <th key={h} className="text-left px-2.5 py-2 font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                          ))}
                          <th colSpan={7} className="text-center px-2.5 py-1.5 font-medium text-gray-500 bg-gray-100 whitespace-nowrap">
                            Solo relocalización
                          </th>
                          <th className="text-left px-2.5 py-2 font-semibold text-gray-600 whitespace-nowrap">Estado final</th>
                          <th className="text-left px-2.5 py-2 font-semibold text-gray-600 whitespace-nowrap">Observaciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {shermanData.rows.map((row) => (
                          <tr key={row.key} className="hover:bg-gray-50">
                            <td className="px-2.5 py-1.5 text-gray-300">—</td>
                            <td className="px-2.5 py-1.5 text-gray-300">—</td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap">Micromamíferos</td>
                            <td className="px-2.5 py-1.5 italic whitespace-nowrap">{row.sp.genus} {row.sp.species}</td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap">Indefinido</td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap">Indefinido</td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap">Sin Marca</td>
                            <td className="px-2.5 py-1.5">-</td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap font-mono">{fmtDateDMY(row.date)}</td>
                            <td className="px-2.5 py-1.5 font-mono">{row.trapLabel}</td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap">{selectedProject?.commune}</td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap">{selectedProject?.region}</td>
                            <td className="px-2.5 py-1.5 font-mono">{row.utm?.east ?? "—"}</td>
                            <td className="px-2.5 py-1.5 font-mono">{row.utm?.north ?? "—"}</td>
                            <td className="px-2.5 py-1.5 font-mono">{row.utm ? row.utm.zone.replace(/[NS]$/, "") : "—"}</td>
                            <td colSpan={7} className="px-2.5 py-1.5 bg-gray-50"></td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap">{estadoFinalFor(row.sp)}</td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap">Sin observaciones</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Dialog open={shermanDialogOpen} onOpenChange={setShermanDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Exportar reporte SAG</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="sherman-res-number">N° Resolución SAG</Label>
                      <Input
                        id="sherman-res-number"
                        value={shermanResNumber}
                        onChange={(e) => setShermanResNumber(e.target.value)}
                        placeholder="Ej: 205/2024"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sherman-res-date">Fecha Resolución SAG</Label>
                      <Input
                        id="sherman-res-date"
                        value={shermanResDate}
                        onChange={(e) => setShermanResDate(e.target.value)}
                        placeholder="Ej: 28/02/2025"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShermanDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={exportShermanSAG}>Exportar</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}

          {/* ── RESCATE: capturas agrupadas por clase ── */}
          {isRescate && rescateData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Registros de Captura por Clase Taxonómica</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Clase</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Orden</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Familia</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap italic">Especie</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Nombre Común</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Código</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Estación</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">E.C.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(() => {
                        let lastClase = "";
                        return rescateData.rows.map((row, i) => {
                          const showClaseHeader = row.sp.clase !== lastClase;
                          lastClase = row.sp.clase ?? "";
                          return (
                            <>
                              {showClaseHeader && (
                                <tr key={`clase-${i}`} className="bg-blue-50 border-t border-blue-200">
                                  <td colSpan={8} className="px-3 py-1.5 font-semibold text-blue-800 text-xs uppercase tracking-wide">
                                    {row.sp.clase || "Sin clasificar"}
                                  </td>
                                </tr>
                              )}
                              <tr key={row.individualCode} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-gray-500">{row.sp.clase ?? "—"}</td>
                                <td className="px-3 py-2 text-gray-500">{row.sp.orden ?? "—"}</td>
                                <td className="px-3 py-2">{row.sp.family}</td>
                                <td className="px-3 py-2 italic font-medium whitespace-nowrap">{row.sp.genus} {row.sp.species}</td>
                                <td className="px-3 py-2 text-gray-500">{row.sp.commonName ?? "—"}</td>
                                <td className="px-3 py-2 text-center font-mono font-semibold text-orange-700">{row.individualCode}</td>
                                <td className="px-3 py-2 text-center text-gray-500">{row.stationName}</td>
                                <td className="px-3 py-2 text-center">{statusBadge(row.sp.conservationStatus)}</td>
                              </tr>
                            </>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                  {rescateData.rows.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-8">Sin capturas registradas</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Generic species table (non-BB methodologies) ── */}
          {!isBB && !isMicroruteo && !isPF && !isGrilla && !isTransectoFauna && !isRescate && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Lista de Especies</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left px-4 py-2 font-medium text-gray-600">Especie</th>
                        <th className="text-left px-4 py-2 font-medium text-gray-600 hidden sm:table-cell">Nombre Común</th>
                        <th className="text-center px-4 py-2 font-medium text-gray-600">Conserv.</th>
                        <th className="text-right px-4 py-2 font-medium text-gray-600">Registros</th>
                        <th className="text-right px-4 py-2 font-medium text-gray-600">Indivs.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {stats.speciesList.map(({ sp, count, abundance }) => (
                        <tr key={sp.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 italic font-medium">{sp.genus} {sp.species}</td>
                          <td className="px-4 py-2 text-gray-500 hidden sm:table-cell">{sp.commonName ?? "—"}</td>
                          <td className="px-4 py-2 text-center">{statusBadge(sp.conservationStatus)}</td>
                          <td className="px-4 py-2 text-right font-medium">{count}</td>
                          <td className="px-4 py-2 text-right font-medium">{abundance}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      )}

      {!projectId && (
        <Card>
          <CardContent className="py-10 text-center text-gray-400">
            <BarChart2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Selecciona un proyecto y campaña para ver el reporte</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
