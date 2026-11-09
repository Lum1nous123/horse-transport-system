"use client";

import { queueDate, workGroups, type DepartureSort, type QueueRecord, type WorkGroup, type WorkMode } from "@/lib/execution-queue";
import "./work-queue.css";

export function WorkQueueDate({ value }: { value?: string | null }) {
  const formatted = queueDate(value);
  return formatted ? <span className="work-queue-date">{formatted.date}<small>{formatted.time}</small></span> : <span>Not provided</span>;
}

export default function WorkQueueControls({ rows, known, group, onGroup, query, onQuery, sort, onSort, mode, onMode, disabled = false }: {
  rows: QueueRecord[]; known: boolean; group: WorkGroup; onGroup: (group: WorkGroup) => void;
  query: string; onQuery: (query: string) => void; sort: DepartureSort; onSort: (sort: DepartureSort) => void;
  mode?: WorkMode; onMode?: (mode: WorkMode) => void; disabled?: boolean;
}) {
  return <section className="work-queue-controls" aria-label="Assigned work filters">
    <div className="work-queue-groups" role="group" aria-label="Execution groups">
      {workGroups.filter((item) => item.value !== "completed" || group === "completed" || rows.some((row) => row.group === "completed")).map((item) =>
        <button key={item.value} type="button" disabled={disabled} aria-pressed={group === item.value} onClick={() => onGroup(item.value)}>
          {item.label}<span>{known ? rows.filter((row) => item.value === "all" || row.group === item.value).length : "—"}</span>
        </button>)}
    </div>
    <fieldset disabled={disabled} className="work-queue-toolbar">
      <legend className="sr-only">Search and sort assigned work</legend>
      <label className="work-queue-search">Search assignments<input type="search" autoComplete="off" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Order, vehicle or route" /></label>
      {onMode && <label>Transport mode<select value={mode} onChange={(event) => onMode(event.target.value as WorkMode)}><option value="ALL">All modes</option><option value="ROAD">ROAD</option><option value="AIR">AIR</option></select></label>}
      <label>Sort by departure<select value={sort} onChange={(event) => onSort(event.target.value as DepartureSort)}><option value="earliest">Departure earliest</option><option value="latest">Departure latest</option></select></label>
    </fieldset>
  </section>;
}
