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
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Loader2 } from "lucide-react";
import { createStation, updateStation } from "@/app/(app)/proyectos/[id]/campanas/[cid]/estaciones/actions";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  area: z.string().optional(),
  length: z.string().optional(),
  width: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface StationFormProps {
  projectId: string;
  campaignId: string;
  surveyType: "FLORA" | "FAUNA";
  stationId?: string;
  defaultValues?: Partial<FormData>;
}

export function StationForm({ projectId, campaignId, surveyType, stationId, defaultValues }: StationFormProps) {
  const router = useRouter();
  const [gpsLoading, setGpsLoading] = useState(false);
  const stationType = surveyType === "FLORA" ? "PARCELA" : "TRANSECTO";
  const label = surveyType === "FLORA" ? "Parcela" : "Transecto";

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const lat = watch("latitude");
  const lng = watch("longitude");

  function captureGPS() {
    if (!navigator.geolocation) {
      toast.error("GPS no disponible en este dispositivo");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setValue("latitude", pos.coords.latitude.toFixed(6));
        setValue("longitude", pos.coords.longitude.toFixed(6));
        setGpsLoading(false);
        toast.success(`GPS capturado: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
      },
      () => {
        setGpsLoading(false);
        toast.error("No se pudo obtener la ubicación. Verifica los permisos.");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function onSubmit(data: FormData) {
    const fd = new FormData();
    fd.append("name", data.name);
    fd.append("type", stationType);
    if (data.area) fd.append("area", data.area);
    if (data.length) fd.append("length", data.length);
    if (data.width) fd.append("width", data.width);
    if (data.latitude) fd.append("latitude", data.latitude);
    if (data.longitude) fd.append("longitude", data.longitude);
    if (data.notes) fd.append("notes", data.notes);

    if (stationId) {
      const result = await updateStation(projectId, campaignId, stationId, fd);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`${label} actualizada`);
        router.push(`/estaciones/${stationId}`);
      }
    } else {
      const result = await createStation(projectId, campaignId, fd);
      if (result?.error) {
        toast.error(result.error);
      } else if (result.success && result.id) {
        toast.success(`${label} creada`);
        router.push(`/estaciones/${result.id}`);
      }
    }
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre de la {label.toLowerCase()} *</Label>
            <Input id="name" {...register("name")} placeholder={`Ej: ${label} 1`} />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          {surveyType === "FLORA" ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Dimensiones de la parcela</p>
              <div className="space-y-1.5">
                <Label htmlFor="area">Área total (m²)</Label>
                <Input id="area" type="number" step="0.01" {...register("area")} placeholder="Ej: 100" />
              </div>
              <p className="text-xs text-gray-400 text-center">— o calcular desde largo × ancho —</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="length">Largo (m)</Label>
                  <Input id="length" type="number" step="0.1" {...register("length")} placeholder="10" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="width">Ancho (m)</Label>
                  <Input id="width" type="number" step="0.1" {...register("width")} placeholder="10" />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Dimensiones del transecto</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="length">Largo (m) *</Label>
                  <Input id="length" type="number" step="1" {...register("length")} placeholder="Ej: 500" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="width">Ancho (m)</Label>
                  <Input id="width" type="number" step="1" {...register("width")} placeholder="Ej: 10" />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Ubicación GPS</Label>
            <div className="flex gap-2">
              <Input type="number" step="any" placeholder="Latitud" {...register("latitude")} className="flex-1" />
              <Input type="number" step="any" placeholder="Longitud" {...register("longitude")} className="flex-1" />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2 border-dashed"
              onClick={captureGPS}
              disabled={gpsLoading}
            >
              {gpsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4 text-green-600" />
              )}
              {gpsLoading ? "Obteniendo GPS..." : lat && lng ? "Recapturar GPS" : "Capturar GPS del dispositivo"}
            </Button>
            {lat && lng && (
              <p className="text-xs text-green-600 text-center">
                GPS: {parseFloat(lat).toFixed(4)}, {parseFloat(lng).toFixed(4)}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea id="notes" {...register("notes")} placeholder="Descripción del área, acceso, observaciones..." rows={2} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-green-700 hover:bg-green-800" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : stationId ? "Actualizar" : `Crear ${label.toLowerCase()}`}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
