import { mockTransportSpecialistWorkspaceService } from "./mock-service";
import type { TransportSpecialistWorkspaceService } from "./types";

// BE-11/12 do not yet expose a contracted assigned-only TS API. Routes depend
// on this frontend-owned interface so the mock can be replaced without guessed
// endpoints or transport shapes leaking into the UI.
export const transportSpecialistWorkspaceService: TransportSpecialistWorkspaceService =
  mockTransportSpecialistWorkspaceService;

export * from "./types";
