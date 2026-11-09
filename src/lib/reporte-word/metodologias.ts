// Metodologías que se pueden marcar en el formulario del reporte Word. Las marcadas se incluyen en
// "Diseño de Muestreo", cada una con su título, su texto estándar y, al final, una frase con los
// datos de la campaña que se escriben a mano (radio de los POA, horarios, cebos…).
// Lo que la app ya sabe (N° y código de puntos, superficie, medidas, coordenadas, fechas, equipo)
// no se pide: sale solo en el primer párrafo y en la tabla de puntos.
// Todos los datos son opcionales: si no se llenan, va sólo el texto estándar (sin aviso en amarillo).
import type { CampanaReporte, TipoReporte } from "./datos";

export type CampoMetodologia = {
  clave: string; // única entre todas las metodologías
  etiqueta: string;
  ejemplo?: string;
  tipo?: "numero" | "sino"; // por defecto, texto libre. "sino" guarda "si" o ""
  sugerencias?: string[]; // texto con opciones sugeridas (se puede escribir otra)
  inicial?: string; // valor al abrir el formulario (TCS y VES vienen marcados: el texto estándar dice ambos)
  soloSi?: string; // se muestra sólo si está marcado ese Sí/No (p. ej. especies del playback)
};

type Valor = (clave: string) => string;

export type Metodologia = {
  id: string;
  titulo: string;
  // Texto estándar; algunas lo ajustan según lo marcado (p. ej. sólo VES en vez de "TCS y VES")
  parrafos: string[] | ((v: Valor) => string[]);
  campos: CampoMetodologia[];
  // Frase con los datos de la campaña; "" si no hay datos
  esfuerzo?: (v: Valor) => string;
};

const entero = (s: string) => parseInt(s, 10) || 0;
const plural = (n: number, singular: string, pluralTxt: string) => `${n} ${n === 1 ? singular : pluralTxt}`;
const esNumero = (s: string) => /^\d+([.,]\d+)?$/.test(s);
// "50" → "50 m"; "50 m" o "entre 30 y 50 m" se dejan tal cual
const conUnidad = (s: string, unidad: string) => (esNumero(s) ? `${s} ${unidad}` : s);
// "20" → "20 minutos por transecto"; "20 minutos" se deja tal cual
const minutos = (s: string, por: string) => (esNumero(s) ? `${s} minutos ${por}` : s);
const juntar = (partes: (string | false)[], separador = ", ") => partes.filter(Boolean).join(separador);
const unir = (partes: (string | false)[]) => {
  const p = partes.filter(Boolean) as string[];
  return p.length <= 1 ? p.join("") : `${p.slice(0, -1).join(", ")} y ${p[p.length - 1]}`;
};
const marcado = (v: Valor, clave: string) => v(clave) === "si";

// ── Piezas comunes ──

const numero = (clave: string, etiqueta: string, ejemplo: string): CampoMetodologia => ({ clave, etiqueta, ejemplo, tipo: "numero" });
const texto = (clave: string, etiqueta: string, ejemplo: string, sugerencias?: string[]): CampoMetodologia => ({ clave, etiqueta, ejemplo, sugerencias });
const sino = (clave: string, etiqueta: string, inicial?: string): CampoMetodologia => ({ clave, etiqueta, tipo: "sino", inicial });
const siMarcado = (campo: CampoMetodologia, soloSi: string): CampoMetodologia => ({ ...campo, soloSi });

const camposTcsVes = (p: string) => [
  sino(`${p}TCS`, "TCS (Time Constrained Search)", "si"),
  sino(`${p}VES`, "VES (Visual Encounter Survey)", "si"),
];

// TCS / VES según lo marcado
function metodosBusqueda(v: Valor, p: string, largos = false): string[] {
  return [
    marcado(v, `${p}TCS`) && (largos ? "TCS (Time Constrained Search)" : "TCS"),
    marcado(v, `${p}VES`) && (largos ? "VES (Visual Encounter Survey)" : "VES"),
  ].filter(Boolean) as string[];
}

