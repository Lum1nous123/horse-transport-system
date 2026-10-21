import { mockLogisticsRouteReviewService } from "./mock-service";
import { apiLogisticsRouteReviewService } from "./api-service";
import type { LogisticsRouteReviewService } from "./types";
export function getLogisticsRouteReviewService(preview: boolean): LogisticsRouteReviewService {
  return preview ? mockLogisticsRouteReviewService : apiLogisticsRouteReviewService;
}

export * from "./types";
