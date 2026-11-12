// "Diseño de Muestreo": un solo párrafo con el texto que dio la usuaria (2026-11-10), según sea flora o fauna.
// Época, fechas y N° de profesionales van en el párrafo de inicio del Word (2026-11-12), no aquí.
// Lo que la app ya sabe (puntos, parcelas, transectos, trampas) viene escrito en el formulario y se
// puede cambiar; lo demás se completa a mano. Si queda vacío, sale "[Completar: …]" en amarillo.
// Las partes que no siempre aplican tienen casilla y vienen sin marcar.
import type { CampanaReporte, EstacionReporte, TipoReporte } from "./datos";

export type CampoMuestreo = {
  clave: string;
  etiqueta: string;
  ejemplo?: string;
  numero?: boolean; // cuadro sólo para números
  sugerencias?: string[];
};

export type ParteMuestreo = { id: string; titulo: string; campos: CampoMuestreo[] };

type Plantilla = { campos: CampoMuestreo[]; partes: ParteMuestreo[] };

const n = (clave: string, etiqueta: string, ejemplo: string): CampoMuestreo => ({ clave, etiqueta, ejemplo, numero: true });
const t = (clave: string, etiqueta: string, ejemplo: string, sugerencias?: string[]): CampoMuestreo => ({ clave, etiqueta, ejemplo, sugerencias });

export const MUESTREO: Record<TipoReporte, Plantilla> = {
  FLORA: {
    campos: [n("puntos", "N° de puntos de muestreo", "30")],
    partes: [
      {
        id: "PARCELAS",
        titulo: "Parcelas",
        campos: [
          n("parcelas", "N° de parcelas", "30"),
          t("formaParcelas", "Forma", "circular", ["circular", "cuadrada", "rectangular"]),
          t("superficieParcelas", "Superficie de cada parcela (m²)", "500"),
        ],
      },
      { id: "BRAUN_BLANQUET", titulo: "Puntos Braun-Blanquet", campos: [n("puntosBB", "N° de puntos Braun-Blanquet", "12")] },
      // El N° de unidades y la descripción de la COT son campos propios del formulario (también van en la sección COT)
      { id: "COT", titulo: "Carta de Ocupación de Tierras (COT)", campos: [] },
      {
        id: "HIDROFILA",
        titulo: "Flora hidrófila",
        campos: [t("hidrofila", "Transectos o puntos de flora hidrófila", "4 transectos y 64 puntos")],
      },
    ],
  },
  FAUNA: {
    campos: [
      n("transectos", "N° de transectos", "5"),
      t("medidasTransectos", "Largo × ancho de los transectos (m)", "100 × 10"),
      t("horario", "Horario de los recorridos", "08:00 y 13:00 h"),
    ],
    partes: [
      {
        id: "POA",
        titulo: "Puntos de observación de aves (POA)",
        campos: [
          n("poa", "N° de POA", "8"),
          t("radioPoa", "Radio (m)", "50"),
          t("tiempoPoa", "Minutos por punto", "10"),
        ],
      },
      { id: "BUSQUEDA", titulo: "Búsqueda activa de mamíferos, reptiles y anfibios", campos: [] },
      {
        id: "SHERMAN",
        titulo: "Trampas Sherman",
        campos: [n("sherman", "N° de trampas Sherman", "40"), n("nochesSherman", "N° de noches", "3")],
      },
      {
        id: "CAMARAS",
        titulo: "Cámaras trampa",
        campos: [n("camaras", "N° de cámaras trampa", "4"), t("duracionCamaras", "Duración (horas o días)", "72 horas")],
      },
      {
        id: "NOCTURNAS",
        titulo: "Estaciones nocturnas para aves y anfibios",
        campos: [n("estaciones", "N° de estaciones nocturnas", "5"), t("tiempoEstaciones", "Minutos por estación", "20")],
      },
    ],
  },
};

const numero = (x: number) => x.toLocaleString("es-CL", { maximumFractionDigits: 2 });
const limpio = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const pendiente = (que: string) => `[Completar: ${que}]`;

