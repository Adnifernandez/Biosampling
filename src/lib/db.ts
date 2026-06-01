import Dexie, { type Table } from "dexie";

// ── Pending occurrences (saved offline, synced later) ──
export interface PendingOccurrence {
  localId?: number;
  stationId: string;
  projectId: string;
  campaignId: string;
  methodology: string;
  surveyType: "FLORA" | "FAUNA";
  payload: OccurrencePayload;
  speciesLabel: string;
  createdAt: number;
  status: "pending" | "error";
  errorMessage?: string;
}

export type OccurrencePayload =
  | { kind: "single"; data: SingleOccurrenceData }
  | { kind: "grilla"; data: GrillaOccurrenceData }
  | { kind: "rescate"; data: RescateOccurrenceData }
  | { kind: "sherman"; data: ShermanCaptureData }

export interface SingleOccurrenceData {
  speciesId: string; date: string;
  latitude?: string; longitude?: string;
  abundance?: string; cover?: string; height?: string;
  stratum?: string; phenology?: string;
  distance?: string; bearing?: string;
  groupSize?: string; behavior?: string;
  detectionMethod?: string; notes?: string;
  methodologyData?: string;
}
export interface GrillaOccurrenceData {
  date: string; notes?: string; sinVegetacion: number; photo?: string;
  species: { speciesId: string; count: number; individuos?: number }[];
}
export interface RescateOccurrenceData {
  speciesId: string; date: string;
  latitude?: string; longitude?: string;
  utmNorth?: string; utmEast?: string; utmZone?: string;
  peso?: string; largo?: string; ancho?: string; notes?: string;
  relocLatitude?: string; relocLongitude?: string; relocNotes?: string;
}
export interface ShermanCaptureData {
  speciesId: string;
  detectionMethod: string;
  deviceId?: string;
  latitude?: string; longitude?: string;
  notes?: string; methodologyData?: string;
  captures: { date: string; abundance: string }[];
}

// ── Read-only cached reference data ──
export interface CachedProject {
  id: string; name: string; region: string; commune: string;
  responsible: string; status: string;
}
export interface CachedCampaign {
  id: string; projectId: string; name: string;
  surveyType: string; methodology: string; status: string;
}
export interface CachedStation {
  id: string; campaignId: string; name: string;
  parentId: string | null;
  latitude: number | null; longitude: number | null;
}
export interface CachedSpecies {
  id: string; family: string; genus: string; species: string;
  commonName: string | null; type: string; conservationStatus: string | null;
}

export class BioSamplingDB extends Dexie {
  pendingOccurrences!: Table<PendingOccurrence>;
  projects!: Table<CachedProject>;
  campaigns!: Table<CachedCampaign>;
  stations!: Table<CachedStation>;
  species!: Table<CachedSpecies>;

  constructor() {
    super("biosampling");
    this.version(1).stores({
      pendingOccurrences: "++localId, stationId, status, createdAt",
      projects:           "id, status",
      campaigns:          "id, projectId",
      stations:           "id, campaignId, parentId",
      species:            "id, type, genus",
    });
  }
}

let _db: BioSamplingDB | null = null;
export function getDb(): BioSamplingDB | null {
  if (typeof window === "undefined") return null;
  if (!_db) _db = new BioSamplingDB();
  return _db;
}
