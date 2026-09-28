"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { registerCustomer } from "@/lib/auth";

type FieldName = "fullName" | "email" | "phone" | "password";
type FieldErrors = Partial<Record<FieldName, string>>;

export default function RegisterForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [isCreated, setIsCreated] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError("");

    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get("fullName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const phoneValue = String(formData.get("phone") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const nextErrors: FieldErrors = {};

    if (!fullName) {
      nextErrors.fullName = "Enter your full name.";
    } else if (fullName.length > 120) {
      nextErrors.fullName = "Your full name must be 120 characters or fewer.";
    }

    if (!email) {
      nextErrors.email = "Enter your email address.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Enter a valid email address.";
    } else if (email.length > 150) {
      nextErrors.email = "Your email address must be 150 characters or fewer.";
    }

    if (phoneValue.length > 30) {
      nextErrors.phone = "Your phone number must be 30 characters or fewer.";
    }

    if (!password) {
      nextErrors.password = "Enter a password.";
    } else if (password.length < 8 || password.length > 72) {
      nextErrors.password = "Use a password between 8 and 72 characters.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await registerCustomer({
        fullName,
        email,
        phone: phoneValue || null,
        password,
      });
      setIsCreated(true);
    } catch (error) {
      handleRegisterError(error, setFieldErrors, setFormError);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isCreated) {
    return (
      <div className="auth-success" role="status" aria-live="polite">
        <span className="auth-success-mark" aria-hidden="true">✓</span>
        <p>Your account has been created. Sign in below to continue.</p>
      </div>
    );
  }

  function clearFieldError(field: FieldName) {
    if (fieldErrors[field]) {
      setFieldErrors((current) => ({ ...current, [field]: undefined }));
    }
    if (formError) setFormError("");
  }

  return (
    <form className="auth-form auth-register-form" onSubmit={handleSubmit} noValidate>
      <div className="auth-field">
        <label htmlFor="fullName">Full name</label>
        <input
          autoComplete="name"
          id="fullName"
          name="fullName"
          type="text"
          maxLength={120}
          required
          aria-invalid={Boolean(fieldErrors.fullName)}
          aria-describedby={fieldErrors.fullName ? "fullName-error" : undefined}
          onChange={() => clearFieldError("fullName")}
        />
        {fieldErrors.fullName && <p className="auth-field-error" id="fullName-error">{fieldErrors.fullName}</p>}
      </div>

      <div className="auth-field">
        <label htmlFor="email">Email</label>
        <input
          autoComplete="email"
          autoCapitalize="none"
          id="email"
          name="email"
          type="email"
          inputMode="email"
          maxLength={150}
          required
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
          onChange={() => clearFieldError("email")}
        />
        {fieldErrors.email && <p className="auth-field-error" id="email-error">{fieldErrors.email}</p>}
      </div>

      <div className="auth-field">
        <label htmlFor="phone">Phone <span>(Optional)</span></label>
        <input
          autoComplete="tel"
          id="phone"
          name="phone"
          type="tel"
          maxLength={30}
          aria-invalid={Boolean(fieldErrors.phone)}
          aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
          onChange={() => clearFieldError("phone")}
        />
        {fieldErrors.phone && <p className="auth-field-error" id="phone-error">{fieldErrors.phone}</p>}
      </div>

      <div className="auth-field">
        <label htmlFor="password">Password</label>
        <div className="auth-password-control">
          <input
            autoComplete="new-password"
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            minLength={8}
            maxLength={72}
            required
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? "password-error" : undefined}
            onChange={() => clearFieldError("password")}
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
        {fieldErrors.password && <p className="auth-field-error" id="password-error">{fieldErrors.password}</p>}
      </div>

      {formError && <p className="auth-error" role="alert" aria-live="assertive">{formError}</p>}

      <button className="button button-primary auth-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating account…" : "Create account"}
        {!isSubmitting && <span aria-hidden="true">→</span>}
      </button>
    </form>
  );
}

function handleRegisterError(
  error: unknown,
  setFieldErrors: (errors: FieldErrors | ((current: FieldErrors) => FieldErrors)) => void,
  setFormError: (message: string) => void,
) {
  if (!(error instanceof Error)) {
    setFormError("We couldn't create your account. Please try again.");
    return;
  }

  if (error.message === "NETWORK_ERROR") {
    setFormError("We couldn't reach the account service. Check your connection and try again.");
    return;
  }

  if (error.message === "DUPLICATE_EMAIL") {
    setFieldErrors((current) => ({
      ...current,
      email: "An account with this email already exists. Sign in or use another email address.",
    }));
    return;
  }

  if (error.message.startsWith("VALIDATION_ERROR")) {
    const detail = error.message.slice("VALIDATION_ERROR".length).toLowerCase();
    if (detail.includes("fullname")) {
      setFieldErrors((current) => ({ ...current, fullName: "Check your full name and try again." }));
    } else if (detail.includes("email")) {
      setFieldErrors((current) => ({ ...current, email: "Check your email address and try again." }));
    } else if (detail.includes("phone")) {
      setFieldErrors((current) => ({ ...current, phone: "Check your phone number and try again." }));
    } else if (detail.includes("password")) {
      setFieldErrors((current) => ({ ...current, password: "Use a password between 8 and 72 characters." }));
    } else {
      setFormError("Review your details and try again.");
    }
    return;
  }

  setFormError("We couldn't create your account. Please try again.");
}
