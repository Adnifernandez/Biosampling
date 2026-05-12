"use client";

import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Download, BarChart2, ListTree, Leaf, Bird } from "lucide-react";
import { SURVEY_TYPE_LABELS } from "@/lib/types";

type SpeciesRow = {
  id: string;
  genus: string;
  species: string;
  commonName: string | null;
  type: string;
  conservationStatus: string | null;
};

type OccurrenceRow = {
  id: string;
  abundance: number | null;
  cover: number | null;
  groupSize: number | null;
  species: SpeciesRow;
  user: { name: string };
};

type StationRow = {
  id: string;
  name: string;
  occurrences: OccurrenceRow[];
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

export function ReportesClient({ projects }: { projects: ProjectRow[] }) {
  const [projectId, setProjectId] = useState<string>("");
  const [campaignId, setCampaignId] = useState<string>("");

  const selectedProject = projects.find((p) => p.id === projectId);
  const campaigns = selectedProject?.campaigns ?? [];
  const selectedCampaign = campaigns.find((c) => c.id === campaignId);

  const stats = useMemo(() => {
    if (!selectedCampaign) return null;

    const allOccurrences = selectedCampaign.stations.flatMap((s) => s.occurrences);
    const speciesMap = new Map<string, { sp: SpeciesRow; count: number; abundance: number }>();

    for (const occ of allOccurrences) {
      const key = occ.species.id;
      const existing = speciesMap.get(key);
      const n = occ.abundance ?? occ.groupSize ?? 1;
      if (existing) {
        existing.count++;
        existing.abundance += n;
      } else {
        speciesMap.set(key, { sp: occ.species, count: 1, abundance: n });
      }
    }

    const speciesList = Array.from(speciesMap.values()).sort((a, b) => b.abundance - a.abundance);

    const stationData = selectedCampaign.stations.map((s) => ({
      name: s.name.length > 10 ? s.name.slice(0, 10) + "…" : s.name,
      ocurrencias: s.occurrences.length,
      individuos: s.occurrences.reduce((sum, o) => sum + (o.abundance ?? o.groupSize ?? 1), 0),
    }));

    const endangered = speciesList.filter((s) =>
      ["CR", "EN", "VU"].includes(s.sp.conservationStatus ?? "")
    );

    return {
      totalSpecies: speciesMap.size,
      totalOccurrences: allOccurrences.length,
      totalIndividuals: allOccurrences.reduce((s, o) => s + (o.abundance ?? o.groupSize ?? 1), 0),
      totalStations: selectedCampaign.stations.length,
      speciesList,
      stationData,
      endangered,
    };
  }, [selectedCampaign]);

  function exportCSV() {
    if (!stats || !selectedCampaign) return;
    const header = "Familia,Género,Especie,Nombre Común,Tipo,Estado Conservación,Nº Registros,Abundancia Total";
    const rows = stats.speciesList.map((row) =>
      [
        row.sp.id,
        row.sp.genus,
        row.sp.species,
        row.sp.commonName ?? "",
        row.sp.type,
        row.sp.conservationStatus ?? "LC",
        row.count,
        row.abundance,
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_${selectedCampaign.name.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Proyecto</label>
              <Select
                value={projectId}
                onValueChange={(v) => { setProjectId(v ?? ""); setCampaignId(""); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar proyecto..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Campaña</label>
              <Select
                value={campaignId}
                onValueChange={(v) => setCampaignId(v ?? "")}
                disabled={!selectedProject}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar campaña..." />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({SURVEY_TYPE_LABELS[c.surveyType as "FLORA" | "FAUNA"]})
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
          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Especies únicas", value: stats.totalSpecies, icon: selectedCampaign.surveyType === "FLORA" ? Leaf : Bird, color: "text-green-600" },
              { label: "Ocurrencias", value: stats.totalOccurrences, icon: ListTree, color: "text-blue-600" },
              { label: "Individuos", value: stats.totalIndividuals, icon: BarChart2, color: "text-orange-600" },
              { label: "Estaciones", value: stats.totalStations, icon: BarChart2, color: "text-purple-600" },
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

          {/* Species by station chart */}
          {stats.stationData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Ocurrencias por Estación</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.stationData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="ocurrencias" fill="#16a34a" name="Ocurrencias" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Endangered species alert */}
          {stats.endangered.length > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="py-3 px-4">
                <p className="text-sm font-medium text-orange-800 mb-1">
                  Especies de conservación prioritaria detectadas: {stats.endangered.length}
                </p>
                <div className="flex flex-wrap gap-1">
                  {stats.endangered.map((e) => (
                    <span
                      key={e.sp.id}
                      className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full"
                    >
                      {e.sp.genus} {e.sp.species} ({e.sp.conservationStatus})
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Species table */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Lista de Especies</CardTitle>
              <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV}>
                <Download className="h-4 w-4" />
                CSV
              </Button>
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
                        <td className="px-4 py-2 text-center">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            sp.conservationStatus === "CR" ? "bg-red-100 text-red-700" :
                            sp.conservationStatus === "EN" ? "bg-orange-100 text-orange-700" :
                            sp.conservationStatus === "VU" ? "bg-yellow-100 text-yellow-700" :
                            "bg-gray-100 text-gray-600"
                          }`}>
                            {sp.conservationStatus ?? "LC"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-medium">{count}</td>
                        <td className="px-4 py-2 text-right font-medium">{abundance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
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
