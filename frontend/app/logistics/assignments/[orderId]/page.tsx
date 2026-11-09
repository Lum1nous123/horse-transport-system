"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AssignmentWorkspaceFrame from "@/components/AssignmentWorkspaceFrame";
import {
  getStaffAssignmentService,
  type AssignmentCandidate,
  type AssignmentOrderDetail,
  type StaffRole,
} from "@/lib/staff-assignment/service";
import { useLogisticsAccess } from "@/lib/staff-assignment/use-logistics-access";
import "./assignment-detail.css";

type SummaryIconName = "order" | "route" | "departure" | "horses" | "mode";
const summaryIconPaths: Record<SummaryIconName, string[]> = {
  order: ["M6 3h9l4 4v14H6z", "M15 3v5h4M9 12h7m-7 4h7"],
  route: ["M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11Z", "M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"],
  departure: ["M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z", "M8 2v4m8-4v4M3 9h18"],
  horses: ["M6 20v-7l3-5 4-2 3-3 2 5 3 3-2 4-3-1-2 6H6Z", "M16 10h.01"],
  mode: ["M3 7h11v10H3z", "M14 10h4l3 3v4h-7z", "M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"],
};

function SummaryIcon({ name }: { name: SummaryIconName }) {
  return <span className="assignment-summary-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{summaryIconPaths[name].map((path) => <path d={path} key={path} />)}</svg></span>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function StaffAssignmentDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  return <AssignmentDetail key={orderId} />;
}

