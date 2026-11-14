import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssignmentOrderSummary } from "@/lib/staff-assignment/types";
import Page from "./page";

const mocks = vi.hoisted(() => ({
  access: { state: "allowed", preview: false, message: "" }, listOrders: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/lib/staff-assignment/use-logistics-access", () => ({ useLogisticsAccess: () => mocks.access }));
vi.mock("@/lib/staff-assignment/service", () => ({ getStaffAssignmentService: () => mocks }));
const order = (id: string, desiredDeliveryDate: string, destination: string): AssignmentOrderSummary => ({
  id, orderCode: "ORD-" + id, origin: "Long origin address", destination,
  requestedDeliveryDate: desiredDeliveryDate, transportMode: "COMBINED", horseCount: 5, assignmentStatus: "NEEDS_ASSIGNMENT",
});

describe("LM assignment management table", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.access = { state: "allowed", preview: false, message: "" };
    mocks.listOrders.mockResolvedValue({
      needsAssignment: [order("late", "2026-11-10", "Airport"), order("early", "2026-11-08", "Stable")],
      assigned: [{ ...order("saved", "2026-11-09", "Paris"), assignmentStatus: "ASSIGNED" }],
    });
  });

  it("defaults to one full-width Needs assignment table with actual counts and prominent actions", async () => {
    render(<Page />);
    const table = await screen.findByRole("table", { name: "Orders needing staff assignment" });
    expect(screen.getAllByRole("table")).toHaveLength(1);
    expect(screen.getByRole("tab", { name: "Needs assignment 2" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Assigned 1" })).toHaveAttribute("aria-selected", "false");
    expect(within(table).getAllByRole("columnheader").map((node) => node.textContent)).toEqual(["Order", "Route", "Desired delivery date", "Horses / Mode", "Action"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("ORD-early");
    expect(within(rows[0]).getByRole("link", { name: /Assign staff/ })).toHaveClass("customer-primary-button");
    expect(within(table).queryByText("Needs assignment")).not.toBeInTheDocument();
  });

  it("searches by route, sorts desired delivery date and switches to saved-pair actions without another API call", async () => {
    render(<Page />);
    await screen.findByRole("table");
    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole("combobox", { name: "Desired delivery date" }), "latest");
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("ORD-late");
    await user.type(screen.getByRole("searchbox", { name: "Search assignment orders" }), "Stable");
    expect(screen.queryByText("ORD-late")).not.toBeInTheDocument();
    expect(screen.getByText("ORD-early")).toBeVisible();
    await user.clear(screen.getByRole("searchbox"));
    await user.click(screen.getByRole("tab", { name: "Assigned 1" }));
    expect(await screen.findByRole("link", { name: "View assignment for ORD-saved" })).not.toHaveClass("customer-primary-button");
    expect(screen.queryByRole("link", { name: /Assign staff/ })).not.toBeInTheDocument();
    expect(mocks.listOrders).toHaveBeenCalledOnce();
  });

  it("supports arrow-key tab selection", async () => {
    render(<Page />);
    await screen.findByRole("table");
    const first = screen.getByRole("tab", { name: "Needs assignment 2" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Assigned 1" })).toHaveFocus();
    expect(screen.getByRole("table", { name: "Assigned orders" })).toBeVisible();
  });

  it("does not claim zero counts or queue clear when loading fails", async () => {
    mocks.listOrders.mockRejectedValue(new Error("Network unavailable"));
    render(<Page />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Network unavailable");
    expect(screen.getByRole("tab", { name: "Needs assignment —" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "No orders need assignment" })).not.toBeInTheDocument();
    mocks.listOrders.mockResolvedValue({ needsAssignment: [], assigned: [] });
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "No orders need assignment" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Needs assignment 0" })).toBeVisible();
  });
});
