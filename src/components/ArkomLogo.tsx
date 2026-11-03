import logoUrl from "@/assets/arkom-social-logo.png";

type Props = {
  className?: string;
  size?: number;
  alt?: string;
};

// Wordmark "ARKOM SOCIAL HUB" (serifa escura + anel dourado). Renderizado a uma
// ALTURA fixa com largura automática para preservar a proporção. O PNG já tem
// fundo transparente (processado via jimp), então não precisa de mix-blend.
export function ArkomLogo({ className, size = 40, alt = "Arkom Social Hub" }: Props) {
  return (
    <img
      src={logoUrl}
      alt={alt}
      style={{ height: size, width: "auto" }}
      className={`object-contain ${className ?? ""}`}
      draggable={false}
    />
  );
}

export default ArkomLogo;
