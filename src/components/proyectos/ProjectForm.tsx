"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { REGIONS, getCommunesByRegion } from "@/lib/chile-data";
import { createProject, updateProject } from "@/app/(app)/proyectos/actions";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  region: z.string().min(1, "Selecciona una región"),
  commune: z.string().min(1, "Selecciona una comuna"),
  responsible: z.string().min(2, "Mínimo 2 caracteres"),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface ProjectFormProps {
  projectId?: string;
  defaultValues?: Partial<FormData>;
}

export function ProjectForm({ projectId, defaultValues }: ProjectFormProps) {
  const router = useRouter();
  const [communes, setCommunes] = useState<string[]>([]);

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const selectedRegion = watch("region");

  useEffect(() => {
    if (selectedRegion) {
      const list = getCommunesByRegion(selectedRegion);
      setCommunes(list);
      if (!defaultValues?.commune || defaultValues.region !== selectedRegion) {
        setValue("commune", "");
      }
    }
  }, [selectedRegion, setValue, defaultValues]);

  useEffect(() => {
    if (defaultValues?.region) {
      setCommunes(getCommunesByRegion(defaultValues.region));
    }
  }, [defaultValues?.region]);

  async function onSubmit(data: FormData) {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => fd.append(k, v ?? ""));

    if (projectId) {
      const result = await updateProject(projectId, fd);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Proyecto actualizado");
        router.push(`/proyectos/${projectId}`);
      }
    } else {
      const result = await createProject(fd);
      if (result?.error) {
        toast.error(result.error);
      } else if (result.success && result.id) {
        toast.success("Proyecto creado");
        router.push(`/proyectos/${result.id}`);
      }
    }
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre del proyecto *</Label>
            <Input id="name" {...register("name")} placeholder="Ej: Monitoreo Laguna Verde 2025" />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Región *</Label>
            <Select
              defaultValue={defaultValues?.region}
              onValueChange={(v) => setValue("region", v ?? "", { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona región..." />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.number} - {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.region && <p className="text-xs text-red-500">{errors.region.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Comuna *</Label>
            <Select
              defaultValue={defaultValues?.commune}
              onValueChange={(v) => setValue("commune", v ?? "", { shouldValidate: true })}
              disabled={communes.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={communes.length === 0 ? "Primero selecciona región" : "Selecciona comuna..."} />
              </SelectTrigger>
              <SelectContent>
                {communes.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.commune && <p className="text-xs text-red-500">{errors.commune.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="responsible">Persona responsable *</Label>
            <Input id="responsible" {...register("responsible")} placeholder="Nombre del responsable" />
            {errors.responsible && <p className="text-xs text-red-500">{errors.responsible.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Descripción (opcional)</Label>
            <Textarea id="description" {...register("description")} placeholder="Descripción del proyecto..." rows={3} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => router.back()}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-green-700 hover:bg-green-800" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : projectId ? "Actualizar" : "Crear proyecto"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
