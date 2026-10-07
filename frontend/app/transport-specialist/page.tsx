"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import TransportSpecialistWorkspaceFrame from "@/components/TransportSpecialistWorkspaceFrame";
import {
  transportSpecialistWorkspaceService,
  type AssignedSpecialistOrderSummary,
} from "@/lib/transport-specialist-workspace/service";
import { useTransportSpecialistAccess } from "@/lib/transport-specialist-workspace/use-specialist-access";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function TransportSpecialistPage() {
  const {
    state: accessState,
    preview,
    previewSpecialistId,
    previewSpecialistName,
    message: accessMessage,
  } = useTransportSpecialistAccess();
  const [actionRequired, setActionRequired] = useState<AssignedSpecialistOrderSummary[]>([]);
  const [finalConfirmed, setFinalConfirmed] = useState<AssignedSpecialistOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const queues = await transportSpecialistWorkspaceService.listAssignedOrders();
      setActionRequired(queues.actionRequired);
      setFinalConfirmed(queues.finalConfirmed);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't load your assigned Orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (accessState !== "allowed") return;
    const timer = window.setTimeout(() => { void loadQueue(); }, 0);
    return () => window.clearTimeout(timer);
  }, [accessState, loadQueue]);

  const awaitingReview = useMemo(
    () => actionRequired.reduce((total, order) => total + order.progress.pendingReview, 0),
    [actionRequired],
  );

  if (accessState === "checking") {
    return <main className="customer-page assignment-access-state"><p role="status">Checking Transport Specialist access…</p></main>;
  }

  if (accessState === "forbidden" || accessState === "failed") {
    return (
      <main className="customer-page assignment-access-state">
        <section className="assignment-access-card" role={accessState === "forbidden" ? "alert" : undefined}>
          <p className="customer-eyebrow">WORKSPACE UNAVAILABLE</p>
          <h1>{accessState === "forbidden" ? "Access denied" : "We couldn't verify access"}</h1>
          <p>{accessMessage}</p>
          <Link className="customer-primary-button" href="/login">Return to sign in</Link>
        </section>
      </main>
    );
  }

  const hasOrders = actionRequired.length > 0 || finalConfirmed.length > 0;

  return (
    <TransportSpecialistWorkspaceFrame preview={preview} previewSpecialistId={previewSpecialistId} previewSpecialistName={previewSpecialistName}>
      <header className="ts-heading-row ts-queue-heading">
        <div>
          <p className="customer-eyebrow">DOCUMENT PHASE</p>
          <h1>Assigned Orders</h1>
          <p className="customer-intro">Review only the Orders assigned to you and carry each document phase through Final Confirm.</p>
        </div>
        <button className="customer-secondary-button ts-refresh-button" type="button" disabled={loading} onClick={() => void loadQueue()}>
          <span aria-hidden="true">↻</span>
          {loading ? "Refreshing…" : "Refresh queue"}
        </button>
      </header>

      {error && (
        <div className="customer-alert" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void loadQueue()}>Try again</button>
        </div>
      )}

      {loading ? (
        <div className="ts-queue-skeleton" role="status" aria-label="Loading assigned Orders">
          <span /><span /><span />
        </div>
      ) : !error && !hasOrders ? (
        <div className="customer-empty ts-empty-state">
          <div className="customer-empty-icon" aria-hidden="true">✓</div>
          <div><h2>No assigned Orders</h2><p>Orders will appear here after a Logistics Manager assigns them to you.</p></div>
        </div>
      ) : !error && (
        <div className="ts-triage-dashboard">
          <dl className="ts-queue-summary" aria-label="Assigned Order summary">
            <div className="is-attention"><dt>Action required</dt><dd>{actionRequired.length}</dd></div>
            <div><dt>Awaiting review</dt><dd>{awaitingReview}</dd></div>
            <div><dt>Final confirmed</dt><dd>{finalConfirmed.length}</dd></div>
          </dl>

          <section className="ts-attention-section" aria-labelledby="ts-attention-heading">
            <div className="ts-dashboard-section-heading">
              <div>
                <h2 id="ts-attention-heading">Needs your attention</h2>
                <p>Continue the deadline, document review, or Final Confirm work for these assigned Orders.</p>
              </div>
              <span>{actionRequired.length} {actionRequired.length === 1 ? "Order" : "Orders"}</span>
            </div>
            {actionRequired.length === 0 ? (
              <div className="ts-dashboard-empty"><strong>You&apos;re all caught up.</strong><span>No assigned Orders currently need action.</span></div>
            ) : (
              <div className="ts-attention-list">
                {actionRequired.map((order) => <ActionOrderCard key={order.id} order={order} preview={preview} previewSpecialistId={previewSpecialistId} />)}
              </div>
            )}
          </section>

          <section className="ts-completed-section" aria-labelledby="ts-completed-heading">
            <div className="ts-dashboard-section-heading">
              <div>
                <h2 id="ts-completed-heading">Recently completed</h2>
                <p>Final Confirmed document phases remain available as locked, read-only records.</p>
              </div>
              <span>{finalConfirmed.length} {finalConfirmed.length === 1 ? "Record" : "Records"}</span>
            </div>
            {finalConfirmed.length === 0 ? (
              <div className="ts-dashboard-empty"><strong>No completed records yet.</strong><span>Final Confirmed Orders will remain available here.</span></div>
            ) : (
              <CompletedOrdersTable orders={finalConfirmed} preview={preview} previewSpecialistId={previewSpecialistId} />
            )}
          </section>
        </div>
      )}
    </TransportSpecialistWorkspaceFrame>
  );
}

