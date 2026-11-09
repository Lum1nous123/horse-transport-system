import { describe, expect, it } from "vitest";
import { filterLogisticsInboxOrders, selectLogisticsInboxOrders, type SearchableLogisticsInboxOrder } from "./logistics-inbox-search";

const orders: SearchableLogisticsInboxOrder[] = [
  {
    orderCode: "ORD-2048",
    status: "SUBMITTED",
    originAddress: "Lexington",
    originCountry: "United States",
    destinationAddress: "Brussels",
    destinationCountry: "Belgium",
    transportMode: "COMBINED",
  },
  {
    orderCode: "ORD-2039",
    status: "SUBMITTED",
    originAddress: null,
    originCountry: "France",
    destinationAddress: "Amsterdam",
    destinationCountry: "Netherlands",
    transportMode: "ROAD",
  },
];

describe("filterLogisticsInboxOrders", () => {
  it("combines mode and search without changing the source collection", () => {
    expect(selectLogisticsInboxOrders(orders, "brussels", "COMBINED", "received-oldest")).toEqual([orders[0]]);
    expect(selectLogisticsInboxOrders(orders, "brussels", "ROAD", "received-oldest")).toEqual([]);
    expect(orders.map((order) => order.orderCode)).toEqual(["ORD-2048", "ORD-2039"]);
  });

  it.each(["received-oldest", "received-newest", "departure-earliest"] as const)("keeps missing and invalid dates last for %s", (sort) => {
    const rows = [
      { ...orders[0], orderCode: "MISSING" },
      { ...orders[0], orderCode: "NEW", createdAt: "2026-11-02", requestedDepartureAt: "2026-11-02" },
      { ...orders[0], orderCode: "INVALID", createdAt: "invalid", requestedDepartureAt: "invalid" },
      { ...orders[0], orderCode: "OLD", createdAt: "2026-11-01", requestedDepartureAt: "2026-11-01" },
    ];
    expect(selectLogisticsInboxOrders(rows, "", "ALL", sort).map((order) => order.orderCode))
      .toEqual([...(sort === "received-newest" ? ["NEW", "OLD"] : ["OLD", "NEW"]), "INVALID", "MISSING"]);
    expect(rows[0].orderCode).toBe("MISSING");
  });
  it("returns all loaded rows for a blank query", () => {
    expect(filterLogisticsInboxOrders(orders, "  ")).toBe(orders);
  });

  it.each([
    ["2048", "ORD-2048"],
    ["brussels", "ORD-2048"],
    ["france", "ORD-2039"],
    ["road", "ORD-2039"],
  ])("matches %s against real inbox fields", (query, orderCode) => {
    expect(filterLogisticsInboxOrders(orders, query).map((order) => order.orderCode)).toEqual([orderCode]);
  });

  it("returns an empty collection when no loaded row matches", () => {
    expect(filterLogisticsInboxOrders(orders, "recipient name unavailable in inbox")).toEqual([]);
  });
});
