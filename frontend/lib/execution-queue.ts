export type WorkGroup = "all" | "upcoming" | "processing" | "completed";
export type DepartureSort = "earliest" | "latest";
export type WorkMode = "ALL" | "ROAD" | "AIR";
export type QueueRecord = {
  key: string; orderCode: string; sequenceNo: number; origin: string; destination: string;
  vehicle: string; mode: "ROAD" | "AIR"; departure?: string | null; group: Exclude<WorkGroup, "all"> | null;
};

export const workGroups = [
  { value: "all", label: "All assigned" },
  { value: "upcoming", label: "Not started" },
  { value: "processing", label: "In progress" },
  { value: "completed", label: "Completed execution" },
] as const;

export function selectQueueRows<T extends QueueRecord>(rows: T[], group: WorkGroup, query: string, sort: DepartureSort): T[] {
  const search = query.trim().toLocaleLowerCase();
  return rows.filter((row) => (group === "all" || row.group === group)
    && (!search || [row.orderCode, row.vehicle, row.origin, row.destination].some((value) => value.toLocaleLowerCase().includes(search))))
    .sort((a, b) => {
      const left = a.departure ? Date.parse(a.departure) : NaN;
      const right = b.departure ? Date.parse(b.departure) : NaN;
      if (Number.isFinite(left) !== Number.isFinite(right)) return Number.isFinite(left) ? -1 : 1;
      const delta = Number.isFinite(left) && Number.isFinite(right) ? (sort === "latest" ? right - left : left - right) : 0;
      return delta || a.orderCode.localeCompare(b.orderCode) || a.sequenceNo - b.sequenceNo || a.key.localeCompare(b.key);
    });
}

export function queueDate(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return {
    date: new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    time: new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  };
}