function ActionOrderCard({ order, preview, previewSpecialistId }: { order: AssignedSpecialistOrderSummary; preview: boolean; previewSpecialistId: string }) {
  const previewSuffix = preview ? `?preview=1&specialistId=${encodeURIComponent(previewSpecialistId)}` : "";
  const progressPercent = order.progress.total === 0 ? 0 : Math.round((order.progress.approved / order.progress.total) * 100);
  const stateLabel = order.finalConfirmationStatus === "ELIGIBLE"
    ? "Ready for Final Confirm"
    : order.progress.pendingReview > 0
      ? `${order.progress.pendingReview} awaiting review`
      : "Documents in progress";

  return (
    <article className="ts-attention-card">
      <div className="ts-attention-card-topline">
        <div className="ts-order-code-line">
          <h3>{order.orderCode}</h3>
          <span className={`ts-state-badge ${order.finalConfirmationStatus === "ELIGIBLE" ? "is-eligible" : ""}`}>{stateLabel}</span>
        </div>
        <Link className="customer-primary-button ts-open-order-button" href={`/transport-specialist/orders/${order.id}${previewSuffix}`}>Open Order <span aria-hidden="true">→</span></Link>
      </div>
      <div className="ts-attention-card-body">
        <div className="ts-attention-route">
          <span>Route</span>
          <strong>{order.origin} <b aria-hidden="true">→</b> {order.destination}</strong>
          <small>{order.horseCount} {order.horseCount === 1 ? "horse" : "horses"} · {order.transportMode} · Departure {formatDateTime(order.requestedDepartureAt)}</small>
        </div>
        <div className="ts-attention-progress">
          <div><span>Documents approved</span><strong>{order.progress.approved}/{order.progress.total}</strong></div>
          <progress value={order.progress.approved} max={order.progress.total || 1} aria-label={`${progressPercent}% of required documents approved`} />
          <small>{order.documentCompletionDeadlineAt ? `Deadline ${formatDateTime(order.documentCompletionDeadlineAt)}` : "Deadline not set"}</small>
        </div>
      </div>
    </article>
  );
}

function CompletedOrdersTable({ orders, preview, previewSpecialistId }: { orders: AssignedSpecialistOrderSummary[]; preview: boolean; previewSpecialistId: string }) {
  const previewSuffix = preview ? `?preview=1&specialistId=${encodeURIComponent(previewSpecialistId)}` : "";

  return (
    <div className="ts-completed-table-wrap">
      <table className="ts-completed-table">
        <thead>
          <tr><th scope="col">Order</th><th scope="col">Route</th><th scope="col">Deadline</th><th scope="col">Completed</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Action</span></th></tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td data-label="Order"><strong>{order.orderCode}</strong></td>
              <td data-label="Route"><strong>{order.origin} <b aria-hidden="true">→</b> {order.destination}</strong><small>{order.horseCount} {order.horseCount === 1 ? "horse" : "horses"} · {order.transportMode} · Departure {formatDateTime(order.requestedDepartureAt)}</small></td>
              <td data-label="Deadline">{order.documentCompletionDeadlineAt ? formatDateTime(order.documentCompletionDeadlineAt) : "Not set"}</td>
              <td data-label="Completed">{order.finalConfirmedAt ? formatDateTime(order.finalConfirmedAt) : "—"}</td>
              <td data-label="Status"><span className="ts-state-badge is-locked">Final confirmed</span></td>
              <td data-label="Action"><Link href={`/transport-specialist/orders/${order.id}${previewSuffix}`}>View record <span aria-hidden="true">→</span></Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
