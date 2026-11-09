"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EscortWorkspaceFrame from "@/components/EscortWorkspaceFrame";
import WorkQueueControls, { WorkQueueDate } from "@/components/execution/WorkQueueControls";
import { selectQueueRows, type DepartureSort, type WorkGroup, type WorkMode } from "@/lib/execution-queue";
import { airQueueRow, roadQueueRow } from "@/lib/escort-execution/queue";
import { EscortExecutionError, getEscortExecutionService, type AssignedAirExecutionSummary, type AssignedRoadExecutionSummary } from "@/lib/escort-execution/service";
import { useEscortAccess } from "@/lib/escort-execution/use-escort-access";
import "./queue.css";

type QueueError = { message: string; code: string };
function queueError(caught: unknown, fallback: string): QueueError {
  return { message: caught instanceof Error ? caught.message : fallback,
    code: caught instanceof EscortExecutionError ? caught.code : "REQUEST_FAILED" };
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
  const [mode, setMode] = useState<WorkMode>("ALL");
  const [group, setGroup] = useState<WorkGroup>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<DepartureSort>("earliest");
  const roadRequest = useRef(0);
  const airRequest = useRef(0);

  const loadRoadQueue = useCallback(async () => {
    const request = ++roadRequest.current;
    setRoadLoading(true); setRoadError(null); setRoadExecutions([]);
    try {
      const queue = await service.listAssignedRoadWork();
      if (request === roadRequest.current) setRoadExecutions(queue.executions);
    } catch (caught) {
      if (request === roadRequest.current) setRoadError(queueError(caught, "We couldn't load your assigned ROAD work."));
    } finally { if (request === roadRequest.current) setRoadLoading(false); }
  }, [service]);
  const loadAirQueue = useCallback(async () => {
    const request = ++airRequest.current;
    setAirLoading(true); setAirError(null); setAirExecutions([]);
    try {
      const queue = await service.listAssignedAirWork();
      if (request === airRequest.current) setAirExecutions(queue.executions);
    } catch (caught) {
      if (request === airRequest.current) setAirError(queueError(caught, "We couldn't load your assigned AIR work."));
    } finally { if (request === airRequest.current) setAirLoading(false); }
  }, [service]);
  const loadAll = useCallback(async () => { await Promise.allSettled([loadRoadQueue(), loadAirQueue()]); }, [loadAirQueue, loadRoadQueue]);
  const invalidateRequests = useCallback(() => { roadRequest.current++; airRequest.current++; }, []);
  useEffect(() => {
    if (accessState !== "allowed") return;
    const timer = window.setTimeout(() => { void loadAll(); }, 0);
    return () => { window.clearTimeout(timer); invalidateRequests(); };
  }, [accessState, loadAll, invalidateRequests]);

  const rows = useMemo(() => [
    ...(!roadLoading && !roadError ? roadExecutions.map(roadQueueRow) : []),
    ...(!airLoading && !airError ? airExecutions.map(airQueueRow) : []),
  ], [roadLoading, roadError, roadExecutions, airLoading, airError, airExecutions]);
  const modeRows = useMemo(() => rows.filter((row) => mode === "ALL" || row.mode === mode), [rows, mode]);
  const visible = useMemo(() => selectQueueRows(modeRows, group, query, sort), [modeRows, group, query, sort]);
  const known = (mode === "AIR" || (!roadLoading && !roadError)) && (mode === "ROAD" || (!airLoading && !airError));
  const refreshing = roadLoading || airLoading;
  const clearFilters = () => { setGroup("all"); setQuery(""); setMode("ALL"); };

  if (accessState === "checking") return <main className="customer-page assignment-access-state"><p role="status">Checking Escort access...</p></main>;
  if (accessState === "forbidden" || accessState === "failed") return <main className="customer-page assignment-access-state">
    <section className="assignment-access-card" role="alert"><p className="customer-eyebrow">WORKSPACE UNAVAILABLE</p>
      <h1>{accessState === "forbidden" ? "Access denied" : "We couldn't verify access"}</h1><p>{accessMessage}</p>
      <div>{accessState === "failed" && <button className="customer-primary-button" type="button" onClick={retryAccess}>Try again</button>}
        <Link className="customer-secondary-button" href="/login">Return to sign in</Link></div>
    </section></main>;

  const previewSuffix = preview ? `?preview=1&escortId=${encodeURIComponent(previewEscortId)}` : "";
  return <EscortWorkspaceFrame preview={preview} previewEscortId={previewEscortId} previewEscortName={previewEscortName}>
    <div className="escort-assigned-queue">
      <header className="escort-page-heading"><div><span>Journey execution</span><h1>Assigned journey work</h1>
        <p>Your assigned ROAD/AIR executions and the next available step.</p></div>
        <button className="customer-secondary-button" type="button" disabled={refreshing} onClick={() => void loadAll()}>{refreshing ? "Refreshing..." : "Refresh saved state"}</button>
      </header>
      <WorkQueueControls rows={modeRows} known={Boolean(known)} group={group} onGroup={setGroup} query={query} onQuery={setQuery} sort={sort} onSort={setSort} mode={mode} onMode={setMode} />
      {roadError && <div className="customer-alert" role="alert"><span><strong>ROAD unavailable.</strong> {roadError.message}</span>{roadError.code === "REQUEST_FAILED" && <button type="button" disabled={roadLoading} onClick={() => void loadRoadQueue()}>Try ROAD again</button>}</div>}
      {airError && <div className="customer-alert" role="alert"><span><strong>AIR unavailable.</strong> {airError.message}</span>{airError.code === "REQUEST_FAILED" && <button type="button" disabled={airLoading} onClick={() => void loadAirQueue()}>Try AIR again</button>}</div>}
      {!known && <p className="escort-queue-notice" role="status">Assignments are incomplete while a source is loading or unavailable. Counts are not yet confirmed.</p>}
      {roadLoading && <p className="escort-queue-loading" role="status" aria-label="Loading assigned ROAD work">Loading assigned ROAD work…</p>}
      {airLoading && <p className="escort-queue-loading" role="status" aria-label="Loading assigned AIR work">Loading assigned AIR work…</p>}
      {known && visible.length === 0 ? <section className="escort-queue-empty">
        <span className="escort-empty-route" aria-hidden="true" />
        <div className="escort-empty-copy"><h2>{modeRows.length === 0 ? "No assigned work in this view" : "No matching assignments"}</h2>
        <p>{modeRows.length === 0 ? "Only assignments returned by the service are shown. Try another mode." : "Try another execution group, mode or search."}</p>
        <button className="customer-secondary-button" type="button" onClick={clearFilters}>Clear filters</button></div>
      </section> : visible.length > 0 && <div className="escort-queue-table-wrap"><table className="escort-queue-table">
        <caption className="sr-only">Assigned ROAD and AIR executions</caption>
        <thead><tr><th scope="col">Assignment</th><th scope="col">Route</th><th scope="col">Vehicle / Scope</th><th scope="col">Departure</th><th scope="col">Execution</th><th scope="col">Next step</th></tr></thead>
        <tbody>{visible.map((row) => <tr key={row.key}>
          <td data-label="Assignment"><strong>{row.orderCode}</strong><small>{row.mode} · Leg {row.sequenceNo}</small></td>
          <td data-label="Route" className="escort-queue-route">{row.origin} <span aria-hidden="true">→</span> {row.destination}</td>
          <td data-label="Vehicle / Scope">{row.vehicle}</td>
          <td data-label="Departure"><WorkQueueDate value={row.departure} /></td>
          <td data-label="Execution"><span className={`escort-queue-status${row.group === null ? " needs-check" : ""}`}>{row.label}</span>
            {row.handover && <small>Handovers {row.handover.completed}/{row.handover.required}</small>}
          </td>
          <td data-label="Next step"><Link className={`escort-queue-link${row.attention ? " needs-attention" : ""}`} href={`/escort/${row.mode === "ROAD" ? "executions" : "air-executions"}/${encodeURIComponent(row.executionId)}${previewSuffix}`}>{row.nextStep}<span className="sr-only"> for {row.orderCode}, {row.mode} leg {row.sequenceNo}, {row.vehicle}</span><span aria-hidden="true"> →</span></Link></td>
        </tr>)}</tbody>
      </table></div>}
      <p className="escort-queue-count" role="status">Showing {visible.length} of {modeRows.length} loaded {mode === "ALL" ? "ROAD/AIR" : mode} assignments{!known ? " · Partial data" : ""}</p>
      {rows.some((row) => row.label === "Completed execution") && <p className="escort-queue-notice">Completed execution is not the same as Order delivery. This queue is not a full assignment history.</p>}
    </div>
  </EscortWorkspaceFrame>;
}
