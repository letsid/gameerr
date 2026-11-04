// Types from the QuestarrNG / Questarr SeerrNG provider contract, version 2
// (server/test/fixtures/questarr/seerrng-v2.openapi.yaml). Questarr
// implements the same contract with apiVersion 1, requestContractVersion 2.

export interface QuestarrHandshake {
  service: string;
  version: string;
  apiVersion: number;
  requestContractVersion: number;
  capabilities: {
    catalog: boolean;
    pcAcquisition: boolean;
    emulationAcquisition: boolean;
    requestActions: { retry: boolean; cancel: boolean };
    assetStreaming: boolean;
    editions?: boolean;
    discover?: boolean;
    wantedContent?: boolean;
  };
}

export interface QuestarrVariant {
  operatingSystem: 'windows' | 'linux' | 'macos';
  architecture: 'x64' | 'arm64' | 'x86' | 'universal';
}

export interface QuestarrCreateRequest {
  externalRequestId: string;
  title: string;
  igdbId?: number;
  variant: QuestarrVariant;
}

export type QuestarrRequestStatus =
  | 'accepted'
  | 'searching'
  | 'downloading'
  | 'importing'
  | 'available'
  | 'failed'
  | 'cancelled';

export interface QuestarrRequestState {
  externalRequestId: string;
  status: QuestarrRequestStatus;
  deliverable: boolean;
  error?: string | null;
  title: string;
  variant?: QuestarrVariant;
  game?: { id: string; title: string; status: string };
  identity?: { catalogProvider?: 'igdb'; catalogId?: number };
  actions: { retry: boolean; cancel: boolean };
}

export interface QuestarrLibraryLookup {
  games: { igdbId: number; status: string }[];
}

export interface QuestarrError {
  error: string;
}
