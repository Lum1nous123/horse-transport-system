"use client";

import Link from "next/link";
import Image from "next/image";
import BrandMark from "@/components/BrandMark";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { clearAccessToken, getAccessToken, getCurrentUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { filterCustomerOrders, customerOrderGroups, customerOrdersInGroup, type CustomerOrderGroup } from "@/lib/customer-order-filter";
import CustomerOrderActions, { type CustomerOrderAction } from "./CustomerOrderActions";
import "./customer-request-list.css";
import DocumentWorkspace from "./DocumentWorkspace";

type Horse = {
  id: string;
  name: string;
  microchipId: string;
  passportNumber?: string | null;
  breed?: string | null;
  sex?: string | null;
  dateOfBirth?: string | null;
  notes?: string | null;
};

type Order = {
  id: string;
  orderCode: string;
  originAddress?: string | null;
  originCountry?: string | null;
  destinationAddress?: string | null;
  destinationCountry?: string | null;
  requestedDepartureAt?: string | null;
  transportMode?: "ROAD" | "AIR" | "COMBINED" | null;
  specialRequirements?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  horseIds: string[];
  status: "DRAFT" | "SUBMITTED" | "QUOTATION_SENT" | "APPROVED" | "READY_TO_SHIP" | "IN_PROGRESS" | "DELIVERED" | "REJECTED" | "CANCELLED";
};

type OrderFields = Omit<Order, "id" | "orderCode" | "status" | "horseIds"> & { horseIds: string[] };
type Quotation = {
  id: string;
  orderId: string;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  currency: string;
  notes?: string | null;
  status: "SENT";
  sentAt?: string | null;
  lineItems: { id: string; sequenceNo: number; description: string; amount: number }[];
};
type DepositPayment = {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: "PENDING" | "PAID" | "REFUNDED";
  paidAt?: string | null;
  latestAttempt?: { providerStatus: "PENDING" | "OPEN" | "SUCCEEDED" | "CANCELLED" | "EXPIRED" } | null;
};
type DepositCheckout = { checkoutUrl: string };
type RemainingBalanceSummary = {
  paymentStatus: "PENDING" | "PAID" | "REFUNDED";
  checkoutEligible: boolean;
};
type CustomerIconName = "orders" | "draft" | "journey" | "horse" | "truck" | "user" | "logout" | "plus" | "search" | "route" | "calendar";

const customerIconPaths: Record<CustomerIconName, string[]> = {
  orders: ["M6 3h9l4 4v14H6z", "M15 3v5h4M9 12h6m-6 4h6"],
  draft: ["M4 20h4l11-11-4-4L4 16v4Z", "m13.5 3.5 4 4"],
  journey: ["M5 19V7m0 0 3 3M5 7 2 3", "M5 16h9a5 5 0 0 0 5-5V5"],
  horse: ["m3 20 2-7 4-3 2-5 4 2 2 4 3 2-2 2-3-1-2 2-1 4", "m11 5 1-2m3 4 2-3", "M5 13 3 11m14 2 3 1"],
  truck: ["M2 6h12v11H2z", "M14 10h4l4 4v3h-8z", "M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"],
  user: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2z"],
  logout: ["M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5", "m16 7 5 5-5 5m5-5H9"],
  plus: ["M12 4v16M4 12h16"],
  search: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z", "m20 20-4-4"],
  route: ["M5 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm14 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z", "M5 6h7a4 4 0 0 1 4 4v0a4 4 0 0 1-4 4H5"],
  calendar: ["M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z", "M8 2v4m8-4v4M3 9h18"],
};

function CustomerIcon({ name }: { name: CustomerIconName }) {
  return <svg className="customer-dashboard-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{customerIconPaths[name].map((path) => <path d={path} key={path} />)}</svg>;
}

const emptyOrder: OrderFields = {
  originAddress: "", originCountry: "", destinationAddress: "", destinationCountry: "",
  requestedDepartureAt: "", transportMode: null, specialRequirements: "", recipientName: "",
  recipientPhone: "", recipientEmail: "", horseIds: [],
};

const previewHorses: Horse[] = [
  { id: "preview-horse-1", name: "Willow Creek", microchipId: "PREVIEW-2048", breed: "Thoroughbred", sex: "MARE" },
  { id: "preview-horse-2", name: "Copper Ridge", microchipId: "PREVIEW-7316", breed: "Warmblood", sex: "GELDING" },
  { id: "preview-horse-3", name: "Commander", microchipId: "PREVIEW-7317" },
  { id: "preview-horse-4", name: "Dakota", microchipId: "PREVIEW-7318" },
  { id: "preview-horse-5", name: "Apollo", microchipId: "PREVIEW-7319" },
  { id: "preview-horse-6", name: "Bella", microchipId: "PREVIEW-7320" },
];

const previewOrders: Order[] = [
  {
    id: "order-2068", orderCode: "ORD-2068", originAddress: "Lexington, United States",
    destinationAddress: "Brussels, Belgium", requestedDepartureAt: "2026-10-22T08:15:00+07:00",
    transportMode: "COMBINED", recipientName: "Taylor Morgan", recipientPhone: "+32 2 555 2068",
    recipientEmail: null, horseIds: ["preview-horse-5", "preview-horse-6", "preview-horse-3", "preview-horse-4"], status: "IN_PROGRESS",
  },
  {
    id: "preview-balance-order", orderCode: "ORD-2061", originAddress: "Saumur, France",
    destinationAddress: "Amsterdam, Netherlands", requestedDepartureAt: "2026-10-22T08:30:00+07:00",
    transportMode: "ROAD", recipientName: "Camille Laurent", recipientPhone: "+31 20 555 2061",
    recipientEmail: null, horseIds: ["preview-horse-1"], status: "READY_TO_SHIP",
  },
  {
    id: "preview-refund-order", orderCode: "ORD-2058", originAddress: "Lexington, United States",
    destinationAddress: "Brussels, Belgium", requestedDepartureAt: "2026-10-19T09:00:00+07:00",
    transportMode: "COMBINED", recipientName: "Morgan Taylor", recipientPhone: "+32 2 555 2058",
    recipientEmail: null, horseIds: ["preview-horse-1", "preview-horse-2"], status: "CANCELLED",
  },
  {
    id: "preview-order-1", orderCode: "ORD-DEMO-1042", originAddress: "Lexington, KY",
    destinationAddress: "Nashville, TN", requestedDepartureAt: "2026-10-08T09:00:00",
    transportMode: "ROAD", recipientName: "Jordan Lee", recipientPhone: "+1 555 010 2048",
    recipientEmail: null, horseIds: ["preview-horse-1"], status: "DRAFT",
  },
  {
    id: "preview-order-2", orderCode: "ORD-DEMO-1038", originCountry: "France",
    destinationCountry: "Netherlands", transportMode: "COMBINED", recipientName: "Alex Morgan",
    recipientPhone: "+31 20 555 0142", horseIds: ["preview-horse-1", "preview-horse-2"], status: "SUBMITTED",
  },
  {
    id: "preview-order-3", orderCode: "ORD-DEMO-1024", originCountry: "United Kingdom",
    destinationCountry: "Belgium", transportMode: "ROAD", recipientName: "Taylor Reed",
    recipientPhone: "+32 2 555 0175", horseIds: ["preview-horse-2"], status: "QUOTATION_SENT",
  },
  {
    id: "preview-order-4", orderCode: "ORD-DEMO-1019", originCountry: "Ireland",
    destinationCountry: "France", transportMode: "COMBINED", recipientName: "Morgan Ellis",
    recipientPhone: "+33 1 55 01 27 40", horseIds: ["preview-horse-1", "preview-horse-2"], status: "APPROVED",
  },
];

const previewQuotation: Quotation = {
  id: "preview-quotation-1", orderId: "preview-order-3", totalAmount: 4800,
  depositAmount: 1200, remainingAmount: 3600, currency: "USD", notes: "Estimated delivery window: 2–3 days.",
  status: "SENT", sentAt: "2026-09-24T14:30:00", lineItems: [
    { id: "preview-line-1", sequenceNo: 1, description: "Horse transport", amount: 3900 },
    { id: "preview-line-2", sequenceNo: 2, description: "Documentation and handling", amount: 900 },
  ],
};

function isLocalPreviewRequested() {
  return process.env.NODE_ENV === "development"
    && typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("preview") === "1";
}

async function customerFetch(path: string, init?: RequestInit) {
  if (isLocalPreviewRequested()) {
    throw new Error("Preview mode is read-only for backend requests.");
  }
  const token = getAccessToken();
  if (!token) throw new Error("Please sign in to continue.");
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init?.body) headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  const response = await apiFetch(path, { ...init, headers });
  if (response.status === 401) {
    clearAccessToken();
    throw new Error("Your session has expired. Please sign in again.");
  }
  if (!response.ok) {
    let message = "We couldn't complete that request. Please review the details and try again.";
    try {
      const error = await response.json() as { message?: string; code?: string };
      if (error.code === "DUPLICATE_MICROCHIP") message = "That microchip ID is already registered.";
      else if (error.code === "ORDER_NOT_EDITABLE") message = "Only draft orders can be edited.";
      else if (error.code === "DEPOSIT_PAYMENT_NOT_FOUND") message = "DEPOSIT_PAYMENT_NOT_FOUND";
      else if (error.message) message = error.message;
    } catch { /* Keep the useful default message. */ }
    throw new Error(message);
  }
  return response.status === 204 ? null : response.json();
}