function AssignmentDetail() {
  const params = useParams<{ orderId: string }>();
  const { state: accessState, preview, message: accessMessage } = useLogisticsAccess();
  const staffAssignmentService = useMemo(() => getStaffAssignmentService(preview), [preview]);
  const [order, setOrder] = useState<AssignmentOrderDetail | null>(null);
  const [transportSpecialistId, setTransportSpecialistId] = useState("");
  const [fleetRouteCoordinatorId, setFleetRouteCoordinatorId] = useState("");
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [recoveryRequired, setRecoveryRequired] = useState(false);
  const inFlight = useRef(false);
  const unreconciled = useRef(false);

  const loadOrder = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError("");
    try {
      const detail = await staffAssignmentService.getOrder(params.orderId);
      setOrder(detail);
      unreconciled.current = false;
      setRecoveryRequired(false);
      if (detail.assignedPair) {
        setTransportSpecialistId(detail.assignedPair.transportSpecialist.id);
        setFleetRouteCoordinatorId(detail.assignedPair.fleetRouteCoordinator.id);
      }
    } catch (loadError) {
      unreconciled.current = true;
      setRecoveryRequired(true);
      setError(loadError instanceof Error ? loadError.message : "We couldn't load this assignment.");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [params.orderId, staffAssignmentService]);

  useEffect(() => {
    if (accessState !== "allowed") return;
    const timer = window.setTimeout(() => { void loadOrder(); }, 0);
    return () => window.clearTimeout(timer);
  }, [accessState, loadOrder]);

  async function assignStaff() {
    if (!order || inFlight.current || unreconciled.current || order.assignedPair) return;
    setError("");
    setFeedback("");
    if (!transportSpecialistId || !fleetRouteCoordinatorId) {
      setError("Choose one Transport Specialist and one Fleet & Route Coordinator before assigning staff.");
      return;
    }

    inFlight.current = true;
    unreconciled.current = true;
    setRecoveryRequired(true);
    setAssigning(true);
    try {
      await staffAssignmentService.assignStaff(order.id, {
        transportSpecialistId,
        fleetRouteCoordinatorId,
      });
      const saved = await staffAssignmentService.getOrder(order.id);
      if (!saved.assignedPair) throw new Error("The saved staff pair has not been confirmed. Retry the read.");
      setOrder(saved);
      unreconciled.current = false;
      setRecoveryRequired(false);
      setFeedback("Staff assigned. The saved pair is now read-only.");
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : "The assignment outcome could not be verified.");
      // The POST may have persisted. Recovery is a separate GET, never a replay.
    } finally {
      inFlight.current = false;
      setAssigning(false);
    }
  }

  if (accessState !== "allowed") {
    const isChecking = accessState === "checking";
    return (
      <main className="customer-page">
        <div className="customer-content assignment-access-state">
          <p className="customer-loading" role={isChecking ? "status" : "alert"}>
            {isChecking ? "Checking Logistics Manager access…" : accessMessage}
          </p>
          {!isChecking && <Link className="customer-secondary-button" href="/login">Return to sign in</Link>}
        </div>
      </main>
    );
  }

  const previewSuffix = preview ? "?preview=1" : "";

  return (
    <AssignmentWorkspaceFrame preview={preview} pageClassName="lm-assignment-detail-page">
      <nav className="assignment-breadcrumb" aria-label="Breadcrumb">
        <Link href={`/logistics${previewSuffix}`}>Logistics</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/logistics/assignments${previewSuffix}`}>Staff Assignment</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{order?.orderCode ?? "Order"}</span>
      </nav>

      {feedback && <p className="customer-feedback assignment-feedback" role="status">{feedback}</p>}
      {error && (
        <div className="customer-alert" role="alert">
          <span>{error}</span>
          <button type="button" disabled={loading || assigning} onClick={() => void loadOrder()}>Retry read</button>
        </div>
      )}

      {recoveryRequired && <p role="status">Assignment outcome is unconfirmed. Editing stays locked until a successful read. Retry reads the saved assignment without submitting it again.</p>}
      {loading ? (
        <div className="assignment-detail-loading" role="status">
          <span /><span /><span />
          <p>Loading assignment details…</p>
        </div>
      ) : !order ? (
        <section className="assignment-not-found">
          <p className="customer-eyebrow">ASSIGNMENT UNAVAILABLE</p>
          <h1>We couldn&apos;t open this order.</h1>
          <p>Return to the assignment queue to choose an available order.</p>
          <Link className="customer-primary-button" href={`/logistics/assignments${previewSuffix}`}>Back to assignment queue</Link>
        </section>
      ) : (
        <>
          <div className="assignment-detail-heading">
            <div className="assignment-heading-copy">
              <span className={`assignment-status${order.assignedPair ? " is-assigned" : ""}`}>
                {order.assignedPair ? "Assigned" : "Needs assignment"}
              </span>
              <div className="assignment-heading-title"><span className="assignment-heading-icon" aria-hidden="true">♞</span><div><h1>Staff Assignment</h1>
                <p>{order.assignedPair ? "The saved staff pair is read-only." : "Choose one specialist for each role."}</p></div></div>
            </div>
            <Link className="assignment-back-link" href={`/logistics/assignments${previewSuffix}`}>← Back to assignment queue</Link>
          </div>

          <section className="assignment-order-summary" aria-labelledby="assignment-order-heading">
            <div><SummaryIcon name="order" /><span>Order</span><strong id="assignment-order-heading">{order.orderCode}</strong></div>
            <div><SummaryIcon name="route" /><span>Route</span><strong>{order.origin} <b aria-hidden="true">→</b> {order.destination}</strong></div>
            <div><SummaryIcon name="departure" /><span>Departure</span><strong>{formatDate(order.requestedDepartureAt)}</strong></div>
            <div><SummaryIcon name="horses" /><span>Horses</span><strong>{order.horseCount}</strong></div>
            <div><SummaryIcon name="mode" /><span>Mode</span><strong>{order.transportMode}</strong></div>
          </section>

          {order.assignedPair ? (
            <ReadOnlyAssignment order={order} preview={preview} />
          ) : (
            <>
              <div className="assignment-candidate-grid">
                <CandidateGroup
                  title="Transport Specialist"
                  description="Select one Transport Specialist for this order."
                  role="TRANSPORT_SPECIALIST"
                  candidates={order.candidates.transportSpecialists}
                  selectedId={transportSpecialistId}
                  disabled={assigning || recoveryRequired}
                  onSelect={setTransportSpecialistId}
                />
                <CandidateGroup
                  title="Fleet & Route Coordinator"
                  description="Select one Fleet & Route Coordinator for this order."
                  role="FLEET_ROUTE_COORDINATOR"
                  candidates={order.candidates.fleetRouteCoordinators}
                  selectedId={fleetRouteCoordinatorId}
                  disabled={assigning || recoveryRequired}
                  onSelect={setFleetRouteCoordinatorId}
                />
              </div>

              <section className="assignment-submit-bar" aria-label="Selected staff">
                <div>
                  <span>Transport Specialist</span>
                  <strong>{candidateName(order.candidates.transportSpecialists, transportSpecialistId)}</strong>
                </div>
                <div>
                  <span>Fleet &amp; Route Coordinator</span>
                  <strong>{candidateName(order.candidates.fleetRouteCoordinators, fleetRouteCoordinatorId)}</strong>
                </div>
                <button
                  className="customer-primary-button"
                  type="button"
                  disabled={assigning || recoveryRequired || !transportSpecialistId || !fleetRouteCoordinatorId}
                  onClick={() => void assignStaff()}
                >
                  {assigning ? "Assigning staff…" : "Assign staff"}
                </button>
              </section>
              <p className="assignment-submit-note">Choose one candidate in each table. This assignment cannot be changed in this workflow.</p>
            </>
          )}
        </>
      )}
    </AssignmentWorkspaceFrame>
  );
}

function candidateName(candidates: AssignmentCandidate[], selectedId: string) {
  return candidates.find((candidate) => candidate.id === selectedId)?.fullName ?? "Not selected";
}

function CandidateGroup({
  title,
  description,
  role,
  candidates,
  selectedId,
  disabled,
  onSelect,
}: {
  title: string;
  description: string;
  role: StaffRole;
  candidates: AssignmentCandidate[];
  selectedId: string;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  const groupName = role === "TRANSPORT_SPECIALIST" ? "transport-specialist" : "fleet-route-coordinator";
  return (
    <fieldset className="assignment-candidate-group" disabled={disabled}>
      <legend><span className="assignment-role-icon" aria-hidden="true">{role === "TRANSPORT_SPECIALIST" ? "♞" : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 18c6 0 5-11 13-11" strokeDasharray="2 3"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/></svg>}</span>{title}</legend>
      <p>{description}</p>
      <div className="assignment-candidate-header" aria-hidden="true">
        <span>Select</span><span>Name</span><span>Email</span><span>Active orders</span>
      </div>
      <div className="assignment-candidate-list">
        {candidates.length === 0 ? (
          <p className="assignment-candidate-empty">No candidates are currently available for this role.</p>
        ) : candidates.map((candidate) => (
          <label className={`assignment-candidate-row${selectedId === candidate.id ? " is-selected" : ""}`} key={candidate.id}>
            <span className="assignment-radio-cell">
              <input
                type="radio"
                name={groupName}
                value={candidate.id}
                checked={selectedId === candidate.id}
                onChange={() => onSelect(candidate.id)}
              />
              <span className="sr-only">Select {candidate.fullName}</span>
            </span>
            <span><small>Name</small><strong>{candidate.fullName}</strong></span>
            <span><small>Email</small>{candidate.email}</span>
            <span className="assignment-active-orders"><small>Active orders</small>{candidate.activeOrderCount}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ReadOnlyAssignment({ order, preview }: { order: AssignmentOrderDetail; preview: boolean }) {
  const pair = order.assignedPair;
  if (!pair) return null;
  return (
    <section className="assignment-readonly" aria-labelledby="saved-assignment-heading">
      <div className="assignment-readonly-heading">
        <div><span className="assignment-success-mark" aria-hidden="true">✓</span><div><h2 id="saved-assignment-heading">Saved assignment</h2><p>This staff pair is read-only.</p></div></div>
        <span>Assigned {formatDate(pair.assignedAt)}</span>
      </div>
      <div className="assignment-readonly-grid">
        <StaffSummary label="Transport Specialist" candidate={pair.transportSpecialist} />
        <StaffSummary label="Fleet & Route Coordinator" candidate={pair.fleetRouteCoordinator} />
      </div>
      {preview && (
        <div className="assignment-preview-handoff">
          <div><strong>Preview the handoff</strong><span>Open the workspace as {pair.transportSpecialist.fullName} and confirm this Order appears there.</span></div>
          <Link className="customer-primary-button" href={`/transport-specialist?preview=1&specialistId=${encodeURIComponent(pair.transportSpecialist.id)}`}>
            Open {pair.transportSpecialist.fullName}&apos;s workspace <span aria-hidden="true">→</span>
          </Link>
        </div>
      )}
    </section>
  );
}

function StaffSummary({ label, candidate }: { label: string; candidate: AssignmentCandidate }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{candidate.fullName}</strong>
      <a href={`mailto:${candidate.email}`}>{candidate.email}</a>
      <p><b>{candidate.activeOrderCount}</b> active {candidate.activeOrderCount === 1 ? "order" : "orders"}</p>
    </article>
  );
}
