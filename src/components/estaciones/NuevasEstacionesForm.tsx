"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Leaf, Bird, ShieldCheck } from "lucide-react";
import { createEstaciones } from "@/app/(app)/estaciones/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NuevasEstacionesFormProps {
  campaignId: string;
  projectId: string;
  surveyType: "FLORA" | "FAUNA" | "RESCATE";
  methodology: string;
  nextNumber: number;
  campaignName: string;
}

export function NuevasEstacionesForm({
  campaignId,
  projectId,
  surveyType,
  methodology,
  nextNumber,
  campaignName,
}: NuevasEstacionesFormProps) {
  const router = useRouter();
  const isMicroruteo = methodology === "MICRORUTEO" || methodology === "RESCATE_MICRORUTEO";
  const isGrilla = methodology === "GRILLA";
  const isTransectoMethod = surveyType === "FAUNA" || methodology === "RESCATE_TRANSECTO";
  const stationType = isTransectoMethod ? "TRANSECTO" : "PARCELA";

  const prefix =
    isGrilla ? "T"
    : isTransectoMethod ? "T"
    : methodology === "PARCELAS_FORESTALES" ? "PF"
    : isMicroruteo ? "R"
    : "P";

  const stationLabel = isGrilla ? "Transecto" : isMicroruteo ? "Ruta" : stationType === "PARCELA" ? "Parcela" : "Transecto";
  const stationLabelPlural = isGrilla ? "transectos" : isMicroruteo ? "rutas" : stationType === "PARCELA" ? "parcelas" : "transectos";

  const [sizeMode, setSizeMode] = useState<"dimensions" | "area">(isMicroruteo ? "area" : "dimensions");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [area, setArea] = useState("");
  const [areaUnit, setAreaUnit] = useState<"sqm" | "ha">("sqm");
  const [quantity, setQuantity] = useState<number | "">(1);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const calculatedArea =
    sizeMode === "dimensions" && length && width
      ? (parseFloat(length) * parseFloat(width)).toFixed(2)
      : null;

  const qty = typeof quantity === "number" && quantity >= 1 ? quantity : 1;
  const previewNames = Array.from({ length: Math.min(qty, 10) }, (_, i) => `${prefix}${nextNumber + i}`).join(", ") + (qty > 10 ? ` ... ${prefix}${nextNumber + qty - 1}` : "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (sizeMode === "dimensions") {
      if (!length || !width) { toast.error("Ingresa largo y ancho"); return; }
    } else {
      if (!area) { toast.error("Ingresa el área"); return; }
    }

    setIsSubmitting(true);

    const fd = new FormData();
    fd.append("campaignId", campaignId);
    fd.append("type", stationType);
    fd.append("methodology", methodology);
    fd.append("sizeMode", sizeMode);
    fd.append("quantity", String(qty));
    if (sizeMode === "dimensions") {
      fd.append("length", length);
      fd.append("width", width);
    } else {
      const areaInSqm = areaUnit === "ha" ? String(parseFloat(area) * 10000) : area;
      fd.append("area", areaInSqm);
    }
    if (notes) fd.append("notes", notes);

    const result = await createEstaciones(fd);
    setIsSubmitting(false);

    if ("error" in result && result.error) {
      toast.error(result.error);
    } else if ("success" in result && result.success) {
      toast.success(`${result.count} ${result.count === 1 ? stationLabel.toLowerCase() : stationLabelPlural} creada${stationType === "TRANSECTO" ? "s" : result.count === 1 ? "" : "s"}`);
      router.push(`/estaciones?projectId=${projectId}&campaignId=${campaignId}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Type card — display only */}
      <Card>
        <CardContent className="py-4 px-4">
          <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Tipo de estación</p>
          <div className={cn(
            "flex items-center gap-3 p-3 rounded-lg border-2",
            surveyType === "FLORA" ? "border-green-200 bg-green-50"
            : surveyType === "RESCATE" ? "border-orange-200 bg-orange-50"
            : "border-blue-200 bg-blue-50"
          )}>
            {surveyType === "FLORA"
              ? <Leaf className="h-5 w-5 text-green-700 shrink-0" />
              : surveyType === "RESCATE"
                ? <ShieldCheck className="h-5 w-5 text-orange-700 shrink-0" />
                : <Bird className="h-5 w-5 text-blue-700 shrink-0" />}
            <div>
              <p className={cn("font-semibold text-sm",
                surveyType === "FLORA" ? "text-green-800"
                : surveyType === "RESCATE" ? "text-orange-800"
                : "text-blue-800"
              )}>
                {stationLabel}
              </p>
              <p className="text-xs text-gray-500">
                Campaña {surveyType === "FLORA" ? "Flora" : surveyType === "RESCATE" ? "Rescate" : "Fauna"} · {campaignName}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quantity */}
      <div className="space-y-1.5">
        <Label htmlFor="quantity">{isGrilla ? "Cantidad de transectos" : "Cantidad de estaciones"}</Label>
        <Input
          id="quantity"
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => {
            const val = e.target.value;
            setQuantity(val === "" ? "" : Math.max(1, parseInt(val) || 1));
          }}
          onBlur={() => { if (quantity === "" || quantity < 1) setQuantity(1); }}
          className="max-w-[120px]"
        />
        <p className="text-xs text-gray-500">
          Se crearán: <span className="font-medium text-gray-700">{previewNames}</span>
        </p>
        {isGrilla && (
          <p className="text-xs text-blue-600 bg-blue-50 rounded px-2 py-1">
            Cada transecto generará automáticamente 4 puntos de grilla (G1-G4, G5-G8…)
          </p>
        )}
      </div>

      {/* Size section */}
      <div className="space-y-3">
        <Label>{isGrilla ? "Dimensiones transecto" : "Dimensiones"} <span className="text-red-500">*</span></Label>

        {isMicroruteo ? (
          /* Microruteo: only m² / ha */
          <div className="space-y-2">
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
              {(["sqm", "ha"] as const).map((u) => (
                <button key={u} type="button" onClick={() => setAreaUnit(u)}
                  className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    areaUnit === u ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
                  {u === "sqm" ? "m²" : "ha"}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="area">Área de la zona ({areaUnit === "ha" ? "ha" : "m²"})</Label>
              <Input id="area" type="number" step={areaUnit === "ha" ? "0.0001" : "0.01"} min="0"
                placeholder={areaUnit === "ha" ? "Ej: 1.5" : "Ej: 10000"}
                value={area} onChange={(e) => setArea(e.target.value)} />
              {areaUnit === "ha" && area && !isNaN(parseFloat(area)) && (
                <p className="text-xs text-green-700 bg-green-50 rounded px-3 py-1.5">
                  Equivale a: <span className="font-semibold">{(parseFloat(area) * 10000).toLocaleString("es-CL")} m²</span>
                </p>
              )}
            </div>
          </div>
        ) : (
          /* All other methodologies (incl. Grilla): Largo × Ancho or m² */
          <>
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
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
            </div>
            {sizeMode === "dimensions" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="length">Largo (m)</Label>
                    <Input id="length" type="number" step="0.1" min="0" placeholder="Ej: 10"
                      value={length} onChange={(e) => setLength(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="width">Ancho (m)</Label>
                    <Input id="width" type="number" step="0.1" min="0" placeholder="Ej: 10"
                      value={width} onChange={(e) => setWidth(e.target.value)} />
                  </div>
                </div>
                {calculatedArea && (
                  <p className="text-xs text-green-700 bg-green-50 rounded px-3 py-1.5">
                    Área calculada: <span className="font-semibold">{calculatedArea} m²</span>
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="area">Área total (m²)</Label>
                <Input id="area" type="number" step="0.01" min="0" placeholder="Ej: 100"
                  value={area} onChange={(e) => setArea(e.target.value)} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Notes */}
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

      {/* Submit */}
      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => router.push(`/estaciones?projectId=${projectId}&campaignId=${campaignId}`)}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          className="flex-1 bg-green-700 hover:bg-green-800"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Creando..."
            : `Crear ${qty} ${qty === 1 ? stationLabel.toLowerCase() : stationLabelPlural}`}
        </Button>
      </div>
    </form>
  );
}
