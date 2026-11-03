import { Badge } from "@/components/ui/badge";
import type { AutopilotPostStatus, AutopilotCalendarStatus } from "@/types";

const POST_STATUS_MAP: Record<AutopilotPostStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Rascunho", variant: "secondary" },
  approved: { label: "Aprovado", variant: "outline" },
  generating_visual: { label: "Gerando visual...", variant: "default" },
  visual_ready: { label: "Visual pronto", variant: "default" },
  scheduled: { label: "Agendado", variant: "default" },
  published: { label: "Publicado", variant: "default" },
  failed: { label: "Erro", variant: "destructive" },
};

const CALENDAR_STATUS_MAP: Record<AutopilotCalendarStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Rascunho", variant: "secondary" },
  approved: { label: "Aprovado", variant: "outline" },
  scheduling: { label: "Agendando...", variant: "default" },
  active: { label: "Ativo", variant: "default" },
  completed: { label: "Concluído", variant: "default" },
  failed: { label: "Erro", variant: "destructive" },
};

export function PostStatusBadge({ status }: { status: AutopilotPostStatus }) {
  const config = POST_STATUS_MAP[status] || { label: status, variant: "secondary" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function CalendarStatusBadge({ status }: { status: AutopilotCalendarStatus }) {
  const config = CALENDAR_STATUS_MAP[status] || { label: status, variant: "secondary" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
