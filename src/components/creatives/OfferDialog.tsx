/**
 * OfferDialog — o "offer canvas": abstrai o produto/oferta do cliente em campos
 * que a IA consome (promessa, dores, benefícios, provas, mecanismo, CTA, fotos).
 * "Preencher com IA" lê a página de vendas (Firecrawl) ou um texto colado e
 * estrutura tudo; o usuário só revisa.
 */
import { useEffect, useState } from "react";
import { Loader2, Sparkles, Globe, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { IncluirImagemDialog } from "@/components/media/IncluirImagemDialog";
import { ListInput } from "./ListInput";
import { creativeOfferFromContext, extractSource } from "@/lib/api";
import type { BrandProfile } from "@/lib/brand";
import { brandForCreatives, EMPTY_OFFER, mergeOfferFromAI, type CreativeOffer, type OfferInput } from "@/lib/creatives";
import { META_CTAS, OFFER_MECHANISMS, PRODUCT_TYPES } from "@/lib/meta-creative-specs";

interface OfferDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  brands: BrandProfile[];
  defaultBrandId: string | null;
  editing: CreativeOffer | null;
  saving: boolean;
  onSave: (input: OfferInput) => Promise<void>;
}

function toInput(o: CreativeOffer | null, defaultBrandId: string | null): OfferInput {
  if (!o) return { ...EMPTY_OFFER, brandId: defaultBrandId };
  const { id: _id, createdAt: _c, updatedAt: _u, isArchived: _a, ...rest } = o;
  return { ...rest };
}

