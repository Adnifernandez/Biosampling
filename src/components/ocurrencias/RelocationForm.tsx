"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Loader2, CheckCircle2 } from "lucide-react";
import { updateRelocation } from "@/app/(app)/proyectos/[id]/campanas/[cid]/estaciones/[sid]/ocurrencias/actions";
import { toast } from "sonner";

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

interface RelocationFormProps {
  projectId: string;
  campaignId: string;
  stationId: string;
  occurrenceId: string;
  species: { genus: string; species: string; commonName: string | null };
  individualCode: string;
  existingRelocation: { latitude: number | null; longitude: number | null; notes: string | null } | null;
  backHref: string;
}

export function RelocationForm({
  projectId,
  campaignId,
  stationId,
  occurrenceId,
  species,
  individualCode,
  existingRelocation,
  backHref,
}: RelocationFormProps) {
  const router = useRouter();
  const [gpsLoading, setGpsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [utmNorth, setUtmNorth] = useState("");
  const [utmEast, setUtmEast] = useState("");
  const [utmZone, setUtmZone] = useState("19S");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [notes, setNotes] = useState(existingRelocation?.notes ?? "");
  const [saved, setSaved] = useState(false);

  function captureGPS() {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { north, east, zone } = latLngToUTM(pos.coords.latitude, pos.coords.longitude);
        setUtmNorth(String(north));
        setUtmEast(String(east));
        setUtmZone(zone);
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setGpsLoading(false);
      },
      () => { toast.error("No se pudo obtener ubicación GPS"); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await updateRelocation(projectId, campaignId, stationId, occurrenceId, {
      latitude: lat !== null ? String(lat) : undefined,
      longitude: lng !== null ? String(lng) : undefined,
      notes: notes || undefined,
    });
    setSubmitting(false);
    if ("error" in result && result.error) {
      toast.error(String(result.error));
    } else {
      setSaved(true);
      toast.success("Relocalización registrada");
      router.push(backHref);
    }
  }

  return (
    <div className="space-y-4">
      {/* Capture info card */}
      <Card>
        <CardContent className="py-4 px-4">
          <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Individuo capturado</p>
          <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-orange-200 bg-orange-50">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm italic text-gray-900">{species.genus} {species.species}</p>
              {species.commonName && <p className="text-xs text-gray-500">{species.commonName}</p>}
            </div>
            {individualCode && (
              <span className="font-mono text-sm font-bold text-orange-700 bg-white border border-orange-200 rounded px-2 py-0.5 shrink-0">
                {individualCode}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Relocation form */}
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* GPS release point */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Coordenadas UTM de relocalización <span className="text-gray-400 font-normal text-xs">(opcional)</span></Label>
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
              </div>
              {(utmNorth || utmEast) ? (
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
                    Zona: <span className="font-semibold">{utmZone}</span> · coordenadas calculadas automáticamente
                  </p>
                </>
              ) : existingRelocation?.latitude ? (
                <p className="text-xs text-orange-700 bg-orange-50 rounded px-3 py-1.5">
                  Ya tiene coordenadas registradas. Captura GPS para actualizarlas.
                </p>
              ) : (
                <p className="text-xs text-gray-400 bg-gray-50 rounded px-3 py-2">
                  Presiona "Capturar GPS" para registrar el punto de liberación del individuo.
                </p>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Condiciones del individuo, observaciones del punto de liberación..."
                rows={3}
              />
            </div>

            {saved && (
              <div className="flex items-center gap-2 text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Relocalización guardada correctamente
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => router.push(backHref)}>
                Volver
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                disabled={submitting}
              >
                {submitting ? "Guardando..." : existingRelocation ? "Actualizar relocalización" : "Registrar relocalización"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
