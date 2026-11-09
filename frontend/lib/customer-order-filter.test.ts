import { describe, expect, it } from "vitest";
import { filterCustomerOrders, customerOrdersInGroup, type CustomerOrderFilterRecord } from "./customer-order-filter";

const orders: CustomerOrderFilterRecord[] = [
  {
    orderCode: "ORD-2068",
    originAddress: "Lexington, United States",
    destinationAddress: "Brussels, Belgium",
    transportMode: "COMBINED",
    recipientName: "Taylor Morgan",
    status: "IN_PROGRESS",
  },
  {
    orderCode: "ORD-2061",
    originCountry: "France",
    destinationCountry: "Netherlands",
    transportMode: "ROAD",
    recipientName: "Camille Laurent",
    status: "DRAFT",
  },
];

describe("filterCustomerOrders", () => {
  it("uses display groups without changing backend statuses or dropping unknown statuses from All", () => {
    const rows = ["DRAFT", "SUBMITTED", "QUOTATION_SENT", "APPROVED", "READY_TO_SHIP", "IN_PROGRESS", "DELIVERED", "REJECTED", "CANCELLED", "FUTURE"].map((status) => ({ ...orders[0], status }));
    expect(customerOrdersInGroup(rows, "active").map((row) => row.status)).toEqual(["SUBMITTED", "QUOTATION_SENT", "APPROVED", "READY_TO_SHIP", "IN_PROGRESS", "REJECTED"]);
    expect(customerOrdersInGroup(rows, "history").map((row) => row.status)).toEqual(["DELIVERED", "CANCELLED"]);
    expect(customerOrdersInGroup(rows, "drafts").map((row) => row.status)).toEqual(["DRAFT"]);
    expect(customerOrdersInGroup(rows, "all")).toBe(rows);
  });
  it("returns all orders when no filters are applied", () => {
    expect(filterCustomerOrders(orders, "", "")).toEqual(orders);
  });

  it("searches only fields present in the loaded order data", () => {
    expect(filterCustomerOrders(orders, "brussels", "")).toEqual([orders[0]]);
    expect(filterCustomerOrders(orders, "camille", "")).toEqual([orders[1]]);
  });

  it("combines search and exact status filtering", () => {
    expect(filterCustomerOrders(orders, "road", "DRAFT")).toEqual([orders[1]]);
    expect(filterCustomerOrders(orders, "road", "IN_PROGRESS")).toEqual([]);
  });
});
