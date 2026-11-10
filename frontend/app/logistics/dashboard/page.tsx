"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AssignmentWorkspaceFrame from "@/components/AssignmentWorkspaceFrame";
import { useLogisticsAccess } from "@/lib/staff-assignment/use-logistics-access";
import { getStaffAssignmentService, type AssignmentQueues } from "@/lib/staff-assignment/service";
import { getLogisticsRouteReviewService, type RouteReviewQueues } from "@/lib/logistics-route-review/service";
import { listLogisticsTrackingOrders, type TrackingOrderSummary } from "@/lib/logistics-tracking/service";
import { apiFetch } from "@/lib/api";
import { clearAccessToken, getAccessToken } from "@/lib/auth";
import "./dashboard.css";

type SubmittedOrder = {
  id: string;
  orderCode: string;
  originAddress: string | null;
  originCountry: string | null;
  destinationAddress: string | null;
  destinationCountry: string | null;
  requestedDepartureAt: string | null;
  createdAt: string;
};

type DashboardSource = "submitted" | "assignments" | "reviews" | "journeys";
type DashboardErrors = Partial<Record<DashboardSource, string>>;

const previewSubmitted: SubmittedOrder[] = [
  { id: "preview-order-lm-1", orderCode: "ORD-2048", originAddress: "Lexington, KY", originCountry: "United States", destinationAddress: "Brussels", destinationCountry: "Belgium", requestedDepartureAt: "2026-11-21T09:00:00-04:00", createdAt: "2026-11-09T10:30:00+07:00" },
  { id: "preview-order-lm-2", orderCode: "ORD-2039", originAddress: null, originCountry: "France", destinationAddress: "Amsterdam", destinationCountry: "Netherlands", requestedDepartureAt: "2026-11-25T08:00:00+01:00", createdAt: "2026-11-08T15:15:00+07:00" },
];

const previewJourneys: TrackingOrderSummary[] = [
  { orderId: "preview-journey-1", orderCode: "ORD-2068", status: "IN_PROGRESS", originAddress: "Saumur", originCountry: "France", destinationAddress: "Amsterdam", destinationCountry: "Netherlands", transportMode: "ROAD", requestedDepartureAt: "2026-11-12T08:00:00+01:00", horseCount: 2, createdAt: "2026-11-01T09:00:00+01:00", deliveredAt: null },
  { orderId: "preview-journey-2", orderCode: "ORD-2071", status: "READY_TO_SHIP", originAddress: "Lexington, KY", originCountry: "United States", destinationAddress: "Brussels", destinationCountry: "Belgium", transportMode: "COMBINED", requestedDepartureAt: "2026-11-14T09:00:00-04:00", horseCount: 4, createdAt: "2026-11-02T12:00:00-04:00", deliveredAt: null },
];

