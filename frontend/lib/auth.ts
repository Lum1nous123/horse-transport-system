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
    // The response contains a Bearer JWT. Token/session handling is not part of this task.
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
