"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import EscortWorkspaceFrame from "@/components/EscortWorkspaceFrame";
import {
  EscortExecutionError,
  getEscortExecutionService,
  type AssignedRoadExecutionSummary,
  type ExecutionStatus,
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

function statusLabel(status: ExecutionStatus) {
  if (status === "DESTINATION") return "At destination";
  return status.toLowerCase().replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

function actionLabel(execution: AssignedRoadExecutionSummary) {
  if (execution.pendingCheckpointWelfareCount > 0) return "Record checkpoint welfare";
  if (execution.destinationArrivedAt && !execution.finalWelfareRecorded) return "Record final welfare";
  return "View journey";
}

export default function EscortQueuePage() {
  const { state: accessState, preview, previewEscortId, previewEscortName, message: accessMessage, retryAccess } = useEscortAccess();
  const service = useMemo(() => getEscortExecutionService(preview), [preview]);
  const [executions, setExecutions] = useState<AssignedRoadExecutionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError("");
    setErrorCode("");
    try {
      const queue = await service.listAssignedRoadWork();
      setExecutions(queue.executions);
    } catch (caught) {
      setExecutions([]);
      setError(caught instanceof Error ? caught.message : "We couldn't load your assigned journey work.");
      setErrorCode(caught instanceof EscortExecutionError ? caught.code : "REQUEST_FAILED");
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    if (accessState !== "allowed") return;
    const timer = window.setTimeout(() => { void loadQueue(); }, 0);
    return () => window.clearTimeout(timer);
  }, [accessState, loadQueue]);

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
  const welfareDue = executions.reduce((count, execution) => (
    count + execution.pendingCheckpointWelfareCount + Number(Boolean(execution.destinationArrivedAt && !execution.finalWelfareRecorded))
  ), 0);

  return (
    <EscortWorkspaceFrame preview={preview} previewEscortId={previewEscortId} previewEscortName={previewEscortName}>
      <header className="escort-page-heading">
        <div>
          <span>Journey execution</span>
          <h1>Assigned ROAD welfare work</h1>
          <p>Record welfare only for your assigned Vehicles after the Driver reaches a checkpoint or destination.</p>
        </div>
        <button className="customer-secondary-button" type="button" disabled={loading} onClick={() => void loadQueue()}>
          {loading ? "Refreshing..." : "Refresh saved state"}
        </button>
      </header>

      {error && (
        <div className="customer-alert" role="alert">
          <span>{error}</span>
          {errorCode === "REQUEST_FAILED" && <button type="button" onClick={() => void loadQueue()}>Try again</button>}
        </div>
      )}

      {loading ? (
        <div className="escort-queue-skeleton" role="status" aria-label="Loading assigned ROAD work"><span /><span /><span /></div>
      ) : !error && executions.length === 0 ? (
        <section className="escort-empty-state">
          <span aria-hidden="true">✓</span>
          <div><h2>No ROAD welfare action is assigned</h2><p>Assigned Vehicles appear here when their RouteLeg is open for execution.</p></div>
        </section>
      ) : !error && (
        <>
          <dl className="escort-queue-summary" aria-label="Assigned ROAD execution summary">
            <div><dt>Assigned Vehicles</dt><dd>{executions.length}</dd></div>
            <div><dt>Welfare updates due</dt><dd>{welfareDue}</dd></div>
            <div><dt>At destination</dt><dd>{executions.filter((execution) => Boolean(execution.destinationArrivedAt)).length}</dd></div>
          </dl>

          <section className="escort-queue-panel" aria-labelledby="escort-queue-title">
            <div className="escort-panel-heading">
              <div><h2 id="escort-queue-title">Your assigned Vehicles</h2><p>Each card represents one Vehicle execution, not the whole ROAD leg.</p></div>
              <span>{executions.length} active</span>
            </div>
            <div className="escort-work-list">
              {executions.map((execution) => (
                <article className="escort-work-card" key={execution.executionId}>
                  <header>
                    <div><span>{execution.orderCode} · Leg {execution.routeLegSequenceNo}</span><h3>{execution.vehiclePlateNumber}</h3><p>{execution.vehicleName}</p></div>
                    <span className={`escort-status is-${execution.status.toLowerCase()}`}>{statusLabel(execution.status)}</span>
                  </header>
                  <div className="escort-route-line"><span>{execution.origin}</span><b aria-hidden="true">→</b><span>{execution.destination}</span></div>
                  <dl>
                    <div><dt>Horses</dt><dd>{execution.horseCount}</dd></div>
                    <div><dt>Reached checkpoints</dt><dd>{execution.reachedCheckpointCount}</dd></div>
                    <div><dt>Welfare due</dt><dd>{execution.pendingCheckpointWelfareCount + Number(Boolean(execution.destinationArrivedAt && !execution.finalWelfareRecorded))}</dd></div>
                    <div><dt>Departure</dt><dd>{formatDateTime(execution.plannedDepartureAt)}</dd></div>
                  </dl>
                  <Link className="customer-primary-button escort-open-work" href={`/escort/executions/${execution.executionId}${previewSuffix}`}>
                    {actionLabel(execution)} <span aria-hidden="true">→</span>
                  </Link>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </EscortWorkspaceFrame>
  );
}
