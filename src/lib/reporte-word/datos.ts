// Arma los datos que llenan las plantillas Word de reporte (public/plantillas/*.docx).
// Todo lo que sale de terreno se calcula aquí; lo que la app no guarda viene del formulario.
import { MEDIDAS_FAUNA } from "./medidas";

export type TipoReporte = "FLORA" | "FAUNA";

export type EspecieReporte = {
  id: string;
  family: string;
  genus: string;
  species: string;
  commonName: string | null;
  conservationStatus: string | null;
  clase: string | null;
  orden: string | null;
  habito: string | null;
  origen: string | null;
};

export type OcurrenciaReporte = {
  abundance: number | null;
  groupSize: number | null;
  species: EspecieReporte;
};

export type EstacionReporte = {
  id: string;
  name: string;
  length: number | null;
  width: number | null;
  area: number | null;
  occurrences: OcurrenciaReporte[];
  children: { id: string; name: string; occurrences: OcurrenciaReporte[] }[];
};

export type CampanaReporte = {
  id: string;
  name: string;
  surveyType: string;
  methodology: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  responsible: string | null;
  notes: string | null;
  shermanTrapCount: number | null;
  cameraTrapCount: number | null;
  stations: EstacionReporte[];
};

export type Profesional = { nombre: string; profesion: string; rol: string };

export type FormularioReporte = {
  nombreProyecto: string;
  tipoEstudio: string;
  mesAnio: string;
  epoca: string;
  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string;
  descripcionArea: string;
  superficieHa: string;
  mostrarEquipo: boolean;
  profesionales: Profesional[];
  observaciones: string;
  // Fauna
  antecedentesHabitat: string;
  nPoa: string;
  detallePoa: string;
  nNocturno: string;
  detalleNocturno: string;
  nSherman: string;
  nochesSherman: string;
  nCamaras: string;
  duracionCamaras: string;
  evidencias: string;
  otrasMetodologias: string;
  medidas: string[]; // ids de MEDIDAS_FAUNA marcadas
  // Flora
  unidadesDominantes: string;
  antecedenteSitio: string;
  descripcionMetodologia: string;
  normaEC: string;
  incluirCot: boolean;
  nUnidadesCot: string;
  descripcionCot: string;
  incluirConclusiones: boolean;
};

// "Especie en categoría de conservación" = amenazada, igual que la hoja Conservación del Excel
const CATEGORIAS_AMENAZADAS = ["CR", "EN", "VU"];

export const EPOCAS: Record<string, string> = {
  Verano: "estival",
  Otoño: "otoñal",
  Invierno: "invernal",
  Primavera: "primaveral",
};

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// "Primavera 2025 — Sector Norte" → "Primavera 2025". Las campañas de la misma temporada
// se juntan en un solo reporte.
export function temporadaDe(nombreCampana: string): string {
  const m = nombreCampana.match(/^(Verano|Otoño|Invierno|Primavera)\s+(\d{4})/);
  return m ? `${m[1]} ${m[2]}` : nombreCampana;
}

export function estacionDelAnio(nombreCampana: string): string | null {
  const m = nombreCampana.match(/^(Verano|Otoño|Invierno|Primavera)\b/);
  return m ? m[1] : null;
}

export function mesAnioActual(fecha = new Date()): string {
  const mes = MESES[fecha.getMonth()];
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${fecha.getFullYear()}`;
}

const completar = (valor: string, que: string) => valor.trim() || `[Completar: ${que}]`;

const plural = (n: number, singular: string, pluralTxt: string) => `${n} ${n === 1 ? singular : pluralTxt}`;

function unirLista(items: string[], conector = "y", separador = ", "): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(separador)} ${conector} ${items[items.length - 1]}`;
}

const numero = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 2 });

const nombreCientifico = (sp: EspecieReporte) => `${sp.genus} ${sp.species}`.trim();

