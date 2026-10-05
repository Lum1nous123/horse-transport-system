"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AssignmentWorkspaceFrame from "@/components/AssignmentWorkspaceFrame";
import {
  AssignmentServiceError,
  staffAssignmentService,
  type AssignmentCandidate,
  type AssignmentOrderDetail,
  type StaffRole,
} from "@/lib/staff-assignment/service";
import { useLogisticsAccess } from "@/lib/staff-assignment/use-logistics-access";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function StaffAssignmentDetailPage() {
  const params = useParams<{ orderId: string }>();
  const { state: accessState, preview, message: accessMessage } = useLogisticsAccess();
  const [order, setOrder] = useState<AssignmentOrderDetail | null>(null);
  const [transportSpecialistId, setTransportSpecialistId] = useState("");
  const [fleetRouteCoordinatorId, setFleetRouteCoordinatorId] = useState("");
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const loadOrder = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const detail = await staffAssignmentService.getOrder(params.orderId);
      setOrder(detail);
      if (detail.assignedPair) {
        setTransportSpecialistId(detail.assignedPair.transportSpecialist.id);
        setFleetRouteCoordinatorId(detail.assignedPair.fleetRouteCoordinator.id);
      }
    } catch (loadError) {
      setOrder(null);
      setError(loadError instanceof Error ? loadError.message : "We couldn't load this assignment.");
    } finally {
      setLoading(false);
    }
  }, [params.orderId]);

  useEffect(() => {
    if (accessState !== "allowed") return;
    const timer = window.setTimeout(() => { void loadOrder(); }, 0);
    return () => window.clearTimeout(timer);
  }, [accessState, loadOrder]);

  async function assignStaff() {
    if (!order || assigning || order.assignedPair) return;
    setError("");
    setFeedback("");
    if (!transportSpecialistId || !fleetRouteCoordinatorId) {
      setError("Choose one Transport Specialist and one Fleet & Route Coordinator before assigning staff.");
      return;
    }

    setAssigning(true);
    try {
      await staffAssignmentService.assignStaff(order.id, {
        transportSpecialistId,
        fleetRouteCoordinatorId,
      });
      const saved = await staffAssignmentService.getOrder(order.id);
      setOrder(saved);
      setFeedback("Staff assigned. The saved pair is now read-only.");
    } catch (assignError) {
      if (assignError instanceof AssignmentServiceError && assignError.code === "STALE_STATE") {
        try {
          const saved = await staffAssignmentService.getOrder(order.id);
          setOrder(saved);
          setFeedback(assignError.message);
        } catch (refreshError) {
          setError(refreshError instanceof Error ? refreshError.message : "We couldn't refresh the saved assignment.");
        }
      } else {
        setError(assignError instanceof Error ? assignError.message : "We couldn't assign staff. Try again.");
      }
    } finally {
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
    <AssignmentWorkspaceFrame preview={preview}>
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
          {!order && <button type="button" onClick={() => void loadOrder()}>Try again</button>}
        </div>
      )}

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
            <div>
              <span className={`assignment-status${order.assignedPair ? " is-assigned" : ""}`}>
                {order.assignedPair ? "Assigned" : "Needs assignment"}
              </span>
              <h1>Staff Assignment</h1>
              <p>Choose one specialist for each role.</p>
            </div>
            <Link className="assignment-back-link" href={`/logistics/assignments${previewSuffix}`}>← Back to assignment queue</Link>
          </div>

          <section className="assignment-order-summary" aria-labelledby="assignment-order-heading">
            <div><span>Order</span><strong id="assignment-order-heading">{order.orderCode}</strong></div>
            <div><span>Route</span><strong>{order.origin} <b aria-hidden="true">→</b> {order.destination}</strong></div>
            <div><span>Departure</span><strong>{formatDate(order.requestedDepartureAt)}</strong></div>
            <div><span>Horses</span><strong>{order.horseCount}</strong></div>
            <div><span>Mode</span><strong>{order.transportMode}</strong></div>
          </section>

          {order.assignedPair ? (
            <ReadOnlyAssignment order={order} />
          ) : (
            <>
              <div className="assignment-candidate-grid">
                <CandidateGroup
                  title="Transport Specialist"
                  description="Select one Transport Specialist for this order."
                  role="TRANSPORT_SPECIALIST"
                  candidates={order.candidates.transportSpecialists}
                  selectedId={transportSpecialistId}
                  disabled={assigning}
                  onSelect={setTransportSpecialistId}
                />
                <CandidateGroup
                  title="Fleet & Route Coordinator"
                  description="Select one Fleet & Route Coordinator for this order."
                  role="FLEET_ROUTE_COORDINATOR"
                  candidates={order.candidates.fleetRouteCoordinators}
                  selectedId={fleetRouteCoordinatorId}
                  disabled={assigning}
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
                  disabled={assigning || !transportSpecialistId || !fleetRouteCoordinatorId}
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
      <legend>{title}</legend>
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

function ReadOnlyAssignment({ order }: { order: AssignmentOrderDetail }) {
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
