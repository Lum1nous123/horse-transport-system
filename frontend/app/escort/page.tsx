"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import EscortWorkspaceFrame from "@/components/EscortWorkspaceFrame";
import { resolveAirExecutionAction } from "@/lib/escort-execution/air-action";
import {
  EscortExecutionError,
  getEscortExecutionService,
  type AssignedAirExecutionSummary,
  type AssignedRoadExecutionSummary,
} from "@/lib/escort-execution/service";
import { useEscortAccess } from "@/lib/escort-execution/use-escort-access";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status: string) {
  if (status === "DESTINATION") return "At destination";
  return status.toLowerCase().replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

function roadActionLabel(execution: AssignedRoadExecutionSummary) {
  if (execution.proofOfDeliveryAvailable) return "Record Proof of Delivery";
  if (execution.proofOfDeliveryRecorded) return "View saved handover";
  if (execution.pendingCheckpointWelfareCount > 0) return "Record checkpoint welfare";
  if (execution.destinationArrivedAt && !execution.finalWelfareRecorded) return "Record final welfare";
  return "View ROAD details";
}

function airActionLabel(execution: AssignedAirExecutionSummary) {
  if (execution.proofOfDeliveryAvailable) return "Record Proof of Delivery";
  if (execution.proofOfDeliveryRecorded) return "View saved handover";
  const action = resolveAirExecutionAction(execution);
  if (action.kind === "START") return "Start AIR execution";
  if (action.kind === "ARRIVE_AT_DESTINATION") return "Record destination arrival";
  if (action.kind === "RECORD_WELFARE") return "Record AIR welfare";
  if (action.kind === "COMPLETE") return "Complete AIR execution";
  if (action.kind === "AWAITING_POD") return "Awaiting PoD";
  if (action.kind === "INVALID") return "State unavailable";
  return "View AIR details";
}

type QueueError = { message: string; code: string };

function queueError(caught: unknown, fallback: string): QueueError {
  return {
    message: caught instanceof Error ? caught.message : fallback,
    code: caught instanceof EscortExecutionError ? caught.code : "REQUEST_FAILED",
  };
}

export default function EscortQueuePage() {
  const { state: accessState, preview, previewEscortId, previewEscortName, message: accessMessage, retryAccess } = useEscortAccess();
  const service = useMemo(() => getEscortExecutionService(preview), [preview]);
  const [roadExecutions, setRoadExecutions] = useState<AssignedRoadExecutionSummary[]>([]);
  const [airExecutions, setAirExecutions] = useState<AssignedAirExecutionSummary[]>([]);
  const [roadLoading, setRoadLoading] = useState(true);
  const [airLoading, setAirLoading] = useState(true);
  const [roadError, setRoadError] = useState<QueueError | null>(null);
  const [airError, setAirError] = useState<QueueError | null>(null);

  const loadRoadQueue = useCallback(async () => {
    setRoadLoading(true);
    setRoadError(null);
    try {
      const queue = await service.listAssignedRoadWork();
      setRoadExecutions(queue.executions);
    } catch (caught) {
      setRoadExecutions([]);
      setRoadError(queueError(caught, "We couldn't load your assigned ROAD work."));
    } finally {
      setRoadLoading(false);
    }
  }, [service]);

  const loadAirQueue = useCallback(async () => {
    setAirLoading(true);
    setAirError(null);
    try {
      const queue = await service.listAssignedAirWork();
      setAirExecutions(queue.executions);
    } catch (caught) {
      setAirExecutions([]);
      setAirError(queueError(caught, "We couldn't load your assigned AIR work."));
    } finally {
      setAirLoading(false);
    }
  }, [service]);

  const loadAll = useCallback(async () => {
    await Promise.allSettled([loadRoadQueue(), loadAirQueue()]);
  }, [loadAirQueue, loadRoadQueue]);

  useEffect(() => {
    if (accessState !== "allowed") return;
    const timer = window.setTimeout(() => { void loadAll(); }, 0);
    return () => window.clearTimeout(timer);
  }, [accessState, loadAll]);

  if (accessState === "checking") {
    return <main className="customer-page assignment-access-state"><p role="status">Checking Escort access...</p></main>;
  }

  if (accessState === "forbidden" || accessState === "failed") {
    return (
      <main className="customer-page assignment-access-state">
        <section className="assignment-access-card" role="alert">
          <p className="customer-eyebrow">WORKSPACE UNAVAILABLE</p>
          <h1>{accessState === "forbidden" ? "Access denied" : "We couldn't verify access"}</h1>
          <p>{accessMessage}</p>
          <div>
            {accessState === "failed" && <button className="customer-primary-button" type="button" onClick={retryAccess}>Try again</button>}
            <Link className="customer-secondary-button" href="/login">Return to sign in</Link>
          </div>
        </section>
      </main>
    );
  }

  const previewSuffix = preview ? `?preview=1&escortId=${encodeURIComponent(previewEscortId)}` : "";
  const roadWelfareDue = roadExecutions.reduce((count, execution) => (
    count + execution.pendingCheckpointWelfareCount + Number(Boolean(execution.destinationArrivedAt && !execution.finalWelfareRecorded))
  ), 0);
  const roadHandoversDue = roadExecutions.filter((execution) => execution.proofOfDeliveryAvailable).length;
  const airActionsDue = airExecutions.filter((execution) => {
    const action = resolveAirExecutionAction(execution);
    return execution.proofOfDeliveryAvailable
      || action.kind === "START"
      || action.kind === "ARRIVE_AT_DESTINATION"
      || action.kind === "RECORD_WELFARE"
      || action.kind === "COMPLETE";
  }).length;
  const refreshing = roadLoading || airLoading;

  return (
    <EscortWorkspaceFrame preview={preview} previewEscortId={previewEscortId} previewEscortName={previewEscortName}>
      <header className="escort-page-heading">
        <div>
          <span>Journey execution</span>
          <h1>Assigned journey work</h1>
          <p>Review ROAD/AIR welfare, execution and final handover actions assigned to your Escort account.</p>
        </div>
        <button className="customer-secondary-button" type="button" disabled={refreshing} onClick={() => void loadAll()}>
          {refreshing ? "Refreshing..." : "Refresh saved state"}
        </button>
      </header>

      <section className="escort-mode-section" aria-labelledby="road-queue-title">
        <div className="escort-mode-heading">
          <div><span>ROAD</span><h2 id="road-queue-title">Assigned Vehicle work</h2><p>Record welfare after Driver arrival and complete final handover only for destination-ready Vehicles.</p></div>
          {!roadLoading && !roadError && <strong>{roadExecutions.length} active · {roadWelfareDue} welfare · {roadHandoversDue} handover</strong>}
        </div>
        {roadError && <div className="customer-alert" role="alert"><span>{roadError.message}</span>{roadError.code === "REQUEST_FAILED" && <button type="button" onClick={() => void loadRoadQueue()}>Try ROAD again</button>}</div>}
        {roadLoading ? (
          <div className="escort-queue-skeleton is-compact" role="status" aria-label="Loading assigned ROAD work"><span /><span /></div>
        ) : !roadError && roadExecutions.length === 0 ? (
          <div className="escort-empty-state"><span aria-hidden="true">✓</span><div><h3>No ROAD welfare action is assigned</h3><p>Assigned Vehicles appear here when their RouteLeg is open for execution.</p></div></div>
        ) : !roadError && (
          <div className="escort-work-list">
            {roadExecutions.map((execution) => (
              <article className="escort-work-card" key={execution.executionId}>
                <header><div><span>{execution.orderCode} · Leg {execution.routeLegSequenceNo}</span><h3>{execution.vehiclePlateNumber}</h3><p>{execution.vehicleName}</p></div><span className={`escort-status is-${execution.status.toLowerCase()}`}>{statusLabel(execution.status)}</span></header>
                <div className="escort-route-line"><span>{execution.origin}</span><b aria-hidden="true">→</b><span>{execution.destination}</span></div>
                <dl><div><dt>Horses</dt><dd>{execution.horseCount}</dd></div><div><dt>Reached checkpoints</dt><dd>{execution.reachedCheckpointCount}</dd></div><div><dt>{execution.isFinalLeg ? "Handovers" : "Welfare due"}</dt><dd>{execution.isFinalLeg ? `${execution.handoverProgress.completedHandovers}/${execution.handoverProgress.requiredHandovers}` : execution.pendingCheckpointWelfareCount + Number(Boolean(execution.destinationArrivedAt && !execution.finalWelfareRecorded))}</dd></div><div><dt>Departure</dt><dd>{formatDateTime(execution.plannedDepartureAt)}</dd></div></dl>
                <Link className="customer-primary-button escort-open-work" href={`/escort/executions/${execution.executionId}${previewSuffix}`}>{roadActionLabel(execution)} <span aria-hidden="true">→</span></Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="escort-mode-section" aria-labelledby="air-queue-title">
        <div className="escort-mode-heading">
          <div><span>AIR</span><h2 id="air-queue-title">Assigned RouteLeg execution</h2><p>Upcoming assignments stay visible; actions appear only when the persisted RouteLeg and execution state allow them.</p></div>
          {!airLoading && !airError && <strong>{airExecutions.length} assigned · {airActionsDue} actionable</strong>}
        </div>
        {airError && <div className="customer-alert" role="alert"><span>{airError.message}</span>{airError.code === "REQUEST_FAILED" && <button type="button" onClick={() => void loadAirQueue()}>Try AIR again</button>}</div>}
        {airLoading ? (
          <div className="escort-queue-skeleton is-compact" role="status" aria-label="Loading assigned AIR work"><span /><span /></div>
        ) : !airError && airExecutions.length === 0 ? (
          <div className="escort-empty-state"><span aria-hidden="true">✓</span><div><h3>No AIR execution is assigned</h3><p>Upcoming and actionable AIR RouteLeg assignments will appear here.</p></div></div>
        ) : !airError && (
          <div className="escort-work-list">
            {airExecutions.map((execution) => (
              <article className="escort-work-card escort-air-card" key={execution.executionId}>
                <header><div><span>{execution.orderCode} · Leg {execution.routeLegSequenceNo}</span><h3>AIR RouteLeg</h3><p>{execution.isFinalLeg ? "Final leg" : "Connecting leg"}</p></div><span className={`escort-status is-${execution.status.toLowerCase()}`}>{statusLabel(execution.status)}</span></header>
                <div className="escort-route-line"><span>{execution.origin}</span><b aria-hidden="true">✈</b><span>{execution.destination}</span></div>
                <dl><div><dt>RouteLeg</dt><dd>{statusLabel(execution.routeLegStatus)}</dd></div><div><dt>Departure</dt><dd>{formatDateTime(execution.plannedDepartureAt)}</dd></div><div><dt>Arrival</dt><dd>{formatDateTime(execution.plannedArrivalAt)}</dd></div><div><dt>{execution.isFinalLeg ? "Handover" : "Welfare"}</dt><dd>{execution.isFinalLeg ? `${execution.handoverProgress.completedHandovers}/${execution.handoverProgress.requiredHandovers}` : execution.welfareRecorded ? "Saved" : "Not saved"}</dd></div></dl>
                <Link className="customer-primary-button escort-open-work" href={`/escort/air-executions/${execution.executionId}${previewSuffix}`}>{airActionLabel(execution)} <span aria-hidden="true">→</span></Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </EscortWorkspaceFrame>
  );
}
