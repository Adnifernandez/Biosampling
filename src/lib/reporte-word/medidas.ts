// Medidas que se pueden marcar en el formulario del reporte de fauna. Las marcadas se incluyen
// en la sección "Recomendaciones Ambientales Asociadas a los Hallazgos", con estos párrafos tal cual.
// "enFrase" es el nombre que va dentro del párrafo de inicio de la sección ("se recomienda implementar la medida de …").

export type Medida = { id: string; titulo: string; enFrase: string; parrafos: string[] };

export const MEDIDAS_FAUNA: Medida[] = [
  {
    id: "PPC",
    titulo: "Perturbación Controlada – PPC",
    enFrase: "Perturbación Controlada (PPC)",
    parrafos: [
      "En atención a la presencia de especies de fauna de baja movilidad en sectores que podrían ser intervenidos por el Proyecto, se recomienda evaluar la implementación de un Plan de Perturbación Controlada (PPC) previo al inicio de las obras. Para ello, se deberá definir y caracterizar en terreno un área de destino contigua al sector de intervención, verificando que presente condiciones de hábitat similares, continuidad ambiental y presencia de la especie objetivo. Esta caracterización deberá permitir conocer, al menos, las características del ambiente y la abundancia o densidad de la población presente, de manera de confirmar que el sector resulta adecuado para recibir los ejemplares desplazados.",
      "Asimismo, se deberá considerar un seguimiento posterior de la población en el área de destino durante al menos dos ciclos reproductivos de la especie objetivo, mediante indicadores que permitan verificar que su abundancia y densidad se mantienen o aumentan respecto de la condición previa a la aplicación de la medida. Este seguimiento deberá ser considerado por el Titular dentro de la planificación, cronograma y costos asociados al Proyecto.",
    ],
  },
  {
    id: "PAS146",
    titulo: "PAS 146 – Rescate y Relocalización de Fauna Terrestre",
    enFrase: "Rescate y Relocalización de Fauna Terrestre (PAS 146)",
    parrafos: [
      "En caso de que las obras impliquen la afectación de especies protegidas de fauna terrestre para las cuales corresponda realizar captura y traslado, se deberá evaluar la implementación de un Plan de Rescate y Relocalización asociado al PAS 146. Para su desarrollo será necesario definir las especies objetivo y estimar el número de ejemplares a rescatar, establecer los métodos de captura, manejo y traslado, delimitar las superficies de rescate y seleccionar previamente las áreas de relocalización.",
      "Las áreas de relocalización deberán ser caracterizadas en terreno para verificar que presenten condiciones ambientales similares al hábitat de origen, presencia de la especie objetivo, abundancia o densidad de la población receptora y una superficie suficiente para recibir nuevos ejemplares. Asimismo, se deberá considerar un seguimiento de las poblaciones en el área de relocalización durante al menos tres ciclos reproductivos de las especies objetivo, utilizando indicadores que permitan verificar que la población receptora se mantiene o aumenta respecto de la condición previa a la aplicación de la medida. Este seguimiento de largo plazo deberá ser incorporado por el Titular en la planificación, cronograma y costos asociados al Proyecto.",
    ],
  },
  {
    id: "PAS119",
    titulo: "PAS 119 – Seguimiento de Fauna Íctica y Biota Acuática",
    enFrase: "Seguimiento de Fauna Íctica y Biota Acuática (PAS 119)",
    parrafos: [
      "En caso de que los resultados de la caracterización limnológica y las características de las obras hagan necesario realizar un seguimiento de las poblaciones de especies hidrobiológicas durante las distintas fases del Proyecto, se deberá evaluar la aplicabilidad del PAS 119. Para ello será necesario definir un programa de seguimiento que establezca las estaciones de muestreo, metodologías, periodicidad y especies o componentes a evaluar, procurando mantener metodologías comparables con aquellas utilizadas durante la caracterización limnológica.",
      "Este permiso se encuentra asociado a actividades de pesca de investigación requeridas para el seguimiento ambiental de especies hidrobiológicas, por lo que deberá considerarse cuando sea necesario evaluar la evolución de las poblaciones o comunidades acuáticas durante la ejecución del Proyecto. El PAS 119 no reemplaza una eventual autorización para ejecutar rescate y relocalización de fauna íctica.",
    ],
  },
  {
    id: "RESCATE_ICTICA",
    titulo: "Rescate y Relocalización de Fauna Íctica",
    enFrase: "Rescate y Relocalización de Fauna Íctica",
    parrafos: [
      "En caso de que se contemple la intervención de un cauce con presencia de fauna íctica nativa y exista riesgo de mortalidad, atrapamiento o aislamiento de ejemplares durante la ejecución de las obras, se recomienda considerar previamente un Plan de Rescate y Relocalización de Fauna Íctica.",
      "El plan deberá identificar las especies objetivo y los sectores a intervenir, definir las metodologías de captura, manejo, traslado y liberación, y establecer sitios receptores adecuados para los ejemplares rescatados, procurando que estos presenten condiciones de hábitat compatibles con los requerimientos de las especies registradas. Asimismo, deberá contemplarse la verificación de los resultados de la medida cuando corresponda, de manera de evaluar la efectividad del rescate y las condiciones de los ejemplares relocalizados.",
      "Los antecedentes técnicos de esta medida deberán quedar definidos durante la evaluación ambiental del Proyecto. Sin perjuicio de ello, la autorización sectorial para ejecutar el rescate y relocalización deberá tramitarse ante la Subsecretaría de Pesca y Acuicultura conforme al procedimiento aplicable, una vez obtenida la correspondiente Resolución de Calificación Ambiental favorable.",
    ],
  },
];