// "La búsqueda se realizó en 5 transectos, durante 2 días, en horario de…, con un esfuerzo de… y un ancho de…"
function esfuerzoBusqueda(v: Valor, p: string): string {
  const n = entero(v(`${p}Transectos`));
  const dias = entero(v(`${p}Dias`));
  const con = juntar(
    [
      v(`${p}Esfuerzo`) && `un esfuerzo de ${v(`${p}Esfuerzo`)}`,
      v(`${p}Ancho`) && `un ancho de búsqueda de ${conUnidad(v(`${p}Ancho`), "m")}`,
    ],
    " y "
  );
  const partes = juntar([
    n > 0 && `en ${plural(n, "transecto", "transectos")}`,
    dias > 0 && `durante ${plural(dias, "día", "días")}`,
    v(`${p}Horario`) && `en horario de ${v(`${p}Horario`)}`,
    con && `con ${con}`,
  ]);
  return partes ? `La búsqueda se realizó ${partes}.` : "";
}

// "Se utilizó playback con vocalizaciones de X, obtenidas de Y."
function frasePlayback(v: Valor, p: string): string {
  if (!marcado(v, `${p}Playback`)) return "";
  const especies = v(`${p}Especies`);
  const fuente = v(`${p}Fuente`);
  return `Se utilizó playback${especies ? ` con vocalizaciones de ${especies}` : ""}${fuente ? `, obtenidas de ${fuente}` : ""}.`;
}

const camposPlayback = (p: string, ejemploEspecies: string, conFuente = false) => [
  sino(`${p}Playback`, "Se utilizó playback"),
  siMarcado(texto(`${p}Especies`, "Especies objetivo del playback", ejemploEspecies), `${p}Playback`),
  ...(conFuente ? [siMarcado(texto(`${p}Fuente`, "Fuente de las vocalizaciones", "grabaciones de referencia"), `${p}Playback`)] : []),
];

// ── FLORA ──

