"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import AssignmentWorkspaceFrame from "@/components/AssignmentWorkspaceFrame";
import {
  getLogisticsRouteReviewService,
  hasCompleteLockedStaffing,
  RouteReviewError,
  type RouteReviewDetail,
  type RouteReviewLeg,
} from "@/lib/logistics-route-review/service";
import { useLogisticsAccess } from "@/lib/staff-assignment/use-logistics-access";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function durationLabel(start: string, end: string) {
  const minutes = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h${remainder ? ` ${remainder}m` : ""}`;
}

export default function RouteReviewDetailPage() {
  const params = useParams<{ orderId: string }>();
  const { state: accessState, preview, message: accessMessage } = useLogisticsAccess();
  const service = useMemo(() => getLogisticsRouteReviewService(preview), [preview]);
  const [review, setReview] = useState<RouteReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState<"return" | "confirm" | null>(null);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [feedback, setFeedback] = useState("");
  const [expandedLegId, setExpandedLegId] = useState<string | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadReview = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(""); setErrorCode(""); setFeedback("");
    try {
      const result = await service.getReview(params.orderId);
      setReview(result);
      if (refresh) setFeedback("Route Plan refreshed from the saved server state.");
    } catch (caught) {
      if (!refresh) setReview(null);
      setError(caught instanceof Error ? caught.message : "We couldn't load this Route Plan.");
      setErrorCode(caught instanceof RouteReviewError ? caught.code : "REQUEST_FAILED");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [params.orderId, service]);

  useEffect(() => {
    if (accessState !== "allowed") return;
    const timer = window.setTimeout(() => { void loadReview(); }, 0);
    return () => window.clearTimeout(timer);
  }, [accessState, loadReview]);

  async function returnPlan() {
    if (!returnReason.trim()) { setError("Enter a reason before returning this Route Plan."); return; }
    setSubmitting("return"); setError(""); setFeedback("");
    try {
      await service.returnPlan(params.orderId, returnReason);
      const persisted = await service.getReview(params.orderId);
      setReview(persisted);
      setReturnOpen(false);
      setFeedback("Route Plan returned to the assigned FRC with your reason.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't return this Route Plan.");
    } finally { setSubmitting(null); }
  }

  async function confirmPlan() {
    setSubmitting("confirm"); setError(""); setFeedback("");
    try {
      await service.confirmPlan(params.orderId);
      const persisted = await service.getReview(params.orderId);
      setReview(persisted);
      setConfirmOpen(false);
      if (hasCompleteLockedStaffing(persisted)) {
        setFeedback("Route Plan locked. All execution staff were assigned and the Order is READY_TO_SHIP.");
      } else {
        setError("Confirmation was not complete in the saved read-back. READY_TO_SHIP has not been verified. Refresh or contact support.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't confirm this Route Plan.");
    } finally { setSubmitting(null); }
  }

  if (accessState !== "allowed") {
    const checking = accessState === "checking";
    return <main className="customer-page"><div className="customer-content assignment-access-state"><p className="customer-loading" role={checking ? "status" : "alert"}>{checking ? "Checking Logistics Manager access..." : accessMessage}</p>{!checking && <Link className="customer-secondary-button" href="/login">Return to sign in</Link>}</div></main>;
  }

  const queueHref = preview ? "/logistics/route-reviews?preview=1" : "/logistics/route-reviews";
  const pending = review?.routePlanStatus === "PENDING_LM_REVIEW";
  const allValid = review?.validations.every((item) => item.status === "PASSED") ?? false;

  return (
    <AssignmentWorkspaceFrame preview={preview} activeSection="reviews">
      <nav className="assignment-breadcrumb" aria-label="Breadcrumb"><Link href={queueHref}>Route Reviews</Link><span aria-hidden="true">/</span><span aria-current="page">{review?.orderCode ?? "Review"}</span></nav>

      {loading ? <div className="route-review-detail-skeleton" role="status" aria-label="Loading Route Plan"><span /><span /><span /></div> : !review ? (
        <section className="route-review-unavailable" role="alert"><span aria-hidden="true">!</span><h1>{errorCode === "FORBIDDEN" ? "Access denied" : errorCode === "STALE_STATE" ? "Route Plan changed" : "Route Plan unavailable"}</h1><p>{error}</p><div><Link className="customer-primary-button" href={queueHref}>Back to Route Reviews</Link>{errorCode === "REQUEST_FAILED" && <button className="customer-secondary-button" type="button" onClick={() => void loadReview()}>Try again</button>}</div></section>
      ) : (
        <>
          <header className="route-review-detail-heading">
            <div><span>{review.orderCode}</span><h1>{review.origin} <b aria-hidden="true">→</b> {review.destination}</h1><p>Review the saved Route Plan. Planning data is read-only.</p></div>
            <div><Link className="customer-secondary-button" href={queueHref}>Back to reviews</Link><button className="customer-secondary-button" type="button" disabled={refreshing || Boolean(submitting)} onClick={() => void loadReview(true)}>{refreshing ? "Refreshing..." : "Refresh"}</button></div>
          </header>

          {feedback && <p className="customer-feedback" role="status">{feedback}</p>}
          {error && <div className="customer-alert" role="alert"><span>{error}</span><button type="button" onClick={() => { setError(""); void loadReview(true); }}>Refresh</button></div>}

          <section className="route-review-summary" aria-label="Route Plan summary">
            <div><span>Status</span><strong className={`route-review-status is-${review.routePlanStatus.toLowerCase()}`}>{review.routePlanStatus === "PENDING_LM_REVIEW" ? "Pending review" : review.routePlanStatus === "APPROVED" ? "Locked" : "Returned"}</strong></div>
            <div><span>Departure</span><strong>{formatDateTime(review.requestedDepartureAt)}</strong></div>
            <div><span>Transport</span><strong>{review.transportMode}</strong></div>
            <div><span>Horses</span><strong>{review.horseCount}</strong></div>
            <div><span>FRC</span><strong>{review.assignedFleetRouteCoordinatorName}</strong></div>
            <div><span>Validation</span><strong className={allValid ? "is-valid" : "is-invalid"}>{allValid ? "Passed" : "Failed"}</strong></div>
          </section>

          {review.routePlanStatus === "RETURNED" && <section className="route-review-returned"><strong>Returned to FRC</strong><p>{review.returnReason}</p></section>}
          {review.routePlanStatus === "APPROVED" && <section className={`route-review-ready ${hasCompleteLockedStaffing(review) ? "is-complete" : "is-incomplete"}`}><div><strong>{hasCompleteLockedStaffing(review) ? "READY_TO_SHIP" : "Staffing incomplete"}</strong><p>{hasCompleteLockedStaffing(review) ? `Locked ${review.lockedAt ? formatDateTime(review.lockedAt) : ""}. Every required assignment is shown below.` : "The saved result is missing one or more required execution assignments."}</p></div></section>}

          <section className="route-review-audit" aria-labelledby="route-review-audit-title">
            <div className="route-review-audit-heading"><div><h2 id="route-review-audit-title">Ordered Route Plan</h2><p>Revision {review.revision} · submitted {formatDateTime(review.submittedAt)}</p></div><span className="route-review-readonly">Read-only</span></div>
            <div className="route-review-audit-wrap">
              <table className="route-review-audit-table">
                <thead><tr><th>#</th><th>Type</th><th>Route</th><th>Schedule</th><th>Planning details</th><th>Validation</th><th><span className="sr-only">Details</span></th></tr></thead>
                <tbody>{review.legs.map((leg) => <LegRows key={leg.id} leg={leg} expanded={expandedLegId === leg.id} locked={review.routePlanStatus === "APPROVED"} onToggle={() => setExpandedLegId((current) => current === leg.id ? null : leg.id)} />)}</tbody>
              </table>
            </div>

            <div className="route-review-validation-list"><h3>Validation result</h3><ul>{review.validations.map((item) => <li key={item.code} className={item.status === "PASSED" ? "is-passed" : "is-failed"}><span aria-hidden="true">{item.status === "PASSED" ? "✓" : "!"}</span><div><strong>{item.label}</strong><p>{item.message}</p></div></li>)}</ul></div>

            {pending && <div className="route-review-staffing-rule"><h3>Automatic staffing after confirmation</h3><div><span><b>ROAD Vehicle</b><strong>1 Driver + 1 Escort</strong></span><span><b>AIR leg</b><strong>1 Escort · No Driver</strong></span></div><p>Staff are selected by the system. Confirming permanently locks this Route Plan.</p></div>}

            {pending && returnOpen && <section className="route-review-decision-panel" aria-labelledby="return-plan-title"><div><h3 id="return-plan-title">Return Route Plan</h3><p>Explain what the assigned FRC must correct before resubmitting.</p></div><label><span>Return reason</span><textarea rows={3} value={returnReason} onChange={(event) => setReturnReason(event.target.value)} disabled={Boolean(submitting)} /></label><div><button className="customer-secondary-button" type="button" onClick={() => setReturnOpen(false)} disabled={Boolean(submitting)}>Cancel</button><button className="route-review-return-button" type="button" onClick={() => void returnPlan()} disabled={Boolean(submitting)}>{submitting === "return" ? "Returning..." : "Return to FRC"}</button></div></section>}

            {pending && confirmOpen && <section className="route-review-decision-panel is-confirm" aria-labelledby="confirm-plan-title"><div><h3 id="confirm-plan-title">Confirm and permanently lock?</h3><p>The system will assign execution staff automatically. This Route Plan cannot be reopened.</p></div><div><button className="customer-secondary-button" type="button" onClick={() => setConfirmOpen(false)} disabled={Boolean(submitting)}>Cancel</button><button className="customer-primary-button" type="button" onClick={() => void confirmPlan()} disabled={Boolean(submitting) || !allValid}>{submitting === "confirm" ? "Confirming..." : "Confirm & lock"}</button></div></section>}

            {pending && <footer className="route-review-actions"><button className="route-review-return-button" type="button" onClick={() => { setReturnOpen(true); setConfirmOpen(false); }} disabled={Boolean(submitting)}>Return plan</button><button className="customer-primary-button" type="button" onClick={() => { setConfirmOpen(true); setReturnOpen(false); }} disabled={Boolean(submitting) || !allValid}>Confirm &amp; lock</button></footer>}
          </section>
        </>
      )}
    </AssignmentWorkspaceFrame>
  );
}

function LegRows({ leg, expanded, locked, onToggle }: { leg: RouteReviewLeg; expanded: boolean; locked: boolean; onToggle: () => void }) {
  const planningDetail = leg.legType === "ROAD" ? `${leg.roadVehicles.length} ${leg.roadVehicles.length === 1 ? "vehicle" : "vehicles"}` : `${leg.airProviderName} · ${leg.airReference}`;
  const staffingComplete = leg.legType === "AIR" ? Boolean(leg.airEscort) : leg.roadVehicles.every((vehicle) => vehicle.driver && vehicle.escort);
  return <>
    <tr>
      <td data-label="#"><strong>{leg.sequenceNo}</strong></td>
      <td data-label="Type"><span className={`route-review-leg-type is-${leg.legType.toLowerCase()}`}>{leg.legType}</span></td>
      <td data-label="Route"><strong>{leg.origin}</strong><small>→ {leg.destination}</small></td>
      <td data-label="Schedule"><time dateTime={leg.plannedDepartureAt}>{formatDateTime(leg.plannedDepartureAt)}</time><small>→ {formatDateTime(leg.plannedArrivalAt)} · {durationLabel(leg.plannedDepartureAt, leg.plannedArrivalAt)}</small></td>
      <td data-label="Planning details"><strong>{planningDetail}</strong><small>{leg.legType === "ROAD" ? `${leg.roadVehicles.reduce((sum, vehicle) => sum + vehicle.horseNames.length, 0)} Horse allocations` : `Capacity ${leg.airCapacityHorses} Horses`}</small></td>
      <td data-label="Validation"><span className="route-review-pass">✓ Passed</span>{locked && <small className={staffingComplete ? "route-review-staff-complete" : "route-review-staff-missing"}>{staffingComplete ? "Staffed" : "Incomplete"}</small>}</td>
      <td data-label="Details"><button className="route-review-details-button" type="button" aria-expanded={expanded} onClick={onToggle}>{expanded ? "Hide details" : "View details"}</button></td>
    </tr>
    {expanded && <tr className="route-review-expanded-row"><td colSpan={7}><LegDetail leg={leg} locked={locked} /></td></tr>}
  </>;
}

function LegDetail({ leg, locked }: { leg: RouteReviewLeg; locked: boolean }) {
  if (leg.legType === "AIR") {
    return <div className="route-review-air-detail"><dl><div><dt>Air provider</dt><dd>{leg.airProviderName}</dd></div><div><dt>Flight reference</dt><dd>{leg.airReference}</dd></div><div><dt>Horse capacity</dt><dd>{leg.airCapacityHorses}</dd></div></dl><section><h4>Execution staffing</h4>{locked ? <div className="route-review-air-staff"><span><b>Driver</b><strong>No Driver</strong></span><span><b>Escort</b><strong>{leg.airEscort?.fullName ?? "Missing"}</strong><small>{leg.airEscort?.email}</small></span></div> : <p>After confirmation: 1 Escort and no Driver for this AIR leg.</p>}</section></div>;
  }
  return <div className="route-review-road-detail"><section><h4>Vehicles and Horse allocation</h4><div className="route-review-vehicle-list">{leg.roadVehicles.map((vehicle) => <article key={vehicle.id}><header><div><strong>{vehicle.plateNumber}</strong><span>{vehicle.vehicleName}</span></div><small>{vehicle.horseNames.length} / {vehicle.horseCapacity} Horses</small></header><p>{vehicle.horseNames.join(", ")}</p><div className="route-review-vehicle-staff"><span><b>Driver</b><strong>{locked ? vehicle.driver?.fullName ?? "Missing" : "Assigned after confirmation"}</strong>{locked && <small>{vehicle.driver?.email}</small>}</span><span><b>Escort</b><strong>{locked ? vehicle.escort?.fullName ?? "Missing" : "Assigned after confirmation"}</strong>{locked && <small>{vehicle.escort?.email}</small>}</span></div></article>)}</div></section><section><h4>Ordered checkpoints</h4>{leg.checkpoints.length ? <ol>{leg.checkpoints.map((checkpoint) => <li key={checkpoint.id}><span>{checkpoint.sequenceNo}</span><div><strong>{checkpoint.name}</strong><small>{checkpoint.checkpointType.replaceAll("_", " ")}{checkpoint.plannedStopDurationMinutes ? ` · ${checkpoint.plannedStopDurationMinutes} min` : ""}</small></div></li>)}</ol> : <p>No checkpoints are required for this ROAD leg.</p>}</section></div>;
}
