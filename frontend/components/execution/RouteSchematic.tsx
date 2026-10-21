"use client";

import type { CSSProperties } from "react";
import { checkpointArrival, currentExecutionLeg, orderedCheckpoints } from "@/lib/driver-execution/actions";
import type { DriverExecution } from "@/lib/driver-execution/types";
import ExecutionIcon from "./ExecutionIcon";
import { timeLabel } from "./ExecutionContext";
import styles from "./execution.module.css";

export const ORIGIN_POINT = "origin";
export const DESTINATION_POINT = "destination";

export default function RouteSchematic({ execution, selectedPoint, onSelect }: {
  execution: DriverExecution; selectedPoint: string; onSelect: (id: string) => void;
}) {
  const leg = currentExecutionLeg(execution);
  if (!leg) return null;
  const checkpoints = orderedCheckpoints(execution);
  const points = [
    { id: ORIGIN_POINT, name: leg.origin, sequence: "", reachedAt: execution.startedAt, endpoint: true },
    ...checkpoints.map((checkpoint) => ({ id: checkpoint.id, name: checkpoint.name, sequence: String(checkpoint.sequenceNo), reachedAt: checkpointArrival(execution, checkpoint.id)?.arrivedAt ?? null, endpoint: false })),
    { id: DESTINATION_POINT, name: leg.destination, sequence: "", reachedAt: execution.destinationArrivedAt, endpoint: true },
  ];
  const height = Math.max(460, points.length * 110);
  const positioned = points.map((point, index) => ({
    ...point, x: index === 0 ? 160 : index === points.length - 1 ? 390 : index % 2 ? 270 : 360,
    y: height - 65 - index * ((height - 130) / (points.length - 1)),
  }));
  const reached = positioned.filter((point) => point.reachedAt);
  return <section className={styles.map} aria-label="Planned route schematic">
    <div className={styles.mapCanvas} style={{ "--route-height": `${height}px`, "--mobile-route-height": `${Math.max(320, points.length * 80)}px` } as CSSProperties}>
      <svg className={styles.mapDrawing} viewBox={`0 0 640 ${height}`} preserveAspectRatio="none" aria-hidden="true">
        <defs><pattern id="execution-streets" width="95" height="95" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)"><path d="M0 4H95M4 0V95M48 0V95M0 48H95" stroke="#fff" strokeWidth="3" /><path d="M6 7h32v28H6zM54 56h30v25H54z" fill="#e5eddf" /></pattern></defs>
        <path fill="#f1f3ef" d={`M0 0H640V${height}H0z`} />
        <path fill="url(#execution-streets)" d={`M0 0H640V${height}H0z`} />
        <path d={`M100 ${height}C10 ${height * .7} 450 ${height * .8} 170 ${height * .45}S550 90 470 0`} stroke="#c7e5f3" strokeWidth="23" fill="none" />
        <path d={`M0 ${height * .4}L640 ${height * .75}M140 0L620 ${height}M0 ${height * .8}L640 50`} stroke="white" strokeWidth="9" fill="none" />
        <polyline points={positioned.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="white" strokeWidth="13" strokeLinejoin="round" />
        <polyline points={positioned.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#a3b5c1" strokeWidth="5" strokeLinejoin="round" strokeDasharray="7 7" />
        {reached.length > 1 && <polyline points={reached.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#2878c8" strokeWidth="6" strokeLinejoin="round" />}
      </svg>
      <ol className={styles.mapPoints} aria-label="Origin, shared checkpoints, and destination">{positioned.map((point) => {
        const next = execution.permissions.nextCheckpointId === point.id;
        return <li key={point.id} style={{ left: `${point.x / 640 * 100}%`, top: `${point.y / height * 100}%` }}>
          <button type="button" className={`${styles.mapPoint} ${point.reachedAt ? styles.reachedPoint : ""} ${selectedPoint === point.id ? styles.selectedPoint : ""}`} aria-pressed={selectedPoint === point.id} aria-label={`${point.endpoint ? point.id === ORIGIN_POINT ? "Origin" : "Destination" : `Checkpoint ${point.sequence}`}: ${point.name}${point.reachedAt ? ", recorded" : next ? ", next stop" : ""}`} onClick={() => onSelect(point.id)}>
            <span className={styles.mapPin}>{point.reachedAt ? <ExecutionIcon name="check" /> : point.id === DESTINATION_POINT ? <ExecutionIcon name="flag" /> : point.sequence || <span className={styles.originPin} />}</span>
            <span className={`${styles.mapLabel} ${point.x > 330 ? styles.labelLeft : ""}`}>{next && <small className={styles.nextStop}>Next stop</small>}<strong>{point.sequence && `${point.sequence}. `}{point.name}</strong>{point.reachedAt && <small>{point.id === ORIGIN_POINT ? "Started" : "Arrived"} {timeLabel(point.reachedAt)}</small>}</span>
          </button>
        </li>;
      })}</ol>
    </div>
    <p className={styles.mapCaption}>Route schematic · not to scale <span>Progress from recorded check-ins</span></p>
  </section>;
}
