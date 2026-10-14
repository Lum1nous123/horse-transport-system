import { createMockCustomerRemainingBalanceService } from "./mock-service";
import { apiCustomerRemainingBalanceService } from "./api-service";
import {
  type CustomerRemainingBalancePreviewScenario,
  type CustomerRemainingBalanceService,
} from "./types";
export function getCustomerRemainingBalanceService(
  preview: boolean,
  scenario: CustomerRemainingBalancePreviewScenario,
): CustomerRemainingBalanceService {
  return preview
    ? createMockCustomerRemainingBalanceService(scenario)
    : apiCustomerRemainingBalanceService;
}

export * from "./types";