export const METODOLOGIAS_FLORA: Metodologia[] = [
  {
    id: "FOTOINTERPRETACION",
    titulo: "Fotointerpretación de imágenes satelitales",
    parrafos: [
      "Previo al levantamiento de terreno se realiza una fotointerpretación del recubrimiento del suelo mediante imágenes satelitales, identificando unidades homogéneas de acuerdo con atributos como tono, color, textura y estructura. A partir de esta información se delimitan preliminarmente las unidades vegetacionales y se definen los sectores y puntos de muestreo que posteriormente serán verificados en terreno.",
    ],
    campos: [
      texto("fotoFuente", "Origen de las imágenes", "Google Earth", ["Google Earth"]),
      texto("fotoFecha", "Fecha de la imagen", "marzo de 2025"),
    ],
    esfuerzo: (v) => {
      const fuente = v("fotoFuente");
      const fecha = v("fotoFecha");
      if (!fuente && !fecha) return "";
      return `Para la fotointerpretación se utilizaron imágenes satelitales${fuente ? ` de ${fuente}` : ""}${fecha ? `${fuente ? "," : ""} de fecha ${fecha}` : ""}.`;
    },
  },
  {
    id: "PARCELAS",
    titulo: "Cuadrantes / Parcelas de vegetación",
    parrafos: [
      "Para caracterizar la composición florística y abundancia de especies se establecen parcelas de muestreo distribuidas de manera que representen las distintas unidades vegetacionales previamente identificadas. En cada parcela se registran las especies de flora vascular presentes y su cobertura.",
    ],
    // El número, el código, la superficie y las coordenadas salen de terreno
    campos: [
      texto("parcelasForma", "Forma de las parcelas", "circular", ["circular", "cuadrada", "rectangular"]),
      texto("parcelasDimension", "Dimensiones", "radio de 12,6 m"),
      texto("parcelasUnidades", "Unidades vegetacionales muestreadas", "pradera, matorral y plantación"),
      texto("parcelasPorUnidad", "N° de parcelas por unidad", "4 en pradera, 5 en matorral y 3 en plantación"),
    ],
    esfuerzo: (v) => {
      const forma = v("parcelasForma");
      const dim = v("parcelasDimension");
      const unidades = v("parcelasUnidades");
      const porUnidad = v("parcelasPorUnidad");
      return juntar(
        [
          forma && `Las parcelas utilizadas fueron de forma ${forma}${dim ? ` (${dim})` : ""}.`,
          !forma && dim && `Las parcelas utilizadas tuvieron dimensiones de ${dim}.`,
          unidades && `Las parcelas se distribuyeron en las unidades vegetacionales de ${unidades}${porUnidad ? `: ${porUnidad}` : ""}.`,
          !unidades && porUnidad && `La distribución de parcelas por unidad vegetacional fue la siguiente: ${porUnidad}.`,
        ],
        " "
      );
    },
  },
  {
    id: "BRAUN_BLANQUET",
    titulo: "Método de Braun-Blanquet",
    parrafos: [
      "En los puntos de muestreo se registra la composición florística y se estima la cobertura-abundancia de cada especie mediante la escala de Braun-Blanquet. Esta metodología permite caracterizar la estructura y dominancia de las especies presentes en cada unidad vegetacional y complementa la información obtenida mediante las parcelas.",
    ],
    campos: [
      numero("bbN", "N° de puntos Braun-Blanquet", "12"),
      texto("bbEscala", "Escala de cobertura", "Braun-Blanquet", ["Braun-Blanquet"]),
    ],
    esfuerzo: (v) => {
      const n = entero(v("bbN"));
      return juntar(
        [
          n > 0 && `Se evaluaron ${plural(n, "punto", "puntos")} de muestreo mediante este método.`,
          v("bbEscala") && `La escala de cobertura utilizada correspondió a ${v("bbEscala")}.`,
        ],
        " "
      );
    },
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
      texto("hidrofilaSector", "Cuerpo de agua o sector prospectado", "estero Los Patos"),
      numero("hidrofilaTransectos", "N° de transectos", "4"),
      texto("hidrofilaLongitud", "Longitud de los transectos", "50 m"),
      texto("hidrofilaOrientacion", "Orientación respecto del cuerpo de agua", "perpendiculares al cauce"),
      numero("hidrofilaSecundarios", "N° de transectos secundarios", "2"),
      numero("hidrofilaPuntos", "N° de puntos o registros", "64"),
    ],
    esfuerzo: (v) => {
      const n = entero(v("hidrofilaTransectos"));
      const sector = v("hidrofilaSector");
      const largo = v("hidrofilaLongitud");
      const orientacion = v("hidrofilaOrientacion") || (n === 1 ? "orientado hacia el cuerpo de agua" : "orientados hacia el cuerpo de agua");
      const secundarios = entero(v("hidrofilaSecundarios"));
      const puntos = entero(v("hidrofilaPuntos"));
      return juntar(
        [
          n > 0 &&
            `Se ${n === 1 ? "estableció" : "establecieron"} ${plural(n, "transecto", "transectos")}${largo ? ` de ${conUnidad(largo, "m")}` : ""}${sector ? ` en ${sector}` : ""}, ${orientacion}, para identificar cambios en la composición de la vegetación.`,
          !n && sector && `El levantamiento se realizó en ${sector}.`,
          secundarios > 0 && `Adicionalmente, se ${secundarios === 1 ? "estableció" : "establecieron"} ${plural(secundarios, "transecto secundario", "transectos secundarios")}.`,
          puntos > 0 && `En total se obtuvieron ${plural(puntos, "punto de registro", "puntos de registro")}.`,
        ],
        " "
      );
    },
  },
];

// ── FAUNA ──

