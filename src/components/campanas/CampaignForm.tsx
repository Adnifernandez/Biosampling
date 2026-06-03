"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { METHODOLOGIES } from "@/lib/methodologies";
import { createCampaign, updateCampaign } from "@/app/(app)/proyectos/[id]/campanas/actions";
import { toast } from "sonner";
import type { SurveyType } from "@/lib/types";

const RESPONSIBLE_PERSONS = [
  "Álvaro Esparza","Ángela Schafer","Catalina Lastra","Claudia Cortés",
  "Diego Verdugo","Gabriel Cruz","Gabriel Meriot","Graciela Páez",
  "Katterin Gutiérrez","Macarena Toledo","Nicolás Cortés","Rodrigo Martínez","Vicente Santibáñez",
];

const schema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  surveyType: z.enum(["FLORA", "FAUNA"]),
  methodology: z.string().min(1, "Selecciona metodología"),
  responsible: z.string().optional(),
  startDate: z.string().min(1, "Fecha de inicio requerida"),
  endDate: z.string().min(1, "Fecha de fin requerida"),
  notes: z.string().optional(),
}).refine((d) => !d.startDate || !d.endDate || d.endDate >= d.startDate, {
  message: "La fecha de término no puede ser anterior a la de inicio",
  path: ["endDate"],
});

type FormData = z.infer<typeof schema>;

interface CampaignFormProps {
  projectId: string;
  campaignId?: string;
  defaultValues?: Partial<FormData>;
}

export function CampaignForm({ projectId, campaignId, defaultValues }: CampaignFormProps) {
  const router = useRouter();
  const [surveyType, setSurveyType] = useState<SurveyType | "">(
    (defaultValues?.surveyType as SurveyType) ?? ""
  );
  const [personQuery, setPersonQuery] = useState("");
  const [personOpen, setPersonOpen] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const methodologies = METHODOLOGIES.filter((m) => m.surveyType === surveyType);

  async function onSubmit(data: FormData) {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => fd.append(k, v ?? ""));

    fd.append("responsible", watch("responsible") ?? "");

    if (campaignId) {
      const result = await updateCampaign(projectId, campaignId, fd);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Campaña actualizada");
        router.push(`/campanas?projectId=${projectId}`);
      }
    } else {
      const result = await createCampaign(projectId, fd);
      if (result?.error) {
        toast.error(result.error);
      } else if (result.success && result.id) {
        toast.success("Campaña creada");
        router.push(`/campanas?projectId=${projectId}`);
      }
    }
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre de la campaña *</Label>
            <Input id="name" {...register("name")} placeholder="Ej: Temporada primavera 2025" />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de levantamiento *</Label>
            <Select
              defaultValue={defaultValues?.surveyType}
              onValueChange={(v) => {
                setValue("surveyType", (v ?? "FLORA") as "FLORA" | "FAUNA", { shouldValidate: true });
                setValue("methodology", "");
                setSurveyType((v ?? "") as SurveyType);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Flora o Fauna..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FLORA">Flora</SelectItem>
                <SelectItem value="FAUNA">Fauna</SelectItem>
              </SelectContent>
            </Select>
            {errors.surveyType && <p className="text-xs text-red-500">{errors.surveyType.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Metodología *</Label>
            <Select
              defaultValue={defaultValues?.methodology}
              onValueChange={(v) => setValue("methodology", v ?? "", { shouldValidate: true })}
              disabled={!surveyType}
            >
              <SelectTrigger>
                <SelectValue placeholder={!surveyType ? "Primero elige el tipo" : "Selecciona metodología..."} />
              </SelectTrigger>
              <SelectContent>
                {methodologies.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.methodology && <p className="text-xs text-red-500">{errors.methodology.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Fecha inicio *</Label>
              <Input id="startDate" type="date" {...register("startDate")} />
              {errors.startDate && <p className="text-xs text-red-500">{errors.startDate.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">Fecha fin *</Label>
              <Input id="endDate" type="date" {...register("endDate")} />
              {errors.endDate && <p className="text-xs text-red-500">{errors.endDate.message}</p>}
            </div>
          </div>

          {/* Persona responsable */}
          <div className="space-y-1.5">
            <Label>Persona responsable <span className="text-gray-400 text-xs font-normal">(opcional)</span></Label>
            {watch("responsible") ? (
              <div className="flex items-center justify-between bg-teal-50 rounded-lg px-3 py-2 border border-teal-200">
                <span className="text-sm font-medium text-teal-900">{watch("responsible")}</span>
                <button type="button" className="text-xs text-red-500 hover:text-red-700 ml-3"
                  onClick={() => { setValue("responsible", ""); setPersonQuery(""); }}>
                  Cambiar
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input className="pl-9" placeholder="Buscar persona..." value={personQuery}
                    onChange={(e) => setPersonQuery(e.target.value)}
                    onFocus={() => setPersonOpen(true)}
                    onBlur={() => setTimeout(() => setPersonOpen(false), 150)} />
                </div>
                {personOpen && (
                  <div className="border rounded-lg max-h-52 overflow-y-auto divide-y bg-white shadow-sm">
                    {(personQuery ? RESPONSIBLE_PERSONS.filter(p => p.toLowerCase().includes(personQuery.toLowerCase())) : RESPONSIBLE_PERSONS)
                      .map(p => (
                        <button key={p} type="button" className="w-full text-left px-3 py-2.5 hover:bg-teal-50 text-sm"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => { setValue("responsible", p); setPersonQuery(""); setPersonOpen(false); }}>
                          {p}
                        </button>
                      ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea id="notes" {...register("notes")} placeholder="Observaciones generales..." rows={2} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-teal-700 hover:bg-teal-800" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : campaignId ? "Actualizar" : "Crear campaña"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
