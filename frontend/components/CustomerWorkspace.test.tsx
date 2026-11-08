import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CustomerWorkspace from "./CustomerWorkspace";

const mocks = vi.hoisted(() => {
  const replace = vi.fn();
  return {
    apiFetch: vi.fn(),
    clearAccessToken: vi.fn(),
    getAccessToken: vi.fn(),
    getCurrentUser: vi.fn(),
    replace,
    router: { replace },
  };
});

vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/lib/auth", () => ({
  clearAccessToken: mocks.clearAccessToken,
  getAccessToken: mocks.getAccessToken,
  getCurrentUser: mocks.getCurrentUser,
}));
vi.mock("@/lib/api", () => ({ apiFetch: mocks.apiFetch }));

const horses = [
  { id: "horse-1", name: "Willow", microchipId: "MC-001", breed: "Warmblood", sex: "MARE", passportNumber: "P-001", dateOfBirth: "2018-03-14" },
  { id: "horse-2", name: "Apollo", microchipId: "MC-002", breed: "Thoroughbred", sex: "GELDING", passportNumber: "P-002", dateOfBirth: "2017-06-02" },
];

const orders = [
  { id: "order-1", orderCode: "ORD-001", originCountry: "France", destinationCountry: "Belgium", requestedDepartureAt: "2026-11-10T09:00:00", transportMode: "ROAD", recipientName: "Taylor", recipientPhone: "+32 1", horseIds: ["horse-1"], status: "DRAFT" },
  { id: "order-2", orderCode: "ORD-002", originCountry: "Germany", destinationCountry: "Netherlands", requestedDepartureAt: "2026-12-01T10:00:00", transportMode: "AIR", recipientName: "Morgan", recipientPhone: "+31 2", horseIds: ["horse-2"], status: "SUBMITTED" },
  { id: "order-3", orderCode: "ORD-003", originCountry: "Ireland", destinationCountry: "France", requestedDepartureAt: "2026-12-15T08:00:00", transportMode: "ROAD", recipientName: "Alex", recipientPhone: "+33 3", horseIds: ["horse-1"], status: "REJECTED", rejectionReason: "The delivery contact details are incomplete." },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("Customer dedicated workspaces", () => {
  beforeEach(() => {
    mocks.getAccessToken.mockReturnValue("customer-token");
    mocks.getCurrentUser.mockResolvedValue({ role: "CUSTOMER", status: "ACTIVE" });
    mocks.apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (path === "/api/v1/horses" && init?.method === "POST") return Promise.resolve(new Response(null, { status: 204 }));
      if (path.startsWith("/api/v1/horses/") && init?.method === "DELETE") return Promise.resolve(new Response(null, { status: 204 }));
      if (path === "/api/v1/horses") return Promise.resolve(jsonResponse(horses));
      if (path === "/api/v1/orders") return Promise.resolve(jsonResponse(orders));
      return Promise.resolve(new Response(null, { status: 204 }));
    });
  });

  it("loads real request data and keeps search and status filtering on the official route", async () => {
    const user = userEvent.setup();
    render(<CustomerWorkspace view="requests" />);

    expect(await screen.findByText("ORD-001")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Transport requests" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Horse profiles" })).not.toBeInTheDocument();
    expect(mocks.apiFetch).toHaveBeenCalledWith("/api/v1/orders", expect.anything());

    await user.type(screen.getByRole("searchbox", { name: "Search transport requests" }), "Germany");
    expect(screen.queryByText("ORD-001")).not.toBeInTheDocument();
    expect(screen.getByText("ORD-002")).toBeVisible();

    await user.clear(screen.getByRole("searchbox", { name: "Search transport requests" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter transport requests by status" }), "DRAFT");
    expect(screen.getByText("ORD-001")).toBeVisible();
    expect(screen.queryByText("ORD-002")).not.toBeInTheDocument();
  });

  it("loads real horse data and supports name search, sex filtering, sorting, and the existing create API", async () => {
    const user = userEvent.setup();
    render(<CustomerWorkspace view="horses" />);

    const list = await screen.findByRole("region", { name: "Saved horse profiles" });
    expect(within(list).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["Apollo", "Willow"]);

    await user.selectOptions(screen.getByRole("combobox", { name: "Sort horse profiles" }), "name-desc");
    expect(within(list).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["Willow", "Apollo"]);

    await user.selectOptions(screen.getByRole("combobox", { name: "Filter horse profiles by sex" }), "GELDING");
    expect(screen.getByText("Apollo")).toBeVisible();
    expect(screen.queryByText("Willow")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Filter horse profiles by sex" }), "");
    await user.type(screen.getByRole("searchbox", { name: "Search horse profiles by name" }), "Will");
    expect(screen.getByText("Willow")).toBeVisible();
    expect(screen.queryByText("Apollo")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add horse" }));
    await user.type(screen.getByRole("textbox", { name: "Horse name" }), "Comet");
    await user.type(screen.getByRole("textbox", { name: "Microchip ID" }), "MC-003");
    await user.click(screen.getByRole("button", { name: "Save horse profile" }));

    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/api/v1/horses",
      expect.objectContaining({ method: "POST" }),
    ));
  });

  it("keeps the dashboard header minimal and provides a searchable horse summary", async () => {
    const user = userEvent.setup();
    render(<CustomerWorkspace />);

    await screen.findByText("ORD-001");
    expect(screen.getByRole("link", { name: "Customer home workspace" })).toHaveTextContent("Horse Transport System");
    expect(screen.queryByRole("link", { name: "Transport requests" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Horse profiles" })).not.toBeInTheDocument();

    const panel = screen.getByRole("region", { name: "Horse profiles" });
    await user.click(within(panel).getByRole("button", { name: "Add horse" }));
    expect(within(panel).getByRole("heading", { name: "New horse profile" })).toBeVisible();
    expect(within(panel).getByRole("button", { name: "Close" })).toHaveAttribute("aria-expanded", "true");
    expect(within(panel).getByText("Female")).toBeVisible();
    expect(within(panel).getByText("Male")).toBeVisible();
    expect(within(panel).getAllByText(/years$/)).toHaveLength(2);

    await user.type(within(panel).getByRole("searchbox", { name: "Search horse profiles" }), "Will");
    expect(within(panel).getByText("Willow")).toBeVisible();
    expect(within(panel).queryByText("Apollo")).not.toBeInTheDocument();

    await user.clear(within(panel).getByRole("searchbox", { name: "Search horse profiles" }));
    await user.click(within(panel).getByRole("button", { name: "Delete Apollo" }));
    const deleteDialog = screen.getByRole("alertdialog", { name: "Delete Apollo?" });
    await user.click(within(deleteDialog).getByRole("button", { name: "Delete horse" }));
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith("/api/v1/horses/horse-2", expect.objectContaining({ method: "DELETE" })));
    await waitFor(() => expect(within(panel).queryByText("Apollo")).not.toBeInTheDocument());
  });

  it("shows a full-width rejection alert without placing a new-request CTA inside the rejected order", async () => {
    const user = userEvent.setup();
    render(<CustomerWorkspace />);

    const rejectedCode = await screen.findByText("ORD-003");
    const rejectedOrder = rejectedCode.closest("article");
    expect(rejectedOrder).not.toBeNull();
    const rejected = within(rejectedOrder as HTMLElement);

    expect(rejected.getByText("REJECTED")).toBeVisible();
    expect(rejected.getByRole("heading", { name: "Transport request rejected" })).toBeVisible();
    expect(rejected.getByRole("region", { name: "Transport request rejection details" })).toHaveTextContent("Reason: The delivery contact details are incomplete.");
    expect(rejected.getByText(/cannot be edited or resubmitted/)).toBeVisible();
    expect(rejected.queryByRole("button", { name: "Edit draft" })).not.toBeInTheDocument();
    expect(rejected.queryByRole("button", { name: "New transport request" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New transport request" }));
    expect(screen.getByRole("dialog", { name: "Plan a transport" })).toBeVisible();
    expect(screen.getByText("Save details as a draft. You can edit the request until it is submitted.")).toBeVisible();
  });

  it("shows the same rejection guidance on the dedicated requests page", async () => {
    render(<CustomerWorkspace view="requests" />);

    const rejectedCode = await screen.findByText("ORD-003");
    const rejectedOrder = rejectedCode.closest("article");
    expect(rejectedOrder).not.toBeNull();
    const rejected = within(rejectedOrder as HTMLElement);

    expect(rejected.getByRole("region", { name: "Transport request rejection details" })).toHaveTextContent("Reason: The delivery contact details are incomplete.");
    expect(rejected.queryByRole("button", { name: "New transport request" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New transport request" })).toBeVisible();
  });
});
