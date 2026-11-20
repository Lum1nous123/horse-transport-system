import { beforeEach, describe, expect, it } from "vitest";
import {
  CUSTOMER_TERMS_LOGIN_HIDDEN_KEY,
  CUSTOMER_TERMS_SUMMARY,
  CUSTOMER_TERMS_SECTIONS,
  hideCustomerTermsOnLogin,
  isCustomerTermsLoginHidden,
} from "./customer-terms";

describe("Customer Terms login preference", () => {
  beforeEach(() => window.localStorage.clear());

  it("is visible by default and persists the explicit hide preference", () => {
    expect(isCustomerTermsLoginHidden()).toBe(false);

    hideCustomerTermsOnLogin();

    expect(window.localStorage.getItem(CUSTOMER_TERMS_LOGIN_HIDDEN_KEY)).toBe("true");
    expect(isCustomerTermsLoginHidden()).toBe(true);
  });

  it("contains the versioned Customer policy and its complete section list", () => {
    expect(CUSTOMER_TERMS_SUMMARY.length).toBeGreaterThan(0);
    expect(CUSTOMER_TERMS_SECTIONS).toHaveLength(10);
    expect(CUSTOMER_TERMS_SECTIONS.map((section) => section.title)).toEqual(
      expect.arrayContaining([
        "1. Service scope",
        "3. Quotation and payment",
        "4. Documents and deadlines",
        "7. Emergency response",
        "10. Raising a concern",
      ]),
    );
    expect(CUSTOMER_TERMS_SECTIONS.map((section) => section.title)).toEqual(
      CUSTOMER_TERMS_SECTIONS.map((_, index) =>
        expect.stringMatching(new RegExp(`^${index + 1}\\.\\s`)),
      ),
    );
  });
});
