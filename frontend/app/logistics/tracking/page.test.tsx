import userEvent from "@testing-library/user-event";
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
      requestedDeliveryDate: "2026-10-10",
      horseCount: 1,
      createdAt: "2026-09-30T22:58:00",
      deliveredAt: "2026-10-28T22:50:00",
    }]);

    render(<LogisticsTrackingPage />);
    await userEvent.setup().click(await screen.findByRole("tab", { name: /Delivered 1/ }));
    expect(screen.getByRole("link", { name: "Journey tracking" })).toHaveAttribute("href", "/logistics/tracking");
    expect(screen.getByRole("link", { name: "Journey tracking" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Orders & quotations" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: /View tracking/ })).toHaveAttribute(
      "href", "/logistics/orders/094bef0e-7120-49dc-a1df-96dbcf3a7dae/tracking",
    );
    expect(screen.getByText("DELIVERED")).toBeInTheDocument();
  });

  it("groups actual statuses and combines route search, mode and status filters", async () => {
    const base = { originAddress: "Origin", originCountry: "VN", destinationAddress: "Airport", destinationCountry: "VN",
      requestedDeliveryDate: "2026-11-10", horseCount: 2, createdAt: "2026-11-01T09:00:00Z", deliveredAt: null };
    listOrders.mockResolvedValue([
      { ...base, orderId: "ready", orderCode: "ORD-ready", status: "READY_TO_SHIP", transportMode: "ROAD" },
      { ...base, orderId: "active", orderCode: "ORD-active", status: "IN_PROGRESS", transportMode: "AIR" },
      { ...base, orderId: "delivered", orderCode: "ORD-delivered", status: "DELIVERED", transportMode: "ROAD" },
      { ...base, orderId: "approved", orderCode: "ORD-approved", status: "APPROVED", transportMode: "COMBINED" },
    ]);
    render(<LogisticsTrackingPage />);
    const user = userEvent.setup();
    await screen.findByRole("tab", { name: "Active 2" });
    expect(screen.getByText("ORD-ready")).toBeVisible();
    expect(screen.getByText("ORD-active")).toBeVisible();
    expect(screen.queryByText("ORD-approved")).not.toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "Search journeys" }), "Airport");
    await user.selectOptions(screen.getByRole("combobox", { name: "Mode" }), "AIR");
    expect(screen.queryByText("ORD-ready")).not.toBeInTheDocument();
    expect(screen.getByText("IN PROGRESS")).toBeVisible();
    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "READY_TO_SHIP");
    expect(screen.getByRole("heading", { name: "No matching journeys" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await user.click(screen.getByRole("tab", { name: "Other trackable 1" }));
    expect(screen.getByText("ORD-approved")).toBeVisible();
    expect(screen.getByText("APPROVED")).toBeVisible();
    expect(screen.queryByRole("combobox", { name: "Status" })).not.toBeInTheDocument();
    expect(listOrders).toHaveBeenCalledOnce();
  });

  it("keeps failed initial reads distinct from an empty tracking dataset", async () => {
    listOrders.mockRejectedValue(new Error("Tracking unavailable"));
    render(<LogisticsTrackingPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Tracking unavailable");
    expect(screen.getByRole("tab", { name: "Active —" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "No active journeys" })).not.toBeInTheDocument();
    listOrders.mockResolvedValue([]);
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "No active journeys" })).toBeVisible();
  });

  it("shows an honest empty state instead of mocked Orders", async () => {
    listOrders.mockResolvedValue([]);
    render(<LogisticsTrackingPage />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "No active journeys" })).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: /View tracking/ })).not.toBeInTheDocument();
  });
});
