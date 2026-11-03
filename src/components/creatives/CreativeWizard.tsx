/**
 * CreativeWizard — do briefing ao conjunto pronto em 3 passos:
 *  1. Configurar: oferta, marca, objetivo, nº de ângulos, formatos, opções da arte.
 *  2. Revisar o plano: a IA propõe os ângulos (copy + brief visual); o usuário
 *     edita, desliga ângulos e pede outros.
 *  3. Gerar: 1 arte por ângulo × formato, com progresso. Ao terminar abre o conjunto.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { creativePlan, type CreativeAngle } from "@/lib/api/creatives";
import type { BrandProfile } from "@/lib/brand";
import { brandForCreatives, DEFAULT_SET_OPTIONS, offerToAI, type CreativeOffer, type CreativeSet, type CreativeSetOptions } from "@/lib/creatives";
import { generateCreativeSet } from "@/lib/creative-engine";
import {
  AD_STYLES, COPY_LIMITS, CREATIVE_FORMATS, DEFAULT_FORMATS, META_CTAS, OBJECTIVES, copyLength, hookLabel, type CreativeFormat,
} from "@/lib/meta-creative-specs";
import { cn } from "@/lib/utils";

interface CreativeWizardProps {
  offers: CreativeOffer[];
  brands: BrandProfile[];
  initialOfferId?: string | null;
  onCancel: () => void;
  onDone: (set: CreativeSet) => void;
}

type Step = "config" | "plan" | "generating";

function CharHint({ field, value }: { field: keyof typeof COPY_LIMITS; value: string }) {
  const state = copyLength(field, value);
  const lim = COPY_LIMITS[field];
  return (
    <span className={cn("text-[11px]", state === "ok" ? "text-muted-foreground" : state === "long" ? "text-amber-500" : "text-destructive")}>
      {value.length}/{lim.recommended}{state === "over" ? ` (máx. ${lim.max})` : ""}
    </span>
  );
}

export function CreativeWizard({ offers, brands, initialOfferId, onCancel, onDone }: CreativeWizardProps) {
  const [step, setStep] = useState<Step>("config");
  const [offerId, setOfferId] = useState<string>(initialOfferId || offers[0]?.id || "");
  const offer = offers.find((o) => o.id === offerId) || null;
  const [brandId, setBrandId] = useState<string | null>(null);
  useEffect(() => { setBrandId(offer?.brandId || brands.find((b) => b.is_default)?.id || brands[0]?.id || null); }, [offer, brands]);
  const brand = brands.find((b) => b.id === brandId) || null;

  const [objective, setObjective] = useState("conversao");
  const [angleCount, setAngleCount] = useState(4);
  const [formats, setFormats] = useState<CreativeFormat[]>(DEFAULT_FORMATS);
  const [options, setOptions] = useState<CreativeSetOptions>(DEFAULT_SET_OPTIONS);
  const [setName, setSetName] = useState("");

  const [planning, setPlanning] = useState(false);
  const [strategyNote, setStrategyNote] = useState("");
  const [angles, setAngles] = useState<CreativeAngle[]>([]);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});

  const [progress, setProgress] = useState({ done: 0, total: 0, label: "" });

  const selectedAngles = useMemo(() => angles.filter((a) => enabled[a.id] !== false), [angles, enabled]);
  const imageCount = selectedAngles.length * formats.length;
  const hasProductPhotos = (offer?.productImages.length || 0) > 0;
  const hasLogo = !!brand?.logo_url;

  const toggleFormat = (f: CreativeFormat) => setFormats((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));
  const setOpt = <K extends keyof CreativeSetOptions>(k: K, v: CreativeSetOptions[K]) => setOptions((o) => ({ ...o, [k]: v }));

  const runPlan = async (exclude: string[] = []) => {
    if (!offer) { toast.error("Escolha uma oferta."); return; }
    if (!formats.length) { toast.error("Escolha ao menos um formato."); return; }
    setPlanning(true);
    try {
      const res = await creativePlan({
        offer: offerToAI(offer),
        brandProfile: brandForCreatives(brand),
        objective,
        angleCount,
        formats,
        textOnArt: options.textOnArt,
        extraDirection: options.extraDirection || undefined,
        excludeAngles: exclude.length ? exclude : undefined,
      });
      setStrategyNote(res.strategy_note);
      setAngles(res.angles);
      setEnabled({});
      if (!setName.trim()) setSetName(`${offer.name} · ${OBJECTIVES.find((o) => o.value === objective)?.label || objective}`);
      setStep("plan");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao planejar os ângulos");
    } finally { setPlanning(false); }
  };

  const updateAngle = (id: string, patch: Partial<CreativeAngle>) =>
    setAngles((cur) => cur.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const updateVisual = (id: string, patch: Partial<CreativeAngle["visual"]>) =>
    setAngles((cur) => cur.map((a) => (a.id === id ? { ...a, visual: { ...a.visual, ...patch } } : a)));

  const generate = async () => {
    if (!offer) return;
    if (!selectedAngles.length) { toast.error("Mantenha ao menos um ângulo ligado."); return; }
    setStep("generating");
    setProgress({ done: 0, total: imageCount, label: "Preparando…" });
    try {
      const result = await generateCreativeSet({
        offer, brand,
        name: setName.trim() || offer.name,
        objective, formats, options, strategyNote,
        angles: selectedAngles,
        onProgress: (done, total, label) => setProgress({ done, total, label }),
      });
      if (result.failed) toast.warning(`${result.failed} arte(s) falharam. Você pode regenerar cada uma no conjunto.`);
      else toast.success("Conjunto de criativos pronto!");
      onDone(result.set);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar o conjunto");
      setStep("plan");
    }
  };

  // ── Passo 3: progresso ─────────────────────────────────────────
  if (step === "generating") {
    const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <h2 className="text-lg font-semibold">Gerando {progress.total} arte{progress.total === 1 ? "" : "s"}…</h2>
        <Progress value={pct} className="w-full" />
        <p className="text-sm text-muted-foreground">{progress.done}/{progress.total} · {progress.label}</p>
        <p className="text-xs text-muted-foreground">Cada arte leva de 20 a 60 segundos. Pode deixar esta aba aberta e voltar depois.</p>
      </div>
    );
  }

  // ── Passo 2: plano ─────────────────────────────────────────────
  if (step === "plan") {
    return (
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" className="rounded-full" onClick={() => setStep("config")} disabled={planning}><ArrowLeft className="mr-1.5 h-4 w-4" /> Configuração</Button>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => runPlan(angles.map((a) => a.name))} disabled={planning}>
              {planning ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />} Outros ângulos
            </Button>
            <Button className="rounded-full" onClick={generate} disabled={planning || !selectedAngles.length}>
              <Wand2 className="mr-1.5 h-4 w-4" /> Gerar {imageCount} arte{imageCount === 1 ? "" : "s"}
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <p className="eyebrow text-xs">Plano da IA</p>
          <h2 className="text-xl font-semibold">Revise os ângulos antes de gerar as artes</h2>
          {strategyNote && <p className="text-sm text-muted-foreground">{strategyNote}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Nome do conjunto</Label>
          <Input value={setName} onChange={(e) => setSetName(e.target.value)} placeholder="Ex.: Lançamento setembro · conversão" />
        </div>

        <div className="space-y-4">
          {angles.map((a, idx) => {
            const on = enabled[a.id] !== false;
            return (
              <div key={a.id} className={cn("card-premium space-y-3 p-4 transition-opacity", !on && "opacity-50")}>
                <div className="flex flex-wrap items-center gap-2">
                  <Switch checked={on} onCheckedChange={(v) => setEnabled((e) => ({ ...e, [a.id]: v }))} />
                  <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                  <Input value={a.name} onChange={(e) => updateAngle(a.id, { name: e.target.value })} className="h-8 max-w-xs font-medium" disabled={!on} />
                  <Badge variant="outline">{hookLabel(a.hook_type)}</Badge>
                  {a.rationale && <span className="text-xs text-muted-foreground">{a.rationale}</span>}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between"><Label className="text-xs">Título (headline)</Label><CharHint field="headline" value={a.headline} /></div>
                      <Input value={a.headline} onChange={(e) => updateAngle(a.id, { headline: e.target.value })} disabled={!on} />
                      {a.alt_headlines?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {a.alt_headlines.map((h) => (
                            <button key={h} type="button" disabled={!on} onClick={() => updateAngle(a.id, { headline: h })} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent">{h}</button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between"><Label className="text-xs">Texto principal</Label><CharHint field="primaryText" value={a.primary_text} /></div>
                      <Textarea value={a.primary_text} onChange={(e) => updateAngle(a.id, { primary_text: e.target.value })} rows={3} disabled={!on} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between"><Label className="text-xs">Descrição</Label><CharHint field="description" value={a.description} /></div>
                        <Input value={a.description} onChange={(e) => updateAngle(a.id, { description: e.target.value })} disabled={!on} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Botão</Label>
                        <Select value={META_CTAS.some((c) => c.value === a.cta_type) ? a.cta_type : "LEARN_MORE"} onValueChange={(v) => updateAngle(a.id, { cta_type: v })} disabled={!on}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>{META_CTAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Cena da arte</Label>
                      <Textarea value={a.visual.scene} onChange={(e) => updateVisual(a.id, { scene: e.target.value })} rows={3} disabled={!on} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Composição e estilo</Label>
                      <Textarea value={[a.visual.composition, a.visual.style].filter(Boolean).join(" · ")} onChange={(e) => updateVisual(a.id, { composition: e.target.value, style: "" })} rows={2} disabled={!on} />
                    </div>
                    {options.textOnArt && (
                      <div className="space-y-1">
                        <Label className="text-xs">Frase estampada na arte</Label>
                        <Input value={a.visual.text_overlay} onChange={(e) => updateVisual(a.id, { text_overlay: e.target.value })} placeholder="Até 6 palavras" disabled={!on} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm">
          <span className="text-muted-foreground">
            {selectedAngles.length} ângulo{selectedAngles.length === 1 ? "" : "s"} × {formats.length} formato{formats.length === 1 ? "" : "s"} = <span className="font-medium text-foreground">{imageCount} artes</span> (conta na cota de imagens da organização)
          </span>
          <Button className="rounded-full" onClick={generate} disabled={planning || !selectedAngles.length}>
            <Wand2 className="mr-1.5 h-4 w-4" /> Gerar artes
          </Button>
        </div>
      </div>
    );
  }

  // ── Passo 1: configuração ──────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" className="rounded-full" onClick={onCancel}><ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar</Button>
      </div>
      <div className="space-y-1">
        <p className="eyebrow inline-flex items-center gap-1.5 text-xs"><Sparkles className="h-3.5 w-3.5 text-primary" /> Novo conjunto de criativos</p>
        <h2 className="text-xl font-semibold">O que vamos anunciar?</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Oferta / produto</Label>
          <Select value={offerId} onValueChange={setOfferId}>
            <SelectTrigger><SelectValue placeholder="Escolha a oferta" /></SelectTrigger>
            <SelectContent>{offers.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Marca (branding e voz)</Label>
          <Select value={brandId || "none"} onValueChange={(v) => setBrandId(v === "none" ? null : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem marca</SelectItem>
              {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            {brand ? <>A marca <span className="font-medium text-foreground">{brand.name}</span> assina o anúncio: paleta, tom de voz e logo no canto. Confira se é a marca certa para esta oferta.</> : "Sem marca: a arte e a copy não usam identidade visual nem logo."}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Objetivo da campanha</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {OBJECTIVES.map((o) => (
            <button key={o.value} type="button" onClick={() => setObjective(o.value)} className={cn("rounded-xl border p-3 text-left transition-colors", objective === o.value ? "border-primary bg-primary/10" : "border-border hover:bg-accent")}>
              <p className="text-sm font-medium">{o.label}</p>
              <p className="text-[11px] text-muted-foreground">{o.hint}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Quantos ângulos</Label>
          <div className="flex flex-wrap gap-1.5">
            {[2, 3, 4, 5, 6].map((n) => (
              <button key={n} type="button" onClick={() => setAngleCount(n)} className={cn("rounded-full border px-3 py-1 text-xs", angleCount === n ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-accent")}>{n}</button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">Cada ângulo é uma abordagem diferente (dor, prova, oferta…) para testar na Meta.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Formatos</Label>
          <div className="space-y-1.5">
            {CREATIVE_FORMATS.map((f) => (
              <label key={f.id} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={formats.includes(f.id)} onCheckedChange={() => toggleFormat(f.id)} />
                <span>{f.label} <span className="text-xs text-muted-foreground">{f.ratioLabel} · {f.placement}</span></span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border p-4">
        <p className="eyebrow text-xs">Arte</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <Checkbox checked={options.textOnArt} onCheckedChange={(v) => setOpt("textOnArt", v === true)} className="mt-0.5" />
            <span>Frase estampada na arte<span className="block text-xs text-muted-foreground">Headline curta dentro da imagem (a Meta recomenda pouco texto).</span></span>
          </label>
          <label className={cn("flex items-start gap-2.5 text-sm", hasProductPhotos ? "cursor-pointer" : "opacity-60")}>
            <Checkbox checked={options.useProductPhotos && hasProductPhotos} disabled={!hasProductPhotos} onCheckedChange={(v) => setOpt("useProductPhotos", v === true)} className="mt-0.5" />
            <span>Usar as fotos do produto<span className="block text-xs text-muted-foreground">{hasProductPhotos ? "A arte sai com o produto real como referência." : "Adicione fotos na oferta para ativar."}</span></span>
          </label>
          <label className={cn("flex items-start gap-2.5 text-sm", hasLogo ? "cursor-pointer" : "opacity-60")}>
            <Checkbox checked={options.includeLogo && hasLogo} disabled={!hasLogo} onCheckedChange={(v) => setOpt("includeLogo", v === true)} className="mt-0.5" />
            <span>Aplicar o logo da marca<span className="block text-xs text-muted-foreground">{hasLogo ? "Logo real, discreto, num canto." : "Cadastre o logo em Marcas para ativar."}</span></span>
          </label>
          <div className="space-y-1">
            <Label className="text-xs">Estilo visual</Label>
            <Select value={options.style} onValueChange={(v) => setOpt("style", v)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{AD_STYLES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Direção extra (opcional)</Label>
          <Textarea value={options.extraDirection} onChange={(e) => setOpt("extraDirection", e.target.value)} rows={2} placeholder="Ex.: sempre mostrar o produto aberto; evitar pessoas; fundo escuro." />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Serão até <span className="font-medium text-foreground">{angleCount * formats.length} artes</span>. Você revisa a copy antes de gerar.
        </p>
        <Button className="rounded-full" size="lg" onClick={() => runPlan()} disabled={planning || !offer || !formats.length}>
          {planning ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Planejando…</> : <>Planejar ângulos <ArrowRight className="ml-1.5 h-4 w-4" /></>}
        </Button>
      </div>
    </div>
  );
}
