"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Download, BarChart2, ListTree, Leaf, Bird } from "lucide-react";
import * as XLSX from "xlsx";
import { SURVEY_TYPE_LABELS } from "@/lib/types";
import { getMethodologyById } from "@/lib/methodologies";

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
  habito: string | null;
  origen: string | null;
  macrofitasHabito: string | null;
};

type OccurrenceRow = {
  id: string;
  abundance: number | null;
  cover: number | null;
  groupSize: number | null;
  methodologyData: string | null;
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
  stations: StationRow[];
};

type ProjectRow = {
  id: string;
  name: string;
  region: string;
  campaigns: CampaignRow[];
};

function primaryStatus(raw: string | null): string {
  if (!raw) return "LC";
  const m = raw.match(/^(CR|EN|VU|NT|LC|DD|EW|EX|NE|NA)/i);
  return m ? m[1].toUpperCase() : raw.slice(0, 6);
}

function statusBadge(raw: string | null) {
  const code = primaryStatus(raw);
  const cls =
    code === "CR" ? "bg-red-100 text-red-700" :
    code === "EN" ? "bg-orange-100 text-orange-700" :
    code === "VU" ? "bg-yellow-100 text-yellow-700" :
    code === "NT" ? "bg-blue-50 text-blue-600" :
    code === "LC" ? "bg-gray-100 text-gray-500" :
    "bg-gray-100 text-gray-600";
  return <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cls}`}>{code}</span>;
}

export function ReportesClient({ projects }: { projects: ProjectRow[] }) {
  const [projectId, setProjectId] = useState<string>("");
  const [campaignId, setCampaignId] = useState<string>("");

  const selectedProject = projects.find((p) => p.id === projectId);
  const campaigns = selectedProject?.campaigns ?? [];
  const selectedCampaign = campaigns.find((c) => c.id === campaignId);
  const isBB = selectedCampaign?.methodology === "BRAUN_BLANQUET";
  const isMicroruteo = selectedCampaign?.methodology === "MICRORUTEO";
  const isPF = selectedCampaign?.methodology === "PARCELAS_FORESTALES";
  const isGrilla = selectedCampaign?.methodology === "GRILLA";

  // ── Summary stats (all methodologies) ──
  const stats = (() => {
    if (!selectedCampaign) return null;
    const allOcc = isGrilla
      ? selectedCampaign.stations.flatMap((s) => (s.children ?? []).flatMap((c) => c.occurrences))
      : selectedCampaign.stations.flatMap((s) => s.occurrences);
    const speciesMap = new Map<string, { sp: SpeciesRow; count: number; abundance: number }>();
    for (const occ of allOcc) {
      const key = occ.species.id;
      const n = occ.abundance ?? occ.groupSize ?? 1;
      const ex = speciesMap.get(key);
      if (ex) { ex.count++; ex.abundance += n; }
      else speciesMap.set(key, { sp: occ.species, count: 1, abundance: n });
    }
    const speciesList = Array.from(speciesMap.values()).sort((a, b) => b.abundance - a.abundance);
    const stationData = isGrilla
      ? selectedCampaign.stations
          .flatMap((s) => s.children ?? [])
          .sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }))
          .map((g) => ({
            name: g.name,
            ocurrencias: g.occurrences.reduce((sum, o) => sum + (o.abundance ?? 0), 0),
          }))
      : selectedCampaign.stations.map((s) => ({
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
        ? selectedCampaign.stations.reduce((sum, s) => sum + (s.children?.length ?? 0), 0)
        : selectedCampaign.stations.length,
      speciesList,
      stationData,
      endangered,
    };
  })();

  // ── Parcelas (Braun-Blanquet) matrix ──
  const bbData = (() => {
    if (!selectedCampaign || !isBB) return null;
    const sortedStations = [...selectedCampaign.stations].sort((a, b) =>
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
    const rows = Array.from(speciesMap.values()).sort((a, b) => {
      const f = (a.sp.family || "").localeCompare(b.sp.family || "");
      return f !== 0 ? f : `${a.sp.genus} ${a.sp.species}`.localeCompare(`${b.sp.genus} ${b.sp.species}`);
    });
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
    const habitoRows = Array.from(habitoCounts.entries()).sort((a, b) => b[1] - a[1]);
    const origenRows = Array.from(origenCounts.entries()).sort((a, b) => b[1] - a[1]);

    return { sortedStations, rows, habitoRows, origenRows };
  })();

  // ── Microruteo: one row per occurrence with UTM ──
  const microData = (() => {
    if (!selectedCampaign || !isMicroruteo) return null;

    type MRow = { sp: SpeciesRow; individuo: number; utmEast: number | null; utmNorth: number | null };

    const raw: Omit<MRow, "individuo">[] = [];
    for (const station of selectedCampaign.stations) {
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

    raw.sort((a, b) => {
      const f = (a.sp.family || "").localeCompare(b.sp.family || "");
      return f !== 0 ? f : `${a.sp.genus} ${a.sp.species}`.localeCompare(`${b.sp.genus} ${b.sp.species}`);
    });

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
    const habitoRows = Array.from(habitoCounts.entries()).sort((a, b) => b[1] - a[1]);
    const origenRows = Array.from(origenCounts.entries()).sort((a, b) => b[1] - a[1]);

    return { rows, habitoRows, origenRows };
  })();

  // ── Grilla: species × grilla matrix + hydrophyte summary ──
  const grillaData = (() => {
    if (!selectedCampaign || !isGrilla) return null;

    const transectos = [...selectedCampaign.stations].sort((a, b) =>
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

    const rows = Array.from(speciesMap.values()).sort((a, b) => {
      const f = (a.sp.family || "").localeCompare(b.sp.family || "");
      return f !== 0 ? f : `${a.sp.genus} ${a.sp.species}`.localeCompare(`${b.sp.genus} ${b.sp.species}`);
    });

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

  // ── XLSX export (all tables, one sheet each) ──
  function exportXLSX() {
    if (!selectedCampaign || !stats) return;
    const wb = XLSX.utils.book_new();
    const fname = selectedCampaign.name.replace(/\s+/g, "_");

    function addSheet(name: string, rows: (string | number | null | undefined)[][]) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
    }

    if (isBB && bbData) {
      const { sortedStations, rows, habitoRows, origenRows } = bbData;
      addSheet("Parcelas BB", [
        ["División", "Clase", "Familia", "Especie", "Nombre Común", "Hábito", "Origen", "Estado Conservación", ...sortedStations.map((s) => s.name)],
        ...rows.map(({ sp, stMap }) => [
          sp.division ?? "", sp.clase ?? "", sp.family, `${sp.genus} ${sp.species}`,
          sp.commonName ?? "", sp.habito ?? "", sp.origen ?? "", primaryStatus(sp.conservationStatus),
          ...sortedStations.map((s) => stMap.get(s.id) ?? ""),
        ]),
      ]);
      addSheet("Hábito", [["Hábito", "N° Especies"], ...habitoRows.map(([h, n]) => [h, n])]);
      addSheet("Origen", [["Origen", "N° Especies"], ...origenRows.map(([o, n]) => [o, n])]);
    }

    if (isMicroruteo && microData) {
      const { rows, habitoRows, origenRows } = microData;
      addSheet("Microruteo", [
        ["División", "Clase", "Familia", "Especie", "Nombre Común", "Hábito", "Origen", "Estado Conservación", "Individuo", "Este (m E)", "Norte (m S)"],
        ...rows.map(({ sp, individuo, utmEast, utmNorth }) => [
          sp.division ?? "", sp.clase ?? "", sp.family, `${sp.genus} ${sp.species}`,
          sp.commonName ?? "", sp.habito ?? "", sp.origen ?? "", primaryStatus(sp.conservationStatus),
          individuo,
          utmEast != null ? Math.round(utmEast) : "",
          utmNorth != null ? Math.round(utmNorth) : "",
        ]),
      ]);
      addSheet("Hábito", [["Hábito", "N° Especies"], ...habitoRows.map(([h, n]) => [h, n])]);
      addSheet("Origen", [["Origen", "N° Especies"], ...origenRows.map(([o, n]) => [o, n])]);
    }

    if (isPF && pfData) {
      const { speciesRows, individualRows } = pfData;
      addSheet("Especies", [
        ["División", "Clase", "Familia", "Especie", "Nombre Común", "Hábito", "Origen", "Estado Conservación"],
        ...speciesRows.map((sp) => [
          sp.division ?? "", sp.clase ?? "", sp.family, `${sp.genus} ${sp.species}`,
          sp.commonName ?? "", sp.habito ?? "", sp.origen ?? "", primaryStatus(sp.conservationStatus),
        ]),
      ]);
      addSheet("Individuos", [
        ["Parcela", "Especie", "Individuo", "DAP (cm)", "DAT (cm)", "Altura (m)"],
        ...individualRows.map((r) => [
          r.parcela, `${r.sp.genus} ${r.sp.species}`, r.individuo, r.dap ?? "", r.dat ?? "", r.altura ?? "",
        ]),
      ]);
    }

    if (isGrilla && grillaData) {
      const { grillaStations, rows, sinVegPerGrilla, grillaHasData, hydroByTransecto } = grillaData;
      const gNames = grillaStations.map((g) => g.name);
      addSheet("Grilla", [
        ["División", "Clase", "Familia", "Especie", "Nombre Común", "Hábito", "Hábito Hidrófito", "Origen", "E.C.", ...gNames],
        ...rows.map(({ sp, perGrilla }) => [
          sp.division ?? "", sp.clase ?? "", sp.family, `${sp.genus} ${sp.species}`,
          sp.commonName ?? "", sp.habito ?? "", sp.macrofitasHabito ?? "", sp.origen ?? "",
          primaryStatus(sp.conservationStatus),
          ...grillaStations.map((g) => perGrilla.get(g.id) ?? ""),
        ]),
        ["", "", "", "", "", "", "", "", "Sin vegetación", ...grillaStations.map((g) => grillaHasData.has(g.id) ? (sinVegPerGrilla.get(g.id) ?? 0) : "")],
        ["", "", "", "", "", "", "", "", "Total", ...grillaStations.map((g) => grillaHasData.has(g.id) ? 16 : "")],
      ]);
      if (hydroByTransecto.length > 0) {
        const hydroRows: (string | number)[][] = [["Transecto", "Grilla", "Intersecciones Hidrófitas", "Sin Hidrófitas", "Total"]];
        for (const { transectoName, grillas, siCounts, noCounts } of hydroByTransecto) {
          for (let i = 0; i < grillas.length; i++) {
            hydroRows.push([transectoName, grillas[i].name, siCounts[i], noCounts[i], siCounts[i] + noCounts[i]]);
          }
        }
        addSheet("Hidrófitas", hydroRows);
        addSheet("Condición Humedal", [
          ["Transecto", "Intersecciones Hidrófitas", "Total Intersecciones", "% Hidrófitas", "Condición"],
          ...hydroByTransecto.map(({ transectoName, siTotal, grandTotal, siPct }) => [
            transectoName, siTotal, grandTotal, siPct / 100, siPct > 50 ? "Humedal" : "No Humedal",
          ]),
        ]);
      }
    }

    if (!isBB && !isMicroruteo && !isPF && !isGrilla) {
      addSheet("Lista de Especies", [
        ["Familia", "Género", "Especie", "Nombre Común", "Tipo", "Estado Conservación", "Nº Registros", "Abundancia Total"],
        ...stats.speciesList.map(({ sp, count, abundance }) => [
          sp.family, sp.genus, sp.species, sp.commonName ?? "", sp.type,
          primaryStatus(sp.conservationStatus), count, abundance,
        ]),
      ]);
    }

    if (stats.endangered.length > 0) {
      addSheet("Conservación", [
        ["Familia", "Especie", "Nombre Común", "Estado Conservación"],
        ...stats.endangered.map(({ sp }) => [
          sp.family, `${sp.genus} ${sp.species}`, sp.commonName ?? "", primaryStatus(sp.conservationStatus),
        ]),
      ]);
    }

    XLSX.writeFile(wb, `reporte_${fname}.xlsx`);
  }

  // ── Parcelas Forestales: species list + individuals ──
  const pfData = (() => {
    if (!selectedCampaign || !isPF) return null;

    type PFRow = { parcela: string; sp: SpeciesRow; individuo: number; dap: string; dat: string; altura: string };

    const individualRows: PFRow[] = [];
    const sortedStations = [...selectedCampaign.stations].sort((a, b) =>
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
    const speciesRows = Array.from(speciesMap.values()).sort((a, b) => {
      const f = (a.family || "").localeCompare(b.family || "");
      return f !== 0 ? f : `${a.genus} ${a.species}`.localeCompare(`${b.genus} ${b.species}`);
    });

    return { individualRows, speciesRows };
  })();


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
                      ? `${selectedCampaign.name} · ${getMethodologyById(selectedCampaign.methodology)?.name ?? selectedCampaign.methodology}`
                      : <span className="text-muted-foreground">
                          {selectedProject ? "Seleccionar campaña..." : "Primero elige proyecto"}
                        </span>}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="min-w-max">
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {getMethodologyById(c.methodology)?.name ?? c.methodology}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {stats && selectedCampaign && (
        <div className="space-y-4">

          {/* Export button */}
          <div className="flex justify-end">
            <Button variant="outline" size="sm" className="gap-2" onClick={exportXLSX}>
              <Download className="h-4 w-4" /> Exportar XLSX
            </Button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Especies únicas",  value: stats.totalSpecies,     icon: selectedCampaign.surveyType === "FLORA" ? Leaf : Bird, color: "text-green-600" },
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

          {/* ── Generic species table (non-BB methodologies) ── */}
          {!isBB && !isMicroruteo && !isPF && !isGrilla && (
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
