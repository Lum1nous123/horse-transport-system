"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import FleetRouteCoordinatorWorkspaceFrame from "@/components/FleetRouteCoordinatorWorkspaceFrame";
import {
  CoordinatorWorkspaceError,
  getFleetRouteCoordinatorService,
  type AssignedCoordinatorOrderDetail,
  type RoutePlanStatus,
} from "@/lib/fleet-route-coordinator/service";
import { useFleetRouteCoordinatorAccess } from "@/lib/fleet-route-coordinator/use-coordinator-access";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status: RoutePlanStatus) {
  if (status === "NOT_STARTED") return "Not started";
  if (status === "PENDING_LM_REVIEW") return "Awaiting LM review";
  if (status === "RETURNED") return "Returned by LM";
  return status.toLowerCase().replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

function contextTitle(status: RoutePlanStatus) {
  if (status === "NOT_STARTED") return "Ready to start route planning";
  if (status === "DRAFT") return "Continue the draft Route Plan";
  if (status === "RETURNED") return "Revise the returned Route Plan";
  if (status === "APPROVED") return "Route Plan approved";
  return "Route Plan awaiting review";
}

export default function FleetRouteCoordinatorOrderPage() {
  const params = useParams<{ orderId: string }>();
  const {
    state: accessState,
    preview,
    previewCoordinatorId,
    previewCoordinatorName,
    message: accessMessage,
  } = useFleetRouteCoordinatorAccess();
  const service = useMemo(() => getFleetRouteCoordinatorService(preview), [preview]);
  const [order, setOrder] = useState<AssignedCoordinatorOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [feedback, setFeedback] = useState("");

  const loadOrder = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    setErrorCode("");
    setFeedback("");
    try {
      const detail = await service.getAssignedPlanningContext(params.orderId);
      setOrder(detail);
      if (refresh) setFeedback("Planning context refreshed from the saved Order state.");
    } catch (caught) {
      if (!refresh) setOrder(null);
      setError(caught instanceof Error ? caught.message : "We couldn't load this planning context.");
      setErrorCode(caught instanceof CoordinatorWorkspaceError ? caught.code : "REQUEST_FAILED");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.orderId, service]);

  useEffect(() => {
    if (accessState !== "allowed") return;
    const timer = window.setTimeout(() => { void loadOrder(); }, 0);
    return () => window.clearTimeout(timer);
  }, [accessState, loadOrder]);

  const queueHref = preview
    ? `/fleet-route-coordinator?preview=1&coordinatorId=${encodeURIComponent(previewCoordinatorId)}`
    : "/fleet-route-coordinator";

  if (accessState === "checking") {
    return <main className="customer-page assignment-access-state"><p role="status">Checking Fleet &amp; Route Coordinator access...</p></main>;
  }

  if (accessState === "forbidden" || accessState === "failed") {
    return (
      <main className="customer-page assignment-access-state">
        <section className="assignment-access-card" role={accessState === "forbidden" ? "alert" : undefined}>
          <h1>{accessState === "forbidden" ? "Access denied" : "We couldn't verify access"}</h1>
          <p>{accessMessage}</p>
          <Link className="customer-primary-button" href="/login">Return to sign in</Link>
        </section>
      </main>
    );
  }

  return (
    <FleetRouteCoordinatorWorkspaceFrame preview={preview} previewCoordinatorId={previewCoordinatorId} previewCoordinatorName={previewCoordinatorName}>
      <nav className="frc-breadcrumb" aria-label="Breadcrumb"><Link href={queueHref}>Planning queue</Link><span aria-hidden="true">/</span><span aria-current="page">{order?.orderCode ?? "Planning context"}</span></nav>

      {loading ? (
        <div className="frc-detail-skeleton" role="status" aria-label="Loading planning context"><span /><span /><span /></div>
      ) : !order ? (
        <section className="frc-detail-unavailable" role="alert">
          <span aria-hidden="true">!</span>
          <h1>{errorCode === "STALE_STATE" ? "Planning state changed" : errorCode === "FORBIDDEN" ? "This Order isn't assigned to you" : "Planning context unavailable"}</h1>
          <p>{error}</p>
          <div><Link className="customer-primary-button" href={queueHref}>Back to planning queue</Link>{errorCode === "REQUEST_FAILED" && <button className="customer-secondary-button" type="button" onClick={() => void loadOrder()}>Try again</button>}</div>
        </section>
      ) : (
        <>
          <header className="frc-detail-heading">
            <div><span>{order.orderCode}</span><h1>{order.origin} <b aria-hidden="true">→</b> {order.destination}</h1><p>Planning context for the Order assigned to you.</p></div>
            <div><Link className="customer-secondary-button" href={queueHref}>Back to queue</Link><button className="customer-primary-button" type="button" disabled={refreshing} onClick={() => void loadOrder(true)}>{refreshing ? "Refreshing..." : "Refresh context"}</button></div>
          </header>

          {feedback && <p className="customer-feedback" role="status">{feedback}</p>}
          {error && <div className="customer-alert" role="alert"><span>{error}</span><button type="button" onClick={() => void loadOrder(true)}>Try again</button></div>}

          <section className={`frc-context-banner is-${order.routePlanStatus.toLowerCase()}`} aria-labelledby="frc-context-title">
            <div><span className={`frc-plan-status is-${order.routePlanStatus.toLowerCase()}`}>{statusLabel(order.routePlanStatus)}</span><h2 id="frc-context-title">{contextTitle(order.routePlanStatus)}</h2><p>{order.readOnly ? "This planning context is read-only because the saved Route Plan state is locked." : "Review the authoritative Order context before working on the Route Plan."}</p></div>
            {order.readOnly && <span className="frc-read-only-label">Read-only</span>}
          </section>

          {order.routePlanStatus === "RETURNED" && order.returnReason && <section className="frc-return-reason" aria-labelledby="frc-return-title"><span aria-hidden="true">↩</span><div><h2 id="frc-return-title">Returned by Logistics Manager</h2><p>{order.returnReason}</p></div></section>}

          <div className="frc-detail-grid">
            <section className="frc-order-context" aria-labelledby="frc-order-context-title">
              <div className="frc-section-heading"><h2 id="frc-order-context-title">Order context</h2><span>Remaining Balance paid</span></div>
              <dl>
                <div><dt>Departure</dt><dd>{formatDateTime(order.requestedDepartureAt)}</dd></div>
                <div><dt>Transport mode</dt><dd>{order.transportMode}</dd></div>
                <div><dt>Horses</dt><dd>{order.horseCount}</dd></div>
                <div><dt>Customer</dt><dd>{order.customerName}</dd></div>
                <div><dt>Transport Specialist</dt><dd>{order.assignedTransportSpecialistName}</dd></div>
                <div><dt>Fleet &amp; Route Coordinator</dt><dd>{order.assignedFleetRouteCoordinatorName}</dd></div>
                <div><dt>Documents Final Confirmed</dt><dd>{formatDateTime(order.documentFinalConfirmedAt)}</dd></div>
                <div><dt>Remaining Balance paid</dt><dd>{formatDateTime(order.remainingBalancePaidAt)}</dd></div>
              </dl>
            </section>

            <section className="frc-readiness" aria-labelledby="frc-readiness-title">
              <div className="frc-section-heading"><h2 id="frc-readiness-title">Planning readiness</h2><span>{order.readOnly ? "Locked" : "Ready"}</span></div>
              <ol>
                {order.readiness.map((item) => <li className={`is-${item.state}`} key={item.id}><span aria-hidden="true">{item.state === "complete" ? "✓" : item.state === "locked" ? "⌑" : "○"}</span><div><strong>{item.label}</strong><p>{item.description}</p></div></li>)}
              </ol>
              <div className="frc-editor-handoff"><strong>{order.readOnly ? "No planning changes are available" : "Planning context is ready"}</strong><p>{order.readOnly ? "Refresh after the Logistics Manager decision changes the persisted state." : "Review these authoritative details before continuing into Route Plan editing and validation."}</p></div>
            </section>
          </div>
        </>
      )}
    </FleetRouteCoordinatorWorkspaceFrame>
  );
}
