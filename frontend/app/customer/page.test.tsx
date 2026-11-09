import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";
import { apiFetch } from "@/lib/api";

const auth = vi.hoisted(() => ({ role: "CUSTOMER", router: { replace: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => auth.router }));
vi.mock("@/lib/auth", () => ({
  getAccessToken: () => "test-token", clearAccessToken: vi.fn(),
  getCurrentUser: async () => ({ role: auth.role }),
}));
vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

const statuses = ["DRAFT", "SUBMITTED", "QUOTATION_SENT", "APPROVED", "READY_TO_SHIP", "IN_PROGRESS", "DELIVERED", "REJECTED", "CANCELLED"];
const orders = statuses.map((status) => ({
  id: status, orderCode: "ORD-" + status, status, horseIds: [], originAddress: "Paris",
  destinationAddress: status === "IN_PROGRESS" ? "Brussels" : "Amsterdam", transportMode: "ROAD",
}));

describe("Customer request groups and contextual actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auth.role = "CUSTOMER";
    window.history.replaceState(null, "", "/customer");
    vi.mocked(apiFetch).mockImplementation(async (path) => {
      if (path === "/api/v1/orders") return Response.json(orders);
      if (path === "/api/v1/horses") return Response.json([]);
      if (String(path).endsWith("/remaining-balance")) return Response.json({ paymentStatus: "PAID", checkoutEligible: false });
      throw new Error("Unexpected request " + path);
    });
  });

  it("defaults to active, exposes real group counts and resets exact status when switching groups", async () => {
    const user = userEvent.setup();
    render(<Page />);
    expect(await screen.findByRole("button", { name: "Active 5" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("ORD-DELIVERED")).not.toBeInTheDocument();
    expect(screen.getByText("ORD-SUBMITTED")).toBeVisible();
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter transport requests by status" }), "IN_PROGRESS");
    expect(screen.queryByText("ORD-SUBMITTED")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "History 3" }));
    expect(screen.getByText("ORD-DELIVERED")).toBeVisible();
    expect(screen.getByText("ORD-REJECTED")).toBeVisible();
    expect(screen.getByText("ORD-CANCELLED")).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Filter transport requests by status" })).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Drafts 1" }));
    expect(screen.getByRole("button", { name: "Edit draft" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "All 9" }));
    expect(document.querySelectorAll(".customer-order-row")).toHaveLength(9);
    expect(screen.queryByText("Editing locked")).not.toBeInTheDocument();
  });

  it("combines group and search, keeps counts independent, and clears filters within the group", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await screen.findByRole("button", { name: "Active 5" });
    await user.type(screen.getByRole("searchbox"), "Brussels");
    expect(document.querySelectorAll(".customer-order-row")).toHaveLength(1);
    expect(screen.getByText("Showing 1 of 5 requests in this group · 9 total loaded")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "History 3" }));
    expect(screen.getByText("No matching requests")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(document.querySelectorAll(".customer-order-row")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "History 3" })).toHaveAttribute("aria-pressed", "true");
  });

  it("prioritizes tracking, discloses secondary actions and preserves payment URLs without duplicates", async () => {
    const user = userEvent.setup();
    render(<Page />);
    const row = (await screen.findByText("ORD-IN_PROGRESS")).closest("article")!;
    expect(within(row).getByRole("link", { name: "Track journey" })).toHaveAttribute("href", "/customer/orders/IN_PROGRESS/tracking");
    expect(within(row).getByText("More actions", { exact: false })).toBeVisible();
    expect(row.querySelector("details")).not.toHaveAttribute("open");
    await user.click(within(row).getByText("More actions", { exact: false }));
    expect(within(row).getByRole("link", { name: "View payment" })).toHaveAttribute("href", "/customer/orders/IN_PROGRESS/remaining-balance");
    expect(within(row).getByRole("button", { name: "Manage documents" })).toBeVisible();
    await user.keyboard("{Escape}");
    expect(row.querySelector("details")).not.toHaveAttribute("open");
    const approved = screen.getByText("ORD-APPROVED").closest("article")!;
    await user.click(within(approved).getByText("More actions", { exact: false }));
    expect(within(approved).getAllByRole("link", { name: "View payment" })).toHaveLength(1);
    expect(vi.mocked(apiFetch).mock.calls.every(([, init]) => !init?.method)).toBe(true);
  });

  it("retains role authorization", async () => {
    auth.role = "LOGISTICS_MANAGER";
    render(<Page />);
    await vi.waitFor(() => expect(auth.router.replace).toHaveBeenCalledWith("/logistics"));
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
