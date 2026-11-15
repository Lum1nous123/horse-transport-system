// Calendar dates stay YYYY-MM-DD on the wire; never reinterpret legacy departures.
function calendarDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day ? date : null;
}

export function formatDeliveryDate(value: string | null | undefined): string {
  const date = calendarDate(value);
  return date ? new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  }).format(date) : "Not provided";
}

export function compareDeliveryDates(a: string | null | undefined, b: string | null | undefined, descending = false): number {
  const left = calendarDate(a);
  const right = calendarDate(b);
  if (!left || !right) return left ? -1 : right ? 1 : 0;
  return (descending ? -1 : 1) * a!.localeCompare(b!);
}

export function selectUpcomingDesiredDeliveries<T extends { orderId: string; requestedDeliveryDate: string | null }>(orders: T[], now: number): T[] {
  const date = new Date(now);
  const today = `${date.getFullYear().toString().padStart(4, "0")}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
  return orders.filter((order) => calendarDate(order.requestedDeliveryDate) && order.requestedDeliveryDate! >= today)
    .toSorted((a, b) => compareDeliveryDates(a.requestedDeliveryDate, b.requestedDeliveryDate) || a.orderId.localeCompare(b.orderId));
}
