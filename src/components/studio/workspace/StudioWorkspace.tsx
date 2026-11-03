import { useEffect, useState } from "react";
import {
  Sparkles, Undo2, Redo2, Send, Building2, PenSquare, LayoutGrid, Film, Image as ImageIcon,
  PanelLeft, Quote, ArrowLeft, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useBrands } from "@/hooks/use-brands";
import { StudioProvider, useStudio } from "./StudioProvider";
import { DesignCanvas } from "./DesignCanvas";
import { ElementInspector } from "./ElementInspector";
import { Copilot } from "./Copilot";
import { AssetsRail } from "./AssetsRail";
import { FlowBar } from "./FlowBar";
import { PublishDrawer } from "./PublishDrawer";
import type { StudioDoc, StudioFormat } from "./types";

const FORMATS: { value: StudioFormat; label: string; icon: typeof PenSquare }[] = [
  { value: "post", label: "Post", icon: PenSquare },
  { value: "card", label: "Card (estilo X)", icon: Quote },
  { value: "carousel", label: "Carrossel", icon: LayoutGrid },
  { value: "image", label: "Imagem", icon: ImageIcon },
  { value: "video", label: "Vídeo", icon: Film },
];

export function StudioWorkspace({ initial, onBack }: { initial?: StudioDoc; onBack?: () => void }) {
  return (
    <StudioProvider initial={initial}>
      <WorkspaceInner onBack={onBack} />
    </StudioProvider>
  );
}

function FormatPicker() {
  const { doc, setFormat } = useStudio();
  return (
    <div>
      <p className="eyebrow mb-2">Formato</p>
      <div className="grid gap-1.5">
        {FORMATS.map((f) => {
          const on = doc.format === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setFormat(f.value)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                on ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"
              }`}
            >
              <f.icon className="h-4 w-4" /> {f.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LeftRailContent({ brandName, brandHandle }: { brandName?: string; brandHandle?: string }) {
  return (
    <div className="flex flex-col gap-4">
      <FormatPicker />
      <div className="card-premium p-3">
        <p className="eyebrow">Marca-base</p>
        <p className="truncate text-sm font-medium">{brandName || "Sem marca"}</p>
        {brandHandle && <p className="truncate text-xs text-muted-foreground">{brandHandle}</p>}
      </div>
      <AssetsRail />
    </div>
  );
}

function RightRailContent() {
  return (
    <div className="flex flex-col gap-3">
      <Copilot />
      <ElementInspector />
    </div>
  );
}

function WorkspaceInner({ onBack }: { onBack?: () => void }) {
  const { brands, defaultBrand } = useBrands();
  const { doc, set, undo, redo, canUndo, canRedo } = useStudio();
  const [publishOpen, setPublishOpen] = useState(false);

  useEffect(() => {
    if (!doc.brandId && defaultBrand) set({ brandId: defaultBrand.id }, false);
  }, [defaultBrand, doc.brandId, set]);

  const brand = brands.find((b) => b.id === doc.brandId) || null;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col md:h-screen">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-4">
        {onBack && (
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onBack} title="Trocar modo"><ArrowLeft className="h-4 w-4" /></Button>
        )}
        {/* mobile: abrir rail de ferramentas */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 lg:hidden"><PanelLeft className="h-4 w-4" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 overflow-y-auto">
            <SheetHeader><SheetTitle>Ferramentas</SheetTitle></SheetHeader>
            <div className="mt-4"><LeftRailContent brandName={brand?.name} brandHandle={brand?.handle} /></div>
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2 font-semibold">
          <Sparkles className="h-5 w-5 text-primary" /> <span className="hidden sm:inline">Studio</span>
        </div>

        <Select value={doc.brandId ?? "none"} onValueChange={(v) => set({ brandId: v === "none" ? null : v })}>
          <SelectTrigger className="ml-1 h-9 w-[150px] sm:w-[200px]">
            <div className="flex min-w-0 items-center gap-2">
              {brand?.logo_url ? <img src={brand.logo_url} alt="" className="h-5 w-5 rounded object-cover" /> : <Building2 className="h-4 w-4 shrink-0 text-primary" />}
              <SelectValue placeholder="Marca" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem marca</SelectItem>
            {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}{b.is_default && <Star className="ml-1 inline h-3 w-3 fill-primary text-primary" />}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={undo} disabled={!canUndo} title="Desfazer"><Undo2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={redo} disabled={!canRedo} title="Refazer"><Redo2 className="h-4 w-4" /></Button>
          {/* mobile: abrir copiloto */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9 xl:hidden"><Sparkles className="h-4 w-4 text-primary" /></Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
              <SheetHeader><SheetTitle>Copiloto IA</SheetTitle></SheetHeader>
              <div className="mt-4"><RightRailContent /></div>
            </SheetContent>
          </Sheet>
          <Button className="ml-1 bg-gradient-to-r from-primary/90 via-primary/60 to-primary/30" onClick={() => setPublishOpen(true)}>
            <Send className="mr-2 h-4 w-4" /> <span className="hidden sm:inline">Postar / Agendar</span>
          </Button>
        </div>
      </header>

      {/* Middle */}
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-border p-3 lg:block">
          <LeftRailContent brandName={brand?.name} brandHandle={brand?.handle} />
        </aside>

        <main className="min-w-0 flex-1 overflow-hidden bg-muted/30">
          <DesignCanvas />
        </main>

        <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-border p-3 xl:block">
          <RightRailContent />
        </aside>
      </div>

      <FlowBar onPublish={() => setPublishOpen(true)} />
      <PublishDrawer open={publishOpen} onOpenChange={setPublishOpen} />
    </div>
  );
}
