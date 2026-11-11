"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AssignmentWorkspaceFrame from "@/components/AssignmentWorkspaceFrame";
import {
  getLogisticsRouteReviewService,
  hasCompleteLockedStaffing,
  RouteReviewError,
  type RouteReviewDetail,
  type RouteReviewLeg,
  type ExecutionStaff,
} from "@/lib/logistics-route-review/service";
import { useLogisticsAccess } from "@/lib/staff-assignment/use-logistics-access";
import "./route-review-detail.css";

type ReviewIconName = "plan" | "route" | "status" | "departure" | "transport" | "horses" | "frc" | "validation";
const reviewIconPaths: Record<ReviewIconName, string[]> = {
  plan: ["M6 3h9l4 4v14H6z", "M15 3v5h4M9 12h7m-7 4h7"],
  route: ["M5 18c7 0 7-12 14-12", "M5 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm14-12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"],
  status: ["M6 4h12v17H6z", "m9 12 2 2 4-5"],
  departure: ["M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z", "M8 2v4m8-4v4M3 9h18"],
  transport: ["M3 7h11v10H3z", "M14 10h4l3 3v4h-7z", "M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"],
  horses: ["M6 20v-7l3-5 4-2 3-3 2 5 3 3-2 4-3-1-2 6H6Z", "M16 10h.01"],
  frc: ["M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z", "M3 20a5.5 5.5 0 0 1 11 0m0-6a5 5 0 0 1 7 4.6V20"],
  validation: ["M12 2 20 5v7c0 5-3.5 8-8 10-4.5-2-8-5-8-10V5z", "m9 12 2 2 4-5"],
};

function ReviewIcon({ name }: { name: ReviewIconName }) {
  return <svg className="route-review-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{reviewIconPaths[name].map((path) => <path d={path} key={path} />)}</svg>;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function StaffIdentity({ staff, role }: { staff: ExecutionStaff | null; role: "Driver" | "Escort" }) {
  if (!staff) return <strong>Missing</strong>;
  return <><strong>{staff.fullName?.trim() || `Assigned ${role}`}</strong><small>{staff.email ? `Username / email: ${staff.email}` : "Account details unavailable"}</small></>;
}

function allocationCount(vehicle: RouteReviewLeg["roadVehicles"][number]) {
  return vehicle.orderHorseIds?.length ?? vehicle.horseNames.length;
}

