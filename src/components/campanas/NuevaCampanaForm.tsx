"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Sun, Leaf, Snowflake, Flower2, Bird, FolderOpen, ShieldCheck } from "lucide-react";
import { METHODOLOGIES } from "@/lib/methodologies";
import { createCampana, updateCampana } from "@/app/(app)/campanas/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const SEASONS = [
  { id: "Verano",    label: "Verano",    icon: Sun,       color: "text-yellow-500" },
  { id: "Otoño",     label: "Otoño",     icon: Leaf,      color: "text-orange-500" },
  { id: "Invierno",  label: "Invierno",  icon: Snowflake, color: "text-blue-400"   },
  { id: "Primavera", label: "Primavera", icon: Flower2,   color: "text-pink-400"   },
];

function parseName(name: string): { season: string; suffix: string } {
  const match = name.match(/^(Verano|Otoño|Invierno|Primavera)\s+\d{4}(?:\s+—\s+(.+))?$/);
  if (match) return { season: match[1], suffix: match[2] ?? "" };
  return { season: "Verano", suffix: "" };
}

type Project = { id: string; name: string };

interface DefaultValues {
  name?: string;
  surveyType?: "FLORA" | "FAUNA" | "RESCATE";
  methodology?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

interface NuevaCampanaFormProps {
  projects: Project[];
  preselectedProject?: Project;
  campaignId?: string;
  defaultValues?: DefaultValues;
}

export function NuevaCampanaForm({ projects, preselectedProject, campaignId, defaultValues }: NuevaCampanaFormProps) {
  const router = useRouter();
  const year = new Date().getFullYear();
  const isEdit = !!campaignId;

  const parsed = defaultValues?.name ? parseName(defaultValues.name) : { season: "Verano", suffix: "" };

  const [projectId, setProjectId] = useState(preselectedProject?.id ?? "");
  const [season, setSeason] = useState(parsed.season);
  const [suffix, setSuffix] = useState(parsed.suffix);
  const [surveyType, setSurveyType] = useState<"FLORA" | "FAUNA" | "RESCATE">(defaultValues?.surveyType ?? "FLORA");
  const [methodology, setMethodology] = useState(defaultValues?.methodology ?? "");
  const [submitting, setSubmitting] = useState(false);

  const finalName = suffix.trim()
    ? `${season} ${year} — ${suffix.trim()}`
    : `${season} ${year}`;

  const methodologies = METHODOLOGIES.filter((m) =>
    m.surveyType === surveyType &&
    (surveyType !== "FAUNA" || m.id === "TRANSECTO_LINEAL_FAUNA")
  );

  const methodologyActiveClass =
    surveyType === "FLORA" ? "border-green-600 bg-green-50"
    : surveyType === "FAUNA" ? "border-blue-600 bg-blue-50"
    : "border-orange-600 bg-orange-50";

  const methodologyDotClass =
    surveyType === "FLORA" ? "border-green-600 bg-green-600"
    : surveyType === "FAUNA" ? "border-blue-600 bg-blue-600"
    : "border-orange-600 bg-orange-600";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isEdit && !projectId) { toast.error("Selecciona un proyecto"); return; }
    if (!methodology) { toast.error("Selecciona una metodología"); return; }
    const fd0 = new FormData(e.currentTarget);
    const sd = fd0.get("startDate") as string;
    const ed = fd0.get("endDate") as string;
    if (sd && ed && ed < sd) { toast.error("La fecha de término no puede ser anterior a la de inicio"); return; }

    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    fd.set("projectId", projectId);
    fd.set("season", season);
    fd.set("surveyType", surveyType);
    fd.set("methodology", methodology);

    const result = isEdit
      ? await updateCampana(campaignId, fd)
      : await createCampana(fd);

    setSubmitting(false);

    if (result.error) {
      toast.error(result.error);
    } else if (result.success) {
      toast.success(isEdit ? "Campaña actualizada" : "Campaña creada");
      router.push(projectId ? `/campanas?projectId=${projectId}` : `/campanas`);
    }
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Proyecto */}
          <div className="space-y-1.5">
            <Label>Proyecto <span className="text-red-500">*</span></Label>
            {preselectedProject ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border rounded-lg text-sm text-gray-700">
                <FolderOpen className="h-4 w-4 text-gray-400 shrink-0" />
                {preselectedProject.name}
              </div>
            ) : (
              <SearchableSelect
                value={projectId}
                options={projects.map((p) => ({ value: p.id, label: p.name }))}
                placeholder="Seleccionar proyecto..."
                onChange={(v) => setProjectId(v)}
              />
            )}
            {!preselectedProject && projects.length === 0 && (
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
            <div className="grid grid-cols-3 gap-2">
              {[
                { type: "FLORA" as const, label: "Flora", sub: "Parcelas", Icon: Leaf, color: "text-green-600", bg: "bg-green-50 border-green-600" },
                { type: "FAUNA" as const, label: "Fauna", sub: "Transectos", Icon: Bird, color: "text-blue-600", bg: "bg-blue-50 border-blue-600" },
                { type: "RESCATE" as const, label: "Rescate", sub: "Relocalización", Icon: ShieldCheck, color: "text-orange-600", bg: "bg-orange-50 border-orange-600" },
              ].map(({ type, label, sub, Icon, color, bg }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => { setSurveyType(type); setMethodology(""); }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-3 rounded-xl border-2 transition-all text-left",
                    surveyType === type ? bg : "border-gray-200 hover:border-gray-300 bg-white"
                  )}
                >
                  <div className={cn("p-1.5 rounded-lg shrink-0", surveyType === type ? "bg-white" : "bg-gray-100")}>
                    <Icon className={cn("h-4 w-4", color)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-900">{label}</p>
                    <p className="text-xs text-gray-500 truncate">{sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Metodología */}
          <div className="space-y-2">
            <Label>Metodología <span className="text-red-500">*</span></Label>
            <div className={cn("grid gap-2", methodologies.length <= 3 ? "grid-cols-3" : "grid-cols-2")}>
              {methodologies.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethodology(m.id)}
                  className={cn(
                    "flex items-start gap-2 px-3 py-3 rounded-xl border-2 transition-all text-left",
                    methodology === m.id ? methodologyActiveClass : "border-gray-200 hover:border-gray-300 bg-white"
                  )}
                >
                  <div className={cn(
                    "w-3.5 h-3.5 rounded-full border-2 mt-0.5 shrink-0",
                    methodology === m.id ? methodologyDotClass : "border-gray-300"
                  )} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-900 leading-tight">{m.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-tight">{m.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Fecha inicio <span className="text-red-500">*</span></Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                required
                defaultValue={defaultValues?.startDate}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">Fecha término <span className="text-red-500">*</span></Label>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                required
                defaultValue={defaultValues?.endDate}
              />
            </div>
          </div>

          {/* Comentarios */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Comentarios (opcional)</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Observaciones generales de la campaña..."
              rows={2}
              defaultValue={defaultValues?.notes}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-green-700 hover:bg-green-800" disabled={submitting}>
              {submitting ? "Guardando..." : isEdit ? "Actualizar campaña" : "Crear campaña"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
