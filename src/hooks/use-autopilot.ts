import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import * as api from "@/lib/api";
import type {
  AutopilotConfig,
  AutopilotCalendar,
  AutopilotPost,
} from "@/types";
import { requireOrgId } from "@/lib/org";

// ─── Query Keys ─────────────────────────────────────────────────

const keys = {
  configs: ["autopilot", "configs"] as const,
  config: (id: string) => ["autopilot", "config", id] as const,
  calendars: (configId: string) => ["autopilot", "calendars", configId] as const,
  posts: (calendarId: string) => ["autopilot", "posts", calendarId] as const,
};

// ─── Configs ────────────────────────────────────────────────────

export function useAutopilotConfigs() {
  const { user } = useAuth();
  return useQuery({
    queryKey: keys.configs,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("autopilot_configs")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as AutopilotConfig[];
    },
    enabled: !!user,
  });
}

export function useAutopilotConfig(id: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: keys.config(id || ""),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("autopilot_configs")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as unknown as AutopilotConfig;
    },
    enabled: !!user && !!id,
  });
}

export function useSaveAutopilotConfig() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: Partial<AutopilotConfig> & { id?: string }) => {
      // themes é jsonb no banco; cast p/ never evita o conflito com o tipo Json gerado.
      const payload = { ...config, user_id: user!.id, org_id: await requireOrgId(), updated_at: new Date().toISOString() } as never;

      if (config.id) {
        const { data, error } = await supabase
          .from("autopilot_configs")
          .update(payload)
          .eq("id", config.id)
          .select()
          .single();
        if (error) throw error;
        return data as unknown as AutopilotConfig;
      } else {
        const { data, error } = await supabase
          .from("autopilot_configs")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        return data as unknown as AutopilotConfig;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.configs });
    },
  });
}

export function useToggleAutopilot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const update: Record<string, unknown> = {
        is_active,
        updated_at: new Date().toISOString(),
      };
      // If activating and no next_run, set it to now (trigger on next cron)
      if (is_active) {
        update.next_run_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from("autopilot_configs")
        .update(update as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.configs });
    },
  });
}

// ─── Calendars ──────────────────────────────────────────────────

export function useAutopilotCalendars(configId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: keys.calendars(configId || ""),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("autopilot_calendars")
        .select("*")
        .eq("config_id", configId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as AutopilotCalendar[];
    },
    enabled: !!user && !!configId,
  });
}

// ─── Posts ───────────────────────────────────────────────────────

export function useAutopilotPosts(calendarId: string | null) {
  return useQuery({
    queryKey: keys.posts(calendarId || ""),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("autopilot_posts")
        .select("*")
        .eq("calendar_id", calendarId!)
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as AutopilotPost[];
    },
    enabled: !!calendarId,
  });
}

export function useApproveCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (calendarId: string) => {
      // Aprova os posts que JÁ TÊM ARTE (coluna "Geradas"). Aprovar direto do
      // rascunho voltaria a ser "aprovar sem ver a peça visual" — o bug do card.
      const { error: postErr } = await supabase
        .from("autopilot_posts")
        .update({ status: "approved", updated_at: new Date().toISOString() })
        .eq("calendar_id", calendarId)
        .eq("status", "visual_ready");
      if (postErr) throw postErr;

      // Update calendar status
      const { error: calErr } = await supabase
        .from("autopilot_calendars")
        .update({ status: "approved", updated_at: new Date().toISOString() })
        .eq("id", calendarId);
      if (calErr) throw calErr;
    },
    onSuccess: (_, calendarId) => {
      qc.invalidateQueries({ queryKey: keys.posts(calendarId) });
      qc.invalidateQueries({ queryKey: ["autopilot"] });
    },
  });
}

export function useApprovePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase
        .from("autopilot_posts")
        .update({ status: "approved", updated_at: new Date().toISOString() })
        .eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["autopilot", "posts"] });
    },
  });
}

export function useRejectPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase
        .from("autopilot_posts")
        .delete()
        .eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["autopilot", "posts"] });
    },
  });
}

