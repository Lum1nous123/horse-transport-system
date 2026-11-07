"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AssignmentWorkspaceFrame from "@/components/AssignmentWorkspaceFrame";
import { LogisticsDateTime, LogisticsOrdersTabs, LogisticsStatusTabs } from "@/components/LogisticsWorkspaceUI";
import { listLogisticsTrackingOrders, type TrackingOrderSummary } from "@/lib/logistics-tracking/service";
import { useLogisticsAccess } from "@/lib/staff-assignment/use-logistics-access";

type JourneyGroup = "active" | "delivered" | "other";
const belongsTo = (order: TrackingOrderSummary, group: JourneyGroup) => group === "active"
  ? order.status === "READY_TO_SHIP" || order.status === "IN_PROGRESS"
  : group === "delivered" ? order.status === "DELIVERED" : order.status === "APPROVED";

export default function LogisticsTrackingPage() {
  const { state: accessState, preview, message: accessMessage } = useLogisticsAccess();
  const [orders, setOrders] = useState<TrackingOrderSummary[]>([]);
  const [tab, setTab] = useState<JourneyGroup>("active");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true); setError("");
    try { setOrders(await listLogisticsTrackingOrders()); setLoaded(true); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "We couldn't load journeys."); }
    finally { inFlight.current = false; setLoading(false); }
  }, []);

  useEffect(() => {
    if (accessState !== "allowed" || preview) return;
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [accessState, load, preview]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return orders.filter((order) => belongsTo(order, tab) && (!mode || order.transportMode === mode) && (!status || order.status === status)
      && (!needle || [order.orderCode, order.originAddress, order.originCountry, order.destinationAddress, order.destinationCountry].some((value) => value?.toLocaleLowerCase().includes(needle))));
  }, [orders, query, tab, mode, status]);

  if (accessState !== "allowed") return <main className="customer-page"><div className="customer-content assignment-access-state"><p className="customer-loading" role={accessState === "checking" ? "status" : "alert"}>{accessState === "checking" ? "Checking Logistics Manager access…" : accessMessage}</p>{accessState !== "checking" && <Link className="customer-secondary-button" href="/login">Return to sign in</Link>}</div></main>;

  const count = (group: JourneyGroup) => loading || error || preview ? null : orders.filter((order) => belongsTo(order, group)).length;
  return <AssignmentWorkspaceFrame preview={preview} activeSection="tracking">
    <LogisticsOrdersTabs active="journeys" preview={preview} />
    <header className="lm-page-heading"><div><h1>Journeys</h1><p>Orders with an approved Route Plan. Open a journey for vehicle progress and evidence.</p></div><button className="customer-secondary-button compact" type="button" disabled={loading || preview} onClick={() => void load()}>{loading && !preview ? "Refreshing…" : "Refresh"}</button></header>
    {preview ? <div className="customer-alert" role="alert">Journeys use authenticated Backend data and are unavailable in preview mode.</div> : <>
      {error && <div className="customer-alert" role="alert"><span>{error}{loaded && " Previously loaded journeys may be outdated."}</span><button type="button" disabled={loading} onClick={() => void load()}>Try again</button></div>}
      <section className="lm-management-panel">
        <LogisticsStatusTabs label="Journey status groups" panelId="journey-orders" value={tab} onChange={(value) => { setTab(value); setStatus(""); }} tabs={[
          { value: "active", label: "Active", count: count("active") },
          { value: "delivered", label: "Delivered", count: count("delivered") },
          { value: "other", label: "Other trackable", count: count("other") },
        ]} />
        <div className="lm-list-toolbar">
          <label className="lm-search"><span className="sr-only">Search journeys</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order code or route" /></label>
          <label className="lm-filter"><span>Mode</span><select value={mode} onChange={(event) => setMode(event.target.value)}><option value="">All modes</option><option value="ROAD">Road</option><option value="AIR">Air</option><option value="COMBINED">Combined</option></select></label>
          {tab === "active" && <label className="lm-filter"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All active</option><option value="READY_TO_SHIP">Ready to ship</option><option value="IN_PROGRESS">In progress</option></select></label>}
        </div>
        <div id="journey-orders" role="tabpanel" aria-labelledby={`journey-orders-tab-${tab}`} tabIndex={0}>
          {loading ? <p className="lm-list-state" role="status">Loading journeys…</p> : !loaded ? <p className="lm-list-state">Journeys are unavailable. Retry the request above.</p> : filtered.length === 0
            ? <div className="lm-list-state"><h2>{query || mode || status ? "No matching journeys" : tab === "active" ? "No active journeys" : tab === "delivered" ? "No delivered journeys" : "No other trackable orders"}</h2><p>{query || mode || status ? "Try a different search or clear the filters." : "Only orders returned by the tracking service appear here."}</p>{(query || mode || status) && <button className="customer-text-button" type="button" onClick={() => { setQuery(""); setMode(""); setStatus(""); }}>Clear filters</button>}</div>
            : <div className="lm-table-scroll"><table className="lm-management-table" aria-label="Trackable journeys">
              <thead><tr><th scope="col">Order / Status</th><th scope="col" className="lm-route-column">Route</th><th scope="col">Departure</th><th scope="col">Horses / Mode</th><th scope="col">Action</th></tr></thead>
              <tbody>{filtered.map((order) => <tr key={order.orderId}>
                <td data-label="Order / Status"><strong>{order.orderCode}</strong><span className={`lm-order-status is-${order.status.toLowerCase()}`}>{order.status.replaceAll("_", " ")}</span></td>
                <td data-label="Route" className="lm-route-cell"><span>{order.originAddress || order.originCountry || "Not provided"}</span><span className="lm-destination"><b aria-hidden="true">→</b> {order.destinationAddress || order.destinationCountry || "Not provided"}</span></td>
                <td data-label="Departure"><LogisticsDateTime value={order.requestedDepartureAt} /></td>
                <td data-label="Horses / Mode"><span>{order.horseCount} {order.horseCount === 1 ? "horse" : "horses"}</span><small>{order.transportMode}</small></td>
                <td data-label="Action"><Link className="lm-row-link" href={`/logistics/orders/${order.orderId}/tracking`} aria-label={`View tracking for ${order.orderCode}`}>View tracking <span aria-hidden="true">→</span></Link></td>
              </tr>)}</tbody>
            </table></div>}
        </div>
        {!loading && loaded && <p className="lm-list-footer" role="status">{filtered.length} of {orders.filter((order) => belongsTo(order, tab)).length} loaded orders in this group{error && " · Results may be outdated"}</p>}
      </section>
    </>}
  </AssignmentWorkspaceFrame>;
}
