/**
 * Upload de mídia própria do cliente para o bucket `media` do Supabase.
 *
 * É o caminho que faltava: até aqui toda mídia da plataforma nascia da IA
 * (ou vinha do Pexels aplicada direto no canvas). Este módulo é o portão de
 * entrada do arquivo do próprio cliente — foto de produto, de equipe, de
 * evento, peça do designer.
 *
 * RLS do bucket "media": a 1ª pasta do caminho TEM que ser o auth.uid()
 * (policy `social_media_insert_own`). Todo path daqui respeita isso.
 */

import { supabase } from "@/integrations/supabase/client";

/** O bucket não tem `file_size_limit` no servidor — o teto é imposto aqui. */
export const LIMITE_IMAGEM_MB = 25;
export const LIMITE_VIDEO_MB = 100;

const MB = 1024 * 1024;

export function ehVideo(file: File): boolean {
  return file.type.startsWith("video/");
}

/** Devolve a mensagem de erro em pt-BR, ou null se o arquivo é aceitável. */
export function validarArquivo(file: File): string | null {
  const video = ehVideo(file);
  if (!video && !file.type.startsWith("image/")) {
    return "Formato não suportado — envie uma imagem ou um vídeo.";
  }
  const limiteMb = video ? LIMITE_VIDEO_MB : LIMITE_IMAGEM_MB;
  if (file.size > limiteMb * MB) {
    return `Arquivo muito grande (${(file.size / MB).toFixed(1)} MB) — o limite é ${limiteMb} MB.`;
  }
  return null;
}

/**
 * Sobe o arquivo para o bucket `media` e devolve a URL pública persistente.
 * Lança com mensagem em pt-BR quando falha (o chamador mostra no toast).
 */
export async function uploadParaMedia(file: File, pasta = "uploads"): Promise<string> {
  const invalido = validarArquivo(file);
  if (invalido) throw new Error(invalido);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada — entre novamente para enviar arquivos.");

  const ext = (file.name.split(".").pop() || (ehVideo(file) ? "mp4" : "png")).toLowerCase();
  // A 1ª pasta precisa ser o auth.uid() para casar com a RLS do bucket.
  const path = `${user.id}/${pasta}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("media")
    .upload(path, file, { contentType: file.type || undefined });

  if (error) throw new Error(error.message || "Falha ao enviar o arquivo.");

  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}
