"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { clearAccessToken, getCurrentUser, signIn } from "@/lib/auth";

type FieldErrors = {
  email?: string;
  password?: string;
};

export default function LoginForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const nextErrors: FieldErrors = {};

    if (!email) {
      nextErrors.email = "Enter your email address.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!password) {
      nextErrors.password = "Enter your password.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await signIn(email, password);
      const currentUser = await getCurrentUser();
      if (currentUser.role === "LOGISTICS_MANAGER") {
        router.replace("/logistics");
      } else if (currentUser.role === "TRANSPORT_SPECIALIST") {
        router.replace("/transport-specialist/review");
      } else if (currentUser.role === "CUSTOMER") {
        router.replace("/customer");
      } else {
        clearAccessToken();
        setFormError("This account role does not have a workspace available yet.");
      }
    } catch (error) {
      setFormError(getSignInErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <div className="auth-field">
        <label htmlFor="email">Email</label>
        <input
          autoComplete="email"
          autoCapitalize="none"
          id="email"
          name="email"
          type="email"
          inputMode="email"
          required
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
          onChange={() => {
            if (fieldErrors.email) {
              setFieldErrors((current) => ({ ...current, email: undefined }));
            }
            if (formError) setFormError("");
          }}
        />
        {fieldErrors.email && (
          <p className="auth-field-error" id="email-error">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div className="auth-field">
        <label htmlFor="password">Password</label>
        <div className="auth-password-control">
          <input
            autoComplete="current-password"
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? "password-error" : undefined}
            onChange={() => {
              if (fieldErrors.password) {
                setFieldErrors((current) => ({ ...current, password: undefined }));
              }
              if (formError) setFormError("");
            }}
          />
          <button
            className="auth-password-toggle"
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((visible) => !visible)}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        {fieldErrors.password && (
          <p className="auth-field-error" id="password-error">
            {fieldErrors.password}
          </p>
        )}
      </div>

      {formError && (
        <p className="auth-error" role="alert" aria-live="assertive">
          {formError}
        </p>
      )}

      <button className="button button-primary auth-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in…" : "Sign in"}
        {!isSubmitting && <span aria-hidden="true">→</span>}
      </button>
    </form>
  );
}

function getSignInErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "We couldn't sign you in. Please try again.";
  }

  if (error.message === "INVALID_CREDENTIALS") {
    return "Email or password is incorrect.";
  }

  if (error.message === "VALIDATION_ERROR") {
    return "Enter a valid email address and password.";
  }

  if (error.message === "NETWORK_ERROR") {
    return "We couldn't reach the sign-in service. Check your connection and try again.";
  }

  if (error.message === "PROFILE_UNAVAILABLE") {
    return "We couldn't load your account. Please try signing in again.";
  }

  if (error.message === "SESSION_EXPIRED") {
    return "Your session expired. Please sign in again.";
  }

  return "We couldn't sign you in. Please try again.";
}
