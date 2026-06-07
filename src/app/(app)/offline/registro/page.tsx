"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { getDb } from "@/lib/db";
import type { CachedProject, CachedCampaign, CachedStation, PendingCampaign, PendingStation } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WifiOff, Wifi, ArrowLeft, Plus, ChevronRight, CheckCircle2, Clock, AlertCircle, X } from "lucide-react";
import Link from "next/link";
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

// ── Campaign creation form ──
function NewCampaignForm({
  projectId,
  onCreated,
  onCancel,
}: {
  projectId: string;
  onCreated: (c: SelectedCampaignMeta) => void;
  onCancel: () => void;
}) {
  const [surveyType, setSurveyType] = useState<"FLORA" | "FAUNA">("FLORA");
  const [methodology, setMethodology] = useState("");
  const [season, setSeason] = useState<typeof SEASONS[number]>("Verano");
  const [suffix, setSuffix] = useState("");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [responsible, setResponsible] = useState("");
  const [saving, setSaving] = useState(false);

  const methodologiesForType = METHODOLOGIES.filter(
    (m) => m.surveyType === surveyType && m.id !== "RESCATE_RELOC"
  );

  // Reset methodology when survey type changes
  useEffect(() => { setMethodology(""); }, [surveyType]);

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
    const localKey = generateLocalKey();

    await db.pendingCampaigns.add({
      localKey,
      projectId,
      name,
      surveyType,
      methodology,
      startDate,
      endDate,
      responsible: responsible || undefined,
      createdAt: Date.now(),
      status: "pending",
    });

    toast.success("Campaña guardada localmente");
    onCreated({ localKey, name, surveyType, methodology });
    setSaving(false);
  }

  return (
    <div className="border border-teal-200 rounded-xl bg-teal-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-teal-800">Nueva campaña offline</p>
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
        {saving ? "Guardando…" : "Guardar campaña"}
      </Button>
    </div>
  );
}

// ── Station creation form ──
function NewStationForm({
  campaignId,
  campaignLocalKey,
  methodology,
  realStations,
  pendingStations,
  onCreated,
  onCancel,
}: {
  campaignId?: string;
  campaignLocalKey?: string;
  methodology: string;
  realStations: CachedStation[];
  pendingStations: PendingStation[];
  onCreated: (s: SelectedStationMeta) => void;
  onCancel: () => void;
}) {
  const suggestedName = suggestNextStationName(realStations, pendingStations, methodology);
  const [name, setName] = useState(suggestedName);
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) { toast.error("Ingresa un nombre para la réplica"); return; }
    setSaving(true);
    const db = getDb();
    if (!db) { toast.error("Error al acceder al almacenamiento local"); setSaving(false); return; }

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
    // Return the first station for navigation (user can pick others from list)
    const firstKey = createdLocalKeys[0];
    onCreated({ localKey: firstKey, name: name.trim() });
    setSaving(false);
  }

  return (
    <div className="border border-teal-200 rounded-xl bg-teal-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-teal-800">Nueva réplica offline</p>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Nombre *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white font-mono" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Cantidad</Label>
          <Input type="number" min={1} max={20} value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
            className="bg-white" />
        </div>
      </div>

      <p className="text-xs text-teal-700">
        Tipo auto: <strong>{getStationType(methodology)}</strong> — prefijo <strong>{getStationPrefix(methodology)}</strong>
      </p>

      <Button onClick={handleSave} disabled={saving} className="w-full bg-teal-700 hover:bg-teal-800 text-white">
        {saving ? "Guardando…" : `Guardar réplica${quantity > 1 ? "s" : ""}`}
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

  function goTo(s: Step) {
    if (s === "project") { setSelectedProject(null); setSelectedCampaign(null); setSelectedStation(null); }
    if (s === "campaign") { setSelectedCampaign(null); setSelectedStation(null); }
    if (s === "station") { setSelectedStation(null); }
    setStep(s);
    setShowNewCampaignForm(false);
    setShowNewStationForm(false);
  }

  // ── Render ──
  return (
    <div className="max-w-xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/ocurrencias" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
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
                projectId={selectedProject.id}
                onCreated={(c) => {
                  setSelectedCampaign(c);
                  setShowNewCampaignForm(false);
                  setStep("station");
                  loadCampaigns(selectedProject.id);
                }}
                onCancel={() => setShowNewCampaignForm(false)}
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
                  <button key={c.localKey}
                    onClick={() => {
                      setSelectedCampaign({
                        localKey: c.localKey, name: c.name, surveyType: c.surveyType,
                        methodology: c.methodology,
                        shermanTrapCount: c.shermanTrapCount,
                        cameraTrapCount: c.cameraTrapCount,
                      });
                      setStep("station");
                    }}
                    className="w-full text-left p-3 rounded-xl border border-orange-200 bg-orange-50 hover:border-orange-400 transition-colors">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm text-gray-900">{c.name}</p>
                      <PendingBadge status={c.status} />
                    </div>
                    <p className="text-xs text-gray-400">{c.surveyType} — {c.methodology}</p>
                  </button>
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
                campaignId={selectedCampaign.id}
                campaignLocalKey={selectedCampaign.localKey}
                methodology={selectedCampaign.methodology}
                realStations={realStations}
                pendingStations={pendingStations}
                onCreated={(s) => {
                  setSelectedStation(s);
                  setShowNewStationForm(false);
                  setStep("occurrence");
                  loadStations(selectedCampaign);
                }}
                onCancel={() => setShowNewStationForm(false)}
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
                  <button key={s.localKey}
                    onClick={() => { setSelectedStation({ localKey: s.localKey, name: s.name }); setStep("occurrence"); }}
                    className="w-full text-left p-3 rounded-xl border border-orange-200 bg-orange-50 hover:border-orange-400 transition-colors">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm text-gray-900 font-mono">{s.name}</p>
                      <PendingBadge status={s.status} />
                    </div>
                  </button>
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

          <OccurrenceForm
            projectId={selectedProject.id}
            campaignId={selectedCampaign.id ?? selectedCampaign.localKey ?? "offline"}
            stationId={selectedStation.id ?? "pending"}
            stationLocalKey={selectedStation.localKey}
            surveyType={selectedCampaign.surveyType as "FLORA" | "FAUNA"}
            methodology={selectedCampaign.methodology}
            shermanTrapCount={selectedCampaign.shermanTrapCount ?? undefined}
            cameraTrapCount={selectedCampaign.cameraTrapCount ?? undefined}
          />
        </div>
      )}
    </div>
  );
}
