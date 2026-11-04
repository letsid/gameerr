// Types from ROMarrNG's provider contract for SeerrNG, request contract
// version 2 (docs/SEERRNG-INTEGRATION.md and
// server/test/fixtures/romarr/seerrng-contract-v2.json).

export interface RomarrHandshake {
  service: string;
  version: string;
  apiVersion: number;
  requestContractVersion: number;
  capabilities: {
    catalog: boolean;
    datCatalog?: boolean;
    pcAcquisition: boolean;
    emulationAcquisition: boolean;
    requestActions: { retry: boolean; cancel: boolean };
    assetStreaming: boolean;
    assetDatVerification?: boolean;
    patchCatalog?: boolean;
  };
}

export interface RomarrIgdbIdentity {
  catalogProvider: 'igdb';
  catalogId: number;
  // IGDB platform id of the requested system
  platformId: number;
}

export interface RomarrCreateRequest {
  externalRequestId: string;
  game: string;
  // Slug, name or alias of a ROMarrNG system, matched exactly
  platform: string;
  identity?: RomarrIgdbIdentity;
}

export type RomarrRequestStatus =
  | 'searching'
  | 'downloading'
  | 'importing'
  | 'available'
  | 'failed'
  | 'cancelled';

export interface RomarrRequestState {
  externalRequestId: string;
  status: RomarrRequestStatus;
  stage?: string;
  percent?: number | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  deliverable: boolean;
  error?: string | null;
  title: string;
  // ROMarrNG slug of the system the request was filed under
  platform: string;
  identity?: RomarrIgdbIdentity | null;
  actions: { retry: boolean; cancel: boolean; cancelReason?: string };
}

export interface RomarrLookupTitle {
  title: string;
  platform: string;
}

export interface RomarrLibraryLookup {
  // False while ROMarrNG is still reading its library
  ready: boolean;
  partial: boolean;
  // The titles that are in the library, as sent, with the resolved slug
  matches: RomarrLookupTitle[];
}

export interface RomarrError {
  error: string;
}
