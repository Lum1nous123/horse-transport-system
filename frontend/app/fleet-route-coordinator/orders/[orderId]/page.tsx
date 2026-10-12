"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import FleetRouteCoordinatorWorkspaceFrame from "@/components/FleetRouteCoordinatorWorkspaceFrame";
import RoutePlanEditor from "@/components/RoutePlanEditor";
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
            <div><span>{order.orderCode}</span><h1>{order.origin} <b aria-hidden="true">→</b> {order.destination}</h1><p>Construct and validate the ordered journey for this assigned Order.</p></div>
            <div><Link className="customer-secondary-button" href={queueHref}>Back to queue</Link><button className="customer-secondary-button" type="button" disabled={refreshing} onClick={() => void loadOrder(true)}>{refreshing ? "Refreshing..." : "Refresh"}</button></div>
          </header>

          {feedback && <p className="customer-feedback" role="status">{feedback}</p>}
          {error && <div className="customer-alert" role="alert"><span>{error}</span><button type="button" onClick={() => void loadOrder(true)}>Try again</button></div>}

          <section className="frc-plan-overview" aria-label="Order planning summary">
            <div><span>Status</span><strong className={`frc-plan-status is-${order.routePlanStatus.toLowerCase()}`}>{statusLabel(order.routePlanStatus)}</strong></div>
            <div><span>Departure</span><strong>{formatDateTime(order.requestedDepartureAt)}</strong></div>
            <div><span>Transport</span><strong>{order.transportMode}</strong></div>
            <div><span>Horses</span><strong>{order.horseCount}</strong></div>
            <div><span>Transport Specialist</span><strong>{order.assignedTransportSpecialistName}</strong></div>
            <div><span>Payment</span><strong className="is-complete">Paid</strong></div>
          </section>

          {order.routePlanStatus === "RETURNED" && order.returnReason && <section className="frc-return-reason" aria-labelledby="frc-return-title"><span aria-hidden="true">↩</span><div><h2 id="frc-return-title">Returned by Logistics Manager</h2><p>{order.returnReason}</p></div></section>}

          <RoutePlanEditor orderId={order.id} service={service} />
        </>
      )}
    </FleetRouteCoordinatorWorkspaceFrame>
  );
}
