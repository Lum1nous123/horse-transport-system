"use client";

import { checkpointArrival, currentExecutionLeg, orderedCheckpoints } from "@/lib/driver-execution/actions";
import type { DriverExecution } from "@/lib/driver-execution/types";
import ExecutionIcon from "./ExecutionIcon";
import { timeLabel } from "./ExecutionContext";
import styles from "./execution.module.css";

export const ORIGIN_POINT = "origin";
export const DESTINATION_POINT = "destination";

type TimelineState = "completed" | "current" | "upcoming";

export default function RouteSchematic({ execution, selectedPoint, onSelect }: {
  execution: DriverExecution; selectedPoint: string; onSelect: (id: string) => void;
}) {
  const leg = currentExecutionLeg(execution);
  if (!leg) return null;
  const checkpoints = orderedCheckpoints(execution);
  const points = [
    { id: ORIGIN_POINT, kind: "Origin", name: leg.origin, address: leg.originAddress, reachedAt: execution.startedAt },
    ...checkpoints.map((checkpoint) => ({
      id: checkpoint.id,
      kind: `Checkpoint ${checkpoint.sequenceNo}`,
      name: checkpoint.name,
      address: checkpoint.address,
      reachedAt: checkpointArrival(execution, checkpoint.id)?.arrivedAt ?? null,
    })),
    { id: DESTINATION_POINT, kind: "Destination", name: leg.destination, address: leg.destinationAddress, reachedAt: execution.destinationArrivedAt },
  ];

  function state(point: typeof points[number]): TimelineState {
    if (point.reachedAt) return "completed";
    if (point.id === ORIGIN_POINT && execution.status === "NOT_STARTED") return "current";
    if (execution.permissions.nextCheckpointId === point.id) return "current";
    if (point.id === DESTINATION_POINT && execution.permissions.canArriveAtDestination) return "current";
    return "upcoming";
  }

  return <section className={styles.routeTimeline} aria-label="ROAD route timeline">
    <div className={styles.timelineHeading}>
      <div><span className={styles.eyebrow}>SELECTED ROAD LEG</span><h2>{leg.origin} <span aria-hidden="true">→</span> {leg.destination}</h2></div>
      <p>Progress is based on saved Driver arrivals.</p>
    </div>
    <div className={styles.timelineScroll}>
      <ol className={styles.timelinePoints}>{points.map((point) => {
        const pointState = state(point);
        return <li className={styles[`${pointState}TimelinePoint`]} key={point.id}>
          <button type="button" className={`${styles.timelinePoint} ${selectedPoint === point.id ? styles.selectedTimelinePoint : ""}`} aria-pressed={selectedPoint === point.id} onClick={() => onSelect(point.id)}>
            <span className={styles.timelineDot} aria-hidden="true">{pointState === "completed" ? <ExecutionIcon name="check" /> : null}</span>
            <span className={styles.timelineContent}>
              <small>{point.kind}</small>
              <strong>{point.name}</strong>
              <span>{point.address?.trim() || "Address not provided"}</span>
              <em>{pointState === "completed" ? `${point.id === ORIGIN_POINT ? "Started" : "Arrived"} ${timeLabel(point.reachedAt)}` : pointState === "current" ? "Current stop" : "Upcoming"}</em>
            </span>
          </button>
        </li>;
      })}</ol>
    </div>
  </section>;
}
