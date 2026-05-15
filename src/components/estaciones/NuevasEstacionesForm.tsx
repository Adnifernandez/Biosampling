"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Loader2, Leaf, Bird } from "lucide-react";
import { createEstaciones } from "@/app/(app)/estaciones/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NuevasEstacionesFormProps {
  campaignId: string;
  projectId: string;
  surveyType: "FLORA" | "FAUNA";
  nextNumber: number;
  campaignName: string;
}

export function NuevasEstacionesForm({
  campaignId,
  projectId,
  surveyType,
  nextNumber,
  campaignName,
}: NuevasEstacionesFormProps) {
  const router = useRouter();
  const stationType = surveyType === "FLORA" ? "PARCELA" : "TRANSECTO";
  const prefix = surveyType === "FLORA" ? "P" : "T";

  const [sizeMode, setSizeMode] = useState<"dimensions" | "area">("dimensions");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [area, setArea] = useState("");
  const [quantity, setQuantity] = useState<number | "">(1);
  const [notes, setNotes] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const calculatedArea =
    sizeMode === "dimensions" && length && width
      ? (parseFloat(length) * parseFloat(width)).toFixed(2)
      : null;

  const qty = typeof quantity === "number" && quantity >= 1 ? quantity : 1;
  const previewNames = Array.from({ length: Math.min(qty, 10) }, (_, i) => `${prefix}${nextNumber + i}`).join(", ") + (qty > 10 ? ` ... ${prefix}${nextNumber + qty - 1}` : "");

  function captureGPS() {
    if (!navigator.geolocation) {
      toast.error("GPS no disponible en este dispositivo");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setGpsLoading(false);
        toast.success(
          `GPS capturado: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`
        );
      },
      () => {
        setGpsLoading(false);
        toast.error("No se pudo obtener la ubicación. Verifica los permisos.");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    const fd = new FormData();
    fd.append("campaignId", campaignId);
    fd.append("type", stationType);
    fd.append("sizeMode", sizeMode);
    fd.append("quantity", String(qty));
    if (sizeMode === "dimensions") {
      if (length) fd.append("length", length);
      if (width) fd.append("width", width);
    } else {
      if (area) fd.append("area", area);
    }
    if (notes) fd.append("notes", notes);
    if (latitude) fd.append("latitude", latitude);
    if (longitude) fd.append("longitude", longitude);

    const result = await createEstaciones(fd);
    setIsSubmitting(false);

    if ("error" in result && result.error) {
      toast.error(result.error);
    } else if ("success" in result && result.success) {
      toast.success(
        `${result.count} ${stationType === "PARCELA" ? (result.count === 1 ? "parcela creada" : "parcelas creadas") : (result.count === 1 ? "transecto creado" : "transectos creados")}`
      );
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
            surveyType === "FLORA" ? "border-green-200 bg-green-50" : "border-blue-200 bg-blue-50"
          )}>
            {surveyType === "FLORA"
              ? <Leaf className="h-5 w-5 text-green-700 shrink-0" />
              : <Bird className="h-5 w-5 text-blue-700 shrink-0" />}
            <div>
              <p className={cn("font-semibold text-sm", surveyType === "FLORA" ? "text-green-800" : "text-blue-800")}>
                {stationType === "PARCELA" ? "Parcela" : "Transecto"}
              </p>
              <p className="text-xs text-gray-500">
                Campaña {surveyType === "FLORA" ? "Flora" : "Fauna"} · {campaignName}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quantity */}
      <div className="space-y-1.5">
        <Label htmlFor="quantity">Cantidad de estaciones</Label>
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
      </div>

      {/* Size mode toggle */}
      <div className="space-y-3">
        <Label>Dimensiones</Label>
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setSizeMode("dimensions")}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              sizeMode === "dimensions"
                ? "bg-white shadow-sm text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            Largo × Ancho
          </button>
          <button
            type="button"
            onClick={() => setSizeMode("area")}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              sizeMode === "area"
                ? "bg-white shadow-sm text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            m²
          </button>
        </div>

        {sizeMode === "dimensions" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="length">Largo (m)</Label>
                <Input
                  id="length"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="Ej: 10"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="width">Ancho (m)</Label>
                <Input
                  id="width"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="Ej: 10"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                />
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
            <Input
              id="area"
              type="number"
              step="0.01"
              min="0"
              placeholder="Ej: 100"
              value={area}
              onChange={(e) => setArea(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* GPS */}
      <div className="space-y-2">
        <Label>Ubicación GPS (opcional)</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            step="any"
            placeholder="Latitud"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            className="flex-1"
          />
          <Input
            type="number"
            step="any"
            placeholder="Longitud"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            className="flex-1"
          />
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
          {gpsLoading
            ? "Obteniendo GPS..."
            : latitude && longitude
            ? "Recapturar GPS"
            : "Capturar GPS (opcional)"}
        </Button>
        {latitude && longitude && (
          <p className="text-xs text-green-600 text-center">
            GPS: {parseFloat(latitude).toFixed(4)}, {parseFloat(longitude).toFixed(4)}
          </p>
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
          onClick={() => router.push(`/proyectos/${projectId}/campanas/${campaignId}`)}
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
            : `Crear ${qty} ${stationType === "PARCELA" ? (qty === 1 ? "parcela" : "parcelas") : (qty === 1 ? "transecto" : "transectos")}`}
        </Button>
      </div>
    </form>
  );
}
