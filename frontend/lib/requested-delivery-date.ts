const deliveryDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function formatRequestedDeliveryDate(value: string | null | undefined): string {
  return value && deliveryDatePattern.test(value) ? value : "Not provided";
}

export function compareRequestedDeliveryDates(
  leftDate: string | null | undefined,
  rightDate: string | null | undefined,
  leftId: string,
  rightId: string,
  descending = false,
): number {
  const left = leftDate && deliveryDatePattern.test(leftDate) ? leftDate : null;
  const right = rightDate && deliveryDatePattern.test(rightDate) ? rightDate : null;
  if (left === null || right === null) return left === right ? leftId.localeCompare(rightId) : left === null ? 1 : -1;
  return (descending ? right.localeCompare(left) : left.localeCompare(right))
    || leftId.localeCompare(rightId);
}

export function localTodayDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isUpcomingRequestedDeliveryDate(value: string | null | undefined, today: string): boolean {
  return Boolean(value && deliveryDatePattern.test(value) && value >= today);
}
