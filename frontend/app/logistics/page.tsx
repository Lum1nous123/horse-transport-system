"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { clearAccessToken, getAccessToken, getCurrentUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { selectLogisticsInboxOrders, type InboxMode, type InboxSort } from "@/lib/logistics-inbox-search";
import BrandMark from "@/components/BrandMark";
import { LogisticsNavigation, LogisticsOrdersTabs } from "@/components/LogisticsWorkspaceUI";

type OrderStatus = "SUBMITTED" | "QUOTATION_SENT" | "REJECTED" | "CANCELLED";
type InboxOrder = {
  id: string;
  orderCode: string;
  status: OrderStatus;
  originAddress: string | null;
  originCountry: string | null;
  destinationAddress: string | null;
  destinationCountry: string | null;
  transportMode: "ROAD" | "AIR" | "COMBINED" | null;
  requestedDepartureAt: string | null;
  horseCount: number;
  createdAt: string;
};
type OrderDetail = {
  id: string;
  orderCode: string;
  status: OrderStatus;
  originAddress: string | null;
  originCountry: string | null;
  destinationAddress: string | null;
  destinationCountry: string | null;
  transportMode: "ROAD" | "AIR" | "COMBINED" | null;
  requestedDepartureAt: string | null;
  specialRequirements: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientEmail: string | null;
  horseIds: string[];
};
type Quotation = {
  id: string;
  orderId: string;
  totalAmount: number | null;
  depositAmount: number | null;
  remainingAmount: number | null;
  currency: string;
  notes: string | null;
  status: "DRAFT" | "SENT";
  sentAt: string | null;
  lineItems: { id: string; sequenceNo: number; description: string; amount: number }[];
};
type DraftItem = { description: string; amount: string };
type QuoteDraft = { depositAmount: string; notes: string; lineItems: DraftItem[] };
type ApiErrorBody = { code?: string; message?: string };
type LogisticsIconName = "inbox" | "location" | "mode" | "calendar" | "horses" | "contact" | "note" | "quote";

const logisticsIconPaths: Record<LogisticsIconName, string[]> = {
  inbox: ["M4 5h16v14H4z", "M4 14h5l2 2h2l2-2h5"],
  location: ["M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11Z", "M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"],
  mode: ["M3 7h11v10H3z", "M14 10h4l3 3v4h-7z", "M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"],
  calendar: ["M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z", "M8 2v4m8-4v4M3 9h18"],
  horses: ["M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z", "M3 20a5.5 5.5 0 0 1 11 0m0-6a5 5 0 0 1 7 4.6V20"],
  contact: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M4 21a8 8 0 0 1 16 0"],
  note: ["M5 3h14v18H5z", "M8 8h8m-8 4h8m-8 4h5"],
  quote: ["M6 3h9l4 4v14H6z", "M15 3v5h4M9 12h6m-6 4h6"],
};

function LogisticsIcon({ name }: { name: LogisticsIconName }) {
  return <svg className="logistics-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{logisticsIconPaths[name].map((path) => <path d={path} key={path} />)}</svg>;
}

class LogisticsApiError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) {
    super(message);
  }
}

const emptyQuoteDraft: QuoteDraft = { depositAmount: "", notes: "", lineItems: [] };
const demoOrderId = "preview-order-lm-1";
const previewOrders: InboxOrder[] = [
  {
    id: demoOrderId, orderCode: "ORD-DEMO-2048", status: "SUBMITTED",
    originAddress: "Lexington, KY", originCountry: "United States",
    destinationAddress: "Brussels", destinationCountry: "Belgium", transportMode: "COMBINED",
    requestedDepartureAt: "2026-10-18T09:00:00", horseCount: 2, createdAt: "2026-09-28T10:30:00",
  },
  {
    id: "preview-order-lm-2", orderCode: "ORD-DEMO-2039", status: "SUBMITTED",
    originAddress: null, originCountry: "France", destinationAddress: "Amsterdam", destinationCountry: "Netherlands",
    transportMode: "ROAD", requestedDepartureAt: "2026-10-22T08:00:00", horseCount: 1,
    createdAt: "2026-09-27T15:15:00",
  },
];
const previewDetails: Record<string, OrderDetail> = {
  [demoOrderId]: {
    id: demoOrderId, orderCode: "ORD-DEMO-2048", status: "SUBMITTED",
    originAddress: "Lexington, KY", originCountry: "United States",
    destinationAddress: "Brussels", destinationCountry: "Belgium", transportMode: "COMBINED",
    requestedDepartureAt: "2026-10-18T09:00:00", specialRequirements: "Please coordinate arrival with the receiving stable.",
    recipientName: "Morgan Taylor", recipientPhone: "+32 2 555 0124", recipientEmail: "morgan@example.com",
    horseIds: ["preview-horse-1", "preview-horse-2"],
  },
  "preview-order-lm-2": {
    id: "preview-order-lm-2", orderCode: "ORD-DEMO-2039", status: "SUBMITTED",
    originAddress: null, originCountry: "France", destinationAddress: "Amsterdam", destinationCountry: "Netherlands",
    transportMode: "ROAD", requestedDepartureAt: "2026-10-22T08:00:00", specialRequirements: null,
    recipientName: "Jordan Lee", recipientPhone: "+31 20 555 0198", recipientEmail: null,
    horseIds: ["preview-horse-3"],
  },
};

