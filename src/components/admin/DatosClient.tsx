"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { ArrowUp, ArrowDown, ArrowUpDown, Search } from "lucide-react";
import { getMethodologyById } from "@/lib/methodologies";
import { getRegionById } from "@/lib/chile-data";
import { cn } from "@/lib/utils";

// ── Payload (built in /admin/datos/page.tsx) ──
export interface DatosPayload {
  projects: { id: string; name: string; region: string; commune: string; status: string }[];
  campaigns: {
    id: string; name: string; projectId: string; projectIdx: number; surveyType: string;
    methodology: string; status: string; startDate: string; endDate: string;
  }[];
  stations: { c: number; r: number }[];        // campaign index, réplica index
  species: {
    name: string; commonName: string | null; family: string; type: string;
    conservation: string | null; origen: string | null; clase: string | null;
  }[];
  // [station index, species index, month "YYYY-MM", records, abundance]
  rows: [number, number, string, number, number][];
}

// ── Colors (validated with the dataviz palette checks on a white surface) ──
const FLORA = "#008300";
const FAUNA = "#6250d6";
const CRITICAL = "#d03b3b";     // status: threatened species (always shown with its label)
const DEEMPH = "#c3c2b7";       // de-emphasis gray
const GRID = "#e1e0d9";
const AXIS = "#898781";
const INK2 = "#52514e";
const SURFACE = "#ffffff";

const typeColor = (t: string) => (t === "FAUNA" ? FAUNA : FLORA);
const fmt = (n: number) => n.toLocaleString("es-CL");

// ── Conservation status (Chile RCE / IUCN codes) ──
const CONS_ORDER = ["EX", "CR", "EN", "VU", "NT", "LC", "DD", "NE", "NA", "SD"] as const;
type ConsCode = typeof CONS_ORDER[number];
const CONS_LABEL: Record<ConsCode, string> = {
  EX: "Extinta", CR: "En peligro crítico", EN: "En peligro", VU: "Vulnerable",
  NT: "Casi amenazada", LC: "Preocupación menor", DD: "Datos insuficientes",
  NE: "No evaluada", NA: "No aplica", SD: "Sin dato",
};
const THREATENED = new Set<ConsCode>(["CR", "EN", "VU"]);

function consCode(s: string | null): ConsCode {
  // "EN-R", "VU-R" and mixed texts like "EN (JF), LC (Chile continental)" use their first code
  const m = (s ?? "").toUpperCase().match(/\b(EX|CR|EN|VU|NT|LC|DD|NE|NA)\b/);
  return (m?.[1] as ConsCode) ?? "SD";
}

const ORIGENES = ["Endémico", "Nativo", "Introducido", "Sin dato"] as const;
type Origen = typeof ORIGENES[number];
function origenOf(s: string | null): Origen {
  const v = (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (v.startsWith("end")) return "Endémico";
  if (v.startsWith("nat")) return "Nativo";
  if (v.startsWith("intro")) return "Introducido";
  return "Sin dato";
}

function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("es-CL", { month: "short", year: "2-digit" });
}

const truncate = (s: string, n = 22) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

type TypeFilter = "ALL" | "FLORA" | "FAUNA";

