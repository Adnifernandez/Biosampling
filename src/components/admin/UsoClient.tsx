"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Layers, ClipboardList, FolderOpen, Users, AlertTriangle, Info, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

type UserRow = { id: string; name: string; email: string; active: boolean };
type ProjectRow = { id: string; name: string; createdBy: string | null };
type CampaignRow = {
  id: string; name: string; projectId: string;
  responsible: string | null; status: string; startDate: Date | string;
};
type RecordRow = {
  id: string; userId: string; campaignId: string; projectId: string;
  date: Date | string; createdAt: Date | string;
};

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

// Which date the period filter, chart and table use:
// "field" = fecha del registro en terreno (the date typed in the form),
// "upload" = when it reached the server (offline records count when they synced).
type DateBasis = "field" | "upload";

// Calendar day "yyyy-MM-dd" of a record for the chosen basis. The field date is
// stored as a date-only value at UTC midnight, so it's read in UTC (otherwise
// Chile's offset would shift it to the previous day).
function dayOf(r: RecordRow, basis: DateBasis): string {
  return basis === "field"
    ? new Date(r.date).toISOString().slice(0, 10)
    : format(new Date(r.createdAt), "yyyy-MM-dd");
}

function fmtDay(day: string | null | undefined): string {
  if (!day) return "—";
  return format(parseISO(day), "d MMM yyyy", { locale: es });
}

type SortKey = "project" | "user" | "campaigns" | "records" | "first" | "last";
type SortDir = "asc" | "desc";

