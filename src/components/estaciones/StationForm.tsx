"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { updateStation } from "@/app/(app)/proyectos/[id]/campanas/[cid]/estaciones/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StationFormProps {
  projectId: string;
  campaignId: string;
  surveyType: "FLORA" | "FAUNA";
  methodology?: string;
  stationId: string;
  defaultValues: {
    name: string;
    area?: string;
    length?: string;
    width?: string;
    notes?: string;
  };
}

export function StationForm({ projectId, campaignId, surveyType, methodology, stationId, defaultValues }: StationFormProps) {
  const router = useRouter();
  const isMicroruteo = methodology === "MICRORUTEO";
  const isTransecto = surveyType === "FAUNA";
  const stationType = surveyType === "FLORA" ? "PARCELA" : "TRANSECTO";
  const label = isMicroruteo ? "Ruta" : surveyType === "FLORA" ? "Parcela" : "Transecto";

  const hasLengthWidth = !!(defaultValues.length && defaultValues.width && parseFloat(defaultValues.length) > 0);
  const [sizeMode, setSizeMode] = useState<"dimensions" | "area" | "ha">(
    isTransecto ? (hasLengthWidth ? "dimensions" : "area") : "area"
  );
  const [length, setLength] = useState(defaultValues.length ?? "");
  const [width, setWidth] = useState(defaultValues.width ?? "");
  const [area, setArea] = useState(defaultValues.area ?? "");
  const [ha, setHa] = useState(
    defaultValues.area ? (parseFloat(defaultValues.area) / 10000).toFixed(4) : ""
  );
  const [notes, setNotes] = useState(defaultValues.notes ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const calculatedArea = sizeMode === "dimensions" && length && width
    ? (parseFloat(length) * parseFloat(width)).toFixed(2)
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (sizeMode === "dimensions") {
      if (!length || !width) { toast.error("Ingresa largo y ancho"); return; }
    } else if (sizeMode === "area") {
      if (!area) { toast.error("Ingresa el área en m²"); return; }
    } else {
      if (!ha) { toast.error("Ingresa el área en hectáreas"); return; }
    }

    setIsSubmitting(true);

    const areaInM2 = sizeMode === "ha"
      ? (parseFloat(ha) * 10000).toFixed(2)
      : sizeMode === "dimensions"
        ? calculatedArea ?? ""
        : area;

    const fd = new FormData();
    fd.append("name", defaultValues.name);
    fd.append("type", stationType);
    fd.append("length", sizeMode === "dimensions" ? length : "");
    fd.append("width", sizeMode === "dimensions" ? width : "");
    fd.append("area", areaInM2);
    fd.append("notes", notes);

    const result = await updateStation(projectId, campaignId, stationId, fd);
    setIsSubmitting(false);

    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(`${label} actualizada`);
      router.push(`/estaciones?projectId=${projectId}&campaignId=${campaignId}`);
    }
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Size mode toggle */}
          <div className="space-y-3">
            <Label>Dimensiones <span className="text-red-500">*</span></Label>
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
              {isTransecto ? (
                <>
                  <button type="button" onClick={() => setSizeMode("dimensions")}
                    className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                      sizeMode === "dimensions" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
                    Largo × Ancho
                  </button>
                  <button type="button" onClick={() => setSizeMode("area")}
                    className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                      sizeMode === "area" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
                    m²
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setSizeMode("area")}
                    className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                      sizeMode === "area" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
                    m²
                  </button>
                  <button type="button" onClick={() => setSizeMode("ha")}
                    className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                      sizeMode === "ha" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
                    ha
                  </button>
                </>
              )}
            </div>

            {sizeMode === "dimensions" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="length">Largo (m)</Label>
                    <Input id="length" type="number" step="0.1" min="0" placeholder="Ej: 100"
                      value={length} onChange={(e) => setLength(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="width">Ancho (m)</Label>
                    <Input id="width" type="number" step="0.1" min="0" placeholder="Ej: 4"
                      value={width} onChange={(e) => setWidth(e.target.value)} />
                  </div>
                </div>
                {calculatedArea && (
                  <p className="text-xs text-green-700 bg-green-50 rounded px-3 py-1.5">
                    Área calculada: <span className="font-semibold">{calculatedArea} m²</span>
                  </p>
                )}
              </div>
            ) : sizeMode === "area" ? (
              <div className="space-y-1.5">
                <Label htmlFor="area">Área total (m²)</Label>
                <Input id="area" type="number" step="0.01" min="0" placeholder="Ej: 100"
                  value={area} onChange={(e) => setArea(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="ha">Área total (hectáreas)</Label>
                <Input id="ha" type="number" step="0.0001" min="0" placeholder="Ej: 0.5"
                  value={ha} onChange={(e) => setHa(e.target.value)} />
                {ha && !isNaN(parseFloat(ha)) && (
                  <p className="text-xs text-green-700 bg-green-50 rounded px-3 py-1.5">
                    Equivale a <span className="font-semibold">{(parseFloat(ha) * 10000).toLocaleString("es-CL")} m²</span>
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Descripción del área, acceso, observaciones..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => router.push(`/estaciones/${stationId}`)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-green-700 hover:bg-green-800" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Actualizar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
