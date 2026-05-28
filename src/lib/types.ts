export type SurveyType = "FLORA" | "FAUNA";
export type StationType = "PARCELA" | "TRANSECTO";
export type ProjectStatus = "ACTIVE" | "INACTIVE" | "COMPLETED";
export type CampaignStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

export const SURVEY_TYPE_LABELS: Record<SurveyType, string> = {
  FLORA: "Flora",
  FAUNA: "Fauna",
};

export const STATION_TYPE_LABELS: Record<StationType, string> = {
  PARCELA: "Parcela",
  TRANSECTO: "Transecto",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  COMPLETED: "Completado",
};

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  ACTIVE: "Activa",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};
