const DEFAULT_API_BASE_URL = "http://localhost:8080";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${API_BASE_URL}${normalizedPath}`;
}

export function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(apiUrl(path), init);
}

export type DocumentDeadlineResponse = {
  orderId: string;
  documentCompletionDeadlineAt: string;
  documentDeadlineSetAt: string;
};

export function setDocumentDeadline(
  orderId: string,
  documentCompletionDeadlineAt: string,
  accessToken: string,
): Promise<Response> {
  return apiFetch(`/api/v1/orders/${orderId}/documents/deadline`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ documentCompletionDeadlineAt }),
  });
}
