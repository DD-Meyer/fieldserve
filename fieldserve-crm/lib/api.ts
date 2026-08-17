import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useMemo } from "react";

const RAW_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";
const API_BASE = RAW_BASE.replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message || `Request failed with ${status}`);
    this.status = status;
    this.body = body;
  }
}

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function useApi() {
  const { getToken, isSignedIn } = useAuth();

  const request = useCallback(
    async <T = unknown>(
      method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
      path: string,
      body?: Json,
      query?: Record<string, string | number | boolean | undefined>,
    ): Promise<T> => {
      const url = new URL(
        path.startsWith("http") ? path : `${API_BASE}${path}`,
      );
      if (query) {
        Object.entries(query).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== "") {
            url.searchParams.set(k, String(v));
          }
        });
      }
      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (body !== undefined) headers["Content-Type"] = "application/json";
      if (isSignedIn) {
        const token = await getToken();
        console.log("CLERK_TOKEN", token);
        if (token) headers["Authorization"] = `Bearer ${token}`;
      }
      console.log(
        `[FieldServe API] -> ${method} ${url.toString()} (auth: ${
          isSignedIn ? "yes" : "no"
        })`,
      );
      let res: Response;
      try {
        res = await fetch(url.toString(), {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch (e: any) {
        console.log(
          `[FieldServe API] xx ${method} ${url.toString()} network error:`,
          e?.message ?? e,
        );
        throw e;
      }
      const parsed = await parseBody(res);
      console.log(
        `[FieldServe API] <- ${method} ${url.toString()} ${res.status}`,
      );
      if (!res.ok) {
        throw new ApiError(res.status, parsed);
      }
      return parsed as T;
    },
    [getToken, isSignedIn],
  );

  return useMemo(
    () => ({
      get: <T = unknown>(
        path: string,
        query?: Record<string, string | number | boolean | undefined>,
      ) => request<T>("GET", path, undefined, query),
      post: <T = unknown>(path: string, body?: Json) =>
        request<T>("POST", path, body),
      patch: <T = unknown>(path: string, body?: Json) =>
        request<T>("PATCH", path, body),
      put: <T = unknown>(path: string, body?: Json) =>
        request<T>("PUT", path, body),
      delete: <T = unknown>(path: string) => request<T>("DELETE", path),
      postFormData: async <T = unknown>(
        path: string,
        form: FormData,
      ): Promise<T> => {
        const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
        const headers: Record<string, string> = { Accept: "application/json" };
        if (isSignedIn) {
          const token = await getToken();
          if (token) headers["Authorization"] = `Bearer ${token}`;
        }
        // NB: do NOT set Content-Type — the runtime must include the multipart
        // boundary automatically.
        const res = await fetch(url, { method: "POST", headers, body: form });
        const parsed = await parseBody(res);
        if (!res.ok) throw new ApiError(res.status, parsed);
        return parsed as T;
      },
    }),
    [request, getToken, isSignedIn],
  );
}

export { API_BASE };
