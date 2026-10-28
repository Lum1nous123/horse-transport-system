"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AssignmentWorkspaceFrame from "@/components/AssignmentWorkspaceFrame";
import { listLogisticsTrackingOrders, type TrackingOrderSummary } from "@/lib/logistics-tracking/service";
import { useLogisticsAccess } from "@/lib/staff-assignment/use-logistics-access";

function date(value: string | null) {
  if (!value) return "Pending";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function LogisticsTrackingPage() {
  const { state: accessState, preview, message: accessMessage } = useLogisticsAccess();
  const [orders, setOrders] = useState<TrackingOrderSummary[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setOrders(await listLogisticsTrackingOrders()); }
    catch (caught) { setOrders([]); setError(caught instanceof Error ? caught.message : "We couldn't load Order Tracking."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (accessState !== "allowed" || preview) return;
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [accessState, load, preview]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? orders.filter((order) => order.orderCode.toLowerCase().includes(needle)) : orders;
  }, [orders, query]);

  if (accessState !== "allowed") return <main className="customer-page"><div className="customer-content assignment-access-state"><p className="customer-loading" role={accessState === "checking" ? "status" : "alert"}>{accessState === "checking" ? "Checking Logistics Manager access..." : accessMessage}</p>{accessState !== "checking" && <Link className="customer-secondary-button" href="/login">Return to sign in</Link>}</div></main>;

  return <AssignmentWorkspaceFrame preview={false} activeSection="tracking">
    <nav className="assignment-breadcrumb" aria-label="Breadcrumb"><Link href="/logistics">Logistics</Link><span aria-hidden="true">/</span><span aria-current="page">Order Tracking</span></nav>
    <header className="route-review-page-heading"><div><h1>Order Tracking</h1><p>Find approved and active journeys, plus completed deliveries.</p></div><button className="customer-secondary-button" type="button" disabled={loading || preview} onClick={() => void load()}>{loading ? "Refreshing..." : "Refresh"}</button></header>
    {preview ? <div className="customer-alert" role="alert">Order Tracking uses authenticated Backend data and is unavailable in preview mode.</div> : <>
      <label className="customer-field"><span>Find by order number</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. ORD-000004" /></label>
      {error && <div className="customer-alert" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Try again</button></div>}
      {loading ? <div className="route-review-queue-skeleton" role="status" aria-label="Loading tracking Orders"><span /><span /><span /></div> : !error && filtered.length === 0 ? <section className="route-review-empty"><div><h2>No matching Orders</h2><p>Approved, ready, active, and delivered Orders appear here.</p></div></section> : !error && <div className="route-review-table-wrap"><table className="route-review-queue-table"><thead><tr><th>Order</th><th>Status</th><th>Route</th><th>Mode</th><th>Departure</th><th>Horses</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{filtered.map((order) => <tr key={order.orderId}><td data-label="Order"><strong>{order.orderCode}</strong><small>Created {date(order.createdAt)}</small></td><td data-label="Status"><span className="route-review-mode">{order.status.replaceAll("_", " ")}</span>{order.deliveredAt && <small>Delivered {date(order.deliveredAt)}</small>}</td><td data-label="Route"><strong>{order.originAddress}</strong><small>→ {order.destinationAddress}</small></td><td data-label="Mode">{order.transportMode}</td><td data-label="Departure">{date(order.requestedDepartureAt)}</td><td data-label="Horses">{order.horseCount}</td><td data-label="Action"><Link className="route-review-open" href={`/logistics/orders/${order.orderId}/tracking`}>View tracking <span aria-hidden="true">→</span></Link></td></tr>)}</tbody></table></div>}
    </>}
  </AssignmentWorkspaceFrame>;
}
