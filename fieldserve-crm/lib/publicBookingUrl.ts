import { Platform } from "react-native";

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.replace(/\/$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Base URL for the public booking site: explicit env var or the current web origin. */
export function getPublicBookingBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_URL;
  if (configured) return normalizeBaseUrl(configured);
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

export function getBookingLink(slug: string | null | undefined): string {
  if (!slug) return "";
  const baseUrl = getPublicBookingBaseUrl();
  return baseUrl ? `${baseUrl}/book/${slug}` : "";
}