const normalizarOrigen = (origen: string | null) =>
  !origen ? "—" : origen === "Endemico" ? "Endémico" : origen;

// ── Estado de conservación según la región del proyecto ──
// El listado trae categorías por zona, p. ej. "VU (XV-VI), LC (VII-XII)" o "EN (JF), LC (Chile continental)".

// Orden norte → sur, para leer rangos como "XV-VI" o "XVI-VIII-XII"
const REGIONES = ["XV", "I", "II", "III", "IV", "V", "RM", "VI", "VII", "XVI", "VIII", "IX", "XIV", "X", "XI", "XII"];
const ISLAS = /^(JF|IP|DV|juan fern[aá]ndez|isla de pascua|rapa nui|desventuradas)$/i;

// Separa en entradas sin cortar dentro de paréntesis: "VU (XV-II, V-RM-XII), EN (III-IV)" → 2 entradas
function entradasEstado(raw: string): string[] {
  const entradas: string[] = [];
  let nivel = 0;
  let actual = "";
  for (const ch of raw.replace(/\s+/g, " ")) {
    if (ch === "(" || ch === "[") nivel++;
    if (ch === ")" || ch === "]") nivel = Math.max(0, nivel - 1);
    if ((ch === "," || ch === ";") && nivel === 0) {
      if (actual.trim()) entradas.push(actual.trim());
      actual = "";
    } else {
      actual += ch;
    }
  }
  if (actual.trim()) entradas.push(actual.trim());
  return entradas;
}

// Si la entrada no indica zona (o la zona no es una región ni una isla), se asume que aplica.
function aplicaEnRegion(entrada: string, region: string): boolean {
  const zonas = Array.from(entrada.matchAll(/[([]([^)\]]*)[)\]]/g), (m) => m[1].trim());
  const rangos: number[][] = [];
  let islas = false;
  let continental = false;
  for (const zona of zonas) {
    const tramos = zona.split(/[,;]/).map((t) => t.trim().toUpperCase().split(/\s*-\s*|\s+/).filter(Boolean));
    if (tramos.every((t) => t.length > 0 && t.every((r) => REGIONES.includes(r)))) {
      rangos.push(...tramos.map((t) => t.map((r) => REGIONES.indexOf(r))));
    } else if (/continental/i.test(zona) && !/ant[aá]rtic/i.test(zona)) {
      continental = true;
    } else if (ISLAS.test(zona)) {
      islas = true;
    }
  }
  const i = REGIONES.indexOf(region.toUpperCase());
  if (rangos.length > 0 && i >= 0) return rangos.some((r) => i >= Math.min(...r) && i <= Math.max(...r));
  return !(islas && !continental);
}

export function estadoEnRegion(raw: string | null, region: string): { codigos: string[]; texto: string } {
  if (!raw?.trim()) return { codigos: [], texto: "—" };
  const aplican = entradasEstado(raw).filter((e) => aplicaEnRegion(e, region));
  const codigos = new Set<string>();
  for (const e of aplican) {
    const m = e.toUpperCase().match(/\b(EX|EW|CR|EN|VU|NT|LC|DD)\b/);
    if (m) codigos.add(m[1]);
  }
  return { codigos: Array.from(codigos), texto: aplican.join(", ") || "—" };
}

function fechasTexto(inicio: string, fin: string) {
  if (!inicio || !fin) {
    return { fechaInicio: completar("", "fecha de inicio"), fechaFin: completar("", "fecha de término"), anio: "" };
  }
  const [y1, m1, d1] = inicio.split("-").map(Number);
  const [y2, m2, d2] = fin.split("-").map(Number);
  let fechaInicio = String(d1);
  if (y1 !== y2) fechaInicio = `${d1} de ${MESES[m1 - 1]} de ${y1}`;
  else if (m1 !== m2) fechaInicio = `${d1} de ${MESES[m1 - 1]}`;
  return { fechaInicio, fechaFin: `${d2} de ${MESES[m2 - 1]}`, anio: String(y2) };
}

