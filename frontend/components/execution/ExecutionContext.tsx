import { checkpointArrival, currentExecutionLeg, orderedCheckpoints } from "@/lib/driver-execution/actions";
import type { DriverExecution } from "@/lib/driver-execution/types";
import ExecutionIcon from "./ExecutionIcon";
import styles from "./execution.module.css";

export function readableStatus(status: string) {
  return status.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

export function timeLabel(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Time unavailable";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));
}

export function LegSequence({ execution }: { execution: DriverExecution }) {
  const legs = execution.legs.toSorted((a, b) => a.sequenceNo - b.sequenceNo);
  return <ol className={styles.legSequence} aria-label="Route leg sequence">{legs.map((leg) => {
    const current = leg.id === execution.currentLegId;
    const done = leg.status === "COMPLETED";
    return <li key={leg.id} className={`${current ? styles.currentLeg : ""} ${done ? styles.doneLeg : ""}`} aria-current={current ? "step" : undefined}>
      <span className={styles.legDot}>{done ? <ExecutionIcon name="check" /> : current ? leg.sequenceNo : <ExecutionIcon name="lock" />}</span>
      <strong>{leg.sequenceNo} {leg.type}</strong><small>{current ? readableStatus(leg.status) : done ? "Completed" : "Locked"}</small>
    </li>;
  })}</ol>;
}

export function VehicleSummary({ execution }: { execution: DriverExecution }) {
  const leg = currentExecutionLeg(execution);
  return <section className={styles.vehicleSummary} aria-label="Your vehicle and saved statuses">
    <div className={styles.vehicleIdentity}><ExecutionIcon name="truck" /><div><small>Your vehicle</small><strong>{execution.vehicle.plateNumber}</strong><span>{execution.vehicle.horseCount} {execution.vehicle.horseCount === 1 ? "horse" : "horses"}</span></div></div>
    <dl className={styles.savedStatuses}>
      <div><dt>Order</dt><dd>{readableStatus(execution.order.status)}</dd></div>
      <div><dt>Route leg</dt><dd>{leg ? readableStatus(leg.status) : "Unavailable"}</dd></div>
      <div><dt>Your vehicle</dt><dd>{readableStatus(execution.status)}</dd></div>
    </dl>
  </section>;
}

export function CheckpointPlan({ execution }: { execution: DriverExecution }) {
  const leg = currentExecutionLeg(execution);
  if (!leg) return null;
  return <section className={styles.plan} aria-labelledby="checkpoint-plan-title">
    <h3 id="checkpoint-plan-title">Shared checkpoint plan</h3><p>Arrival times are recorded for your vehicle.</p>
    <ol className={styles.planList}>
      <li><span className={styles.endpointDot} /><div><strong>{leg.origin}</strong><small>Origin{execution.startedAt ? ` · Started ${timeLabel(execution.startedAt)}` : ""}</small></div></li>
      {orderedCheckpoints(execution).map((checkpoint) => {
        const arrival = checkpointArrival(execution, checkpoint.id);
        return <li key={checkpoint.id}><span className={arrival ? styles.arrivedDot : styles.pendingDot}>{arrival && <ExecutionIcon name="check" />}</span><div><span>{checkpoint.sequenceNo}. {checkpoint.name}</span><small>{arrival ? `Arrived ${timeLabel(arrival.arrivedAt)}` : "Upcoming"}</small></div></li>;
      })}
      <li><span className={styles.endpointDot} /><div><strong>{leg.destination}</strong><small>Destination{execution.destinationArrivedAt ? ` · Arrived ${timeLabel(execution.destinationArrivedAt)}` : ""}</small></div></li>
    </ol>
    {orderedCheckpoints(execution).length === 0 && <p className={styles.noStops}>No intermediate checkpoints. After Start, your next arrival is the destination.</p>}
  </section>;
}