export function OfferDialog({ open, onOpenChange, brands, defaultBrandId, editing, saving, onSave }: OfferDialogProps) {
  const [form, setForm] = useState<OfferInput>(() => toInput(editing, defaultBrandId));
  const [tab, setTab] = useState("essencial");
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [fotosOpen, setFotosOpen] = useState(false);

  useEffect(() => {
    if (open) { setForm(toInput(editing, defaultBrandId)); setTab("essencial"); setAiText(""); }
  }, [open, editing, defaultBrandId]);

  const set = <K extends keyof OfferInput>(k: K, v: OfferInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const brand = brands.find((b) => b.id === form.brandId) || null;

  const fillWithAI = async () => {
    const url = form.sourceUrl.trim();
    const text = aiText.trim();
    if (!url && !text) { toast.error("Informe a URL da página de vendas ou cole um texto sobre a oferta."); return; }
    setAiBusy(true);
    try {
      let context = text;
      if (url) {
        try {
          const src = await extractSource({
            sourceType: "url", url,
            customInstructions: "Extraia em português brasileiro, sem resumir demais: nome do produto/oferta, o que é, para quem, promessa, benefícios, diferenciais, preços e condições, bônus, garantia, prazos, depoimentos e números de prova social, CTA e links.",
          });
          const extracted = (src.content || "").trim();
          if (extracted) context = [extracted, text].filter(Boolean).join("\n\n");
          else if (!text) throw new Error("Não consegui ler essa página. Cole o texto manualmente.");
        } catch (e) {
          if (!text) throw e;
          toast.warning("Não li a página; usei só o texto colado.");
        }
      }
      const { offer } = await creativeOfferFromContext({ context, brandProfile: brandForCreatives(brand) });
      setForm((f) => mergeOfferFromAI(f, offer || {}));
      toast.success("Oferta preenchida. Revise os campos antes de salvar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao preencher com IA");
    } finally { setAiBusy(false); }
  };

  const submit = async () => {
    if (!form.name.trim()) { toast.error("Dê um nome à oferta."); setTab("essencial"); return; }
    await onSave({ ...form, name: form.name.trim() });
  };

  const busy = saving || aiBusy;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar oferta" : "Nova oferta"}</DialogTitle>
          <DialogDescription>
            É daqui que a IA tira os argumentos dos anúncios. Quanto mais concreto (números, provas, condições), menos genérico sai o criativo.
          </DialogDescription>
        </DialogHeader>

        {/* Preencher com IA */}
        <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <p className="eyebrow flex items-center gap-1.5 text-xs"><Sparkles className="h-3.5 w-3.5 text-primary" /> Preencher com IA</p>
          <div className="flex gap-2">
            <Input value={form.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value)} placeholder="https://pagina-de-vendas.com" disabled={busy} className="h-9" />
            <Button type="button" variant="outline" className="h-9 shrink-0 rounded-full" onClick={fillWithAI} disabled={busy}>
              {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Globe className="mr-1.5 h-4 w-4" /> Ler e preencher</>}
            </Button>
          </div>
          <Textarea value={aiText} onChange={(e) => setAiText(e.target.value)} rows={2} disabled={busy} placeholder="Ou cole aqui um texto sobre o produto (descrição, e-mail de lançamento, script de vendas…)" />
          <p className="text-[11px] text-muted-foreground">A leitura de URL usa a chave Firecrawl das Configurações. O texto colado funciona sem chave.</p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="essencial">Essencial</TabsTrigger>
            <TabsTrigger value="argumentos">Argumentos</TabsTrigger>
            <TabsTrigger value="oferta">Oferta</TabsTrigger>
            <TabsTrigger value="fotos">Fotos</TabsTrigger>
          </TabsList>

          <TabsContent value="essencial" className="space-y-4 pt-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Nome do produto / oferta *</Label>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Curso Tráfego do Zero — Turma 12" disabled={busy} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.productType} onValueChange={(v) => set("productType", v)} disabled={busy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRODUCT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Marca (guia de branding)</Label>
                <Select value={form.brandId || "none"} onValueChange={(v) => set("brandId", v === "none" ? null : v)} disabled={busy}>
                  <SelectTrigger><SelectValue placeholder="Sem marca" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem marca</SelectItem>
                    {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>O que é</Label>
              <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} placeholder="Em 1-2 frases: o que o cliente recebe." disabled={busy} />
            </div>
            <div className="space-y-1.5">
              <Label>Promessa central</Label>
              <Input value={form.promise} onChange={(e) => set("promise", e.target.value)} placeholder="A transformação que a oferta entrega, em 1 frase." disabled={busy} />
            </div>
            <div className="space-y-1.5">
              <Label>Para quem (público desta oferta)</Label>
              <Input value={form.targetAudience} onChange={(e) => set("targetAudience", e.target.value)} placeholder="Ex.: donos de clínica que dependem de indicação" disabled={busy} />
              <p className="text-[11px] text-muted-foreground">Se vazio, a IA usa o público-alvo da marca.</p>
            </div>
          </TabsContent>

          <TabsContent value="argumentos" className="space-y-4 pt-3">
            <Field label="Dores do público" hint="O que incomoda hoje. Vira gancho de ângulo 'dor'.">
              <ListInput value={form.painPoints} onChange={(v) => set("painPoints", v)} disabled={busy} placeholder="Ex.: agenda vazia na segunda-feira" />
            </Field>
            <Field label="Benefícios" hint="Resultado concreto, não característica.">
              <ListInput value={form.benefits} onChange={(v) => set("benefits", v)} disabled={busy} placeholder="Ex.: 3x mais agendamentos em 30 dias" />
            </Field>
            <Field label="Diferenciais" hint="Por que esta e não a do concorrente.">
              <ListInput value={form.differentiators} onChange={(v) => set("differentiators", v)} disabled={busy} placeholder="Ex.: suporte 1:1 por 90 dias" />
            </Field>
            <Field label="Objeções" hint="O que trava a compra. Vira ângulo 'objeção'.">
              <ListInput value={form.objections} onChange={(v) => set("objections", v)} disabled={busy} placeholder="Ex.: 'não tenho tempo'" />
            </Field>
            <Field label="Provas sociais" hint="Números, clientes, depoimentos REAIS. A IA só usa o que estiver aqui.">
              <ListInput value={form.socialProof} onChange={(v) => set("socialProof", v)} disabled={busy} placeholder="Ex.: +1.200 alunos, nota 4,9" />
            </Field>
          </TabsContent>

          <TabsContent value="oferta" className="space-y-4 pt-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Preço</Label>
                <Input value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="Ex.: 12x de R$ 97" disabled={busy} />
              </div>
              <div className="space-y-1.5">
                <Label>Prazo / escassez</Label>
                <Input value={form.deadline} onChange={(e) => set("deadline", e.target.value)} placeholder="Ex.: inscrições até domingo" disabled={busy} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Mecanismo da oferta</Label>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {OFFER_MECHANISMS.map((m) => (
                  <label key={m.value} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.offerMechanism.includes(m.value)}
                      onCheckedChange={(v) => set("offerMechanism", v === true ? [...form.offerMechanism, m.value] : form.offerMechanism.filter((x) => x !== m.value))}
                      disabled={busy}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Detalhes da oferta</Label>
              <Textarea value={form.offerDetails} onChange={(e) => set("offerDetails", e.target.value)} rows={2} placeholder="Ex.: de R$ 1.497 por R$ 697 + 3 bônus (planilha, aula extra, grupo)" disabled={busy} />
            </div>
            <div className="space-y-1.5">
              <Label>Garantia</Label>
              <Input value={form.guarantee} onChange={(e) => set("guarantee", e.target.value)} placeholder="Ex.: 7 dias, devolução integral" disabled={busy} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Botão (CTA da Meta)</Label>
                <Select value={form.ctaType} onValueChange={(v) => set("ctaType", v)} disabled={busy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{META_CTAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>URL de destino</Label>
                <Input value={form.destinationUrl} onChange={(e) => set("destinationUrl", e.target.value)} placeholder="https://…" disabled={busy} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Observações para a IA</Label>
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Ex.: nunca prometer resultado em dias; citar sempre o nome do método." disabled={busy} />
            </div>
          </TabsContent>

          <TabsContent value="fotos" className="space-y-3 pt-3">
            <p className="text-sm text-muted-foreground">
              Fotos reais do produto entram como referência na geração: a arte sai com o <span className="font-medium text-foreground">seu produto</span>, não com uma invenção da IA. Até 4 fotos (fundo limpo funciona melhor).
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {form.productImages.map((url, i) => (
                <div key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                  <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                  {!busy && (
                    <button type="button" aria-label="Remover foto" onClick={() => set("productImages", form.productImages.filter((u) => u !== url))} className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-foreground opacity-0 transition-opacity group-hover:opacity-100">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {form.productImages.length < 4 && (
                <button type="button" onClick={() => setFotosOpen(true)} disabled={busy} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:bg-accent">
                  <ImagePlus className="h-5 w-5" /> Adicionar
                </button>
              )}
            </div>
            <IncluirImagemDialog
              open={fotosOpen}
              onOpenChange={setFotosOpen}
              origens={["upload", "galeria"]}
              salvarNaGaleria
              titulo="Fotos do produto"
              descricao="Envie do computador ou escolha da galeria."
              onConfirmar={(urls) => {
                const next = Array.from(new Set([...form.productImages, ...urls.filter((u) => /^https?:\/\//.test(u))])).slice(0, 4);
                set("productImages", next);
              }}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button className="rounded-full" onClick={submit} disabled={busy}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando…</> : editing ? "Salvar alterações" : "Criar oferta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
