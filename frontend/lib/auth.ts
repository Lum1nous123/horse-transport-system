import { apiFetch } from "./api";

type ApiError = {
  code?: string;
  message?: string;
  timestamp?: string;
};

export async function signIn(email: string, password: string): Promise<void> {
  let response: Response;
  try {
    response = await apiFetch("/api/v1/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error("NETWORK_ERROR");
  }

  if (response.ok) {
    const result = (await response.json()) as { accessToken?: string };
    if (!result.accessToken) throw new Error("SIGN_IN_FAILED");
    sessionStorage.setItem("horse-transport-token", result.accessToken);
    return;
  }

  let apiError: ApiError = {};
  try {
    apiError = (await response.json()) as ApiError;
  } catch {
    // Use a generic UI error if the response body is not JSON.
  }

  if (response.status === 401 || apiError.code === "INVALID_CREDENTIALS") {
    throw new Error("INVALID_CREDENTIALS");
  }

  if (response.status === 400 || apiError.code === "VALIDATION_ERROR") {
    throw new Error("VALIDATION_ERROR");
  }

  throw new Error("SIGN_IN_FAILED");
}

export function getAccessToken(): string | null {
  return typeof window === "undefined"
    ? null
    : window.sessionStorage.getItem("horse-transport-token");
}

export function clearAccessToken(): void {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem("horse-transport-token");
  }
}

type RegisterCustomerRequest = {
  fullName: string;
  email: string;
  phone: string | null;
  password: string;
};

export async function registerCustomer(request: RegisterCustomerRequest): Promise<void> {
  let response: Response;
  try {
    response = await apiFetch("/api/v1/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request),
    });
  } catch {
    throw new Error("NETWORK_ERROR");
  }

  if (response.ok) {
    // Registration returns the created Customer profile, not a login JWT.
    return;
  }

  let apiError: ApiError = {};
  try {
    apiError = (await response.json()) as ApiError;
  } catch {
    // Keep the form message useful if an error response has no JSON body.
  }

  if (response.status === 409 || apiError.code === "DUPLICATE_EMAIL") {
    throw new Error("DUPLICATE_EMAIL");
  }

  if (response.status === 400 || apiError.code === "VALIDATION_ERROR") {
    const detail = apiError.message ? `:${apiError.message}` : "";
    throw new Error(`VALIDATION_ERROR${detail}`);
  }

  throw new Error("REGISTER_FAILED");
}