function durationLabel(start: string, end: string) {
  const minutes = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h${remainder ? ` ${remainder}m` : ""}`;
}

export default function RouteReviewDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  return <ReviewDetail key={orderId} />;
}

function ReviewDetail() {
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
  const [recoveryRequired, setRecoveryRequired] = useState(false);
  const [resultSource, setResultSource] = useState<"read" | "mutation">("read");
  const inFlight = useRef(false);
  const unreconciled = useRef(false);

  const loadReview = useCallback(async (refresh = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(""); setErrorCode(""); setFeedback("");
    try {
      const result = await service.getReview(params.orderId);
      setReview(result);
      setResultSource("read");
      const incomplete = result.routePlanStatus === "APPROVED" && !hasCompleteLockedStaffing(result);
      unreconciled.current = incomplete;
      setRecoveryRequired(incomplete);
      if (incomplete) setError("The saved result does not verify complete staffing. Decisions remain locked.");
      if (refresh) setFeedback(preview ? "Preview state reloaded." : "Pending Route Plan fetched from the server.");
    } catch (caught) {
      unreconciled.current = true;
      setRecoveryRequired(true);
      if (!refresh) setReview(null);
      setError(caught instanceof Error ? caught.message : "We couldn't load this Route Plan.");
      setErrorCode(caught instanceof RouteReviewError ? caught.code : "REQUEST_FAILED");
    } finally {
      inFlight.current = false;
      setLoading(false); setRefreshing(false);
    }
  }, [params.orderId, preview, service]);

  useEffect(() => {
    if (accessState !== "allowed") return;
    const timer = window.setTimeout(() => { void loadReview(); }, 0);
    return () => window.clearTimeout(timer);
  }, [accessState, loadReview]);

  async function mutateReview(action: "return" | "confirm") {
    if (inFlight.current || unreconciled.current || review?.routePlanStatus !== "PENDING_LM_REVIEW") return;
    if (action === "return" && !returnReason.trim()) {
      setError("Enter a reason before returning this Route Plan.");
      return;
    }
    if (action === "confirm" && review.validations.some((item) => item.status === "FAILED")) return;
    inFlight.current = true;
    unreconciled.current = true;
    setSubmitting(action); setRecoveryRequired(true); setError(""); setFeedback("");
    try {
      const persisted = action === "confirm"
        ? await service.confirmPlan(params.orderId)
        : await service.returnPlan(params.orderId, returnReason);
      if (persisted.orderId !== params.orderId
        || (action === "confirm" ? !hasCompleteLockedStaffing(persisted) : persisted.routePlanStatus !== "RETURNED" || !persisted.returnReason?.trim())) {
        throw new Error("The decision response could not verify the saved result. Retry the read before any further decision.");
      }
      setReview(persisted);
      setResultSource("mutation");
      setReturnOpen(false); setConfirmOpen(false);
      unreconciled.current = false;
      setRecoveryRequired(false);
      setFeedback(action === "confirm"
        ? "Route Plan locked. The decision response confirms staffing and READY_TO_SHIP."
        : "The decision response confirms the Route Plan was returned to FRC.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The decision outcome could not be verified.");
    } finally {
      inFlight.current = false;
      setSubmitting(null);
    }
  }

  if (accessState !== "allowed") {
    const checking = accessState === "checking";
    return <main className="customer-page"><div className="customer-content assignment-access-state"><p className="customer-loading" role={checking ? "status" : "alert"}>{checking ? "Checking Logistics Manager access..." : accessMessage}</p>{!checking && <Link className="customer-secondary-button" href="/login">Return to sign in</Link>}</div></main>;
  }

  const queueHref = preview ? "/logistics/route-reviews?preview=1" : "/logistics/route-reviews";
  const pending = review?.routePlanStatus === "PENDING_LM_REVIEW";
  const hasValidationResults = Boolean(review?.validations.length);
  const hasValidationFailures = review?.validations.some((item) => item.status === "FAILED") ?? false;
  const decisionsDisabled = refreshing || Boolean(submitting) || recoveryRequired;

  return (
    <AssignmentWorkspaceFrame preview={preview} activeSection="reviews" pageClassName="lm-route-review-detail-page">
      <nav className="assignment-breadcrumb" aria-label="Breadcrumb"><Link href={queueHref}>Route Reviews</Link><span aria-hidden="true">/</span><span aria-current="page">{review?.orderCode ?? "Review"}</span></nav>

      {loading ? <div className="route-review-detail-skeleton" role="status" aria-label="Loading Route Plan"><span /><span /><span /></div> : !review ? (
        <section className="route-review-unavailable" role="alert"><span aria-hidden="true">!</span><h1>{errorCode === "FORBIDDEN" ? "Access denied" : errorCode === "STALE_STATE" ? "Route Plan changed" : "Route Plan unavailable"}</h1><p>{error}</p><div><Link className="customer-primary-button" href={queueHref}>Back to Route Reviews</Link>{errorCode === "REQUEST_FAILED" && <button className="customer-secondary-button" type="button" onClick={() => void loadReview()}>Try again</button>}</div></section>
      ) : (
        <>
          <header className="route-review-detail-heading">
            <div className="route-review-heading-copy"><span className="route-review-heading-mark"><ReviewIcon name="plan" /></span><div><span className="route-review-order-code">{review.orderCode}</span><h1>{review.origin} <b aria-hidden="true">→</b> {review.destination}</h1><p>Review the saved Route Plan. Planning data is read-only.</p></div></div>
            <div><Link className="customer-secondary-button" href={queueHref}>Back to reviews</Link><button className="customer-secondary-button" type="button" disabled={refreshing || Boolean(submitting) || (!preview && resultSource === "mutation")} onClick={() => void loadReview(true)}>{refreshing ? "Refreshing..." : "Refresh"}</button></div>
          </header>

          {feedback && <p className="customer-feedback" role="status">{feedback}</p>}
          <p className="field-hint" role="status">{preview ? "Development preview result." : resultSource === "mutation" ? "Saved decision response from this session. Historical review reload is unavailable; the server detail endpoint reads pending reviews only." : "Source: server detail read."}</p>
          {recoveryRequired && <p role="status">Decision outcome is unconfirmed. Actions stay locked while you retry the read. If this plan is no longer pending, its decision cannot be reloaded here. Return to the queue or view tracking; do not resubmit the decision.</p>}
          {error && <div className="customer-alert" role="alert"><span>{error}</span><button type="button" disabled={refreshing || Boolean(submitting)} onClick={() => void loadReview(true)}>Retry read</button></div>}

          <section className="route-review-summary" aria-label="Route Plan summary">
            <div><ReviewIcon name="status" /><span>Status</span><strong className={`route-review-status is-${review.routePlanStatus.toLowerCase()}`}>{review.routePlanStatus === "PENDING_LM_REVIEW" ? "Pending review" : review.routePlanStatus === "APPROVED" ? "Locked" : "Returned"}</strong></div>
            <div><ReviewIcon name="departure" /><span>Departure</span><strong>{formatDateTime(review.requestedDepartureAt)}</strong></div>
            <div><ReviewIcon name="transport" /><span>Transport</span><strong>{review.transportMode}</strong></div>
            <div><ReviewIcon name="horses" /><span>Horses</span><strong>{review.horseCount}</strong></div>
            <div><ReviewIcon name="frc" /><span>FRC</span><strong>{review.assignedFleetRouteCoordinatorName}</strong></div>
            <div><ReviewIcon name="validation" /><span>Validation</span><strong className={hasValidationResults ? hasValidationFailures ? "is-invalid" : "is-valid" : undefined}>{hasValidationResults ? hasValidationFailures ? "Failed" : "Passed" : "Not supplied"}</strong></div>
          </section>

          {review.routePlanStatus === "RETURNED" && <section className="route-review-returned"><strong>Returned to FRC</strong><p>{review.returnReason}</p></section>}
          {review.routePlanStatus === "APPROVED" && <section className={`route-review-ready ${hasCompleteLockedStaffing(review) ? "is-complete" : "is-incomplete"}`}><div><strong>{hasCompleteLockedStaffing(review) ? "READY_TO_SHIP" : "Staffing incomplete"}</strong><p>{hasCompleteLockedStaffing(review) ? `Locked ${review.lockedAt ? formatDateTime(review.lockedAt) : ""}. Every required assignment is shown below.` : "The saved result is missing one or more required execution assignments."}</p></div></section>}

          <section className="route-review-audit" aria-labelledby="route-review-audit-title">
            <div className="route-review-audit-heading"><div><h2 id="route-review-audit-title"><ReviewIcon name="route" />Ordered Route Plan</h2><p>{review.revision != null && <>Revision {review.revision} · </>}Submitted {formatDateTime(review.submittedAt)}</p></div><span className="route-review-readonly">Read-only</span></div>
            <div className="route-review-audit-wrap">
              <table className="route-review-audit-table">
                <thead><tr><th scope="col">#</th><th scope="col">Type</th><th scope="col">Route</th><th scope="col">Schedule</th><th scope="col">Planning details</th><th scope="col">Staffing</th><th scope="col"><span className="sr-only">Details</span></th></tr></thead>
                <tbody>{review.legs.map((leg) => <LegRows key={leg.id} leg={leg} expanded={expandedLegId === leg.id} locked={review.routePlanStatus === "APPROVED"} onToggle={() => setExpandedLegId((current) => current === leg.id ? null : leg.id)} />)}</tbody>
              </table>
            </div>
          </section>

          <section className="route-review-validation-list"><h3><ReviewIcon name="validation" />Validation result</h3>{!hasValidationResults && <p>Detailed validation results were not supplied. The server validates the Route Plan when you confirm.</p>}<ul>{review.validations.map((item) => <li key={item.code} className={item.status === "PASSED" ? "is-passed" : "is-failed"}><span aria-hidden="true">{item.status === "PASSED" ? "✓" : "!"}</span><div><strong>{item.label}</strong><p>{item.message}</p></div></li>)}</ul></section>

          {pending && <section className="route-review-staffing-rule"><h3><ReviewIcon name="frc" />Automatic staffing after confirmation</h3><div><span><b>ROAD Vehicle</b><strong>1 Driver + 1 Escort</strong></span><span><b>AIR leg</b><strong>1 Escort · No Driver</strong></span></div><p>Staff are selected by the system. Confirming permanently locks this Route Plan.</p></section>}

          {pending && returnOpen && <section className="route-review-decision-panel" aria-labelledby="return-plan-title"><div><h3 id="return-plan-title">Return Route Plan</h3><p>Explain what the assigned FRC must correct before resubmitting.</p></div><label><span>Return reason</span><textarea rows={3} value={returnReason} onChange={(event) => setReturnReason(event.target.value)} disabled={decisionsDisabled} /></label><div><button className="customer-secondary-button" type="button" onClick={() => setReturnOpen(false)} disabled={decisionsDisabled}>Cancel</button><button className="route-review-return-button" type="button" onClick={() => void mutateReview("return")} disabled={decisionsDisabled}>{submitting === "return" ? "Returning..." : "Return to FRC"}</button></div></section>}

          {pending && confirmOpen && <section className="route-review-decision-panel is-confirm" aria-labelledby="confirm-plan-title"><div><h3 id="confirm-plan-title">Confirm and permanently lock?</h3><p>The system will assign execution staff automatically. This Route Plan cannot be reopened.</p></div><div><button className="customer-secondary-button" type="button" onClick={() => setConfirmOpen(false)} disabled={decisionsDisabled}>Cancel</button><button className="customer-primary-button" type="button" onClick={() => void mutateReview("confirm")} disabled={decisionsDisabled || hasValidationFailures}>{submitting === "confirm" ? "Confirming..." : "Confirm & lock"}</button></div></section>}

          {pending && <footer className="route-review-actions"><button className="route-review-return-button" type="button" onClick={() => { setReturnOpen(true); setConfirmOpen(false); }} disabled={decisionsDisabled}>Return plan</button><button className="customer-primary-button" type="button" onClick={() => { setConfirmOpen(true); setReturnOpen(false); }} disabled={decisionsDisabled || hasValidationFailures}>Confirm &amp; lock</button></footer>}
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
      <td data-label="Planning details"><strong>{planningDetail}</strong><small>{leg.legType === "ROAD" ? `${leg.roadVehicles.reduce((sum, vehicle) => sum + allocationCount(vehicle), 0)} Horse allocations` : `Capacity ${leg.airCapacityHorses} Horses`}</small></td>
      <td data-label="Staffing">{locked ? <span className={staffingComplete ? "route-review-staff-complete" : "route-review-staff-missing"}>{staffingComplete ? "Staffed" : "Incomplete"}</span> : "Assigned after confirmation"}</td>
      <td data-label="Details"><button className="route-review-details-button" type="button" aria-expanded={expanded} onClick={onToggle}>{expanded ? "Hide details" : "View details"}</button></td>
    </tr>
    {expanded && <tr className="route-review-expanded-row"><td colSpan={7}><LegDetail leg={leg} locked={locked} /></td></tr>}
  </>;
}

function LegDetail({ leg, locked }: { leg: RouteReviewLeg; locked: boolean }) {
  if (leg.legType === "AIR") {
    return <div className="route-review-air-detail"><dl><div><dt>Air provider</dt><dd>{leg.airProviderName}</dd></div><div><dt>Flight reference</dt><dd>{leg.airReference}</dd></div><div><dt>Horse capacity</dt><dd>{leg.airCapacityHorses}</dd></div></dl><section><h4>Execution staffing</h4>{locked ? <div className="route-review-air-staff"><span><b>Driver</b><strong>No Driver</strong></span><span><b>Escort</b><StaffIdentity staff={leg.airEscort} role="Escort" /></span></div> : <p>After confirmation: 1 Escort and no Driver for this AIR leg.</p>}</section></div>;
  }
  return <div className="route-review-road-detail"><section><h4>Vehicles and Horse allocation</h4><div className="route-review-vehicle-list">{leg.roadVehicles.map((vehicle) => <article key={vehicle.id}><header><div><strong>{vehicle.plateNumber}</strong><span>{vehicle.vehicleName}</span></div><small>{allocationCount(vehicle)} / {vehicle.horseCapacity} Horses</small></header><p>{vehicle.orderHorseIds ? <>Order Horse IDs: {vehicle.orderHorseIds.join(", ")}</> : vehicle.horseNames.join(", ")}</p><div className="route-review-vehicle-staff"><span><b>Driver</b>{locked ? <StaffIdentity staff={vehicle.driver} role="Driver" /> : <strong>Assigned after confirmation</strong>}</span><span><b>Escort</b>{locked ? <StaffIdentity staff={vehicle.escort} role="Escort" /> : <strong>Assigned after confirmation</strong>}</span></div></article>)}</div></section><section><h4>Ordered checkpoints</h4>{leg.checkpoints.length ? <ol>{leg.checkpoints.map((checkpoint) => <li key={checkpoint.id}><span>{checkpoint.sequenceNo}</span><div><strong>{checkpoint.name}</strong><small>{checkpoint.checkpointType.replaceAll("_", " ")}{checkpoint.plannedStopDurationMinutes ? ` · ${checkpoint.plannedStopDurationMinutes} min` : ""}</small></div></li>)}</ol> : <p>No checkpoints are required for this ROAD leg.</p>}</section></div>;
}