export function UsoClient({
  users, projects, campaigns, records,
}: {
  users: UserRow[];
  projects: ProjectRow[];
  campaigns: CampaignRow[];
  records: RecordRow[];
}) {
  const [projectId, setProjectId] = useState("");
  const [userId, setUserId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [basis, setBasis] = useState<DateBasis>("field");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "project", dir: "asc" });

  function toggleSort(key: SortKey) {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
      // Dates and counts start with the most recent / largest first
      : { key, dir: key === "project" || key === "user" ? "asc" : "desc" });
  }

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const campaignOptions = useMemo(
    () => campaigns
      .filter((c) => !projectId || c.projectId === projectId)
      .map((c) => ({ value: c.id, label: c.name })),
    [campaigns, projectId]
  );

  // Reset campaign filter if it no longer belongs to the selected project
  const effectiveCampaignId = campaignOptions.some((c) => c.value === campaignId) ? campaignId : "";

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (projectId && r.projectId !== projectId) return false;
      if (userId && r.userId !== userId) return false;
      if (effectiveCampaignId && r.campaignId !== effectiveCampaignId) return false;
      const day = dayOf(r, basis);
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      return true;
    });
  }, [records, projectId, userId, effectiveCampaignId, dateFrom, dateTo, basis]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const campaignSet = new Set(filtered.map((r) => r.campaignId));
    const projectSet = new Set(filtered.map((r) => r.projectId));
    const userSet = new Set(filtered.map((r) => r.userId));
    return {
      campaigns: campaignSet.size,
      records: filtered.length,
      projects: projectSet.size,
      users: userSet.size,
    };
  }, [filtered]);

  // ── Overview per project: users, campaigns executed, records ──
  const projectOverview = useMemo(() => {
    type Acc = { users: Set<string>; campaigns: Set<string>; records: number };
    const map = new Map<string, Acc>();
    for (const r of filtered) {
      if (!map.has(r.projectId)) map.set(r.projectId, { users: new Set(), campaigns: new Set(), records: 0 });
      const acc = map.get(r.projectId)!;
      acc.users.add(r.userId);
      acc.campaigns.add(r.campaignId);
      acc.records++;
    }
    return Array.from(map.entries())
      .map(([pid, acc]) => ({
        projectId: pid,
        name: projectMap.get(pid)?.name ?? "(proyecto eliminado)",
        users: acc.users.size,
        campaigns: acc.campaigns.size,
        records: acc.records,
      }))
      .sort((a, b) => b.records - a.records);
  }, [filtered, projectMap]);

  // ── Records per user (chart) ──
  const byUserChart = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filtered) map.set(r.userId, (map.get(r.userId) ?? 0) + 1);
    return Array.from(map.entries())
      .map(([uid, count]) => ({ name: userMap.get(uid)?.name ?? "(usuario eliminado)", count }))
      .sort((a, b) => b.count - a.count);
  }, [filtered, userMap]);

  // ── Evolution over time (by month, on the chosen date) ──
  const evolutionChart = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filtered) {
      const key = dayOf(r, basis).slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => {
        const [y, m] = key.split("-").map(Number);
        const label = new Date(y, m - 1, 1).toLocaleDateString("es-CL", { month: "short", year: "2-digit" });
        return { key, label, count };
      });
  }, [filtered, basis]);

  // ── Detailed tracking table: Proyecto x Usuario ──
  const trackingRows = useMemo(() => {
    type Acc = { records: number; first: string; last: string };
    const map = new Map<string, Acc>();
    for (const r of filtered) {
      const key = `${r.projectId}::${r.userId}`;
      const day = dayOf(r, basis);
      const acc = map.get(key);
      if (acc) {
        acc.records++;
        if (day < acc.first) acc.first = day;
        if (day > acc.last) acc.last = day;
      } else {
        map.set(key, { records: 1, first: day, last: day });
      }
    }

    return Array.from(map.entries())
      .map(([key, acc]) => {
        const [pid, uid] = key.split("::");
        const project = projectMap.get(pid);
        const user = userMap.get(uid);
        const approxCampaigns = campaigns.filter((c) =>
          c.projectId === pid &&
          norm(c.responsible) === norm(user?.name) &&
          norm(c.responsible) !== "" &&
          (!effectiveCampaignId || c.id === effectiveCampaignId) &&
          (!dateFrom || new Date(c.startDate) >= new Date(`${dateFrom}T00:00:00`)) &&
          (!dateTo || new Date(c.startDate) <= new Date(`${dateTo}T23:59:59`))
        ).length;
        return {
          key,
          projectName: project?.name ?? "(proyecto eliminado)",
          userName: user?.name ?? "(usuario eliminado)",
          approxCampaigns,
          records: acc.records,
          first: acc.first,
          last: acc.last,
        };
      })
      .sort((a, b) => {
        const byName = a.projectName.localeCompare(b.projectName, "es") || a.userName.localeCompare(b.userName, "es");
        let cmp = 0;
        switch (sort.key) {
          case "project":   cmp = byName; break;
          case "user":      cmp = a.userName.localeCompare(b.userName, "es") || a.projectName.localeCompare(b.projectName, "es"); break;
          case "campaigns": cmp = a.approxCampaigns - b.approxCampaigns; break;
          case "records":   cmp = a.records - b.records; break;
          case "first":     cmp = a.first.localeCompare(b.first); break;
          case "last":      cmp = a.last.localeCompare(b.last); break;
        }
        return (sort.dir === "asc" ? cmp : -cmp) || byName;
      });
  }, [filtered, projectMap, userMap, campaigns, effectiveCampaignId, dateFrom, dateTo, basis, sort]);

  const projectOptions = projects.map((p) => ({ value: p.id, label: p.name }));
  const userOptions = users.map((u) => ({ value: u.id, label: u.name }));

  const kpiCards = [
    { label: "Campañas ejecutadas", value: kpis.campaigns, icon: Layers, color: "text-blue-600" },
    { label: "Registros generados", value: kpis.records, icon: ClipboardList, color: "text-purple-600" },
    { label: "Proyectos con actividad", value: kpis.projects, icon: FolderOpen, color: "text-teal-600" },
    { label: "Usuarios activos", value: kpis.users, icon: Users, color: "text-orange-600" },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Proyecto</Label>
              <SearchableSelect
                options={projectOptions}
                value={projectId}
                onChange={(v) => { setProjectId(v); setCampaignId(""); }}
                placeholder="Todos los proyectos"
                allLabel="Todos los proyectos"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Campaña</Label>
              <SearchableSelect
                options={campaignOptions}
                value={effectiveCampaignId}
                onChange={setCampaignId}
                placeholder="Todas las campañas"
                allLabel="Todas las campañas"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Usuario</Label>
              <SearchableSelect
                options={userOptions}
                value={userId}
                onChange={setUserId}
                placeholder="Todos los usuarios"
                allLabel="Todos los usuarios"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Desde</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Hasta</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Contar por:</span>
            <div className="inline-flex rounded-lg border border-gray-200 p-0.5 w-fit">
              {([
                { value: "field", label: "Fecha en terreno" },
                { value: "upload", label: "Fecha de carga al sistema" },
              ] as const).map(o => (
                <button
                  key={o.value}
                  onClick={() => setBasis(o.value)}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                    basis === o.value ? "bg-teal-700 text-white" : "text-gray-600 hover:bg-gray-100",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {basis === "field"
              ? "Se cuentan los registros cuya fecha en terreno (la que se anota en el formulario) está entre Desde y Hasta. "
              : "Se cuentan los registros que llegaron al sistema entre Desde y Hasta (los cargados sin señal cuentan el día en que se subieron). "}
            Los proyectos, campañas y usuarios que aparecen son los que tuvieron registros en ese período, no los creados en esas fechas.
          </p>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiCards.map(({ label, value, icon: Icon, color }) => (
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

      {/* Evolution chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-800">Evolución de registros en el tiempo</CardTitle>
        </CardHeader>
        <CardContent>
          {evolutionChart.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No hay registros para los filtros seleccionados</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={evolutionChart} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v) => [String(v), "Registros"]}
                    labelStyle={{ color: "#111827", fontWeight: 500 }}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
                  />
                  <Bar dataKey="count" fill="#16a34a" name="Registros" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Records per user */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-800">Registros por usuario</CardTitle>
          </CardHeader>
          <CardContent>
            {byUserChart.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sin datos</p>
            ) : (
              <div style={{ height: Math.max(160, byUserChart.length * 32) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={byUserChart}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={110}
                      tick={{ fontSize: 12, fill: "#374151" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(v) => [String(v), "Registros"]}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
                    />
                    <Bar dataKey="count" fill="#16a34a" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overview per project */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-800">Resumen por proyecto</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {projectOverview.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sin datos</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proyecto</TableHead>
                    <TableHead className="text-right">Usuarios</TableHead>
                    <TableHead className="text-right">Campañas</TableHead>
                    <TableHead className="text-right">Registros</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectOverview.map((p) => (
                    <TableRow key={p.projectId}>
                      <TableCell className="font-medium text-gray-900">{p.name}</TableCell>
                      <TableCell className="text-right">{p.users}</TableCell>
                      <TableCell className="text-right">{p.campaigns}</TableCell>
                      <TableCell className="text-right">{p.records}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed tracking table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-800">Seguimiento por proyecto y usuario</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {trackingRows.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No hay registros para los filtros seleccionados</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><SortButton label="Proyecto" k="project" sort={sort} onSort={toggleSort} /></TableHead>
                  <TableHead><SortButton label="Usuario" k="user" sort={sort} onSort={toggleSort} /></TableHead>
                  <TableHead className="text-right">
                    <span className="inline-flex items-center gap-1 justify-end">
                      <SortButton label="Campañas creadas" k="campaigns" sort={sort} onSort={toggleSort} />
                      <span
                        title="Aproximado: se calcula comparando el nombre del usuario con el campo de texto libre 'Responsable' de cada campaña, usando su fecha de inicio para el período. No existe en la base de datos un registro directo de quién creó cada campaña."
                      >
                        <Info className="h-3.5 w-3.5 text-gray-400" />
                      </span>
                    </span>
                  </TableHead>
                  <TableHead className="text-right"><SortButton label="Registros" k="records" sort={sort} onSort={toggleSort} /></TableHead>
                  <TableHead><SortButton label="Primer registro" k="first" sort={sort} onSort={toggleSort} /></TableHead>
                  <TableHead><SortButton label="Último registro" k="last" sort={sort} onSort={toggleSort} /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trackingRows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="font-medium text-gray-900">{r.projectName}</TableCell>
                    <TableCell>{r.userName}</TableCell>
                    <TableCell className="text-right">{r.approxCampaigns}</TableCell>
                    <TableCell className="text-right">{r.records}</TableCell>
                    <TableCell className="text-gray-600">{fmtDay(r.first)}</TableCell>
                    <TableCell className="text-gray-600">{fmtDay(r.last)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Data gaps callout */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1.5 text-sm text-amber-900">
              <p className="font-semibold">Datos que faltan registrar para un seguimiento exacto</p>
              <ul className="list-disc pl-4 space-y-1 text-amber-800">
                <li>
                  <strong>Quién creó cada campaña:</strong> el modelo <code>Campaign</code> no tiene una relación con
                  el usuario que la creó, solo un campo de texto libre (&quot;Responsable&quot;). La columna
                  &quot;Campañas creadas&quot; de la tabla es una aproximación por coincidencia de nombre, no un dato validado.
                </li>
                <li>
                  <strong>Quién creó cada proyecto:</strong> el campo <code>Project.createdBy</code> también es texto libre,
                  sin vínculo con la tabla de usuarios.
                </li>
                <li>
                  <strong>Usuarios asignados a un proyecto:</strong> no existe una lista explícita de miembros por
                  proyecto; &quot;usuarios por proyecto&quot; se infiere solo a partir de quiénes han creado ocurrencias en ese proyecto.
                </li>
                <li>
                  <strong>Actividad general de la app:</strong> no se registran inicios de sesión ni uso de pantallas,
                  por lo que este dashboard mide únicamente la creación de ocurrencias (registros de terreno), no el uso completo de la aplicación.
                </li>
                <li>
                  <strong>Quién creó cada estación:</strong> el modelo <code>Station</code> tampoco registra su creador.
                </li>
              </ul>
              <p className="text-xs text-amber-700 pt-1">
                Para resolverlo, se recomienda agregar campos <code>createdById</code> (relación a <code>User</code>) en
                los modelos <code>Campaign</code>, <code>Project</code> y <code>Station</code>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SortButton({ label, k, sort, onSort }: {
  label: string; k: SortKey; sort: { key: SortKey; dir: SortDir }; onSort: (k: SortKey) => void;
}) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(k)}
      className={cn("inline-flex items-center gap-1 hover:text-gray-900", active && "text-gray-900 font-semibold")}
    >
      {label}
      <Icon className={cn("h-3.5 w-3.5", active ? "text-teal-700" : "text-gray-300")} />
    </button>
  );
}
