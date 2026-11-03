import { Trash2, AlignLeft, AlignCenter, AlignRight, Copy, ChevronsUp, ChevronsDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStudio } from "./StudioProvider";
import { FONT_OPTIONS } from "./types";

export function ElementInspector() {
  const { selectedEl, patchEl, delEl, duplicateEl, reorderEl, slide, patchSlide, currentSlide } = useStudio();

  if (!selectedEl) {
    return (
      <div className="space-y-2 card-premium p-3">
        <Label className="text-xs">Fundo do slide</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            defaultValue="#e85600"
            onChange={(e) => patchSlide(currentSlide, { bg: e.target.value, bgImage: undefined })}
            className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent p-0.5"
          />
          {slide?.bgImage && (
            <Button variant="outline" size="sm" onClick={() => patchSlide(currentSlide, { bgImage: undefined })}>Limpar fundo</Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">Clique num elemento para editar (Shift+clique p/ vários). Arraste para mover; setas para ajustar; Ctrl+C/V copia, Del apaga.</p>
      </div>
    );
  }

  const e = selectedEl;
  return (
    <div className="space-y-3 card-premium p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium capitalize">{e.type}</span>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Duplicar" onClick={() => duplicateEl(e.id)}><Copy className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Excluir" onClick={() => delEl(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      {/* Camadas (z-order) */}
      <div className="flex items-center gap-1">
        <Label className="mr-1 text-[11px] text-foreground">Camada</Label>
        <Button variant="outline" size="icon" className="h-7 w-7" title="Trazer para frente" onClick={() => reorderEl(e.id, "front")}><ChevronsUp className="h-3.5 w-3.5" /></Button>
        <Button variant="outline" size="icon" className="h-7 w-7" title="Avançar" onClick={() => reorderEl(e.id, "forward")}><ArrowUp className="h-3.5 w-3.5" /></Button>
        <Button variant="outline" size="icon" className="h-7 w-7" title="Recuar" onClick={() => reorderEl(e.id, "backward")}><ArrowDown className="h-3.5 w-3.5" /></Button>
        <Button variant="outline" size="icon" className="h-7 w-7" title="Enviar para trás" onClick={() => reorderEl(e.id, "back")}><ChevronsDown className="h-3.5 w-3.5" /></Button>
      </div>

      {e.type === "text" && (
        <>
          <Textarea value={e.text} onChange={(ev) => patchEl(e.id, { text: ev.target.value })} rows={2} />
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-[11px]">Tamanho</Label><Input type="number" value={e.fontSize} onChange={(ev) => patchEl(e.id, { fontSize: Number(ev.target.value) })} /></div>
            <div><Label className="text-[11px]">Cor</Label><Input type="color" value={e.color} onChange={(ev) => patchEl(e.id, { color: ev.target.value })} className="h-9 p-1" /></div>
          </div>
          <div>
            <Label className="text-[11px]">Fonte</Label>
            <Select value={e.fontFamily || "default"} onValueChange={(v) => patchEl(e.id, { fontFamily: v === "default" ? undefined : v })}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Padrão" /></SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((f) => <SelectItem key={f.label} value={f.value} className="text-xs" style={{ fontFamily: f.value !== "default" ? f.value : undefined }}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-[11px]">Espaçamento</Label><Input type="number" value={e.letterSpacing ?? 0} onChange={(ev) => patchEl(e.id, { letterSpacing: Number(ev.target.value) })} /></div>
            <div><Label className="text-[11px]">Entrelinha</Label><Input type="number" step="0.1" value={e.lineHeight ?? 1.15} onChange={(ev) => patchEl(e.id, { lineHeight: Number(ev.target.value) })} /></div>
          </div>
          <div className="flex gap-1">
            {(["left", "center", "right"] as const).map((a) => (
              <Button key={a} variant={e.align === a ? "default" : "outline"} size="icon" className={`h-7 w-7 ${e.align === a ? "bg-primary" : ""}`} onClick={() => patchEl(e.id, { align: a })}>
                {a === "left" ? <AlignLeft className="h-3.5 w-3.5" /> : a === "center" ? <AlignCenter className="h-3.5 w-3.5" /> : <AlignRight className="h-3.5 w-3.5" />}
              </Button>
            ))}
            <Button variant={e.weight === 700 ? "default" : "outline"} size="sm" className={`h-7 ${e.weight === 700 ? "bg-primary" : ""}`} onClick={() => patchEl(e.id, { weight: e.weight === 700 ? 400 : 700 })}>B</Button>
          </div>
          {/* contorno */}
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-[11px]">Contorno (px)</Label><Input type="number" value={e.strokeWidth ?? 0} onChange={(ev) => patchEl(e.id, { strokeWidth: Number(ev.target.value) })} /></div>
            <div><Label className="text-[11px]">Cor contorno</Label><Input type="color" value={e.strokeColor || "#000000"} onChange={(ev) => patchEl(e.id, { strokeColor: ev.target.value })} className="h-9 p-1" /></div>
          </div>
        </>
      )}

      {e.type === "image" && (
        <>
          <Label className="text-[11px]">URL da imagem</Label>
          <Input value={e.src} onChange={(ev) => patchEl(e.id, { src: ev.target.value })} placeholder="https://…" />
          <div><Label className="text-[11px]">Arredondamento</Label><Input type="number" value={e.radius} onChange={(ev) => patchEl(e.id, { radius: Number(ev.target.value) })} /></div>
        </>
      )}

      {e.type === "shape" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-[11px]">Cor</Label><Input type="color" value={e.bg} onChange={(ev) => patchEl(e.id, { bg: ev.target.value })} className="h-9 p-1" /></div>
            <div><Label className="text-[11px]">Arredond.</Label><Input type="number" value={e.radius} onChange={(ev) => patchEl(e.id, { radius: Number(ev.target.value) })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-[11px]">Contorno (px)</Label><Input type="number" value={e.strokeWidth ?? 0} onChange={(ev) => patchEl(e.id, { strokeWidth: Number(ev.target.value) })} /></div>
            <div><Label className="text-[11px]">Cor contorno</Label><Input type="color" value={e.strokeColor || "#000000"} onChange={(ev) => patchEl(e.id, { strokeColor: ev.target.value })} className="h-9 p-1" /></div>
          </div>
        </>
      )}

      {/* sombra (todos os tipos) */}
      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-foreground">Sombra</Label>
        <Switch checked={!!e.shadow} onCheckedChange={(v) => patchEl(e.id, { shadow: v })} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-[11px]">Largura</Label><Input type="number" value={e.w} onChange={(ev) => patchEl(e.id, { w: Number(ev.target.value) })} /></div>
        <div><Label className="text-[11px]">Altura</Label><Input type="number" value={e.h} onChange={(ev) => patchEl(e.id, { h: Number(ev.target.value) })} /></div>
      </div>
    </div>
  );
}
