import React, { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, Send, X } from "lucide-react";

interface MediaPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  urls: string[];
  initialIndex?: number;
  title?: string;
  onUseInPost?: (urls: string[]) => void;
}

const VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm"];

function isVideo(url: string): boolean {
  try {
    const pathname = new URL(url, "https://placeholder.com").pathname.toLowerCase();
    return VIDEO_EXTENSIONS.some((ext) => pathname.endsWith(ext));
  } catch {
    const lower = url.toLowerCase();
    return VIDEO_EXTENSIONS.some((ext) => lower.includes(ext));
  }
}

export function MediaPreviewDialog({
  open,
  onOpenChange,
  urls,
  initialIndex = 0,
  title,
  onUseInPost,
}: MediaPreviewDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
    }
  }, [open, initialIndex]);

  const total = urls.length;
  const hasMultiple = total > 1;
  const currentUrl = urls[currentIndex] ?? "";

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev <= 0 ? total - 1 : prev - 1));
  }, [total]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev >= total - 1 ? 0 : prev + 1));
  }, [total]);

  useEffect(() => {
    if (!open || !hasMultiple) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, hasMultiple, goToPrev, goToNext]);

  if (!urls.length) return null;

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = currentUrl;
    link.download = "";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUseInPost = () => {
    onUseInPost?.(urls);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <DialogTitle className="text-base font-semibold truncate">
            {title ?? "Pré-visualização"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Visualização de mídia {currentIndex + 1} de {total}
          </DialogDescription>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </Button>
        </div>

        {/* Media Area */}
        <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-black/5 min-h-0">
          {/* Navigation Arrows */}
          {hasMultiple && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 z-10 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm shadow hover:bg-background"
                onClick={goToPrev}
              >
                <ChevronLeft className="h-6 w-6" />
                <span className="sr-only">Anterior</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 z-10 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm shadow hover:bg-background"
                onClick={goToNext}
              >
                <ChevronRight className="h-6 w-6" />
                <span className="sr-only">Próximo</span>
              </Button>
            </>
          )}

          {/* Media Content */}
          <div className="w-full h-full flex items-center justify-center p-4 transition-opacity duration-300">
            {isVideo(currentUrl) ? (
              <video
                key={currentUrl}
                src={currentUrl}
                controls
                className="max-w-full max-h-full rounded-md object-contain"
              >
                Seu navegador não suporta a reprodução de vídeo.
              </video>
            ) : (
              <img
                key={currentUrl}
                src={currentUrl}
                alt={`Mídia ${currentIndex + 1} de ${total}`}
                className="max-w-full max-h-full rounded-md object-contain transition-opacity duration-300"
                draggable={false}
              />
            )}
          </div>
        </div>

        {/* Dots Indicator */}
        {hasMultiple && (
          <div className="flex items-center justify-center gap-1.5 py-2 shrink-0">
            {urls.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-2 w-2 rounded-full transition-all duration-200 ${
                  idx === currentIndex
                    ? "bg-primary scale-125"
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
                aria-label={`Ir para mídia ${idx + 1}`}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t shrink-0">
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} de {total}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Baixar
            </Button>
            {onUseInPost && (
              <Button size="sm" onClick={handleUseInPost}>
                <Send className="h-4 w-4 mr-2" />
                Usar em Post
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
