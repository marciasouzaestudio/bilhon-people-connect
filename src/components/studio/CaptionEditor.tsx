import { useState } from "react";
import { Wand2, Loader2, Shuffle, Languages, LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { aiAssist } from "@/lib/api";
import { brandTextHint, type BrandProfile } from "@/lib/brand";
import { PLATFORMS } from "@/lib/platforms";
import type { Platform } from "@/types";

const LANGS = ["Inglês", "Espanhol", "Português", "Francês", "Alemão", "Italiano"];

/**
 * Editor de legenda com IA — compartilhado entre o modo Automático (OutputScreen)
 * e o Assistido (PublishPanel). Gera, varia, traduz e adapta por rede.
 * caption e capsByPlat são controlados pelo pai (usados na publicação).
 */
export function CaptionEditor({
  caption,
  onCaptionChange,
  capsByPlat,
  onCapsByPlatChange,
  selectedPlatforms,
  brand,
  hashtags,
  captionTopic,
  rows = 5,
  perPlatformNote,
}: {
  caption: string;
  onCaptionChange: (s: string) => void;
  capsByPlat: Record<string, string>;
  onCapsByPlatChange: (m: Record<string, string>) => void;
  selectedPlatforms: string[];
  brand: BrandProfile | null;
  hashtags?: string[];
  captionTopic?: string;
  rows?: number;
  perPlatformNote?: boolean;
}) {
  const [genCap, setGenCap] = useState(false);
  const [variations, setVariations] = useState<string[]>([]);
  const [aiBusy, setAiBusy] = useState<"" | "variations" | "translate" | "adapt">("");
  const [lang, setLang] = useState("Inglês");

  const generateCaption = async () => {
    setGenCap(true);
    try {
      const { text } = await aiAssist({
        system: `Você é redator de redes sociais. Escreva uma legenda envolvente em português brasileiro, com gancho, 1 CTA e 5-8 hashtags relevantes no final. ${brandTextHint(brand)} Responda APENAS com a legenda.`,
        prompt: (captionTopic || caption || "post de redes sociais").trim(), temperature: 0.8,
      });
      if (text) { onCaptionChange(text); toast.success("Legenda gerada pela IA"); }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setGenCap(false); }
  };

  const adaptPerPlatform = async () => {
    if (!caption.trim()) { toast.error("Escreva ou gere uma legenda primeiro."); return; }
    if (!selectedPlatforms.length) { toast.error("Selecione ao menos uma conta."); return; }
    setAiBusy("adapt");
    try {
      const entries = await Promise.all(selectedPlatforms.map(async (p) => {
        const name = PLATFORMS[p as Platform]?.name || p;
        const { text } = await aiAssist({
          system: `Você é redator de redes sociais. Adapte a legenda para o ${name}, respeitando o tom e as convenções dessa rede (LinkedIn profissional e sem excesso de hashtags; X/Twitter curto e direto; Instagram envolvente com emojis e hashtags; TikTok casual). Mantenha o sentido e o idioma. ${brandTextHint(brand)} Responda APENAS com a legenda.`,
          prompt: caption, temperature: 0.7,
        });
        return [p, (text || caption).trim()] as const;
      }));
      onCapsByPlatChange({ ...capsByPlat, ...Object.fromEntries(entries) });
      toast.success("Legendas adaptadas por rede");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setAiBusy(""); }
  };

  const genVariations = async () => {
    if (!caption.trim()) { toast.error("Escreva ou gere uma legenda primeiro."); return; }
    setAiBusy("variations");
    try {
      const { json } = await aiAssist({
        system: `Você é redator de redes sociais. Gere 3 variações da legenda, com ganchos diferentes, mantendo idioma e sentido. ${brandTextHint(brand)} Responda APENAS com um array JSON de 3 strings.`,
        prompt: caption, expectJson: true, temperature: 0.95,
      });
      const list = Array.isArray(json) ? (json as string[]).filter((x) => typeof x === "string") : [];
      if (list.length) { setVariations(list); toast.success("Variações geradas"); } else toast.error("A IA não retornou variações.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setAiBusy(""); }
  };

  const translateCaption = async () => {
    if (!caption.trim()) { toast.error("Escreva ou gere uma legenda primeiro."); return; }
    setAiBusy("translate");
    try {
      const { text } = await aiAssist({
        system: `Você é tradutor especializado em marketing. Traduza a legenda para ${lang}, adaptando expressões idiomáticas e mantendo o tom e as hashtags relevantes. Responda APENAS com a tradução.`,
        prompt: caption, temperature: 0.4,
      });
      if (text) { onCaptionChange(text); toast.success(`Traduzido para ${lang}`); }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setAiBusy(""); }
  };

  return (
    <div className="space-y-3">
      <Label className="flex items-center justify-between text-xs font-medium">
        <span>Legenda{perPlatformNote ? " (padrão; cada rede usa a sua quando houver)" : ""}</span>
        <Button variant="ghost" size="sm" className="h-6 text-primary text-[11px]" onClick={generateCaption} disabled={genCap}>
          {genCap ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Wand2 className="mr-1 h-3 w-3" />} Gerar com IA
        </Button>
      </Label>
      <Textarea value={caption} onChange={(e) => onCaptionChange(e.target.value)} rows={rows} placeholder="Escreva a legenda…" />

      <div className="flex flex-wrap items-center gap-1.5">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={genVariations} disabled={!!aiBusy}>
          {aiBusy === "variations" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Shuffle className="mr-1 h-3 w-3" />}Variações
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={adaptPerPlatform} disabled={!!aiBusy || !selectedPlatforms.length}>
          {aiBusy === "adapt" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <LayoutList className="mr-1 h-3 w-3" />}Adaptar por rede
        </Button>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={translateCaption} disabled={!!aiBusy}>
            {aiBusy === "translate" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Languages className="mr-1 h-3 w-3" />}Traduzir
          </Button>
          <Select value={lang} onValueChange={setLang}>
            <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANGS.map((l) => <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {variations.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-[11px] text-foreground">Variações (clique para usar)</Label>
          {variations.map((v, i) => (
            <button key={i} onClick={() => { onCaptionChange(v); setVariations([]); }} className="block w-full rounded-lg border border-border p-2 text-left text-xs hover:border-primary hover:bg-accent/50">
              {v}
            </button>
          ))}
        </div>
      )}

      {hashtags?.length ? (
        <div className="flex flex-wrap gap-1">
          {hashtags.map((h) => (
            <button key={h} onClick={() => onCaptionChange(`${caption}\n#${h.replace(/^#/, "")}`)}>
              <Badge variant="secondary" className="cursor-pointer text-[10px] hover:bg-accent">#{h.replace(/^#/, "")}</Badge>
            </button>
          ))}
        </div>
      ) : null}

      {selectedPlatforms.some((p) => capsByPlat[p]) && (
        <div className="space-y-2 rounded-lg border border-border p-2.5">
          <Label className="text-[11px] font-medium text-foreground">Legenda por rede</Label>
          {selectedPlatforms.filter((p) => capsByPlat[p]).map((p) => (
            <div key={p} className="space-y-1">
              <span className="flex items-center gap-1 text-[11px]">{PLATFORMS[p as Platform]?.icon} {PLATFORMS[p as Platform]?.name || p}</span>
              <Textarea value={capsByPlat[p]} onChange={(e) => onCapsByPlatChange({ ...capsByPlat, [p]: e.target.value })} rows={3} className="text-xs" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
