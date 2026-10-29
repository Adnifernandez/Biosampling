"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Bird, FileText, Leaf, Loader2, Plus, X } from "lucide-react";
import { getMethodologyById } from "@/lib/methodologies";
import { getCampanasReporteWord } from "@/app/(app)/reportes/word/actions";
import {
  CATEGORIAS_EC,
  datosFauna,
  datosFlora,
  especiesPorClasificar,
  formularioInicial,
  resumenCampanas,
  temporadaDe,
  valoresDeCampanas,
  type CampanaReporte,
  type FormularioReporte,
  type TipoReporte,
} from "@/lib/reporte-word/datos";
import { generarWord, prepararFigura } from "@/lib/reporte-word/generar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type CampaignOption = { id: string; name: string; surveyType: string; methodology: string; startDate: Date | string };
type ProjectOption = { id: string; name: string; region: string; campaigns: CampaignOption[] };

const TIPOS_ESTUDIO = [
  "Declaración de Impacto Ambiental (DIA)",
  "Estudio de Impacto Ambiental (EIA)",
  "Consulta de Pertinencia",
  "Estudio Medio Biótico",
];

const FIGURAS: Record<TipoReporte, { clave: string; nombre: string }[]> = {
  FAUNA: [
    { clave: "figArea", nombre: "Figura 1 · Área de influencia" },
    { clave: "figMuestreo", nombre: "Figura 2 · Transectos y puntos de muestreo" },
    { clave: "figEC", nombre: "Figura 3 · Especies en categoría de conservación" },
  ],
  FLORA: [
    { clave: "figArea", nombre: "Figura 1 · Área de estudio" },
    { clave: "figMuestreo", nombre: "Figura 2 · Muestreo" },
    { clave: "figEC", nombre: "Figura 3 · Especies en categoría de conservación" },
    { clave: "figCot", nombre: "Figura 4 · Carta de Ocupación de Tierras (COT)" },
  ],
};

// Lo que se recuerda entre reportes del mismo proyecto (en este navegador)
const CAMPOS_PROYECTO = [
  "nombreProyecto", "tipoEstudio", "descripcionArea", "superficieHa", "antecedentesHabitat",
  "unidadesDominantes", "antecedenteSitio", "normaEC", "categoriasEC",
] as const;
const claveProyecto = (projectId: string, tipo: TipoReporte) => `biosampling:reporte-word:${projectId}:${tipo}`;
const CLAVE_PROFESIONES = "biosampling:reporte-word:profesiones";

