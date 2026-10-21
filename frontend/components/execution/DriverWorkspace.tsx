"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { currentExecutionLeg, executionStatusLabel, nextDriverAction } from "@/lib/driver-execution/actions";
import type { DriverExecution, DriverSession } from "@/lib/driver-execution/types";
import DriverExecutionDetail from "./DriverExecutionDetail";
import ExecutionIcon from "./ExecutionIcon";
import ExecutionWorkspaceFrame from "./ExecutionWorkspaceFrame";
import styles from "./execution.module.css";

export default function DriverWorkspace({ session, executionId }: { session: DriverSession; executionId?: string }) {
  const router = useRouter();
  const [work, setWork] = useState<DriverExecution[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!executionId);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    requestRef.current?.abort();
    const request = new AbortController();
    requestRef.current = request;
    setLoading(true);
    setError("");
    try {
      const assigned = await session.service.listAssignedWork(request.signal);
      if (request.signal.aborted) return;
      const own = assigned.filter((item) => item.driverId === session.driverId);
      setWork(own);
      setSelectedId((current) => own.some((item) => item.id === current) ? current : own[0]?.id ?? null);
    } catch (caught) {
      if (!request.signal.aborted) {
        // Clear potentially revoked assignments; never leave stale actions up.
        setWork([]);
        setSelectedId(null);
        setError(caught instanceof Error ? caught.message : "Could not load your work. Refresh to try again.");
      }
    } finally { if (!request.signal.aborted) setLoading(false); }
  }, [session]);

  useEffect(() => {
    if (executionId) return;
    let active = true;
    queueMicrotask(() => { if (active) void load(); });
    return () => { active = false; requestRef.current?.abort(); };
  }, [load, executionId]);

  function openJourney(execution: DriverExecution) {
    router.push(`/driver/executions/${encodeURIComponent(execution.id)}${session.previewQuery}`);
  }
  if (executionId) return <ExecutionWorkspaceFrame session={session} focused>
    <DriverExecutionDetail key={executionId} session={session} executionId={executionId} journey onStarted={openJourney} onBack={() => router.push(`/driver${session.previewQuery}`)} />
  </ExecutionWorkspaceFrame>;

  return <ExecutionWorkspaceFrame session={session}>
    <div className={styles.pageHeading}><div><h1>My ROAD work</h1><p>Your assigned vehicles and current journey steps.</p></div><button className={styles.secondaryButton} disabled={loading || pending} type="button" onClick={() => void load()}><ExecutionIcon name="refresh" />{loading ? "Refreshing…" : "Refresh"}</button></div>
    {error ? <section className={styles.error} role="alert"><h2>Assigned work unavailable</h2><p>{error}</p><button className={styles.secondaryButton} type="button" disabled={loading} onClick={() => void load()}>Try again</button></section> : loading ? <div className={styles.loadingGrid} role="status"><span className={styles.skeleton} /><span className={styles.skeleton} /><p>Loading your assigned ROAD work…</p></div> : work.length === 0 ? <section className={styles.empty}><ExecutionIcon name="truck" /><h2>No assigned ROAD work</h2><p>Your vehicle assignments will appear here when they are available.</p></section> : <div className={styles.workspace}>
      <aside className={styles.queue} aria-label="Assigned ROAD executions"><h2>Assigned to you</h2><ul>{work.map((execution) => {
        const leg = currentExecutionLeg(execution);
        const canStart = nextDriverAction(execution, session.driverId)?.type === "START";
        return <li key={execution.id}><button className={`${styles.assignment} ${selectedId === execution.id ? styles.selectedAssignment : ""}`} type="button" disabled={pending} aria-pressed={selectedId === execution.id} onClick={() => setSelectedId(execution.id)}>
          <span className={styles.assignmentTop}><strong>{execution.order.code}</strong><span className={styles.queueBadge}>{canStart ? "Ready to start" : executionStatusLabel(execution)}</span></span>
          <span className={styles.assignmentVehicle}><ExecutionIcon name="truck" />Vehicle <strong>{execution.vehicle.plateNumber}</strong></span>
          <span>{leg?.origin ?? "Origin unavailable"} → {leg?.destination ?? "Destination unavailable"}</span><small>ROAD · Leg {leg?.sequenceNo ?? "—"}</small>
        </button></li>;
      })}</ul></aside>
      {selectedId && <DriverExecutionDetail key={selectedId} session={session} executionId={selectedId} onStarted={openJourney} onPendingChange={setPending} />}
    </div>}
  </ExecutionWorkspaceFrame>;
}
