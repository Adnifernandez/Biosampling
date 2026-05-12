"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Loader2, Search } from "lucide-react";
import { getMethodologyById } from "@/lib/methodologies";
import { createOccurrence, updateOccurrence, searchSpecies } from "@/app/(app)/proyectos/[id]/campanas/[cid]/estaciones/[sid]/ocurrencias/actions";
import { toast } from "sonner";
import { format } from "date-fns";

type SpeciesResult = {
  id: string;
  genus: string;
  species: string;
  commonName: string | null;
  family: string;
  conservationStatus: string | null;
};

interface OccurrenceFormProps {
  projectId: string;
  campaignId: string;
  stationId: string;
  surveyType: "FLORA" | "FAUNA";
  methodology: string;
  occurrenceId?: string;
  defaultValues?: Record<string, string>;
}

type FieldValues = Record<string, string>;

export function OccurrenceForm({
  projectId,
  campaignId,
  stationId,
  surveyType,
  methodology,
  occurrenceId,
  defaultValues,
}: OccurrenceFormProps) {
  const router = useRouter();
  const [gpsLoading, setGpsLoading] = useState(false);
  const [speciesQuery, setSpeciesQuery] = useState("");
  const [speciesList, setSpeciesList] = useState<SpeciesResult[]>([]);
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesResult | null>(null);
  const [searching, startSearch] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [fieldValues, setFieldValues] = useState<FieldValues>({
    date: format(new Date(), "yyyy-MM-dd"),
    latitude: "",
    longitude: "",
    ...defaultValues,
  });

  const methodologyConfig = getMethodologyById(methodology);

  useEffect(() => {
    if (!speciesQuery || speciesQuery.length < 2) {
      setSpeciesList([]);
      return;
    }
    startSearch(async () => {
      const results = await searchSpecies(speciesQuery, surveyType);
      setSpeciesList(results);
    });
  }, [speciesQuery, surveyType]);

  function setField(key: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  }

  function captureGPS() {
    if (!navigator.geolocation) {
      toast.error("GPS no disponible");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setField("latitude", pos.coords.latitude.toFixed(6));
        setField("longitude", pos.coords.longitude.toFixed(6));
        setGpsLoading(false);
        toast.success("GPS capturado");
      },
      () => {
        setGpsLoading(false);
        toast.error("No se pudo obtener la ubicación");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSpecies && !defaultValues?.speciesId) {
      toast.error("Selecciona una especie");
      return;
    }
    setSubmitting(true);
    const speciesId = selectedSpecies?.id ?? defaultValues?.speciesId ?? "";
    const payload = { ...fieldValues, speciesId, date: fieldValues.date || format(new Date(), "yyyy-MM-dd") };

    const result = occurrenceId
      ? await updateOccurrence(projectId, campaignId, stationId, occurrenceId, payload)
      : await createOccurrence(projectId, campaignId, stationId, payload);

    setSubmitting(false);
    if ("error" in result && result.error) {
      toast.error("Error al guardar");
    } else {
      toast.success(occurrenceId ? "Ocurrencia actualizada" : "Ocurrencia registrada");
      router.push(`/proyectos/${projectId}/campanas/${campaignId}/estaciones/${stationId}`);
    }
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Especie */}
          <div className="space-y-2">
            <Label>Especie *</Label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Buscar por nombre científico o común..."
                value={speciesQuery}
                onChange={(e) => {
                  setSpeciesQuery(e.target.value);
                  if (selectedSpecies) setSelectedSpecies(null);
                }}
              />
            </div>
            {searching && <p className="text-xs text-gray-400">Buscando...</p>}
            {speciesList.length > 0 && !selectedSpecies && (
              <div className="border rounded-lg max-h-40 overflow-y-auto divide-y">
                {speciesList.map((sp) => (
                  <button
                    key={sp.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-green-50 text-sm"
                    onClick={() => {
                      setSelectedSpecies(sp);
                      setSpeciesQuery(`${sp.genus} ${sp.species}`);
                      setSpeciesList([]);
                    }}
                  >
                    <span className="italic font-medium">{sp.genus} {sp.species}</span>
                    {sp.commonName && <span className="text-gray-500 ml-2">· {sp.commonName}</span>}
                    {sp.conservationStatus && sp.conservationStatus !== "LC" && (
                      <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-1 rounded">
                        {sp.conservationStatus}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {selectedSpecies && (
              <div className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-medium italic">{selectedSpecies.genus} {selectedSpecies.species}</p>
                  {selectedSpecies.commonName && (
                    <p className="text-xs text-gray-500">{selectedSpecies.commonName}</p>
                  )}
                </div>
                <button
                  type="button"
                  className="text-xs text-red-500 hover:text-red-700"
                  onClick={() => { setSelectedSpecies(null); setSpeciesQuery(""); }}
                >
                  Cambiar
                </button>
              </div>
            )}
            {!selectedSpecies && defaultValues?.speciesId && (
              <p className="text-xs text-gray-500">Especie cargada desde registro anterior</p>
            )}
          </div>

          {/* Fecha */}
          <div className="space-y-1.5">
            <Label htmlFor="date">Fecha de registro</Label>
            <Input
              id="date"
              type="date"
              value={fieldValues.date}
              onChange={(e) => setField("date", e.target.value)}
            />
          </div>

          {/* GPS de ocurrencia */}
          <div className="space-y-2">
            <Label>GPS de la ocurrencia (opcional)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                step="any"
                placeholder="Latitud"
                value={fieldValues.latitude}
                onChange={(e) => setField("latitude", e.target.value)}
                className="flex-1"
              />
              <Input
                type="number"
                step="any"
                placeholder="Longitud"
                value={fieldValues.longitude}
                onChange={(e) => setField("longitude", e.target.value)}
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
              {gpsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4 text-green-600" />}
              {gpsLoading ? "Obteniendo GPS..." : fieldValues.latitude && fieldValues.longitude ? "Recapturar GPS" : "Capturar GPS"}
            </Button>
          </div>

          {/* Campos dinámicos por metodología */}
          {methodologyConfig && methodologyConfig.fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={field.key}>
                {field.label} {field.unit && <span className="text-gray-400 text-xs">({field.unit})</span>}
                {field.required && " *"}
              </Label>
              {field.type === "select" ? (
                <Select
                  value={fieldValues[field.key] ?? ""}
                  onValueChange={(v) => setField(field.key, v ?? "")}
                >
                  <SelectTrigger id={field.key}>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={field.key}
                  type={field.type === "number" ? "number" : "text"}
                  step={field.type === "number" ? "any" : undefined}
                  value={fieldValues[field.key] ?? ""}
                  onChange={(e) => setField(field.key, e.target.value)}
                  placeholder={field.unit ? `Ej: ${field.unit}` : ""}
                />
              )}
            </div>
          ))}

          {/* Notas */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              value={fieldValues.notes ?? ""}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="Observaciones adicionales..."
              rows={2}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-green-700 hover:bg-green-800" disabled={submitting}>
              {submitting ? "Guardando..." : occurrenceId ? "Actualizar" : "Registrar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
