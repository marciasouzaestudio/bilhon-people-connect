import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { useApp } from "@/contexts/AppContext";

// ─── AI Content Generation ─────────────────────────────────────

export function useGenerateContent() {
  return useMutation({
    mutationFn: (params: api.GenerateContentParams) => api.generateContent(params),
  });
}

// ─── Post for Me (accounts + posting + analytics) ───────────────

export function usePfmAccounts(platform?: string) {
  const { isConfigured } = useApp();
  return useQuery({
    queryKey: ["pfm", "accounts", platform],
    queryFn: () => api.pfmListAccounts(platform),
    staleTime: 60_000,
    enabled: isConfigured, // só chama a PFM se a key estiver configurada (evita 500/tela branca)
  });
}

export function usePfmCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: api.PfmCreatePostParams) => api.pfmCreatePost(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pfm", "posts"] });
    },
  });
}

export function usePfmPosts(opts?: { platform?: string; status?: string; limit?: number }) {
  const { isConfigured } = useApp();
  return useQuery({
    queryKey: ["pfm", "posts", opts],
    queryFn: () => api.pfmListPosts(opts),
    staleTime: 30_000,
    enabled: isConfigured,
  });
}

export function usePfmAccountFeed(socialAccountId: string | null, limit = 20) {
  return useQuery({
    queryKey: ["pfm", "feed", socialAccountId, limit],
    queryFn: () => api.pfmAccountFeed(socialAccountId!, limit),
    enabled: !!socialAccountId,
    staleTime: 60_000,
  });
}
