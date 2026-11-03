/**
 * CreativeCard — uma peça final (ângulo × formato): arte + copy editável +
 * ações (aprovar/rejeitar, copiar copy, baixar arte, regenerar arte, abrir no Studio).
 */
import { useState } from "react";
import { Check, Copy, Download, ImageOff, Loader2, PenTool, RefreshCw, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { creativeFilename, type Creative } from "@/lib/creatives";
import { COPY_LIMITS, META_CTAS, copyLength, ctaLabel, formatSpec, hookLabel } from "@/lib/meta-creative-specs";
import { cn } from "@/lib/utils";

interface CreativeCardProps {
  creative: Creative;
  regenerating: boolean;
  onPatch: (patch: Partial<Pick<Creative, "headline" | "primaryText" | "description" | "ctaType" | "status">>) => void;
  onRegenerate: () => void;
}

async function downloadUrl(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

function LenHint({ field, value }: { field: keyof typeof COPY_LIMITS; value: string }) {
  const s = copyLength(field, value);
  if (s === "ok") return null;
  return <span className={cn("text-[10px]", s === "long" ? "text-amber-500" : "text-destructive")}>{value.length}/{COPY_LIMITS[field].recommended}</span>;
}

export function CreativeCard({ creative: c, regenerating, onPatch, onRegenerate }: CreativeCardProps) {
  const navigate = useNavigate();
  const spec = formatSpec(c.format);
  const [draft, setDraft] = useState({ headline: c.headline, primaryText: c.primaryText, description: c.description });
  const dirty = draft.headline !== c.headline || draft.primaryText !== c.primaryText || draft.description !== c.description;
  const error = c.metadata?.error as string | undefined;

  const copyAll = async () => {
    const text = `Título: ${c.headline}\nTexto principal: ${c.primaryText}\nDescrição: ${c.description}\nBotão: ${ctaLabel(c.ctaType)}`;
    try { await navigator.clipboard.writeText(text); toast.success("Copy copiada."); } catch { toast.error("Não consegui copiar."); }
  };

  const statusCls = c.status === "approved" ? "border-emerald-500/60" : c.status === "rejected" ? "border-destructive/50 opacity-70" : "border-border";

  return (
    <div className={cn("card-premium flex flex-col overflow-hidden border p-0", statusCls)}>
      {/* Arte */}
      <div className="relative bg-muted" style={{ aspectRatio: `${spec.ratio}` }}>
        {c.imageUrl ? (
          <img src={c.imageUrl} alt={c.headline} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-muted-foreground">
            <ImageOff className="h-6 w-6" />
            {error ? <span>Arte falhou: {error}</span> : <span>Sem arte</span>}
          </div>
        )}
        {regenerating && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        )}
        <div className="absolute left-2 top-2 flex gap-1">
          <Badge variant="secondary" className="bg-background/85 text-[10px]">{spec.ratioLabel}</Badge>
          {c.status === "approved" && <Badge className="bg-emerald-600 text-[10px] text-white">Aprovado</Badge>}
          {c.status === "rejected" && <Badge variant="destructive" className="text-[10px]">Rejeitado</Badge>}
        </div>
      </div>

      {/* Copy */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-medium">{c.angleName}</span>
          <Badge variant="outline" className="shrink-0 text-[10px]">{hookLabel(c.hookType)}</Badge>
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Título</span><LenHint field="headline" value={draft.headline} /></div>
          <Input value={draft.headline} onChange={(e) => setDraft((d) => ({ ...d, headline: e.target.value }))} className="h-8 text-sm" />
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Texto principal</span><LenHint field="primaryText" value={draft.primaryText} /></div>
          <Textarea value={draft.primaryText} onChange={(e) => setDraft((d) => ({ ...d, primaryText: e.target.value }))} rows={3} className="text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-0.5">
            <div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Descrição</span><LenHint field="description" value={draft.description} /></div>
            <Input value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} className="h-8 text-sm" />
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Botão</span>
            <Select value={c.ctaType} onValueChange={(v) => onPatch({ ctaType: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{META_CTAS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        {dirty && (
          <div className="flex gap-1.5">
            <Button size="sm" className="h-7 rounded-full text-xs" onClick={() => onPatch(draft)}>Salvar copy</Button>
            <Button size="sm" variant="ghost" className="h-7 rounded-full text-xs" onClick={() => setDraft({ headline: c.headline, primaryText: c.primaryText, description: c.description })}>Desfazer</Button>
          </div>
        )}

        {/* Ações */}
        <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
          <Button size="icon" variant={c.status === "approved" ? "default" : "ghost"} className="h-8 w-8" title="Aprovar" onClick={() => onPatch({ status: c.status === "approved" ? "draft" : "approved" })}><Check className="h-4 w-4" /></Button>
          <Button size="icon" variant={c.status === "rejected" ? "destructive" : "ghost"} className="h-8 w-8" title="Rejeitar" onClick={() => onPatch({ status: c.status === "rejected" ? "draft" : "rejected" })}><X className="h-4 w-4" /></Button>
          <span className="mx-1 h-4 w-px bg-border" />
          <Button size="icon" variant="ghost" className="h-8 w-8" title="Copiar copy" onClick={copyAll}><Copy className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" title="Baixar arte" disabled={!c.imageUrl} onClick={() => c.imageUrl && downloadUrl(c.imageUrl, creativeFilename(c))}><Download className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" title="Gerar outra arte" disabled={regenerating} onClick={onRegenerate}><RefreshCw className={cn("h-4 w-4", regenerating && "animate-spin")} /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" title="Refinar no Studio" disabled={!c.imageUrl} onClick={() => navigate("/studio", { state: { mediaUrls: [c.imageUrl], prompt: c.primaryText } })}><PenTool className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}
