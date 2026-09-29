"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { clearAccessToken, getAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

type DocumentOrder = {
  id: string;
  orderCode: string;
  status: "APPROVED";
  originAddress?: string | null;
  originCountry?: string | null;
  destinationAddress?: string | null;
  destinationCountry?: string | null;
  requestedDepartureAt?: string | null;
  horseCount: number;
  documentCompletionDeadlineAt?: string | null;
  documentDeadlineSetAt?: string | null;
  createdAt?: string | null;
};

export default function TransportSpecialistPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<DocumentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<DocumentOrder | null>(null);
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [feedback, setFeedback] = useState("");

  const loadOrders = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login?next=/transport-specialist");
      return;
    }
    setLoading(true); setLoadError("");
    try {
      const response = await apiFetch("/api/v1/orders/document-inbox", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (response.status === 401) {
        clearAccessToken();
        router.replace("/login?next=/transport-specialist");
        return;
      }
      if (!response.ok) throw new Error("We couldn't load the document work queue. Check that you signed in with a Transport Specialist account.");
      setOrders(await response.json() as DocumentOrder[]);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "We couldn't load the document work queue.");
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadOrders(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOrders]);

  function openDeadlineEditor(order: DocumentOrder) {
    setSelectedOrder(order);
    setDeadline("");
    setFormError("");
    setFeedback("");
  }

  async function saveDeadline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrder || !deadline) return;
    setSaving(true); setFormError(""); setFeedback("");
    try {
      const response = await apiFetch(`/api/v1/orders/${selectedOrder.id}/documents/deadline`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ documentCompletionDeadlineAt: `${deadline}:00` }),
      });
      if (response.status === 401) {
        clearAccessToken(); router.replace("/login?next=/transport-specialist"); return;
      }
      if (!response.ok) {
        let message = "We couldn't set this deadline. Please refresh the work queue and try again.";
        try {
          const error = await response.json() as { message?: string };
          if (error.message) message = error.message;
        } catch { /* Keep the useful default message. */ }
        throw new Error(message);
      }
      const result = await response.json() as { documentCompletionDeadlineAt: string; documentDeadlineSetAt: string };
      setOrders((current) => current.map((order) => order.id === selectedOrder.id
        ? { ...order, documentCompletionDeadlineAt: result.documentCompletionDeadlineAt, documentDeadlineSetAt: result.documentDeadlineSetAt }
        : order));
      setSelectedOrder((current) => current ? {
        ...current,
        documentCompletionDeadlineAt: result.documentCompletionDeadlineAt,
        documentDeadlineSetAt: result.documentDeadlineSetAt,
      } : null);
      setFeedback("Document deadline set.");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "We couldn't set the document deadline.");
    } finally { setSaving(false); }
  }

  function signOut() { clearAccessToken(); router.replace("/login"); }

  return (
    <main className="customer-page specialist-page">
      <header className="customer-topbar">
        <Link className="customer-brand" href="/" aria-label="Horse Transport System home">
          <span className="customer-brand-mark" aria-hidden="true">HT</span><span>Horse Transport System</span>
        </Link>
        <div className="customer-topbar-actions"><span>Transport Specialist</span><button type="button" className="customer-link-button" onClick={signOut}>Sign out</button></div>
      </header>

      <div className="customer-content">
        <div className="customer-heading-row specialist-heading">
          <div><p className="customer-eyebrow">DOCUMENT PHASE</p><h1>Document deadlines</h1><p className="customer-intro">Set one completion deadline for each approved transport order.</p></div>
          <button className="customer-secondary-button" type="button" onClick={() => void loadOrders()} disabled={loading}>{loading ? "Refreshing…" : "Refresh queue"}</button>
        </div>

        {feedback && <p className="customer-feedback" role="status">{feedback}</p>}
        {loadError && <div className="customer-alert" role="alert"><span>{loadError}</span><button type="button" onClick={() => void loadOrders()}>Try again</button></div>}
        {loading ? <div className="customer-loading" role="status">Loading document work queue…</div> : !loadError && orders.length === 0 ? <div className="customer-empty"><div className="customer-empty-icon" aria-hidden="true">✓</div><div><h3>No approved orders need a deadline</h3><p>Orders will appear here after their deposit has been confirmed.</p></div></div> : !loadError && <section className="customer-section" aria-labelledby="specialist-orders-heading">
          <div className="customer-section-heading"><div><h2 id="specialist-orders-heading">Approved orders</h2><p>Each order has one deadline shared by all horses in that order.</p></div><span className="customer-count">{orders.length} {orders.length === 1 ? "order" : "orders"}</span></div>
          <div className="customer-order-list specialist-order-list">
            {orders.map((order) => <article className="customer-order-row specialist-order-row" key={order.id}>
              <div className="order-route-icon" aria-hidden="true">✓</div>
              <div className="customer-order-main"><div className="customer-order-title"><h3>{order.orderCode}</h3><span className="order-status status-approved">APPROVED</span></div>
                <p>{[order.originAddress || order.originCountry || "Origin", order.destinationAddress || order.destinationCountry || "Destination"].join(" → ")}</p>
                <span className="customer-order-subline">{order.horseCount} {order.horseCount === 1 ? "horse" : "horses"}{order.requestedDepartureAt ? ` · Departure ${new Date(order.requestedDepartureAt).toLocaleString()}` : ""}</span>
              </div>
              <div className="specialist-deadline-action">
                {order.documentCompletionDeadlineAt ? <div className="specialist-deadline-value"><small>Deadline set</small><strong>{new Date(order.documentCompletionDeadlineAt).toLocaleString()}</strong></div> : <span className="deadline-missing">Deadline not set</span>}
                <button className={order.documentCompletionDeadlineAt ? "customer-secondary-button compact" : "customer-primary-button compact"} type="button" disabled={Boolean(order.documentCompletionDeadlineAt)} onClick={() => openDeadlineEditor(order)}>
                  {order.documentCompletionDeadlineAt ? "Set once only" : "Set deadline"}
                </button>
              </div>
            </article>)}
          </div>
        </section>}

        {selectedOrder && <div className="customer-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setSelectedOrder(null); }}><section className="customer-dialog deadline-dialog" role="dialog" aria-modal="true" aria-labelledby="deadline-title"><div className="customer-dialog-header"><div><p className="customer-eyebrow">ORDER {selectedOrder.orderCode}</p><h2 id="deadline-title">Set document deadline</h2><p>One deadline applies to all {selectedOrder.horseCount} {selectedOrder.horseCount === 1 ? "horse" : "horses"} in this order. It cannot be changed after saving.</p></div><button type="button" className="customer-dialog-close" aria-label="Close deadline form" disabled={saving} onClick={() => setSelectedOrder(null)}>×</button></div>
            {selectedOrder.documentCompletionDeadlineAt ? <div className="deadline-confirmed"><strong>Deadline set</strong><span>{new Date(selectedOrder.documentCompletionDeadlineAt).toLocaleString()}</span><button type="button" className="customer-secondary-button" onClick={() => setSelectedOrder(null)}>Done</button></div> : <form className="customer-form deadline-form" onSubmit={(event) => void saveDeadline(event)}>
              <label className="customer-field"><span>Document completion deadline <b aria-hidden="true">*</b></span><input type="datetime-local" required value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label>
              {formError && <p className="customer-form-error" role="alert">{formError}</p>}
              <div className="customer-form-actions"><button type="button" className="customer-text-button" disabled={saving} onClick={() => setSelectedOrder(null)}>Cancel</button><button type="submit" className="customer-primary-button" disabled={saving || !deadline}>{saving ? "Saving deadline…" : "Set deadline"}</button></div>
            </form>}
          </section></div>}
      </div>
    </main>
  );
}
