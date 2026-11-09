// Metodologías que se pueden marcar en el formulario del reporte Word. Las marcadas se incluyen en
// "Diseño de Muestreo", cada una con su título, su texto estándar (tal cual) y, al final, una frase
// con los datos de la campaña (N° de puntos, horarios, cebos…), que cambian en cada proyecto.
import type { CampanaReporte, TipoReporte } from "./datos";

export type CampoMetodologia = {
  clave: string; // única entre todas las metodologías
  etiqueta: string;
  ejemplo: string;
  numero?: boolean;
  opcional?: boolean;
};

type Valor = (clave: string) => string;

export type Metodologia = {
  id: string;
  titulo: string;
  parrafos: string[];
  campos: CampoMetodologia[];
  // Si se marcó y no se llenó ningún dato obligatorio, sale este aviso en amarillo en el Word
  pendiente?: string;
  // Frase con los datos de la campaña; "" si no hay datos
  esfuerzo?: (v: Valor) => string;
};

const entero = (s: string) => parseInt(s, 10) || 0;
const plural = (n: number, singular: string, pluralTxt: string) => `${n} ${n === 1 ? singular : pluralTxt}`;
// "50" → "50 m"; "50 m" o "entre 30 y 50 m" se dejan tal cual
const conUnidad = (s: string, unidad: string) => (/^\d+([.,]\d+)?$/.test(s) ? `${s} ${unidad}` : s);
const juntar = (partes: (string | false)[], separador = ", ") => partes.filter(Boolean).join(separador);

// Horario y esfuerzo de una búsqueda activa (reptiles, anfibios)
function busqueda(v: Valor, horario: string, esfuerzo: string): string {
  const partes = juntar([v(horario) && `en horario de ${v(horario)}`, v(esfuerzo) && `con un esfuerzo de ${v(esfuerzo)}`]);
  return partes ? `La búsqueda se realizó ${partes}.` : "";
}

export const METODOLOGIAS_FLORA: Metodologia[] = [
  {
    id: "FOTOINTERPRETACION",
    titulo: "Fotointerpretación de imágenes satelitales",
    parrafos: [
      "Previo al levantamiento de terreno se realiza una fotointerpretación del recubrimiento del suelo mediante imágenes satelitales, identificando unidades homogéneas de acuerdo con atributos como tono, color, textura y estructura. A partir de esta información se delimitan preliminarmente las unidades vegetacionales y se definen los sectores y puntos de muestreo que posteriormente serán verificados en terreno.",
    ],
    campos: [],
  },
  {
    id: "PARCELAS",
    titulo: "Cuadrantes / Parcelas de vegetación",
    parrafos: [
      "Para caracterizar la composición florística y abundancia de especies se establecen parcelas de muestreo distribuidas de manera que representen las distintas unidades vegetacionales previamente identificadas. En cada parcela se registran las especies de flora vascular presentes y su cobertura.",
    ],
    // El número y la superficie ya salen de terreno, en el primer párrafo de "Diseño de Muestreo"
    campos: [{ clave: "parcelasForma", etiqueta: "Forma y tamaño de las parcelas", ejemplo: "cuadradas de 10 × 10 m", opcional: true }],
    esfuerzo: (v) => (v("parcelasForma") ? `Las parcelas utilizadas fueron ${v("parcelasForma")}.` : ""),
  },
  {
    id: "BRAUN_BLANQUET",
    titulo: "Método de Braun-Blanquet",
    parrafos: [
      "En los puntos de muestreo se registra la composición florística y se estima la cobertura-abundancia de cada especie mediante la escala de Braun-Blanquet. Esta metodología permite caracterizar la estructura y dominancia de las especies presentes en cada unidad vegetacional y complementa la información obtenida mediante las parcelas.",
    ],
    campos: [],
  },
  {
    id: "INVENTARIO",
    titulo: "Inventario Florístico",
    parrafos: [
      "El inventario florístico se obtiene a partir del levantamiento desarrollado en las parcelas y puntos de muestreo, complementado con registros realizados durante los recorridos de terreno. Para especies cuya identificación no pueda ser confirmada directamente en terreno, se pueden recolectar fragmentos representativos para su posterior identificación mediante literatura, claves taxonómicas y catálogos especializados.",
    ],
    campos: [],
  },
  {
    // Marcarla también agrega la sección de resultados "Carta de Ocupación de Tierras (COT)"
    id: "COT",
    titulo: "Carta de Ocupación de Tierras – COT",
    parrafos: [
      "Para caracterizar la vegetación se utiliza la metodología de Carta de Ocupación de Tierras (COT), mediante la cual se identifican y describen las distintas unidades y formaciones vegetacionales presentes. La caracterización considera principalmente la formación vegetal, las especies dominantes y el grado de artificialización.",
    ],
    campos: [],
  },
  {
    id: "HIDROFILA",
    titulo: "Flora hidrófila",
    parrafos: [
      "Cuando las características del área de estudio o el alcance del proyecto requieran caracterizar vegetación asociada a ambientes húmedos, se realiza un levantamiento específico de flora hidrófila. Para ello se prospectan sectores asociados a cuerpos de agua, zonas anegadas o suelos con condiciones de humedad, registrando las especies indicadoras presentes y clasificándolas de acuerdo con las referencias aplicables para vegetación de humedales.",
    ],
    campos: [
      { clave: "hidrofilaTransectos", etiqueta: "N° de transectos hacia el cuerpo de agua", ejemplo: "4", numero: true, opcional: true },
    ],
    esfuerzo: (v) => {
      const n = entero(v("hidrofilaTransectos"));
      return n
        ? `El levantamiento se complementó mediante ${plural(n, "transecto orientado", "transectos orientados")} hacia el cuerpo de agua, para identificar cambios en la composición de la vegetación.`
        : "";
    },
  },
];

