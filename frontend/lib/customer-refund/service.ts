import { createMockCustomerRefundService } from "./mock-service";
import {
  CustomerRefundError,
  type CustomerRefundPreviewScenario,
  type CustomerRefundService,
} from "./types";

const contractUnavailableService: CustomerRefundService = {
  async getResult() {
    throw new CustomerRefundError(
      "Cancellation and refund details are not available right now. Return to My Orders and try again later.",
      "CONTRACT_UNAVAILABLE",
    );
  },
  async refreshResult() {
    throw new CustomerRefundError(
      "Cancellation and refund details are not available right now. Return to My Orders and try again later.",
      "CONTRACT_UNAVAILABLE",
    );
  },
};

// BE-12/13 do not yet expose a frontend contract. Keeping selection here
// prevents guessed endpoints and transport shapes from leaking into the page.
export function getCustomerRefundService(
  preview: boolean,
  scenario: CustomerRefundPreviewScenario,
): CustomerRefundService {
  return preview ? createMockCustomerRefundService(scenario) : contractUnavailableService;
}

export * from "./types";
