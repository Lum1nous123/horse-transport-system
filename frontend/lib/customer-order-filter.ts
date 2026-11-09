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

export const customerOrderGroups = [
  { id: "active", label: "Active", statuses: ["SUBMITTED", "REJECTED", "QUOTATION_SENT", "APPROVED", "READY_TO_SHIP", "IN_PROGRESS"] },
  { id: "drafts", label: "Drafts", statuses: ["DRAFT"] },
  { id: "history", label: "History", statuses: ["DELIVERED", "CANCELLED"] },
  { id: "all", label: "All", statuses: [] },
] as const;
export type CustomerOrderGroup = typeof customerOrderGroups[number]["id"];

export function customerOrdersInGroup<T extends CustomerOrderFilterRecord>(orders: T[], group: CustomerOrderGroup): T[] {
  const statuses: readonly string[] = customerOrderGroups.find((item) => item.id === group)!.statuses;
  return group === "all" ? orders : orders.filter((order) => statuses.includes(order.status));
}

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
