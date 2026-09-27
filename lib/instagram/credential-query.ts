"use client";

import { useQuery } from "@tanstack/react-query";

export type CredentialSummary = {
  id: string;
  name: string;
  appId: string;
  instagramAccountId: string;
  verifiedAt: string;
  tokenExpiresAt: string | null;
  createdAt: string;
};
export const credentialQueryKey = ["instagram-credentials"] as const;
export function useInstagramCredentials(enabled = true) {
  return useQuery<CredentialSummary[]>({
    queryKey: credentialQueryKey,
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const response = await fetch("/api/instagram/credentials");
      const payload = await response.json();
      if (!response.ok || !payload.success)
        throw new Error(payload.error ?? "Could not load credentials");
      return payload.data;
    },
  });
}
