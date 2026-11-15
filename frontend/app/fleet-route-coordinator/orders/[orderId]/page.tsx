"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import FleetRouteCoordinatorWorkspaceFrame from "@/components/FleetRouteCoordinatorWorkspaceFrame";
import RoutePlanTimelineEditor from "@/components/RoutePlanTimelineEditor";
import "../../route-plan-workspace.css";
import {
  CoordinatorWorkspaceError,
  getFleetRouteCoordinatorService,
  type AssignedCoordinatorOrderDetail,
} from "@/lib/fleet-route-coordinator/service";
import { useFleetRouteCoordinatorAccess } from "@/lib/fleet-route-coordinator/use-coordinator-access";

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
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");

  const loadOrder = useCallback(async () => {
    setLoading(true);
    setError("");
    setErrorCode("");
    try {
      const detail = await service.getAssignedPlanningContext(params.orderId);
      setOrder(detail);
    } catch (caught) {
      setOrder(null);
      setError(caught instanceof Error ? caught.message : "We couldn't load this planning context.");
      setErrorCode(caught instanceof CoordinatorWorkspaceError ? caught.code : "REQUEST_FAILED");
    } finally {
      setLoading(false);
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
          {error && <div className="customer-alert" role="alert"><span>{error}</span><button type="button" onClick={() => void loadOrder()}>Try again</button></div>}
          <RoutePlanTimelineEditor orderId={order.id} orderCode={order.orderCode} orderOrigin={order.originAddress} orderDestination={order.destinationAddress} requestedDeliveryDate={order.requestedDeliveryDate} returnedReason={order.returnReason} horseCount={order.horseCount} transportMode={order.transportMode} queueHref={queueHref} service={service} />
        </>
      )}
    </FleetRouteCoordinatorWorkspaceFrame>
  );
}
