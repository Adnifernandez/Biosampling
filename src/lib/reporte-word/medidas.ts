// Medidas que se pueden marcar en el formulario del reporte de fauna. Las marcadas se incluyen
// en la sección "Requerimientos Ambientales Asociados a los Hallazgos", con estos párrafos tal cual.

export type Medida = { id: string; titulo: string; parrafos: string[] };

export const MEDIDAS_FAUNA: Medida[] = [
  {
    id: "PPC",
    titulo: "Perturbación Controlada – PPC",
    parrafos: [
      "En atención a la presencia de especies de fauna de baja movilidad en sectores que podrían ser intervenidos por el Proyecto, se recomienda evaluar la implementación de un Plan de Perturbación Controlada (PPC) previo al inicio de las obras. Para ello, se deberá definir y caracterizar en terreno un área de destino contigua al sector de intervención, verificando que presente condiciones de hábitat similares, continuidad ambiental y presencia de la especie objetivo. Esta caracterización deberá permitir conocer, al menos, las características del ambiente y la abundancia o densidad de la población presente, de manera de confirmar que el sector resulta adecuado para recibir los ejemplares desplazados.",
      "Asimismo, se deberá considerar un seguimiento posterior de la población en el área de destino durante al menos dos ciclos reproductivos de la especie objetivo, mediante indicadores que permitan verificar que su abundancia y densidad se mantienen o aumentan respecto de la condición previa a la aplicación de la medida. Este seguimiento deberá ser considerado por el Titular dentro de la planificación, cronograma y costos asociados al Proyecto.",
    ],
  },
  {
    id: "PAS146",
    titulo: "PAS 146 – Rescate y Relocalización de Fauna Terrestre",
    parrafos: [
      "En caso de que las obras impliquen la afectación de especies protegidas de fauna terrestre para las cuales corresponda realizar captura y traslado, se deberá evaluar la implementación de un Plan de Rescate y Relocalización asociado al PAS 146. Para su desarrollo será necesario definir las especies objetivo y estimar el número de ejemplares a rescatar, establecer los métodos de captura, manejo y traslado, delimitar las superficies de rescate y seleccionar previamente las áreas de relocalización.",
      "Las áreas de relocalización deberán ser caracterizadas en terreno para verificar que presenten condiciones ambientales similares al hábitat de origen, presencia de la especie objetivo, abundancia o densidad de la población receptora y una superficie suficiente para recibir nuevos ejemplares. Asimismo, se deberá considerar un seguimiento de las poblaciones en el área de relocalización durante al menos tres ciclos reproductivos de las especies objetivo, utilizando indicadores que permitan verificar que la población receptora se mantiene o aumenta respecto de la condición previa a la aplicación de la medida. Este seguimiento de largo plazo deberá ser incorporado por el Titular en la planificación, cronograma y costos asociados al Proyecto.",
    ],
  },
  {
    id: "PAS119",
    titulo: "PAS 119 – Seguimiento de Fauna Íctica y Biota Acuática",
    parrafos: [
      "En caso de que los resultados de la caracterización limnológica y las características de las obras hagan necesario realizar un seguimiento de las poblaciones de especies hidrobiológicas durante las distintas fases del Proyecto, se deberá evaluar la aplicabilidad del PAS 119. Para ello será necesario definir un programa de seguimiento que establezca las estaciones de muestreo, metodologías, periodicidad y especies o componentes a evaluar, procurando mantener metodologías comparables con aquellas utilizadas durante la caracterización limnológica.",
      "Este permiso se encuentra asociado a actividades de pesca de investigación requeridas para el seguimiento ambiental de especies hidrobiológicas, por lo que deberá considerarse cuando sea necesario evaluar la evolución de las poblaciones o comunidades acuáticas durante la ejecución del Proyecto. El PAS 119 no reemplaza una eventual autorización para ejecutar rescate y relocalización de fauna íctica.",
    ],
  },
  {
    id: "RESCATE_ICTICA",
    titulo: "Rescate y Relocalización de Fauna Íctica",
    parrafos: [
      "En caso de que se contemple la intervención de un cauce con presencia de fauna íctica nativa y exista riesgo de mortalidad, atrapamiento o aislamiento de ejemplares durante la ejecución de las obras, se recomienda considerar previamente un Plan de Rescate y Relocalización de Fauna Íctica.",
      "El plan deberá identificar las especies objetivo y los sectores a intervenir, definir las metodologías de captura, manejo, traslado y liberación, y establecer sitios receptores adecuados para los ejemplares rescatados, procurando que estos presenten condiciones de hábitat compatibles con los requerimientos de las especies registradas. Asimismo, deberá contemplarse la verificación de los resultados de la medida cuando corresponda, de manera de evaluar la efectividad del rescate y las condiciones de los ejemplares relocalizados.",
      "Los antecedentes técnicos de esta medida deberán quedar definidos durante la evaluación ambiental del Proyecto. Sin perjuicio de ello, la autorización sectorial para ejecutar el rescate y relocalización deberá tramitarse ante la Subsecretaría de Pesca y Acuicultura conforme al procedimiento aplicable, una vez obtenida la correspondiente Resolución de Calificación Ambiental favorable.",
    ],
  },
];
