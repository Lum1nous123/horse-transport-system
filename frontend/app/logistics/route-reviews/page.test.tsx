import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { lockedFixture, reviewFixture } from "@/tests/lm-phase0-fixtures";
import Page from "./page";

const mocks = vi.hoisted(() => ({
  access: { state: "allowed", preview: false, message: "" }, listReviews: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/lib/staff-assignment/use-logistics-access", () => ({ useLogisticsAccess: () => mocks.access }));
vi.mock("@/lib/logistics-route-review/service", () => ({ getLogisticsRouteReviewService: () => mocks }));

describe("LM history availability", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.access = { state: "allowed", preview: false, message: "" };
    mocks.listReviews.mockResolvedValue({ pending: [reviewFixture()], locked: [] });
  });
  it("labels real history unavailable instead of showing an empty locked archive", async () => {
    render(<Page />);
    expect(await screen.findByText(/Historical locked and returned reviews are unavailable/)).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Locked results" })).not.toBeInTheDocument();
  });
  it("labels the preview-only history explicitly", async () => {
    mocks.access.preview = true;
    mocks.listReviews.mockResolvedValue({ pending: [reviewFixture()], locked: [lockedFixture()] });
    render(<Page />);
    await userEvent.setup().click(await screen.findByText("Development preview fixtures"));
    expect(screen.getByRole("heading", { name: "Locked results (preview only)" })).toBeVisible();
  });
  it("uses the compact decision table without redundant mode and horse columns", async () => {
    render(<Page />);
    const table = await screen.findByRole("table", { name: "Pending route reviews" });
    expect(table.querySelectorAll("th").length).toBe(6);
    expect(screen.queryByRole("columnheader", { name: "Horses" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Mode" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review ORD-1" })).toHaveAttribute("href", "/logistics/route-reviews/order-1");
    await userEvent.setup().type(screen.getByRole("searchbox", { name: "Search pending reviews" }), "no-match");
    expect(screen.getByRole("heading", { name: "No matching reviews" })).toBeVisible();
  });

  it("distinguishes empty real inbox from unavailable history", async () => {
    mocks.listReviews.mockResolvedValue({ pending: [], locked: [] });
    render(<Page />);
    expect(await screen.findByRole("heading", { name: "No pending Route Plans" })).toBeVisible();
    expect(screen.getByText(/Locked and returned review history is not available/)).toBeVisible();
  });
});