async function readSubmittedOrders(preview: boolean): Promise<SubmittedOrder[]> {
  if (preview) return previewSubmitted;
  const token = getAccessToken();
  if (!token) throw new Error("Your session has expired. Sign in again.");
  let response: Response;
  try {
    response = await apiFetch("/api/v1/orders/inbox?status=SUBMITTED", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
  } catch {
    throw new Error("We couldn't reach the submitted orders queue.");
  }
  if (response.status === 401) {
    clearAccessToken();
    throw new Error("Your session has expired. Sign in again.");
  }
  if (!response.ok) throw new Error("We couldn't load submitted orders.");
  const value: unknown = await response.json();
  if (!Array.isArray(value)) throw new Error("Submitted orders returned an unreadable response.");
  return value as SubmittedOrder[];
}

function DashboardIcon({ name }: { name: "inbox" | "staff" | "route" | "journey" | "arrow" | "calendar" }) {
  const paths: Record<typeof name, string[]> = {
    inbox: ["M4 5h16v14H4z", "M4 14h5l2 2h2l2-2h5"],
    staff: ["M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", "M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8", "M20 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
    route: ["M5 6h.01M19 18h.01", "M5 6c6 0 4 12 10 12h4", "M16 15l3 3-3 3"],
    journey: ["M3 7h11v10H3z", "M14 10h4l3 3v4h-7z", "M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"],
    arrow: ["M5 12h14", "m12 5 7 7-7 7"],
    calendar: ["M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z", "M8 2v4m8-4v4M3 9h18"],
  };
  return <svg className="lm-dashboard-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name].map((path) => <path d={path} key={path} />)}</svg>;
}

function dateLabel(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Date not provided";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function routeLabel(origin: string | null, originCountry: string | null, destination: string | null, destinationCountry: string | null) {
  const from = origin || originCountry || "Origin not provided";
  const to = destination || destinationCountry || "Destination not provided";
  return { from, to };
}

function statusLabel(status: TrackingOrderSummary["status"]) {
  if (status === "READY_TO_SHIP") return "Ready to ship";
  if (status === "IN_PROGRESS") return "In progress";
  return "Delivered";
}

export default function LogisticsDashboardPage() {
  const { state: accessState, preview, message: accessMessage } = useLogisticsAccess();
  const assignmentService = useMemo(() => getStaffAssignmentService(preview), [preview]);
  const reviewService = useMemo(() => getLogisticsRouteReviewService(preview), [preview]);
  const [submitted, setSubmitted] = useState<SubmittedOrder[] | null>(null);
  const [assignments, setAssignments] = useState<AssignmentQueues | null>(null);
  const [reviews, setReviews] = useState<RouteReviewQueues | null>(null);
  const [journeys, setJourneys] = useState<TrackingOrderSummary[] | null>(null);
  const [errors, setErrors] = useState<DashboardErrors>({});
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setErrors({});
    const results = await Promise.allSettled([
      readSubmittedOrders(preview),
      assignmentService.listOrders(),
      reviewService.listReviews(),
      preview ? Promise.resolve(previewJourneys) : listLogisticsTrackingOrders(),
    ] as const);
    const nextErrors: DashboardErrors = {};
    const [submittedResult, assignmentResult, reviewResult, journeyResult] = results;
    if (submittedResult.status === "fulfilled") setSubmitted(submittedResult.value);
    else nextErrors.submitted = submittedResult.reason instanceof Error ? submittedResult.reason.message : "Submitted orders are unavailable.";
    if (assignmentResult.status === "fulfilled") setAssignments(assignmentResult.value);
    else nextErrors.assignments = assignmentResult.reason instanceof Error ? assignmentResult.reason.message : "Staff assignments are unavailable.";
    if (reviewResult.status === "fulfilled") setReviews(reviewResult.value);
    else nextErrors.reviews = reviewResult.reason instanceof Error ? reviewResult.reason.message : "Route reviews are unavailable.";
    if (journeyResult.status === "fulfilled") setJourneys(journeyResult.value);
    else nextErrors.journeys = journeyResult.reason instanceof Error ? journeyResult.reason.message : "Journeys are unavailable.";
    setErrors(nextErrors);
    setLoading(false);
    inFlight.current = false;
  }, [assignmentService, preview, reviewService]);

  useEffect(() => {
    if (accessState !== "allowed") return;
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [accessState, load]);

  useEffect(() => {
    const updateTime = () => setCurrentTime(Date.now());
    updateTime();
    const timer = window.setInterval(updateTime, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const activeJourneys = useMemo(() => (journeys ?? []).filter((order) => order.status === "READY_TO_SHIP" || order.status === "IN_PROGRESS"), [journeys]);
  const upcomingDepartures = useMemo(() => currentTime === null ? [] : activeJourneys
    .filter((order) => Date.parse(order.requestedDepartureAt) >= currentTime)
    .toSorted((a, b) => Date.parse(a.requestedDepartureAt) - Date.parse(b.requestedDepartureAt)), [activeJourneys, currentTime]);

  if (accessState !== "allowed") return <main className="customer-page"><div className="customer-content assignment-access-state"><p className="customer-loading" role={accessState === "checking" ? "status" : "alert"}>{accessState === "checking" ? "Checking Logistics Manager access…" : accessMessage}</p>{accessState !== "checking" && <Link className="customer-secondary-button" href="/login">Return to sign in</Link>}</div></main>;

  const previewSuffix = preview ? "?preview=1" : "";
  const journeysHref = preview ? "/logistics/dashboard?preview=1#journeys-title" : "/logistics/tracking";
  const workstreams = [
    { key: "submitted" as const, label: "Awaiting quotation", count: submitted?.length ?? null, href: `/logistics${previewSuffix}`, icon: "inbox" as const },
    { key: "assignments" as const, label: "Needs staff assignment", count: assignments?.needsAssignment.length ?? null, href: `/logistics/assignments${previewSuffix}`, icon: "staff" as const },
    { key: "reviews" as const, label: "Route plans to review", count: reviews?.pending.length ?? null, href: `/logistics/route-reviews${previewSuffix}`, icon: "route" as const },
    { key: "journeys" as const, label: "Active journeys", count: journeys === null ? null : activeJourneys.length, href: journeysHref, icon: "journey" as const },
  ];
  const maxCount = Math.max(1, ...workstreams.map((item) => item.count ?? 0));

  return <AssignmentWorkspaceFrame preview={preview} activeSection="dashboard" pageClassName="lm-dashboard-page">
    <header className="lm-page-heading lm-dashboard-heading">
      <div><span className="lm-dashboard-eyebrow">LOGISTICS OVERVIEW</span><h1>Dashboard</h1><p>A clear view of the work that needs attention across the transport pipeline.</p></div>
      <button className="customer-secondary-button compact" type="button" disabled={loading} onClick={() => void load()}>{loading ? "Refreshing…" : "Refresh data"}</button>
    </header>

    {Object.keys(errors).length > 0 && <div className="customer-alert lm-dashboard-alert" role="status"><span>Some dashboard data could not be refreshed. Affected figures show a dash; other sections remain available.</span><button type="button" disabled={loading} onClick={() => void load()}>Try again</button></div>}

    <section className="lm-dashboard-kpis" aria-label="Current work counts">
      {workstreams.map((item) => <Link key={item.key} className={`lm-dashboard-kpi is-${item.key}`} href={item.href}>
        <span className="lm-dashboard-kpi-top"><span className="lm-dashboard-kpi-icon"><DashboardIcon name={item.icon} /></span><span className="lm-dashboard-kpi-arrow"><DashboardIcon name="arrow" /></span></span>
        <strong>{loading && item.count === null ? "—" : item.count === null ? "—" : item.count}</strong>
        <span className="lm-dashboard-kpi-label">{item.label}</span>
        <span className="lm-dashboard-kpi-foot">{item.count === 1 ? "1 order" : item.count === null ? "Data unavailable" : `${item.count} orders`} <span aria-hidden="true">→</span></span>
      </Link>)}
    </section>

    <div className="lm-dashboard-main-grid">
      <section className="lm-dashboard-panel lm-dashboard-workload" aria-labelledby="workload-title">
        <div className="lm-dashboard-panel-heading"><div><h2 id="workload-title">Open work by queue</h2><p>Current orders requiring action or active transport.</p></div><span className="lm-dashboard-period">CURRENT</span></div>
        <div className="lm-dashboard-bars" role="list" aria-label="Current order counts by work queue">
          {workstreams.map((item) => <Link role="listitem" key={item.key} className={`lm-dashboard-bar-row is-${item.key}`} href={item.href} aria-label={`${item.label}: ${item.count ?? "unavailable"}`}>
            <span className="lm-dashboard-bar-label"><DashboardIcon name={item.icon} />{item.label}</span>
            <span className="lm-dashboard-bar-track"><span style={{ width: `${item.count === null ? 0 : item.count === 0 ? 0 : Math.max(6, item.count / maxCount * 100)}%` }} /></span>
            <strong>{item.count ?? "—"}</strong>
          </Link>)}
        </div>
        <p className="lm-dashboard-footnote">Figures count records returned by each current work queue. Queues may represent different stages, not a total-order denominator.</p>
      </section>

      <section className="lm-dashboard-panel lm-dashboard-attention" aria-labelledby="attention-title">
        <div className="lm-dashboard-panel-heading"><div><h2 id="attention-title">Needs attention</h2><p>Jump straight to the work queue.</p></div></div>
        <div className="lm-dashboard-actions">
          {workstreams.slice(0, 3).map((item) => <Link key={item.key} href={item.href} className="lm-dashboard-action-row">
            <span className="lm-dashboard-action-icon"><DashboardIcon name={item.icon} /></span><span><strong>{item.label}</strong><small>{item.count === null ? "Count unavailable" : item.count === 0 ? "No orders waiting" : `${item.count} ${item.count === 1 ? "order" : "orders"} waiting`}</small></span><DashboardIcon name="arrow" />
          </Link>)}
        </div>
      </section>

      <section className="lm-dashboard-panel lm-dashboard-journeys" aria-labelledby="journeys-title">
        <div className="lm-dashboard-panel-heading"><div><h2 id="journeys-title">Journeys in progress</h2><p>Ready-to-ship and in-progress orders returned by tracking.</p></div><Link href={journeysHref} className="lm-dashboard-view-all">View journeys <DashboardIcon name="arrow" /></Link></div>
        {loading && journeys === null ? <p className="lm-dashboard-state" role="status">Loading active journeys…</p> : journeys === null ? <p className="lm-dashboard-state">Journey data is unavailable. Use refresh to try again.</p> : activeJourneys.length === 0 ? <p className="lm-dashboard-state">No active journeys in the tracking queue.</p> : <div className="lm-dashboard-journey-list">{activeJourneys.slice(0, 5).map((order) => {
          const route = routeLabel(order.originAddress, order.originCountry, order.destinationAddress, order.destinationCountry);
          const rowContent = <><span className="lm-dashboard-journey-code">{order.orderCode}<span className={`lm-dashboard-status is-${order.status.toLowerCase()}`}>{statusLabel(order.status)}</span></span>
            <span className="lm-dashboard-journey-route">{route.from}<b aria-hidden="true">→</b>{route.to}</span>
            <span className="lm-dashboard-journey-meta">{order.transportMode} <i aria-hidden="true">·</i> {order.horseCount} {order.horseCount === 1 ? "horse" : "horses"}</span>
            <span className="lm-dashboard-journey-date"><DashboardIcon name="calendar" />{dateLabel(order.requestedDepartureAt)}</span></>;
          return preview ? <article key={order.orderId} className="lm-dashboard-journey-row">{rowContent}</article> : <Link key={order.orderId} href={`/logistics/orders/${order.orderId}/tracking`} className="lm-dashboard-journey-row">
            {rowContent}
          </Link>;
        })}</div>}
      </section>

      <section className="lm-dashboard-panel lm-dashboard-departures" aria-labelledby="departures-title">
        <div className="lm-dashboard-panel-heading"><div><h2 id="departures-title">Upcoming departures</h2><p>From ready-to-ship or active journeys.</p></div><span className="lm-dashboard-panel-count">{journeys === null ? "—" : upcomingDepartures.length}</span></div>
        {journeys === null ? <p className="lm-dashboard-state">Departure data is unavailable.</p> : upcomingDepartures.length === 0 ? <p className="lm-dashboard-state">No upcoming departures in the current tracking list.</p> : <ul className="lm-dashboard-departure-list">{upcomingDepartures.slice(0, 5).map((order) => <li key={order.orderId}>{preview ? <div className="lm-dashboard-departure-item"><span><strong>{order.orderCode}</strong><small>{order.originAddress || order.originCountry || "Origin not provided"}</small></span><time dateTime={order.requestedDepartureAt}>{dateLabel(order.requestedDepartureAt)}</time></div> : <Link href={`/logistics/orders/${order.orderId}/tracking`}><span><strong>{order.orderCode}</strong><small>{order.originAddress || order.originCountry || "Origin not provided"}</small></span><time dateTime={order.requestedDepartureAt}>{dateLabel(order.requestedDepartureAt)}</time></Link>}</li>)}</ul>}
        <p className="lm-dashboard-footnote">Departure dates are planned dates; they are not live location updates.</p>
      </section>
    </div>
  </AssignmentWorkspaceFrame>;
}
