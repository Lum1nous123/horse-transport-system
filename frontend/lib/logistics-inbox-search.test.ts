import { describe, expect, it } from "vitest";
import { filterLogisticsInboxOrders, type SearchableLogisticsInboxOrder } from "./logistics-inbox-search";

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
