import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Job } from "./useJobs";
import { useApi } from "../api";

export type IndemnitySignInput = {
  jobId: number;
  signedName: string;
  signature: { uri: string; name: string; type: string };
};

export function useIndemnitySign() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, signedName, signature }: IndemnitySignInput) => {
      const form = new FormData();
      form.append("signed_name", signedName);
      form.append("signature", signature as any);
      return api.postFormData<Job>(`/api/jobs/${jobId}/indemnity/sign/`, form);
    },
    onSuccess: (job) => {
      queryClient.setQueryData(["job", job.id], job);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}