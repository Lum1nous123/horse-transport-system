"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import FleetRouteCoordinatorWorkspaceFrame from "@/components/FleetRouteCoordinatorWorkspaceFrame";
import { FleetPlanningIllustration } from "@/components/FleetRouteArtwork";
import TransportSpecialistIcon from "@/components/TransportSpecialistIcon";
import {
  getFleetRouteCoordinatorService,
  type AssignedCoordinatorOrderSummary,
  type RoutePlanStatus,
} from "@/lib/fleet-route-coordinator/service";
import { useFleetRouteCoordinatorAccess } from "@/lib/fleet-route-coordinator/use-coordinator-access";

type QueueFilter = "ALL" | "NOT_STARTED" | "DRAFT" | "RETURNED";

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
  const [filter, setFilter] = useState<QueueFilter>("ALL");
  const [query, setQuery] = useState("");

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
    all: orders.length,
    notStarted: orders.filter((order) => order.routePlanStatus === "NOT_STARTED").length,
    draft: orders.filter((order) => order.routePlanStatus === "DRAFT").length,
    returned: orders.filter((order) => order.routePlanStatus === "RETURNED").length,
  }), [orders]);
  const visibleOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const priority: Record<RoutePlanStatus, number> = { RETURNED: 0, DRAFT: 1, NOT_STARTED: 2, PENDING_LM_REVIEW: 3, APPROVED: 4 };
    return orders
      .filter((order) => filter === "ALL" || order.routePlanStatus === filter)
      .filter((order) => !normalizedQuery || [order.orderCode, order.origin, order.destination].some((value) => value.toLowerCase().includes(normalizedQuery)))
      .sort((left, right) => priority[left.routePlanStatus] - priority[right.routePlanStatus] || new Date(left.requestedDepartureAt).getTime() - new Date(right.requestedDepartureAt).getTime());
  }, [filter, orders, query]);

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
          <h1>Route planning queue</h1>
          <p>Prioritize assigned Orders and continue route planning.</p>
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
        <section className="frc-queue-panel" aria-labelledby="frc-queue-title">
            <div className="frc-queue-panel-heading">
              <div className="frc-panel-title"><TransportSpecialistIcon name="truck" /><div><h2 id="frc-queue-title">Assigned Orders</h2><p>Returned work appears first, followed by drafts and new plans.</p></div></div>
              <span><b>{visibleOrders.length}</b>{visibleOrders.length !== orders.length ? ` / ${orders.length}` : ""} {orders.length === 1 ? "Order" : "Orders"}</span>
            </div>
            <div className="frc-queue-toolbar">
              <div className="frc-queue-filters" role="group" aria-label="Filter planning Orders by status">
                {([
                  ["ALL", "All", counts.all],
                  ["NOT_STARTED", "Not started", counts.notStarted],
                  ["DRAFT", "Draft", counts.draft],
                  ["RETURNED", "Returned", counts.returned],
                ] as const).map(([value, label, count]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}><span>{label}</span><b>{count}</b></button>)}
              </div>
              <label className="frc-queue-search"><span className="sr-only">Search assigned Orders</span><input type="search" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order or route" /></label>
            </div>
            {visibleOrders.length === 0 ? <div className="frc-filter-empty"><h3>No matching Orders</h3><p>Try another search or status filter.</p><button className="customer-secondary-button" type="button" onClick={() => { setFilter("ALL"); setQuery(""); }}>Clear filters</button></div> : <div className="frc-table-wrap">
              <table className="frc-planning-table">
                <thead><tr><th scope="col">Order</th><th scope="col">Route</th><th scope="col">Departure</th><th scope="col">Horses</th><th scope="col">Mode</th><th scope="col">Plan status</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
                <tbody>
                  {visibleOrders.map((order) => {
                    const previewSuffix = preview ? `?preview=1&coordinatorId=${encodeURIComponent(previewCoordinatorId)}` : "";
                    const departure = formatDateTime(order.requestedDepartureAt);
                    const updated = order.routePlanUpdatedAt ? formatDateTime(order.routePlanUpdatedAt) : null;
                    return (
                      <tr key={order.id}>
                        <td data-label="Order"><strong>{order.orderCode}</strong></td>
                        <td data-label="Route"><div className="frc-route-cell"><span aria-hidden="true"><i /><i /></span><strong><b>{order.origin}</b><b>{order.destination}</b></strong></div></td>
                        <td data-label="Departure"><time dateTime={order.requestedDepartureAt}><strong>{departure.date}</strong><small>{departure.time}</small></time></td>
                        <td data-label="Horses"><strong className="frc-number-cell">{order.horseCount}</strong></td>
                        <td data-label="Mode"><span className="frc-mode-pill">{order.transportMode}</span></td>
                        <td data-label="Plan status"><span className={`frc-plan-status is-${order.routePlanStatus.toLowerCase()}`}>{planStatusLabel(order.routePlanStatus)}</span>{order.returnReason ? <small>{order.returnReason}</small> : updated ? <small>Updated {updated.date} · {updated.time}</small> : null}</td>
                        <td data-label="Action"><Link className="frc-open-order" href={`/fleet-route-coordinator/orders/${order.id}${previewSuffix}`}><span>{actionLabel(order.routePlanStatus)}</span><span aria-hidden="true">→</span></Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>}
          </section>
      )}
    </FleetRouteCoordinatorWorkspaceFrame>
  );
}
