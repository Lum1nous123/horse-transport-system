import { afterEach, describe, expect, it, vi } from "vitest";
import { previewTracking } from "./preview";
import { JourneyReadError, readJourneyNotifications, readJourneyTracking } from "./service";

afterEach(() => vi.unstubAllGlobals());

describe("journey read service", () => {
  it("sends the bearer token and reads tracking for the requested Order", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => previewTracking });
    vi.stubGlobal("fetch", fetchMock);
    await expect(readJourneyTracking("order-2068", "token-for-test")).resolves.toEqual(previewTracking);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/orders/order-2068/tracking"),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token-for-test" }) }),
    );
  });

  it("does not turn a server authorization denial into empty tracking", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    await expect(readJourneyTracking("another-order", "token-for-test")).rejects.toMatchObject({ status: 403 } satisfies Partial<JourneyReadError>);
  });

  it("reads Customer notifications without local fallback", async () => {
    const notices = [{ id: "n1", title: "Payment received", message: "Paid", createdAt: "2026-10-23T10:00:00Z", readAt: null }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => notices }));
    await expect(readJourneyNotifications("order-2068", "token-for-test")).resolves.toEqual(notices);
  });
});
