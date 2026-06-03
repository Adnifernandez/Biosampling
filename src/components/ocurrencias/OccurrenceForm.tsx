"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Plus, Trash2, MapPin, Loader2, CheckCircle2 } from "lucide-react";
import { BB_COVER_CODES, getMethodologyById } from "@/lib/methodologies";
import {
  createOccurrence,
  updateOccurrence,
  searchSpecies,
  createGrillaOccurrences,
  updateGrillaOccurrences,
  updateTransectoCoordinates,
} from "@/app/(app)/proyectos/[id]/campanas/[cid]/estaciones/[sid]/ocurrencias/actions";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { OccurrencePayload } from "@/lib/db";

function latLngToUTM(lat: number, lng: number): { north: number; east: number; zone: string } {
  const a = 6378137.0, f = 1 / 298.257223563;
  const b = a * (1 - f), e2 = 1 - (b * b) / (a * a), k0 = 0.9996;
  const zoneNum = Math.floor((lng + 180) / 6) + 1;
  const zone = `${zoneNum}${lat >= 0 ? "N" : "S"}`;
  const lr = (lat * Math.PI) / 180;
  const lo = (((zoneNum - 1) * 6 - 180 + 3) * Math.PI) / 180;
  const N = a / Math.sqrt(1 - e2 * Math.sin(lr) ** 2);
  const T = Math.tan(lr) ** 2, C = (e2 / (1 - e2)) * Math.cos(lr) ** 2;
  const A = Math.cos(lr) * ((lng * Math.PI) / 180 - lo);
  const M = a * ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * lr
    - ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * lr)
    + ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * lr)
    - ((35 * e2 ** 3) / 3072) * Math.sin(6 * lr));
  const east = k0 * N * (A + ((1 - T + C) * A ** 3) / 6 + ((5 - 18 * T + T ** 2 + 72 * C - 58 * (e2 / (1 - e2))) * A ** 5) / 120) + 500000;
  let north = k0 * (M + N * Math.tan(lr) * (A ** 2 / 2 + ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24 + ((61 - 58 * T + T ** 2 + 600 * C - 330 * (e2 / (1 - e2))) * A ** 6) / 720));
  if (lat < 0) north += 10000000;
  return { north: Math.round(north), east: Math.round(east), zone };
}

type SpeciesResult = {
  id: string;
  genus: string;
  species: string;
  commonName: string | null;
  family: string;
  conservationStatus: string | null;
};

type Individual = { dat: string; dap: string; altura: string };
type GrillaPoint = { type: "empty" } | { type: "sinVeg" } | { type: "species"; speciesId: string; label: string };

interface OccurrenceFormProps {
  projectId: string;
  campaignId: string;
  stationId: string;
  surveyType: "FLORA" | "FAUNA";
  methodology: string;
  occurrenceId?: string;
  defaultValues?: Record<string, string>;
  grillaOccurrences?: { speciesId: string; abundance: number; label: string; individuos?: number }[];
  transectoId?: string;
  transectoCoords?: { latitude: number | null; longitude: number | null };
}

