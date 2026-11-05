import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LogisticsTrackingPage from "./page";

const listOrders = vi.fn();
vi.mock("@/lib/logistics-tracking/service", () => ({ listLogisticsTrackingOrders: () => listOrders() }));
vi.mock("@/lib/staff-assignment/use-logistics-access", () => ({
  useLogisticsAccess: () => ({ state: "allowed", preview: false, message: "" }),
}));
vi.mock("@/lib/auth", () => ({ clearAccessToken: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

describe("Logistics Order Tracking page", () => {
  beforeEach(() => listOrders.mockReset());
  afterEach(() => cleanup());

  it("lists a delivered real order shape and links to its existing tracking route", async () => {
    listOrders.mockResolvedValue([{
      orderId: "094bef0e-7120-49dc-a1df-96dbcf3a7dae",
      orderCode: "ORD-uYWWbNGJTD64ScWyilt1uw",
      status: "DELIVERED",
      originAddress: "Origin",
      originCountry: "VN",
      destinationAddress: "Destination",
      destinationCountry: "VN",
      transportMode: "ROAD",
      requestedDepartureAt: "2026-10-10T22:57:00",
      horseCount: 1,
      createdAt: "2026-09-30T22:58:00",
      deliveredAt: "2026-10-28T22:50:00",
    }]);

    render(<LogisticsTrackingPage />);
    await waitFor(() => expect(screen.getByText("ORD-uYWWbNGJTD64ScWyilt1uw")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Order Tracking" })).toHaveAttribute("href", "/logistics/tracking");
    expect(screen.getByRole("link", { name: /View tracking/ })).toHaveAttribute(
      "href", "/logistics/orders/094bef0e-7120-49dc-a1df-96dbcf3a7dae/tracking",
    );
    expect(screen.getByText("DELIVERED")).toBeInTheDocument();
  });

  it("shows an honest empty state instead of mocked Orders", async () => {
    listOrders.mockResolvedValue([]);
    render(<LogisticsTrackingPage />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "No matching Orders" })).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: /View tracking/ })).not.toBeInTheDocument();
  });
});
