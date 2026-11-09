"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { driverQueueRow } from "@/lib/driver-execution/queue";
import { selectQueueRows, type DepartureSort, type WorkGroup } from "@/lib/execution-queue";
import type { DriverExecution, DriverSession } from "@/lib/driver-execution/types";
import DriverExecutionDetail from "./DriverExecutionDetail";
import ExecutionIcon from "./ExecutionIcon";
import ExecutionWorkspaceFrame from "./ExecutionWorkspaceFrame";
import WorkQueueControls, { WorkQueueDate } from "./WorkQueueControls";
import styles from "./execution.module.css";

export default function DriverWorkspace({ session, executionId }: { session: DriverSession; executionId?: string }) {
  const router = useRouter();
  const [work, setWork] = useState<DriverExecution[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!executionId);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [group, setGroup] = useState<WorkGroup>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<DepartureSort>("earliest");
  const [mobileDetail, setMobileDetail] = useState(false);
  const backRef = useRef<HTMLButtonElement>(null);
  const queueRef = useRef<HTMLElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const rows = useMemo(() => work.map(driverQueueRow), [work]);
  const visible = useMemo(() => selectQueueRows(rows, group, query, sort), [rows, group, query, sort]);
  const clearFilters = () => { setGroup("all"); setQuery(""); };
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
      const first = selectQueueRows(own.map(driverQueueRow), "all", "", "earliest")[0];
      setSelectedId((current) => own.some((item) => item.id === current) ? current : first?.key ?? null);
    } catch (caught) {
      if (!request.signal.aborted) {
        setWork([]);
        setSelectedId(null);
        setMobileDetail(false);
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
  function backToList() {
    setMobileDetail(false);
    requestAnimationFrame(() => (queueRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
      ?? queueRef.current?.querySelector<HTMLButtonElement>("button"))?.focus());
  }
  if (executionId) return <ExecutionWorkspaceFrame session={session} focused>
    <DriverExecutionDetail key={executionId} session={session} executionId={executionId} journey onStarted={openJourney} onBack={() => router.push(`/driver${session.previewQuery}`)} />
  </ExecutionWorkspaceFrame>;

  return <ExecutionWorkspaceFrame session={session}>
    <div className={styles.pageHeading}><div><h1>My ROAD work</h1><p>Your assigned vehicles and current journey steps.</p></div><button className={styles.secondaryButton} disabled={loading || pending} type="button" onClick={() => void load()}><ExecutionIcon name="refresh" />{loading ? "Refreshing…" : "Refresh"}</button></div>
    <WorkQueueControls rows={rows} known={!loading && !error} group={group} onGroup={setGroup} query={query} onQuery={setQuery} sort={sort} onSort={setSort} disabled={pending} />
    {error ? <section className={styles.error} role="alert"><h2>Assigned work unavailable</h2><p>{error}</p><button className={styles.secondaryButton} type="button" disabled={loading} onClick={() => void load()}>Try again</button></section>
      : loading ? <div className={styles.loadingGrid} role="status"><span className={styles.skeleton} /><span className={styles.skeleton} /><p>Loading your assigned ROAD work…</p></div>
      : work.length === 0 ? <section className={styles.empty}><ExecutionIcon name="truck" /><h2>No assigned ROAD work</h2><p>Your vehicle assignments will appear here when they are available.</p></section>
      : <div className={`${styles.workspace} ${styles.filteredWorkspace} ${mobileDetail ? styles.mobileDetailOpen : ""}`}>
        <aside ref={queueRef} className={`${styles.queue} ${styles.filteredQueue}`} aria-label="Assigned ROAD executions">
          <h2>Assigned to you</h2>
          {visible.length === 0 ? <div className={styles.queueEmpty}><h3>No matching assignments</h3><p>Try another execution group or search.</p><button className={styles.secondaryButton} type="button" onClick={clearFilters}>Clear filters</button></div>
            : <ul>{visible.map((row) => <li key={row.key}>
              <button className={`${styles.assignment} ${selectedId === row.key ? styles.selectedAssignment : ""}`} type="button" disabled={pending}
                aria-pressed={selectedId === row.key} onClick={() => { setSelectedId(row.key); setMobileDetail(true); requestAnimationFrame(() => backRef.current?.focus()); }}>
                <span className={styles.assignmentTop}><strong>{row.orderCode}</strong><span className={`${styles.queueBadge} ${row.group === null ? styles.needsCheck : ""}`}>{row.label}</span></span>
                <span className={styles.assignmentVehicle}><ExecutionIcon name="truck" />Vehicle <strong>{row.vehicle}</strong></span>
                <span>{row.origin} → {row.destination}</span>
                <small>ROAD · Leg {row.sequenceNo || "—"} · {row.execution.vehicle.horseCount} {row.execution.vehicle.horseCount === 1 ? "horse" : "horses"}</small>
                <span className={styles.queueDeparture}>Departure <WorkQueueDate value={row.departure} /></span>
                <span className={styles.viewExecution}>View execution →</span>
              </button>
            </li>)}</ul>}
          <p className={styles.queueCount}>Showing {visible.length} of {work.length} loaded assignments</p>
        </aside>
        {selectedId && <div className={styles.queueDetail}>
          <button ref={backRef} className={`${styles.secondaryButton} ${styles.mobileQueueBack}`} type="button" disabled={pending} onClick={backToList}>← Back to assigned work</button>
          {!visible.some((row) => row.key === selectedId) && <div className={styles.notice} role="status">The selected execution is outside your filters. Its detail is kept open. <button type="button" disabled={pending} onClick={clearFilters}>Clear filters</button></div>}
          {rows.find((row) => row.key === selectedId)?.group === null
            ? <section className={styles.error} role="alert"><h2>Check state</h2><p>This assignment has inconsistent execution data. Refresh before taking any action.</p><button className={styles.secondaryButton} type="button" onClick={() => openJourney(work.find((execution) => execution.id === selectedId)!)}>View execution</button></section>
            : <DriverExecutionDetail key={selectedId} session={session} executionId={selectedId} onStarted={openJourney} onPendingChange={setPending} />}
        </div>}
      </div>}
    {!loading && !error && rows.some((row) => row.group === "completed") && <p className={styles.queueScope}>Completed execution describes your Vehicle work, not Order delivery. Only assignments returned by the service are shown; this is not a full history.</p>}
  </ExecutionWorkspaceFrame>;
}
