import { createMockCustomerRemainingBalanceService } from "./mock-service";
import {
  CustomerRemainingBalanceError,
  type CustomerRemainingBalancePreviewScenario,
  type CustomerRemainingBalanceService,
} from "./types";

const contractUnavailableService: CustomerRemainingBalanceService = {
  async getResult() {
    throw new CustomerRemainingBalanceError(
      "Remaining Balance details are not available right now. Return to My Orders and try again later.",
      "CONTRACT_UNAVAILABLE",
    );
  },
  async refreshResult() {
    throw new CustomerRemainingBalanceError(
      "Remaining Balance details are not available right now. Return to My Orders and try again later.",
      "CONTRACT_UNAVAILABLE",
    );
  },
  async createCheckout() {
    throw new CustomerRemainingBalanceError(
      "Secure checkout is not available right now. No payment was started.",
      "CONTRACT_UNAVAILABLE",
    );
  },
};

// BE-14 does not yet expose a usable frontend contract. Service selection stays
// here so guessed endpoints and transport shapes cannot leak into the page.
export function getCustomerRemainingBalanceService(
  preview: boolean,
  scenario: CustomerRemainingBalancePreviewScenario,
): CustomerRemainingBalanceService {
  return preview
    ? createMockCustomerRemainingBalanceService(scenario)
    : contractUnavailableService;
}

export * from "./types";
