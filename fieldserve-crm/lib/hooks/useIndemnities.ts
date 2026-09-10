import { useAuth } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApi } from "../api";

export type Indemnity = {
  id: number;
  business: number;
  version: number;
  source: "text" | "pdf";
  text: string;
  document_url: string | null;
  status: "draft" | "published" | "archived";
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

const indemnityKey = ["indemnities"] as const;

export function useIndemnities(enabled = true) {
  const api = useApi();
  const { isSignedIn } = useAuth();
  return useQuery({
    queryKey: indemnityKey,
    queryFn: () => api.get<{ results: Indemnity[] } | Indemnity[]>("/api/indemnities/"),
    enabled: !!isSignedIn && enabled,
    select: (response) => Array.isArray(response) ? response : response.results,
  });
}

export function useCreateTextIndemnity() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ business, text }: { business: number; text: string }) =>
      api.post<Indemnity>("/api/indemnities/", { business, source: "text", text }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: indemnityKey }),
  });
}

export function useCreatePdfIndemnity() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      business,
      uri,
      name,
      mimeType,
    }: {
      business: number;
      uri: string;
      name: string;
      mimeType?: string;
    }) => {
      const form = new FormData();
      form.append("business", String(business));
      form.append("source", "pdf");
      form.append("document", { uri, name, type: mimeType || "application/pdf" } as any);
      return api.postFormData<Indemnity>("/api/indemnities/", form);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: indemnityKey }),
  });
}

export function usePublishIndemnity() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<Indemnity>(`/api/indemnities/${id}/publish/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: indemnityKey }),
  });
}

export function useArchiveIndemnity() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<Indemnity>(`/api/indemnities/${id}/archive/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: indemnityKey }),
  });
}