export const METODOLOGIAS_FAUNA: Metodologia[] = [
  {
    id: "TRANSECTOS",
    titulo: "Transectos de muestreo de fauna",
    parrafos: [
      "La caracterización general de fauna se realiza mediante recorridos pedestres a través de transectos distribuidos en los distintos ambientes presentes en el área de estudio. Durante los recorridos se registran observaciones directas de ejemplares y evidencias indirectas de presencia, aplicando metodologías específicas de acuerdo con cada grupo taxonómico.",
    ],
    // El número, el código, el largo, el ancho y las coordenadas salen de terreno
    campos: [
      texto("transectosAmbientes", "Ambientes representados", "pradera, matorral y plantación"),
      texto("transectosEsfuerzo", "Esfuerzo por transecto", "1 hora con 2 observadores"),
    ],
    esfuerzo: (v) =>
      juntar(
        [
          v("transectosAmbientes") && `Los transectos abarcaron los ambientes de ${v("transectosAmbientes")}.`,
          v("transectosEsfuerzo") && `El esfuerzo aplicado en cada transecto fue de ${v("transectosEsfuerzo")}.`,
        ],
        " "
      ),
  },
  {
    id: "POA",
    titulo: "Aves – Puntos de Observación de Aves (POA)",
    parrafos: [
      "El registro de aves se realiza mediante recorridos de transectos complementados con Puntos de Observación de Aves (POA), ubicados en sectores representativos o de interés. En cada punto se registra durante un período estandarizado la actividad de las aves observadas y escuchadas dentro de un radio de detección definido.",
      "La identificación se realiza mediante observación directa, binoculares y reconocimiento de vocalizaciones. Complementariamente, puede utilizarse playback para estimular la respuesta de especies potencialmente presentes y facilitar su detección.",
    ],
    campos: [
      numero("poaN", "N° de POA", "10"),
      texto("poaRadio", "Radio del POA", "25 m"),
      texto("poaTiempo", "Tiempo por POA", "10 minutos"),
      texto("poaHorario", "Horario de observación", "07:00 a 11:00 h"),
      numero("poaDias", "N° de días", "2"),
      texto("poaOptica", "Equipo óptico", "binoculares 10×42"),
      sino("poaOportunistas", "Se consideraron registros oportunistas"),
      ...camposPlayback("poa", "Scelorchilus albicollis"),
    ],
    esfuerzo: (v) => {
      const n = entero(v("poaN"));
      const dias = entero(v("poaDias"));
      const con = juntar(
        [
          v("poaRadio") && `un radio de observación de ${conUnidad(v("poaRadio"), "m")}`,
          v("poaTiempo") && `un tiempo de permanencia de ${minutos(v("poaTiempo"), "por punto")}`,
        ],
        " y "
      );
      const resto = juntar([
        con && `con ${con}`,
        v("poaHorario") && `en horario de ${v("poaHorario")}`,
        dias > 0 && `durante ${plural(dias, "día", "días")}`,
      ]);
      return juntar(
        [
          n > 0 && `Se ${n === 1 ? "estableció" : "establecieron"} ${n} POA${resto ? `, ${resto}` : ""}.`,
          !n && resto && `Los POA se aplicaron ${resto}.`,
          v("poaOptica") && `La observación se realizó con ${v("poaOptica")}.`,
          frasePlayback(v, "poa"),
          marcado(v, "poaOportunistas") && "Adicionalmente, se consideraron los registros oportunistas obtenidos durante los recorridos de terreno.",
        ],
        " "
      );
    },
  },
  {
    id: "AVES_NOCTURNAS",
    titulo: "Avifauna nocturna",
    parrafos: [
      "Para detectar aves de hábitos nocturnos o crepusculares se realizan recorridos o transectos de escucha durante horario nocturno. Durante estos recorridos puede utilizarse playback mediante la reproducción de vocalizaciones de especies potencialmente presentes, registrando las respuestas vocales, aproximaciones o sobrevuelos detectados.",
    ],
    campos: [
      numero("nocN", "N° de transectos o estaciones", "5"),
      texto("nocTiempo", "Duración por transecto", "20 minutos"),
      numero("nocNoches", "N° de noches", "2"),
      texto("nocHorario", "Horario", "20:00 a 23:00 h"),
      ...camposPlayback("noc", "Strix rufipes y Glaucidium nana"),
    ],
    esfuerzo: (v) => {
      const n = entero(v("nocN"));
      const noches = entero(v("nocNoches"));
      const resto = juntar([
        noches > 0 && `durante ${plural(noches, "noche", "noches")}`,
        v("nocHorario") && `en horario de ${v("nocHorario")}`,
        v("nocTiempo") && `con una duración de ${minutos(v("nocTiempo"), "por transecto")}`,
      ]);
      return juntar(
        [
          n > 0 && `Se ${n === 1 ? "realizó" : "realizaron"} ${plural(n, "transecto", "transectos")} de escucha nocturna${resto ? `, ${resto}` : ""}.`,
          !n && resto && `Los transectos de escucha nocturna se realizaron ${resto}.`,
          frasePlayback(v, "noc"),
        ],
        " "
      );
    },
  },
  {
    id: "MAMIFEROS",
    titulo: "Mamíferos – Búsqueda activa y evidencias indirectas",
    parrafos: (v) => {
      const metodos = metodosBusqueda(v, "mam", true);
      const usando = metodos.length ? `, utilizando ${metodos.length === 1 ? "la metodología" : "metodologías"} ${unir(metodos)}` : "";
      const evidencias = v("mamEvidencias") || "huellas, fecas, madrigueras, pelos, restos óseos, revolcaderos y otras señales de actividad";
      return [
        `La caracterización de mamíferos considera recorridos pedestres mediante búsqueda activa${usando}. Durante los recorridos se buscan ejemplares y evidencias indirectas, tales como ${evidencias}.`,
        "Esta metodología constituye la base del levantamiento de mamíferos y puede complementarse mediante métodos específicos para micromamíferos y mesomamíferos.",
      ];
    },
    campos: [
      ...camposTcsVes("mam"),
      numero("mamTransectos", "N° de transectos", "5"),
      texto("mamEsfuerzo", "Duración / esfuerzo", "30 minutos por transecto"),
      texto("mamHorario", "Horario", "08:00 a 12:00 h"),
      texto("mamEvidencias", "Evidencias indirectas consideradas", "huellas, fecas, madrigueras, pelos, restos óseos, revolcaderos y otras señales de actividad"),
    ],
    esfuerzo: (v) => esfuerzoBusqueda(v, "mam"),
  },
  {
    id: "SHERMAN",
    titulo: "Micromamíferos – Trampas Sherman",
    parrafos: [
      "Como método complementario para la detección y captura de micromamíferos se instalan trampas Sherman en sectores que presenten condiciones potenciales de hábitat, tales como cobertura vegetal, madrigueras o corredores naturales.",
      "Las trampas permanecen activas durante horario nocturno y son revisadas durante las primeras horas de la mañana para reducir el tiempo de permanencia de los ejemplares capturados y evitar situaciones de estrés térmico. Generalmente se utiliza un cebo atrayente en su interior.",
    ],
    campos: [
      numero("shermanN", "N° de trampas", "42"),
      numero("shermanSectores", "N° de estaciones o sectores", "6"),
      numero("shermanNoches", "N° de noches", "3"),
      texto("shermanHoras", "Horas activas por noche", "10"),
      texto("shermanHorario", "Horario (activación a revisión)", "19:00 a 08:00 h"),
      texto("shermanCebo", "Tipo de cebo", "avena con esencia de vainilla"),
      texto("shermanHabitat", "Hábitat donde se instalaron", "matorral y bordes de quebrada"),
      texto("shermanAutorizacion", "Autorización SAG / resolución", "Resolución SAG N° …"),
    ],
    esfuerzo: (v) => {
      const n = entero(v("shermanN"));
      const sectores = entero(v("shermanSectores"));
      const noches = entero(v("shermanNoches"));
      const horas = v("shermanHoras");
      const enSectores = sectores > 0 ? ` en ${plural(sectores, "estación o sector", "estaciones o sectores")}` : "";
      let activas = juntar(
        [noches > 0 && `durante ${plural(noches, "noche", "noches")}`, v("shermanHorario") && `en horario de ${v("shermanHorario")}`],
        " "
      );
      if (horas) activas = activas ? `${activas} (${conUnidad(horas, "horas")} por noche)` : `durante ${conUnidad(horas, "horas")} por noche`;
      let frase = n
        ? `Se instalaron ${plural(n, "trampa Sherman", "trampas Sherman")}${enSectores}${activas ? `, ${n === 1 ? "activa" : "activas"} ${activas}` : ""}`
        : activas
          ? `Las trampas Sherman permanecieron activas ${activas}`
          : enSectores
            ? `Las trampas Sherman se instalaron${enSectores}`
            : "";
      if (v("shermanCebo")) frase = frase ? `${frase}, con ${v("shermanCebo")} como cebo` : `Como cebo se utilizó ${v("shermanCebo")}`;
      return juntar(
        [
          frase && `${frase}.`,
          v("shermanHabitat") && `Las trampas se ubicaron en ${v("shermanHabitat")}.`,
          v("shermanAutorizacion") && `La captura de ejemplares contó con la autorización sectorial correspondiente (${v("shermanAutorizacion")}).`,
        ],
        " "
      );
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
      numero("camarasN", "N° de cámaras", "2"),
      texto("camarasTiempo", "Días o noches de funcionamiento", "3 días"),
      texto("camarasHoras", "Horas totales de esfuerzo", "72"),
      texto("camarasCebo", "Cebo o atrayente", "sardina"),
      texto("camarasObjetivo", "Grupo objetivo", "mesomamíferos carnívoros"),
      texto("camarasHabitat", "Hábitat o criterio de ubicación", "senderos y corredores de desplazamiento"),
    ],
    esfuerzo: (v) => {
      const n = entero(v("camarasN"));
      const tiempo = v("camarasTiempo");
      const horas = v("camarasHoras") ? conUnidad(v("camarasHoras"), "horas") : "";
      const duracion = tiempo
        ? `${n === 1 ? "que funcionó" : "que funcionaron"} durante ${tiempo}${horas ? ` (${horas} de esfuerzo)` : ""}`
        : horas ? `con un esfuerzo total de ${horas}` : "";
      let frase = n
        ? `Se instalaron ${plural(n, "cámara trampa", "cámaras trampa")}${duracion ? `, ${duracion}` : ""}`
        : tiempo ? `Las cámaras trampa funcionaron durante ${tiempo}${horas ? ` (${horas} de esfuerzo)` : ""}`
        : horas ? `Las cámaras trampa sumaron un esfuerzo total de ${horas}` : "";
      if (v("camarasCebo")) frase = frase ? `${frase}, con ${v("camarasCebo")} como atrayente` : `Como atrayente se utilizó ${v("camarasCebo")}`;
      const objetivo = v("camarasObjetivo");
      const habitat = v("camarasHabitat");
      return juntar(
        [
          frase && `${frase}.`,
          objetivo && `Las cámaras se orientaron a la detección de ${objetivo}${habitat ? ` y se ubicaron en ${habitat}` : ""}.`,
          !objetivo && habitat && `Las cámaras se ubicaron en ${habitat}.`,
        ],
        " "
      );
    },
  },
  {
    id: "REPTILES",
    titulo: "Reptiles – Búsqueda activa TCS/VES",
    parrafos: (v) => {
      const metodos = metodosBusqueda(v, "rep");
      const inicio = metodos.length
        ? `${metodos.length === 1 ? "Se aplica la metodología" : "Se aplican las metodologías"} ${unir(metodos)}, inspeccionando`
        : "Se inspeccionan";
      const micro = v("repMicrohabitats") || "sectores bajo piedras, ramas, vegetación, hojarasca, escombros u otras estructuras que puedan ser utilizadas como refugio";
      return [
        `Para la caracterización de reptiles se realiza búsqueda activa mediante recorridos pedestres en los transectos definidos. ${inicio} visual y manualmente potenciales refugios y microhábitats, incluyendo ${micro}.`,
      ];
    },
    campos: [
      ...camposTcsVes("rep"),
      numero("repTransectos", "N° de transectos", "5"),
      numero("repDias", "N° de días", "2"),
      texto("repHorario", "Horario", "11:00 a 16:00 h"),
      texto("repEsfuerzo", "Duración / esfuerzo", "30 minutos por transecto"),
      texto("repAncho", "Ancho de búsqueda", "4 m"),
      texto("repMicrohabitats", "Microhábitats prospectados", "sectores bajo piedras, troncos y hojarasca"),
    ],
    esfuerzo: (v) => esfuerzoBusqueda(v, "rep"),
  },
  {
    id: "ANFIBIOS",
    titulo: "Anfibios – Búsqueda activa TCS/VES",
    parrafos: (v) => {
      const metodos = metodosBusqueda(v, "anf");
      return [
        `Durante los recorridos de terreno se realiza búsqueda activa de anfibios${metodos.length ? ` mediante ${unir(metodos)}` : ""}, inspeccionando cuerpos de agua, sectores húmedos, vegetación, piedras, troncos, hojarasca y otros microhábitats potencialmente utilizados como refugio o sitio reproductivo.`,
      ];
    },
    campos: [
      ...camposTcsVes("anf"),
      numero("anfTransectos", "N° de transectos diurnos", "5"),
      numero("anfDias", "N° de días", "2"),
      texto("anfHorario", "Horario diurno", "10:00 a 14:00 h"),
      texto("anfEsfuerzo", "Duración / esfuerzo", "30 minutos por sector húmedo"),
    ],
    esfuerzo: (v) => esfuerzoBusqueda(v, "anf"),
  },
  {
    id: "ANFIBIOS_NOCTURNA",
    titulo: "Anfibios – Escucha nocturna / Playback",
    parrafos: [
      "Cuando existen hábitats potenciales para anfibios, la búsqueda diurna puede complementarse mediante transectos o estaciones de escucha nocturna. Para ello se registran vocalizaciones naturales y puede utilizarse playback con vocalizaciones de las especies potencialmente presentes, buscando inducir respuestas acústicas que permitan confirmar su presencia.",
    ],
    campos: [
      numero("escuchaN", "N° de transectos o estaciones", "5"),
      numero("escuchaNoches", "N° de noches", "1"),
      texto("escuchaTiempo", "Tiempo por estación o transecto", "20 minutos"),
      texto("escuchaHorario", "Horario nocturno", "21:00 a 23:00 h"),
      ...camposPlayback("escucha", "Calyptocephalella gayi", true),
    ],
    esfuerzo: (v) => {
      const n = entero(v("escuchaN"));
      const noches = entero(v("escuchaNoches"));
      const resto = juntar([
        noches > 0 && `durante ${plural(noches, "noche", "noches")}`,
        v("escuchaHorario") && `en horario de ${v("escuchaHorario")}`,
        v("escuchaTiempo") && `con una duración de ${minutos(v("escuchaTiempo"), "por estación")}`,
      ]);
      return juntar(
        [
          n > 0 && `Se ${n === 1 ? "realizó" : "realizaron"} ${plural(n, "estación o transecto", "estaciones o transectos")} de escucha nocturna${resto ? `, ${resto}` : ""}.`,
          !n && resto && `La escucha nocturna se realizó ${resto}.`,
          frasePlayback(v, "escucha"),
        ],
        " "
      );
    },
  },
];

