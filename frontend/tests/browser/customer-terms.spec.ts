import { expect, test, type Page } from "@playwright/test";

const customerOrder = {
  id: "terms-order-1",
  orderCode: "ORD-TERMS-1",
  originCountry: "France",
  destinationCountry: "Belgium",
  requestedDepartureAt: "2026-11-10T09:00:00",
  transportMode: "ROAD",
  recipientName: "Taylor Morgan",
  recipientPhone: "+32 2 555 0101",
  horseIds: [],
  status: "QUOTATION_SENT",
};

async function mockTermsApi(page: Page, role: "CUSTOMER" | "LOGISTICS_MANAGER") {
  let checkoutRequests = 0;
  await page.route("**/api/v1/**", async (route) => {
    const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Accept, Content-Type", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: corsHeaders });
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === "/api/v1/auth/login") {
      await route.fulfill({ headers: corsHeaders, json: { accessToken: "terms-test-token" } });
      return;
    }
    if (path === "/api/v1/auth/me") {
      await route.fulfill({ headers: corsHeaders, json: { id: "user-1", fullName: "Test User", email: "test@example.com", phone: null, role, status: "ACTIVE" } });
      return;
    }
    if (path === "/api/v1/horses") {
      await route.fulfill({ headers: corsHeaders, json: [] });
      return;
    }
    if (path === "/api/v1/orders") {
      await route.fulfill({ headers: corsHeaders, json: [customerOrder] });
      return;
    }
    if (path === `/api/v1/orders/${customerOrder.id}/quotation`) {
      await route.fulfill({ headers: corsHeaders, json: {
        id: "quote-1",
        orderId: customerOrder.id,
        totalAmount: 4000,
        depositAmount: 1000,
        remainingAmount: 3000,
        currency: "USD",
        status: "SENT",
        lineItems: [],
      } });
      return;
    }
    if (path === `/api/v1/orders/${customerOrder.id}/deposit/checkout`) {
      checkoutRequests += 1;
      await route.fulfill({ headers: corsHeaders, json: { checkoutUrl: `${new URL(page.url()).origin}/payment/cancelled` } });
      return;
    }
    if (path === `/api/v1/orders/${customerOrder.id}/deposit`) {
      await route.fulfill({ status: 404, json: { code: "DEPOSIT_PAYMENT_NOT_FOUND" } });
      return;
    }

    await route.fulfill({ status: 404, json: { code: "NOT_FOUND" } });
  });
  return () => checkoutRequests;
}

async function signIn(page: Page, email = "customer@example.com") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.locator("#password").fill("password123");
  await page.getByRole("button", { name: /Sign in/ }).click();
}

test("Customer login preference stays separate from mandatory Deposit acceptance", async ({ page }) => {
  const checkoutRequestCount = await mockTermsApi(page, "CUSTOMER");

  await signIn(page);
  await expect(page).toHaveURL(/\/customer$/);
  const termsDialog = page.getByRole("dialog", { name: "Transport Terms & Important Notices" });
  await expect(termsDialog).toBeVisible();

  await page.getByRole("button", { name: "Got it" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page);
  await expect(termsDialog).toBeVisible();

  await page.getByRole("checkbox", { name: "Don't show again" }).focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Got it" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page);
  await expect(termsDialog).toHaveCount(0);

  await page.getByRole("button", { name: "View bill" }).click();
  const payDeposit = page.getByRole("button", { name: "Pay deposit" });
  await expect(payDeposit).toBeVisible();
  await payDeposit.click();

  const continueButton = page.getByRole("button", { name: "Agree & Continue to Payment" });
  await expect(continueButton).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(checkoutRequestCount()).toBe(0);

  await payDeposit.click();
  await expect(continueButton).toBeDisabled();
  await page.getByRole("checkbox", {
    name: "I have read and agree to the Transport Terms & Important Notices.",
  }).focus();
  await page.keyboard.press("Space");
  await continueButton.click();

  await expect(page).toHaveURL(/\/payment\/cancelled$/);
  expect(checkoutRequestCount()).toBe(1);
});

test("non-Customer login never shows Customer Terms", async ({ page }) => {
  await mockTermsApi(page, "LOGISTICS_MANAGER");

  await signIn(page, "manager@example.com");

  await expect(page).toHaveURL(/\/logistics$/);
  await expect(page.getByRole("dialog", { name: "Transport Terms & Important Notices" })).toHaveCount(0);
});
