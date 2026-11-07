"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { clearAccessToken, getAccessToken, getCurrentUser } from "@/lib/auth";
import { previewJourneyScenario, previewTracking } from "@/lib/journey-tracking/preview";
import { JourneyReadError, readJourneyNotifications, readJourneyTracking } from "@/lib/journey-tracking/service";
import type { JourneyLeg, JourneyNotification, JourneyTracking, JourneyVehicle } from "@/lib/journey-tracking/types";
import BrandMark from "@/components/BrandMark";
import { LogisticsNavigation } from "@/components/LogisticsWorkspaceUI";
import "./journey-tracking.css";

type Role = "CUSTOMER" | "LOGISTICS_MANAGER";
type State = "checking" | "loading" | "ready" | "forbidden" | "error";

function dateTime(value: string | null) {
  if (!value) return "Pending";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Unavailable" : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function Contact({ label, person }: { label: string; person: { name: string; phone: string | null } | null }) {
  return <div className="journey-contact"><span>{label}</span><strong>{person?.name ?? "Not assigned"}</strong><p>{person?.phone?.trim() || "Not available"}</p></div>;
}

export function Vehicle({ vehicle }: { vehicle: JourneyVehicle }) {
  return <section className="journey-vehicle" aria-label={`Vehicle ${vehicle.label}`}>
    <div className="journey-vehicle-heading"><strong>Vehicle {vehicle.label}</strong><span className={`journey-leg-status is-${vehicle.status.toLowerCase()}`}>{vehicle.status.replaceAll("_", " ")}</span><span>Horses: {vehicle.horses.join(", ") || "Not assigned"}</span></div>
    <ol className="journey-checkpoints">{vehicle.checkpoints.map((point) => <li key={point.id} className={point.reachedAt ? "is-reached" : "is-pending"}>
      <span className="journey-checkpoint-marker" aria-hidden="true">{point.reachedAt ? "✓" : "○"}</span>
      <div><strong>{point.label}</strong><time>{dateTime(point.reachedAt)}</time>
        {point.reachedAt && point.note && <p>{point.note}</p>}
        {point.reachedAt && point.photoUrl && <a href={point.photoUrl} target="_blank" rel="noreferrer">View welfare photo</a>}
      </div>
    </li>)}</ol>
    <div className="journey-contacts"><Contact label="Driver" person={vehicle.driver} /><Contact label="Escort" person={vehicle.escort} /></div>
  </section>;
}

export function Leg({ leg }: { leg: JourneyLeg }) {
  const expandedByDefault = leg.status === "IN_PROGRESS" || leg.status === "READY";
  return <details className={`journey-leg is-${leg.status.toLowerCase()}`} open={expandedByDefault}><summary className="journey-leg-heading"><span className="journey-mode" aria-hidden="true">{leg.mode === "ROAD" ? "▣" : "✈"}</span><div><h3>{leg.mode} · {leg.origin} to {leg.destination}</h3><p>{leg.horses.length} {leg.horses.length === 1 ? "horse" : "horses"}{leg.vehicles.length > 0 ? ` · ${leg.vehicles.length} ${leg.vehicles.length === 1 ? "vehicle" : "vehicles"}` : ""}</p></div><span className={`journey-leg-status is-${leg.status.toLowerCase()}`}>{leg.status.replaceAll("_", " ")}</span><span className="journey-leg-disclosure"><span className="when-closed">View details</span><span className="when-open">Hide details</span><b aria-hidden="true">⌄</b></span></summary><div className="journey-leg-body"><p className="journey-horse-list"><strong>Horses</strong>{leg.horses.join(", ") || "Not assigned"}</p>
    {leg.vehicles.map((vehicle) => <Vehicle vehicle={vehicle} key={vehicle.id} />)}
    {leg.events.length > 0 && <ol className="journey-events">{leg.events.map((event) => <li key={event.id}><strong>{event.label}</strong><time>{dateTime(event.occurredAt)}</time></li>)}</ol>}
    {leg.welfareEvidence.length > 0 && <section className="journey-air-welfare"><h4>Welfare evidence</h4><ul>{leg.welfareEvidence.map((evidence) => <li key={evidence.id}><time>{dateTime(evidence.recordedAt)}</time>{evidence.note && <p>{evidence.note}</p>}{evidence.photoUrl && <a href={evidence.photoUrl} target="_blank" rel="noreferrer">View welfare photo</a>}</li>)}</ul></section>}
  </div></details>;
}

function JourneyProgress({ legs }: { legs: JourneyLeg[] }) {
  const sortedLegs = [...legs].sort((a, b) => a.sequenceNo - b.sequenceNo);
  return <section className="journey-overview" aria-labelledby="journey-overview-heading"><div className="journey-overview-heading"><div><h2 id="journey-overview-heading">Journey overview</h2><p>{sortedLegs.filter((leg) => leg.status === "COMPLETED").length} of {sortedLegs.length} route legs completed</p></div></div><ol>{sortedLegs.map((leg) => <li className={`is-${leg.status.toLowerCase()}`} key={leg.id}><span className="journey-overview-step" aria-hidden="true">{leg.status === "COMPLETED" ? "✓" : leg.sequenceNo}</span><div><strong>{leg.mode}</strong><span>{leg.origin} <b aria-hidden="true">→</b> {leg.destination}</span></div><span className={`journey-leg-status is-${leg.status.toLowerCase()}`}>{leg.status.replaceAll("_", " ")}</span></li>)}</ol></section>;
}

