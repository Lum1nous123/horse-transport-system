export type CustomerOrderFilterRecord = {
  orderCode: string;
  originAddress?: string | null;
  originCountry?: string | null;
  destinationAddress?: string | null;
  destinationCountry?: string | null;
  transportMode?: string | null;
  recipientName?: string | null;
  status: string;
};

export function filterCustomerOrders<T extends CustomerOrderFilterRecord>(
  orders: T[],
  query: string,
  status: string,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return orders.filter((order) => {
    if (status && order.status !== status) return false;
    if (!normalizedQuery) return true;

    return [
      order.orderCode,
      order.originAddress,
      order.originCountry,
      order.destinationAddress,
      order.destinationCountry,
      order.transportMode,
      order.recipientName,
      order.status.replaceAll("_", " "),
    ].some((value) => value?.toLocaleLowerCase().includes(normalizedQuery));
  });
}
