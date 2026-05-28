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
  description: string;
  surveyType: SurveyType;
  fields: MethodologyField[];
}

export const BB_COVER_CODES = [
  { code: "p",  desc: "Registro fuera de la parcela; cobertura insignificante" },
  { code: "r",  desc: "Individuo solitario, cobertura insignificante" },
  { code: "+",  desc: "Pocos individuos, cobertura poco significativa" },
  { code: "1",  desc: "Numerosos individuos, cobertura < 5%" },
  { code: "2m", desc: "Nº individuos > 50, cobertura < 5%" },
  { code: "2a", desc: "Numerosos individuos, cobertura 5–15%" },
  { code: "2b", desc: "Cobertura 16–25%" },
  { code: "3",  desc: "Cobertura 26–50%" },
  { code: "4",  desc: "Cobertura 51–75%" },
  { code: "5",  desc: "Cobertura 76–100%" },
];

export const METHODOLOGIES: Methodology[] = [
  // Flora
  {
    id: "BRAUN_BLANQUET",
    name: "Parcelas BB",
    description: "Braun-Blanquet",
    surveyType: "FLORA",
    fields: [],
  },
  {
    id: "MICRORUTEO",
    name: "Microruteo",
    description: "Área de influencia",
    surveyType: "FLORA",
    fields: [],
  },
  {
    id: "PARCELAS_FORESTALES",
    name: "Parcelas Forestales",
    description: "DAT, DAP y Altura por individuo",
    surveyType: "FLORA",
    fields: [],
  },
  {
    id: "GRILLA",
    name: "Grilla",
    description: "Delimitación de Humedales",
    surveyType: "FLORA",
    fields: [],
  },
  // Fauna
  {
    id: "TRANSECTO_LINEAL_FAUNA",
    name: "Transecto",
    description: "Transecto de fauna",
    surveyType: "FAUNA",
    fields: [],
  },
  {
    id: "PUNTO_CONTEO",
    name: "Punto de Conteo",
    description: "Visual y auditivo",
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
    description: "Registro fotográfico",
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
    description: "Captura y marcaje",
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
  // Rescate y Relocalización
  {
    id: "RESCATE_TRANSECTO",
    name: "Transecto",
    description: "Transecto de rescate",
    surveyType: "RESCATE",
    fields: [],
  },
  {
    id: "RESCATE_MICRORUTEO",
    name: "Microruteo",
    description: "Recorrido libre",
    surveyType: "RESCATE",
    fields: [],
  },
  {
    id: "VES",
    name: "VES",
    description: "Visual Encounter Survey",
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