export const METODOLOGIAS: Record<TipoReporte, Metodologia[]> = {
  FLORA: METODOLOGIAS_FLORA,
  FAUNA: METODOLOGIAS_FAUNA,
};

// Ninguna metodología viene marcada (las elige la usuaria). Sí se adelantan los valores iniciales
// (TCS y VES marcados) y los números que ya están en las campañas, para que aparezcan escritos al marcarla.
export function datosMetodologiaDeCampanas(tipo: TipoReporte, campanas: CampanaReporte[]): Record<string, string> {
  const iniciales = Object.fromEntries(
    METODOLOGIAS[tipo].flatMap((m) => m.campos).filter((c) => c.inicial).map((c) => [c.clave, c.inicial!])
  );
  const estacionesDe = (metodo: string) => campanas.filter((c) => c.methodology === metodo).flatMap((c) => c.stations);
  const cantidad = (n: number) => (n > 0 ? String(n) : "");

  if (tipo === "FLORA") {
    // Los transectos de grilla son los de delimitación de humedales
    const grillas = estacionesDe("GRILLA");
    const largos = new Set(grillas.map((s) => s.length).filter((l): l is number => !!l));
    return {
      ...iniciales,
      hidrofilaTransectos: cantidad(grillas.length),
      hidrofilaLongitud: largos.size === 1 ? `${[...largos][0].toLocaleString("es-CL")} m` : "",
    };
  }

  const sherman = campanas.reduce((s, c) => s + (c.shermanTrapCount ?? 0), 0);
  const camaras = campanas.reduce((s, c) => s + (c.cameraTrapCount ?? 0), 0) || estacionesDe("TRAMPA_CAMARA").length;
  return {
    ...iniciales,
    poaN: cantidad(estacionesDe("PUNTO_CONTEO").length),
    shermanN: cantidad(sherman),
    camarasN: cantidad(camaras),
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
      const parrafos = typeof m.parrafos === "function" ? m.parrafos(v) : m.parrafos;
      const esfuerzo = m.esfuerzo?.(v) ?? "";
      return { titulo: m.titulo, parrafos: esfuerzo ? [...parrafos, esfuerzo] : parrafos };
    });
  const parrafosOtras = otras.split(/\n+/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (parrafosOtras.length) lista.push({ titulo: "Otras metodologías", parrafos: parrafosOtras });
  return lista;
}
