import { useAuth } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApi } from "../api";

export type Membership = {
  id: number;
  business_id: number;
  business_name: string;
  business_slug: string;
  industry_mode: "mobile" | "fixed";
  role: "owner" | "admin" | "worker";
  status: "active" | "invited" | "inactive";
};

export type Me = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  avatar_url: string;
  clerk_user_id: string | null;
  memberships: Membership[];
};

export function useMe() {
  const api = useApi();
  const { isSignedIn, userId } = useAuth();
  return useQuery({
    queryKey: ["me", userId],
    queryFn: () => api.get<Me>("/api/auth/me/"),
    staleTime: 60_000,
    enabled: !!isSignedIn,
  });
}

export function useUpdateMe() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: Partial<Pick<Me, "first_name" | "last_name" | "phone">>) =>
      api.patch<Me>("/api/auth/me/", patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
