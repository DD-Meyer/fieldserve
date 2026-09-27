import { useCallback, useState } from "react";

import { flattenErrorMessages, humaniseField } from "./api";

export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_CHARS_RE = /^\+?[\d\s().-]+$/;

export function requiredError(value: string, label: string): string | null {
  return value.trim() ? null : `${label} is required.`;
}

export function emailError(value: string, { required = false } = {}): string | null {
  const v = value.trim();
  if (!v) return required ? "Email is required." : null;
  return EMAIL_RE.test(v) ? null : "Enter a valid email address, e.g. name@example.com.";
}

export function phoneError(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const digits = v.replace(/\D/g, "").length;
  if (!PHONE_CHARS_RE.test(v)) return "Phone can only contain digits, spaces, +, -, ( and ).";
  if (digits < 7 || digits > 15) return "Phone number must have 7 to 15 digits.";
  return null;
}

export function passwordError(value: string): string | null {
  if (!value) return "Password is required.";
  return value.length >= MIN_PASSWORD_LENGTH
    ? null
    : `Password must be at least ${MIN_PASSWORD_LENGTH} characters (${value.length}/${MIN_PASSWORD_LENGTH}).`;
}

export function wholeNumberError(value: string, label: string, min = 1): string | null {
  const v = value.trim();
  if (!v) return `${label} is required.`;
  if (!/^\d+$/.test(v)) return `${label} must be a whole number.`;
  return Number(v) >= min ? null : `${label} must be at least ${min}.`;
}

export function priceError(value: string, { required = true, label = "Price" } = {}): string | null {
  const v = value.trim();
  if (!v) return required ? `${label} is required.` : null;
  if (!/^\d+(\.\d{0,2})?$/.test(v)) return `${label} must be a number with up to 2 decimals, e.g. 45.00.`;
  return null;
}

export type ApiFieldErrors = { fields: Record<string, string>; general: string | null };

/** Splits a DRF 400 body (or Clerk error) into per-field messages and a general message. */
export function apiFieldErrors(error: any, fallback: string): ApiFieldErrors {
  const fields: Record<string, string> = {};
  const general: string[] = [];

  const clerkErrors = Array.isArray(error?.errors) ? error.errors : null;
  if (clerkErrors) {
    for (const e of clerkErrors) {
      const message = e?.longMessage || e?.message;
      if (!message) continue;
      const param = e?.meta?.paramName as string | undefined;
      if (param) fields[param] = message;
      else general.push(message);
    }
  } else {
    const body = error?.body;
    if (body && typeof body === "object" && !Array.isArray(body)) {
      for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
        const text = flattenErrorMessages(value);
        if (!text) continue;
        if (key === "detail" || key === "non_field_errors") general.push(text);
        else fields[key] = text;
      }
    } else if (body != null) {
      const text = flattenErrorMessages(body);
      if (text) general.push(text);
    }
  }

  if (!general.length && !Object.keys(fields).length) {
    general.push(error?.message || fallback);
  }
  return { fields, general: general.length ? general.join("\n") : null };
}

/** Lists server field errors that don't belong to a visible input, so they aren't lost. */
export function unmatchedFieldErrors(fields: Record<string, string>, shown: string[]): string | null {
  const rest = Object.entries(fields)
    .filter(([key]) => !shown.includes(key))
    .map(([key, text]) => `${humaniseField(key)}: ${text}`);
  return rest.length ? rest.join("\n") : null;
}

/**
 * Tracks which fields the user has interacted with so client-side errors show live,
 * and holds server errors until the matching field is edited.
 */
export function useFieldValidation<F extends string>(clientErrors: Record<F, string | null>) {
  const [touched, setTouched] = useState<Partial<Record<F, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  const touch = useCallback((field: F) => {
    setTouched((t) => (t[field] ? t : { ...t, [field]: true }));
  }, []);

  const clearServer = useCallback((field: F) => {
    setServerErrors((s) => {
      if (!(field in s)) return s;
      const next = { ...s };
      delete next[field];
      return next;
    });
  }, []);

  const errorFor = (field: F): string | null =>
    serverErrors[field] ?? (touched[field] || submitted ? clientErrors[field] : null);

  const bind = (field: F, value: string, onChange: (v: string) => void) => ({
    value,
    error: errorFor(field),
    onChangeText: (v: string) => {
      onChange(v);
      touch(field);
      clearServer(field);
    },
    onBlur: () => touch(field),
  });

  /** Marks the form submitted and returns true when there are no client-side errors. */
  const validate = () => {
    setSubmitted(true);
    return !Object.values(clientErrors).some(Boolean);
  };

  const reset = useCallback(() => {
    setTouched({});
    setSubmitted(false);
    setServerErrors({});
  }, []);

  return { bind, errorFor, touch, clearServer, validate, reset, setServerErrors };
}