// ── Consolidado de especies de todas las campañas elegidas ──

type FilaEspecie = { sp: EspecieReporte; abundancia: number; estaciones: Set<string> };

function consolidar(campanas: CampanaReporte[]): FilaEspecie[] {
  const mapa = new Map<string, FilaEspecie>();
  for (const c of campanas) {
    for (const st of c.stations) {
      const ocurrencias = [...st.occurrences, ...st.children.flatMap((g) => g.occurrences)];
      for (const o of ocurrencias) {
        const fila = mapa.get(o.species.id) ?? { sp: o.species, abundancia: 0, estaciones: new Set<string>() };
        fila.abundancia += o.abundance ?? o.groupSize ?? 1;
        fila.estaciones.add(st.name);
        mapa.set(o.species.id, fila);
      }
    }
  }
  const cmp = (a: string | null, b: string | null) => (a ?? "").localeCompare(b ?? "", "es");
  return Array.from(mapa.values()).sort((a, b) =>
    cmp(a.sp.clase, b.sp.clase) || cmp(a.sp.orden, b.sp.orden) || cmp(a.sp.family, b.sp.family) ||
    nombreCientifico(a.sp).localeCompare(nombreCientifico(b.sp), "es")
  );
}

export function especiesPorClasificar(campanas: CampanaReporte[]): EspecieReporte[] {
  return consolidar(campanas).map((f) => f.sp).filter((sp) => sp.family === "Por clasificar");
}

const esEC = (sp: EspecieReporte, region: string) =>
  estadoEnRegion(sp.conservationStatus, region).codigos.some((c) => CATEGORIAS_AMENAZADAS.includes(c));

export function resumenCampanas(campanas: CampanaReporte[], region: string) {
  const filas = consolidar(campanas);
  return {
    especies: filas.length,
    individuos: filas.reduce((s, f) => s + f.abundancia, 0),
    estaciones: campanas.reduce((s, c) => s + c.stations.length, 0),
    enCategoria: filas.filter((f) => esEC(f.sp, region)).length,
  };
}

function listaEC(filas: FilaEspecie[], region: string): string {
  return unirLista(
    filas.map(({ sp }) => {
      // Sólo el primer nombre común: "Olivillo, teque, tique…" → "Olivillo"
      const comun = sp.commonName ? ` (${sp.commonName.split(",")[0].trim()})` : "";
      return `${nombreCientifico(sp)}${comun}, en categoría ${estadoEnRegion(sp.conservationStatus, region).texto}`;
    }),
    "y",
    "; "
  );
}

// ── Valores por defecto que se precargan en el formulario ──

export function profesionalesDe(campanas: CampanaReporte[]): string[] {
  const nombres = campanas.flatMap((c) => (c.responsible ?? "").split(",").map((n) => n.trim()).filter(Boolean));
  return Array.from(new Set(nombres));
}

const METODOLOGIA_TEXTO: Record<string, string> = {
  BRAUN_BLANQUET:
    "En cada parcela se registró la composición florística y la cobertura de cada especie según la escala de abundancia-dominancia de Braun-Blanquet.",
  PARCELAS_FORESTALES:
    "En cada parcela forestal se midió, para cada individuo, el diámetro a la altura del tocón (DAT), el diámetro a la altura del pecho (DAP) y la altura total.",
  GRILLA:
    "En cada transecto se dispusieron grillas de 16 puntos de intersección, registrando la especie presente en cada punto, para estimar la proporción de especies hidrófitas en la delimitación de humedales.",
  MICRORUTEO:
    "Adicionalmente, se realizaron recorridos de microruteo, registrando la ubicación georreferenciada de los individuos de las especies de interés.",
};

export function metodologiaPorDefecto(campanas: CampanaReporte[]): string {
  const ids = Array.from(new Set(campanas.map((c) => c.methodology)));
  return ids.map((id) => METODOLOGIA_TEXTO[id]).filter(Boolean).join(" ");
}

