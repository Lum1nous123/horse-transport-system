import { expect, test } from "@playwright/test";

for (const emptyResponse of [false, true]) {
  test(`quotation saves 255/23 without losing edits (empty response: ${emptyResponse})`, async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem("horse-transport-token", "browser-test-token"));
    const order = { id: "order-20", orderCode: "ORD-000020", status: "SUBMITTED", originAddress: "Origin",
      destinationAddress: "Destination", transportMode: "ROAD", horseCount: 1, horseIds: ["horse-1"] };
    let saved = { id: "quote-20", orderId: "order-20", status: "DRAFT", lineItems: [] as object[],
      totalAmount: null as number | null, depositAmount: null as number | null,
      remainingAmount: null as number | null, notes: null as string | null, currency: "USD" };
    let puts = 0;
    await page.route("**/api/v1/**", async (route) => {
      const request = route.request(), path = new URL(request.url()).pathname;
      const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Accept, Content-Type", "Access-Control-Allow-Methods": "GET, PUT, OPTIONS" };
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
      if (request.method() === "PUT") {
        puts++;
        expect(request.postDataJSON()).toEqual({ depositAmount: 23, notes: "weweqwe",
          lineItems: [{ sequenceNo: 1, description: "testt", amount: 255 }] });
        expect(request.headers()["content-type"]).toBe("application/json");
        saved = emptyResponse ? { ...saved, notes: "weweqwe" } : {
          ...saved, ...request.postDataJSON(), totalAmount: 255, remainingAmount: 232 };
      }
      const body = path.endsWith("/auth/me") ? { id: "lm", role: "LOGISTICS_MANAGER", status: "ACTIVE" }
        : path.endsWith("/inbox") ? [order] : path.endsWith("/quotation") ? saved : order;
      await route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.goto("/logistics");
    await page.getByRole("button", { name: /ORD-000020/ }).click();
    await page.getByRole("button", { name: "Edit quotation" }).click();
    await page.getByRole("button", { name: /Add cost item/ }).click();
    await page.getByRole("textbox", { name: "Cost item 1 description" }).fill("testt");
    await page.getByRole("spinbutton", { name: "Cost item 1 amount in USD" }).fill("255");
    await page.getByRole("spinbutton", { name: "Deposit amount (USD)" }).fill("23");
    await page.getByRole("textbox", { name: /Notes/ }).fill("weweqwe");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    if (emptyResponse) {
      await expect(page.getByRole("alert").filter({ hasText: "Saving could not be verified" })).toBeVisible();
      await expect(page.getByRole("spinbutton", { name: "Deposit amount (USD)" })).toHaveValue("23");
      await expect(page.getByRole("textbox", { name: "Cost item 1 description" })).toHaveValue("testt");
      await expect(page.getByText("Quotation draft saved.", { exact: true })).toHaveCount(0);
    } else {
      await expect(page.getByText("Quotation draft saved.", { exact: true })).toBeVisible();
      await page.reload();
      await page.getByRole("button", { name: /ORD-000020/ }).click();
      await page.getByRole("button", { name: "Edit quotation" }).click();
      await expect(page.getByRole("spinbutton", { name: "Deposit amount (USD)" })).toHaveValue("23");
      await expect(page.getByRole("textbox", { name: "Cost item 1 description" })).toHaveValue("testt");
    }
    expect(puts).toBe(1);
  });
}