export function useEditAutopilotPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      text_content,
      hashtags,
    }: {
      id: string;
      text_content: string;
      hashtags?: string[];
    }) => {
      const update: Record<string, unknown> = {
        text_content,
        updated_at: new Date().toISOString(),
      };
      if (hashtags !== undefined) update.hashtags = hashtags;
      const { error } = await supabase
        .from("autopilot_posts")
        .update(update as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["autopilot", "posts"] });
    },
  });
}

// Regera o visual de um post: limpa mídia/estado, devolve o post ao início da
// esteira e dispara a geração de visual SÓ desse post (post_id) — a arte mudou,
// então ele passa por "Geradas" e volta a precisar de aprovação.
export function useRegeneratePostVisual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, calendarId }: { id: string; calendarId: string }) => {
      const { error } = await supabase
        .from("autopilot_posts")
        .update({
          media_urls: [], visual_creation_id: null, visual_provider: null,
          status: "draft", error_message: null, updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      await api.runAutopilot("generate_visuals", { calendar_id: calendarId, post_id: id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["autopilot"] });
    },
  });
}

// ─── Manual Triggers ────────────────────────────────────────────

export function useRunAutopilot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (configId: string) =>
      api.runAutopilot("generate", { config_id: configId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["autopilot"] });
    },
  });
}

export interface GenerateVisualsResult {
  generated: number;
  failed: number;
  pending_visuals: number;
  remaining: number;
}

export interface ScheduleResult {
  scheduled: number;
  skipped_no_visual: number;
  pending_visuals?: number;
  message?: string;
}

export interface CurateResult {
  curated: number;
  error?: string;
}

export interface CheckVisualsResult {
  checked: number;
  updated: number;
}

/**
 * Gera a peça visual dos posts do ciclo (Ideias → Geradas).
 *
 * A edge processa em LOTES (cada imagem leva ~17s; um ciclo inteiro estouraria
 * o wall-clock da function), então repetimos a chamada enquanto sobrar post sem
 * arte, invalidando as queries entre os lotes para o quadro andar na tela.
 *
 * Vídeo (Veo) é assíncrono: a geração devolve `pending_visuals` e o status
 * `generating_visual`. O cliente (e o cron horário) disparam `check_visuals`
 * para recolher a peça paga — não esperar só o cron.
 */
export function useGenerateVisuals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (calendarId: string) => {
      const total: GenerateVisualsResult = { generated: 0, failed: 0, pending_visuals: 0, remaining: 0 };
      for (let round = 0; round < 12; round++) {
        const r = (await api.runAutopilot("generate_visuals", {
          calendar_id: calendarId,
          // Clique explícito = também retenta o que falhou antes.
          retry_failed: true,
        })) as unknown as GenerateVisualsResult;
        total.generated += r.generated || 0;
        total.failed += r.failed || 0;
        total.pending_visuals += r.pending_visuals || 0;
        total.remaining = r.remaining || 0;
        qc.invalidateQueries({ queryKey: ["autopilot", "posts"] });
        // Para quando acabou OU quando o lote não andou (ex.: provider fora do
        // ar) — senão o loop retentaria os mesmos posts 12 vezes.
        if (!total.remaining || (!r.generated && !r.pending_visuals)) break;
      }
      return total;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["autopilot"] });
    },
  });
}

/**
 * Polling do Veo (e de qualquer visual assíncrono em `generating_visual`).
 * O cron horário também chama; o cliente chama após gerar vídeo e sob demanda
 * para não descartar peça paga (~US$1–3) por timeout entre ticks do cron.
 */
export function useCheckVisuals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (calendarId: string) =>
      (await api.runAutopilot("check_visuals", { calendar_id: calendarId })) as unknown as CheckVisualsResult,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["autopilot"] });
    },
  });
}

export function useScheduleCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (calendarId: string) =>
      (await api.runAutopilot("schedule", { calendar_id: calendarId })) as unknown as ScheduleResult,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["autopilot"] });
    },
  });
}

export function useConfirmCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (calendarId: string) =>
      api.runAutopilot("confirm", { calendar_id: calendarId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["autopilot"] });
    },
  });
}

export function useCurateCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (calendarId: string) =>
      (await api.runAutopilot("curate", { calendar_id: calendarId })) as unknown as CurateResult,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["autopilot"] });
    },
  });
}