// Sugerencias para el grupo de fauna de cada medida (se puede escribir otro)
export const GRUPOS_FAUNA = ["aves", "mamíferos", "micromamíferos", "reptiles", "anfibios", "fauna íctica"];

// Párrafo de inicio de la sección, con el texto de la usuaria (2026-11-16): uno si hay medidas y otro si no.
// Grupo vacío → "[Completar: grupo de fauna]" en amarillo.
export function parrafoMedidas(marcadas: Medida[], grupos: Record<string, string>): string {
  if (marcadas.length === 0) {
    return "En función de los hallazgos identificados durante las campañas de terreno y considerando las características del área evaluada, no se considera necesaria la implementación de medidas para ninguno de los grupos de fauna silvestre evaluados.";
  }
  const grupo = (m: Medida) => (grupos[m.id] ?? "").replace(/\s+/g, " ").trim().replace(/^(el\s+)?grupo\s+de\s+/i, "") || "[Completar: grupo de fauna]";
  if (marcadas.length === 1) {
    const [m] = marcadas;
    return (
      `En función de los hallazgos identificados, se recomienda implementar la medida de ${m.enFrase} asociada al grupo de ${grupo(m)}, ` +
      "con el objetivo de abordar los potenciales efectos derivados de las actividades del proyecto. " +
      "A continuación, se presenta una breve descripción de la medida propuesta."
    );
  }
  const items = marcadas.map((m) => `${m.enFrase}, asociada al grupo de ${grupo(m)}`);
  // 2 medidas: "A, asociada…, y B, asociada…"; 3 o más: "A, asociada…; B, asociada…; y C, asociada…"
  const lista =
    items.length === 2 ? `${items[0]}, y ${items[1]}` : `${items.slice(0, -1).join("; ")}; y ${items[items.length - 1]}`;
  return (
    `En función de los hallazgos identificados, se recomienda implementar las medidas de ${lista}, ` +
    "con el objetivo de abordar los potenciales efectos derivados de las actividades del proyecto. " +
    "A continuación, se presenta una breve descripción de las medidas propuestas."
  );
}