export function formularioInicial(): FormularioReporte {
  return {
    nombreProyecto: "",
    tipoEstudio: "",
    mesAnio: mesAnioActual(),
    epoca: "",
    fechaInicio: "",
    fechaFin: "",
    descripcionArea: "",
    superficieHa: "",
    mostrarEquipo: true,
    profesionales: [],
    observaciones: "",
    antecedentesHabitat: "",
    nPoa: "",
    detallePoa: "",
    nNocturno: "",
    detalleNocturno: "",
    nSherman: "",
    nochesSherman: "",
    nCamaras: "",
    duracionCamaras: "",
    evidencias: "",
    otrasMetodologias: "",
    medidas: [],
    unidadesDominantes: "",
    antecedenteSitio: "",
    descripcionMetodologia: "",
    normaEC: "",
    incluirCot: false,
    nUnidadesCot: "",
    descripcionCot: "",
    incluirConclusiones: true,
  };
}

// Lo que se puede sacar de las campañas: fechas, época, equipo, comentarios, trampas.
export function valoresDeCampanas(campanas: CampanaReporte[]): Partial<FormularioReporte> {
  const inicios = campanas.map((c) => c.startDate).filter(Boolean).sort();
  const fines = campanas.map((c) => c.endDate).filter(Boolean).sort();
  const estacion = campanas.map((c) => estacionDelAnio(c.name)).find(Boolean);
  const suma = (k: "shermanTrapCount" | "cameraTrapCount") => campanas.reduce((s, c) => s + (c[k] ?? 0), 0);
  return {
    fechaInicio: inicios[0] ?? "",
    fechaFin: fines[fines.length - 1] ?? "",
    epoca: estacion ? EPOCAS[estacion] : "",
    profesionales: profesionalesDe(campanas).map((nombre) => ({ nombre, profesion: "", rol: "" })),
    observaciones: campanas.map((c) => c.notes?.trim()).filter(Boolean).join("\n"),
    nSherman: suma("shermanTrapCount") ? String(suma("shermanTrapCount")) : "",
    nCamaras: suma("cameraTrapCount") ? String(suma("cameraTrapCount")) : "",
    descripcionMetodologia: metodologiaPorDefecto(campanas),
  };
}

// ── Datos comunes a ambos reportes ──

function datosComunes(form: FormularioReporte, filas: FilaEspecie[], profesionales: Profesional[], ec: FilaEspecie[]) {
  return {
    nombreProyecto: form.nombreProyecto.trim(),
    tipoEstudio: completar(form.tipoEstudio, "tipo de estudio"),
    // "en el marco de la Declaración…" / "en el marco del Estudio…"
    delTipoEstudio: `${/^(declaraci|consulta|adenda|evaluaci|l[ií]nea)/i.test(form.tipoEstudio.trim()) ? "de la" : "del"} ${completar(form.tipoEstudio, "tipo de estudio")}`,
    mesAnio: form.mesAnio.trim(),
    epoca: completar(form.epoca, "época"),
    ...fechasTexto(form.fechaInicio, form.fechaFin),
    descripcionArea: completar(form.descripcionArea, "descripción del área de influencia"),
    superficieHa: completar(form.superficieHa, "superficie"),
    mostrarEquipo: form.mostrarEquipo && profesionales.length > 0,
    profesionales: profesionales.map((p) => ({
      nombre: p.nombre.trim(),
      profesion: p.profesion.trim() || "—",
      rol: p.rol.trim() || "—",
    })),
    observaciones: form.observaciones.trim(),
    riquezaTexto: plural(filas.length, "especie", "especies"),
    hayEC: ec.length > 0,
  };
}

const profesionalesConNombre = (form: FormularioReporte) => form.profesionales.filter((p) => p.nombre.trim());

// ── FAUNA ──