export const METODOLOGIAS_FAUNA: Metodologia[] = [
  {
    id: "TRANSECTOS",
    titulo: "Transectos de muestreo de fauna",
    parrafos: [
      "La caracterización general de fauna se realiza mediante recorridos pedestres a través de transectos distribuidos en los distintos ambientes presentes en el área de estudio. Durante los recorridos se registran observaciones directas de ejemplares y evidencias indirectas de presencia, aplicando metodologías específicas de acuerdo con cada grupo taxonómico.",
    ],
    // El número y las medidas de los transectos ya salen de terreno, en el primer párrafo
    campos: [{ clave: "transectosEsfuerzo", etiqueta: "Esfuerzo por transecto", ejemplo: "1 hora con 2 observadores", opcional: true }],
    esfuerzo: (v) => (v("transectosEsfuerzo") ? `El esfuerzo aplicado en cada transecto fue de ${v("transectosEsfuerzo")}.` : ""),
  },
  {
    id: "POA",
    titulo: "Aves – Puntos de Observación de Aves (POA)",
    parrafos: [
      "El registro de aves se realiza mediante recorridos de transectos complementados con Puntos de Observación de Aves (POA), ubicados en sectores representativos o de interés. En cada punto se registra durante un período estandarizado la actividad de las aves observadas y escuchadas dentro de un radio de detección definido.",
      "La identificación se realiza mediante observación directa, binoculares y reconocimiento de vocalizaciones. Complementariamente, puede utilizarse playback para estimular la respuesta de especies potencialmente presentes y facilitar su detección.",
    ],
    campos: [
      { clave: "poaN", etiqueta: "N° de POA", ejemplo: "10", numero: true },
      { clave: "poaRadio", etiqueta: "Radio de observación", ejemplo: "50 m" },
      { clave: "poaTiempo", etiqueta: "Tiempo por punto", ejemplo: "10 minutos" },
      { clave: "poaHorario", etiqueta: "Horario", ejemplo: "07:00 a 11:00 h" },
    ],
    pendiente: "N° de POA, radio de observación, tiempo por punto y horario",
    esfuerzo: (v) => {
      const n = entero(v("poaN"));
      const con = juntar(
        [
          v("poaRadio") && `un radio de observación de ${conUnidad(v("poaRadio"), "m")}`,
          v("poaTiempo") && `un tiempo de permanencia de ${conUnidad(v("poaTiempo"), "minutos")} por punto`,
        ],
        " y "
      );
      const resto = juntar([con && `con ${con}`, v("poaHorario") && `en horario de ${v("poaHorario")}`]);
      if (n) return `Se establecieron ${plural(n, "POA", "POA")}${resto ? `, ${resto}` : ""}.`;
      return resto ? `Los POA se aplicaron ${resto}.` : "";
    },
  },
  {
    id: "AVES_NOCTURNAS",
    titulo: "Avifauna nocturna",
    parrafos: [
      "Para detectar aves de hábitos nocturnos o crepusculares se realizan recorridos o transectos de escucha durante horario nocturno. Durante estos recorridos puede utilizarse playback mediante la reproducción de vocalizaciones de especies potencialmente presentes, registrando las respuestas vocales, aproximaciones o sobrevuelos detectados.",
    ],
    campos: [
      { clave: "nocN", etiqueta: "N° de transectos", ejemplo: "3", numero: true },
      { clave: "nocNoches", etiqueta: "N° de noches", ejemplo: "2", numero: true },
      { clave: "nocHorario", etiqueta: "Horario", ejemplo: "20:00 a 23:00 h" },
      { clave: "nocTiempo", etiqueta: "Tiempo de escucha", ejemplo: "10 minutos por punto" },
    ],
    pendiente: "N° de transectos, noches, horario y tiempo de escucha",
    esfuerzo: (v) => {
      const n = entero(v("nocN"));
      const noches = entero(v("nocNoches"));
      const resto = juntar([
        noches > 0 && `durante ${plural(noches, "noche", "noches")}`,
        v("nocHorario") && `en horario de ${v("nocHorario")}`,
        v("nocTiempo") && `con un tiempo de escucha de ${conUnidad(v("nocTiempo"), "minutos")}`,
      ]);
      if (n) return `Se realizaron ${plural(n, "transecto", "transectos")} de escucha nocturna${resto ? `, ${resto}` : ""}.`;
      return resto ? `Los transectos de escucha nocturna se realizaron ${resto}.` : "";
    },
  },
  {
    id: "MAMIFEROS",
    titulo: "Mamíferos – Búsqueda activa y evidencias indirectas",
    parrafos: [
      "La caracterización de mamíferos considera recorridos pedestres mediante búsqueda activa, utilizando metodologías TCS (Time Constrained Search) y VES (Visual Encounter Survey). Durante los recorridos se buscan ejemplares y evidencias indirectas, tales como huellas, fecas, madrigueras, pelos, restos óseos, revolcaderos y otras señales de actividad.",
      "Esta metodología constituye la base del levantamiento de mamíferos y puede complementarse mediante métodos específicos para micromamíferos y mesomamíferos.",
    ],
    campos: [],
  },
  {
    id: "SHERMAN",
    titulo: "Micromamíferos – Trampas Sherman",
    parrafos: [
      "Como método complementario para la detección y captura de micromamíferos se instalan trampas Sherman en sectores que presenten condiciones potenciales de hábitat, tales como cobertura vegetal, madrigueras o corredores naturales.",
      "Las trampas permanecen activas durante horario nocturno y son revisadas durante las primeras horas de la mañana para reducir el tiempo de permanencia de los ejemplares capturados y evitar situaciones de estrés térmico. Generalmente se utiliza un cebo atrayente en su interior.",
    ],
    campos: [
      { clave: "shermanN", etiqueta: "N° de trampas", ejemplo: "40", numero: true },
      { clave: "shermanNoches", etiqueta: "N° de noches", ejemplo: "3", numero: true },
      { clave: "shermanHorario", etiqueta: "Horario de activación", ejemplo: "19:00 a 08:00 h" },
      { clave: "shermanCebo", etiqueta: "Cebo", ejemplo: "avena con esencia de vainilla" },
      { clave: "shermanAutorizacion", etiqueta: "Autorización de captura", ejemplo: "Resolución SAG N° …", opcional: true },
    ],
    pendiente: "N° de trampas, noches, horario de activación y cebo",
    esfuerzo: (v) => {
      const n = entero(v("shermanN"));
      const noches = entero(v("shermanNoches"));
      const activas = juntar(
        [noches > 0 && `durante ${plural(noches, "noche", "noches")}`, v("shermanHorario") && `en horario de ${v("shermanHorario")}`],
        " "
      );
      let frase = n
        ? `Se instalaron ${plural(n, "trampa Sherman", "trampas Sherman")}${activas ? `, ${n === 1 ? "activa" : "activas"} ${activas}` : ""}`
        : activas ? `Las trampas Sherman permanecieron activas ${activas}` : "";
      if (v("shermanCebo")) frase = frase ? `${frase}, con ${v("shermanCebo")} como cebo` : `Como cebo se utilizó ${v("shermanCebo")}`;
      const autorizacion = v("shermanAutorizacion")
        ? `La captura de ejemplares contó con la autorización sectorial correspondiente (${v("shermanAutorizacion")}).`
        : "";
      return juntar([frase && `${frase}.`, autorizacion], " ");
    },
  },
  {
    id: "CAMARAS",
    titulo: "Mesomamíferos – Cámaras trampa",
    parrafos: [
      "Para complementar la detección de mamíferos de mediano tamaño se instalan cámaras trampa en sectores seleccionados por su potencial uso como corredores de desplazamiento, refugio o alimentación.",
      "Las cámaras permanecen activas de manera continua durante un período determinado y pueden ser complementadas con atrayentes o cebos para aumentar la probabilidad de detección.",
    ],
    campos: [
      { clave: "camarasN", etiqueta: "N° de cámaras", ejemplo: "4", numero: true },
      { clave: "camarasTiempo", etiqueta: "Tiempo de funcionamiento", ejemplo: "5 días" },
      { clave: "camarasCebo", etiqueta: "Cebo o atrayente", ejemplo: "sardina", opcional: true },
    ],
    pendiente: "N° de cámaras y tiempo de funcionamiento",
    esfuerzo: (v) => {
      const n = entero(v("camarasN"));
      const tiempo = v("camarasTiempo");
      let frase = n
        ? `Se instalaron ${plural(n, "cámara trampa", "cámaras trampa")}${tiempo ? `, ${n === 1 ? "que funcionó" : "que funcionaron"} durante ${tiempo}` : ""}`
        : tiempo ? `Las cámaras trampa funcionaron durante ${tiempo}` : "";
      if (v("camarasCebo")) frase = frase ? `${frase}, con ${v("camarasCebo")} como atrayente` : `Como atrayente se utilizó ${v("camarasCebo")}`;
      return frase ? `${frase}.` : "";
    },
  },
  {
    id: "REPTILES",
    titulo: "Reptiles – Búsqueda activa TCS/VES",
    parrafos: [
      "Para la caracterización de reptiles se realiza búsqueda activa mediante recorridos pedestres en los transectos definidos. Se aplican las metodologías TCS y VES, inspeccionando visual y manualmente potenciales refugios y microhábitats, incluyendo sectores bajo piedras, ramas, vegetación, hojarasca, escombros u otras estructuras que puedan ser utilizadas como refugio.",
    ],
    campos: [
      { clave: "reptilesHorario", etiqueta: "Horario", ejemplo: "11:00 a 16:00 h" },
      { clave: "reptilesEsfuerzo", etiqueta: "Esfuerzo de búsqueda", ejemplo: "30 minutos por transecto" },
    ],
    pendiente: "horario y esfuerzo de búsqueda",
    esfuerzo: (v) => busqueda(v, "reptilesHorario", "reptilesEsfuerzo"),
  },
  {
    id: "ANFIBIOS",
    titulo: "Anfibios – Búsqueda activa TCS/VES",
    parrafos: [
      "Durante los recorridos de terreno se realiza búsqueda activa de anfibios mediante TCS y VES, inspeccionando cuerpos de agua, sectores húmedos, vegetación, piedras, troncos, hojarasca y otros microhábitats potencialmente utilizados como refugio o sitio reproductivo.",
    ],
    campos: [
      { clave: "anfibiosHorario", etiqueta: "Horario", ejemplo: "10:00 a 14:00 h" },
      { clave: "anfibiosEsfuerzo", etiqueta: "Esfuerzo de búsqueda", ejemplo: "30 minutos por sector húmedo" },
    ],
    pendiente: "horario y esfuerzo de búsqueda",
    esfuerzo: (v) => busqueda(v, "anfibiosHorario", "anfibiosEsfuerzo"),
  },
  {
    id: "ANFIBIOS_NOCTURNA",
    titulo: "Anfibios – Escucha nocturna / Playback",
    parrafos: [
      "Cuando existen hábitats potenciales para anfibios, la búsqueda diurna puede complementarse mediante transectos o estaciones de escucha nocturna. Para ello se registran vocalizaciones naturales y puede utilizarse playback con vocalizaciones de las especies potencialmente presentes, buscando inducir respuestas acústicas que permitan confirmar su presencia.",
    ],
    campos: [
      { clave: "escuchaN", etiqueta: "N° de transectos o estaciones", ejemplo: "4", numero: true },
      { clave: "escuchaNoches", etiqueta: "N° de noches", ejemplo: "1", numero: true },
      { clave: "escuchaHorario", etiqueta: "Horario", ejemplo: "21:00 a 23:00 h" },
      { clave: "escuchaPlayback", etiqueta: "Duración del playback", ejemplo: "5 minutos por estación" },
    ],
    pendiente: "N° de transectos o estaciones, noches, horario y duración del playback",
    esfuerzo: (v) => {
      const n = entero(v("escuchaN"));
      const noches = entero(v("escuchaNoches"));
      const resto = juntar([
        noches > 0 && `durante ${plural(noches, "noche", "noches")}`,
        v("escuchaHorario") && `en horario de ${v("escuchaHorario")}`,
        v("escuchaPlayback") && `con una duración de playback de ${conUnidad(v("escuchaPlayback"), "minutos")}`,
      ]);
      if (n) return `Se realizaron ${plural(n, "estación o transecto", "estaciones o transectos")} de escucha nocturna${resto ? `, ${resto}` : ""}.`;
      return resto ? `La escucha nocturna se realizó ${resto}.` : "";
    },
  },
];

