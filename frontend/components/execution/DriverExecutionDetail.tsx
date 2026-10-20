"use client";

import { useState } from "react";
import { blockedMessage, checkpointArrival, currentExecutionLeg, executionStatusLabel, nextDriverAction, orderedCheckpoints } from "@/lib/driver-execution/actions";
import type { DriverExecution, DriverSession } from "@/lib/driver-execution/types";
import { useExecutionController } from "@/lib/driver-execution/use-execution-controller";
import { CheckpointPlan, LegSequence, readableStatus, timeLabel, VehicleSummary } from "./ExecutionContext";
import ExecutionIcon from "./ExecutionIcon";
import RouteSchematic, { DESTINATION_POINT, ORIGIN_POINT } from "./RouteSchematic";
import styles from "./execution.module.css";

export default function DriverExecutionDetail({ session, executionId, journey = false, onStarted, onBack, onPendingChange }: {
  session: DriverSession; executionId: string; journey?: boolean;
  onStarted: (execution: DriverExecution) => void; onBack?: () => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const controller = useExecutionController(session.service, executionId, session.driverId);
  const { execution, loading, busy, error, notice, needsRefresh, refresh, perform } = controller;
  const [selected, setSelected] = useState<string | null>(null);
  const action = execution ? nextDriverAction(execution, session.driverId) : null;
  const defaultPoint = action?.type === "CHECKPOINT" ? action.checkpointId : DESTINATION_POINT;
  const selectedPoint = selected ?? defaultPoint;
  const disabled = busy || loading || needsRefresh;
  const leg = execution ? currentExecutionLeg(execution) : null;

  async function submit() {
    if (!action) return;
    onPendingChange?.(true);
    try {
      const saved = await perform(action);
      if (saved && action.type === "START") onStarted(saved);
      if (saved) setSelected(null);
    } finally { onPendingChange?.(false); }
  }

  const alerts = <>
    {error && <div className={styles.error} role="alert"><strong>We couldn&apos;t confirm the latest state</strong><p>{error}</p><button type="button" disabled={loading || busy} onClick={() => void refresh()}>Refresh journey</button></div>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
  </>;

  if (!execution) return <div className={styles.detailPlaceholder}>{alerts}{loading ? <p role="status">Loading your assigned vehicle…</p> : !error ? <p>Select an assignment to see your ROAD work.</p> : null}</div>;
  if (!leg) return <div className={styles.error} role="alert">The assigned route leg is unavailable. Refresh your work before taking any action.</div>;

  // Started assignments can be resumed from the queue, but never show an
  // enabled check-in until the user opens the focused journey view.
  if (!journey || execution.status === "NOT_STARTED") return <section className={styles.detail} aria-busy={loading || busy}>
    {alerts}
    <div className={styles.detailHeading}>
      <div><div className={styles.orderTitle}><h2>{execution.order.code}</h2><span className={styles.badge}>{readableStatus(execution.order.status)}</span></div><p>{execution.currentLegId === execution.legId ? "Current" : "Assigned"} leg · {leg.type} {leg.sequenceNo} of {execution.legs.length}</p><h3>{leg.origin} <span aria-hidden="true">→</span> {leg.destination}</h3></div>
      <div><LegSequence execution={execution} /><p className={styles.sequenceHint}>Later legs unlock as the journey progresses.</p></div>
    </div>
    <VehicleSummary execution={execution} />
    <CheckpointPlan execution={execution} />
    <section className={styles.startPanel} aria-label="Next Driver action">
      <div><span className={styles.eyebrow}>NEXT ACTION</span><h3>{action?.type === "START" ? "Ready when you are" : execution.status === "IN_PROGRESS" ? "Continue your journey" : executionStatusLabel(execution)}</h3><p>{action?.type === "START" ? "Start your assigned vehicle to begin this ROAD leg." : blockedMessage(execution, session.driverId)}</p></div>
      <div className={styles.startAction}>{action?.type === "START" ? <button className={styles.primaryButton} disabled={disabled} type="button" onClick={() => void submit()}>{busy ? "Starting…" : action.label}<ExecutionIcon name="arrow" /></button> : execution.status !== "NOT_STARTED" ? <button type="button" className={styles.primaryButton} disabled={disabled} onClick={() => onStarted(execution)}>Open journey<ExecutionIcon name="arrow" /></button> : null}<small>{loading ? "Refreshing saved state…" : "Your vehicle progresses independently."}</small></div>
    </section>
  </section>;

  const selectedCheckpoint = orderedCheckpoints(execution).find((point) => point.id === selectedPoint);
  const selectedArrival = selectedCheckpoint ? checkpointArrival(execution, selectedCheckpoint.id) : null;
  const selectedIsAction = action?.type === "CHECKPOINT" ? action.checkpointId === selectedPoint : action?.type === "DESTINATION" && selectedPoint === DESTINATION_POINT;
  const selectedName = selectedPoint === ORIGIN_POINT ? leg.origin : selectedPoint === DESTINATION_POINT ? leg.destination : selectedCheckpoint?.name ?? leg.destination;
  return <section className={styles.journey} aria-busy={loading || busy}>
    <header className={styles.journeyHeader}>
      <button className={styles.backButton} type="button" disabled={busy} onClick={onBack}><ExecutionIcon name="back" />My ROAD work</button>
      <button className={styles.secondaryButton} disabled={loading || busy} type="button" onClick={() => void refresh()}><ExecutionIcon name="refresh" />{loading ? "Refreshing…" : "Refresh"}</button>
    </header>
    {alerts}
    <div className={styles.journeyIdentity}><div><h1>{execution.order.code}</h1><p>Your vehicle · <strong>{execution.vehicle.plateNumber}</strong> · {execution.vehicle.horseCount} horses</p></div><span className={styles.badge}>{executionStatusLabel(execution)}</span></div>
    <LegSequence execution={execution} />
    <div className={styles.journeyBody}>
      <RouteSchematic execution={execution} selectedPoint={selectedPoint} onSelect={setSelected} />
      <section className={styles.actionSheet} aria-labelledby="selected-stop-heading">
        <span className={styles.sheetHandle} aria-hidden="true" />
        <span className={styles.eyebrow}>{selectedPoint === ORIGIN_POINT ? "ORIGIN" : selectedPoint === DESTINATION_POINT ? "DESTINATION" : "CHECKPOINT"} · ROAD LEG {leg.sequenceNo}</span>
        <h2 id="selected-stop-heading">{selectedName}</h2><p className={styles.sheetVehicle}>Vehicle {execution.vehicle.plateNumber}</p>
        {execution.status === "DESTINATION" || execution.status === "COMPLETED" ? <p className={styles.waitingMessage}>{blockedMessage(execution, session.driverId)}</p> : selectedIsAction ? <>
          <p>Check in only when you have arrived.</p>
          <button type="button" className={styles.primaryButton} disabled={disabled} onClick={() => void submit()}>{busy ? "Recording arrival…" : action?.label}</button>
          <small>{needsRefresh ? "Refresh is required before another action." : "Progress updates after confirmation."}</small>
        </> : <>
          <p className={styles.waitingMessage}>{selectedPoint === ORIGIN_POINT ? `Vehicle started ${timeLabel(execution.startedAt)}.` : selectedArrival ? `Arrival recorded ${timeLabel(selectedArrival.arrivedAt)}.` : action ? "This stop is not available for check-in yet. Open the next stop to continue." : blockedMessage(execution, session.driverId)}</p>
          {action && <button className={styles.secondaryButton} type="button" disabled={disabled} onClick={() => setSelected(defaultPoint)}>Open next stop<ExecutionIcon name="arrow" /></button>}
        </>}
        <details className={styles.journeyDetails}><summary>Journey details</summary><VehicleSummary execution={execution} /><CheckpointPlan execution={execution} /></details>
      </section>
    </div>
  </section>;
}