const GRUPOS_FAUNA: { clase: string; plural: string; articulo: string }[] = [
  { clase: "Aves", plural: "aves", articulo: "las" },
  { clase: "Mammalia", plural: "mamíferos", articulo: "los" },
  { clase: "Reptilia", plural: "reptiles", articulo: "los" },
  { clase: "Amphibia", plural: "anfibios", articulo: "los" },
];

const OTRAS_CLASES: Record<string, string> = {
  Insecta: "insectos",
  Arachnida: "arácnidos",
  Gastropoda: "gastrópodos",
  Malacostraca: "crustáceos",
  Actinopterygii: "peces",
  Chondrichthyes: "peces cartilaginosos",
};

function fraseGrupos(filas: FilaEspecie[]): string {
  if (filas.length === 0) return "";
  const porClase = new Map<string, number>();
  for (const { sp } of filas) porClase.set(sp.clase ?? "", (porClase.get(sp.clase ?? "") ?? 0) + 1);

  const partes: string[] = [];
  const ausentes: string[] = [];
  for (const g of GRUPOS_FAUNA) {
    const n = porClase.get(g.clase) ?? 0;
    if (n > 0) partes.push(`${n} a ${g.plural}`);
    else ausentes.push(g.plural);
    porClase.delete(g.clase);
  }
  for (const [clase, n] of porClase) {
    partes.push(`${n} a ${clase ? OTRAS_CLASES[clase] ?? `la clase ${clase}` : "especies sin clase asignada"}`);
  }

  let frase = "";
  if (partes.length > 0) {
    const [primera, ...resto] = partes;
    const verbo = primera.startsWith("1 ") ? "correspondió" : "correspondieron";
    frase = `Del total de especies registradas, ${unirLista([primera.replace(" a ", ` ${verbo} a `), ...resto])}.`;
  }
  if (ausentes.length > 0) frase += ` No se registraron ${unirLista(ausentes, "ni")}.`;
  return frase.trim();
}

function sintesisResultadosFauna(filas: FilaEspecie[]): string {
  if (filas.length === 0) return "";
  const frases: string[] = [];
  const porGrupo = GRUPOS_FAUNA.map((g) => ({ g, n: filas.filter((f) => f.sp.clase === g.clase).length }))
    .sort((a, b) => b.n - a.n);
  if (porGrupo[0].n > 0) {
    const { g, n } = porGrupo[0];
    frases.push(`El grupo con mayor riqueza fue el de ${g.articulo} ${g.plural}, con ${plural(n, "especie", "especies")}.`);
  }
  const masAbundante = [...filas].sort((a, b) => b.abundancia - a.abundancia)[0];
  const comun = masAbundante.sp.commonName ? ` (${masAbundante.sp.commonName})` : "";
  frases.push(
    `La especie más abundante fue ${nombreCientifico(masAbundante.sp)}${comun}, con ${plural(masAbundante.abundancia, "individuo", "individuos")}.`
  );
  return frases.join(" ");
}

function dimensionTransectos(campanas: CampanaReporte[]): string {
  const medidas = new Set<string>();
  for (const st of campanas.flatMap((c) => c.stations)) {
    if (st.length && st.width) medidas.add(`${numero(st.length)} × ${numero(st.width)} m`);
  }
  if (medidas.size === 0) return completar("", "largo × ancho de los transectos");
  return unirLista(Array.from(medidas).slice(0, 3));
}

function textoConDetalle(base: string, detalle: string): string {
  const d = detalle.trim();
  if (!base) return d;
  return d ? `${base}; ${d}` : base;
}

