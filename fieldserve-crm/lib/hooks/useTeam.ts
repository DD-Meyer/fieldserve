import { useAuth } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApi } from "../api";

export type TeamMember = {
  id: number;
  business: number;
  user: number | null;
  user_email: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
  invited_email: string;
  role: "admin" | "staff";
  status: "active" | "invited" | "inactive";
  invited_at: string | null;
  joined_at: string;
  services: number[];
  buffer_minutes: number | null;
};

function teamKey(businessId: number | null) {
  return ["business-members", businessId] as const;
}

export function useTeamMembers(businessId: number | null) {
  const api = useApi();
  const { isSignedIn } = useAuth();
  return useQuery({
    queryKey: teamKey(businessId),
    queryFn: () => api.get<TeamMember[]>(`/api/businesses/${businessId}/members/`),
    enabled: !!isSignedIn && businessId != null,
  });
}

export function useInviteTeamMember() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ businessId, email, role }: { businessId: number; email: string; role: TeamMember["role"] }) =>
      api.post<TeamMember>(`/api/businesses/${businessId}/members/invite/`, { email, role }),
    onSuccess: (_, variables) => queryClient.invalidateQueries({ queryKey: teamKey(variables.businessId) }),
  });
}

export function useUpdateTeamMember() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      businessId,
      memberId,
      role,
      services,
      buffer_minutes,
    }: {
      businessId: number;
      memberId: number;
      role?: TeamMember["role"];
      services?: number[];
      buffer_minutes?: number | null;
    }) =>
      api.patch<TeamMember>(`/api/businesses/${businessId}/members/${memberId}/`, {
        ...(role !== undefined ? { role } : {}),
        ...(services !== undefined ? { services } : {}),
        ...(buffer_minutes !== undefined ? { buffer_minutes } : {}),
      }),
    onSuccess: (_, variables) => queryClient.invalidateQueries({ queryKey: teamKey(variables.businessId) }),
  });
}

export function useDeactivateTeamMember() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ businessId, memberId }: { businessId: number; memberId: number }) =>
      api.delete<void>(`/api/businesses/${businessId}/members/${memberId}/`),
    onSuccess: (_, variables) => queryClient.invalidateQueries({ queryKey: teamKey(variables.businessId) }),
  });
}