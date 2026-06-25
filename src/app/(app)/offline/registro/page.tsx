"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { getDb } from "@/lib/db";
import type { CachedProject, CachedCampaign, CachedStation, PendingCampaign, PendingStation, OccurrencePayload, SingleOccurrenceData } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WifiOff, Wifi, ArrowLeft, Plus, ChevronRight, CheckCircle2, Clock, AlertCircle, X, Pencil, Trash2 } from "lucide-react";
import { METHODOLOGIES } from "@/lib/methodologies";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const OccurrenceForm = dynamic(
  () => import("@/components/ocurrencias/OccurrenceForm").then((m) => ({ default: m.OccurrenceForm })),
  { ssr: false, loading: () => <div className="text-sm text-gray-400 py-8 text-center">Cargando formulario…</div> }
);

// ── Constants ──
const SEASONS = ["Verano", "Otoño", "Invierno", "Primavera"] as const;
const RESPONSIBLE_PERSONS = [
  "Álvaro Esparza", "Ángela Schafer", "Catalina Lastra", "Claudia Cortés",
  "Diego Verdugo", "Gabriel Cruz", "Gabriel Meriot", "Graciela Páez",
  "Katterin Gutiérrez", "Macarena Toledo", "Nicolás Cortés", "Rodrigo Martínez", "Vicente Santibáñez",
];

