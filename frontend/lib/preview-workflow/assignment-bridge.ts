export const PREVIEW_ASSIGNMENTS_STORAGE_KEY = "horse-transport-staff-assignments-v1";
export const PREVIEW_TS_WORKSPACE_STORAGE_KEY = "horse-transport-ts-workspace-v1";
export const DEFAULT_PREVIEW_SPECIALIST_ID = "ts-alex-carter";

const specialistNames: Record<string, string> = {
  "ts-alex-carter": "Alex Carter",
  "ts-brooke-mitchell": "Brooke Mitchell",
  "ts-daniel-kim": "Daniel Kim",
  "ts-emily-ross": "Emily Ross",
};

export type PreviewAssignmentRecipient = {
  transportSpecialistId: string;
  transportSpecialistName: string;
  fleetRouteCoordinatorName: string;
  assignedAt: string;
};

const seededRecipients: Record<string, PreviewAssignmentRecipient> = {
  "order-2037": {
    transportSpecialistId: "ts-alex-carter",
    transportSpecialistName: "Alex Carter",
    fleetRouteCoordinatorName: "Avery Wilson",
    assignedAt: "2026-10-02T11:45:00+07:00",
  },
  "order-2046": {
    transportSpecialistId: "ts-brooke-mitchell",
    transportSpecialistName: "Brooke Mitchell",
    fleetRouteCoordinatorName: "Jordan Ellis",
    assignedAt: "2026-10-04T10:15:00+07:00",
  },
};

type StoredPair = {
  transportSpecialist?: { id?: string; fullName?: string };
  fleetRouteCoordinator?: { fullName?: string };
  assignedAt?: string;
};

export function readPreviewAssignmentRecipients(): Record<string, PreviewAssignmentRecipient> {
  const recipients = { ...seededRecipients };
  const raw = window.sessionStorage.getItem(PREVIEW_ASSIGNMENTS_STORAGE_KEY);
  if (!raw) return recipients;

  const stored = JSON.parse(raw) as Record<string, StoredPair>;
  for (const [orderId, pair] of Object.entries(stored)) {
    const specialistId = pair.transportSpecialist?.id;
    if (!specialistId) continue;
    recipients[orderId] = {
      transportSpecialistId: specialistId,
      transportSpecialistName: pair.transportSpecialist?.fullName ?? specialistNames[specialistId] ?? "Transport Specialist",
      fleetRouteCoordinatorName: pair.fleetRouteCoordinator?.fullName ?? "Fleet & Route Coordinator",
      assignedAt: pair.assignedAt ?? new Date().toISOString(),
    };
  }
  return recipients;
}

export function getPreviewSpecialistIdentity(search: string) {
  const requestedId = new URLSearchParams(search).get("specialistId") ?? DEFAULT_PREVIEW_SPECIALIST_ID;
  return {
    id: specialistNames[requestedId] ? requestedId : DEFAULT_PREVIEW_SPECIALIST_ID,
    name: specialistNames[requestedId] ?? specialistNames[DEFAULT_PREVIEW_SPECIALIST_ID],
  };
}

export function resetPreviewWorkflow() {
  window.sessionStorage.removeItem(PREVIEW_ASSIGNMENTS_STORAGE_KEY);
  window.sessionStorage.removeItem(PREVIEW_TS_WORKSPACE_STORAGE_KEY);
}