export const METODOLOGIAS: Record<TipoReporte, Metodologia[]> = {
  FLORA: METODOLOGIAS_FLORA,
  FAUNA: METODOLOGIAS_FAUNA,
};

// Qué viene marcado al abrir el formulario, según lo que se hizo en las campañas.
// Flora hidrófila y la escucha nocturna de anfibios nunca se marcan solas: dependen del área.
export function metodologiasPorDefecto(
  tipo: TipoReporte,
  campanas: CampanaReporte[]
): { metodologias: string[]; datosMetodologia: Record<string, string> } {
  const usadas = new Set(campanas.map((c) => c.methodology));
  const estacionesDe = (metodo: string) =>
    campanas.filter((c) => c.methodology === metodo).reduce((s, c) => s + c.stations.length, 0);
  const texto = (n: number) => (n > 0 ? String(n) : "");

  if (tipo === "FLORA") {
    const conParcelas = usadas.has("BRAUN_BLANQUET") || usadas.has("PARCELAS_FORESTALES");
    return {
      metodologias: [
        "FOTOINTERPRETACION",
        ...(conParcelas ? ["PARCELAS"] : []),
        ...(usadas.has("BRAUN_BLANQUET") ? ["BRAUN_BLANQUET"] : []),
        "INVENTARIO",
      ],
      // Los transectos de grilla son los de delimitación de humedales
      datosMetodologia: { hidrofilaTransectos: texto(estacionesDe("GRILLA")) },
    };
  }

  const sherman = campanas.reduce((s, c) => s + (c.shermanTrapCount ?? 0), 0);
  const camaras = campanas.reduce((s, c) => s + (c.cameraTrapCount ?? 0), 0) || estacionesDe("TRAMPA_CAMARA");
  return {
    metodologias: [
      "TRANSECTOS", "POA", "AVES_NOCTURNAS", "MAMIFEROS",
      ...(sherman ? ["SHERMAN"] : []),
      ...(camaras ? ["CAMARAS"] : []),
      "REPTILES", "ANFIBIOS",
    ],
    datosMetodologia: { poaN: texto(estacionesDe("PUNTO_CONTEO")), shermanN: texto(sherman), camarasN: texto(camaras) },
  };
}

// Lo que va en el Word: las metodologías marcadas (en el orden de la lista) y, al final, "Otras metodologías"
export function metodologiasDelReporte(
  tipo: TipoReporte,
  marcadas: string[],
  datos: Record<string, string>,
  otras: string
): { titulo: string; parrafos: string[] }[] {
  const v: Valor = (clave) => (datos[clave] ?? "").replace(/\s+/g, " ").trim();
  const lista = METODOLOGIAS[tipo]
    .filter((m) => marcadas.includes(m.id))
    .map((m) => {
      const obligatorios = m.campos.filter((c) => !c.opcional);
      const sinDatos = obligatorios.length > 0 && obligatorios.every((c) => !v(c.clave));
      const esfuerzo = m.esfuerzo?.(v) ?? "";
      const cierre = juntar([esfuerzo, sinDatos && m.pendiente ? `[Completar: ${m.pendiente}]` : ""], " ");
      return { titulo: m.titulo, parrafos: cierre ? [...m.parrafos, cierre] : m.parrafos };
    });
  const parrafosOtras = otras.split(/\n+/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (parrafosOtras.length) lista.push({ titulo: "Otras metodologías", parrafos: parrafosOtras });
  return lista;
}
