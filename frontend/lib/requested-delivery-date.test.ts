import { afterEach, describe, expect, it } from "vitest";
import { compareDeliveryDates, formatDeliveryDate, selectUpcomingDesiredDeliveries } from "./requested-delivery-date";

const originalZone = process.env.TZ;
afterEach(() => { if (originalZone === undefined) delete process.env.TZ; else process.env.TZ = originalZone; });

describe("desired delivery calendar dates", () => {
  it.each(["America/Los_Angeles", "Asia/Ho_Chi_Minh", "Pacific/Kiritimati"])("displays the same day in %s", (zone) => {
    process.env.TZ = zone;
    expect(formatDeliveryDate("2026-11-25")).toBe("25 Nov 2026");
  });

  it.each([null, undefined, "", "2026-02-30", "2026-11-25T15:00:00"])("handles absent or invalid value %s without a legacy fallback", (value) => {
    expect(formatDeliveryDate(value)).toBe("Not provided");
  });

  it("keeps missing dates last in both sort directions", () => {
    const dates = [null, "2026-11-26", "2026-11-25"];
    expect(dates.toSorted((a, b) => compareDeliveryDates(a, b))).toEqual(["2026-11-25", "2026-11-26", null]);
    expect(dates.toSorted((a, b) => compareDeliveryDates(a, b, true))).toEqual(["2026-11-26", "2026-11-25", null]);
  });

  it("includes today even late in the day and uses a stable identity tie breaker", () => {
    const rows = [
      { orderId: "b", requestedDeliveryDate: "2026-11-25" },
      { orderId: "missing", requestedDeliveryDate: null },
      { orderId: "tomorrow", requestedDeliveryDate: "2026-11-26" },
      { orderId: "yesterday", requestedDeliveryDate: "2026-11-24" },
      { orderId: "a", requestedDeliveryDate: "2026-11-25" },
    ];
    expect(selectUpcomingDesiredDeliveries(rows, new Date(2026, 10, 25, 23, 59).getTime()).map((r) => r.orderId))
      .toEqual(["a", "b", "tomorrow"]);
  });
});
