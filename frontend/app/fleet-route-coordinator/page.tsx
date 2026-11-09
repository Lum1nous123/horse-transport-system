"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import FleetRouteCoordinatorWorkspaceFrame from "@/components/FleetRouteCoordinatorWorkspaceFrame";
import { FleetPlanningIllustration, FleetSummaryIllustration } from "@/components/FleetRouteArtwork";
import TransportSpecialistIcon from "@/components/TransportSpecialistIcon";
import {
  getFleetRouteCoordinatorService,
  type AssignedCoordinatorOrderSummary,
  type RoutePlanStatus,
} from "@/lib/fleet-route-coordinator/service";
import { useFleetRouteCoordinatorAccess } from "@/lib/fleet-route-coordinator/use-coordinator-access";

function formatDateTime(value: string) {
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date),
    time: new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(date),
  };
}

function planStatusLabel(status: RoutePlanStatus) {
  if (status === "NOT_STARTED") return "Not started";
  if (status === "RETURNED") return "Returned by LM";
  return status.toLowerCase().replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

function actionLabel(status: RoutePlanStatus) {
  if (status === "NOT_STARTED") return "Start";
  if (status === "RETURNED") return "Revise";
  return "Continue";
}

export default function FleetRouteCoordinatorPage() {
  const { state: accessState, preview, previewCoordinatorId, previewCoordinatorName, message: accessMessage } = useFleetRouteCoordinatorAccess();
  const service = useMemo(() => getFleetRouteCoordinatorService(preview), [preview]);
  const [orders, setOrders] = useState<AssignedCoordinatorOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const queue = await service.listAssignedActionableOrders();
      setOrders(queue.orders);
    } catch (caught) {
      setOrders([]);
      setError(caught instanceof Error ? caught.message : "We couldn't load your assigned planning Orders.");
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    if (accessState !== "allowed") return;
    const timer = window.setTimeout(() => { void loadQueue(); }, 0);
    return () => window.clearTimeout(timer);
  }, [accessState, loadQueue]);

  const counts = useMemo(() => ({
    notStarted: orders.filter((order) => order.routePlanStatus === "NOT_STARTED").length,
    draft: orders.filter((order) => order.routePlanStatus === "DRAFT").length,
    returned: orders.filter((order) => order.routePlanStatus === "RETURNED").length,
  }), [orders]);

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
      <header className="frc-page-heading">
        <div className="frc-hero-copy">
          <span className="frc-page-context">Fleet operations</span>
          <h1>Route planning queue</h1>
          <p>Review the Orders assigned to you and move each transport into route planning.</p>
          <span className="frc-hero-accent" aria-hidden="true" />
        </div>
        <FleetPlanningIllustration />
        <button className="customer-secondary-button frc-refresh-button" type="button" disabled={loading} onClick={() => void loadQueue()}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v5h-5M4 18v-5h5M6.1 9a7 7 0 0 1 11.7-2.6L20 9M4 15l2.2 2.6A7 7 0 0 0 17.9 15" /></svg>
          {loading ? "Refreshing..." : "Refresh queue"}
        </button>
      </header>

      {error && <div className="customer-alert" role="alert"><span>{error}</span><button type="button" onClick={() => void loadQueue()}>Try again</button></div>}

      {loading ? (
        <div className="frc-queue-skeleton" role="status" aria-label="Loading assigned planning Orders"><span /><span /><span /></div>
      ) : !error && orders.length === 0 ? (
        <section className="frc-empty-state">
          <span aria-hidden="true">✓</span>
          <div><h2>No Orders need route planning</h2><p>New assigned Orders will appear after their Remaining Balance is confirmed as paid.</p></div>
        </section>
      ) : !error && (
        <>
          <dl className="frc-queue-summary" aria-label="Actionable planning Order summary">
            <div><span className="frc-summary-icon is-new"><FleetSummaryIllustration kind="new" /></span><span><dt>Not started</dt><small>Ready for a first plan</small></span><dd>{counts.notStarted}</dd></div>
            <div><span className="frc-summary-icon is-draft"><FleetSummaryIllustration kind="draft" /></span><span><dt>Draft plans</dt><small>Work already in progress</small></span><dd>{counts.draft}</dd></div>
            <div className="is-returned"><span className="frc-summary-icon is-returned"><FleetSummaryIllustration kind="returned" /></span><span><dt>Returned by LM</dt><small>Changes need attention</small></span><dd>{counts.returned}</dd></div>
          </dl>

          <section className="frc-queue-panel" aria-labelledby="frc-queue-title">
            <div className="frc-queue-panel-heading">
              <div className="frc-panel-title"><TransportSpecialistIcon name="truck" /><div><h2 id="frc-queue-title">Assigned Orders</h2><p>Actionable work only — locked plans stay out of this queue.</p></div></div>
              <span><b>{orders.length}</b> {orders.length === 1 ? "Order" : "Orders"}</span>
            </div>
            <div className="frc-table-wrap">
              <table className="frc-planning-table">
                <thead><tr><th scope="col">Order</th><th scope="col">Route</th><th scope="col">Departure</th><th scope="col">Horses</th><th scope="col">Mode</th><th scope="col">Plan status</th><th scope="col">Updated</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
                <tbody>
                  {orders.map((order) => {
                    const previewSuffix = preview ? `?preview=1&coordinatorId=${encodeURIComponent(previewCoordinatorId)}` : "";
                    const departure = formatDateTime(order.requestedDepartureAt);
                    const updated = order.routePlanUpdatedAt ? formatDateTime(order.routePlanUpdatedAt) : null;
                    return (
                      <tr key={order.id}>
                        <td data-label="Order"><strong>{order.orderCode}</strong><small>Transport Order</small></td>
                        <td data-label="Route"><div className="frc-route-cell"><span aria-hidden="true"><i /><i /></span><strong><b>{order.origin}</b><b>{order.destination}</b></strong></div></td>
                        <td data-label="Departure"><time dateTime={order.requestedDepartureAt}><strong>{departure.date}</strong><small>{departure.time}</small></time></td>
                        <td data-label="Horses"><strong className="frc-number-cell">{order.horseCount}</strong></td>
                        <td data-label="Mode"><span className="frc-mode-pill">{order.transportMode}</span></td>
                        <td data-label="Plan status"><span className={`frc-plan-status is-${order.routePlanStatus.toLowerCase()}`}>{planStatusLabel(order.routePlanStatus)}</span>{order.returnReason && <small>{order.returnReason}</small>}</td>
                        <td data-label="Updated">{updated ? <time dateTime={order.routePlanUpdatedAt ?? undefined}><strong>{updated.date}</strong><small>{updated.time}</small></time> : <span className="frc-muted-value">Not started</span>}</td>
                        <td data-label="Action"><Link className="frc-open-order" href={`/fleet-route-coordinator/orders/${order.id}${previewSuffix}`}><span>{actionLabel(order.routePlanStatus)}</span><span aria-hidden="true">→</span></Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="frc-queue-note"><span aria-hidden="true">i</span> Plans awaiting Logistics Manager review and approved plans are read-only and do not appear here.</p>
          </section>
        </>
      )}
    </FleetRouteCoordinatorWorkspaceFrame>
  );
}