function unir(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

// "5" → "5 noches", "1" → "1 noche", vacío → "[Completar: N° de noches] noches"
function cantidad(valor: string, singular: string, plural: string, que: string): string {
  if (!valor) return `${pendiente(que)} ${plural}`;
  return `${valor} ${valor === "1" ? singular : plural}`;
}

const esUno = (valor: string) => valor === "1";

// Las estaciones repetidas entre campañas de la misma temporada cuentan una vez
function estacionesDe(campanas: CampanaReporte[], metodos: string[]): EstacionReporte[] {
  const vistas = new Map<string, EstacionReporte>();
  for (const c of campanas) {
    if (!metodos.includes(c.methodology)) continue;
    for (const s of c.stations) vistas.set(`${c.methodology}|${s.name}`, s);
  }
  return [...vistas.values()];
}

const siHay = (x: number) => (x > 0 ? String(x) : "");

// Lo que viene escrito en el formulario porque la app ya lo sabe
export function muestreoAutomatico(tipo: TipoReporte, campanas: CampanaReporte[]): Record<string, string> {
  if (tipo === "FLORA") {
    const todas = estacionesDe(campanas, campanas.map((c) => c.methodology));
    const parcelas = estacionesDe(campanas, ["BRAUN_BLANQUET", "PARCELAS_FORESTALES"]);
    const areas = new Set(parcelas.map((s) => s.area).filter((a): a is number => !!a));
    const grillas = estacionesDe(campanas, ["GRILLA"]);
    return {
      puntos: siHay(todas.length),
      parcelas: siHay(parcelas.length),
      superficieParcelas: areas.size === 1 ? numero([...areas][0]) : "",
      hidrofila: grillas.length ? `${grillas.length} ${grillas.length === 1 ? "transecto" : "transectos"}` : "",
    };
  }

  const transectos = estacionesDe(campanas, ["TRANSECTO_LINEAL_FAUNA"]);
  const medidas = new Set(
    transectos.filter((s) => s.length && s.width).map((s) => `${numero(s.length!)} × ${numero(s.width!)}`)
  );
  const sherman = campanas.reduce((s, c) => s + (c.shermanTrapCount ?? 0), 0);
  const camaras =
    campanas.reduce((s, c) => s + (c.cameraTrapCount ?? 0), 0) || estacionesDe(campanas, ["TRAMPA_CAMARA"]).length;
  return {
    transectos: siHay(transectos.length),
    medidasTransectos: unir([...medidas].slice(0, 3)),
    poa: siHay(estacionesDe(campanas, ["PUNTO_CONTEO"]).length),
    sherman: siHay(sherman),
    camaras: siHay(camaras),
  };
}

// Lo escrito en el formulario manda; si no se tocó, vale lo automático
export function valorMuestreo(escrito: Record<string, string>, automatico: Record<string, string>, clave: string): string {
  return escrito[clave] !== undefined ? escrito[clave] : automatico[clave] ?? "";
}

// La figura del área de influencia con el muestreo es la única antes de resultados: siempre la Figura 1
export function parrafoMuestreo(
  tipo: TipoReporte,
  partes: string[],
  valor: (clave: string) => string,
  nUnidadesCot: string
): string {
  const v = (clave: string) => limpio(valor(clave));
  const hay = (id: string) => partes.includes(id);
  const frases: string[] = [];

  if (tipo === "FLORA") {
    const puntos = v("puntos");
    frases.push(
      esUno(puntos)
        ? "A partir de una fotointerpretación previa se definió 1 punto de muestreo en el área de estudio (Figura 1)."
        : `A partir de una fotointerpretación previa se definieron ${cantidad(puntos, "punto", "puntos", "N° de puntos")} de muestreo distribuidos en las distintas unidades vegetacionales del área de estudio (Figura 1).`
    );

    const enTerreno: string[] = [];
    if (hay("PARCELAS")) {
      const forma = v("formaParcelas");
      const deForma = !forma ? pendiente("forma") : /^forma\b/i.test(forma) ? forma : `forma ${forma}`;
      const superficie = v("superficieParcelas").replace(/\s*m²?$/i, "") || pendiente("superficie");
      enTerreno.push(`${cantidad(v("parcelas"), "parcela", "parcelas", "N° de parcelas")} de ${deForma} y ${superficie} m²`);
    }
    if (hay("BRAUN_BLANQUET")) {
      enTerreno.push(cantidad(v("puntosBB"), "punto Braun-Blanquet", "puntos Braun-Blanquet", "N° de puntos Braun-Blanquet"));
    }
    if (enTerreno.length) {
      const verbo = enTerreno.length === 1 && /^1 /.test(enTerreno[0]) ? "implementó" : "implementaron";
      frases.push(`En terreno se ${verbo} ${unir(enTerreno)} para registrar la composición florística y cobertura-abundancia de las especies.`);
    }
    if (hay("COT")) {
      frases.push(
        `La vegetación se caracterizó mediante Carta de Ocupación de Tierras (COT), identificándose ${cantidad(limpio(nUnidadesCot), "unidad o formación vegetacional", "unidades o formaciones vegetacionales", "N° de unidades COT")}.`
      );
    }
    if (hay("HIDROFILA")) {
      frases.push(
        `Cuando correspondió, el levantamiento se complementó con ${v("hidrofila") || pendiente("N° de transectos o puntos")} para la caracterización de flora hidrófila.`
      );
    }
    return frases.join(" ");
  }

  // Texto del ejemplo de la usuaria (2026-11-12): "Para esto se definieron 16 transectos de largo y ancho fijo (200x10; Figura 1‑1)…"
  const transectos = v("transectos");
  const medidas = (v("medidasTransectos").replace(/\s*m$/i, "") || pendiente("largo × ancho")) + " m";
  const horario = v("horario") || pendiente("horario");
  frases.push(
    esUno(transectos)
      ? `Para esto se definió 1 transecto de largo y ancho fijo (${medidas}; Figura 1), en el que se realizó un recorrido pedestre abarcando un muestreo a lo largo de toda el área de estudio, entre ${horario}.`
      : `Para esto se definieron ${cantidad(transectos, "transecto", "transectos", "N° de transectos")} de largo y ancho fijo (${medidas}; Figura 1), distribuidos en los distintos ambientes presentes en el área de estudio. ` +
          `Dentro de todos los transectos se realizó un recorrido pedestre abarcando un muestreo a lo largo de toda el área de estudio, entre ${horario}.`
  );
  if (hay("POA")) {
    const poa = v("poa");
    frases.push(
      `Para aves se ${esUno(poa) ? "estableció" : "establecieron"} ${cantidad(poa, "punto de observación", "puntos de observación", "N° de POA")} de ${v("radioPoa").replace(/\s*m$/i, "") || pendiente("radio")} m y ${v("tiempoPoa").replace(/\s*minutos?$/i, "") || pendiente("tiempo")} minutos por punto.`
    );
  }
  if (hay("BUSQUEDA")) {
    frases.push("Para mamíferos, reptiles y anfibios se efectuaron búsquedas activas y registros directos e indirectos.");
  }
  const complementos: string[] = [];
  if (hay("SHERMAN")) {
    complementos.push(
      `${cantidad(v("sherman"), "trampa Sherman", "trampas Sherman", "N° de trampas")} durante ${cantidad(v("nochesSherman"), "noche", "noches", "N° de noches")}`
    );
  }
  if (hay("CAMARAS")) {
    complementos.push(
      `${cantidad(v("camaras"), "cámara trampa", "cámaras trampa", "N° de cámaras")} durante ${v("duracionCamaras") || pendiente("horas o días")}`
    );
  }
  if (hay("NOCTURNAS")) {
    complementos.push(
      `${cantidad(v("estaciones"), "estación nocturna", "estaciones nocturnas", "N° de estaciones")} para aves y anfibios, con ${v("tiempoEstaciones").replace(/\s*minutos?$/i, "") || pendiente("tiempo")} minutos por estación y uso de playback cuando correspondió`
    );
  }
  if (complementos.length) frases.push(`El muestreo se complementó con ${unir(complementos)}.`);
  return frases.join(" ");
}