function isPreviewRequested() {
  return process.env.NODE_ENV === "development"
    && typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("preview") === "1";
}

async function logisticsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  if (!token) throw new LogisticsApiError("Your session has expired. Please sign in again.", "SESSION_EXPIRED", 401);
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  if (init?.body) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await apiFetch(path, { ...init, headers });
  } catch {
    throw new LogisticsApiError("We couldn't reach the order service. Check your connection and try again.", "NETWORK_ERROR", 0);
  }
  if (response.status === 401) {
    clearAccessToken();
    throw new LogisticsApiError("Your session has expired. Please sign in again.", "SESSION_EXPIRED", 401);
  }
  if (!response.ok) {
    let error: ApiErrorBody = {};
    try { error = await response.json() as ApiErrorBody; } catch { /* Keep the generic fallback. */ }
    throw new LogisticsApiError(
      error.message ?? "We couldn't complete that request. Please try again.",
      error.code ?? "REQUEST_FAILED",
      response.status,
    );
  }
  return (response.status === 204 ? null : await response.json()) as T;
}

function quoteDraftFrom(quotation: Quotation): QuoteDraft {
  return {
    depositAmount: quotation.depositAmount == null ? "" : String(quotation.depositAmount),
    notes: quotation.notes ?? "",
    lineItems: [...quotation.lineItems]
      .sort((a, b) => a.sequenceNo - b.sequenceNo)
      .map((item) => ({ description: item.description, amount: String(item.amount) })),
  };
}

