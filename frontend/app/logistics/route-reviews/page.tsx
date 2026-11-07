"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AssignmentWorkspaceFrame from "@/components/AssignmentWorkspaceFrame";
import { LogisticsDateTime } from "@/components/LogisticsWorkspaceUI";
import { getLogisticsRouteReviewService, type RouteReviewSummary } from "@/lib/logistics-route-review/service";
import { useLogisticsAccess } from "@/lib/staff-assignment/use-logistics-access";

export default function RouteReviewQueuePage() {
  const { state: accessState, preview, message: accessMessage } = useLogisticsAccess();
  const service = useMemo(() => getLogisticsRouteReviewService(preview), [preview]);
  const [pending, setPending] = useState<RouteReviewSummary[]>([]);
  const [locked, setLocked] = useState<RouteReviewSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const inFlight = useRef(false);

  const loadQueue = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true); setError("");
    try {
      const queue = await service.listReviews();
      setPending(queue.pending); setLocked(queue.locked); setLoaded(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "We couldn't load Route Reviews."); }
    finally { inFlight.current = false; setLoading(false); }
  }, [service]);

  useEffect(() => {
    if (accessState !== "allowed") return;
    const timer = window.setTimeout(() => { void loadQueue(); }, 0);
    return () => window.clearTimeout(timer);
  }, [accessState, loadQueue]);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return pending.filter((order) => !needle || [order.orderCode, order.origin, order.destination, order.assignedFleetRouteCoordinatorName].some((value) => value.toLocaleLowerCase().includes(needle)))
      .toSorted((a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt) || a.orderCode.localeCompare(b.orderCode));
  }, [pending, query]);

  if (accessState !== "allowed") return <main className="customer-page"><div className="customer-content assignment-access-state"><p className="customer-loading" role={accessState === "checking" ? "status" : "alert"}>{accessState === "checking" ? "Checking Logistics Manager access…" : accessMessage}</p>{accessState !== "checking" && <Link className="customer-secondary-button" href="/login">Return to sign in</Link>}</div></main>;

  return <AssignmentWorkspaceFrame preview={preview} activeSection="reviews">
    <header className="lm-page-heading"><div><h1>Route reviews</h1><p>Review pending plans, then confirm and lock or return to the assigned FRC.</p></div><button className="customer-secondary-button compact" type="button" disabled={loading} onClick={() => void loadQueue()}>{loading ? "Refreshing…" : "Refresh queue"}</button></header>
    {error && <div className="customer-alert" role="alert"><span>{error}{loaded && " Previously loaded results may be outdated."}</span><button type="button" disabled={loading} onClick={() => void loadQueue()}>Try again</button></div>}
    <section className="lm-management-panel" aria-labelledby="pending-reviews-heading">
      <div className="lm-panel-heading"><h2 id="pending-reviews-heading">Pending review <span className="lm-tab-count">{loading || error ? "—" : pending.length}</span></h2><span>Oldest submission first</span></div>
      <div className="lm-list-toolbar"><label className="lm-search"><span className="sr-only">Search pending reviews</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order, route or FRC" /></label></div>
      {loading ? <p className="lm-list-state" role="status">Loading Route Reviews…</p> : !loaded ? <p className="lm-list-state">Pending reviews are unavailable. Retry the request above.</p>
        : visible.length === 0 ? <div className="lm-list-state"><h2>{query ? "No matching reviews" : "No pending Route Plans"}</h2><p>{query ? "Try another order code, route or FRC." : "New submitted plans will appear here. Locked and returned review history is not available from the real service."}</p>{query && <button className="customer-text-button" type="button" onClick={() => setQuery("")}>Clear search</button>}</div>
        : <ReviewTable orders={visible} preview={preview} />}
      {!loading && loaded && <p className="lm-list-footer">{visible.length} of {pending.length} loaded pending reviews{error && " · Results may be outdated"}</p>}
    </section>
    <p className="lm-scope-note">This queue contains pending reviews only. Historical locked and returned reviews are unavailable here. Approved journeys are available in <Link href="/logistics/tracking">Journeys</Link>.</p>
    {preview && locked.length > 0 && <details className="lm-preview-history"><summary>Development preview fixtures</summary><h2>Locked results (preview only)</h2><p>Sample saved results for interface review; this is not real review history.</p>{locked.map((order) => <p key={order.orderId}><Link href={`/logistics/route-reviews/${order.orderId}?preview=1`}>{order.orderCode} — View preview result</Link></p>)}</details>}
  </AssignmentWorkspaceFrame>;
}

function ReviewTable({ orders, preview }: { orders: RouteReviewSummary[]; preview: boolean }) {
  return <div className="lm-table-scroll"><table className="lm-management-table" aria-label="Pending route reviews">
    <thead><tr><th scope="col">Order</th><th scope="col" className="lm-route-column">Route</th><th scope="col">Departure</th><th scope="col">FRC</th><th scope="col">Submitted</th><th scope="col">Action</th></tr></thead>
    <tbody>{orders.map((order) => <tr key={order.orderId}>
      <td data-label="Order"><strong>{order.orderCode}</strong></td>
      <td data-label="Route" className="lm-route-cell"><span>{order.origin}</span><span className="lm-destination"><b aria-hidden="true">→</b> {order.destination}</span></td>
      <td data-label="Departure"><LogisticsDateTime value={order.requestedDepartureAt} /></td>
      <td data-label="FRC">{order.assignedFleetRouteCoordinatorName}</td>
      <td data-label="Submitted"><LogisticsDateTime value={order.submittedAt} /></td>
      <td data-label="Action"><Link className="customer-primary-button compact" href={`/logistics/route-reviews/${order.orderId}${preview ? "?preview=1" : ""}`} aria-label={`Review ${order.orderCode}`}>Review <span aria-hidden="true">→</span></Link></td>
    </tr>)}</tbody>
  </table></div>;
}