export function OccurrenceForm({
  projectId,
  campaignId,
  stationId,
  surveyType,
  methodology,
  occurrenceId,
  defaultValues,
  grillaOccurrences,
  transectoId,
  transectoCoords,
}: OccurrenceFormProps) {
  const router = useRouter();
  const isBB = methodology === "BRAUN_BLANQUET";
  const isMicroruteo = methodology === "MICRORUTEO";
  const isForestal = methodology === "PARCELAS_FORESTALES";
  const isGrilla = methodology === "GRILLA";
  const isTransectoFauna = methodology === "TRANSECTO_LINEAL_FAUNA";

  // Single-species search
  const [speciesQuery, setSpeciesQuery] = useState("");
  const [speciesList, setSpeciesList] = useState<SpeciesResult[]>([]);
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesResult | null>(null);
  const [searching, setSearching] = useState(false);
  const searchSeq = useRef(0);

  // Common
  const [date, setDate] = useState(defaultValues?.date ?? format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState(defaultValues?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  // BB state
  const [bbCover, setBbCover] = useState("");

  // UTM / GPS state (shared by Microruteo + Grilla)
  const [utmNorth, setUtmNorth] = useState("");
  const [utmEast, setUtmEast] = useState("");
  const [utmZoneAuto, setUtmZoneAuto] = useState("19S");
  const [gpsLoading, setGpsLoading] = useState(false);

  // Parcelas Forestales state
  const [individuals, setIndividuals] = useState<Individual[]>([{ dat: "", dap: "", altura: "" }]);

  // Fauna dynamic fields
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  // Session counter (create mode only)
  const [sessionCount, setSessionCount] = useState(0);

  // Grilla state — 16 sequential points
  const EMPTY_POINTS = (): GrillaPoint[] => Array.from({ length: 16 }, () => ({ type: "empty" as const }));
  const [grillaPoints, setGrillaPoints] = useState<GrillaPoint[]>(EMPTY_POINTS());
  const [activePoint, setActivePoint] = useState<number | null>(null);
  const [grillaQuery, setGrillaQuery] = useState("");
  const [grillaSearchList, setGrillaSearchList] = useState<SpeciesResult[]>([]);
  const [searchingGrilla, setSearchingGrilla] = useState(false);
  const grillaSearchSeq = useRef(0);
  // Grilla extras: individual counts per species + GPS + photo
  const [grillaIndividuos, setGrillaIndividuos] = useState<Record<string, string>>({});
  const [grillaPhoto, setGrillaPhoto] = useState<string | null>(null);

  // Fauna transecto state
  const [tfDetectionMethod, setTfDetectionMethod] = useState("");
  const [tfDeviceId, setTfDeviceId] = useState("");
  const [tfTime, setTfTime] = useState(format(new Date(), "HH:mm"));
  const [tfLat, setTfLat] = useState<number | null>(null);
  const [tfLng, setTfLng] = useState<number | null>(null);
  const [tfAbundance, setTfAbundance] = useState("");
  const [shermanCaptures, setShermanCaptures] = useState<{ date: string; abundance: string }[]>([
    { date: format(new Date(), "yyyy-MM-dd"), abundance: "" },
  ]);

  // Load methodology data in edit mode
  useEffect(() => {
    if (!defaultValues?.methodologyData) return;
    try {
      const md = JSON.parse(defaultValues.methodologyData);
      if (isBB && md.bbcover) setBbCover(md.bbcover);
      if (isMicroruteo) {
        if (md.utm_north) setUtmNorth(String(md.utm_north));
        if (md.utm_east) setUtmEast(String(md.utm_east));
        if (md.utm_zone) setUtmZoneAuto(md.utm_zone);
      }
      if (isForestal && Array.isArray(md.individuals) && md.individuals.length > 0) {
        setIndividuals(md.individuals);
      }
      if (isGrilla) {
        if (md.photo) setGrillaPhoto(md.photo);
      }
    } catch {}
  }, []);

  // Load fauna transecto fields in edit mode
  useEffect(() => {
    if (!isTransectoFauna || !defaultValues) return;
    if (defaultValues.detectionMethod) setTfDetectionMethod(defaultValues.detectionMethod);
    if (defaultValues.abundance) setTfAbundance(defaultValues.abundance);
    if (defaultValues.latitude) setTfLat(parseFloat(defaultValues.latitude));
    if (defaultValues.longitude) setTfLng(parseFloat(defaultValues.longitude));
    if (defaultValues.methodologyData) {
      try {
        const md = JSON.parse(defaultValues.methodologyData);
        if (md.time) setTfTime(md.time);
        if (md.deviceId) setTfDeviceId(String(md.deviceId));
      } catch {}
    }
  }, []);

  // Load fauna fields in edit mode
  useEffect(() => {
    if (!defaultValues || isBB || isMicroruteo || isForestal || isTransectoFauna) return;
    const faunaKeys = ["groupSize", "distance", "bearing", "behavior", "detectionMethod", "abundance", "cover", "height", "stratum", "phenology"];
    const loaded: Record<string, string> = {};
    for (const k of faunaKeys) {
      if (defaultValues[k]) loaded[k] = defaultValues[k];
    }
    setFieldValues(loaded);
  }, []);

  // Pre-populate UTM from transecto station coordinates (GRILLA)
  useEffect(() => {
    if (!isGrilla || !transectoCoords?.latitude || !transectoCoords?.longitude) return;
    const { north, east, zone } = latLngToUTM(transectoCoords.latitude, transectoCoords.longitude);
    setUtmNorth(String(north));
    setUtmEast(String(east));
    setUtmZoneAuto(zone);
  }, []);

  // Pre-populate grilla grid from existing occurrences (edit mode)
  useEffect(() => {
    if (!isGrilla || !grillaOccurrences || grillaOccurrences.length === 0) return;
    const points: GrillaPoint[] = [];
    const sorted = [...grillaOccurrences].sort((a, b) => a.label.localeCompare(b.label));
    for (const { speciesId, abundance, label } of sorted) {
      for (let i = 0; i < abundance; i++) {
        points.push({ type: "species", speciesId, label });
      }
    }
    while (points.length < 16) points.push({ type: "sinVeg" });
    setGrillaPoints(points.slice(0, 16));
    // Restore individual counts
    const inds: Record<string, string> = {};
    for (const { speciesId, individuos } of grillaOccurrences) {
      if (individuos) inds[speciesId] = String(individuos);
    }
    setGrillaIndividuos(inds);
  }, []);

  // Single-species search — debounced + stale-check
  useEffect(() => {
    setSpeciesList([]);
    if (!speciesQuery || speciesQuery.length < 1) { setSearching(false); return; }
    setSearching(true);
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      const results = await searchSpecies(speciesQuery, surveyType);
      if (seq === searchSeq.current) {
        setSpeciesList(results);
        setSearching(false);
        if (results.length > 0) import("@/lib/db").then(({ getDb }) => getDb()?.species.bulkPut(results.map(s => ({ ...s, type: surveyType })))).catch(() => {});
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [speciesQuery, surveyType]);

  // Grilla species search — debounced + stale-check
  useEffect(() => {
    setGrillaSearchList([]);
    if (!grillaQuery || grillaQuery.length < 1) { setSearchingGrilla(false); return; }
    setSearchingGrilla(true);
    const seq = ++grillaSearchSeq.current;
    const timer = setTimeout(async () => {
      const results = await searchSpecies(grillaQuery, surveyType);
      if (seq === grillaSearchSeq.current) { setGrillaSearchList(results); setSearchingGrilla(false); }
    }, 250);
    return () => clearTimeout(timer);
  }, [grillaQuery, surveyType]);

  function resetForm() {
    setSelectedSpecies(null);
    setSpeciesQuery("");
    setSpeciesList([]);
    setBbCover("");
    setUtmNorth("");
    setUtmEast("");
    setIndividuals([{ dat: "", dap: "", altura: "" }]);
    setFieldValues({});
    setGrillaPoints(EMPTY_POINTS());
    setActivePoint(null);
    setGrillaQuery("");
    setGrillaSearchList([]);
    setGrillaIndividuos({});
    setGrillaPhoto(null);
    setUtmNorth("");
    setUtmEast("");
    setNotes("");
    setTfDetectionMethod("");
    setTfDeviceId("");
    setTfTime(format(new Date(), "HH:mm"));
    setTfLat(null);
    setTfLng(null);
    setTfAbundance("");
    setShermanCaptures([{ date: format(new Date(), "yyyy-MM-dd"), abundance: "" }]);
  }

  function captureGPS() {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { north, east, zone } = latLngToUTM(pos.coords.latitude, pos.coords.longitude);
        setUtmNorth(String(north));
        setUtmEast(String(east));
        setUtmZoneAuto(zone);
        if (isGrilla && transectoId) {
          try { await updateTransectoCoordinates(transectoId, pos.coords.latitude, pos.coords.longitude); } catch {}
        }
        setGpsLoading(false);
      },
      () => { toast.error("No se pudo obtener ubicación GPS"); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function captureGPSFauna() {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setTfLat(pos.coords.latitude);
        setTfLng(pos.coords.longitude);
        setGpsLoading(false);
      },
      () => { toast.error("No se pudo obtener ubicación GPS"); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function addShermanCapture() {
    setShermanCaptures(prev => [...prev, { date: format(new Date(), "yyyy-MM-dd"), abundance: "" }]);
  }
  function removeShermanCapture(i: number) {
    setShermanCaptures(prev => prev.filter((_, idx) => idx !== i));
  }
  function updateShermanCapture(i: number, field: "date" | "abundance", value: string) {
    setShermanCaptures(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  }

  function addIndividual() {
    setIndividuals((prev) => [...prev, { dat: "", dap: "", altura: "" }]);
  }

  function removeIndividual(i: number) {
    setIndividuals((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateIndividual(i: number, field: keyof Individual, value: string) {
    setIndividuals((prev) => prev.map((ind, idx) => idx === i ? { ...ind, [field]: value } : ind));
  }

  async function saveOffline(payload: OccurrencePayload, label: string) {
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    if (!db) return;
    await db.pendingOccurrences.add({
      stationId, projectId, campaignId, methodology, surveyType,
      payload, speciesLabel: label, createdAt: Date.now(), status: "pending",
    });
    toast.success("Sin conexión — registro guardado localmente", {
      description: "Se subirá automáticamente cuando haya internet.",
    });
    setSessionCount(n => n + 1);
    resetForm();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // GRILLA batch create/update
    if (isGrilla) {
      const filled = grillaPoints.filter(p => p.type !== "empty");
      if (filled.length === 0) { toast.error("Completa al menos un punto de la grilla"); return; }

      const speciesCounts = new Map<string, number>();
      let sinVegCount = 0;
      for (const p of grillaPoints) {
        if (p.type === "species") speciesCounts.set(p.speciesId, (speciesCounts.get(p.speciesId) ?? 0) + 1);
        else if (p.type === "sinVeg") sinVegCount++;
      }

      const gridPayload = {
        date: date || format(new Date(), "yyyy-MM-dd"),
        notes: notes || undefined,
        sinVegetacion: sinVegCount,
        photo: grillaPhoto || undefined,
        species: Array.from(speciesCounts.entries()).map(([speciesId, count]) => ({
          speciesId,
          count,
          individuos: grillaIndividuos[speciesId] ? parseInt(grillaIndividuos[speciesId]) : undefined,
        })),
      };

      if (!occurrenceId && !navigator.onLine) {
        await saveOffline({ kind: "grilla", data: gridPayload }, `Grilla (${gridPayload.species.length} esp.)`);
        return;
      }

      setSubmitting(true);
      if (occurrenceId) {
        const result = await updateGrillaOccurrences(projectId, campaignId, stationId, gridPayload);
        setSubmitting(false);
        if ("error" in result && result.error) { toast.error(String(result.error)); }
        else {
          toast.success("Grilla actualizada");
          const back = transectoId
            ? `/ocurrencias?projectId=${projectId}&campaignId=${campaignId}&transectoId=${transectoId}&stationId=${stationId}`
            : `/ocurrencias?projectId=${projectId}&campaignId=${campaignId}&stationId=${stationId}`;
          router.push(back);
        }
      } else {
        const result = await createGrillaOccurrences(projectId, campaignId, stationId, gridPayload);
        setSubmitting(false);
        if ("error" in result && result.error) { toast.error(String(result.error)); }
        else if ("success" in result) {
          toast.success(`Grilla registrada — ${result.count} especie${result.count === 1 ? "" : "s"}`);
          setSessionCount((n) => n + (result.count ?? 0));
          resetForm();
        }
      }
      return;
    }

    // Fauna transecto flow
    if (isTransectoFauna) {
      const speciesId = selectedSpecies?.id ?? defaultValues?.speciesId ?? "";
      if (!speciesId) { toast.error("Selecciona una especie"); return; }
      if (!tfDetectionMethod) { toast.error("Selecciona el método de detección"); return; }
      const needsDevice = tfDetectionMethod === "Trampa Sherman" || tfDetectionMethod === "Cámara trampa";
      if (needsDevice && !tfDeviceId) {
        toast.error(`Ingresa el N° de ${tfDetectionMethod === "Trampa Sherman" ? "trampa" : "cámara"}`);
        return;
      }

      const buildMethodologyData = () => JSON.stringify({
        ...(tfTime ? { time: tfTime } : {}),
        ...(tfDeviceId ? { deviceId: parseInt(tfDeviceId) } : {}),
      });

      if (!occurrenceId && tfDetectionMethod === "Trampa Sherman") {
        const validCaptures = shermanCaptures.filter(c => c.date && c.abundance);
        if (validCaptures.length === 0) { toast.error("Agrega al menos una captura"); return; }

        if (!navigator.onLine) {
          await saveOffline({
            kind: "sherman", data: {
              speciesId, detectionMethod: tfDetectionMethod,
              deviceId: tfDeviceId || undefined,
              latitude: tfLat !== null ? String(tfLat) : undefined,
              longitude: tfLng !== null ? String(tfLng) : undefined,
              notes: notes || undefined,
              methodologyData: buildMethodologyData(),
              captures: validCaptures,
            }
          }, selectedSpecies ? `${selectedSpecies.genus} ${selectedSpecies.species}` : "Especie");
          return;
        }

        setSubmitting(true);
        const methodologyData = buildMethodologyData();
        let count = 0;
        for (const capture of validCaptures) {
          const result = await createOccurrence(projectId, campaignId, stationId, {
            speciesId,
            date: capture.date,
            abundance: capture.abundance,
            detectionMethod: tfDetectionMethod,
            latitude: tfLat !== null ? String(tfLat) : undefined,
            longitude: tfLng !== null ? String(tfLng) : undefined,
            notes: notes || undefined,
            methodologyData,
          });
          if ("success" in result) count++;
        }
        setSubmitting(false);
        if (count > 0) {
          toast.success(`${count} captura${count === 1 ? "" : "s"} de trampa Sherman registrada${count === 1 ? "" : "s"}`);
          setSessionCount(n => n + count);
          resetForm();
        }
      } else {
        if (!tfAbundance) { toast.error("Ingresa el N° de individuos"); return; }
        const methodologyData = buildMethodologyData();

        if (!occurrenceId && !navigator.onLine) {
          await saveOffline({ kind: "single", data: {
            speciesId, date: date || format(new Date(), "yyyy-MM-dd"),
            abundance: tfAbundance, detectionMethod: tfDetectionMethod,
            latitude: tfLat !== null ? String(tfLat) : undefined,
            longitude: tfLng !== null ? String(tfLng) : undefined,
            notes: notes || undefined, methodologyData,
          }}, selectedSpecies ? `${selectedSpecies.genus} ${selectedSpecies.species}` : "Especie");
          return;
        }

        setSubmitting(true);
        const payload = {
          speciesId,
          date: date || format(new Date(), "yyyy-MM-dd"),
          abundance: tfAbundance,
          detectionMethod: tfDetectionMethod,
          latitude: tfLat !== null ? String(tfLat) : undefined,
          longitude: tfLng !== null ? String(tfLng) : undefined,
          notes: notes || undefined,
          methodologyData,
        };
        const result = occurrenceId
          ? await updateOccurrence(projectId, campaignId, stationId, occurrenceId, payload)
          : await createOccurrence(projectId, campaignId, stationId, payload);
        setSubmitting(false);
        if ("error" in result && result.error) {
          toast.error(String(result.error));
        } else if (occurrenceId) {
          toast.success("Registro actualizado");
          router.push(`/ocurrencias?stationId=${stationId}`);
        } else {
          toast.success("Especie registrada");
          setSessionCount(n => n + 1);
          resetForm();
        }
      }
      return;
    }

    // Single-species flow
    const speciesId = selectedSpecies?.id ?? defaultValues?.speciesId ?? "";
    if (!speciesId) { toast.error("Selecciona una especie"); return; }

    let methodologyData: string | undefined;
    if (isBB) {
      if (!bbCover) { toast.error("Selecciona el código de cobertura"); return; }
      methodologyData = JSON.stringify({ bbcover: bbCover });
    } else if (isMicroruteo) {
      if (!utmNorth || !utmEast) { toast.error("Captura las coordenadas GPS"); return; }
      methodologyData = JSON.stringify({ utm_north: utmNorth, utm_east: utmEast, utm_zone: utmZoneAuto });
    } else if (isForestal) {
      const validInds = individuals.filter((i) => i.dat || i.dap || i.altura);
      if (validInds.length === 0) { toast.error("Agrega al menos un individuo"); return; }
      methodologyData = JSON.stringify({ individuals: validInds });
    }

    const payload = {
      speciesId,
      date: date || format(new Date(), "yyyy-MM-dd"),
      notes: notes || undefined,
      methodologyData,
      ...(!isBB && !isMicroruteo && !isForestal ? fieldValues : {}),
    };

    if (!occurrenceId && !navigator.onLine) {
      await saveOffline({ kind: "single", data: payload },
        selectedSpecies ? `${selectedSpecies.genus} ${selectedSpecies.species}` : "Especie");
      return;
    }

    setSubmitting(true);
    const result = occurrenceId
      ? await updateOccurrence(projectId, campaignId, stationId, occurrenceId, payload)
      : await createOccurrence(projectId, campaignId, stationId, payload);
    setSubmitting(false);

    if ("error" in result && result.error) {
      toast.error("Error al guardar");
    } else if (occurrenceId) {
      toast.success("Ocurrencia actualizada");
      router.push(`/ocurrencias?stationId=${stationId}`);
    } else {
      toast.success("Especie registrada");
      setSessionCount((n) => n + 1);
      resetForm();
    }
  }

  const gpsButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={gpsLoading}
      onClick={captureGPS}
      className="gap-1.5 h-8 text-xs"
    >
      {gpsLoading
        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Obteniendo...</>
        : <><MapPin className="h-3.5 w-3.5" /> Capturar GPS</>}
    </Button>
  );

  const utmDisplay = (utmNorth || utmEast) ? (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-600">Norte</Label>
          <Input type="text" readOnly value={utmNorth} className="bg-gray-50 font-mono text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-600">Este</Label>
          <Input type="text" readOnly value={utmEast} className="bg-gray-50 font-mono text-sm" />
        </div>
      </div>
      <p className="text-xs text-teal-700 bg-teal-50 rounded px-3 py-1.5">
        Zona: <span className="font-semibold">{utmZoneAuto}</span> · coordenadas calculadas automáticamente
      </p>
    </>
  ) : (
    <p className="text-xs text-gray-400 bg-gray-50 rounded px-3 py-2">
      Presiona "Capturar GPS" para obtener las coordenadas UTM del punto.
    </p>
  );

  return (
    <Card>
      <CardContent className="pt-5">
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Species search — hidden in GRILLA (grid handles species selection) */}
          {!isGrilla && (
            <SpeciesSearch
              query={speciesQuery}
              setQuery={setSpeciesQuery}
              list={speciesList}
              selected={selectedSpecies}
              setSelected={setSelectedSpecies}
              searching={searching}
              hasExisting={!!defaultValues?.speciesId && !selectedSpecies}
              existingLabel={defaultValues?.speciesLabel}
            />
          )}

          {/* Date — hidden for transecto fauna (handled inside custom section) */}
          {!isTransectoFauna && (
            <div className="space-y-1.5">
              <Label htmlFor="date">Fecha de registro</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          )}

          {/* ── BRAUN-BLANQUET ── */}
          {isBB && (
            <div className="space-y-2">
              <Label>Código de cobertura (Braun-Blanquet) <span className="text-red-500">*</span></Label>
              <div className="grid grid-cols-1 gap-1.5">
                {BB_COVER_CODES.map(({ code, desc }) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setBbCover(code)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors",
                      bbCover === code
                        ? "border-teal-600 bg-teal-50"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <span className={cn(
                      "font-mono font-bold text-sm w-6 shrink-0 text-center",
                      bbCover === code ? "text-teal-700" : "text-gray-600"
                    )}>
                      {code}
                    </span>
                    <span className="text-xs text-gray-600">{desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── MICRORUTEO ── */}
          {isMicroruteo && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Coordenadas UTM <span className="text-red-500">*</span></Label>
                {gpsButton}
              </div>
              {utmDisplay}
            </div>
          )}

          {/* ── PARCELAS FORESTALES ── */}
          {isForestal && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Individuos <span className="text-red-500">*</span></Label>
                <Button type="button" variant="outline" size="sm" onClick={addIndividual} className="gap-1 h-7 text-xs">
                  <Plus className="h-3.5 w-3.5" /> Agregar
                </Button>
              </div>
              <div className="space-y-2">
                {individuals.map((ind, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500">Individuo {i + 1}</span>
                      {individuals.length > 1 && (
                        <button type="button" onClick={() => removeIndividual(i)} className="text-red-400 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">DAT (cm)</Label>
                        <Input type="number" step="0.1" placeholder="0" value={ind.dat}
                          onChange={(e) => updateIndividual(i, "dat", e.target.value)} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">DAP (cm)</Label>
                        <Input type="number" step="0.1" placeholder="0" value={ind.dap}
                          onChange={(e) => updateIndividual(i, "dap", e.target.value)} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Altura (m)</Label>
                        <Input type="number" step="0.1" placeholder="0" value={ind.altura}
                          onChange={(e) => updateIndividual(i, "altura", e.target.value)} className="h-8 text-sm" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400">
                DAT = Diámetro a la altura del tocón · DAP = Diámetro a la altura del pecho
              </p>
            </div>
          )}

          {/* ── GRILLA ── */}
          {isGrilla && (
            <>
              <div className="space-y-3">
                <Label>Puntos de intersección <span className="text-red-500">*</span></Label>

                {/* 16-point grid */}
                <div className="grid grid-cols-4 gap-2">
                  {grillaPoints.map((point, idx) => {
                    const isActive = activePoint === idx;
                    const label =
                      point.type === "sinVeg" ? "S/V"
                      : point.type === "species" ? point.label.split(" ").slice(0, 2).join(" ").slice(0, 10)
                      : "—";
                    const bg =
                      isActive ? "border-teal-600 bg-teal-50"
                      : point.type === "sinVeg" ? "border-gray-300 bg-gray-100"
                      : point.type === "species" ? "border-teal-300 bg-teal-50"
                      : "border-gray-200 bg-white";
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActivePoint(isActive ? null : idx)}
                        className={`rounded-lg border-2 p-2 text-center transition-all ${bg}`}
                      >
                        <p className="text-xs text-gray-400 font-mono leading-none mb-1">{idx + 1}</p>
                        <p className={`text-xs font-medium leading-tight truncate ${point.type === "species" ? "italic text-teal-800" : point.type === "sinVeg" ? "text-gray-500" : "text-gray-300"}`}>
                          {label}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Point editor — shown when a point is active */}
                {activePoint !== null && (
                  <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
                    <p className="text-xs font-semibold text-gray-600">Punto {activePoint + 1}</p>

                    {/* Current assignment */}
                    {grillaPoints[activePoint].type !== "empty" && (
                      <div className="flex items-center justify-between bg-white rounded px-3 py-1.5 border text-sm">
                        <span className={grillaPoints[activePoint].type === "species" ? "italic" : "text-gray-500"}>
                          {grillaPoints[activePoint].type === "sinVeg" ? "Sin Vegetación"
                            : (grillaPoints[activePoint] as { type: "species"; label: string }).label}
                        </span>
                        <button type="button" className="text-red-400 hover:text-red-600 ml-2 shrink-0"
                          onClick={() => {
                            setGrillaPoints(prev => prev.map((p, i) => i === activePoint ? { type: "empty" } : p));
                          }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Sin Vegetación button */}
                    <button
                      type="button"
                      onClick={() => {
                        setGrillaPoints(prev => prev.map((p, i) => i === activePoint ? { type: "sinVeg" } : p));
                        setActivePoint(activePoint < 15 ? activePoint + 1 : null);
                        setGrillaQuery(""); setGrillaSearchList([]);
                      }}
                      className="w-full text-left px-3 py-2 rounded border border-gray-300 bg-white hover:bg-gray-100 text-sm text-gray-600"
                    >
                      Sin Vegetación
                    </button>

                    {/* Species search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        className="pl-9 bg-white"
                        placeholder="Buscar especie..."
                        value={grillaQuery}
                        onChange={(e) => setGrillaQuery(e.target.value)}
                        autoFocus
                      />
                    </div>
                    {searchingGrilla && <p className="text-xs text-gray-400">Buscando...</p>}
                    {grillaSearchList.length > 0 && (
                      <div className="border rounded-lg max-h-44 overflow-y-auto divide-y bg-white">
                        {grillaSearchList.map((sp) => (
                          <button
                            key={sp.id}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-teal-50 text-sm"
                            onClick={() => {
                              const label = `${sp.genus} ${sp.species}${sp.commonName ? ` · ${sp.commonName}` : ""}`;
                              setGrillaPoints(prev => prev.map((p, i) => i === activePoint ? { type: "species", speciesId: sp.id, label } : p));
                              setActivePoint(activePoint < 15 ? activePoint + 1 : null);
                              setGrillaQuery(""); setGrillaSearchList([]);
                            }}
                          >
                            <span className="italic font-medium">{sp.genus} {sp.species}</span>
                            {sp.commonName && <span className="text-gray-500 ml-2">· {sp.commonName}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Progress summary */}
                {grillaPoints.some(p => p.type !== "empty") && (
                  <div className="bg-teal-50 rounded-lg px-3 py-2 space-y-1">
                    <div className="w-full bg-teal-200 rounded-full h-1.5">
                      <div className="bg-teal-600 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.round((grillaPoints.filter(p => p.type !== "empty").length / 16) * 100)}%` }} />
                    </div>
                    <p className="text-xs text-gray-600">
                      {grillaPoints.filter(p => p.type !== "empty").length}/16 puntos ·{" "}
                      {new Set(grillaPoints.filter(p => p.type === "species").map(p => (p as { speciesId: string }).speciesId)).size} esp. ·{" "}
                      {grillaPoints.filter(p => p.type === "sinVeg").length} S/V
                    </p>
                  </div>
                )}
              </div>

              {/* ── Individuos por especie ── */}
              {(() => {
                const speciesMap = new Map<string, { speciesId: string; label: string; pts: number }>();
                for (const p of grillaPoints) {
                  if (p.type === "species") {
                    const ex = speciesMap.get(p.speciesId);
                    if (ex) ex.pts++;
                    else speciesMap.set(p.speciesId, { speciesId: p.speciesId, label: p.label, pts: 1 });
                  }
                }
                const list = Array.from(speciesMap.values()).sort((a, b) => a.label.localeCompare(b.label));
                if (list.length === 0) return null;
                return (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">N° individuos por especie <span className="text-gray-400 font-normal text-xs">(opcional)</span></Label>
                    <div className="space-y-2">
                      {list.map(({ speciesId, label, pts }) => (
                        <div key={speciesId} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs italic text-gray-800 truncate">{label.split(" · ")[0]}</p>
                            <p className="text-xs text-gray-400">{pts} pts intersección</p>
                          </div>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="—"
                            value={grillaIndividuos[speciesId] ?? ""}
                            onChange={(e) => setGrillaIndividuos(prev => ({ ...prev, [speciesId]: e.target.value }))}
                            className="w-20 h-8 text-sm text-right font-mono"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* ── GPS del transecto ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Coordenadas UTM del transecto <span className="text-gray-400 font-normal text-xs">(opcional)</span></Label>
                  {gpsButton}
                </div>
                <p className="text-xs text-gray-400">Se guarda una sola vez para el transecto completo, no por punto de grilla.</p>
                {utmDisplay}
              </div>

              {/* ── Foto ── */}
              <div className="space-y-2">
                <Label>Foto <span className="text-gray-400 font-normal text-xs">(opcional)</span></Label>
                {grillaPhoto ? (
                  <div className="relative w-fit">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={grillaPhoto} alt="Foto grilla" className="h-32 rounded-lg border object-cover" />
                    <button type="button" onClick={() => setGrillaPhoto(null)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs leading-none">
                      ×
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-sm text-gray-500 w-fit">
                    <Plus className="h-4 w-4" />
                    Tomar / seleccionar foto
                    <input type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const canvas = document.createElement("canvas");
                        const img = new Image();
                        const url = URL.createObjectURL(file);
                        img.onload = () => {
                          const MAX = 900;
                          let w = img.width, h = img.height;
                          if (w > MAX || h > MAX) { if (w > h) { h = Math.round(h * MAX / w); w = MAX; } else { w = Math.round(w * MAX / h); h = MAX; } }
                          canvas.width = w; canvas.height = h;
                          canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
                          setGrillaPhoto(canvas.toDataURL("image/jpeg", 0.72));
                          URL.revokeObjectURL(url);
                        };
                        img.src = url;
                      }}
                    />
                  </label>
                )}
              </div>
            </>
          )}

          {/* ── TRANSECTO LINEAL FAUNA ── */}
          {isTransectoFauna && (
            <>
              {/* Detection method */}
              <div className="space-y-1.5">
                <Label>Método de detección <span className="text-red-500">*</span></Label>
                <Select value={tfDetectionMethod} onValueChange={(v) => setTfDetectionMethod(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {["POA", "Trampa Sherman", "Cámara trampa", "Observación directa", "Captura manual", "Otro"].map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Device ID — Sherman or Camera */}
              {(tfDetectionMethod === "Trampa Sherman" || tfDetectionMethod === "Cámara trampa") && (
                <div className="space-y-1.5">
                  <Label htmlFor="tfDeviceId">
                    N° de {tfDetectionMethod === "Trampa Sherman" ? "trampa" : "cámara"} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="tfDeviceId"
                    type="number"
                    min={1}
                    step={1}
                    placeholder="Ej: 1"
                    value={tfDeviceId}
                    onChange={(e) => setTfDeviceId(e.target.value)}
                    className="max-w-[140px]"
                  />
                </div>
              )}

              {/* Sherman: multi-row captures by day */}
              {!occurrenceId && tfDetectionMethod === "Trampa Sherman" ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Capturas por día <span className="text-red-500">*</span></Label>
                    <Button type="button" variant="outline" size="sm" onClick={addShermanCapture} className="gap-1 h-7 text-xs">
                      <Plus className="h-3.5 w-3.5" /> Agregar día
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {shermanCaptures.map((capture, i) => (
                      <div key={i} className="flex gap-2 items-end bg-gray-50 rounded-lg p-2">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">Fecha</Label>
                          <Input type="date" value={capture.date}
                            onChange={(e) => updateShermanCapture(i, "date", e.target.value)}
                            className="h-8 text-sm" />
                        </div>
                        <div className="w-28 space-y-1">
                          <Label className="text-xs">N° individuos</Label>
                          <Input type="number" min={0} placeholder="0" value={capture.abundance}
                            onChange={(e) => updateShermanCapture(i, "abundance", e.target.value)}
                            className="h-8 text-sm" />
                        </div>
                        {shermanCaptures.length > 1 && (
                          <button type="button" onClick={() => removeShermanCapture(i)}
                            className="text-red-400 hover:text-red-600 pb-1">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* All other methods or edit mode: single date + time + abundance */
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="date">Fecha <span className="text-red-500">*</span></Label>
                    <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tfAbundance">N° individuos <span className="text-red-500">*</span></Label>
                    <Input id="tfAbundance" type="number" min={0} placeholder="0"
                      value={tfAbundance} onChange={(e) => setTfAbundance(e.target.value)}
                      className="max-w-[140px]" />
                  </div>
                </div>
              )}

              {/* GPS */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Coordenadas GPS <span className="text-gray-400 font-normal text-xs">(opcional)</span></Label>
                  <Button type="button" variant="outline" size="sm" onClick={captureGPSFauna}
                    disabled={gpsLoading} className="gap-1.5 h-8 text-xs">
                    {gpsLoading
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Obteniendo...</>
                      : <><MapPin className="h-3.5 w-3.5" /> Capturar GPS</>}
                  </Button>
                </div>
                {tfLat !== null ? (
                  <p className="text-xs text-teal-700 bg-teal-50 rounded px-3 py-1.5 font-mono">
                    {tfLat.toFixed(6)}, {tfLng!.toFixed(6)}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 bg-gray-50 rounded px-3 py-2">
                    Presiona "Capturar GPS" para registrar las coordenadas del avistamiento.
                  </p>
                )}
              </div>
            </>
          )}

          {/* ── FAUNA dynamic fields ── */}
          {!isBB && !isMicroruteo && !isForestal && !isGrilla && !isTransectoFauna && surveyType === "FAUNA" && (
            <FaunaFields
              methodology={methodology}
              values={fieldValues}
              onChange={(k, v) => setFieldValues((prev) => ({ ...prev, [k]: v }))}
            />
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones adicionales..."
              rows={2}
            />
          </div>

          {sessionCount > 0 && !occurrenceId && (
            <div className="flex items-center gap-2 text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                {sessionCount} {sessionCount === 1 ? "especie registrada" : "especies registradas"} en esta estación
              </span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
              {!occurrenceId && sessionCount > 0 ? "Finalizar estación" : "Cancelar"}
            </Button>
            <Button type="submit" className="flex-1 bg-teal-700 hover:bg-teal-800" disabled={submitting}>
              {submitting ? "Guardando..."
                : isGrilla
                  ? `${occurrenceId ? "Actualizar" : "Registrar"} grilla (${grillaPoints.filter(p => p.type !== "empty").length}/16 puntos)`
                  : occurrenceId ? "Actualizar" : "Registrar especie"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Species search sub-component ──
function SpeciesSearch({
  query, setQuery, list, selected, setSelected, searching, hasExisting, existingLabel,
}: {
  query: string;
  setQuery: (v: string) => void;
  list: SpeciesResult[];
  selected: SpeciesResult | null;
  setSelected: (s: SpeciesResult | null) => void;
  searching: boolean;
  hasExisting: boolean;
  existingLabel?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>Especie <span className="text-red-500">*</span></Label>
      {selected ? (
        <div className="flex items-center justify-between bg-teal-50 rounded-lg px-3 py-2 border border-teal-200">
          <div>
            <p className="text-sm font-medium italic">{selected.genus} {selected.species}</p>
            {selected.commonName && <p className="text-xs text-gray-500">{selected.commonName}</p>}
          </div>
          <button
            type="button"
            className="text-xs text-red-500 hover:text-red-700 shrink-0 ml-3"
            onClick={() => { setSelected(null); setQuery(""); }}
          >
            Cambiar
          </button>
        </div>
      ) : hasExisting ? (
        <div className="px-3 py-2 bg-gray-50 rounded-lg border text-xs text-gray-500">
          {existingLabel ?? "Especie cargada — busca para cambiarla"}
        </div>
      ) : null}
      {!selected && (
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre científico o común..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); }}
          />
        </div>
      )}
      {searching && <p className="text-xs text-gray-400">Buscando...</p>}
      {list.length > 0 && !selected && (
        <div className="border rounded-lg max-h-44 overflow-y-auto divide-y">
          {list.map((sp) => (
            <button
              key={sp.id}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-teal-50 text-sm"
              onClick={() => { setSelected(sp); setQuery(`${sp.genus} ${sp.species}`); }}
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
    </div>
  );
}

// ── Fauna dynamic fields sub-component ──
function FaunaFields({
  methodology, values, onChange,
}: {
  methodology: string;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const config = getMethodologyById(methodology);
  if (!config || config.fields.length === 0) return null;

  return (
    <>
      {config.fields.map((field) => (
        <div key={field.key} className="space-y-1.5">
          <Label htmlFor={field.key}>
            {field.label}
            {field.unit && <span className="text-gray-400 text-xs ml-1">({field.unit})</span>}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          {field.type === "select" ? (
            <Select
              value={values[field.key] ?? ""}
              onValueChange={(v) => onChange(field.key, v ?? "")}
            >
              <SelectTrigger id={field.key}>
                <SelectValue>
                  {values[field.key]
                    ? values[field.key]
                    : <span className="text-muted-foreground">Seleccionar...</span>}
                </SelectValue>
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
              value={values[field.key] ?? ""}
              onChange={(e) => onChange(field.key, e.target.value)}
            />
          )}
        </div>
      ))}
    </>
  );
}