export default function CustomerPage() {
  const router = useRouter();
  const [horses, setHorses] = useState<Horse[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [horseFormOpen, setHorseFormOpen] = useState(false);
  const [orderFormOpen, setOrderFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<string | null>(null);
  const [orderFields, setOrderFields] = useState<OrderFields>(emptyOrder);
  const [horseBusy, setHorseBusy] = useState(false);
  const [orderBusy, setOrderBusy] = useState(false);
  const [submitWarning, setSubmitWarning] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [formError, setFormError] = useState("");
  const [quoteOrder, setQuoteOrder] = useState<Order | null>(null);
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [quotationBusy, setQuotationBusy] = useState(false);
  const [quotationError, setQuotationError] = useState("");
  const [deposit, setDeposit] = useState<DepositPayment | null>(null);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositBusy, setDepositBusy] = useState(false);
  const [depositError, setDepositError] = useState("");
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [documentOrder, setDocumentOrder] = useState<Order | null>(null);
  const [remainingBalances, setRemainingBalances] = useState<Record<string, RemainingBalanceSummary>>({});
  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [orderGroup, setOrderGroup] = useState<CustomerOrderGroup>("active");
  const groupedOrders = useMemo(() => customerOrdersInGroup(orders, orderGroup), [orders, orderGroup]);

  const visibleOrders = useMemo(
    () => filterCustomerOrders(groupedOrders, orderQuery, orderStatus),
    [orderQuery, orderStatus, groupedOrders],
  );
  const availableStatuses = useMemo(
    () => Array.from(new Set(groupedOrders.map((order) => order.status))),
    [groupedOrders],
  );
  const dashboardSummary = useMemo(() => ({
    drafts: orders.filter((order) => order.status === "DRAFT").length,
    inProgress: orders.filter((order) => order.status === "IN_PROGRESS").length,
  }), [orders]);

  const loadWorkspace = useCallback(async () => {
    if (preview || isLocalPreviewRequested()) {
      setPreview(true);
      if (!preview) {
        setHorses(previewHorses);
        setOrders(previewOrders);
      }
      setLoading(false);
      return;
    }
    if (!getAccessToken()) {
      router.replace("/login?next=/customer");
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const currentUser = await getCurrentUser();
      if (currentUser.role !== "CUSTOMER") {
        router.replace(currentUser.role === "LOGISTICS_MANAGER" ? "/logistics" : "/login");
        return;
      }
      const [horseData, orderData] = await Promise.all([
        customerFetch("/api/v1/horses"), customerFetch("/api/v1/orders"),
      ]) as [Horse[], Order[]];
      setHorses(horseData);
      setOrders(orderData);
      const balanceResults = await Promise.allSettled(orderData
        .filter((order) => order.status === "APPROVED")
        .map(async (order) => [
          order.id,
          await customerFetch(`/api/v1/orders/${order.id}/remaining-balance`) as RemainingBalanceSummary,
        ] as const));
      setRemainingBalances(Object.fromEntries(balanceResults
        .filter((result): result is PromiseFulfilledResult<readonly [string, RemainingBalanceSummary]> => result.status === "fulfilled")
        .map((result) => result.value)));
    } catch (error) {
      if (!getAccessToken()) {
        router.replace("/login");
        return;
      }
      setLoadError(error instanceof Error ? error.message : "We couldn't load your workspace.");
    } finally {
      setLoading(false);
    }
  }, [preview, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadWorkspace(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadWorkspace]);

  async function createHorse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setHorseBusy(true); setFormError(""); setFeedback("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = {
      name: String(data.get("name") ?? "").trim(),
      microchipId: String(data.get("microchipId") ?? "").trim(),
      passportNumber: String(data.get("passportNumber") ?? "").trim() || null,
      breed: String(data.get("breed") ?? "").trim() || null,
      sex: String(data.get("sex") ?? "").trim() || null,
      dateOfBirth: String(data.get("dateOfBirth") ?? "") || null,
      notes: String(data.get("notes") ?? "").trim() || null,
    };
    if (preview) {
      setHorses((current) => [...current, { ...body, id: `preview-horse-${Date.now()}` }]);
      form.reset(); setHorseFormOpen(false); setFeedback("Preview only — this horse profile was not saved.");
      setHorseBusy(false); return;
    }
    try {
      await customerFetch("/api/v1/horses", { method: "POST", body: JSON.stringify(body) });
      form.reset(); setHorseFormOpen(false); setFeedback("Horse profile saved.");
      await loadWorkspace();
    } catch (error) { setFormError(error instanceof Error ? error.message : "We couldn't save the horse."); }
    finally { setHorseBusy(false); }
  }

  function startNewOrder() {
    setEditingOrder(null); setOrderFields(emptyOrder); setFormError(""); setFeedback(""); setOrderFormOpen(true);
  }

  function startEdit(order: Order) {
    setEditingOrder(order.id);
    setOrderFields({
      originAddress: order.originAddress ?? "", originCountry: order.originCountry ?? "",
      destinationAddress: order.destinationAddress ?? "", destinationCountry: order.destinationCountry ?? "",
      requestedDepartureAt: order.requestedDepartureAt ? order.requestedDepartureAt.slice(0, 16) : "",
      transportMode: order.transportMode ?? null, specialRequirements: order.specialRequirements ?? "",
      recipientName: order.recipientName ?? "", recipientPhone: order.recipientPhone ?? "",
      recipientEmail: order.recipientEmail ?? "", horseIds: [...order.horseIds],
    });
    setFormError(""); setFeedback(""); setOrderFormOpen(true);
  }

  function updateField<K extends keyof OrderFields>(key: K, value: OrderFields[K]) {
    setOrderFields((current) => ({ ...current, [key]: value }));
  }

  function validateForSubmit() {
    const missing = [
      [!orderFields.originAddress?.trim() && !orderFields.originCountry?.trim(), "origin"],
      [!orderFields.destinationAddress?.trim() && !orderFields.destinationCountry?.trim(), "destination"],
      [!orderFields.requestedDepartureAt, "departure date and time"],
      [!orderFields.transportMode, "transport mode"],
      [orderFields.horseIds.length === 0, "at least one horse"],
      [!orderFields.recipientName?.trim(), "recipient name"],
      [!orderFields.recipientPhone?.trim(), "recipient phone"],
    ].filter(([absent]) => absent).map(([, label]) => label);
    if (missing.length) { setFormError(`Complete the required details before submitting: ${missing.join(", ")}.`); return false; }
    return true;
  }

  async function saveOrder(event: FormEvent<HTMLFormElement>, submit = false) {
    event.preventDefault(); setOrderBusy(true); setFormError(""); setFeedback("");
    const body = {
      ...orderFields,
      originAddress: orderFields.originAddress?.trim() || null,
      originCountry: orderFields.originCountry?.trim() || null,
      destinationAddress: orderFields.destinationAddress?.trim() || null,
      destinationCountry: orderFields.destinationCountry?.trim() || null,
      requestedDepartureAt: orderFields.requestedDepartureAt ? `${orderFields.requestedDepartureAt}:00` : null,
      specialRequirements: orderFields.specialRequirements?.trim() || null,
      recipientName: orderFields.recipientName?.trim() || null,
      recipientPhone: orderFields.recipientPhone?.trim() || null,
      recipientEmail: orderFields.recipientEmail?.trim() || null,
    };
    if (preview) {
      const orderId = editingOrder ?? `preview-order-${Date.now()}`;
      const existing = orders.find((order) => order.id === orderId);
      const previewOrder: Order = {
        ...body, id: orderId, orderCode: existing?.orderCode ?? "ORD-DEMO-NEW",
        horseIds: orderFields.horseIds, status: submit ? "SUBMITTED" : "DRAFT",
      };
      setOrders((current) => existing
        ? current.map((order) => order.id === orderId ? previewOrder : order)
        : [previewOrder, ...current]);
      setFeedback(submit
        ? "Preview only — the sample order is shown as submitted and locked; nothing was sent."
        : "Preview only — draft changes are temporary and were not saved.");
      setOrderFormOpen(false); setSubmitWarning(false); setEditingOrder(null); setOrderBusy(false);
      return;
    }
    try {
      let orderId = editingOrder;
      if (orderId) {
        await customerFetch(`/api/v1/orders/${orderId}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        const created = await customerFetch("/api/v1/orders", { method: "POST", body: JSON.stringify(body) }) as Order;
        orderId = created.id;
      }
      if (submit && orderId) {
        await customerFetch(`/api/v1/orders/${orderId}/submit`, { method: "POST" });
        setFeedback("Order submitted. Editing is now locked.");
      } else {
        setFeedback("Draft saved. You can return to edit it before submitting.");
      }
      setOrderFormOpen(false); setSubmitWarning(false); setEditingOrder(null);
      await loadWorkspace();
    } catch (error) { setFormError(error instanceof Error ? error.message : "We couldn't save this order."); setSubmitWarning(false); }
    finally { setOrderBusy(false); }
  }

  function requestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateForSubmit()) return;
    setSubmitWarning(true);
  }

  function confirmSubmit() {
    const form = document.getElementById("order-form") as HTMLFormElement | null;
    if (form) void saveOrder({ preventDefault() {}, currentTarget: form } as FormEvent<HTMLFormElement>, true);
  }

  async function openQuotation(order: Order) {
    setQuoteOrder(order); setQuotation(null); setQuotationError(""); setQuotationBusy(true);
    setDeposit(null); setDepositError(""); setDepositLoading(!preview);
    try {
      const quote = preview ? previewQuotation : await customerFetch(`/api/v1/orders/${order.id}/quotation`) as Quotation;
      if (quote.status !== "SENT") throw new Error("This quotation is not available yet.");
      setQuotation(quote);
    } catch (error) {
      setQuotationError(error instanceof Error ? error.message : "We couldn't load this quotation.");
    } finally { setQuotationBusy(false); }
    if (!preview) {
      try {
        const payment = await customerFetch(`/api/v1/orders/${order.id}/deposit`) as DepositPayment;
        setDeposit(payment);
      } catch (error) {
        // No deposit record exists until the Customer starts checkout.
        const message = error instanceof Error ? error.message : "We couldn't load payment status.";
        if (!message.includes("DEPOSIT_PAYMENT_NOT_FOUND")) setDepositError(message);
      } finally { setDepositLoading(false); }
    }
  }

  async function startDepositCheckout() {
    if (!quoteOrder || !quotation || preview) return;
    setDepositBusy(true); setDepositError("");
    try {
      const checkout = await customerFetch(`/api/v1/orders/${quoteOrder.id}/deposit/checkout`, { method: "POST" }) as DepositCheckout;
      if (!checkout.checkoutUrl) throw new Error("Checkout could not be opened. Please try again.");
      window.location.assign(checkout.checkoutUrl);
    } catch (error) {
      setDepositError(error instanceof Error ? error.message : "We couldn't start deposit checkout.");
      setDepositBusy(false);
    }
  }

  async function refreshDepositStatus() {
    if (!quoteOrder || preview) return;
    setDepositLoading(true); setDepositError("");
    try {
      const payment = await customerFetch(`/api/v1/orders/${quoteOrder.id}/deposit`) as DepositPayment;
      setDeposit(payment);
      await loadWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "We couldn't refresh payment status.";
      if (message === "DEPOSIT_PAYMENT_NOT_FOUND") setDeposit(null);
      else setDepositError(message);
    } finally { setDepositLoading(false); }
  }

  async function confirmCancel() {
    if (!cancelOrder) return;
    setCancelBusy(true); setCancelError("");
    try {
      if (preview) {
        setOrders((current) => current.map((order) => order.id === cancelOrder.id ? { ...order, status: "CANCELLED" } : order));
        setFeedback("Preview only — the sample order is shown as cancelled; nothing was sent.");
      } else {
        await customerFetch(`/api/v1/orders/${cancelOrder.id}/cancel`, { method: "POST" });
        setFeedback("Order cancelled.");
        await loadWorkspace();
      }
      setCancelOrder(null);
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : "We couldn't cancel this order.");
    } finally { setCancelBusy(false); }
  }

  function actionsFor(order: Order): CustomerOrderAction[] {
    const actions: CustomerOrderAction[] = [];
    const balance = remainingBalances[order.id];
    const trackable = ["READY_TO_SHIP", "IN_PROGRESS", "DELIVERED"].includes(order.status);
    if ((preview && order.id === "preview-balance-order") || (!preview && balance?.checkoutEligible)) {
      actions.push({ label: "Pay remaining balance", href: `/customer/orders/${order.id}/remaining-balance${preview ? "?preview=1" : ""}` });
    }
    if (order.status === "DRAFT") actions.push({ label: "Edit draft", onClick: () => startEdit(order) });
    if (order.status === "QUOTATION_SENT") actions.push({ label: "View bill", onClick: () => void openQuotation(order) });
    if (trackable && (!preview || order.id === "order-2068")) {
      actions.push({ label: "Track journey", href: `/customer/orders/${order.id}/tracking${preview ? "?preview=1" : ""}` });
    }
    if (["APPROVED", "READY_TO_SHIP", "IN_PROGRESS", "DELIVERED"].includes(order.status)) {
      actions.push({ label: "Manage documents", onClick: () => setDocumentOrder(order) });
    }
    if (!preview && (balance?.paymentStatus === "PAID" || trackable)) {
      actions.push({ label: "View payment", href: `/customer/orders/${order.id}/remaining-balance`, secondary: true });
    }
    if (preview && order.status === "CANCELLED") {
      actions.push({ label: "View cancellation & refund", href: `/customer/orders/${order.id}?preview=1`, secondary: true });
    }
    if (["DRAFT", "SUBMITTED", "QUOTATION_SENT"].includes(order.status)) {
      actions.push({ label: "Cancel order", secondary: true, onClick: () => { setCancelOrder(order); setCancelError(""); } });
    }
    return actions;
  }

  function signOut() { clearAccessToken(); router.replace("/login"); }

  return (
    <main className="customer-page customer-dashboard-page">
      <header className="customer-topbar">
        <Link className="customer-brand" href="/" aria-label="Horse Transport System home">
          <BrandMark /><span>Horse Transport System</span>
        </Link>
        <nav className="customer-dashboard-nav" aria-label="Customer workspace sections"><a href="#requests"><CustomerIcon name="truck" />Transport requests</a><a href="#horses"><CustomerIcon name="horse" />Horse profiles</a></nav>
        <div className="customer-topbar-actions"><span className="customer-role"><CustomerIcon name="user" />Customer</span><button type="button" className="customer-link-button" onClick={signOut}><CustomerIcon name="logout" />Sign out</button></div>
      </header>

      <div className="customer-content customer-dashboard-content">
        {preview && <div className="customer-preview-banner" role="status"><strong>Preview mode</strong><span>Sample data only. Changes stay in this tab and are not sent to the backend.</span></div>}
        <section className="customer-heading-row customer-dashboard-heading" aria-labelledby="customer-workspace-heading">
          <div className="customer-hero-copy"><p className="customer-eyebrow">CUSTOMER WORKSPACE</p><h1 id="customer-workspace-heading">Your transport workspace</h1><p className="customer-intro">Create requests, follow each journey, and keep horse information ready in one place.</p><span className="customer-hero-accent" aria-hidden="true" /></div>
          <div className="customer-hero-art" aria-hidden="true" />
          <button className="customer-primary-button" type="button" onClick={startNewOrder}><CustomerIcon name="plus" />New transport request</button>
        </section>

        {feedback && <p className="customer-feedback" role="status">{feedback}</p>}
        {loadError && <div className="customer-alert" role="alert"><span>{loadError}</span><button type="button" onClick={() => void loadWorkspace()}>Try again</button></div>}
        {loading ? <div className="customer-loading customer-dashboard-loading" role="status">Loading your workspace…</div> : <>
          <section className="customer-dashboard-summary" aria-label="Workspace summary">
            <article><span className="customer-summary-icon"><CustomerIcon name="orders" /></span><div><strong>{orders.length}</strong><span>Total requests</span></div></article>
            <article><span className="customer-summary-icon is-amber"><CustomerIcon name="draft" /></span><div><strong>{dashboardSummary.drafts}</strong><span>Draft requests</span></div></article>
            <article><span className="customer-summary-icon is-green"><CustomerIcon name="journey" /></span><div><strong>{dashboardSummary.inProgress}</strong><span>In progress</span></div></article>
            <article><span className="customer-summary-icon is-violet"><CustomerIcon name="horse" /></span><div><strong>{horses.length}</strong><span>Horse profiles</span></div></article>
          </section>

          <div className="customer-dashboard-grid">
          <section className="customer-section customer-dashboard-panel customer-orders-panel" id="requests" aria-labelledby="orders-heading">
            <div className="customer-section-heading customer-dashboard-panel-heading"><span className="customer-panel-icon" aria-hidden="true"><CustomerIcon name="truck" /></span><div><h2 id="orders-heading">Transport requests</h2><p>Review status and continue with the actions available for each request.</p></div><span className="customer-count">{orders.length} {orders.length === 1 ? "request" : "requests"}</span></div>
            {orders.length > 0 && <div className="customer-request-groups" role="group" aria-label="Request groups">
              {customerOrderGroups.map((group) => <button key={group.id} type="button" aria-pressed={orderGroup === group.id} onClick={() => { setOrderGroup(group.id); setOrderStatus(""); }} aria-controls="customer-request-results">{group.label}<span>{customerOrdersInGroup(orders, group.id).length}</span></button>)}
            </div>}
            {orders.length > 0 && <div className="customer-order-toolbar"><label className="customer-order-search"><span className="sr-only">Search transport requests</span><CustomerIcon name="search" /><input type="search" value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} placeholder="Search order, route, or recipient" autoComplete="off" /></label><label className="customer-order-status-filter"><span className="sr-only">Filter transport requests by status</span><select value={orderStatus} onChange={(event) => setOrderStatus(event.target.value)}><option value="">All statuses</option>{availableStatuses.map((status) => <option value={status} key={status}>{status.replaceAll("_", " ")}</option>)}</select></label></div>}
            <div id="customer-request-results">
            {orders.length === 0 ? <div className="customer-empty customer-dashboard-empty"><Image className="customer-empty-art" src="/images/customer-transport-illustration.svg" width={900} height={300} alt="" unoptimized /><div><h3>Start with a transport request</h3><p>Your saved and submitted requests will appear here.</p></div><button className="customer-primary-button" type="button" onClick={startNewOrder}><CustomerIcon name="plus" />Create request</button></div> : visibleOrders.length === 0 ? <div className="customer-empty customer-filter-empty"><span className="customer-empty-icon"><CustomerIcon name="search" /></span><div><h3>{groupedOrders.length === 0 ? "No requests in this group" : "No matching requests"}</h3><p>{groupedOrders.length === 0 ? "Check another group or view all requests." : "Try a different search term or status."}</p></div><button className="customer-secondary-button compact" type="button" onClick={() => { setOrderQuery(""); setOrderStatus(""); if (groupedOrders.length === 0) setOrderGroup("all"); }}>{groupedOrders.length === 0 ? "View all requests" : "Clear filters"}</button></div> : <div className="customer-order-list">
              {visibleOrders.map((order) => <article className="customer-order-row customer-dashboard-order" key={order.id}>
                <div className="order-route-icon" aria-hidden="true"><CustomerIcon name="route" /></div>
                <div className="customer-order-main"><div className="customer-order-title"><h3>{order.orderCode}</h3><span className={`order-status status-${order.status.toLowerCase()}`}>{order.status.replaceAll("_", " ")}</span></div><p>{[order.originAddress || order.originCountry || "Origin pending", order.destinationAddress || order.destinationCountry || "Destination pending"].join("  →  ")}</p><div className="customer-order-meta"><span>{order.horseIds.length} {order.horseIds.length === 1 ? "horse" : "horses"}</span>{order.transportMode && <span>{order.transportMode}</span>}<span><CustomerIcon name="calendar" />{order.requestedDepartureAt ? new Date(order.requestedDepartureAt).toLocaleString() : "Departure not set"}</span></div></div>
                <CustomerOrderActions orderCode={order.orderCode} actions={actionsFor(order)} />
              </article>)}
            </div>}
            </div>
            {orders.length > 0 && <p className="customer-request-count" role="status">Showing {visibleOrders.length} of {groupedOrders.length} requests in this group · {orders.length} total loaded</p>}
          </section>

          <section className="customer-section horse-section customer-dashboard-panel customer-horses-panel" id="horses" aria-labelledby="horses-heading">
            <div className="customer-section-heading customer-dashboard-panel-heading"><span className="customer-panel-icon" aria-hidden="true"><CustomerIcon name="horse" /></span><div><h2 id="horses-heading">Horse profiles</h2><p>Profiles available for transport requests.</p></div><button className="customer-secondary-button compact" type="button" onClick={() => { setHorseFormOpen((open) => !open); setFormError(""); }}>{!horseFormOpen && <CustomerIcon name="plus" />}{horseFormOpen ? "Close" : "Add horse"}</button></div>
            {horseFormOpen && <form className="customer-form horse-form" onSubmit={createHorse}>
              <div className="customer-form-title"><h3>New horse profile</h3><p>Name and microchip ID are required.</p></div>
              <div className="customer-field-grid"><Field label="Horse name" name="name" required maxLength={120} /><Field label="Microchip ID" name="microchipId" required maxLength={50} /><Field label="Passport number" name="passportNumber" maxLength={100} /><Field label="Breed" name="breed" maxLength={100} /><label className="customer-field"><span>Sex</span><select name="sex" defaultValue=""><option value="">Select if known</option><option value="MARE">Mare</option><option value="STALLION">Stallion</option><option value="GELDING">Gelding</option><option value="OTHER">Other</option></select></label><Field label="Date of birth" name="dateOfBirth" type="date" /></div>
              <label className="customer-field"><span>Notes <em>Optional</em></span><textarea name="notes" rows={3} /></label>
              {formError && <p className="customer-form-error" role="alert">{formError}</p>}
              <div className="customer-form-actions"><button type="button" className="customer-text-button" onClick={() => setHorseFormOpen(false)}>Cancel</button><button type="submit" className="customer-primary-button" disabled={horseBusy}>{horseBusy ? "Saving…" : "Save horse profile"}</button></div>
            </form>}
            {horses.length === 0 ? <div className="horse-empty"><Image className="customer-horse-art" src="/images/customer-horse-illustration.svg" width={360} height={180} alt="" unoptimized /><p>No horse profiles yet.</p><span>Add a profile before preparing a request.</span></div> : <ul className="horse-list">{horses.map((horse) => <li key={horse.id}><span className="horse-avatar" aria-hidden="true">{horse.name.slice(0, 1).toUpperCase()}</span><span className="horse-list-name"><strong>{horse.name}</strong><small>Microchip · {horse.microchipId}</small></span><span className="horse-breed">{horse.breed || "Breed not specified"}</span></li>)}</ul>}
          </section>
          </div>
        </>}

        {orderFormOpen && <div className="customer-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !orderBusy) setOrderFormOpen(false); }}>
          <section className="customer-dialog" role="dialog" aria-modal="true" aria-labelledby="order-form-title">
            <div className="customer-dialog-header"><div><p className="customer-eyebrow">{editingOrder ? "DRAFT ORDER" : "NEW REQUEST"}</p><h2 id="order-form-title">{editingOrder ? "Edit transport request" : "Plan a transport"}</h2><p>Save details as a draft. You can edit the request until it is submitted.</p></div><button type="button" className="customer-dialog-close" aria-label="Close form" disabled={orderBusy} onClick={() => setOrderFormOpen(false)}>×</button></div>
            <form id="order-form" className="customer-form order-form" onSubmit={requestSubmit}>
              <fieldset className="customer-fieldset"><legend>Journey details</legend><p className="field-hint">* Required to submit. Enter an address or a country for each location.</p><div className="customer-field-grid"><Field label="Origin address" value={orderFields.originAddress ?? ""} onChange={(value) => updateField("originAddress", value)} maxLength={255} /><Field label="Origin country" value={orderFields.originCountry ?? ""} onChange={(value) => updateField("originCountry", value)} maxLength={100} /><Field label="Destination address" value={orderFields.destinationAddress ?? ""} onChange={(value) => updateField("destinationAddress", value)} maxLength={255} /><Field label="Destination country" value={orderFields.destinationCountry ?? ""} onChange={(value) => updateField("destinationCountry", value)} maxLength={100} /><Field label="Requested departure *" type="datetime-local" value={orderFields.requestedDepartureAt ?? ""} onChange={(value) => updateField("requestedDepartureAt", value)} /><label className="customer-field"><span>Transport mode <b aria-hidden="true">*</b></span><select value={orderFields.transportMode ?? ""} onChange={(event) => updateField("transportMode", (event.target.value || null) as OrderFields["transportMode"])}><option value="">Choose a mode</option><option value="ROAD">Road</option><option value="AIR">Air</option><option value="COMBINED">Combined</option></select></label></div></fieldset>
              <fieldset className="customer-fieldset"><legend>Horses</legend>{horses.length ? <div className="horse-choice-list">{horses.map((horse) => <label className="horse-choice" key={horse.id}><input type="checkbox" checked={orderFields.horseIds.includes(horse.id)} onChange={(event) => updateField("horseIds", event.target.checked ? [...orderFields.horseIds, horse.id] : orderFields.horseIds.filter((id) => id !== horse.id))} /><span><strong>{horse.name}</strong><small>{horse.microchipId}</small></span></label>)}</div> : <p className="field-hint">Add a horse profile before submitting this request.</p>}</fieldset>
              <fieldset className="customer-fieldset"><legend>Recipient / delivery contact</legend><div className="customer-field-grid"><Field label="Recipient name *" value={orderFields.recipientName ?? ""} onChange={(value) => updateField("recipientName", value)} maxLength={150} /><Field label="Phone *" type="tel" value={orderFields.recipientPhone ?? ""} onChange={(value) => updateField("recipientPhone", value)} maxLength={30} /><Field label="Email" type="email" value={orderFields.recipientEmail ?? ""} onChange={(value) => updateField("recipientEmail", value)} maxLength={150} optional /></div></fieldset>
              <label className="customer-field"><span>Special requirements <em>Optional</em></span><textarea rows={3} value={orderFields.specialRequirements ?? ""} onChange={(event) => updateField("specialRequirements", event.target.value)} /></label>
              {formError && <p className="customer-form-error" role="alert">{formError}</p>}
              <div className="customer-form-actions"><button type="button" className="customer-text-button" disabled={orderBusy} onClick={() => setOrderFormOpen(false)}>Cancel</button><button type="button" className="customer-secondary-button" disabled={orderBusy} onClick={(event) => void saveOrder({ preventDefault() {}, currentTarget: event.currentTarget.form! } as FormEvent<HTMLFormElement>)}>{orderBusy ? "Saving…" : "Save draft"}</button><button type="submit" className="customer-primary-button" disabled={orderBusy}>{orderBusy ? "Submitting…" : "Review & submit"}</button></div>
            </form>
          </section>
        </div>}

        {submitWarning && <div className="customer-dialog-backdrop warning-backdrop"><section className="customer-warning" role="alertdialog" aria-modal="true" aria-labelledby="submit-warning-title" aria-describedby="submit-warning-copy"><div className="warning-symbol" aria-hidden="true">!</div><h2 id="submit-warning-title">Submit this transport request?</h2><p id="submit-warning-copy">After you submit, the order moves to SUBMITTED and you will no longer be able to edit it. Check the horse, journey, and delivery contact details before continuing.</p>{formError && <p className="customer-form-error" role="alert">{formError}</p>}<div className="customer-form-actions"><button type="button" className="customer-secondary-button" disabled={orderBusy} onClick={() => setSubmitWarning(false)}>Go back and review</button><button type="button" className="customer-primary-button" disabled={orderBusy} onClick={confirmSubmit}>{orderBusy ? "Submitting…" : "Submit and lock order"}</button></div></section></div>}

        {cancelOrder && <div className="customer-dialog-backdrop warning-backdrop"><section className="customer-warning" role="alertdialog" aria-modal="true" aria-labelledby="cancel-warning-title" aria-describedby="cancel-warning-copy"><div className="warning-symbol" aria-hidden="true">!</div><h2 id="cancel-warning-title">Cancel {cancelOrder.orderCode}?</h2><p id="cancel-warning-copy">This will cancel the order. A cancelled order cannot be reopened.</p>{cancelError && <p className="customer-form-error" role="alert">{cancelError}</p>}<div className="customer-form-actions"><button type="button" className="customer-secondary-button" disabled={cancelBusy} onClick={() => setCancelOrder(null)}>Keep order</button><button type="button" className="customer-primary-button danger-button" disabled={cancelBusy} onClick={() => void confirmCancel()}>{cancelBusy ? "Cancelling…" : "Cancel order"}</button></div></section></div>}

        {quoteOrder && <div className="customer-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setQuoteOrder(null); }}><section className="customer-dialog quotation-dialog" role="dialog" aria-modal="true" aria-labelledby="quotation-title"><div className="customer-dialog-header"><div><p className="customer-eyebrow">ORDER {quoteOrder.orderCode}</p><h2 id="quotation-title">Transport bill</h2><p>Quotation sent by the transport team</p></div><button type="button" className="customer-dialog-close" aria-label="Close quotation" onClick={() => setQuoteOrder(null)}>×</button></div><div className="quotation-content">{quotationBusy ? <p role="status">Loading quotation…</p> : quotationError ? <p className="customer-form-error" role="alert">{quotationError}</p> : quotation && <><div className="quotation-line-list">{[...quotation.lineItems].sort((a, b) => a.sequenceNo - b.sequenceNo).map((item) => <div className="quotation-line" key={item.id}><span>{item.description}</span><strong>{formatMoney(item.amount, quotation.currency)}</strong></div>)}</div><div className="quotation-total"><span>Total</span><strong>{formatMoney(quotation.totalAmount, quotation.currency)}</strong></div><div className="quotation-payment-row"><span>Deposit due</span><strong>{formatMoney(quotation.depositAmount, quotation.currency)}</strong></div><div className="quotation-payment-row"><span>Remaining balance</span><strong>{formatMoney(quotation.remainingAmount, quotation.currency)}</strong></div>{quotation.notes && <div className="quotation-notes"><strong>Notes from the transport team</strong><p>{quotation.notes}</p></div>}{quotation.sentAt && <p className="quotation-sent-at">Sent {new Date(quotation.sentAt).toLocaleString()}</p>}</>}
            {!preview && quoteOrder.status === "QUOTATION_SENT" && <div className="deposit-checkout-panel" aria-live="polite">
              <div className="deposit-panel-heading"><div><strong>Deposit payment</strong><span>{depositLoading ? "Checking payment status…" : deposit?.status === "PAID" ? "Payment received" : deposit?.latestAttempt?.providerStatus === "CANCELLED" || deposit?.latestAttempt?.providerStatus === "EXPIRED" ? "Checkout was not completed" : deposit?.status === "PENDING" ? "Payment is awaiting confirmation" : "Pay the deposit to confirm this quotation"}</span></div>{deposit && <span className={`deposit-state ${deposit.status.toLowerCase()}`}>{deposit.status}</span>}</div>
              {depositError && <p className="customer-form-error" role="alert">{depositError}</p>}
              <div className="deposit-actions">
                {deposit && <button type="button" className="customer-secondary-button" disabled={depositLoading || depositBusy} onClick={() => void refreshDepositStatus()}>{depositLoading ? "Checking…" : "Refresh status"}</button>}
                {deposit?.status !== "PAID" && <button type="button" className="customer-primary-button" disabled={depositBusy || depositLoading} onClick={() => void startDepositCheckout()}>{depositBusy ? "Opening checkout…" : deposit?.latestAttempt?.providerStatus === "CANCELLED" || deposit?.latestAttempt?.providerStatus === "EXPIRED" ? "Retry deposit payment" : "Pay deposit"}</button>}
              </div>
              {deposit?.status === "PAID" && <p className="deposit-confirmation">The payment provider has confirmed your deposit. The order will update automatically.</p>}
            </div>}
            {preview && <div className="deposit-checkout-panel preview-payment"><strong>Deposit checkout preview</strong><p>Preview mode does not contact the payment service or open a checkout session.</p></div>}
          </div></section></div>}
        {documentOrder && <DocumentWorkspace
          orderId={documentOrder.id}
          orderCode={documentOrder.orderCode}
          horses={documentOrder.horseIds.map((id) => horses.find((horse) => horse.id === id)).filter((horse): horse is Horse => Boolean(horse)).map((horse) => ({ id: horse.id, name: horse.name }))}
          preview={preview}
          editable={documentOrder.status === "APPROVED"}
          onClose={() => setDocumentOrder(null)}
        />}
      </div>
    </main>
  );
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function Field({ label, name, type = "text", required = false, optional = false, maxLength, value, onChange }: {
  label: string; name?: string; type?: string; required?: boolean; optional?: boolean; maxLength?: number; value?: string; onChange?: (value: string) => void;
}) {
  return <label className="customer-field"><span>{label}{optional ? <em>Optional</em> : required ? <b aria-hidden="true"> *</b> : null}</span><input name={name} type={type} required={required} maxLength={maxLength} value={value} onChange={onChange ? (event) => onChange(event.target.value) : undefined} /></label>;
}