export default function JourneyTrackingView({ role }: { role: Role }) {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const query = useSearchParams();
  const preview = process.env.NODE_ENV === "development" && query.get("preview") === "1";
  const scenario = query.get("scenario");
  const backHref = role === "CUSTOMER" ? "/customer" : "/logistics/tracking";
  const [state, setState] = useState<State>("checking");
  const [message, setMessage] = useState("");
  const [tracking, setTracking] = useState<JourneyTracking | null>(null);
  const [notifications, setNotifications] = useState<JourneyNotification[]>([]);
  const [notificationWarning, setNotificationWarning] = useState("");

  const load = useCallback(async () => {
    if (preview) {
      if (scenario === "forbidden") { setState("forbidden"); return; }
      if (scenario === "error") { setMessage("We couldn't load journey tracking. Try again."); setState("error"); return; }
      if (orderId !== previewTracking.orderId) { setMessage("No preview journey exists for this Order."); setState("error"); return; }
      const sample = previewJourneyScenario(scenario);
      setTracking(sample.tracking);
      setNotifications(sample.notifications);
      setNotificationWarning("");
      setState("ready");
      return;
    }
    if (!getAccessToken()) { router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`); return; }
    setState("loading");
    setNotificationWarning("");
    try {
      const user = await getCurrentUser();
      if (user.role !== role || user.status !== "ACTIVE") { setState("forbidden"); return; }
      const token = getAccessToken();
      if (!token) { router.replace("/login"); return; }
      const data = await readJourneyTracking(orderId, token);
      setTracking(data);
      if (role === "CUSTOMER") {
        try {
          setNotifications(await readJourneyNotifications(orderId, token));
        } catch {
          setNotifications([]);
          setNotificationWarning("Latest updates are temporarily unavailable. Journey tracking is still available.");
        }
      }
      setState("ready");
    } catch (error) {
      if (error instanceof JourneyReadError && error.status === 401) { clearAccessToken(); router.replace("/login"); return; }
      if (error instanceof JourneyReadError && error.status === 403) { setState("forbidden"); return; }
      setMessage(error instanceof Error ? error.message : "We couldn't load journey tracking.");
      setState("error");
    }
  }, [orderId, preview, role, router, scenario]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return <main className={`customer-page journey-page${role === "LOGISTICS_MANAGER" ? " logistics-manager-page" : ""}`}>
    <header className="customer-topbar"><Link className="customer-brand" href="/" aria-label="Horse Transport System home"><BrandMark /><span>Horse Transport System</span></Link>{role === "LOGISTICS_MANAGER" && <LogisticsNavigation section="tracking" preview={preview} />}<div className="customer-topbar-actions"><span>{role === "CUSTOMER" ? "Customer" : "Logistics Manager"}</span><button className="customer-link-button" type="button" onClick={() => { clearAccessToken(); router.replace("/login"); }}>Sign out</button></div></header>
    <div className="customer-content journey-content">
      {preview && <div className="customer-preview-banner" role="status"><strong>Preview mode</strong><span>Sample journey data. No backend request is sent.</span></div>}
      <nav className="journey-breadcrumb" aria-label="Breadcrumb"><Link href={preview ? `${backHref}?preview=1` : backHref}>{role === "CUSTOMER" ? "My Orders" : "Orders"}</Link><span>/</span><span>{tracking?.orderCode ?? orderId}</span></nav>
      {state === "checking" || state === "loading" ? <p className="journey-state" role="status">Loading journey tracking…</p> : state === "forbidden" ? <section className="journey-state" role="alert"><h1>You can’t view this journey</h1><p>Tracking is available only to the Order owner and Logistics Manager.</p><Link href={backHref}>Back to Orders</Link></section> : state === "error" ? <section className="journey-state" role="alert"><h1>Journey unavailable</h1><p>{message}</p><button className="customer-secondary-button" type="button" onClick={() => void load()}>Try again</button></section> : tracking && <>
        <div className="journey-heading"><div><p className="customer-eyebrow">ORDER {tracking.orderCode}</p><h1>Journey tracking</h1><p>{tracking.origin} <span aria-hidden="true">→</span> {tracking.destination}</p></div><div><span className="journey-status">{tracking.orderStatus.replaceAll("_", " ")}</span><small>Last updated {dateTime(tracking.updatedAt)}</small><button className="customer-secondary-button compact" type="button" onClick={() => void load()}>Refresh tracking</button></div></div>
        {tracking.legs.length > 0 && <JourneyProgress legs={tracking.legs} />}
        <div className="journey-layout"><section className="journey-panel"><div className="journey-panel-heading"><div><h2>Route progress</h2><p>Open a route leg to review vehicles, milestones, staff, and welfare evidence.</p></div><span>{tracking.legs.length} {tracking.legs.length === 1 ? "leg" : "legs"}</span></div>{tracking.legs.length === 0 ? <p className="journey-empty">No journey progress has been recorded yet.</p> : <ol className="journey-legs">{[...tracking.legs].sort((a, b) => a.sequenceNo - b.sequenceNo).map((leg) => <li key={leg.id}><Leg leg={leg} /></li>)}</ol>}{tracking.deliveryEvents.length > 0 && <div className="journey-delivery"><h3>Delivery events</h3>{tracking.deliveryEvents.map((event) => <p key={event.id}>{event.label} · {dateTime(event.occurredAt)}</p>)}</div>}</section>
        {role === "CUSTOMER" && <aside className="journey-panel journey-notifications"><h2>Latest updates</h2><p>Automatic in-app notices for this Order.</p>{notificationWarning ? <p className="journey-notification-warning" role="status">{notificationWarning}</p> : notifications.length === 0 ? <p className="journey-empty">No updates yet.</p> : <ul>{notifications.map((notice) => <li key={notice.id}><strong>{notice.title}</strong><p>{notice.message}</p><time>{dateTime(notice.createdAt)}</time></li>)}</ul>}</aside>}</div>
      </>}
    </div>
  </main>;
}
