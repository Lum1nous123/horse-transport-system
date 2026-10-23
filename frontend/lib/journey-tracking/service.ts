import { apiFetch } from "@/lib/api";
import type { JourneyNotification, JourneyTracking } from "./types";

export class JourneyReadError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function read<T>(path: string, token: string): Promise<T> {
  let response: Response;
  try {
    response = await apiFetch(path, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  } catch {
    throw new JourneyReadError("We couldn't reach the journey service. Try again.", 0);
  }
  if (response.status === 401) throw new JourneyReadError("Your session has expired.", 401);
  if (response.status === 403) throw new JourneyReadError("You can't view this journey.", 403);
  if (response.status === 404) throw new JourneyReadError("Journey tracking is not available yet for this Order.", 404);
  if (!response.ok) throw new JourneyReadError("We couldn't load journey tracking. Try again.", response.status);
  try { return await response.json() as T; }
  catch { throw new JourneyReadError("Journey tracking data is unavailable.", response.status); }
}

export async function readJourneyTracking(orderId: string, token: string): Promise<JourneyTracking> {
  // BE-27 integration point: map its final read DTO into the FE view model here.
  const data = await read<JourneyTracking>(`/api/v1/orders/${encodeURIComponent(orderId)}/tracking`, token);
  if (!data || !Array.isArray(data.legs)) throw new JourneyReadError("Journey tracking data is unavailable.", 200);
  return data;
}

export async function readJourneyNotifications(orderId: string, token: string): Promise<JourneyNotification[]> {
  const data = await read<JourneyNotification[]>(`/api/v1/orders/${encodeURIComponent(orderId)}/notifications`, token);
  if (!Array.isArray(data)) throw new JourneyReadError("In-app updates are unavailable.", 200);
  return data;
}
