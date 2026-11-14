"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AssignmentWorkspaceFrame from "@/components/AssignmentWorkspaceFrame";
import { LogisticsStatusTabs } from "@/components/LogisticsWorkspaceUI";
import { getStaffAssignmentService, type AssignmentOrderSummary } from "@/lib/staff-assignment/service";
import { useLogisticsAccess } from "@/lib/staff-assignment/use-logistics-access";
import { compareRequestedDeliveryDates, formatRequestedDeliveryDate } from "@/lib/requested-delivery-date";

export default function StaffAssignmentQueuePage() {
  const { state: accessState, preview, message: accessMessage } = useLogisticsAccess();
  const service = useMemo(() => getStaffAssignmentService(preview), [preview]);
  const [queues, setQueues] = useState<{ needsAssignment: AssignmentOrderSummary[]; assigned: AssignmentOrderSummary[] }>({ needsAssignment: [], assigned: [] });
  const [tab, setTab] = useState<"needsAssignment" | "assigned">("needsAssignment");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("earliest");
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  const loadQueues = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true); setError("");
    try { setQueues(await service.listOrders()); setLoaded(true); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "We couldn't load staff assignments."); }
    finally { inFlight.current = false; setLoading(false); }
  }, [service]);

  useEffect(() => {
    if (accessState !== "allowed") return;
    const timer = window.setTimeout(() => { void loadQueues(); }, 0);
    return () => window.clearTimeout(timer);
  }, [accessState, loadQueues]);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return queues[tab].filter((order) => !needle || [order.orderCode, order.origin, order.destination].some((value) => value.toLocaleLowerCase().includes(needle)))
      .toSorted((a, b) => {
        return compareRequestedDeliveryDates(a.requestedDeliveryDate, b.requestedDeliveryDate,
          a.id, b.id, sort === "latest");
      });
  }, [queues, query, sort, tab]);

  if (accessState !== "allowed") return <main className="customer-page"><div className="customer-content assignment-access-state">
    <p className="customer-loading" role={accessState === "checking" ? "status" : "alert"}>{accessState === "checking" ? "Checking Logistics Manager access…" : accessMessage}</p>
    {accessState !== "checking" && <Link className="customer-secondary-button" href="/login">Return to sign in</Link>}
  </div></main>;

  const suffix = preview ? "?preview=1" : "";
  const count = (value: number) => loading || error ? null : value;
  return <AssignmentWorkspaceFrame preview={preview}>
    <header className="lm-page-heading lm-assignment-heading"><div><span className="lm-heading-icon" aria-hidden="true">♞</span><div><h1>Staff assignment</h1><p>Select one Transport Specialist and one Fleet &amp; Route Coordinator for each order.</p></div></div>
      <button className="customer-secondary-button compact" type="button" disabled={loading} onClick={() => void loadQueues()}>{loading ? "Refreshing…" : "Refresh queue"}</button>
    </header>
    {error && <div className="customer-alert" role="alert"><span>{error}{loaded && " Previously loaded orders are shown below and may be outdated."}</span><button type="button" disabled={loading} onClick={() => void loadQueues()}>Try again</button></div>}
    <section className="lm-management-panel lm-queue-panel lm-assignment-panel">
      <LogisticsStatusTabs label="Assignment queues" value={tab} onChange={setTab} panelId="assignment-orders" tabs={[
        { value: "needsAssignment", label: "Needs assignment", count: count(queues.needsAssignment.length) },
        { value: "assigned", label: "Assigned", count: count(queues.assigned.length) },
      ]} />
      <div className="lm-list-toolbar">
        <label className="lm-search"><span className="sr-only">Search assignment orders</span><input type="search" placeholder="Search order code or route" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label className="lm-filter"><span>Desired delivery date</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="earliest">Earliest first</option><option value="latest">Latest first</option></select></label>
      </div>
      <div id="assignment-orders" role="tabpanel" aria-labelledby={`assignment-orders-tab-${tab}`} tabIndex={0}>
        {loading ? <p className="lm-list-state" role="status">Loading assignment orders…</p> : !loaded ? <p className="lm-list-state">Assignment orders are unavailable. Retry the request above.</p>
          : visible.length === 0 ? <div className="lm-list-state"><h2>{query ? "No matching orders" : tab === "needsAssignment" ? "No orders need assignment" : "No assigned orders"}</h2><p>{query ? "Try a different order code or route." : tab === "needsAssignment" ? "Eligible orders will appear here when staff assignment is required." : "Non-terminal orders with a saved TS/FRC pair appear here."}</p>{query && <button className="customer-text-button" type="button" onClick={() => setQuery("")}>Clear search</button>}</div>
          : <div className="lm-table-scroll"><table className="lm-management-table" aria-label={tab === "needsAssignment" ? "Orders needing staff assignment" : "Assigned orders"}>
            <thead><tr><th scope="col">Order</th><th scope="col" className="lm-route-column">Route</th><th scope="col">Desired delivery date</th><th scope="col">Horses / Mode</th><th scope="col">Action</th></tr></thead>
            <tbody>{visible.map((order) => <tr key={order.id}>
              <td data-label="Order"><strong>{order.orderCode}</strong></td>
              <td data-label="Route" className="lm-route-cell"><span>{order.origin}</span><span className="lm-destination"><b aria-hidden="true">→</b> {order.destination}</span></td>
              <td data-label="Desired delivery date">{formatRequestedDeliveryDate(order.requestedDeliveryDate)}</td>
              <td data-label="Horses / Mode"><span>{order.horseCount} {order.horseCount === 1 ? "horse" : "horses"}</span><small>{order.transportMode}</small></td>
              <td data-label="Action"><Link className={tab === "needsAssignment" ? "customer-primary-button compact" : "lm-row-link"} href={`/logistics/assignments/${order.id}${suffix}`} aria-label={`${tab === "needsAssignment" ? "Assign staff" : "View assignment"} for ${order.orderCode}`}>{tab === "needsAssignment" ? "Assign staff" : "View assignment"} <span aria-hidden="true">→</span></Link></td>
            </tr>)}</tbody>
          </table></div>}
      </div>
      {!loading && loaded && <p className="lm-list-footer" role="status">{visible.length} of {queues[tab].length} loaded orders{error ? " · Refresh failed; results may be outdated" : ""}</p>}
    </section>
  </AssignmentWorkspaceFrame>;
}