function metodologiasFauna(form: FormularioReporte) {
  const n = (v: string) => parseInt(v, 10) || 0;
  const poa = n(form.nPoa);
  const noct = n(form.nNocturno);
  const sherman = n(form.nSherman);
  const camaras = n(form.nCamaras);
  return {
    textoPoa: textoConDetalle(poa ? `${plural(poa, "Punto", "Puntos")} de Observación de Aves (POA)` : "", form.detallePoa),
    textoNocturno: textoConDetalle(
      noct ? `${plural(noct, "Punto o Transecto", "Puntos o Transectos")} de Fauna Nocturna (PFN/TFN)` : "",
      form.detalleNocturno
    ),
    textoSherman: sherman
      ? `${plural(sherman, "Trampa Sherman", "Trampas Sherman")}` +
        (form.nochesSherman.trim()
          ? `, ${sherman === 1 ? "operativa" : "operativas"} durante ${plural(n(form.nochesSherman), "noche", "noches")}.`
          : ".")
      : "",
    textoCamaras: camaras
      ? `${plural(camaras, "Cámara trampa", "Cámaras trampa")}` +
        (form.duracionCamaras.trim()
          ? `, ${camaras === 1 ? "operativa" : "operativas"} durante ${form.duracionCamaras.trim()}.`
          : ".")
      : "",
    textoEvidencias: form.evidencias.trim(),
    textoOtras: form.otrasMetodologias.trim(),
  };
}

function cambio(antes: number, despues: number): string {
  const d = despues - antes;
  if (d > 0) return `Aumenta (+${d})`;
  if (d < 0) return `Disminuye (−${-d})`;
  return "Se mantiene";
}

function cambioFrase(variable: string, antes: number, despues: number, unidad = ""): string {
  const frase =
    despues > antes ? `${variable} aumentó de ${antes} a ${despues} ${unidad}`
    : despues < antes ? `${variable} disminuyó de ${antes} a ${despues} ${unidad}`
    : `${variable} se mantuvo en ${despues} ${unidad}`;
  return frase.trim();
}

// region: la del proyecto ("XV", "RM"…), para elegir la categoría de conservación que corresponde
export function datosFauna(
  form: FormularioReporte,
  region: string,
  campanas: CampanaReporte[],
  contraste?: { nombre: string; campanas: CampanaReporte[] },
  nombreActual = ""
) {
  const filas = consolidar(campanas);
  const profesionales = profesionalesConNombre(form);
  const estado = (sp: EspecieReporte) => estadoEnRegion(sp.conservationStatus, region).texto;
  const ec = filas.filter((f) => esEC(f.sp, region));
  const base = datosComunes(form, filas, profesionales, ec);
  const abundanciaTotal = filas.reduce((s, f) => s + f.abundancia, 0);
  const nTransectos = campanas.reduce((s, c) => s + c.stations.length, 0);

  let comparacion: Record<string, string | number> | false = false;
  if (contraste && contraste.campanas.length > 0) {
    const filasAntes = consolidar(contraste.campanas);
    const r1 = filasAntes.length, r2 = filas.length;
    const a1 = filasAntes.reduce((s, f) => s + f.abundancia, 0), a2 = abundanciaTotal;
    const ec1 = filasAntes.filter((f) => esEC(f.sp, region)).length, ec2 = ec.length;
    comparacion = {
      campAnterior: contraste.nombre,
      campActual: nombreActual,
      r1, r2, a1, a2, ec1, ec2,
      obsRiqueza: cambio(r1, r2),
      obsAbundancia: cambio(a1, a2),
      obsEC: cambio(ec1, ec2),
    };
    comparacion.sintesisContraste =
      `En comparación con la campaña ${contraste.nombre}, ` +
      `${cambioFrase("la riqueza total", r1, r2, "especies")}, ` +
      `${cambioFrase("la abundancia total", a1, a2, "individuos")} y ` +
      `${cambioFrase("el número de especies en categoría de conservación", ec1, ec2)}.`;
  }

  const ecParrafo =
    (ec.length === 1
      ? "Durante la campaña se registró 1 especie clasificada en alguna categoría de conservación vigente. Esta corresponde a "
      : `Durante la campaña se registraron ${ec.length} especies clasificadas en alguna categoría de conservación vigente. Estas corresponden a `) +
    `${listaEC(ec, region)}.`;

  const observaciones = base.observaciones;
  return {
    ...base,
    fraseEquipo:
      profesionales.length === 0
        ? ""
        : profesionales.length === 1
          ? " En dichas actividades participó 1 profesional del Equipo de Medio Biótico de DSS S.A."
          : ` En dichas actividades participaron ${profesionales.length} profesionales del Equipo de Medio Biótico de DSS S.A.`,
    antecedentesHabitat: form.antecedentesHabitat.trim(),
    nTransectos: nTransectos || completar("", "número de transectos"),
    dimensionTransectos: dimensionTransectos(campanas),
    ...metodologiasFauna(form),
    abundanciaTotal: abundanciaTotal || "",
    fraseGrupos: fraseGrupos(filas),
    sintesisResultados: sintesisResultadosFauna(filas),
    especies: filas.map(({ sp, abundancia }) => ({
      clase: sp.clase || "—",
      orden: sp.orden || "—",
      familia: sp.family || "—",
      especie: nombreCientifico(sp),
      nombreComun: sp.commonName || "—",
      origen: normalizarOrigen(sp.origen),
      ec: estado(sp),
      abundancia,
    })),
    ecParrafo,
    especiesEC: ec.map(({ sp, abundancia, estaciones }) => ({
      especie: nombreCientifico(sp),
      nombreComun: sp.commonName || "—",
      origen: normalizarOrigen(sp.origen),
      categoria: estado(sp),
      abundancia,
      ubicacion: Array.from(estaciones).sort((a, b) => a.localeCompare(b, "es", { numeric: true })).join(", "),
    })),
    secObs: 5,
    secComp: observaciones ? 6 : 5,
    comparacion,
    // En el orden de la lista, no en el que se marcaron
    medidas: MEDIDAS_FAUNA.filter((m) => form.medidas.includes(m.id)).map(({ titulo, parrafos }) => ({ titulo, parrafos })),
    hayMedidas: form.medidas.length > 0,
    secReq: 5 + (observaciones ? 1 : 0) + (comparacion ? 1 : 0),
  };
}

