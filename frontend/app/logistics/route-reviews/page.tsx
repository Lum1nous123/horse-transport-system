"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AssignmentWorkspaceFrame from "@/components/AssignmentWorkspaceFrame";
import {
  getLogisticsRouteReviewService,
  type RouteReviewSummary,
} from "@/lib/logistics-route-review/service";
import { useLogisticsAccess } from "@/lib/staff-assignment/use-logistics-access";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function RouteReviewQueuePage() {
  const { state: accessState, preview, message: accessMessage } = useLogisticsAccess();
  const service = useMemo(() => getLogisticsRouteReviewService(preview), [preview]);
  const [pending, setPending] = useState<RouteReviewSummary[]>([]);
  const [locked, setLocked] = useState<RouteReviewSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const queue = await service.listReviews();
      setPending(queue.pending);
      setLocked(queue.locked);
    } catch (caught) {
      setPending([]);
      setLocked([]);
      setError(caught instanceof Error ? caught.message : "We couldn't load Route Reviews.");
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    if (accessState !== "allowed") return;
    const timer = window.setTimeout(() => { void loadQueue(); }, 0);
    return () => window.clearTimeout(timer);
  }, [accessState, loadQueue]);

  if (accessState !== "allowed") {
    const checking = accessState === "checking";
    return (
      <main className="customer-page">
        <div className="customer-content assignment-access-state">
          <p className="customer-loading" role={checking ? "status" : "alert"}>{checking ? "Checking Logistics Manager access..." : accessMessage}</p>
          {!checking && <Link className="customer-secondary-button" href="/login">Return to sign in</Link>}
        </div>
      </main>
    );
  }

  const previewSuffix = preview ? "?preview=1" : "";

  return (
    <AssignmentWorkspaceFrame preview={preview} activeSection="reviews">
      <nav className="assignment-breadcrumb" aria-label="Breadcrumb">
        <Link href={`/logistics${previewSuffix}`}>Logistics</Link><span aria-hidden="true">/</span><span aria-current="page">Route Reviews</span>
      </nav>

      <header className="route-review-page-heading">
        <div><h1>Route Reviews</h1><p>Review submitted Route Plans before they are permanently locked.</p></div>
        <button className="customer-secondary-button" type="button" disabled={loading} onClick={() => void loadQueue()}>{loading ? "Refreshing..." : "Refresh queue"}</button>
      </header>

      {error && <div className="customer-alert" role="alert"><span>{error}</span><button type="button" onClick={() => void loadQueue()}>Try again</button></div>}

      {loading ? (
        <div className="route-review-queue-skeleton" role="status" aria-label="Loading Route Reviews"><span /><span /><span /></div>
      ) : !error && pending.length === 0 && locked.length === 0 ? (
        <section className="route-review-empty"><span aria-hidden="true">✓</span><div><h2>No Route Plans to review</h2><p>Submitted plans and locked results will appear here.</p></div></section>
      ) : !error && (
        <>
          <ReviewSection title="Pending review" description="Plans waiting for your decision." orders={pending} preview={preview} empty="No plans are waiting for review." />
          <ReviewSection title="Locked results" description="Approved plans retained with their automatic staffing result." orders={locked} preview={preview} empty="Confirmed plans will appear here." locked />
        </>
      )}
    </AssignmentWorkspaceFrame>
  );
}

function ReviewSection({ title, description, orders, preview, empty, locked = false }: {
  title: string;
  description: string;
  orders: RouteReviewSummary[];
  preview: boolean;
  empty: string;
  locked?: boolean;
}) {
  return (
    <section className="route-review-queue-section" aria-labelledby={`route-review-${locked ? "locked" : "pending"}`}>
      <div className="route-review-section-heading">
        <div><h2 id={`route-review-${locked ? "locked" : "pending"}`}>{title}</h2><p>{description}</p></div>
        <span>{orders.length}</span>
      </div>
      {orders.length === 0 ? <p className="route-review-section-empty">{empty}</p> : (
        <div className="route-review-table-wrap">
          <table className="route-review-queue-table">
            <thead><tr><th>Order</th><th>Route</th><th>Departure</th><th>Horses</th><th>Mode</th><th>FRC</th><th>{locked ? "Reviewed" : "Submitted"}</th><th><span className="sr-only">Action</span></th></tr></thead>
            <tbody>{orders.map((order) => {
              const query = preview ? "?preview=1" : "";
              return <tr key={order.orderId}>
                <td data-label="Order"><strong>{order.orderCode}</strong><small>{locked ? "Locked" : "Pending review"}</small></td>
                <td data-label="Route"><strong>{order.origin}</strong><small>→ {order.destination}</small></td>
                <td data-label="Departure"><time dateTime={order.requestedDepartureAt}>{formatDateTime(order.requestedDepartureAt)}</time></td>
                <td data-label="Horses">{order.horseCount}</td>
                <td data-label="Mode"><span className="route-review-mode">{order.transportMode}</span></td>
                <td data-label="FRC">{order.assignedFleetRouteCoordinatorName}</td>
                <td data-label={locked ? "Reviewed" : "Submitted"}>{formatDateTime(locked && order.reviewedAt ? order.reviewedAt : order.submittedAt)}</td>
                <td data-label="Action"><Link className="route-review-open" href={`/logistics/route-reviews/${order.orderId}${query}`}>{locked ? "View result" : "Review"}<span aria-hidden="true">→</span></Link>{locked && <Link className="route-review-open" href={`/logistics/orders/${order.orderId}/tracking${query}`}>Track journey <span aria-hidden="true">→</span></Link>}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
