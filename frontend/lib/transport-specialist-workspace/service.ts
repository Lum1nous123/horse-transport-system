import { apiTransportSpecialistWorkspaceService } from "./api-service";
import { mockTransportSpecialistWorkspaceService } from "./mock-service";
import type { TransportSpecialistWorkspaceService } from "./types";

export function getTransportSpecialistWorkspaceService(preview: boolean): TransportSpecialistWorkspaceService {
  return preview ? mockTransportSpecialistWorkspaceService : apiTransportSpecialistWorkspaceService;
}

export * from "./types";