function generateLocalKey(): string {
  return `lk_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function getStationPrefix(methodology: string): string {
  if (methodology === "GRILLA") return "T";
  if (methodology === "TRANSECTO_LINEAL_FAUNA") return "T";
  if (methodology === "MICRORUTEO") return "R";
  if (methodology === "PARCELAS_FORESTALES") return "PF";
  return "P";
}

function getStationType(methodology: string): string {
  if (["GRILLA", "TRANSECTO_LINEAL_FAUNA"].includes(methodology)) return "TRANSECTO";
  return "PARCELA";
}

function suggestNextStationName(
  realStations: CachedStation[],
  pendingList: PendingStation[],
  methodology: string
): string {
  const prefix = getStationPrefix(methodology);
  const regex = new RegExp(`^${prefix}(\\d+)$`);
  let max = 0;
  for (const s of [...realStations, ...pendingList]) {
    const match = s.name.match(regex);
    if (match) max = Math.max(max, parseInt(match[1]));
  }
  return `${prefix}${max + 1}`;
}

// ── Helpers ──
function parseCampaignName(name: string): { season: typeof SEASONS[number]; suffix: string } {
  const dashIdx = name.indexOf(" — ");
  const basePart = dashIdx !== -1 ? name.slice(0, dashIdx) : name;
  const suffix = dashIdx !== -1 ? name.slice(dashIdx + 3) : "";
  const season = SEASONS.find((s) => basePart.startsWith(s)) ?? "Verano";
  return { season, suffix };
}

interface SessionOccurrence {
  localId: number;
  speciesLabel: string;
  payload: OccurrencePayload;
}

function sessionOccurrenceToDefaultValues(occ: SessionOccurrence): Record<string, string> {
  if (occ.payload.kind !== "single") return {};
  const d = occ.payload.data as SingleOccurrenceData;
  const result: Record<string, string> = {
    speciesId: d.speciesId,
    speciesLabel: occ.speciesLabel,
    date: d.date,
  };
  const optionals = ["notes", "abundance", "cover", "height", "stratum", "phenology", "distance", "bearing", "groupSize", "behavior", "detectionMethod", "methodologyData", "latitude", "longitude"] as const;
  for (const k of optionals) {
    const v = d[k as keyof SingleOccurrenceData];
    if (v) result[k] = String(v);
  }
  return result;
}

// ── Step types ──
type Step = "project" | "campaign" | "station" | "occurrence";

interface SelectedCampaignMeta {
  id?: string;          // real server ID
  localKey?: string;    // pending local key
  name: string;
  surveyType: string;
  methodology: string;
  shermanTrapCount?: number | null;
  cameraTrapCount?: number | null;
}

interface SelectedStationMeta {
  id?: string;          // real server ID
  localKey?: string;    // pending local key
  name: string;
}

// ── Sub-components ──

function StepBar({ step, onGoTo }: { step: Step; onGoTo: (s: Step) => void }) {
  const steps: { key: Step; label: string }[] = [
    { key: "project", label: "Proyecto" },
    { key: "campaign", label: "Campaña" },
    { key: "station", label: "Réplica" },
    { key: "occurrence", label: "Ocurrencia" },
  ];
  const idx = steps.findIndex((s) => s.key === step);
  return (
    <div className="flex items-center gap-1 text-xs overflow-x-auto pb-1">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1 shrink-0">
          {i > 0 && <ChevronRight className="h-3 w-3 text-gray-300" />}
          <button
            onClick={() => i < idx && onGoTo(s.key)}
            className={cn(
              "px-2 py-1 rounded-full font-medium transition-colors",
              i === idx ? "bg-teal-700 text-white" :
              i < idx ? "text-teal-700 hover:underline cursor-pointer" :
              "text-gray-400 cursor-default"
            )}
          >
            {s.label}
          </button>
        </div>
      ))}
    </div>
  );
}

function OfflineBadge({ isOnline }: { isOnline: boolean }) {
  if (isOnline) return (
    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700">
      <Wifi className="h-4 w-4 shrink-0" />
      Con internet — los registros se guardan directamente
    </div>
  );
  return (
    <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-sm text-yellow-700">
      <WifiOff className="h-4 w-4 shrink-0" />
      Sin conexión — los datos se guardan localmente y suben al reconectarte
    </div>
  );
}

function PendingBadge({ status }: { status: "pending" | "synced" | "error" }) {
  if (status === "pending") return (
    <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 rounded px-1.5 py-0.5">
      <Clock className="h-3 w-3" /> Pendiente
    </span>
  );
  if (status === "synced") return (
    <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 rounded px-1.5 py-0.5">
      <CheckCircle2 className="h-3 w-3" /> Subido
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 rounded px-1.5 py-0.5">
      <AlertCircle className="h-3 w-3" /> Error
    </span>
  );
}

// ── Campaign creation/edit form ──
function NewCampaignForm({
  projectId,
  onCreated,
  onUpdated,
  onCancel,
  editData,
}: {
  projectId: string;
  onCreated: (c: SelectedCampaignMeta) => void;
  onUpdated?: (c: SelectedCampaignMeta) => void;
  onCancel: () => void;
  editData?: PendingCampaign;
}) {
  const parsed = editData ? parseCampaignName(editData.name) : null;
  const [surveyType, setSurveyType] = useState<"FLORA" | "FAUNA">(
    editData ? (editData.surveyType as "FLORA" | "FAUNA") : "FLORA"
  );
  const [methodology, setMethodology] = useState(editData?.methodology ?? "");
  const [season, setSeason] = useState<typeof SEASONS[number]>(parsed?.season ?? "Verano");
  const [suffix, setSuffix] = useState(parsed?.suffix ?? "");
  const [startDate, setStartDate] = useState(editData?.startDate ?? format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(editData?.endDate ?? format(new Date(), "yyyy-MM-dd"));
  const [responsible, setResponsible] = useState(editData?.responsible ?? "");
  const [saving, setSaving] = useState(false);

  const methodologiesForType = METHODOLOGIES.filter(
    (m) => m.surveyType === surveyType && m.id !== "RESCATE_RELOC"
  );

  // Reset methodology when survey type changes (only in create mode)
  useEffect(() => { if (!editData) setMethodology(""); }, [surveyType]);

  async function handleSave() {
    if (!methodology || !startDate || !endDate) {
      toast.error("Completa los campos requeridos");
      return;
    }
    setSaving(true);
    const db = getDb();
    if (!db) { toast.error("Error al acceder al almacenamiento local"); setSaving(false); return; }

    const year = new Date(startDate).getFullYear();
    const name = suffix.trim() ? `${season} ${year} — ${suffix.trim()}` : `${season} ${year}`;

    if (editData) {
      await db.pendingCampaigns.update(editData.localId!, {
        name, surveyType, methodology, startDate, endDate,
        responsible: responsible || undefined,
      });
      toast.success("Campaña actualizada");
      onUpdated?.({
        localKey: editData.localKey, name, surveyType, methodology,
        shermanTrapCount: editData.shermanTrapCount,
        cameraTrapCount: editData.cameraTrapCount,
      });
    } else {
      const localKey = generateLocalKey();
      await db.pendingCampaigns.add({
        localKey, projectId, name, surveyType, methodology, startDate, endDate,
        responsible: responsible || undefined,
        createdAt: Date.now(), status: "pending",
      });
      toast.success("Campaña guardada localmente");
      onCreated({ localKey, name, surveyType, methodology });
    }
    setSaving(false);
  }

  return (
    <div className="border border-teal-200 rounded-xl bg-teal-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-teal-800">{editData ? "Editar campaña" : "Nueva campaña offline"}</p>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
      </div>

      {/* Survey type */}
      <div className="flex gap-2">
        {(["FLORA", "FAUNA"] as const).map((t) => (
          <button key={t} onClick={() => setSurveyType(t)}
            className={cn("flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
              surveyType === t ? "bg-teal-700 text-white border-teal-700" : "bg-white text-gray-600 border-gray-200"
            )}>
            {t === "FLORA" ? "🌿 Flora" : "🦎 Fauna"}
          </button>
        ))}
      </div>

      {/* Methodology */}
      <div className="space-y-1">
        <Label className="text-xs">Metodología *</Label>
        <Select value={methodology} onValueChange={(v) => v && setMethodology(v)}>
          <SelectTrigger className="bg-white">
            <SelectValue placeholder="Seleccionar…" />
          </SelectTrigger>
          <SelectContent>
            {methodologiesForType.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Season + suffix */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Temporada *</Label>
          <Select value={season} onValueChange={(v) => setSeason(v as typeof SEASONS[number])}>
            <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SEASONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nombre adicional</Label>
          <Input value={suffix} onChange={(e) => setSuffix(e.target.value)} placeholder="ej: Norte" className="bg-white" />
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Inicio *</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-white" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Término *</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-white" />
        </div>
      </div>

      {/* Responsible */}
      <div className="space-y-1">
        <Label className="text-xs">Responsable</Label>
        <Select value={responsible} onValueChange={(v) => v && setResponsible(v)}>
          <SelectTrigger className="bg-white"><SelectValue placeholder="Opcional…" /></SelectTrigger>
          <SelectContent>
            {RESPONSIBLE_PERSONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full bg-teal-700 hover:bg-teal-800 text-white">
        {saving ? "Guardando…" : editData ? "Actualizar campaña" : "Guardar campaña"}
      </Button>
    </div>
  );
}

// ── Station creation/edit form ──
function NewStationForm({
  campaignId,
  campaignLocalKey,
  methodology,
  realStations,
  pendingStations,
  onCreated,
  onUpdated,
  onCancel,
  editData,
}: {
  campaignId?: string;
  campaignLocalKey?: string;
  methodology: string;
  realStations: CachedStation[];
  pendingStations: PendingStation[];
  onCreated: (s: SelectedStationMeta) => void;
  onUpdated?: (s: SelectedStationMeta) => void;
  onCancel: () => void;
  editData?: PendingStation;
}) {
  const suggestedName = editData ? editData.name : suggestNextStationName(realStations, pendingStations, methodology);
  const [name, setName] = useState(suggestedName);
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) { toast.error("Ingresa un nombre para la réplica"); return; }
    setSaving(true);
    const db = getDb();
    if (!db) { toast.error("Error al acceder al almacenamiento local"); setSaving(false); return; }

    if (editData) {
      await db.pendingStations.update(editData.localId!, { name: name.trim() });
      toast.success("Réplica actualizada");
      onUpdated?.({ localKey: editData.localKey, name: name.trim() });
      setSaving(false);
      return;
    }

    const type = getStationType(methodology);
    const createdLocalKeys: string[] = [];

    for (let i = 0; i < quantity; i++) {
      const stationName = quantity === 1 ? name.trim() : (() => {
        const prefix = getStationPrefix(methodology);
        const regex = new RegExp(`^${prefix}(\\d+)$`);
        const match = name.trim().match(regex);
        if (match) return `${prefix}${parseInt(match[1]) + i}`;
        return i === 0 ? name.trim() : `${name.trim()}-${i + 1}`;
      })();
      const localKey = generateLocalKey();
      await db.pendingStations.add({
        localKey,
        campaignId: campaignId || undefined,
        campaignLocalKey: campaignLocalKey || undefined,
        name: stationName,
        type,
        createdAt: Date.now(),
        status: "pending",
      });
      createdLocalKeys.push(localKey);
    }

    toast.success(`${quantity} réplica${quantity > 1 ? "s" : ""} guardada${quantity > 1 ? "s" : ""} localmente`);
    const firstKey = createdLocalKeys[0];
    onCreated({ localKey: firstKey, name: name.trim() });
    setSaving(false);
  }

  return (
    <div className="border border-teal-200 rounded-xl bg-teal-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-teal-800">{editData ? "Editar réplica" : "Nueva réplica offline"}</p>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
      </div>

      <div className={cn("grid gap-2", editData ? "grid-cols-1" : "grid-cols-2")}>
        <div className="space-y-1">
          <Label className="text-xs">Nombre *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white font-mono" />
        </div>
        {!editData && (
          <div className="space-y-1">
            <Label className="text-xs">Cantidad</Label>
            <Input type="number" min={1} max={20} value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
              className="bg-white" />
          </div>
        )}
      </div>

      {!editData && (
        <p className="text-xs text-teal-700">
          Tipo auto: <strong>{getStationType(methodology)}</strong> — prefijo <strong>{getStationPrefix(methodology)}</strong>
        </p>
      )}

      <Button onClick={handleSave} disabled={saving} className="w-full bg-teal-700 hover:bg-teal-800 text-white">
        {saving ? "Guardando…" : editData ? "Actualizar réplica" : `Guardar réplica${quantity > 1 ? "s" : ""}`}
      </Button>
    </div>
  );
}

// ── Main page ──
export default function OfflineRegistroPage() {
  const [isOnline, setIsOnline] = useState(true);
  const [step, setStep] = useState<Step>("project");

  // Project
  const [projects, setProjects] = useState<CachedProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<CachedProject | null>(null);

  // Campaign
  const [realCampaigns, setRealCampaigns] = useState<CachedCampaign[]>([]);
  const [pendingCampaigns, setPendingCampaigns] = useState<PendingCampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<SelectedCampaignMeta | null>(null);
  const [showNewCampaignForm, setShowNewCampaignForm] = useState(false);

  // Station
  const [realStations, setRealStations] = useState<CachedStation[]>([]);
  const [pendingStations, setPendingStations] = useState<PendingStation[]>([]);
  const [selectedStation, setSelectedStation] = useState<SelectedStationMeta | null>(null);
  const [showNewStationForm, setShowNewStationForm] = useState(false);

  // Edit mode for pending items
  const [editingCampaign, setEditingCampaign] = useState<PendingCampaign | null>(null);
  const [editingStation, setEditingStation] = useState<PendingStation | null>(null);

  // Session occurrences — in-memory list of occurrences registered in this station visit
  const [sessionOccurrences, setSessionOccurrences] = useState<SessionOccurrence[]>([]);
  const [editingOccurrence, setEditingOccurrence] = useState<SessionOccurrence | null>(null);
  const formTopRef = useRef<HTMLDivElement>(null);

  // Set of speciesIds already registered this session — used for Flora dedup check
  const sessionSpeciesIds = useMemo(() =>
    new Set(
      sessionOccurrences
        .filter(o => o.payload.kind === "single")
        .map(o => (o.payload.data as SingleOccurrenceData).speciesId)
    ),
    [sessionOccurrences]
  );

  // Online status
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // Load projects
  useEffect(() => {
    const db = getDb();
    if (!db) return;
    db.projects.filter((p) => p.status !== "COMPLETED").toArray().then(setProjects);
  }, []);

  // Load campaigns when project selected
  const loadCampaigns = useCallback(async (projectId: string) => {
    const db = getDb();
    if (!db) return;
    const [real, pending] = await Promise.all([
      db.campaigns.where("projectId").equals(projectId).filter((c) => c.status !== "COMPLETED").toArray(),
      db.pendingCampaigns.where("projectId").equals(projectId).toArray(),
    ]);
    setRealCampaigns(real);
    setPendingCampaigns(pending);
  }, []);

  useEffect(() => {
    if (!selectedProject) { setRealCampaigns([]); setPendingCampaigns([]); return; }
    loadCampaigns(selectedProject.id);
  }, [selectedProject, loadCampaigns]);

  // Load stations when campaign selected
  const loadStations = useCallback(async (meta: SelectedCampaignMeta) => {
    const db = getDb();
    if (!db) return;
    if (meta.id) {
      const [real, pending] = await Promise.all([
        db.stations.where("campaignId").equals(meta.id).filter((s) => !s.parentId).toArray(),
        db.pendingStations.where("campaignId").equals(meta.id).toArray(),
      ]);
      setRealStations(real);
      setPendingStations(pending);
    } else if (meta.localKey) {
      const pending = await db.pendingStations.where("campaignLocalKey").equals(meta.localKey).toArray();
      setRealStations([]);
      setPendingStations(pending);
    }
  }, []);

  useEffect(() => {
    if (!selectedCampaign) { setRealStations([]); setPendingStations([]); return; }
    loadStations(selectedCampaign);
  }, [selectedCampaign, loadStations]);

  // Clear session occurrences when station changes
  useEffect(() => {
    if (!selectedStation) { setSessionOccurrences([]); setEditingOccurrence(null); }
  }, [selectedStation]);

  function goTo(s: Step) {
    if (s === "project") { setSelectedProject(null); setSelectedCampaign(null); setSelectedStation(null); }
    if (s === "campaign") { setSelectedCampaign(null); setSelectedStation(null); }
    if (s === "station") { setSelectedStation(null); }
    setStep(s);
    setShowNewCampaignForm(false);
    setShowNewStationForm(false);
    setEditingCampaign(null);
    setEditingStation(null);
    setEditingOccurrence(null);
    setSessionOccurrences([]);
  }

  // ── Render ──
  return (
    <div className="max-w-xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        {/* Regular <a> so it works offline (Next.js Link requires RSC fetch) */}
        <a href="/ocurrencias" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </a>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Registro en terreno</h1>
          <p className="text-sm text-gray-500">Funciona sin internet</p>
        </div>
      </div>

      <OfflineBadge isOnline={isOnline} />

      {/* Step bar */}
      <StepBar step={step} onGoTo={goTo} />

      {/* ── Project step ── */}
      {step === "project" && (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <p className="text-sm font-medium text-gray-700">Selecciona el proyecto</p>
            {projects.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <WifiOff className="h-8 w-8 text-gray-300 mx-auto" />
                <p className="text-sm text-gray-500">No hay datos en caché.</p>
                <p className="text-xs text-gray-400">Abre la app con internet al menos una vez para habilitar el modo offline.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map((p) => (
                  <button key={p.id} onClick={() => { setSelectedProject(p); setStep("campaign"); }}
                    className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition-colors">
                    <p className="font-medium text-sm text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.region} — {p.commune}</p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Campaign step ── */}
      {step === "campaign" && selectedProject && (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">{selectedProject.name}</p>
                <p className="text-sm font-medium text-gray-700">Selecciona o crea una campaña</p>
              </div>
              {!showNewCampaignForm && (
                <Button size="sm" variant="outline" onClick={() => setShowNewCampaignForm(true)}
                  className="text-teal-700 border-teal-300 hover:bg-teal-50 shrink-0">
                  <Plus className="h-4 w-4 mr-1" /> Nueva
                </Button>
              )}
            </div>

            {showNewCampaignForm && (
              <NewCampaignForm
                key={editingCampaign?.localKey ?? "new"}
                projectId={selectedProject.id}
                editData={editingCampaign ?? undefined}
                onCreated={(c) => {
                  setSelectedCampaign(c);
                  setShowNewCampaignForm(false);
                  setEditingCampaign(null);
                  setStep("station");
                  loadCampaigns(selectedProject.id);
                }}
                onUpdated={(c) => {
                  if (selectedCampaign?.localKey === editingCampaign?.localKey) setSelectedCampaign(c);
                  setShowNewCampaignForm(false);
                  setEditingCampaign(null);
                  loadCampaigns(selectedProject.id);
                }}
                onCancel={() => { setShowNewCampaignForm(false); setEditingCampaign(null); }}
              />
            )}

            {/* Real campaigns */}
            {realCampaigns.length > 0 && (
              <div className="space-y-2">
                {realCampaigns.map((c) => (
                  <button key={c.id}
                    onClick={() => {
                      setSelectedCampaign({
                        id: c.id, name: c.name, surveyType: c.surveyType,
                        methodology: c.methodology,
                        shermanTrapCount: c.shermanTrapCount,
                        cameraTrapCount: c.cameraTrapCount,
                      });
                      setStep("station");
                    }}
                    className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition-colors">
                    <p className="font-medium text-sm text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.surveyType} — {c.methodology}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Pending campaigns */}
            {pendingCampaigns.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 font-medium">Creadas offline</p>
                {pendingCampaigns.map((c) => (
                  <div key={c.localKey} className="relative">
                    <button
                      onClick={() => {
                        setSelectedCampaign({
                          localKey: c.localKey, name: c.name, surveyType: c.surveyType,
                          methodology: c.methodology,
                          shermanTrapCount: c.shermanTrapCount,
                          cameraTrapCount: c.cameraTrapCount,
                        });
                        setStep("station");
                      }}
                      className="w-full text-left p-3 pr-10 rounded-xl border border-orange-200 bg-orange-50 hover:border-orange-400 transition-colors">
                      <div className="flex items-center justify-between pr-6">
                        <p className="font-medium text-sm text-gray-900">{c.name}</p>
                        <PendingBadge status={c.status} />
                      </div>
                      <p className="text-xs text-gray-400">{c.surveyType} — {c.methodology}</p>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingCampaign(c); setShowNewCampaignForm(true); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-teal-600 p-1.5 rounded"
                      title="Editar campaña">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {realCampaigns.length === 0 && pendingCampaigns.length === 0 && !showNewCampaignForm && (
              <p className="text-sm text-gray-400 text-center py-4">
                No hay campañas para este proyecto. Crea una nueva.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Station step ── */}
      {step === "station" && selectedProject && selectedCampaign && (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">{selectedCampaign.name}</p>
                <p className="text-sm font-medium text-gray-700">Selecciona o crea una réplica</p>
              </div>
              {!showNewStationForm && (
                <Button size="sm" variant="outline" onClick={() => setShowNewStationForm(true)}
                  className="text-teal-700 border-teal-300 hover:bg-teal-50 shrink-0">
                  <Plus className="h-4 w-4 mr-1" /> Nueva
                </Button>
              )}
            </div>

            {showNewStationForm && (
              <NewStationForm
                key={editingStation?.localKey ?? "new"}
                campaignId={selectedCampaign.id}
                campaignLocalKey={selectedCampaign.localKey}
                methodology={selectedCampaign.methodology}
                realStations={realStations}
                pendingStations={pendingStations}
                editData={editingStation ?? undefined}
                onCreated={(s) => {
                  setSelectedStation(s);
                  setShowNewStationForm(false);
                  setEditingStation(null);
                  setStep("occurrence");
                  loadStations(selectedCampaign);
                }}
                onUpdated={(s) => {
                  if (selectedStation?.localKey === editingStation?.localKey) setSelectedStation(s);
                  setShowNewStationForm(false);
                  setEditingStation(null);
                  loadStations(selectedCampaign);
                }}
                onCancel={() => { setShowNewStationForm(false); setEditingStation(null); }}
              />
            )}

            {/* Real stations */}
            {realStations.length > 0 && (
              <div className="space-y-2">
                {realStations.map((s) => (
                  <button key={s.id}
                    onClick={() => { setSelectedStation({ id: s.id, name: s.name }); setStep("occurrence"); }}
                    className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition-colors">
                    <p className="font-medium text-sm text-gray-900 font-mono">{s.name}</p>
                    {(s.latitude || s.longitude) && (
                      <p className="text-xs text-gray-400">GPS: {s.latitude?.toFixed(5)}, {s.longitude?.toFixed(5)}</p>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Pending stations */}
            {pendingStations.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 font-medium">Creadas offline</p>
                {pendingStations.map((s) => (
                  <div key={s.localKey} className="relative">
                    <button
                      onClick={() => { setSelectedStation({ localKey: s.localKey, name: s.name }); setStep("occurrence"); }}
                      className="w-full text-left p-3 pr-10 rounded-xl border border-orange-200 bg-orange-50 hover:border-orange-400 transition-colors">
                      <div className="flex items-center justify-between pr-6">
                        <p className="font-medium text-sm text-gray-900 font-mono">{s.name}</p>
                        <PendingBadge status={s.status} />
                      </div>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingStation(s); setShowNewStationForm(true); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-teal-600 p-1.5 rounded"
                      title="Editar réplica">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {realStations.length === 0 && pendingStations.length === 0 && !showNewStationForm && (
              <p className="text-sm text-gray-400 text-center py-4">
                No hay réplicas para esta campaña. Crea una nueva.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Occurrence step ── */}
      {step === "occurrence" && selectedProject && selectedCampaign && selectedStation && (
        <div className="space-y-3">
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm">
            <p className="text-gray-500 text-xs">Registrando en</p>
            <p className="font-semibold text-gray-800">{selectedStation.name}
              {selectedStation.localKey && (
                <span className="ml-2 text-xs font-normal text-orange-600">(offline)</span>
              )}
            </p>
          </div>

          {/* Edit mode banner */}
          {editingOccurrence && (
            <div ref={formTopRef} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <div>
                <p className="text-xs text-amber-600 font-medium">Editando registro</p>
                <p className="text-sm text-gray-700 italic truncate">{editingOccurrence.speciesLabel}</p>
              </div>
              <button onClick={() => setEditingOccurrence(null)} className="text-gray-400 hover:text-gray-600 ml-3 shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <OccurrenceForm
            key={editingOccurrence?.localId ?? "new"}
            projectId={selectedProject.id}
            campaignId={selectedCampaign.id ?? selectedCampaign.localKey ?? "offline"}
            stationId={selectedStation.id ?? "pending"}
            stationLocalKey={selectedStation.localKey}
            surveyType={selectedCampaign.surveyType as "FLORA" | "FAUNA"}
            methodology={selectedCampaign.methodology}
            shermanTrapCount={selectedCampaign.shermanTrapCount ?? undefined}
            cameraTrapCount={selectedCampaign.cameraTrapCount ?? undefined}
            forceOffline={true}
            defaultValues={editingOccurrence ? sessionOccurrenceToDefaultValues(editingOccurrence) : undefined}
            existingSpeciesIds={!editingOccurrence ? sessionSpeciesIds : undefined}
            onRequestEdit={(speciesId) => {
              const existing = sessionOccurrences.find(
                o => o.payload.kind === "single" && (o.payload.data as SingleOccurrenceData).speciesId === speciesId
              );
              if (existing) {
                setEditingOccurrence(existing);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            onRegistered={async (label, payload, localId) => {
              if (editingOccurrence) {
                // Edit flow: replace old item, delete old Dexie record
                const db = getDb();
                try { await db?.pendingOccurrences.delete(editingOccurrence.localId); } catch {}
                setSessionOccurrences(prev => [
                  { localId, speciesLabel: label, payload },
                  ...prev.filter(o => o.localId !== editingOccurrence.localId),
                ]);
                setEditingOccurrence(null);
              } else {
                // New registration: prepend to list
                setSessionOccurrences(prev => [{ localId, speciesLabel: label, payload }, ...prev]);
              }
            }}
          />

          {/* Session occurrences list — in-memory, immune to sync race conditions */}
          {sessionOccurrences.length > 0 && (
            <div className="space-y-1.5 pb-4">
              <p className="text-xs text-gray-500 font-medium pt-1">
                Registros en esta réplica ({sessionOccurrences.length})
              </p>
              {sessionOccurrences.map((occ) => (
                <div key={occ.localId}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2.5 border",
                    editingOccurrence?.localId === occ.localId
                      ? "bg-amber-50 border-amber-300"
                      : "bg-white border-gray-200"
                  )}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate italic">{occ.speciesLabel}</p>
                    <p className="text-xs text-gray-400">
                      {occ.payload.kind === "single"
                        ? occ.payload.data.date
                        : occ.payload.kind === "grilla"
                          ? `Grilla · ${occ.payload.data.date}`
                          : `Sherman · ${occ.payload.data.captures.length} cap.`}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {occ.payload.kind === "single" && (
                      <button
                        onClick={() => {
                          setEditingOccurrence(editingOccurrence?.localId === occ.localId ? null : occ);
                          setTimeout(() => formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                        }}
                        className={cn(
                          "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                          editingOccurrence?.localId === occ.localId
                            ? "bg-amber-100 text-amber-700 border-amber-300"
                            : "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100"
                        )}>
                        <Pencil className="h-3 w-3" />
                        {editingOccurrence?.localId === occ.localId ? "Editando" : "Editar"}
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        if (!confirm(`¿Eliminar el registro de "${occ.speciesLabel}"?`)) return;
                        const db = getDb();
                        try { await db?.pendingOccurrences.delete(occ.localId); } catch {}
                        if (editingOccurrence?.localId === occ.localId) setEditingOccurrence(null);
                        setSessionOccurrences(prev => prev.filter(o => o.localId !== occ.localId));
                      }}
                      className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg transition-colors"
                      title="Eliminar">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
