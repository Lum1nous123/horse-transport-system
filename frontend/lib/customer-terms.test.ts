import { beforeEach, describe, expect, it } from "vitest";
import {
  CUSTOMER_TERMS_INTRO,
  CUSTOMER_TERMS_LOGIN_HIDDEN_KEY,
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

  it("contains the complete approved 30-section Customer policy", () => {
    expect(CUSTOMER_TERMS_INTRO).toHaveLength(2);
    expect(CUSTOMER_TERMS_SECTIONS).toHaveLength(30);
    expect(CUSTOMER_TERMS_SECTIONS.map((section) => section.title)).toEqual(
      expect.arrayContaining([
        "1. Scope of Transport Services",
        "8. Deposit",
        "12. Second and Final Document Correction",
        "20. Tracking",
        "28. Transport Terms and Important Notices",
        "30. Contact Information",
      ]),
    );
    expect(CUSTOMER_TERMS_SECTIONS.map((section) => section.title)).toEqual(
      CUSTOMER_TERMS_SECTIONS.map((_, index) =>
        expect.stringMatching(new RegExp(`^${index + 1}\\.\\s`)),
      ),
    );
  });
});
