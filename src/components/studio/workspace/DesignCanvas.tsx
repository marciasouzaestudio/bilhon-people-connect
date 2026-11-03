import { useEffect, useRef, useState, useCallback } from "react";
import {
  Type, Image as ImageIcon, Square, Plus, Copy, Trash2, ChevronLeft, ChevronRight, Film,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBrands } from "@/hooks/use-brands";
import { useStudio, blankSlide } from "./StudioProvider";
import { CANVAS_W, CANVAS_H, EXPORT_W, EXPORT_H, SNAP, uid, type El, type Slide } from "./types";

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(head)?.[1] || "image/png";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
export { dataUrlToBlob };

export function DesignCanvas() {
  const {
    doc, slide, currentSlide, selectedElId, selectedElIds, selectedEl,
    setSlides, patchSlide, patchEls, duplicateEl,
    addEl, pushHistory, select, setCurrentSlide, registerExporter, undo, redo,
  } = useStudio();
  const { brands } = useBrands();
  const brand = brands.find((b) => b.id === doc.brandId) || null;
  const c1 = brand?.colors?.[0] || "var(--bl-accent)";
  const c2 = brand?.colors?.[1] || "var(--bl-accent)";
  const accent = brand?.colors?.[2] || "#ffffff";

  const [exporting, setExporting] = useState(false);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const drag = useRef<{
    sx: number; sy: number; primaryId: string; pw: number; ph: number;
    items: { id: string; ex: number; ey: number }[]; tx: number[]; ty: number[];
  } | null>(null);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const clip = useRef<El | null>(null);

  // ── escala responsiva: encolhe o canvas (360px) para caber em telas pequenas ──
  const fitRef = useRef<HTMLDivElement | null>(null);
  const scaleRef = useRef(1);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = fitRef.current;
    if (!el) return;
    const compute = () => {
      const avail = el.clientWidth;
      const s = avail > 0 ? Math.min(1, avail / CANVAS_W) : 1;
      scaleRef.current = s;
      setScale(s);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isCarousel = doc.format === "carousel";
  const isVideo = doc.format === "video";

  // ── drag move (mouse + toque; escala + snap/guias + grupo) ──
  useEffect(() => {
    const point = (ev: MouseEvent | TouchEvent) => {
      const t = (ev as TouchEvent).touches?.[0];
      return t ? { x: t.clientX, y: t.clientY } : { x: (ev as MouseEvent).clientX, y: (ev as MouseEvent).clientY };
    };
    const snap = (anchors: [number, number][], targets: number[]): { pos: number | null; guide: number | null } => {
      for (const [pos, off] of anchors) {
        for (const t of targets) {
          if (Math.abs(pos - t) <= SNAP) return { pos: t - off, guide: t };
        }
      }
      return { pos: null, guide: null };
    };
    const move = (ev: MouseEvent | TouchEvent) => {
      const d = drag.current;
      if (!d) return;
      if (ev.type === "touchmove" && ev.cancelable) ev.preventDefault();
      const p = point(ev);
      const s = scaleRef.current || 1;
      const prim = d.items.find((it) => it.id === d.primaryId)!;
      let nx = prim.ex + (p.x - d.sx) / s;
      let ny = prim.ey + (p.y - d.sy) / s;
      // snap das âncoras (esquerda/centro/direita) e (topo/centro/base)
      const sx = snap([[nx, 0], [nx + d.pw / 2, d.pw / 2], [nx + d.pw, d.pw]], d.tx);
      const sy = snap([[ny, 0], [ny + d.ph / 2, d.ph / 2], [ny + d.ph, d.ph]], d.ty);
      if (sx.pos !== null) nx = sx.pos;
      if (sy.pos !== null) ny = sy.pos;
      const dx = nx - prim.ex, dy = ny - prim.ey;
      patchEls(d.items.map((it) => ({ id: it.id, partial: { x: Math.round(it.ex + dx), y: Math.round(it.ey + dy) } })), false);
      setGuides({ x: sx.guide, y: sy.guide });
    };
    const up = () => { if (drag.current) { drag.current = null; setGuides({ x: null, y: null }); } };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
  }, [patchEls]);

  const beginDrag = (clientX: number, clientY: number, e: El, additive: boolean) => {
    if (additive) { select(e.id, true); return; } // shift/ctrl: alterna seleção, sem arrastar
    const groupIds = selectedElIds.includes(e.id) && selectedElIds.length > 1 ? selectedElIds : [e.id];
    if (!selectedElIds.includes(e.id)) select(e.id);
    pushHistory();
    const els = slide.els;
    const items = groupIds
      .map((id) => { const el = els.find((x) => x.id === id); return el ? { id, ex: el.x, ey: el.y } : null; })
      .filter(Boolean) as { id: string; ex: number; ey: number }[];
    const others = els.filter((x) => !groupIds.includes(x.id));
    const tx = [0, CANVAS_W / 2, CANVAS_W];
    const ty = [0, CANVAS_H / 2, CANVAS_H];
    others.forEach((o) => { tx.push(o.x, o.x + o.w / 2, o.x + o.w); ty.push(o.y, o.y + o.h / 2, o.y + o.h); });
    drag.current = { sx: clientX, sy: clientY, primaryId: e.id, pw: e.w, ph: e.h, items, tx, ty };
  };

  // ── atalhos de teclado ──
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const tgt = ev.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) return;
      const meta = ev.ctrlKey || ev.metaKey;
      const k = ev.key.toLowerCase();
      if (meta && k === "z") { ev.preventDefault(); if (ev.shiftKey) redo(); else undo(); return; }
      if (meta && k === "y") { ev.preventDefault(); redo(); return; }
      if (meta && k === "d") { ev.preventDefault(); if (selectedElId) duplicateEl(selectedElId); return; }
      if (meta && k === "c") { if (selectedEl) clip.current = selectedEl; return; }
      if (meta && k === "v") { if (clip.current) { ev.preventDefault(); addEl({ ...clip.current, id: uid(), x: (clip.current.x || 0) + 16, y: (clip.current.y || 0) + 16 }); } return; }
      if ((ev.key === "Delete" || ev.key === "Backspace") && selectedElIds.length) {
        ev.preventDefault(); pushHistory();
        setSlides(doc.slides.map((s, i) => (i === currentSlide ? { ...s, els: s.els.filter((e) => !selectedElIds.includes(e.id)) } : s)));
        select(null);
        return;
      }
      if (ev.key.startsWith("Arrow") && selectedElIds.length) {
        ev.preventDefault();
        const step = ev.shiftKey ? 10 : 1;
        const dx = ev.key === "ArrowLeft" ? -step : ev.key === "ArrowRight" ? step : 0;
        const dy = ev.key === "ArrowUp" ? -step : ev.key === "ArrowDown" ? step : 0;
        patchEls(selectedElIds.map((id) => { const el = slide.els.find((x) => x.id === id); return el ? { id, partial: { x: el.x + dx, y: el.y + dy } } : null; }).filter(Boolean) as { id: string; partial: Partial<El> }[]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedElId, selectedEl, selectedElIds, slide, doc.slides, currentSlide, undo, redo, duplicateEl, addEl, patchEls, pushHistory, setSlides, select]);

  // ── export (registra no provider) ──
  const exporter = useCallback(async (): Promise<string[]> => {
    if (isVideo) return doc.videoUrl ? [doc.videoUrl] : [];
    const { default: html2canvas } = await import("html2canvas"); // carregado sob demanda
    setExporting(true);
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 80)));
    const urls: string[] = [];
    try {
      for (let i = 0; i < (slideRefs.current.length || 0); i++) {
        const node = slideRefs.current[i];
        if (!node) continue;
        const canvas = await html2canvas(node, {
          useCORS: true,
          backgroundColor: null,
          scale: EXPORT_W / CANVAS_W,
          width: CANVAS_W,
          height: CANVAS_H,
        });
        urls.push(canvas.toDataURL("image/png"));
      }
    } finally {
      setExporting(false);
    }
    return urls;
  }, [isVideo, doc.videoUrl]);

  useEffect(() => {
    registerExporter(exporter);
    return () => registerExporter(null);
  }, [exporter, registerExporter]);

  // ── slide ops ──
  const addSlide = () => { setSlides([...doc.slides, blankSlide(c1, c2, accent)]); setCurrentSlide(doc.slides.length); };
  const dupSlide = () => {
    const copy: Slide = JSON.parse(JSON.stringify(doc.slides[currentSlide]));
    copy.els = copy.els.map((e) => ({ ...e, id: uid() }));
    setSlides([...doc.slides.slice(0, currentSlide + 1), copy, ...doc.slides.slice(currentSlide + 1)]);
    setCurrentSlide(currentSlide + 1);
  };
  const delSlide = () => {
    if (doc.slides.length === 1) return;
    setSlides(doc.slides.filter((_, i) => i !== currentSlide));
    setCurrentSlide(Math.max(0, currentSlide - 1));
  };

  const addElement = (type: El["type"]) => {
    const base: El = type === "text"
      ? { id: uid(), type, x: 40, y: 180, w: 320, h: 70, text: "Novo texto", fontSize: 24, color: accent, weight: 600, align: "left" }
      : type === "image"
      ? { id: uid(), type, x: 130, y: 130, w: 140, h: 140, src: "", radius: 12 }
      : { id: uid(), type, x: 130, y: 150, w: 140, h: 100, bg: accent, radius: 12, opacity: 1 };
    addEl(base);
  };

  const PRESETS = [
    { name: "Clean", bg: "#ffffff", text: "#111111" },
    { name: "Dark", bg: "#0b0b12", text: "#ffffff" },
    { name: "Marca", bg: `linear-gradient(135deg, ${c1}, ${c2})`, text: accent },
  ];
  const applyPreset = (p: { bg: string; text: string }) =>
    patchSlide(currentSlide, {
      bg: p.bg, bgImage: undefined,
      els: slide.els.map((e) => (e.type === "text" ? { ...e, color: p.text } : e)),
    });

  // ── render ──
  if (isVideo) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        {doc.videoUrl ? (
          <video src={doc.videoUrl} controls className="max-h-full max-w-full rounded-xl border border-border shadow-lg" />
        ) : (
          <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
            <Film className="h-12 w-12 opacity-40" />
            <p className="max-w-xs text-sm">Use o copiloto à direita para gerar um vídeo com Gemini Omni Flash e a marca.</p>
          </div>
        )}
      </div>
    );
  }

  const renderSlide = (s: Slide, i: number, exportMode: boolean) => (
    <div
      key={i}
      ref={(el) => { slideRefs.current[i] = el; }}
      onMouseDown={() => select(null)}
      className={`relative overflow-hidden rounded-xl ${exportMode ? "absolute left-0 top-0" : "shadow-lg"}`}
      style={{
        width: CANVAS_W, height: CANVAS_H,
        background: s.bgImage ? undefined : s.bg,
        display: exportMode ? "block" : i === currentSlide ? "block" : "none",
      }}
    >
      {s.bgImage && <img src={s.bgImage} crossOrigin="anonymous" alt="" className="absolute inset-0 h-full w-full object-cover" />}
      {s.els.map((e) => (
        <div
          key={e.id}
          onMouseDown={(ev) => { if (exportMode) return; ev.stopPropagation(); beginDrag(ev.clientX, ev.clientY, e, ev.shiftKey || ev.ctrlKey || ev.metaKey); }}
          onTouchStart={(ev) => { if (exportMode) return; ev.stopPropagation(); const t = ev.touches[0]; if (t) beginDrag(t.clientX, t.clientY, e, false); }}
          className={`absolute ${exportMode ? "" : "cursor-move"} ${!exportMode && selectedElIds.includes(e.id) ? "ring-2 ring-primary" : ""}`}
          style={{ left: e.x, top: e.y, width: e.w, height: e.h, touchAction: exportMode ? undefined : "none" }}
        >
          {e.type === "text" && (
            <span style={{
              fontSize: e.fontSize, color: e.color, fontWeight: e.weight, textAlign: e.align,
              fontFamily: e.fontFamily || undefined,
              letterSpacing: e.letterSpacing ? `${e.letterSpacing}px` : undefined,
              lineHeight: e.lineHeight ?? 1.15,
              display: "block", width: "100%",
              textShadow: e.shadow ? "0 2px 8px rgba(0,0,0,0.45)" : undefined,
              WebkitTextStroke: e.strokeWidth ? `${e.strokeWidth}px ${e.strokeColor || "#000000"}` : undefined,
            }}>{e.text}</span>
          )}
          {e.type === "image" && (e.src
            ? <img src={e.src} crossOrigin="anonymous" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: e.radius, boxShadow: e.shadow ? "0 6px 20px rgba(0,0,0,0.35)" : undefined }} />
            : <div className="flex h-full w-full items-center justify-center rounded bg-black/20 text-[10px] text-white/70">imagem</div>)}
          {e.type === "shape" && <div style={{ width: "100%", height: "100%", background: e.bg, borderRadius: e.radius, opacity: e.opacity, border: e.strokeWidth ? `${e.strokeWidth}px solid ${e.strokeColor || "#000000"}` : undefined, boxShadow: e.shadow ? "0 6px 20px rgba(0,0,0,0.35)" : undefined }} />}
        </div>
      ))}
      {/* marca: logo + handle — só em slides "chapados" (sem arte de fundo) e fora do card,
          pra não duplicar a marca em imagens já desenhadas (arte/auto/gpt-image-2). */}
      {!s.bgImage && doc.format !== "card" && (
        <>
          {brand?.logo_url && <img src={brand.logo_url} crossOrigin="anonymous" alt="" className="absolute left-3 top-3 h-6 w-6 rounded object-cover" />}
          {(brand?.handle || brand?.name) && (
            <div className="absolute bottom-3 left-3 text-[11px] font-medium" style={{ color: accent, opacity: 0.92 }}>{brand?.handle || brand?.name}</div>
          )}
        </>
      )}
      {/* guias de alinhamento (snap) */}
      {!exportMode && i === currentSlide && guides.x !== null && (
        <div className="pointer-events-none absolute bottom-0 top-0" style={{ left: guides.x, width: 1, background: "var(--bl-accent)" }} />
      )}
      {!exportMode && i === currentSlide && guides.y !== null && (
        <div className="pointer-events-none absolute left-0 right-0" style={{ top: guides.y, height: 1, background: "var(--bl-accent)" }} />
      )}
    </div>
  );

  return (
    <div className="flex h-full w-full flex-col items-center gap-4 overflow-auto p-6">
      {/* presets */}
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <span className="text-[11px] text-foreground/70">Tema:</span>
        {PRESETS.map((p) => (
          <Button key={p.name} variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyPreset(p)}>{p.name}</Button>
        ))}
        <span className="mx-1 text-border">|</span>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addElement("text")}><Type className="mr-1 h-3.5 w-3.5" />Texto</Button>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addElement("image")}><ImageIcon className="mr-1 h-3.5 w-3.5" />Imagem</Button>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addElement("shape")}><Square className="mr-1 h-3.5 w-3.5" />Forma</Button>
      </div>

      {/* canvas — escala p/ caber na largura disponível (mobile) */}
      <div ref={fitRef} className="flex w-full max-w-full justify-center">
        <div style={{ width: CANVAS_W * (exporting ? 1 : scale), height: CANVAS_H * (exporting ? 1 : scale) }}>
          <div className="relative" style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${exporting ? 1 : scale})`, transformOrigin: "top left" }}>
            {doc.slides.map((s, i) => renderSlide(s, i, exporting))}
          </div>
        </div>
      </div>

      {/* carousel nav */}
      {isCarousel && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} disabled={currentSlide === 0}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-xs text-muted-foreground">{currentSlide + 1}/{doc.slides.length}</span>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentSlide(Math.min(doc.slides.length - 1, currentSlide + 1))} disabled={currentSlide === doc.slides.length - 1}><ChevronRight className="h-4 w-4" /></Button>
          <span className="mx-1 text-border">|</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={addSlide} title="Novo slide"><Plus className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={dupSlide} title="Duplicar"><Copy className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={delSlide} disabled={doc.slides.length === 1} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );
}
