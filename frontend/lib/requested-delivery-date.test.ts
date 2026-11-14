import { describe, expect, it } from "vitest";
import { compareRequestedDeliveryDates, formatRequestedDeliveryDate, isUpcomingRequestedDeliveryDate, localTodayDate } from "./requested-delivery-date";

describe("desired delivery date", () => {
  it("keeps a calendar date unchanged and never infers one from a legacy timestamp", () => {
    expect(formatRequestedDeliveryDate("2026-11-25")).toBe("2026-11-25");
    expect(formatRequestedDeliveryDate(null)).toBe("Not provided");
    expect(formatRequestedDeliveryDate("2026-11-25T00:00:00Z")).toBe("Not provided");
  });

  it("sorts missing dates last and uses ID as a stable tie breaker", () => {
    expect(compareRequestedDeliveryDates("2026-11-25", "2026-11-24", "b", "a")).toBeGreaterThan(0);
    expect(compareRequestedDeliveryDates(null, "2026-11-24", "a", "b")).toBeGreaterThan(0);
    expect(compareRequestedDeliveryDates(null, "2026-11-24", "a", "b", true)).toBeGreaterThan(0);
    expect(compareRequestedDeliveryDates("2026-11-25", "2026-11-25", "a", "b")).toBeLessThan(0);
  });

  it("includes today using local calendar components", () => {
    expect(localTodayDate(new Date(2026, 10, 14, 23, 59))).toBe("2026-11-14");
    expect(isUpcomingRequestedDeliveryDate("2026-11-14", "2026-11-14")).toBe(true);
    expect(isUpcomingRequestedDeliveryDate("2026-11-13", "2026-11-14")).toBe(false);
    expect(isUpcomingRequestedDeliveryDate(null, "2026-11-14")).toBe(false);
  });
});
