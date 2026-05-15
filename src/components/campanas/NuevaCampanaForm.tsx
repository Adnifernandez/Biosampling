"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sun, Leaf, Snowflake, Flower2, Bird } from "lucide-react";
import { METHODOLOGIES } from "@/lib/methodologies";
import { createCampana } from "@/app/(app)/campanas/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SEASONS = [
  { id: "Verano",    label: "Verano",    icon: Sun,       color: "text-yellow-500" },
  { id: "Otoño",     label: "Otoño",     icon: Leaf,      color: "text-orange-500" },
  { id: "Invierno",  label: "Invierno",  icon: Snowflake, color: "text-blue-400"   },
  { id: "Primavera", label: "Primavera", icon: Flower2,   color: "text-pink-400"   },
];

type Project = { id: string; name: string };

export function NuevaCampanaForm({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const year = new Date().getFullYear();

  const [projectId, setProjectId] = useState("");
  const [season, setSeason] = useState("Verano");
  const [suffix, setSuffix] = useState("");
  const [surveyType, setSurveyType] = useState<"FLORA" | "FAUNA">("FLORA");
  const [methodology, setMethodology] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const finalName = suffix.trim()
    ? `${season} ${year} — ${suffix.trim()}`
    : `${season} ${year}`;

  const methodologies = METHODOLOGIES.filter((m) => m.surveyType === surveyType);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!projectId) { toast.error("Selecciona un proyecto"); return; }
    if (!methodology) { toast.error("Selecciona una metodología"); return; }

    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    fd.set("projectId", projectId);
    fd.set("season", season);
    fd.set("surveyType", surveyType);
    fd.set("methodology", methodology);

    const result = await createCampana(fd);
    setSubmitting(false);

    if (result.error) {
      toast.error(result.error);
    } else if (result.success) {
      toast.success("Campaña creada");
      router.push(`/proyectos/${result.projectId}/campanas/${result.id}`);
    }
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Proyecto */}
          <div className="space-y-1.5">
            <Label>Proyecto <span className="text-red-500">*</span></Label>
            <Select value={projectId} onValueChange={(v) => setProjectId(v ?? "")}>
              <SelectTrigger>
                <SelectValue>
                  {projectId
                    ? projects.find((p) => p.id === projectId)?.name ?? projectId
                    : <span className="text-gray-400">Seleccionar proyecto...</span>}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {projects.length === 0 && (
              <p className="text-xs text-orange-500">No hay proyectos activos. Crea uno primero.</p>
            )}
          </div>

          {/* Nombre: temporada */}
          <div className="space-y-2">
            <Label>Nombre <span className="text-red-500">*</span></Label>
            <div className="grid grid-cols-4 gap-2">
              {SEASONS.map(({ id, label, icon: Icon, color }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSeason(id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-xs font-medium transition-all",
                    season === id
                      ? "border-green-600 bg-green-50"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  )}
                >
                  <Icon className={cn("h-5 w-5", color)} />
                  {label}
                </button>
              ))}
            </div>

            {/* Sufijo */}
            <Input
              name="suffix"
              placeholder="Sufijo opcional — ej: Sector Norte, Fase 2..."
              value={suffix}
              onChange={(e) => setSuffix(e.target.value)}
            />
            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              Nombre final: <span className="font-semibold text-gray-800">{finalName}</span>
            </div>
          </div>

          {/* Tipo de levantamiento */}
          <div className="space-y-2">
            <Label>Tipo de levantamiento <span className="text-red-500">*</span></Label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { type: "FLORA" as const, label: "Flora", sub: "Parcelas", Icon: Leaf, color: "text-green-600", bg: "bg-green-50 border-green-600" },
                { type: "FAUNA" as const, label: "Fauna", sub: "Transectos", Icon: Bird, color: "text-blue-600", bg: "bg-blue-50 border-blue-600" },
              ].map(({ type, label, sub, Icon, color, bg }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => { setSurveyType(type); setMethodology(""); }}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left",
                    surveyType === type ? bg : "border-gray-200 hover:border-gray-300 bg-white"
                  )}
                >
                  <div className={cn("p-1.5 rounded-lg", surveyType === type ? "bg-white" : "bg-gray-100")}>
                    <Icon className={cn("h-5 w-5", color)} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{label}</p>
                    <p className="text-xs text-gray-500">{sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Metodología */}
          <div className="space-y-1.5">
            <Label>Metodología <span className="text-red-500">*</span></Label>
            <Select value={methodology} onValueChange={(v) => setMethodology(v ?? "")}>
              <SelectTrigger>
                <SelectValue>
                  {methodology
                    ? methodologies.find((m) => m.id === methodology)?.name ?? methodology
                    : <span className="text-gray-400">Seleccionar metodología...</span>}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {methodologies.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Fecha inicio <span className="text-red-500">*</span></Label>
              <Input id="startDate" name="startDate" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">Fecha término <span className="text-red-500">*</span></Label>
              <Input id="endDate" name="endDate" type="date" required />
            </div>
          </div>

          {/* Comentarios */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Comentarios (opcional)</Label>
            <Textarea id="notes" name="notes" placeholder="Observaciones generales de la campaña..." rows={2} />
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-green-700 hover:bg-green-800" disabled={submitting}>
              {submitting ? "Creando..." : "Crear campaña"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