// ── FLORA ──

function dimensionesTexto(estaciones: EstacionReporte[]): string {
  const areas = new Set(estaciones.map((s) => s.area).filter((a): a is number => !!a));
  if (areas.size === 1) return ` de ${numero([...areas][0])} m²`;
  const medidas = new Set(
    estaciones.filter((s) => s.length && s.width).map((s) => `${numero(s.length!)} × ${numero(s.width!)} m`)
  );
  if (medidas.size === 1) return ` de ${[...medidas][0]}`;
  return "";
}

function unidadesMuestreo(campanas: CampanaReporte[]): string {
  const porMetodo = new Map<string, EstacionReporte[]>();
  for (const c of campanas) porMetodo.set(c.methodology, [...(porMetodo.get(c.methodology) ?? []), ...c.stations]);

  const partes: string[] = [];
  for (const [metodo, est] of porMetodo) {
    const n = est.length;
    if (n === 0) continue;
    if (metodo === "BRAUN_BLANQUET") {
      partes.push(`${plural(n, "parcela", "parcelas")} de inventario florístico${dimensionesTexto(est)}`);
    } else if (metodo === "PARCELAS_FORESTALES") {
      partes.push(`${plural(n, "parcela forestal", "parcelas forestales")}${dimensionesTexto(est)}`);
    } else if (metodo === "GRILLA") {
      const grillas = est.reduce((s, t) => s + t.children.length, 0);
      partes.push(
        `${plural(n, "transecto", "transectos")} de delimitación de humedales` +
          (grillas ? ` con ${plural(grillas, "grilla", "grillas")} de 16 puntos de intersección` : "")
      );
    } else if (metodo === "MICRORUTEO") {
      partes.push(`${plural(n, "recorrido", "recorridos")} de microruteo`);
    } else {
      partes.push(plural(n, "unidad de muestreo", "unidades de muestreo"));
    }
  }
  return partes.length ? unirLista(partes) : completar("", "unidades de muestreo");
}