export function DatosClient({ data }: { data: DatosPayload }) {
  const [type, setType] = useState<TypeFilter>("ALL");
  const [projectId, setProjectId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [region, setRegion] = useState("");
  const [monthFrom, setMonthFrom] = useState("");
  const [monthTo, setMonthTo] = useState("");

  const speciesMeta = useMemo(() => data.species.map(s => ({
    ...s, cons: consCode(s.conservation), origenN: origenOf(s.origen),
  })), [data.species]);

  // ── Filter options ──
  const regionOptions = useMemo(() => {
    const ids = [...new Set(data.projects.map(p => p.region).filter(Boolean))];
    return ids.map(id => ({ value: id, label: getRegionById(id)?.name ?? id }))
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, [data.projects]);
  const projectOptions = data.projects
    .filter(p => !region || p.region === region)
    .map(p => ({ value: p.id, label: p.name }));
  const effectiveProjectId = projectOptions.some(o => o.value === projectId) ? projectId : "";
  const campaignOptions = data.campaigns
    .filter(c => (!effectiveProjectId || c.projectId === effectiveProjectId)
      && (!region || data.projects[c.projectIdx]?.region === region)
      && (type === "ALL" || c.surveyType === type))
    .map(c => ({ value: c.id, label: `${c.name} · ${data.projects[c.projectIdx]?.name ?? ""}` }));
  const effectiveCampaignId = campaignOptions.some(o => o.value === campaignId) ? campaignId : "";

  // ── One pass over the filtered rows builds every aggregate below ──
  const agg = useMemo(() => {
    const totals = { records: 0 };
    const projects = new Set<number>(), campaigns = new Set<number>(), replicas = new Set<number>();
    const species = new Map<number, { records: number; ab: number; projects: Set<number>; campaigns: Set<number> }>();
    const byMonth = new Map<string, { flora: number; fauna: number }>();
    const byProject = new Map<number, { flora: number; fauna: number; species: Set<number>; replicas: Set<number>; campaigns: Set<number> }>();
    const byCampaign = new Map<number, { records: number; species: Set<number>; replicas: Set<number> }>();
    const byMethod = new Map<string, number>();

    for (const [s, sp, month, n, ab] of data.rows) {
      const st = data.stations[s];
      const camp = data.campaigns[st.c];
      const meta = speciesMeta[sp];
      const proj = data.projects[camp.projectIdx];
      if (type !== "ALL" && meta.type !== type) continue;
      if (effectiveProjectId && camp.projectId !== effectiveProjectId) continue;
      if (effectiveCampaignId && camp.id !== effectiveCampaignId) continue;
      if (region && proj?.region !== region) continue;
      if (monthFrom && month < monthFrom) continue;
      if (monthTo && month > monthTo) continue;

      totals.records += n;
      projects.add(camp.projectIdx);
      campaigns.add(st.c);
      replicas.add(st.r);

      const spAcc = species.get(sp) ?? { records: 0, ab: 0, projects: new Set(), campaigns: new Set() };
      spAcc.records += n; spAcc.ab += ab; spAcc.projects.add(camp.projectIdx); spAcc.campaigns.add(st.c);
      species.set(sp, spAcc);

      const isFauna = meta.type === "FAUNA";
      const mAcc = byMonth.get(month) ?? { flora: 0, fauna: 0 };
      if (isFauna) mAcc.fauna += n; else mAcc.flora += n;
      byMonth.set(month, mAcc);

      const pAcc = byProject.get(camp.projectIdx) ?? { flora: 0, fauna: 0, species: new Set(), replicas: new Set(), campaigns: new Set() };
      if (isFauna) pAcc.fauna += n; else pAcc.flora += n;
      pAcc.species.add(sp); pAcc.replicas.add(st.r); pAcc.campaigns.add(st.c);
      byProject.set(camp.projectIdx, pAcc);

      const cAcc = byCampaign.get(st.c) ?? { records: 0, species: new Set(), replicas: new Set() };
      cAcc.records += n; cAcc.species.add(sp); cAcc.replicas.add(st.r);
      byCampaign.set(st.c, cAcc);

      byMethod.set(camp.methodology, (byMethod.get(camp.methodology) ?? 0) + n);
    }

    const isThreat = (sp: number) => THREATENED.has(speciesMeta[sp].cons);
    const threatened = [...species.keys()].filter(isThreat);
    const endemic = [...species.keys()].filter(sp => speciesMeta[sp].origenN === "Endémico");

    // Months: fill the gaps so the time axis is continuous
    const monthKeys = [...byMonth.keys()].sort();
    const months: { key: string; label: string; flora: number; fauna: number }[] = [];
    if (monthKeys.length > 0) {
      let [y, m] = monthKeys[0].split("-").map(Number);
      const last = monthKeys[monthKeys.length - 1];
      for (let i = 0; i < 120; i++) {
        const key = `${y}-${String(m).padStart(2, "0")}`;
        const v = byMonth.get(key) ?? { flora: 0, fauna: 0 };
        months.push({ key, label: monthLabel(key), ...v });
        if (key >= last) break;
        m++; if (m > 12) { m = 1; y++; }
      }
    }

    // Species counts per conservation category and origin (distinct species)
    const cons = new Map<ConsCode, number>();
    const origen = new Map<Origen, { flora: number; fauna: number }>();
    const faunaClase = new Map<string, number>();
    const floraFamily = new Map<string, number>();
    for (const sp of species.keys()) {
      const meta = speciesMeta[sp];
      cons.set(meta.cons, (cons.get(meta.cons) ?? 0) + 1);
      const o = origen.get(meta.origenN) ?? { flora: 0, fauna: 0 };
      if (meta.type === "FAUNA") o.fauna++; else o.flora++;
      origen.set(meta.origenN, o);
      if (meta.type === "FAUNA") faunaClase.set(meta.clase || "Sin clase", (faunaClase.get(meta.clase || "Sin clase") ?? 0) + 1);
      else floraFamily.set(meta.family || "Sin familia", (floraFamily.get(meta.family || "Sin familia") ?? 0) + 1);
    }

    const topN = (m: Map<string, number>, n: number) => {
      const sorted = [...m.entries()].sort((a, b) => b[1] - a[1]);
      const head = sorted.slice(0, n).map(([name, count]) => ({ name, count }));
      const rest = sorted.slice(n).reduce((s, [, c]) => s + c, 0);
      return rest > 0 ? [...head, { name: `Otras (${sorted.length - n})`, count: rest }] : head;
    };

    return {
      totals, projects, campaigns, replicas, species, threatened, endemic, months, byProject, byCampaign,
      methods: [...byMethod.entries()]
        .map(([id, count]) => {
          const m = getMethodologyById(id);
          return { name: m?.name ?? id, type: m?.surveyType ?? "FLORA", count };
        })
        .sort((a, b) => b.count - a.count),
      cons: CONS_ORDER.filter(c => cons.has(c)).map(c => ({
        code: c, name: `${CONS_LABEL[c]} (${c})`, count: cons.get(c)!, threatened: THREATENED.has(c),
      })),
      origen: ORIGENES.filter(o => origen.has(o)).map(o => ({ name: o, ...origen.get(o)! })),
      faunaClase: topN(faunaClase, 10),
      floraFamily: topN(floraFamily, 10),
    };
  }, [data, speciesMeta, type, effectiveProjectId, effectiveCampaignId, region, monthFrom, monthTo]);

  const showFlora = type !== "FAUNA";
  const showFauna = type !== "FLORA";

  const kpis = [
    { label: "Registros", value: agg.totals.records },
    { label: "Especies registradas", value: agg.species.size },
    { label: "Especies amenazadas", value: agg.threatened.length, hint: "CR, EN o VU" },
    { label: "Especies endémicas", value: agg.endemic.length },
    { label: "Proyectos", value: agg.projects.size },
    { label: "Campañas", value: agg.campaigns.size },
    { label: "Réplicas", value: agg.replicas.size },
  ];

  const empty = agg.totals.records === 0;

  return (
    <div className="space-y-4">
      {/* Filtros: una fila sobre todo el contenido */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="inline-flex rounded-lg border border-gray-200 p-0.5">
            {([
              { value: "ALL", label: "Flora y fauna" },
              { value: "FLORA", label: "Flora" },
              { value: "FAUNA", label: "Fauna" },
            ] as const).map(o => (
              <button
                key={o.value}
                onClick={() => setType(o.value)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  type === o.value ? "bg-teal-700 text-white" : "text-gray-600 hover:bg-gray-100",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Field label="Región">
              <SearchableSelect options={regionOptions} value={region} onChange={setRegion}
                placeholder="Todas las regiones" allLabel="Todas las regiones" />
            </Field>
            <Field label="Proyecto">
              <SearchableSelect options={projectOptions} value={effectiveProjectId}
                onChange={(v) => { setProjectId(v); setCampaignId(""); }}
                placeholder="Todos los proyectos" allLabel="Todos los proyectos" />
            </Field>
            <Field label="Campaña">
              <SearchableSelect options={campaignOptions} value={effectiveCampaignId} onChange={setCampaignId}
                placeholder="Todas las campañas" allLabel="Todas las campañas" />
            </Field>
            <Field label="Desde (mes)">
              <Input type="month" value={monthFrom} onChange={(e) => setMonthFrom(e.target.value)} />
            </Field>
            <Field label="Hasta (mes)">
              <Input type="month" value={monthTo} onChange={(e) => setMonthTo(e.target.value)} />
            </Field>
          </div>
          <p className="text-xs text-gray-500">
            Se cuentan los registros según su fecha en terreno. Todo lo de abajo usa estos filtros.
          </p>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {kpis.map(k => (
          <Card key={k.label}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-gray-500 leading-tight">{k.label}</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{fmt(k.value)}</p>
              {k.hint && <p className="text-[11px] text-gray-400">{k.hint}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {empty ? (
        <Card><CardContent className="py-12 text-center text-sm text-gray-400">No hay registros para los filtros seleccionados</CardContent></Card>
      ) : (
        <>
          {/* Evolución */}
          <ChartCard
            title="Registros en el tiempo"
            subtitle="Por mes, según la fecha en terreno"
            legend={type === "ALL" ? [{ label: "Flora", color: FLORA }, { label: "Fauna", color: FAUNA }] : undefined}
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agg.months} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: AXIS }} axisLine={{ stroke: DEEMPH }} tickLine={false} minTickGap={12} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: AXIS }} axisLine={false} tickLine={false} tickFormatter={compact} />
                  <Tooltip cursor={{ fill: "rgba(11,11,11,0.04)" }} content={renderTooltip} />
                  {showFlora && (
                    <Bar isAnimationActive={false} dataKey="flora" name="Flora" stackId="t" fill={FLORA} maxBarSize={24}
                      stroke={SURFACE} strokeWidth={type === "ALL" ? 2 : 0}
                      radius={type === "FLORA" ? [4, 4, 0, 0] : 0} />
                  )}
                  {showFauna && (
                    <Bar isAnimationActive={false} dataKey="fauna" name="Fauna" stackId="t" fill={FAUNA} maxBarSize={24}
                      stroke={SURFACE} strokeWidth={type === "ALL" ? 2 : 0} radius={[4, 4, 0, 0]} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Por proyecto */}
            <ProjectsChart agg={agg} data={data} type={type} />

            {/* Estado de conservación */}
            <ChartCard
              title="Especies por estado de conservación"
              subtitle="Cantidad de especies distintas registradas"
              legend={[{ label: "Amenazadas (CR, EN, VU)", color: CRITICAL }, { label: "Otras categorías", color: DEEMPH }]}
            >
              <div style={{ height: Math.max(160, agg.cons.length * 34 + 16) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agg.cons} layout="vertical" margin={{ top: 0, right: 40, left: 8, bottom: 0 }}>
                    <CartesianGrid horizontal={false} stroke={GRID} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: AXIS }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={190} tick={catTick(27)} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: "rgba(11,11,11,0.04)" }} content={renderTooltip} />
                    <Bar isAnimationActive={false} dataKey="count" name="Especies" maxBarSize={20} radius={[0, 4, 4, 0]}>
                      {agg.cons.map(c => <Cell key={c.code} fill={c.threatened ? CRITICAL : DEEMPH} />)}
                      <LabelList dataKey="count" position="right" fill={INK2} fontSize={12} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Origen */}
            <ChartCard
              title="Especies por origen"
              subtitle="Cantidad de especies distintas registradas"
              legend={type === "ALL" ? [{ label: "Flora", color: FLORA }, { label: "Fauna", color: FAUNA }] : undefined}
            >
              <div style={{ height: Math.max(140, agg.origen.length * (type === "ALL" ? 52 : 36) + 16) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agg.origen} layout="vertical" margin={{ top: 0, right: 40, left: 8, bottom: 0 }} barGap={2}>
                    <CartesianGrid horizontal={false} stroke={GRID} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: AXIS }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={90} tick={catTick(12)} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: "rgba(11,11,11,0.04)" }} content={renderTooltip} />
                    {showFlora && (
                      <Bar isAnimationActive={false} dataKey="flora" name="Flora" fill={FLORA} maxBarSize={18} radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="flora" position="right" fill={INK2} fontSize={12} />
                      </Bar>
                    )}
                    {showFauna && (
                      <Bar isAnimationActive={false} dataKey="fauna" name="Fauna" fill={FAUNA} maxBarSize={18} radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="fauna" position="right" fill={INK2} fontSize={12} />
                      </Bar>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Metodología */}
            <ChartCard
              title="Registros por metodología"
              legend={[
                ...(showFlora && agg.methods.some(m => m.type === "FLORA") ? [{ label: "Flora", color: FLORA }] : []),
                ...(showFauna && agg.methods.some(m => m.type === "FAUNA") ? [{ label: "Fauna", color: FAUNA }] : []),
              ]}
            >
              <div style={{ height: Math.max(140, agg.methods.length * 34 + 16) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agg.methods} layout="vertical" margin={{ top: 0, right: 48, left: 8, bottom: 0 }}>
                    <CartesianGrid horizontal={false} stroke={GRID} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: AXIS }} axisLine={false} tickLine={false} tickFormatter={compact} />
                    <YAxis type="category" dataKey="name" width={150} tick={catTick(21)} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: "rgba(11,11,11,0.04)" }} content={renderTooltip} />
                    <Bar isAnimationActive={false} dataKey="count" name="Registros" maxBarSize={20} radius={[0, 4, 4, 0]}>
                      {agg.methods.map(m => <Cell key={m.name} fill={typeColor(m.type)} />)}
                      <LabelList dataKey="count" position="right" fill={INK2} fontSize={12} formatter={fmtLabel} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Grupos taxonómicos */}
            {showFauna && agg.faunaClase.length > 0 && (
              <GroupChart title="Fauna: especies por clase" rows={agg.faunaClase} color={FAUNA} />
            )}
            {showFlora && agg.floraFamily.length > 0 && (
              <GroupChart title="Flora: especies por familia" rows={agg.floraFamily} color={FLORA} />
            )}
          </div>

          <ProjectsTable agg={agg} data={data} speciesMeta={speciesMeta} />
          <CampaignsTable agg={agg} data={data} speciesMeta={speciesMeta} />
          <SpeciesTable agg={agg} speciesMeta={speciesMeta} />
        </>
      )}
    </div>
  );
}

