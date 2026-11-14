export type SearchableLogisticsInboxOrder = {
  orderCode: string;
  status: string;
  originAddress: string | null;
  originCountry: string | null;
  destinationAddress: string | null;
  destinationCountry: string | null;
  transportMode: string | null;
};

import { compareRequestedDeliveryDates } from "./requested-delivery-date";

export type InboxSort = "received-oldest" | "received-newest" | "delivery-earliest";
export type InboxMode = "ALL" | "ROAD" | "AIR" | "COMBINED";

export function selectLogisticsInboxOrders<T extends SearchableLogisticsInboxOrder & {
  id?: string; createdAt?: string | null; requestedDeliveryDate?: string | null;
}>(orders: T[], query: string, mode: InboxMode, sort: InboxSort): T[] {
  const timestamp = (value: string | null | undefined) => value ? Date.parse(value) : NaN;
  return filterLogisticsInboxOrders(orders, query)
    .filter((order) => mode === "ALL" || order.transportMode === mode)
    .sort((a, b) => {
      if (sort === "delivery-earliest") {
        return compareRequestedDeliveryDates(a.requestedDeliveryDate, b.requestedDeliveryDate,
          a.id ?? a.orderCode, b.id ?? b.orderCode);
      }
      const left = timestamp(a.createdAt);
      const right = timestamp(b.createdAt);
      if (!Number.isFinite(left) || !Number.isFinite(right)) {
        if (Number.isFinite(left)) return -1;
        if (Number.isFinite(right)) return 1;
        return (a.id ?? a.orderCode).localeCompare(b.id ?? b.orderCode);
      }
      return (sort === "received-newest" ? right - left : left - right)
        || (a.id ?? a.orderCode).localeCompare(b.id ?? b.orderCode);
    });
}

export function filterLogisticsInboxOrders<T extends SearchableLogisticsInboxOrder>(
  orders: T[],
  query: string,
): T[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return orders;

  return orders.filter((order) => [
    order.orderCode,
    order.status,
    order.originAddress,
    order.originCountry,
    order.destinationAddress,
    order.destinationCountry,
    order.transportMode,
  ].some((value) => value?.toLocaleLowerCase().includes(normalizedQuery)));
}
