import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import JourneyTrackingView from "./JourneyTrackingView";
import { JourneyReadError } from "@/lib/journey-tracking/service";
import type { JourneyTracking } from "@/lib/journey-tracking/types";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  readTracking: vi.fn(),
  readNotifications: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ orderId: "order-1" }),
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/auth", () => ({
  clearAccessToken: vi.fn(),
  getAccessToken: () => "token",
  getCurrentUser: () => Promise.resolve({ role: "CUSTOMER", status: "ACTIVE" }),
}));
vi.mock("@/lib/journey-tracking/service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/journey-tracking/service")>();
  return {
    ...original,
    readJourneyTracking: (...args: unknown[]) => mocks.readTracking(...args),
    readJourneyNotifications: (...args: unknown[]) => mocks.readNotifications(...args),
  };
});

const tracking: JourneyTracking = {
  orderId: "order-1",
  orderCode: "ORD-1",
  orderStatus: "IN_PROGRESS",
  origin: "Hanoi",
  destination: "Da Nang",
  updatedAt: null,
  legs: [],
  deliveryEvents: [],
};

describe("JourneyTrackingView loading", () => {
  beforeEach(() => {
    mocks.replace.mockReset();
    mocks.readTracking.mockReset();
    mocks.readNotifications.mockReset();
  });
  afterEach(() => cleanup());

  it("renders journey data with a non-blocking warning when notifications fail", async () => {
    mocks.readTracking.mockResolvedValue(tracking);
    mocks.readNotifications.mockRejectedValue(new JourneyReadError("Notifications unavailable", 503));

    render(<JourneyTrackingView role="CUSTOMER" />);

    expect(await screen.findByRole("heading", { name: "Journey tracking" })).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.tagName === "P"
      && element.textContent === "Hanoi → Da Nang")).toBeInTheDocument();
    expect(screen.getByText("Latest updates are temporarily unavailable. Journey tracking is still available."))
      .toHaveAttribute("role", "status");
    expect(screen.queryByRole("heading", { name: "Journey unavailable" })).not.toBeInTheDocument();
  });

  it("keeps a journey API failure as the primary full-page error", async () => {
    mocks.readTracking.mockRejectedValue(new JourneyReadError("Journey service unavailable", 503));

    render(<JourneyTrackingView role="CUSTOMER" />);

    expect(await screen.findByRole("heading", { name: "Journey unavailable" })).toBeInTheDocument();
    expect(screen.getByText("Journey service unavailable")).toBeInTheDocument();
    await waitFor(() => expect(mocks.readNotifications).not.toHaveBeenCalled());
  });
});
