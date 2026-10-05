"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AssignmentWorkspaceFrame from "@/components/AssignmentWorkspaceFrame";
import {
  staffAssignmentService,
  type AssignmentOrderSummary,
} from "@/lib/staff-assignment/service";
import { useLogisticsAccess } from "@/lib/staff-assignment/use-logistics-access";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function StaffAssignmentQueuePage() {
  const { state: accessState, preview, message: accessMessage } = useLogisticsAccess();
  const [needsAssignment, setNeedsAssignment] = useState<AssignmentOrderSummary[]>([]);
  const [assigned, setAssigned] = useState<AssignmentOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadQueues = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const queues = await staffAssignmentService.listOrders();
      setNeedsAssignment(queues.needsAssignment);
      setAssigned(queues.assigned);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "We couldn't load staff assignments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (accessState !== "allowed") return;
    const timer = window.setTimeout(() => { void loadQueues(); }, 0);
    return () => window.clearTimeout(timer);
  }, [accessState, loadQueues]);

  if (accessState !== "allowed") {
    const isChecking = accessState === "checking";
    return (
      <main className="customer-page">
        <div className="customer-content assignment-access-state">
          <p className="customer-loading" role={isChecking ? "status" : "alert"}>
            {isChecking ? "Checking Logistics Manager access…" : accessMessage}
          </p>
          {!isChecking && <Link className="customer-secondary-button" href="/login">Return to sign in</Link>}
        </div>
      </main>
    );
  }

  const previewSuffix = preview ? "?preview=1" : "";

  return (
    <AssignmentWorkspaceFrame preview={preview}>
      <nav className="assignment-breadcrumb" aria-label="Breadcrumb">
        <Link href={`/logistics${previewSuffix}`}>Logistics</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Staff Assignment</span>
      </nav>

      <div className="assignment-page-heading">
        <div>
          <p className="customer-eyebrow">STAFFING</p>
          <h1>Staff Assignment</h1>
          <p className="customer-intro">Assign one Transport Specialist and one Fleet &amp; Route Coordinator to each order.</p>
        </div>
        <button className="customer-secondary-button" type="button" onClick={() => void loadQueues()} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh queue"}
        </button>
      </div>

      {error && (
        <div className="customer-alert" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void loadQueues()}>Try again</button>
        </div>
      )}

      <section className="assignment-queue-section" aria-labelledby="needs-assignment-heading">
        <div className="assignment-section-heading">
          <div>
            <h2 id="needs-assignment-heading">Needs assignment</h2>
            <p>Orders waiting for both required staff roles.</p>
          </div>
          <span className="assignment-count">{needsAssignment.length}</span>
        </div>

        {loading ? (
          <div className="assignment-loading-list" role="status" aria-label="Loading orders">
            <span /><span /><span />
          </div>
        ) : needsAssignment.length === 0 ? (
          <div className="assignment-empty-state">
            <span className="assignment-empty-mark" aria-hidden="true">✓</span>
            <div><h3>Assignment queue is clear</h3><p>New eligible orders will appear here when staffing is required.</p></div>
          </div>
        ) : (
          <OrderList orders={needsAssignment} preview={preview} readOnly={false} />
        )}
      </section>

      <section className="assignment-queue-section assigned-orders-section" aria-labelledby="assigned-orders-heading">
        <div className="assignment-section-heading">
          <div>
            <h2 id="assigned-orders-heading">Assigned orders</h2>
            <p>Open an order to review its saved TS and FRC pair.</p>
          </div>
          <span className="assignment-count">{assigned.length}</span>
        </div>
        {!loading && assigned.length === 0 ? (
          <p className="assignment-section-empty">Completed assignments will appear here.</p>
        ) : !loading ? (
          <OrderList orders={assigned} preview={preview} readOnly />
        ) : null}
      </section>
    </AssignmentWorkspaceFrame>
  );
}

function OrderList({ orders, preview, readOnly }: { orders: AssignmentOrderSummary[]; preview: boolean; readOnly: boolean }) {
  const previewSuffix = preview ? "?preview=1" : "";
  return (
    <ul className="assignment-order-list">
      {orders.map((order) => (
        <li key={order.id}>
          <Link href={`/logistics/assignments/${order.id}${previewSuffix}`}>
            <span className="assignment-order-main">
              <strong>{order.orderCode}</strong>
              <span>{order.origin} <b aria-hidden="true">→</b> {order.destination}</span>
            </span>
            <span className="assignment-order-meta">
              <span>{order.horseCount} {order.horseCount === 1 ? "horse" : "horses"}</span>
              <span>{order.transportMode}</span>
              <span>{formatDate(order.requestedDepartureAt)}</span>
            </span>
            <span className={`assignment-status${readOnly ? " is-assigned" : ""}`}>
              {readOnly ? "Assigned" : "Needs assignment"}
            </span>
            <span className="assignment-open-label">{readOnly ? "View assignment" : "Assign staff"} <b aria-hidden="true">→</b></span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