function sintesisFamilias(filas: FilaEspecie[]): string {
  const porFamilia = new Map<string, number>();
  for (const { sp } of filas) if (sp.family) porFamilia.set(sp.family, (porFamilia.get(sp.family) ?? 0) + 1);
  const top = Array.from(porFamilia.entries())
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
    .slice(0, 3);
  if (top.length === 0) return "";
  if (top.length === 1) return `La familia con mayor riqueza fue ${top[0][0]}, con ${top[0][1]} especies.`;
  return `Las familias con mayor riqueza fueron ${unirLista(top.map(([f, n]) => `${f} (${n} especies)`))}.`;
}

export function datosFlora(form: FormularioReporte, region: string, campanas: CampanaReporte[]) {
  const filas = consolidar(campanas);
  const ec = filas.filter((f) => esEC(f.sp, region));
  const base = datosComunes(form, filas, profesionalesConNombre(form), ec);
  const nFamilias = new Set(filas.map((f) => f.sp.family).filter(Boolean)).size;
  const norma = form.normaEC.trim();
  const estado = (sp: EspecieReporte) => estadoEnRegion(sp.conservationStatus, region).texto;

  const ecParrafo =
    (ec.length === 1
      ? "Dentro del área de estudio se registró 1 especie clasificada en alguna categoría de conservación vigente. Esta corresponde a "
      : `Dentro del área de estudio se registraron ${ec.length} especies clasificadas en alguna categoría de conservación vigente. Estas corresponden a `) +
    `${listaEC(ec, region)}.`;

  const cot = form.incluirCot;
  const obs = !!base.observaciones;
  return {
    ...base,
    unidadesDominantes: completar(form.unidadesDominantes, "unidades vegetacionales dominantes"),
    antecedenteSitio: form.antecedenteSitio.trim(),
    unidadesMuestreo: unidadesMuestreo(campanas),
    descripcionMetodologia: form.descripcionMetodologia.trim(),
    familiasTexto: nFamilias === 1 ? "1 familia" : `${nFamilias} familias diferentes`,
    sintesisFamilias: sintesisFamilias(filas),
    especies: filas.map(({ sp }) => ({
      clase: sp.clase || "—",
      familia: sp.family || "—",
      especie: nombreCientifico(sp),
      nombreComun: sp.commonName || "—",
      habito: sp.habito || "—",
      origen: normalizarOrigen(sp.origen),
      ec: estado(sp),
    })),
    ecParrafo,
    especiesEC: ec.map(({ sp }) => ({
      especie: nombreCientifico(sp),
      nombreComun: sp.commonName || "—",
      habito: sp.habito || "—",
      origen: normalizarOrigen(sp.origen),
      categoria: norma ? `${estado(sp)} – ${norma}` : estado(sp),
    })),
    incluirCot: cot,
    nUnidadesCot: completar(form.nUnidadesCot, "N° de unidades"),
    descripcionCot: form.descripcionCot.trim(),
    figCotNum: ec.length > 0 ? 4 : 3,
    incluirConclusiones: form.incluirConclusiones,
    sintesisConservacion:
      ec.length === 0
        ? "No se registraron especies en categoría de conservación vigente."
        : ec.length === 1
          ? "Del total, 1 especie se encuentra clasificada en categoría de conservación."
          : `Del total, ${ec.length} especies se encuentran clasificadas en categoría de conservación.`,
    sintesisFormaciones:
      cot && form.nUnidadesCot.trim()
        ? `Se identificaron ${form.nUnidadesCot.trim()} unidades o formaciones vegetacionales en el área de estudio.`
        : "",
    secCot: 4,
    secObs: cot ? 5 : 4,
    secConc: 4 + (cot ? 1 : 0) + (obs ? 1 : 0),
  };
}
