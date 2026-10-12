import { mockLogisticsRouteReviewService } from "./mock-service";
import {
  RouteReviewError,
  type LogisticsRouteReviewService,
} from "./types";

function contractUnavailable(): never {
  throw new RouteReviewError(
    "Route review services are not available right now. Try again later.",
    "CONTRACT_UNAVAILABLE",
  );
}

const contractUnavailableService: LogisticsRouteReviewService = {
  async listReviews() { return contractUnavailable(); },
  async getReview() { return contractUnavailable(); },
  async returnPlan() { return contractUnavailable(); },
  async confirmPlan() { return contractUnavailable(); },
};

// BE-20/21 do not yet expose a usable frontend contract. Keeping the adapter
// behind this boundary avoids guessing URLs or DTOs in the UI.
export function getLogisticsRouteReviewService(preview: boolean): LogisticsRouteReviewService {
  return preview ? mockLogisticsRouteReviewService : contractUnavailableService;
}

export * from "./types";
