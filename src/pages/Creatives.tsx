/**
 * /criativos — módulo de CRIATIVOS para Meta Ads (separado do Studio de posts).
 *
 * Fluxo: cadastrar a OFERTA (offer canvas, com preenchimento por IA a partir da
 * página de vendas) → gerar um CONJUNTO (ângulos × formatos, marca como guia de
 * branding e voz) → revisar/aprovar/exportar as peças.
 */
import { useMemo, useState } from "react";
import { Loader2, Megaphone, Package, Pencil, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useBrands } from "@/hooks/use-brands";
import { useArchiveOffer, useCreativeSets, useDeleteSet, useOffers, useSaveOffer } from "@/hooks/use-creatives";
import type { CreativeOffer, CreativeSet, OfferInput } from "@/lib/creatives";
import { OBJECTIVES, PRODUCT_TYPES, formatSpec } from "@/lib/meta-creative-specs";
import { OfferDialog } from "@/components/creatives/OfferDialog";
import { CreativeWizard } from "@/components/creatives/CreativeWizard";
import { CreativeSetView } from "@/components/creatives/CreativeSetView";

type View = { kind: "list" } | { kind: "wizard"; offerId?: string } | { kind: "set"; set: CreativeSet };

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }); } catch { return ""; }
}

export default function Creatives() {
  const { brands, defaultBrand } = useBrands();
  const offersQ = useOffers();
  const setsQ = useCreativeSets();
  const saveOffer = useSaveOffer();
  const archive = useArchiveOffer();
  const removeSet = useDeleteSet();

  const offers = useMemo(() => offersQ.data || [], [offersQ.data]);
  const sets = useMemo(() => setsQ.data || [], [setsQ.data]);

  const [view, setView] = useState<View>({ kind: "list" });
  const [tab, setTab] = useState<"conjuntos" | "ofertas">("conjuntos");
  const [offerDialog, setOfferDialog] = useState<{ open: boolean; editing: CreativeOffer | null }>({ open: false, editing: null });
  const [confirmArchive, setConfirmArchive] = useState<CreativeOffer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CreativeSet | null>(null);

  const offerById = useMemo(() => new Map(offers.map((o) => [o.id, o])), [offers]);
  const brandById = useMemo(() => new Map(brands.map((b) => [b.id, b])), [brands]);

  const onSaveOffer = async (input: OfferInput) => {
    try {
      await saveOffer.mutateAsync({ id: offerDialog.editing?.id, input });
      toast.success(offerDialog.editing ? "Oferta atualizada." : "Oferta criada.");
      setOfferDialog({ open: false, editing: null });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar a oferta");
    }
  };

  if (view.kind === "wizard") {
    return (
      <CreativeWizard
        offers={offers}
        brands={brands}
        initialOfferId={view.offerId}
        onCancel={() => setView({ kind: "list" })}
        onDone={(set) => { setsQ.refetch(); setView({ kind: "set", set }); }}
      />
    );
  }

  if (view.kind === "set") {
    const offer = offerById.get(view.set.offerId) || null;
    const brand = (view.set.brandId && brandById.get(view.set.brandId)) || offer?.brandId && brandById.get(offer.brandId) || null;
    return <CreativeSetView set={view.set} offer={offer} brand={brand} onBack={() => { setsQ.refetch(); setView({ kind: "list" }); setTab("conjuntos"); }} />;
  }

  const loading = offersQ.isLoading || setsQ.isLoading;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow inline-flex items-center gap-1.5 text-xs"><Megaphone className="h-3.5 w-3.5 text-primary" /> Criativos</p>
          <h1 className="mt-1 text-h2Sm md:text-h2 text-ink">Anúncios para a <span className="text-gradient-bilhon">Meta</span></h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Cadastre a oferta uma vez; a IA cria vários ângulos com copy pronta (título, texto, descrição, botão) e artes nos formatos de Feed e Stories, usando a marca como guia de branding.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full" onClick={() => setOfferDialog({ open: true, editing: null })}><Plus className="mr-1.5 h-4 w-4" /> Nova oferta</Button>
          <Button className="rounded-full" onClick={() => { if (!offers.length) { toast.info("Cadastre uma oferta primeiro."); setOfferDialog({ open: true, editing: null }); return; } setView({ kind: "wizard" }); }}>
            <Wand2 className="mr-1.5 h-4 w-4" /> Gerar criativos
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : offers.length === 0 ? (
        <div className="card-premium flex flex-col items-center gap-3 p-10 text-center">
          <Package className="h-8 w-8 text-primary" />
          <h2 className="text-lg font-semibold">Comece pela oferta</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            A oferta é a abstração do que você vende: promessa, dores, benefícios, provas e condições. Cole a URL da página de vendas e a IA preenche tudo.
          </p>
          <Button className="rounded-full" onClick={() => setOfferDialog({ open: true, editing: null })}><Sparkles className="mr-1.5 h-4 w-4" /> Cadastrar a primeira oferta</Button>
        </div>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as "conjuntos" | "ofertas")}>
          <TabsList>
            <TabsTrigger value="conjuntos">Conjuntos ({sets.length})</TabsTrigger>
            <TabsTrigger value="ofertas">Ofertas ({offers.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="conjuntos" className="pt-4">
            {sets.length === 0 ? (
              <div className="card-premium flex flex-col items-center gap-3 p-10 text-center">
                <Wand2 className="h-8 w-8 text-primary" />
                <h2 className="text-lg font-semibold">Nenhum conjunto ainda</h2>
                <p className="max-w-md text-sm text-muted-foreground">Escolha uma oferta, o objetivo e os formatos. A IA propõe os ângulos e você revisa a copy antes das artes.</p>
                <Button className="rounded-full" onClick={() => setView({ kind: "wizard" })}><Wand2 className="mr-1.5 h-4 w-4" /> Gerar criativos</Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sets.map((s) => {
                  const offer = offerById.get(s.offerId);
                  const objective = OBJECTIVES.find((o) => o.value === s.objective)?.label || s.objective;
                  return (
                    <div key={s.id} className="card-premium flex flex-col gap-3 p-4">
                      <button type="button" className="space-y-1 text-left" onClick={() => setView({ kind: "set", set: s })}>
                        <p className="font-medium leading-snug">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{offer?.name || "Oferta removida"} · {fmtDate(s.createdAt)}</p>
                      </button>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline">{objective}</Badge>
                        <Badge variant="outline">{s.angleCount} ângulo{s.angleCount === 1 ? "" : "s"}</Badge>
                        {s.formats.map((f) => <Badge key={f} variant="secondary">{formatSpec(f).ratioLabel}</Badge>)}
                        {s.status === "failed" && <Badge variant="destructive">Falhou</Badge>}
                        {s.status === "generating" && <Badge variant="secondary">Gerando…</Badge>}
                      </div>
                      <div className="mt-auto flex items-center gap-1">
                        <Button size="sm" className="rounded-full" onClick={() => setView({ kind: "set", set: s })}>Abrir</Button>
                        <Button size="sm" variant="ghost" className="ml-auto h-8 w-8 p-0 text-muted-foreground hover:text-destructive" title="Excluir conjunto" onClick={() => setConfirmDelete(s)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="ofertas" className="pt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((o) => {
                const brand = o.brandId ? brandById.get(o.brandId) : null;
                const type = PRODUCT_TYPES.find((t) => t.value === o.productType)?.label || o.productType;
                const setsCount = sets.filter((s) => s.offerId === o.id).length;
                return (
                  <div key={o.id} className="card-premium flex flex-col gap-3 p-4">
                    <div className="flex items-start gap-3">
                      {o.productImages[0] ? (
                        <img src={o.productImages[0]} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-border object-cover" />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground"><Package className="h-5 w-5" /></div>
                      )}
                      <div className="min-w-0 space-y-0.5">
                        <p className="truncate font-medium">{o.name}</p>
                        <p className="text-xs text-muted-foreground">{type}{brand ? ` · ${brand.name}` : ""}</p>
                        {o.promise && <p className="line-clamp-2 text-xs text-muted-foreground">{o.promise}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                      <span>{o.benefits.length} benefícios</span>·<span>{o.socialProof.length} provas</span>·<span>{o.productImages.length} fotos</span>·<span>{setsCount} conjunto{setsCount === 1 ? "" : "s"}</span>
                    </div>
                    <div className="mt-auto flex items-center gap-1">
                      <Button size="sm" className="rounded-full" onClick={() => setView({ kind: "wizard", offerId: o.id })}><Wand2 className="mr-1 h-3.5 w-3.5" /> Gerar</Button>
                      <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setOfferDialog({ open: true, editing: o })}><Pencil className="mr-1 h-3.5 w-3.5" /> Editar</Button>
                      <Button size="sm" variant="ghost" className="ml-auto h-8 w-8 p-0 text-muted-foreground hover:text-destructive" title="Arquivar oferta" onClick={() => setConfirmArchive(o)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      )}

      <OfferDialog
        open={offerDialog.open}
        onOpenChange={(v) => setOfferDialog((d) => ({ ...d, open: v }))}
        brands={brands}
        defaultBrandId={defaultBrand?.id || null}
        editing={offerDialog.editing}
        saving={saveOffer.isPending}
        onSave={onSaveOffer}
      />

      <AlertDialog open={!!confirmArchive} onOpenChange={(v) => { if (!v) setConfirmArchive(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar "{confirmArchive?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>A oferta some da lista, mas os conjuntos já gerados continuam acessíveis.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (!confirmArchive) return; try { await archive.mutateAsync(confirmArchive.id); toast.success("Oferta arquivada."); } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); } setConfirmArchive(null); }}>Arquivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => { if (!v) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir o conjunto "{confirmDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>As peças e copies deste conjunto são removidas. As artes salvas na Galeria permanecem.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (!confirmDelete) return; try { await removeSet.mutateAsync(confirmDelete.id); toast.success("Conjunto excluído."); } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); } setConfirmDelete(null); }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
