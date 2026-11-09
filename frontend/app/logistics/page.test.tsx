import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";
import { apiFetch } from "@/lib/api";

const auth = vi.hoisted(() => ({ router: { replace: vi.fn() }, role: "LOGISTICS_MANAGER" }));
vi.mock("next/navigation", () => ({ useRouter: () => auth.router }));
vi.mock("@/lib/auth", () => ({
  getAccessToken: () => "test-token", clearAccessToken: vi.fn(),
  getCurrentUser: async () => ({ role: auth.role }),
}));
vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

const order = { id: "order-1", orderCode: "ORD-1", status: "SUBMITTED", originAddress: "Origin",
  originCountry: null, destinationAddress: "Destination", destinationCountry: null,
  transportMode: "ROAD", requestedDepartureAt: "2026-11-07T09:00:00Z", horseCount: 1,
  createdAt: "2026-11-06T09:00:00Z", horseIds: ["horse-1"], specialRequirements: "Exact customer note",
  recipientName: "Real recipient", recipientPhone: "123", recipientEmail: null };
const draft = { id: "quote-1", orderId: "order-1", status: "DRAFT", totalAmount: null,
  depositAmount: null, remainingAmount: null, currency: "USD", notes: null, sentAt: null, lineItems: [] };

describe("LM quotation read recovery", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auth.role = "LOGISTICS_MANAGER";
    window.history.replaceState(null, "", "/logistics");
  });

  function requests(quoteRead: () => Response) {
    vi.mocked(apiFetch).mockImplementation(async (path, init) => {
      if (String(path).includes("/inbox")) return Response.json([order]);
      if (path === "/api/v1/orders/order-1") return Response.json(order);
      if (String(path).endsWith("/quotation") && !init?.method) return quoteRead();
      throw new Error("Unexpected mutation/request: " + String(path));
    });
  }

  it("retries only the quotation GET and never displays Not started for a failed read", async () => {
    let reads = 0;
    requests(() => ++reads < 3 ? Response.json({ message: "Quotation unavailable" }, { status: 500 }) : Response.json(draft));
    const user = userEvent.setup();
    render(<Page />);
    await user.click(await screen.findByRole("button", { name: /ORD-1/ }));
    await screen.findByRole("button", { name: "Retry quotation read" });
    expect(screen.queryByText("Not started")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Prepare quotation" })).not.toBeInTheDocument();
    expect(screen.getByText("Exact customer note")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Retry quotation read" }));
    await screen.findByRole("button", { name: "Retry quotation read" });
    await user.click(screen.getByRole("button", { name: "Retry quotation read" }));
    expect(await screen.findByRole("button", { name: "Edit quotation" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save draft" })).not.toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledTimes(5); // inbox, detail, three quote reads
    expect(vi.mocked(apiFetch).mock.calls.every(([, init]) => !init?.method)).toBe(true);
  });

  it("filters and sorts the loaded inbox while preserving open quotation edits", async () => {
    requests(() => Response.json(draft));
    const user = userEvent.setup();
    render(<Page />);
    await user.click(await screen.findByRole("button", { name: /ORD-1/ }));
    await user.click(await screen.findByRole("button", { name: "Edit quotation" }));
    await user.type(screen.getByRole("textbox", { name: /Notes/ }), "Unsaved quotation note");
    await user.selectOptions(screen.getByLabelText("Mode", { exact: true }), "AIR");
    expect(screen.getByText("No matching orders")).toBeVisible();
    expect(screen.getByText(/The open order is outside your current filters/)).toBeVisible();
    expect(screen.getByRole("textbox", { name: /Notes/ })).toHaveValue("Unsaved quotation note");
    expect(screen.getByText("Showing 0 of 1 loaded order")).toBeVisible();
    await user.click(screen.getAllByRole("button", { name: "Clear filters" })[0]);
    expect(screen.getByRole("button", { name: /ORD-1/ })).toHaveAttribute("aria-current", "true");
    await user.selectOptions(screen.getByLabelText("Sort by"), "departure-earliest");
    expect(screen.getByRole("textbox", { name: /Notes/ })).toHaveValue("Unsaved quotation note");
    expect(vi.mocked(apiFetch).mock.calls.every(([, init]) => !init?.method)).toBe(true);
  });

  it("permits preparation only after a genuine quotation-not-found response", async () => {
    requests(() => Response.json({ code: "QUOTATION_NOT_FOUND" }, { status: 404 }));
    const user = userEvent.setup();
    render(<Page />);
    await user.click(await screen.findByRole("button", { name: /ORD-1/ }));
    expect(await screen.findByRole("button", { name: "Prepare quotation" })).toBeEnabled();
    expect(screen.getByText("Not started")).toBeVisible();
  });

  it("retains draft send validation and does not POST when line items are empty", async () => {
    requests(() => Response.json(draft));
    const user = userEvent.setup();
    render(<Page />);
    await user.click(await screen.findByRole("button", { name: /ORD-1/ }));
    await user.click(await screen.findByRole("button", { name: "Edit quotation" }));
    await user.click(screen.getByRole("button", { name: "Send quotation" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Total amount must be greater than zero");
    expect(vi.mocked(apiFetch).mock.calls.every(([, init]) => !init?.method)).toBe(true);
  });

  it("opens the editor explicitly, retains hidden draft edits and saves through the existing PUT", async () => {
    requests(() => Response.json(draft));
    const readHandler = vi.mocked(apiFetch).getMockImplementation()!;
    vi.mocked(apiFetch).mockImplementation(async (path, init) => {
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body));
        return Response.json({ ...draft, ...body, lineItems: [], totalAmount: 100, depositAmount: 10, remainingAmount: 90 });
      }
      return readHandler(path, init);
    });
    const user = userEvent.setup();
    render(<Page />);
    await user.click(await screen.findByRole("button", { name: /ORD-1/ }));
    await user.click(await screen.findByRole("button", { name: "Edit quotation" }));
    await user.type(screen.getByRole("spinbutton", { name: "Total amount (USD)" }), "100");
    await user.click(screen.getByRole("button", { name: "Hide editor" }));
    expect(screen.queryByRole("button", { name: "Save draft" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit quotation" }));
    expect(screen.getByRole("spinbutton", { name: "Total amount (USD)" })).toHaveValue(100);
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Quotation draft saved.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save draft" })).not.toBeInTheDocument();
    expect(vi.mocked(apiFetch).mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1);
  });

  async function enterReportedDraft() {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(await screen.findByRole("button", { name: /ORD-1/ }));
    await user.click(await screen.findByRole("button", { name: "Edit quotation" }));
    await user.type(screen.getByRole("spinbutton", { name: "Total amount (USD)" }), "255");
    await user.type(screen.getByRole("textbox", { name: /Notes/ }), "weweqwe");
    return user;
  }

  it.each(["Save draft", "Send quotation"])("preserves entered values and refuses false success for an empty PUT response during %s", async (action) => {
    requests(() => Response.json(draft));
    const readHandler = vi.mocked(apiFetch).getMockImplementation()!;
    vi.mocked(apiFetch).mockImplementation(async (path, init) => {
      if (init?.method === "PUT") return Response.json({ ...draft, notes: "weweqwe" });
      return readHandler(path, init);
    });
    const user = await enterReportedDraft();
    await user.click(screen.getByRole("button", { name: action }));
    if (action === "Send quotation") await user.click(screen.getByRole("button", { name: "Send and lock quotation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Saving could not be verified");
    expect(screen.getByRole("spinbutton", { name: "Total amount (USD)" })).toHaveValue(255);
    expect(screen.getByRole("textbox", { name: "Deposit (10%)" })).toHaveValue("$25.50");
    expect(screen.getByRole("textbox", { name: /Notes/ })).toHaveValue("weweqwe");
    expect(screen.queryByText("Quotation draft saved.")).not.toBeInTheDocument();
    const writes = vi.mocked(apiFetch).mock.calls.filter(([, init]) => init?.method);
    expect(writes).toHaveLength(1);
    expect(JSON.parse(String(writes[0][1]?.body))).toEqual({
      totalAmount: 255, notes: "weweqwe",
    });
    expect(new Headers(writes[0][1]?.headers).get("Content-Type")).toBe("application/json");
  });

  it("saves the reported amounts, reopens them from a fresh GET, and sends only after a matching PUT", async () => {
    let stored = draft;
    requests(() => Response.json(stored));
    const readHandler = vi.mocked(apiFetch).getMockImplementation()!;
    vi.mocked(apiFetch).mockImplementation(async (path, init) => {
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body));
        stored = { ...draft, ...body, totalAmount: 255, depositAmount: 25.5, remainingAmount: 229.5,
          lineItems: [] };
        return Response.json(stored);
      }
      if (String(path).endsWith("/send")) return Response.json({ ...stored, status: "SENT" });
      return readHandler(path, init);
    });
    const user = await enterReportedDraft();
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Quotation draft saved.")).toBeVisible();
    expect(screen.getByText("$255.00")).toBeVisible();
    expect(screen.getByText("$25.50")).toBeVisible();
    expect(screen.getByText("$229.50")).toBeVisible();
    // Unmount/remount forces a new service read rather than reusing component state.
    const { cleanup } = await import("@testing-library/react");
    cleanup();
    render(<Page />);
    await user.click(await screen.findByRole("button", { name: /ORD-1/ }));
    await user.click(await screen.findByRole("button", { name: "Edit quotation" }));
    expect(screen.getByRole("textbox", { name: "Deposit (10%)" })).toHaveValue("$25.50");
    await user.click(screen.getByRole("button", { name: "Send quotation" }));
    await user.click(screen.getByRole("button", { name: "Send and lock quotation" }));
    expect(await screen.findByText(/Quotation sent for ORD-1/)).toBeVisible();
    expect(vi.mocked(apiFetch).mock.calls.filter(([path]) => String(path).endsWith("/send"))).toHaveLength(1);
  });

  it("keeps SENT quotation immutable", async () => {
    requests(() => Response.json({ ...draft, status: "SENT", totalAmount: 100, depositAmount: 25, remainingAmount: 75 }));
    const user = userEvent.setup();
    render(<Page />);
    await user.click(await screen.findByRole("button", { name: /ORD-1/ }));
    expect(await screen.findByText("Sent quotations are locked.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save draft" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send quotation" })).not.toBeInTheDocument();
  });

  it("does not fetch orders for a Customer account", async () => {
    auth.role = "CUSTOMER";
    render(<Page />);
    await vi.waitFor(() => expect(auth.router.replace).toHaveBeenCalledWith("/customer"));
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