function formatMoney(amount: number | null, currency = "USD") {
  return amount == null
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function inboxDate(value: string | null) {
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Not provided";
}

function location(address: string | null, country: string | null) {
  return address || country || "Not provided";
}

export default function LogisticsPage() {
  const router = useRouter();
  const selectionRequest = useRef(0);
  const [preview, setPreview] = useState(false);
  const [ready, setReady] = useState(false);
  const [orders, setOrders] = useState<InboxOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<InboxMode>("ALL");
  const [inboxSort, setInboxSort] = useState<InboxSort>("received-oldest");
  const [mobileDetail, setMobileDetail] = useState(false);
  const detailHeading = useRef<HTMLButtonElement>(null);
  const clearInboxFilters = () => { setSearchQuery(""); setModeFilter("ALL"); };
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [quoteEditing, setQuoteEditing] = useState(false);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteDraft, setQuoteDraft] = useState<QuoteDraft>(emptyQuoteDraft);
  const [quoteError, setQuoteError] = useState("");
  const [quoteBusyAction, setQuoteBusyAction] = useState(false);
  const [rejectOrder, setRejectOrder] = useState<OrderDetail | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [rejectBusy, setRejectBusy] = useState(false);
  const [sendWarning, setSendWarning] = useState(false);
  const [feedback, setFeedback] = useState("");

  const computedTotal = useMemo(() => quoteDraft.lineItems.reduce((sum, item) => {
    const amount = Number(item.amount);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0), [quoteDraft.lineItems]);

  const visibleOrders = useMemo(
    () => selectLogisticsInboxOrders(orders, searchQuery, modeFilter, inboxSort),
    [orders, searchQuery, modeFilter, inboxSort],
  );

  const refreshInbox = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const rows = isPreviewRequested()
        ? previewOrders
        : await logisticsFetch<InboxOrder[]>("/api/v1/orders/inbox?status=SUBMITTED");
      setOrders(rows);
    } catch (error) {
      if (error instanceof LogisticsApiError && error.code === "SESSION_EXPIRED") {
        router.replace("/login?next=/logistics");
        return;
      }
      setLoadError(error instanceof Error ? error.message : "We couldn't load the submitted orders.");
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => {
    let active = true;
    async function initialize() {
      if (isPreviewRequested()) {
        setPreview(true); setOrders(previewOrders); setReady(true); setLoading(false);
        return;
      }
      if (!getAccessToken()) {
        router.replace("/login?next=/logistics");
        return;
      }
      try {
        const currentUser = await getCurrentUser();
        if (!active) return;
        if (currentUser.role !== "LOGISTICS_MANAGER") {
          router.replace(currentUser.role === "CUSTOMER" ? "/customer" : "/login");
          return;
        }
        setReady(true);
        await refreshInbox();
      } catch (error) {
        if (!active) return;
        if (!getAccessToken()) router.replace("/login?next=/logistics");
        else setLoadError(error instanceof Error ? error.message : "We couldn't verify your account.");
        setLoading(false);
      }
    }
    void initialize();
    return () => { active = false; };
  }, [refreshInbox, router]);

  async function openOrder(order: InboxOrder) {
    if (selectedId === order.id && (orderDetail || detailBusy)) return;
    const requestId = ++selectionRequest.current;
    setQuoteEditing(false);
    setSelectedId(order.id); setOrderDetail(null); setQuotation(null); setQuoteDraft(emptyQuoteDraft); setQuoteError(""); setFeedback("");
    setDetailBusy(true); setQuoteBusy(false);
    if (preview) {
      setOrderDetail(previewDetails[order.id] ?? null);
      setQuotation(null);
      setDetailBusy(false);
      return;
    }
    try {
      const detail = await logisticsFetch<OrderDetail>(`/api/v1/orders/${order.id}`);
      if (requestId !== selectionRequest.current) return;
      if (detail.status !== "SUBMITTED") {
        await refreshInbox();
        setFeedback(`${order.orderCode} is no longer awaiting pre-approval review.`);
        setSelectedId(null);
        return;
      }
      setOrderDetail(detail);
      setQuoteBusy(true);
      try {
        const currentQuote = await logisticsFetch<Quotation>(`/api/v1/orders/${order.id}/quotation`);
        if (requestId !== selectionRequest.current) return;
        setQuotation(currentQuote);
        setQuoteDraft(currentQuote.status === "DRAFT" ? quoteDraftFrom(currentQuote) : emptyQuoteDraft);
      } catch (error) {
        if (requestId !== selectionRequest.current) return;
        if (!(error instanceof LogisticsApiError && error.code === "QUOTATION_NOT_FOUND")) {
          setQuoteError(error instanceof Error ? error.message : "We couldn't load the quotation.");
        }
      } finally { if (requestId === selectionRequest.current) setQuoteBusy(false); }
    } catch (error) {
      if (requestId !== selectionRequest.current) return;
      if (error instanceof LogisticsApiError && error.code === "SESSION_EXPIRED") {
        router.replace("/login?next=/logistics");
      } else {
        setLoadError(error instanceof Error ? error.message : "We couldn't load this order.");
      }
    } finally {
      if (requestId === selectionRequest.current) setDetailBusy(false);
    }
  }

  async function retryQuotationRead() {
    if (!orderDetail || quoteBusy || quoteBusyAction) return;
    const orderId = orderDetail.id;
    const requestId = selectionRequest.current;
    setQuoteBusy(true); setQuoteError("");
    try {
      const saved = await logisticsFetch<Quotation>(`/api/v1/orders/${orderId}/quotation`);
      if (requestId !== selectionRequest.current) return;
      setQuotation(saved);
      setQuoteDraft(saved.status === "DRAFT" ? quoteDraftFrom(saved) : emptyQuoteDraft);
    } catch (error) {
      if (requestId !== selectionRequest.current) return;
      if (error instanceof LogisticsApiError && error.code === "QUOTATION_NOT_FOUND") {
        setQuotation(null);
      } else if (error instanceof LogisticsApiError && error.code === "SESSION_EXPIRED") {
        router.replace("/login?next=/logistics");
      } else {
        setQuoteError(error instanceof Error ? error.message : "We couldn't read the quotation.");
      }
    } finally {
      if (requestId === selectionRequest.current) setQuoteBusy(false);
    }
  }

  async function createQuotation() {
    if (!orderDetail || orderDetail.status !== "SUBMITTED") return;
    setQuoteBusyAction(true); setQuoteError("");
    try {
      const created = preview
        ? { id: `preview-quote-${Date.now()}`, orderId: orderDetail.id, totalAmount: null, depositAmount: null, remainingAmount: null, currency: "USD", notes: null, status: "DRAFT" as const, sentAt: null, lineItems: [] }
        : await logisticsFetch<Quotation>(`/api/v1/orders/${orderDetail.id}/quotation`, { method: "POST" });
      setQuoteEditing(true);
      setQuotation(created);
      setQuoteDraft(quoteDraftFrom(created));
    } catch (error) {
      setQuoteError(error instanceof Error ? error.message : "We couldn't create the quotation.");
    } finally { setQuoteBusyAction(false); }
  }

  function validateQuoteDraft(requireSendable: boolean) {
    const items = quoteDraft.lineItems.map((item) => ({
      sequenceNo: 0,
      description: item.description.trim(),
      amount: Number(item.amount),
    }));
    if (items.some((item) => !item.description || !Number.isFinite(item.amount) || item.amount <= 0)) {
      setQuoteError("Each cost item needs a description and an amount greater than zero.");
      return null;
    }
    if (requireSendable && items.length === 0) {
      setQuoteError("Add at least one cost item before sending the quotation.");
      return null;
    }
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    const deposit = quoteDraft.depositAmount.trim() ? Number(quoteDraft.depositAmount) : null;
    if (requireSendable && (deposit == null || !Number.isFinite(deposit) || deposit <= 0 || deposit >= total)) {
      setQuoteError("Deposit must be greater than zero and less than the quotation total.");
      return null;
    }
    if (deposit != null && (!Number.isFinite(deposit) || deposit <= 0 || deposit >= total)) {
      setQuoteError("Deposit must be greater than zero and less than the quotation total.");
      return null;
    }
    return {
      depositAmount: deposit,
      notes: quoteDraft.notes.trim() || null,
      lineItems: items.map((item, index) => ({ ...item, sequenceNo: index + 1 })),
    };
  }

  async function persistQuotation(requireSendable = false) {
    if (!orderDetail || !quotation || quotation.status !== "DRAFT") return null;
    const body = validateQuoteDraft(requireSendable);
    if (!body) return null;
    if (preview) {
      const next: Quotation = {
        ...quotation,
        depositAmount: body.depositAmount,
        totalAmount: body.lineItems.reduce((sum, item) => sum + item.amount, 0) || null,
        remainingAmount: body.depositAmount == null ? null : body.lineItems.reduce((sum, item) => sum + item.amount, 0) - body.depositAmount,
        notes: body.notes,
        lineItems: body.lineItems.map((item, index) => ({ id: `preview-item-${index}`, ...item })),
      };
      setQuotation(next);
      setQuoteDraft(quoteDraftFrom(next));
      return next;
    }
    try {
      const saved = await logisticsFetch<Quotation>(`/api/v1/orders/${orderDetail.id}/quotation`, {
        method: "PUT", body: JSON.stringify(body),
      });
      // A successful HTTP status is not proof that the submitted draft was saved.
      // Never replace the user's edits or send a quotation whose response lost fields.
      const sameAmount = (actual: number | null, expected: number | null) =>
        expected === null ? actual === null : typeof actual === "number" && Number.isFinite(actual) && Math.abs(actual - expected) < 0.000001;
      const expectedTotal = body.lineItems.length ? body.lineItems.reduce((sum, item) => sum + item.amount, 0) : null;
      const expectedRemaining = body.depositAmount === null || expectedTotal === null ? null : expectedTotal - body.depositAmount;
      if (!saved || saved.id !== quotation.id || saved.orderId !== orderDetail.id || saved.status !== "DRAFT"
        || !Array.isArray(saved.lineItems) || saved.lineItems.length !== body.lineItems.length
        || body.lineItems.some((item) => !saved.lineItems.some((returned) =>
          returned.sequenceNo === item.sequenceNo && returned.description === item.description && sameAmount(returned.amount, item.amount)))
        || !sameAmount(saved.depositAmount, body.depositAmount) || !sameAmount(saved.totalAmount, expectedTotal)
        || !sameAmount(saved.remainingAmount, expectedRemaining) || saved.notes !== body.notes) {
        setQuoteError("The service returned a quotation that does not match your draft. Saving could not be verified. Your edits are kept; review before retrying. The quotation was not sent.");
        return null;
      }
      setQuotation(saved);
      setQuoteDraft(quoteDraftFrom(saved));
      return saved;
    } catch (error) {
      setQuoteError(error instanceof Error ? error.message : "We couldn't save this quotation.");
      return null;
    }
  }

  async function saveQuotation() {
    setQuoteBusyAction(true); setQuoteError(""); setFeedback("");
    const saved = await persistQuotation();
    if (saved) { setFeedback("Quotation draft saved."); setQuoteEditing(false); }
    setQuoteBusyAction(false);
  }

  function requestSendQuotation() {
    setQuoteError("");
    if (!validateQuoteDraft(true)) return;
    setSendWarning(true);
  }

  async function confirmSendQuotation() {
    if (!orderDetail || !quotation) return;
    setSendWarning(false);
    setQuoteBusyAction(true); setQuoteError(""); setFeedback("");
    const saved = await persistQuotation(true);
    if (!saved) { setQuoteBusyAction(false); return; }
    if (preview) {
      setOrders((current) => current.filter((order) => order.id !== orderDetail.id));
      setQuotation({ ...saved, status: "SENT", sentAt: new Date().toISOString() });
      setFeedback("Preview only — the quotation is shown as sent and locked; nothing was sent.");
      setSelectedId(null); setOrderDetail(null);
      setQuoteBusyAction(false);
      return;
    }
    try {
      await logisticsFetch<Quotation>(`/api/v1/orders/${orderDetail.id}/quotation/send`, { method: "POST" });
      setOrders((current) => current.filter((order) => order.id !== orderDetail.id));
      setFeedback(`Quotation sent for ${orderDetail.orderCode}. It is now locked for editing.`);
      setSelectedId(null); setOrderDetail(null); setQuotation(null);
    } catch (error) {
      setQuoteError(error instanceof Error ? error.message : "We couldn't send the quotation.");
    } finally { setQuoteBusyAction(false); }
  }

  async function confirmReject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rejectOrder || !rejectionReason.trim()) {
      setRejectError("Enter a reason before rejecting this order.");
      return;
    }
    setRejectBusy(true); setRejectError("");
    try {
      if (!preview) {
        await logisticsFetch(`/api/v1/orders/${rejectOrder.id}/reject`, {
          method: "POST", body: JSON.stringify({ rejectionReason: rejectionReason.trim() }),
        });
      }
      setOrders((current) => current.filter((order) => order.id !== rejectOrder.id));
      setSelectedId(null); setOrderDetail(null); setQuotation(null); setRejectOrder(null); setRejectionReason("");
      setFeedback(preview ? "Preview only — the sample order is shown as rejected; nothing was sent." : `${rejectOrder.orderCode} was rejected.`);
    } catch (error) {
      setRejectError(error instanceof Error ? error.message : "We couldn't reject this order.");
    } finally { setRejectBusy(false); }
  }

  function signOut() { clearAccessToken(); router.replace("/login"); }

  if (!ready) {
    return <main className="customer-page"><div className="customer-content"><p className="customer-loading" role={loading ? "status" : "alert"}>{loading ? "Opening your workspace…" : loadError || "This workspace is unavailable."}</p>{!loading && <button className="customer-secondary-button" type="button" onClick={() => router.replace("/login")}>Return to sign in</button>}</div></main>;
  }

  return (
    <main className="customer-page logistics-page logistics-manager-page">
      <header className="customer-topbar">
        <Link className="customer-brand" href="/" aria-label="Horse Transport System home">
          <BrandMark /><span>Horse Transport System</span>
        </Link>
        <LogisticsNavigation section="orders" preview={preview} />
        <div className="customer-topbar-actions"><span>Logistics Manager</span><button type="button" className="customer-link-button" onClick={signOut}>Sign out</button></div>
      </header>
      <div className="customer-content logistics-content">
        {preview && <div className="customer-preview-banner" role="status"><strong>Preview mode</strong><span>Sample data only. Changes stay in this tab and are not sent to the backend.</span></div>}
        <LogisticsOrdersTabs active="submitted" preview={preview} />
        <div className="customer-heading-row logistics-heading"><div className="logistics-heading-copy"><span className="logistics-heading-icon" aria-hidden="true">✓</span><div><div className="logistics-heading-title"><h1>Submitted orders</h1><span className="customer-count">{orders.length} awaiting review</span></div><p className="customer-intro">Review incoming requests, verify transport details, and prepare quotations.</p></div></div></div>
        {feedback && <p className="customer-feedback" role="status">{feedback}</p>}
        {loadError && <div className="customer-alert" role="alert"><span>{loadError}</span><button type="button" onClick={() => void refreshInbox()}>Try again</button></div>}
        <div className={`logistics-workspace lm-submitted-workspace${mobileDetail ? " is-detail-open" : ""}`}>
          <section className="logistics-inbox" aria-labelledby="inbox-heading">
            <div className="logistics-inbox-header">
              <div className="logistics-inbox-title"><div><h2 id="inbox-heading"><LogisticsIcon name="inbox" />Submitted orders</h2><span>{loading || (loadError && orders.length === 0) ? "—" : `${visibleOrders.length} of ${orders.length}`}</span></div><button className="customer-text-button" type="button" onClick={() => void refreshInbox()} disabled={loading} aria-label="Refresh order inbox">{loading ? "Refreshing…" : "Refresh"}</button></div>
              <label className="logistics-search"><span className="sr-only">Search submitted orders</span><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search order or route" autoComplete="off" /></label>
              <div className="lm-inbox-controls">
                <label>Mode<select value={modeFilter} onChange={(event) => setModeFilter(event.target.value as InboxMode)}><option value="ALL">All modes</option><option value="ROAD">ROAD</option><option value="AIR">AIR</option><option value="COMBINED">COMBINED</option></select></label>
                <label>Sort by<select value={inboxSort} onChange={(event) => setInboxSort(event.target.value as InboxSort)}><option value="received-oldest">Received oldest first</option><option value="received-newest">Received newest first</option><option value="departure-earliest">Departure earliest</option></select></label>
              </div>
            </div>
            {loading ? <p className="logistics-empty" role="status">Loading submitted orders…</p> : loadError && orders.length === 0 ? <p className="logistics-empty">Submitted orders are unavailable. Use “Try again” above.</p> : orders.length === 0 ? <div className="logistics-empty"><span className="logistics-empty-icon" aria-hidden="true">✓</span><h3>Inbox is clear</h3><p>New submitted transport requests will appear here.</p></div> : visibleOrders.length === 0 ? <div className="logistics-empty logistics-search-empty"><h3>No matching orders</h3><p>Try a different order code, route, or mode.</p><button className="customer-text-button" type="button" onClick={clearInboxFilters}>Clear filters</button></div> : <ul className="logistics-order-list">{visibleOrders.map((order) => <li key={order.id}><button className={`logistics-order-card${selectedId === order.id ? " is-selected" : ""}`} type="button" disabled={quoteBusyAction || rejectBusy} onClick={() => { setMobileDetail(true); void openOrder(order); requestAnimationFrame(() => detailHeading.current?.focus()); }} aria-current={selectedId === order.id ? "true" : undefined}><span className="logistics-order-card-top"><strong>{order.orderCode}</strong></span><span className="logistics-route">{location(order.originAddress, order.originCountry)} <span aria-hidden="true">→</span> {location(order.destinationAddress, order.destinationCountry)}</span><span className="lm-inbox-departure"><span>Departure</span> {inboxDate(order.requestedDepartureAt)}</span><span className="logistics-order-card-bottom"><span>{order.horseCount} {order.horseCount === 1 ? "horse" : "horses"} · {order.transportMode ?? "Mode not set"}</span><span>Received {inboxDate(order.createdAt)}</span></span></button></li>)}</ul>}
            {!loading && orders.length > 0 && <p className="logistics-inbox-footer">Showing {visibleOrders.length} of {orders.length} loaded {orders.length === 1 ? "order" : "orders"}</p>}
          </section>

          <section className="logistics-detail" aria-label="Selected order details">
            {selectedId && <button ref={detailHeading} className="customer-text-button lm-back-to-inbox" type="button" disabled={quoteBusyAction || rejectBusy} onClick={() => { setMobileDetail(false); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".logistics-order-card.is-selected")?.focus()); }}>← Back to submitted orders</button>}
            {selectedId && orders.some((order) => order.id === selectedId) && !visibleOrders.some((order) => order.id === selectedId) && <div className="lm-filter-notice" role="status">The open order is outside your current filters. Your quotation edits are preserved. <button className="customer-text-button" type="button" onClick={clearInboxFilters}>Clear filters</button></div>}
            {!selectedId ? <div className="logistics-select-prompt"><span aria-hidden="true">↖</span><h2>Select an order</h2><p>Choose a submitted request to review its journey and delivery details.</p></div> : detailBusy ? <div className="logistics-select-prompt" role="status"><p>Loading order details…</p></div> : !orderDetail ? <div className="logistics-select-prompt"><p>Order details are unavailable. Refresh the inbox and try again.</p></div> : <>
              <div className="logistics-detail-heading"><div className="logistics-detail-title"><div><h2>{orderDetail.orderCode}</h2><span className="order-status status-submitted">Submitted</span></div><p><LogisticsIcon name="location" />{location(orderDetail.originAddress, orderDetail.originCountry)} <span aria-hidden="true">→</span> {location(orderDetail.destinationAddress, orderDetail.destinationCountry)}</p></div><div className="logistics-header-actions"><button className="customer-secondary-button compact reject-trigger" type="button" onClick={() => { setRejectOrder(orderDetail); setRejectError(""); setRejectionReason(""); }}>Reject order</button>{!quotation && !quoteError && <button className="customer-primary-button compact" type="button" disabled={quoteBusy || quoteBusyAction} onClick={() => void createQuotation()}>{quoteBusy ? "Checking quotation…" : quoteBusyAction ? "Preparing…" : "Prepare quotation"}</button>}</div></div>
              <section className="logistics-summary" aria-labelledby="transport-summary-heading"><h3 id="transport-summary-heading">Transport summary</h3><dl><div><dt><LogisticsIcon name="mode" />Transport mode</dt><dd>{orderDetail.transportMode ?? "Not provided"}</dd></div><div><dt><LogisticsIcon name="calendar" />Requested departure</dt><dd>{orderDetail.requestedDepartureAt ? new Date(orderDetail.requestedDepartureAt).toLocaleString() : "Not provided"}</dd></div><div><dt><LogisticsIcon name="horses" />Horses</dt><dd>{orderDetail.horseIds.length} {orderDetail.horseIds.length === 1 ? "horse" : "horses"}</dd></div></dl></section>
              <div className={`logistics-detail-grid${orderDetail.specialRequirements ? " has-requirements" : ""}`}>
                <section className="logistics-info-section"><h3><LogisticsIcon name="contact" />Delivery contact</h3><dl><div><dt>Name</dt><dd>{orderDetail.recipientName || "Not provided"}</dd></div><div><dt>Phone</dt><dd>{orderDetail.recipientPhone ? <a href={`tel:${orderDetail.recipientPhone}`}>{orderDetail.recipientPhone}</a> : "Not provided"}</dd></div><div><dt>Email</dt><dd>{orderDetail.recipientEmail ? <a href={`mailto:${orderDetail.recipientEmail}`}>{orderDetail.recipientEmail}</a> : "Not provided"}</dd></div></dl></section>
                {orderDetail.specialRequirements && <section className="logistics-info-section logistics-requirements"><h3><LogisticsIcon name="note" />Special requirements</h3><p>{orderDetail.specialRequirements}</p></section>}
              </div>
              <section className="logistics-quotation-section" aria-labelledby="quotation-editor-heading"><div className="logistics-quotation-heading"><div><h3 id="quotation-editor-heading"><LogisticsIcon name="quote" />Quotation</h3><p>{quoteBusy ? "Reading the saved quotation…" : quoteError && !quotation ? "Quotation state is unavailable. Retry the read before preparing a quotation." : quotation?.status === "SENT" ? "Sent quotations are locked." : quotation?.status === "DRAFT" ? "Complete the draft and send it to the customer." : "No quotation has been prepared for this order."}</p></div><span className={`quotation-state ${quotation?.status.toLowerCase() ?? "not-started"}`}>{quoteError && !quotation ? "Unavailable" : quotation?.status === "SENT" ? "Sent" : quotation?.status === "DRAFT" ? "Draft" : quoteBusy ? "Checking…" : "Not started"}</span></div>
                {quoteError && <div className="customer-form-error" role="alert">{quoteError}{!preview && !quotation && <button className="customer-text-button" type="button" disabled={quoteBusy || quoteBusyAction} onClick={() => void retryQuotationRead()}>Retry quotation read</button>}</div>}
                {quoteBusy ? <p className="field-hint" role="status">Loading quotation…</p> : !quotation ? <div className="logistics-no-quote"><p>{quoteError ? "The saved quotation could not be verified." : <>Use “Prepare quotation” above to start adding cost items and a deposit requirement.</>}</p></div> : quotation.status === "SENT" ? <QuotationBreakdown quotation={quotation} /> : !quoteEditing ? <div className="lm-quote-preview"><dl><div><dt>Saved total</dt><dd>{formatMoney(quotation.totalAmount)}</dd></div><div><dt>Deposit</dt><dd>{formatMoney(quotation.depositAmount)}</dd></div><div><dt>Remaining balance</dt><dd>{formatMoney(quotation.remainingAmount)}</dd></div></dl><button className="customer-primary-button compact" type="button" onClick={() => setQuoteEditing(true)}>Edit quotation</button></div> : <div id="quotation-editor">
                  <div className="lm-editor-heading"><span>Quotation draft</span><button className="customer-text-button" type="button" disabled={quoteBusyAction} onClick={() => setQuoteEditing(false)}>Hide editor</button></div>
                  <div className="logistics-line-items"><div className="logistics-line-heading"><span>Cost item</span><span>Amount (USD)</span><span className="sr-only">Actions</span></div>{quoteDraft.lineItems.map((item, index) => <div className="logistics-line-editor" key={`${quotation.id}-${index}`}><label className="sr-only" htmlFor={`line-description-${index}`}>Cost item {index + 1} description</label><input id={`line-description-${index}`} value={item.description} maxLength={255} placeholder="Transport service" onChange={(event) => setQuoteDraft((current) => ({ ...current, lineItems: current.lineItems.map((line, lineIndex) => lineIndex === index ? { ...line, description: event.target.value } : line) }))} /><label className="sr-only" htmlFor={`line-amount-${index}`}>Cost item {index + 1} amount in USD</label><input id={`line-amount-${index}`} type="number" min="0.01" step="0.01" value={item.amount} placeholder="0.00" onChange={(event) => setQuoteDraft((current) => ({ ...current, lineItems: current.lineItems.map((line, lineIndex) => lineIndex === index ? { ...line, amount: event.target.value } : line) }))} /><button className="customer-text-button remove-line-button" type="button" onClick={() => setQuoteDraft((current) => ({ ...current, lineItems: current.lineItems.filter((_, lineIndex) => lineIndex !== index) }))} aria-label={`Remove cost item ${index + 1}`}>Remove</button></div>)}<button className="customer-secondary-button compact add-line-button" type="button" onClick={() => setQuoteDraft((current) => ({ ...current, lineItems: [...current.lineItems, { description: "", amount: "" }] }))}>Add cost item <span aria-hidden="true">＋</span></button></div>
                  <div className="logistics-total-row"><span>Total</span><strong>{formatMoney(computedTotal || null)}</strong></div>
                  <div className="customer-field-grid logistics-quote-fields"><label className="customer-field"><span>Deposit amount (USD)</span><input type="number" min="0.01" step="0.01" value={quoteDraft.depositAmount} placeholder="Enter deposit" onChange={(event) => setQuoteDraft((current) => ({ ...current, depositAmount: event.target.value }))} /></label><label className="customer-field"><span>Remaining balance</span><input value={quoteDraft.depositAmount && Number(quoteDraft.depositAmount) > 0 ? formatMoney(computedTotal - Number(quoteDraft.depositAmount)) : "—"} readOnly /></label></div>
                  <label className="customer-field"><span>Notes <em>Optional</em></span><textarea rows={3} maxLength={2000} value={quoteDraft.notes} onChange={(event) => setQuoteDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
                  <div className="logistics-editor-footer"><p>Review the amounts before sending. A sent quotation cannot be changed.</p><div><button className="customer-secondary-button" type="button" disabled={quoteBusyAction} onClick={() => void saveQuotation()}>{quoteBusyAction ? "Saving…" : "Save draft"}</button><button className="customer-primary-button" type="button" disabled={quoteBusyAction} onClick={requestSendQuotation}>Send quotation</button></div></div>
                </div>}
              </section>
            </>}
          </section>
        </div>
      </div>

      {rejectOrder && <div className="customer-dialog-backdrop warning-backdrop"><form className="customer-warning logistics-reject-dialog" role="alertdialog" aria-modal="true" aria-labelledby="reject-title" aria-describedby="reject-copy" onSubmit={(event) => void confirmReject(event)}><div className="warning-symbol" aria-hidden="true">!</div><h2 id="reject-title">Reject {rejectOrder.orderCode}?</h2><p id="reject-copy">This ends the order before quotation. Rejected orders cannot be reopened.</p><label className="customer-field"><span>Reason for rejection <b aria-hidden="true">*</b></span><textarea rows={4} required value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} /></label>{rejectError && <p className="customer-form-error" role="alert">{rejectError}</p>}<div className="customer-form-actions"><button type="button" className="customer-secondary-button" disabled={rejectBusy} onClick={() => setRejectOrder(null)}>Keep order</button><button type="submit" className="customer-primary-button danger-button" disabled={rejectBusy}>{rejectBusy ? "Rejecting…" : "Reject order"}</button></div></form></div>}

      {sendWarning && orderDetail && <div className="customer-dialog-backdrop warning-backdrop"><section className="customer-warning" role="alertdialog" aria-modal="true" aria-labelledby="send-quotation-title" aria-describedby="send-quotation-copy"><div className="warning-symbol" aria-hidden="true">!</div><h2 id="send-quotation-title">Send quotation for {orderDetail.orderCode}?</h2><p id="send-quotation-copy">After sending, the quotation is locked and this order moves to QUOTATION_SENT. Review the item amounts and deposit before continuing.</p><div className="customer-form-actions"><button type="button" className="customer-secondary-button" disabled={quoteBusyAction} onClick={() => setSendWarning(false)}>Go back and review</button><button type="button" className="customer-primary-button" disabled={quoteBusyAction} onClick={() => void confirmSendQuotation()}>{quoteBusyAction ? "Sending…" : "Send and lock quotation"}</button></div></section></div>}
    </main>
  );
}

function QuotationBreakdown({ quotation }: { quotation: Quotation }) {
  return <div className="quotation-content logistics-sent-quotation"><div className="quotation-line-list">{[...quotation.lineItems].sort((a, b) => a.sequenceNo - b.sequenceNo).map((item) => <div className="quotation-line" key={item.id}><span>{item.description}</span><strong>{formatMoney(item.amount, quotation.currency)}</strong></div>)}</div><div className="quotation-total"><span>Total</span><strong>{formatMoney(quotation.totalAmount, quotation.currency)}</strong></div><div className="quotation-payment-row"><span>Deposit</span><strong>{formatMoney(quotation.depositAmount, quotation.currency)}</strong></div><div className="quotation-payment-row"><span>Remaining balance</span><strong>{formatMoney(quotation.remainingAmount, quotation.currency)}</strong></div>{quotation.notes && <div className="quotation-notes"><strong>Notes</strong><p>{quotation.notes}</p></div>}</div>;
}