type Agg = {
  species: Map<number, { records: number; ab: number; projects: Set<number>; campaigns: Set<number> }>;
  byProject: Map<number, { flora: number; fauna: number; species: Set<number>; replicas: Set<number>; campaigns: Set<number> }>;
  byCampaign: Map<number, { records: number; species: Set<number>; replicas: Set<number> }>;
};
type SpeciesMeta = DatosPayload["species"][number] & { cons: ConsCode; origenN: Origen };

// ── Charts ──

function ProjectsChart({ agg, data, type }: { agg: Agg; data: DatosPayload; type: TypeFilter }) {
  const rows = [...agg.byProject.entries()]
    .map(([p, v]) => ({ name: data.projects[p]?.name ?? "(proyecto eliminado)", flora: v.flora, fauna: v.fauna, total: v.flora + v.fauna }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);
  return (
    <ChartCard
      title="Registros por proyecto"
      subtitle={agg.byProject.size > 12 ? `Los 12 con más registros de ${agg.byProject.size}` : undefined}
      legend={type === "ALL" ? [{ label: "Flora", color: FLORA }, { label: "Fauna", color: FAUNA }] : undefined}
    >
      <div style={{ height: Math.max(140, rows.length * 34 + 16) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke={GRID} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: AXIS }} axisLine={false} tickLine={false} tickFormatter={compact} />
            <YAxis type="category" dataKey="name" width={170} tick={catTick(24)} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: "rgba(11,11,11,0.04)" }} content={renderTooltip} />
            {type !== "FAUNA" && (
              <Bar isAnimationActive={false} dataKey="flora" name="Flora" stackId="p" fill={FLORA} maxBarSize={20}
                stroke={SURFACE} strokeWidth={type === "ALL" ? 2 : 0} radius={type === "FLORA" ? [0, 4, 4, 0] : 0} />
            )}
            {type !== "FLORA" && (
              <Bar isAnimationActive={false} dataKey="fauna" name="Fauna" stackId="p" fill={FAUNA} maxBarSize={20}
                stroke={SURFACE} strokeWidth={type === "ALL" ? 2 : 0} radius={[0, 4, 4, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function GroupChart({ title, rows, color }: { title: string; rows: { name: string; count: number }[]; color: string }) {
  return (
    <ChartCard title={title} subtitle="Cantidad de especies distintas registradas">
      <div style={{ height: Math.max(140, rows.length * 30 + 16) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 40, left: 8, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke={GRID} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: AXIS }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={150} tick={catTick(21)} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: "rgba(11,11,11,0.04)" }} content={renderTooltip} />
            <Bar isAnimationActive={false} dataKey="count" name="Especies" fill={color} maxBarSize={18} radius={[0, 4, 4, 0]}>
              <LabelList dataKey="count" position="right" fill={INK2} fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

// ── Tables ──

function ProjectsTable({ agg, data, speciesMeta }: { agg: Agg; data: DatosPayload; speciesMeta: SpeciesMeta[] }) {
  type R = { key: string; name: string; region: string; campaigns: number; replicas: number; records: number; species: number; threatened: number };
  const rows: R[] = [...agg.byProject.entries()].map(([p, v]) => {
    const proj = data.projects[p];
    return {
      key: String(p),
      name: proj?.name ?? "(proyecto eliminado)",
      region: proj ? (getRegionById(proj.region)?.name ?? proj.region) : "—",
      campaigns: v.campaigns.size,
      replicas: v.replicas.size,
      records: v.flora + v.fauna,
      species: v.species.size,
      threatened: [...v.species].filter(sp => THREATENED.has(speciesMeta[sp].cons)).length,
    };
  });
  return (
    <SortableTable<R>
      title="Proyectos"
      rows={rows}
      rowKey={r => r.key}
      initial={{ key: "records", dir: "desc" }}
      cols={[
        { key: "name", label: "Proyecto", get: r => r.name, className: "font-medium text-gray-900" },
        { key: "region", label: "Región", get: r => r.region },
        { key: "campaigns", label: "Campañas", get: r => r.campaigns, numeric: true },
        { key: "replicas", label: "Réplicas", get: r => r.replicas, numeric: true },
        { key: "records", label: "Registros", get: r => r.records, numeric: true },
        { key: "species", label: "Especies", get: r => r.species, numeric: true },
        { key: "threatened", label: "Amenazadas", get: r => r.threatened, numeric: true },
      ]}
    />
  );
}

function CampaignsTable({ agg, data, speciesMeta }: { agg: Agg; data: DatosPayload; speciesMeta: SpeciesMeta[] }) {
  type R = {
    key: string; name: string; project: string; type: string; methodology: string; start: string;
    replicas: number; records: number; species: number; threatened: number;
  };
  const rows: R[] = [...agg.byCampaign.entries()].map(([c, v]) => {
    const camp = data.campaigns[c];
    return {
      key: camp.id,
      name: camp.name,
      project: data.projects[camp.projectIdx]?.name ?? "—",
      type: camp.surveyType,
      methodology: getMethodologyById(camp.methodology)?.name ?? camp.methodology,
      start: camp.startDate,
      replicas: v.replicas.size,
      records: v.records,
      species: v.species.size,
      threatened: [...v.species].filter(sp => THREATENED.has(speciesMeta[sp].cons)).length,
    };
  });
  return (
    <SortableTable<R>
      title="Campañas"
      rows={rows}
      rowKey={r => r.key}
      initial={{ key: "start", dir: "desc" }}
      limitStep={20}
      cols={[
        { key: "name", label: "Campaña", get: r => r.name, className: "font-medium text-gray-900" },
        { key: "project", label: "Proyecto", get: r => r.project },
        { key: "type", label: "Tipo", get: r => r.type, render: r => <TypeTag type={r.type} /> },
        { key: "methodology", label: "Metodología", get: r => r.methodology },
        { key: "start", label: "Inicio", get: r => r.start, render: r => fmtDay(r.start), numericLike: true },
        { key: "replicas", label: "Réplicas", get: r => r.replicas, numeric: true },
        { key: "records", label: "Registros", get: r => r.records, numeric: true },
        { key: "species", label: "Especies", get: r => r.species, numeric: true },
        { key: "threatened", label: "Amenazadas", get: r => r.threatened, numeric: true },
      ]}
    />
  );
}

function SpeciesTable({ agg, speciesMeta }: { agg: Agg; speciesMeta: SpeciesMeta[] }) {
  const [q, setQ] = useState("");
  type R = {
    key: string; name: string; commonName: string; type: string; family: string; cons: ConsCode;
    origen: string; records: number; ab: number; projects: number; campaigns: number;
  };
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const nq = norm(q.trim());
  const rows: R[] = [...agg.species.entries()]
    .map(([sp, v]) => {
      const m = speciesMeta[sp];
      return {
        key: String(sp), name: m.name, commonName: m.commonName ?? "", type: m.type, family: m.family,
        cons: m.cons, origen: m.origenN, records: v.records, ab: v.ab,
        projects: v.projects.size, campaigns: v.campaigns.size,
      };
    })
    .filter(r => !nq || norm(`${r.name} ${r.commonName} ${r.family}`).includes(nq));
  return (
    <SortableTable<R>
      title="Especies"
      headerExtra={
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar especie, nombre común o familia" className="pl-8" />
        </div>
      }
      rows={rows}
      rowKey={r => r.key}
      initial={{ key: "records", dir: "desc" }}
      limitStep={25}
      cols={[
        {
          key: "name", label: "Especie", get: r => r.name,
          render: r => (
            <div className="min-w-0">
              <p className="italic text-gray-900">{r.name}</p>
              {r.commonName && <p className="text-xs text-gray-500 truncate max-w-[220px]">{r.commonName}</p>}
            </div>
          ),
        },
        { key: "type", label: "Tipo", get: r => r.type, render: r => <TypeTag type={r.type} /> },
        { key: "family", label: "Familia", get: r => r.family },
        { key: "cons", label: "Estado", get: r => CONS_ORDER.indexOf(r.cons), render: r => <ConsTag code={r.cons} />, numericLike: true },
        { key: "origen", label: "Origen", get: r => r.origen },
        { key: "records", label: "Registros", get: r => r.records, numeric: true },
        { key: "ab", label: "Abundancia", get: r => r.ab, numeric: true },
        { key: "projects", label: "Proyectos", get: r => r.projects, numeric: true },
        { key: "campaigns", label: "Campañas", get: r => r.campaigns, numeric: true },
      ]}
    />
  );
}

// ── Building blocks ──

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      {children}
    </div>
  );
}

function ChartCard({ title, subtitle, legend, children }: {
  title: string; subtitle?: string; legend?: { label: string; color: string }[]; children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-gray-800">{title}</CardTitle>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        {legend && legend.length > 1 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
            {legend.map(l => (
              <span key={l.label} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

type TipProps = {
  active?: boolean;
  label?: string | number;
  payload?: { name?: string; value?: number; color?: string; fill?: string; payload?: { name?: string; fill?: string } }[];
};

// Value first (strong), series name second, keyed with a short line in the series color
function VizTooltip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null;
  const title = label ?? payload[0]?.payload?.name;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm text-xs">
      {title !== undefined && <p className="text-gray-500 mb-1">{String(title)}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-0.5 w-3 rounded" style={{ background: p.payload?.fill ?? p.color ?? p.fill }} />
          <span className="font-semibold text-gray-900 tabular-nums">{fmt(Number(p.value ?? 0))}</span>
          <span className="text-gray-500">{p.name}</span>
        </div>
      ))}
    </div>
  );
}
const renderTooltip = (p: unknown) => <VizTooltip {...(p as TipProps)} />;

// Category-axis label on one line (Recharts wraps long ticks otherwise); full text on hover
const catTick = (max: number) => function CatTick(p: unknown) {
  const { x, y, payload } = p as { x: number; y: number; payload?: { value?: string } };
  const v = String(payload?.value ?? "");
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={12} fill={INK2}>
      <title>{v}</title>
      {truncate(v, max)}
    </text>
  );
};

function compact(v: number) {
  return v >= 1000 ? `${Math.round(v / 100) / 10}K` : String(v);
}
function fmtLabel(v: unknown) {
  return fmt(Number(v));
}
function fmtDay(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}

function TypeTag({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-700">
      <span className="h-2 w-2 rounded-full" style={{ background: typeColor(type) }} />
      {type === "FAUNA" ? "Fauna" : "Flora"}
    </span>
  );
}

function ConsTag({ code }: { code: ConsCode }) {
  const threat = THREATENED.has(code);
  return (
    <span
      title={CONS_LABEL[code]}
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
        threat ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-gray-100 text-gray-600",
      )}
    >
      {code === "SD" ? "—" : code}
    </span>
  );
}

type SortDir = "asc" | "desc";
interface Col<T> {
  key: string;
  label: string;
  get: (r: T) => string | number;
  render?: (r: T) => ReactNode;
  numeric?: boolean;       // right-aligned, sorts largest first
  numericLike?: boolean;   // left-aligned, but first click sorts descending (dates, status order)
  className?: string;
}

function SortableTable<T>({ title, headerExtra, rows, cols, rowKey, initial, limitStep }: {
  title: string; headerExtra?: ReactNode; rows: T[]; cols: Col<T>[]; rowKey: (r: T) => string;
  initial: { key: string; dir: SortDir }; limitStep?: number;
}) {
  const [sort, setSort] = useState(initial);
  const [limit, setLimit] = useState(limitStep ?? Infinity);
  const col = cols.find(c => c.key === sort.key) ?? cols[0];
  const sorted = [...rows].sort((a, b) => {
    const va = col.get(a), vb = col.get(b);
    const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "es");
    return sort.dir === "asc" ? cmp : -cmp;
  });
  const visible = sorted.slice(0, limit);

  function toggle(c: Col<T>) {
    setSort(prev => prev.key === c.key
      ? { key: c.key, dir: prev.dir === "asc" ? "desc" : "asc" }
      : { key: c.key, dir: c.numeric || c.numericLike ? "desc" : "asc" });
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <CardTitle className="text-sm font-semibold text-gray-800">
          {title} <span className="font-normal text-gray-400">({fmt(rows.length)})</span>
        </CardTitle>
        {headerExtra}
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Sin resultados</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  {cols.map(c => {
                    const active = sort.key === c.key;
                    const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
                    return (
                      <TableHead key={c.key} className={c.numeric ? "text-right" : undefined}>
                        <button type="button" onClick={() => toggle(c)}
                          className={cn("inline-flex items-center gap-1 hover:text-gray-900", active && "text-gray-900 font-semibold")}>
                          {c.label}
                          <Icon className={cn("h-3.5 w-3.5", active ? "text-teal-700" : "text-gray-300")} />
                        </button>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map(r => (
                  <TableRow key={rowKey(r)}>
                    {cols.map(c => (
                      <TableCell key={c.key} className={cn(c.numeric && "text-right tabular-nums", c.className)}>
                        {c.render ? c.render(r) : (typeof c.get(r) === "number" ? fmt(c.get(r) as number) : c.get(r))}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {sorted.length > visible.length && (
              <div className="pt-3 text-center">
                <button onClick={() => setLimit(l => l + (limitStep ?? 25))} className="text-sm font-medium text-teal-700 hover:underline">
                  Mostrar más ({fmt(sorted.length - visible.length)} restantes)
                </button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
