/**
 * CreativeSetView — um conjunto gerado: peças agrupadas por ângulo, filtro por
 * formato/status, exportação (CSV das copies + download das artes aprovadas).
 */
import { useMemo, useState } from "react";
import { ArrowLeft, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BrandProfile } from "@/lib/brand";
import { creativeFilename, creativesToCsv, setCsvFilename,type Creative, type CreativeOffer, type CreativeSet } from "@/lib/creatives";
import { angleForCreative, regenerateCreativeImage } from "@/lib/creative-engine";
import { CREATIVE_FORMATS, OBJECTIVES, formatSpec, type CreativeFormat } from "@/lib/meta-creative-specs";
import { useCreativesOfSet, useUpdateCreative } from "@/hooks/use-creatives";
import { CreativeCard } from "./CreativeCard";
import { cn } from "@/lib/utils";

interface CreativeSetViewProps {
  set: CreativeSet;
  offer: CreativeOffer | null;
  brand: BrandProfile | null;
  onBack: () => void;
}

function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + text], { type: mime }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function CreativeSetView({ set, offer, brand, onBack }: CreativeSetViewProps) {
  const { data: creatives = [], isLoading, refetch } = useCreativesOfSet(set.id);
  const update = useUpdateCreative(set.id);
  const [formatFilter, setFormatFilter] = useState<CreativeFormat | "all">("all");
  const [onlyApproved, setOnlyApproved] = useState(false);
  const [regen, setRegen] = useState<Record<string, boolean>>({});
  const [downloadingAll, setDownloadingAll] = useState(false);

  const filtered = useMemo(() => creatives.filter((c) =>
    (formatFilter === "all" || c.format === formatFilter) && (!onlyApproved || c.status === "approved")
  ), [creatives, formatFilter, onlyApproved]);

  const byAngle = useMemo(() => {
    const map = new Map<string, Creative[]>();
    for (const c of filtered) {
      const list = map.get(c.angleId) || [];
      list.push(c);
      map.set(c.angleId, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const approved = creatives.filter((c) => c.status === "approved").length;
  const objectiveLabel = OBJECTIVES.find((o) => o.value === set.objective)?.label || set.objective;

  const regenerate = async (c: Creative) => {
    if (!offer) { toast.error("A oferta deste conjunto não existe mais."); return; }
    setRegen((r) => ({ ...r, [c.id]: true }));
    try {
      await regenerateCreativeImage({ creative: c, offer, brand, options: set.options, angle: angleForCreative(c, set) });
      await refetch();
      toast.success("Nova arte gerada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao regenerar a arte");
    } finally { setRegen((r) => ({ ...r, [c.id]: false })); }
  };

  const exportCsv = () => {
    const items = onlyApproved ? creatives.filter((c) => c.status === "approved") : creatives;
    if (!items.length) { toast.error("Nada para exportar."); return; }
    downloadText(setCsvFilename(set.name), creativesToCsv(items));
  };

  const downloadAll = async () => {
    const items = (onlyApproved ? creatives.filter((c) => c.status === "approved") : creatives).filter((c) => c.imageUrl);
    if (!items.length) { toast.error("Nenhuma arte para baixar."); return; }
    setDownloadingAll(true);
    try {
      for (const c of items) {
        const res = await fetch(c.imageUrl!);
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = creativeFilename(c);
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        await new Promise((r) => setTimeout(r, 400)); // o browser bloqueia downloads em rajada
      }
      toast.success(`${items.length} arte(s) baixadas.`);
    } catch {
      toast.error("Alguns downloads falharam. Baixe individualmente pelo card.");
    } finally { setDownloadingAll(false); }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" className="rounded-full" onClick={onBack}><ArrowLeft className="mr-1.5 h-4 w-4" /> Conjuntos</Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full" onClick={exportCsv}><FileSpreadsheet className="mr-1.5 h-4 w-4" /> Exportar copies (CSV)</Button>
          <Button variant="outline" className="rounded-full" onClick={downloadAll} disabled={downloadingAll}>
            {downloadingAll ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />} Baixar artes
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <p className="eyebrow text-xs">Conjunto de criativos</p>
        <h2 className="text-xl font-semibold">{set.name}</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {offer && <span>{offer.name}</span>}
          {brand && <span>· marca {brand.name}</span>}
          <Badge variant="outline">{objectiveLabel}</Badge>
          <span>· {creatives.length} peças · {approved} aprovadas</span>
          {set.errorMessage && <Badge variant="destructive">{set.errorMessage}</Badge>}
        </div>
        {set.plan?.strategy_note && <p className="text-sm text-muted-foreground">{set.plan.strategy_note}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => setFormatFilter("all")} className={cn("rounded-full border px-3 py-1 text-xs", formatFilter === "all" ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-accent")}>Todos os formatos</button>
        {CREATIVE_FORMATS.filter((f) => set.formats.includes(f.id)).map((f) => (
          <button key={f.id} type="button" onClick={() => setFormatFilter(f.id)} className={cn("rounded-full border px-3 py-1 text-xs", formatFilter === f.id ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-accent")}>{f.label} {f.ratioLabel}</button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        <button type="button" onClick={() => setOnlyApproved((v) => !v)} className={cn("rounded-full border px-3 py-1 text-xs", onlyApproved ? "border-emerald-600 bg-emerald-600 text-white" : "border-border text-muted-foreground hover:bg-accent")}>Só aprovados</button>
      </div>

      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : byAngle.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma peça com esse filtro.</p>
      ) : (
        <div className="space-y-8">
          {byAngle.map(([angleId, items]) => (
            <section key={angleId} className="space-y-3">
              <div className="flex items-baseline gap-2">
                <h3 className="font-medium">{items[0].angleName}</h3>
                <span className="text-xs text-muted-foreground">{items.length} formato{items.length === 1 ? "" : "s"}</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((c) => (
                  <CreativeCard
                    key={c.id}
                    creative={c}
                    regenerating={!!regen[c.id]}
                    onPatch={(patch) => update.mutate({ id: c.id, patch })}
                    onRegenerate={() => regenerate(c)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Tamanhos exportados: {set.formats.map((f) => `${formatSpec(f).ratioLabel} (${formatSpec(f).width}×${formatSpec(f).height})`).join(" · ")}. Suba as artes e cole as copies no Gerenciador de Anúncios da Meta.
      </p>
    </div>
  );
}
