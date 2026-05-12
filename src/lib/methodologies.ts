import { SurveyType } from "./types";

export interface MethodologyField {
  key: string;
  label: string;
  type: "number" | "text" | "select";
  unit?: string;
  options?: string[];
  required?: boolean;
}

export interface Methodology {
  id: string;
  name: string;
  surveyType: SurveyType;
  fields: MethodologyField[];
}

export const METHODOLOGIES: Methodology[] = [
  // Flora
  {
    id: "CUADRANTE",
    name: "Cuadrante",
    surveyType: "FLORA",
    fields: [
      { key: "abundance", label: "Abundancia (nº individuos)", type: "number", required: true },
      { key: "cover", label: "Cobertura", type: "number", unit: "%", required: true },
      { key: "height", label: "Altura promedio", type: "number", unit: "m" },
      {
        key: "stratum",
        label: "Estrato",
        type: "select",
        options: ["Arbóreo", "Arbustivo", "Herbáceo", "Rasante"],
        required: true,
      },
      {
        key: "phenology",
        label: "Estado fenológico",
        type: "select",
        options: ["Vegetativo", "Floración", "Fructificación", "Senescencia", "Sin hojas"],
      },
    ],
  },
  {
    id: "TRANSECTO_LINEAL_FLORA",
    name: "Transecto Lineal",
    surveyType: "FLORA",
    fields: [
      { key: "distance", label: "Distancia en transecto", type: "number", unit: "m", required: true },
      { key: "cover", label: "Cobertura", type: "number", unit: "%" },
      {
        key: "stratum",
        label: "Estrato",
        type: "select",
        options: ["Arbóreo", "Arbustivo", "Herbáceo", "Rasante"],
      },
      { key: "abundance", label: "Abundancia", type: "number" },
    ],
  },
  {
    id: "PARCELA_FIJA",
    name: "Parcela Fija",
    surveyType: "FLORA",
    fields: [
      { key: "abundance", label: "Abundancia (nº individuos)", type: "number", required: true },
      { key: "cover", label: "Cobertura", type: "number", unit: "%" },
      { key: "height", label: "Altura promedio", type: "number", unit: "m" },
      {
        key: "stratum",
        label: "Estrato",
        type: "select",
        options: ["Arbóreo", "Arbustivo", "Herbáceo", "Rasante"],
        required: true,
      },
      {
        key: "phenology",
        label: "Estado fenológico",
        type: "select",
        options: ["Vegetativo", "Floración", "Fructificación", "Senescencia", "Sin hojas"],
      },
    ],
  },
  {
    id: "INVENTARIO_FLORISTICO",
    name: "Inventario Florístico",
    surveyType: "FLORA",
    fields: [
      { key: "abundance", label: "Abundancia", type: "number" },
      {
        key: "stratum",
        label: "Estrato",
        type: "select",
        options: ["Arbóreo", "Arbustivo", "Herbáceo", "Rasante"],
      },
    ],
  },
  // Fauna
  {
    id: "TRANSECTO_LINEAL_FAUNA",
    name: "Transecto Lineal",
    surveyType: "FAUNA",
    fields: [
      { key: "groupSize", label: "Tamaño de grupo", type: "number", required: true },
      { key: "distance", label: "Distancia perpendicular", type: "number", unit: "m" },
      { key: "bearing", label: "Azimut de detección", type: "number", unit: "°" },
      {
        key: "behavior",
        label: "Comportamiento",
        type: "select",
        options: ["Reposo", "Alimentación", "Desplazamiento", "Reproducción", "Alerta", "Otro"],
      },
    ],
  },
  {
    id: "PUNTO_CONTEO",
    name: "Punto de Conteo",
    surveyType: "FAUNA",
    fields: [
      { key: "groupSize", label: "Número de individuos", type: "number", required: true },
      { key: "distance", label: "Distancia de detección", type: "number", unit: "m" },
      {
        key: "detectionMethod",
        label: "Método de detección",
        type: "select",
        options: ["Visual", "Auditivo", "Visual y Auditivo", "Rastro", "Otro"],
        required: true,
      },
      {
        key: "behavior",
        label: "Comportamiento",
        type: "select",
        options: ["Reposo", "Alimentación", "Desplazamiento", "Canto", "Vuelo", "Otro"],
      },
    ],
  },
  {
    id: "TRAMPA_CAMARA",
    name: "Trampa Cámara",
    surveyType: "FAUNA",
    fields: [
      { key: "groupSize", label: "Nº individuos en foto", type: "number", required: true },
      {
        key: "behavior",
        label: "Comportamiento observado",
        type: "select",
        options: ["Desplazamiento", "Alimentación", "Marcaje", "Interacción social", "Otro"],
      },
      {
        key: "detectionMethod",
        label: "Sexo (si determinable)",
        type: "select",
        options: ["Macho", "Hembra", "Indeterminado"],
      },
    ],
  },
  {
    id: "RED_NIEBLA",
    name: "Red de Niebla",
    surveyType: "FAUNA",
    fields: [
      { key: "groupSize", label: "Nº individuos capturados", type: "number", required: true },
      {
        key: "detectionMethod",
        label: "Sexo",
        type: "select",
        options: ["Macho", "Hembra", "Indeterminado"],
      },
      { key: "behavior", label: "Edad/Plumaje", type: "text" },
    ],
  },
  {
    id: "VES",
    name: "VES (Visual Encounter Survey)",
    surveyType: "FAUNA",
    fields: [
      { key: "groupSize", label: "Nº individuos", type: "number", required: true },
      {
        key: "behavior",
        label: "Microhábitat",
        type: "select",
        options: ["Bajo roca", "En vegetación", "Sobre sustrato desnudo", "En agua", "Otro"],
      },
      {
        key: "detectionMethod",
        label: "Método detección",
        type: "select",
        options: ["Visual directo", "Captura manual", "Auditivo", "Rastro"],
      },
    ],
  },
];

export function getMethodologiesBySurveyType(type: SurveyType): Methodology[] {
  return METHODOLOGIES.filter((m) => m.surveyType === type);
}

export function getMethodologyById(id: string): Methodology | undefined {
  return METHODOLOGIES.find((m) => m.id === id);
}
