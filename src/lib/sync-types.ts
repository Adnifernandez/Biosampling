import type { OccurrencePayload } from "@/lib/db";

// Items sent by the robust sync. `key` identifies the local Dexie record;
// `id`/`ids` are the server ids fixed on the device before the first attempt.

export interface SyncCampaignItem {
  key: string;
  id: string;
  projectId: string;
  name: string;
  surveyType: string;
  methodology: string;
  startDate: string;
  endDate: string;
  notes?: string;
  responsible?: string;
  shermanTrapCount?: number;
  cameraTrapCount?: number;
}

export interface SyncStationItem {
  key: string;
  id: string;
  campaignId: string;
  name: string;
  type: string;
  area?: number;
  length?: number;
  width?: number;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string;
}

export interface SyncOccurrenceItem {
  key: string;
  ids: string[];
  stationId: string;
  payload: OccurrencePayload;
}

// ok: `id` is the server id actually used (an identical campaign/réplica that
// already existed is reused instead of duplicated); `existing` means the server
// already had all of it, so nothing new was created.
// retry: true → temporary problem, keep the record pending and try again later.
// retry: false → the server rejected it; it needs a person to look at it.
export type SyncItemResult =
  | { key: string; ok: true; id?: string; existing?: boolean }
  | { key: string; ok: false; retry: boolean; message: string };

export type SyncBatchResponse =
  | { authError: true }
  | { authError?: false; results: SyncItemResult[] };
