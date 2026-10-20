import { mockEscortExecutionService } from "./mock-service";
import type { EscortExecutionService } from "./types";
import { unavailableEscortExecutionService } from "./unavailable-service";

export function getEscortExecutionService(preview: boolean): EscortExecutionService {
  const developmentPreview = process.env.NODE_ENV === "development" && preview;
  return developmentPreview ? mockEscortExecutionService : unavailableEscortExecutionService;
}

export * from "./types";
