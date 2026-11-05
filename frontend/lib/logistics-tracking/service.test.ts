import { beforeEach, describe, expect, it, vi } from "vitest";
import { listLogisticsTrackingOrders, TrackingOrderListError } from "./service";

vi.mock("@/lib/auth", () => ({ getAccessToken: () => "token", clearAccessToken: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));
import { apiFetch } from "@/lib/api";

describe("Logistics tracking order list", () => {
  beforeEach(() => vi.mocked(apiFetch).mockReset());
  it("reads the dedicated authenticated LM index", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(JSON.stringify([{ orderId: "id", orderCode: "ORD-1", status: "DELIVERED" }]), { status: 200 }));
    await expect(listLogisticsTrackingOrders()).resolves.toEqual([{ orderId: "id", orderCode: "ORD-1", status: "DELIVERED" }]);
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/lm/tracking-orders", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token" }) }));
  });
  it("reports forbidden access without exposing another customer's list", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 403 }));
    await expect(listLogisticsTrackingOrders()).rejects.toEqual(expect.objectContaining<Partial<TrackingOrderListError>>({ status: 403 }));
  });
});
