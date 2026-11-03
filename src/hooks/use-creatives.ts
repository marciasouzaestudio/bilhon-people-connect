/**
 * Hooks (TanStack Query) do módulo Criativos: ofertas, conjuntos e peças.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  archiveOffer, createOffer, deleteSet, listCreatives, listOffers, listSets, updateCreative, updateOffer,
  type Creative, type OfferInput,
} from "@/lib/creatives";

export const CREATIVE_KEYS = {
  offers: ["creatives", "offers"] as const,
  sets: ["creatives", "sets"] as const,
  items: (setId: string) => ["creatives", "items", setId] as const,
};

export function useOffers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: CREATIVE_KEYS.offers,
    queryFn: listOffers,
    enabled: !!user,
    staleTime: 30_000,
  });
}

export function useSaveOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: OfferInput }) => (id ? updateOffer(id, input) : createOffer(input)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: CREATIVE_KEYS.offers }); },
  });
}

export function useArchiveOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveOffer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CREATIVE_KEYS.offers });
      qc.invalidateQueries({ queryKey: CREATIVE_KEYS.sets });
    },
  });
}

export function useCreativeSets() {
  const { user } = useAuth();
  return useQuery({
    queryKey: CREATIVE_KEYS.sets,
    queryFn: listSets,
    enabled: !!user,
    staleTime: 15_000,
  });
}

export function useDeleteSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSet(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: CREATIVE_KEYS.sets }); },
  });
}

export function useCreativesOfSet(setId: string | null) {
  return useQuery({
    queryKey: CREATIVE_KEYS.items(setId || "none"),
    queryFn: () => listCreatives(setId!),
    enabled: !!setId,
  });
}

export function useUpdateCreative(setId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateCreative>[1] }) => updateCreative(id, patch),
    onMutate: async ({ id, patch }) => {
      if (!setId) return;
      const key = CREATIVE_KEYS.items(setId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Creative[]>(key);
      if (prev) qc.setQueryData<Creative[]>(key, prev.map((c) => (c.id === id ? { ...c, ...patch } as Creative : c)));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (setId && ctx?.prev) qc.setQueryData(CREATIVE_KEYS.items(setId), ctx.prev);
    },
    onSettled: () => { if (setId) qc.invalidateQueries({ queryKey: CREATIVE_KEYS.items(setId) }); },
  });
}
