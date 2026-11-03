import React, { useCallback, useRef, useState } from "react";
import { Upload, X, Image, Film, FileUp, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { uploadParaMedia, validarArquivo, LIMITE_IMAGEM_MB, LIMITE_VIDEO_MB } from "@/lib/media-upload";

interface UploadedFile {
  id: string;
  file: File;
  previewUrl: string; // blob: URL for local preview
  hostedUrl: string | null; // CDN URL after upload (persistent)
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
}

interface MediaUploaderProps {
  onFilesUploaded: (urls: string[]) => void;
  maxFiles?: number;
  accept?: string;
  className?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/");
}

export function MediaUploader({
  onFilesUploaded,
  maxFiles = 10,
  accept = "image/*,video/*",
  className,
}: MediaUploaderProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Notify parent with only hosted (persistent) URLs
  const notifyParent = useCallback(
    (fileList: UploadedFile[]) => {
      const hostedUrls = fileList
        .filter((f) => f.status === "done" && f.hostedUrl)
        .map((f) => f.hostedUrl!);
      onFilesUploaded(hostedUrls);
    },
    [onFilesUploaded]
  );

  // Sobe o arquivo para o bucket `media` do Supabase (persistente, entra na
  // galeria). O CDN do Post for Me é efêmero e serve só à publicação.
  const uploadFile = useCallback(
    async (entry: UploadedFile) => {
      try {
        setFiles((prev) =>
          prev.map((f) => (f.id === entry.id ? { ...f, progress: 30, status: "uploading" } : f))
        );

        const publicUrl = await uploadParaMedia(entry.file);

        setFiles((prev) => {
          const updated = prev.map((f) =>
            f.id === entry.id
              ? { ...f, progress: 100, status: "done" as const, hostedUrl: publicUrl }
              : f
          );
          notifyParent(updated);
          return updated;
        });
      } catch (err) {
        // Upload failed — keep blob preview but mark as error
        setFiles((prev) => {
          const updated = prev.map((f) =>
            f.id === entry.id
              ? {
                  ...f,
                  progress: 0,
                  status: "error" as const,
                  error: err instanceof Error ? err.message : "Erro no upload",
                }
              : f
          );
          // Still notify parent with whatever succeeded
          notifyParent(updated);
          return updated;
        });
      }
    },
    [notifyParent]
  );

  const processFiles = useCallback(
    (incoming: FileList | File[]) => {
      const newFiles = Array.from(incoming);
      const available = maxFiles - files.length;
      const toAdd = newFiles.slice(0, available);
      if (toAdd.length === 0) return;

      // Formato/tamanho são checados ANTES de subir: o arquivo recusado aparece
      // no grid já com o motivo, em vez de falhar silenciosamente no servidor.
      const entries: UploadedFile[] = toAdd.map((file) => {
        const invalido = validarArquivo(file);
        return {
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
          hostedUrl: null,
          progress: 0,
          status: invalido ? ("error" as const) : ("uploading" as const),
          error: invalido || undefined,
        };
      });

      setFiles((prev) => [...prev, ...entries]);

      entries.filter((e) => e.status === "uploading").forEach((entry) => uploadFile(entry));
    },
    [files.length, maxFiles, uploadFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  const removeFile = useCallback(
    (id: string) => {
      setFiles((prev) => {
        const target = prev.find((f) => f.id === id);
        if (target) URL.revokeObjectURL(target.previewUrl);
        const next = prev.filter((f) => f.id !== id);
        notifyParent(next);
        return next;
      });
    },
    [notifyParent]
  );

  const retryFile = useCallback(
    (id: string) => {
      const entry = files.find((f) => f.id === id);
      if (entry) uploadFile(entry);
    },
    [files, uploadFile]
  );

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer",
          isDragOver
            ? "border-primary bg-primary/10"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5"
        )}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
      >
        <FileUp className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium text-center">Arraste arquivos aqui ou clique para selecionar</p>
        <p className="text-xs text-muted-foreground">
          Imagens até {LIMITE_IMAGEM_MB} MB · vídeos até {LIMITE_VIDEO_MB} MB · máximo {maxFiles} arquivos
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
          <Upload className="mr-2 h-4 w-4" />
          Selecionar arquivos
        </Button>
        <input ref={inputRef} type="file" multiple accept={accept} className="hidden" onChange={(e) => { if (e.target.files) processFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {/* Thumbnail grid */}
      {files.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {files.map((entry) => (
            <div key={entry.id} className="group relative flex flex-col rounded-lg border bg-card overflow-hidden">
              <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
                {isVideoFile(entry.file) ? (
                  <Film className="h-10 w-10 text-muted-foreground" />
                ) : (
                  <img src={entry.previewUrl} alt={entry.file.name} className="h-full w-full object-cover" />
                )}

                {/* Status overlay */}
                {entry.status === "uploading" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <span className="text-sm font-bold text-white">{Math.round(entry.progress)}%</span>
                  </div>
                )}
                {entry.status === "done" && (
                  <div className="absolute top-1 left-1">
                    <CheckCircle2 className="h-4 w-4 text-green-500 drop-shadow" />
                  </div>
                )}
                {entry.status === "error" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/70 p-2 text-center">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                    {entry.error && (
                      <p className="line-clamp-3 text-[10px] leading-tight text-white">{entry.error}</p>
                    )}
                    <button onClick={() => retryFile(entry.id)} className="text-[10px] text-white underline">
                      Tentar novamente
                    </button>
                  </div>
                )}

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeFile(entry.id)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Progress bar */}
              {entry.status === "uploading" && (
                <div className="h-1 w-full bg-muted">
                  <div className="h-full bg-primary transition-all duration-200" style={{ width: `${entry.progress}%` }} />
                </div>
              )}

              {/* File info */}
              <div className="flex items-center gap-1.5 px-2 py-1.5">
                {isVideoFile(entry.file) ? (
                  <Film className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <Image className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{entry.file.name}</p>
                  <p className="text-[10px] text-muted-foreground">{formatFileSize(entry.file.size)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
