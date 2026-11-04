export type SearchableLogisticsInboxOrder = {
  orderCode: string;
  status: string;
  originAddress: string | null;
  originCountry: string | null;
  destinationAddress: string | null;
  destinationCountry: string | null;
  transportMode: string | null;
};

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