function leerGuardado<T>(clave: string): T | null {
  try {
    const raw = localStorage.getItem(clave);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function guardar(clave: string, valor: unknown) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {}
}

// Por defecto se marca la temporada de la campaña abierta en Reportes, o la más reciente
function seleccionPorDefecto(campanas: CampaignOption[], campanaId?: string): string[] {
  const base = campanas.find((c) => c.id === campanaId) ?? campanas[0];
  if (!base) return [];
  const temporada = temporadaDe(base.name);
  return campanas.filter((c) => temporadaDe(c.name) === temporada).map((c) => c.id);
}

function Campo({ label, ayuda, children, className }: { label: string; ayuda?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
      {ayuda && <p className="text-xs text-gray-400">{ayuda}</p>}
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export function ReporteWordClient({
  projects,
  initialProjectId,
  initialCampaignId,
}: {
  projects: ProjectOption[];
  initialProjectId: string;
  initialCampaignId: string;
}) {
  const inicial = projects.find((p) => p.id === initialProjectId);
  const campanaInicial = inicial?.campaigns.find((c) => c.id === initialCampaignId);
  const tipoInicial: TipoReporte = campanaInicial?.surveyType === "FAUNA" ? "FAUNA" : "FLORA";

  const [seleccionInicial] = useState(() =>
    seleccionPorDefecto((inicial?.campaigns ?? []).filter((c) => c.surveyType === tipoInicial), initialCampaignId)
  );
  const [projectId, setProjectId] = useState(inicial?.id ?? "");
  const [tipo, setTipo] = useState<TipoReporte>(tipoInicial);
  const [seleccion, setSeleccion] = useState<string[]>(seleccionInicial);
  const [contraste, setContraste] = useState("");
  const [campanas, setCampanas] = useState<CampanaReporte[]>([]);
  const [campanasContraste, setCampanasContraste] = useState<CampanaReporte[]>([]);
  const [cargando, setCargando] = useState(seleccionInicial.length > 0);
  const [listo, setListo] = useState(false);
  const [form, setForm] = useState<FormularioReporte>(formularioInicial);
  const [figuras, setFiguras] = useState<Record<string, File | null>>({});
  const [generando, setGenerando] = useState(false);

  const proyecto = projects.find((p) => p.id === projectId);
  const campanasDelTipo = useMemo(
    () => (proyecto?.campaigns ?? []).filter((c) => c.surveyType === tipo),
    [proyecto, tipo]
  );
  const temporadas = useMemo(() => {
    const grupos = new Map<string, CampaignOption[]>();
    for (const c of campanasDelTipo) grupos.set(temporadaDe(c.name), [...(grupos.get(temporadaDe(c.name)) ?? []), c]);
    return Array.from(grupos.entries());
  }, [campanasDelTipo]);
  const temporadasElegidas = Array.from(
    new Set(campanasDelTipo.filter((c) => seleccion.includes(c.id)).map((c) => temporadaDe(c.name)))
  );
  const opcionesContraste = temporadas.map(([t]) => t).filter((t) => !temporadasElegidas.includes(t));

  const set = <K extends keyof FormularioReporte>(campo: K, valor: FormularioReporte[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  // Carga los datos de terreno cada vez que cambia la selección de campañas
  const claveSeleccion = seleccion.join(",");
  useEffect(() => {
    if (!claveSeleccion) return;
    let cancelado = false;
    getCampanasReporteWord(claveSeleccion.split(","))
      .then((datos) => {
        if (cancelado) return;
        const guardado = leerGuardado<Partial<FormularioReporte>>(claveProyecto(projectId, tipo)) ?? {};
        const profesiones = leerGuardado<Record<string, { profesion: string; rol: string }>>(CLAVE_PROFESIONES) ?? {};
        const deCampanas = valoresDeCampanas(datos);
        const delProyecto = Object.fromEntries(
          CAMPOS_PROYECTO.filter((k) => guardado[k] !== undefined).map((k) => [k, guardado[k]])
        );
        setCampanas(datos);
        setForm((f) => ({
          ...f,
          ...delProyecto,
          ...deCampanas,
          profesionales: (deCampanas.profesionales ?? []).map((p) => ({ ...p, ...profesiones[p.nombre] })),
        }));
        setListo(true);
      })
      .catch(() => {
        if (!cancelado) toast.error("No se pudieron cargar los datos de las campañas");
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => { cancelado = true; };
  }, [claveSeleccion, projectId, tipo]);

  // Campaña anterior para la comparación (sólo fauna)
  useEffect(() => {
    const ids = campanasDelTipo.filter((c) => temporadaDe(c.name) === contraste).map((c) => c.id);
    if (!contraste || ids.length === 0) return;
    let cancelado = false;
    getCampanasReporteWord(ids)
      .then((datos) => { if (!cancelado) setCampanasContraste(datos); })
      .catch(() => { if (!cancelado) toast.error("No se pudo cargar la campaña de comparación"); });
    return () => { cancelado = true; };
  }, [contraste, campanasDelTipo]);

  // Recuerda los datos del proyecto y la profesión de cada persona para el próximo reporte
  useEffect(() => {
    if (!listo || !projectId) return;
    guardar(claveProyecto(projectId, tipo), Object.fromEntries(CAMPOS_PROYECTO.map((k) => [k, form[k]])));
    const profesiones = leerGuardado<Record<string, { profesion: string; rol: string }>>(CLAVE_PROFESIONES) ?? {};
    for (const p of form.profesionales) {
      if (p.nombre.trim() && (p.profesion.trim() || p.rol.trim())) {
        profesiones[p.nombre.trim()] = { profesion: p.profesion, rol: p.rol };
      }
    }
    guardar(CLAVE_PROFESIONES, profesiones);
  }, [form, listo, projectId, tipo]);

  function reiniciar(nuevaSeleccion: string[]) {
    setSeleccion(nuevaSeleccion);
    setCampanas([]);
    setCampanasContraste([]);
    setContraste("");
    setForm(formularioInicial());
    setFiguras({});
    setListo(false);
    setCargando(nuevaSeleccion.length > 0);
  }

  function elegirProyecto(id: string) {
    setProjectId(id);
    const p = projects.find((x) => x.id === id);
    reiniciar(seleccionPorDefecto((p?.campaigns ?? []).filter((c) => c.surveyType === tipo)));
  }

  function elegirTipo(t: TipoReporte) {
    setTipo(t);
    reiniciar(seleccionPorDefecto((proyecto?.campaigns ?? []).filter((c) => c.surveyType === t)));
  }

  function alternarCampana(id: string) {
    const nueva = seleccion.includes(id) ? seleccion.filter((x) => x !== id) : [...seleccion, id];
    setSeleccion(nueva);
    setContraste("");
    setCampanasContraste([]);
    if (nueva.length === 0) setCampanas([]);
    else setCargando(true);
  }

  const porClasificar = especiesPorClasificar(campanas);
  const resumen = resumenCampanas(campanas);
  const temporadaActual = temporadasElegidas.join(" / ");
  const puedeGenerar =
    !!form.nombreProyecto.trim() && campanas.length > 0 && !cargando && porClasificar.length === 0 && !generando;

  async function descargar() {
    if (!puedeGenerar) return;
    setGenerando(true);
    try {
      const figs = await Promise.all(
        Object.entries(figuras)
          .filter((e): e is [string, File] => !!e[1])
          .map(([clave, archivo]) => prepararFigura(clave, archivo))
      );
      const region = proyecto?.region ?? "";
      const datos =
        tipo === "FAUNA"
          ? datosFauna(
              form,
              region,
              campanas,
              contraste && campanasContraste.length ? { nombre: contraste, campanas: campanasContraste } : undefined,
              temporadaActual
            )
          : datosFlora(form, region, campanas);
      const blob = await generarWord(tipo, datos, figs);
      const nombre = `Reporte ${tipo === "FLORA" ? "Flora y Vegetación" : "Fauna"} - ${form.nombreProyecto.trim()} - ${temporadaActual}`
        .replace(/[\\/:*?"<>|]/g, "-");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${nombre}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Reporte Word descargado");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo generar el reporte Word");
    } finally {
      setGenerando(false);
    }
  }

  const esFauna = tipo === "FAUNA";
  const hayDatos = campanas.length > 0 && !cargando;

  return (
    <div className="space-y-4">
      <Seccion titulo="1. ¿Qué reporte?">
        <Campo label="Proyecto">
          <SearchableSelect
            value={projectId}
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
            placeholder="Seleccionar proyecto..."
            onChange={elegirProyecto}
          />
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          {[
            { t: "FLORA" as const, label: "Flora y vegetación", Icon: Leaf, activo: "bg-teal-50 border-teal-600", color: "text-teal-600" },
            { t: "FAUNA" as const, label: "Fauna", Icon: Bird, activo: "bg-blue-50 border-blue-600", color: "text-blue-600" },
          ].map(({ t, label, Icon, activo, color }) => (
            <button
              key={t}
              type="button"
              onClick={() => elegirTipo(t)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all",
                tipo === t ? activo : "border-gray-200 hover:border-gray-300 bg-white"
              )}
            >
              <Icon className={cn("h-5 w-5", color)} /> {label}
            </button>
          ))}
        </div>

        {proyecto && (
          <div className="space-y-2">
            <Label>Campañas a incluir</Label>
            {temporadas.length === 0 && (
              <p className="text-sm text-gray-400">Este proyecto no tiene campañas de {esFauna ? "fauna" : "flora"}.</p>
            )}
            {temporadas.map(([temporada, lista]) => (
              <div key={temporada} className="rounded-lg border border-gray-200 p-3 space-y-1.5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{temporada}</p>
                {lista.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-teal-600"
                      checked={seleccion.includes(c.id)}
                      onChange={() => alternarCampana(c.id)}
                    />
                    {c.name}
                    <span className="text-gray-400">· {getMethodologyById(c.methodology)?.name ?? c.methodology}</span>
                  </label>
                ))}
              </div>
            ))}
            {temporadas.length > 0 && (
              <p className="text-xs text-gray-400">Las campañas marcadas se juntan en un solo reporte.</p>
            )}
          </div>
        )}

        {cargando && (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando datos de terreno…
          </p>
        )}
        {hayDatos && (
          <p className="text-sm text-gray-600">
            <span className="font-semibold">{resumen.especies}</span> especies ·{" "}
            <span className="font-semibold">{resumen.individuos}</span> individuos ·{" "}
            <span className="font-semibold">{resumen.estaciones}</span> estaciones
          </p>
        )}

        {hayDatos && porClasificar.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3">
            <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-orange-800">
                Hay {porClasificar.length} especie{porClasificar.length !== 1 ? "s" : ""} sin datos completos. Complétalas antes de generar el reporte:
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {porClasificar.map((sp) => (
                  <a
                    key={sp.id}
                    href={`/admin/especies?completar=${encodeURIComponent(sp.id)}`}
                    className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full italic underline underline-offset-2 hover:bg-orange-200"
                  >
                    {sp.genus} {sp.species}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {esFauna && opcionesContraste.length > 0 && hayDatos && (
          <Campo label="Comparar con otra campaña (opcional)" ayuda="Agrega la sección «Comparación entre campañas».">
            <Select
              value={contraste || "ninguna"}
              onValueChange={(v) => {
                setCampanasContraste([]);
                setContraste(!v || v === "ninguna" ? "" : v);
              }}
            >
              <SelectTrigger>
                <SelectValue>{contraste || "Sin comparación"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ninguna">Sin comparación</SelectItem>
                {opcionesContraste.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
        )}
      </Seccion>

      {hayDatos && (
        <>
          <Seccion titulo="2. Portada y fechas">
            <Campo label="Nombre del proyecto *" ayuda="Como debe aparecer en la portada (no el código).">
              <Input value={form.nombreProyecto} onChange={(e) => set("nombreProyecto", e.target.value)} placeholder="Ej: Parque Fotovoltaico Los Andes" />
            </Campo>
            <Campo label="Tipo de estudio">
              <Input list="tipos-estudio" value={form.tipoEstudio} onChange={(e) => set("tipoEstudio", e.target.value)} placeholder="Ej: Declaración de Impacto Ambiental (DIA)" />
              <datalist id="tipos-estudio">
                {TIPOS_ESTUDIO.map((t) => <option key={t} value={t} />)}
              </datalist>
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Mes y año de la portada">
                <Input value={form.mesAnio} onChange={(e) => set("mesAnio", e.target.value)} />
              </Campo>
              <Campo label="Época">
                <Input list="epocas" value={form.epoca} onChange={(e) => set("epoca", e.target.value)} placeholder="Ej: primaveral" />
                <datalist id="epocas">
                  {["estival", "otoñal", "invernal", "primaveral"].map((t) => <option key={t} value={t} />)}
                </datalist>
              </Campo>
              <Campo label="Fecha inicio">
                <Input type="date" value={form.fechaInicio} onChange={(e) => set("fechaInicio", e.target.value)} />
              </Campo>
              <Campo label="Fecha término">
                <Input type="date" value={form.fechaFin} onChange={(e) => set("fechaFin", e.target.value)} />
              </Campo>
            </div>
          </Seccion>

          <Seccion titulo="3. Área de influencia">
            <Campo label="¿Cómo se definió el área?" ayuda="Completa la frase «El área de influencia se definió considerando…».">
              <Textarea value={form.descripcionArea} onChange={(e) => set("descripcionArea", e.target.value)} placeholder="Ej: el polígono del proyecto más un buffer de 500 m" />
            </Campo>
            <Campo label="Superficie (ha)">
              <Input value={form.superficieHa} onChange={(e) => set("superficieHa", e.target.value)} placeholder="Ej: 120,5" className="max-w-40" />
            </Campo>
            {esFauna ? (
              <Campo label="Antecedentes del hábitat (opcional)">
                <Textarea value={form.antecedentesHabitat} onChange={(e) => set("antecedentesHabitat", e.target.value)} />
              </Campo>
            ) : (
              <>
                <Campo label="Unidades vegetacionales dominantes" ayuda="Completa la frase «…dominada principalmente por…».">
                  <Input value={form.unidadesDominantes} onChange={(e) => set("unidadesDominantes", e.target.value)} placeholder="Ej: matorral esclerófilo y praderas anuales" />
                </Campo>
                <Campo label="Antecedente específico del sitio (opcional)">
                  <Textarea value={form.antecedenteSitio} onChange={(e) => set("antecedenteSitio", e.target.value)} />
                </Campo>
              </>
            )}
          </Seccion>

          <Seccion titulo="4. Equipo de profesionales">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={form.mostrarEquipo} onChange={(e) => set("mostrarEquipo", e.target.checked)} />
              Incluir la tabla del equipo en el reporte
            </label>
            {form.profesionales.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                {(["nombre", "profesion", "rol"] as const).map((campo) => (
                  <Input
                    key={campo}
                    value={p[campo]}
                    placeholder={campo === "nombre" ? "Nombre" : campo === "profesion" ? "Profesión" : "Rol"}
                    onChange={(e) =>
                      set("profesionales", form.profesionales.map((x, j) => (j === i ? { ...x, [campo]: e.target.value } : x)))
                    }
                  />
                ))}
                <Button
                  type="button" variant="ghost" size="icon" aria-label="Quitar"
                  onClick={() => set("profesionales", form.profesionales.filter((_, j) => j !== i))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button" variant="outline" size="sm" className="gap-1"
              onClick={() => set("profesionales", [...form.profesionales, { nombre: "", profesion: "", rol: "" }])}
            >
              <Plus className="h-4 w-4" /> Agregar persona
            </Button>
          </Seccion>

          <Seccion titulo="5. Diseño de muestreo">
            {esFauna ? (
              <>
                <p className="text-xs text-gray-400">Deja en blanco lo que no se hizo: no aparecerá en el reporte.</p>
                {([
                  ["Puntos de Observación de Aves (POA)", "nPoa", "detallePoa", "Detalle (opcional)"],
                  ["Fauna nocturna (PFN/TFN)", "nNocturno", "detalleNocturno", "Detalle (opcional)"],
                  ["Trampas Sherman", "nSherman", "nochesSherman", "N° de noches"],
                  ["Cámaras trampa", "nCamaras", "duracionCamaras", "Duración (ej: 4 noches)"],
                ] as const).map(([titulo, campoN, campoDetalle, ph]) => (
                  <Campo key={campoN} label={titulo}>
                    <div className="grid grid-cols-[6rem_1fr] gap-2">
                      <Input type="number" min={0} placeholder="N°" value={form[campoN]} onChange={(e) => set(campoN, e.target.value)} />
                      <Input placeholder={ph} value={form[campoDetalle]} onChange={(e) => set(campoDetalle, e.target.value)} />
                    </div>
                  </Campo>
                ))}
                <Campo label="Evidencias indirectas">
                  <Input value={form.evidencias} onChange={(e) => set("evidencias", e.target.value)} placeholder="Ej: búsqueda de fecas, huellas y madrigueras" />
                </Campo>
                <Campo label="Otras metodologías">
                  <Input value={form.otrasMetodologias} onChange={(e) => set("otrasMetodologias", e.target.value)} />
                </Campo>
              </>
            ) : (
              <Campo label="Descripción de la metodología" ayuda="Viene precargada según las metodologías de las campañas; puedes editarla.">
                <Textarea rows={4} value={form.descripcionMetodologia} onChange={(e) => set("descripcionMetodologia", e.target.value)} />
              </Campo>
            )}
          </Seccion>

          <Seccion titulo="6. Especies en categoría de conservación">
            <p className="text-xs text-gray-500">
              Marca qué categorías cuentan como «especie en categoría de conservación». Por defecto sólo las amenazadas (CR, EN, VU), igual que el Excel.
              Si una especie tiene categorías distintas por zona, se usa la de la región del proyecto.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CATEGORIAS_EC.map(({ codigo, nombre }) => (
                <label key={codigo} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-teal-600"
                    checked={form.categoriasEC.includes(codigo)}
                    onChange={(e) =>
                      set("categoriasEC", e.target.checked ? [...form.categoriasEC, codigo] : form.categoriasEC.filter((c) => c !== codigo))
                    }
                  />
                  <span><span className="font-semibold">{codigo}</span> <span className="text-gray-500">{nombre}</span></span>
                </label>
              ))}
            </div>
            {!esFauna && (
              <Campo label="Norma o decreto (opcional)" ayuda="Se agrega junto a la categoría en la tabla. Ej: RCE.">
                <Input value={form.normaEC} onChange={(e) => set("normaEC", e.target.value)} className="max-w-60" />
              </Campo>
            )}
          </Seccion>

          {!esFauna && (
            <Seccion titulo="7. COT y conclusiones">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={form.incluirCot} onChange={(e) => set("incluirCot", e.target.checked)} />
                Incluir Carta de Ocupación de Tierras (COT) / formaciones vegetacionales
              </label>
              {form.incluirCot && (
                <>
                  <Campo label="N° de unidades o formaciones">
                    <Input type="number" min={0} value={form.nUnidadesCot} onChange={(e) => set("nUnidadesCot", e.target.value)} className="max-w-40" />
                  </Campo>
                  <Campo label="Descripción de los resultados">
                    <Textarea value={form.descripcionCot} onChange={(e) => set("descripcionCot", e.target.value)} />
                  </Campo>
                </>
              )}
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={form.incluirConclusiones} onChange={(e) => set("incluirConclusiones", e.target.checked)} />
                Incluir conclusiones
              </label>
            </Seccion>
          )}

          <Seccion titulo={`${esFauna ? 7 : 8}. Observaciones`}>
            <Campo label="Observaciones de terreno" ayuda="Viene con los comentarios de las campañas. Si queda vacío, la sección no aparece.">
              <Textarea rows={4} value={form.observaciones} onChange={(e) => set("observaciones", e.target.value)} />
            </Campo>
          </Seccion>

          <Seccion titulo={`${esFauna ? 8 : 9}. Figuras (opcional)`}>
            <p className="text-xs text-gray-500">
              Sube los mapas como imagen (PNG o JPG). Si no subes una, el Word queda con un aviso para pegarla después.
            </p>
            {FIGURAS[tipo].map(({ clave, nombre }) => (
              <Campo key={clave} label={nombre}>
                <Input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => setFiguras((f) => ({ ...f, [clave]: e.target.files?.[0] ?? null }))}
                />
              </Campo>
            ))}
          </Seccion>

          <div className="flex flex-col items-end gap-1 pb-4">
            <Button onClick={descargar} disabled={!puedeGenerar} className="gap-2">
              {generando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Descargar Word
            </Button>
            {!form.nombreProyecto.trim() && (
              <p className="text-xs text-gray-400">Escribe el nombre del proyecto para descargar.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
