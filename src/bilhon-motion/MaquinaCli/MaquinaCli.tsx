"use client";


/* GERADO por apply-bilhon-ds (make-motion-layer) — cópia de
   C:/Users/tech/bilhonos/bilhon-os/src/bos-web/components/motion/MaquinaCli/MaquinaCli.tsx
   (remap de cor token → --bl-*; signature colors verbatim). NÃO editar à mão. */

// =============================================================================
// MaquinaCli — animacao "A Maquina Bilhon · 5 pecas" (terminal CLI revelado).
// Markup portado de public/bilhon/maquina/index.html; logica no hook.
//
// Uso:
//   import { MaquinaCli } from "@bos/components/motion/MaquinaCli/MaquinaCli";
//   <MaquinaCli />                       // auto-start ao entrar no viewport
//   <MaquinaCli loops={1} />             // 1 volta do loop I2->I6
//   <MaquinaCli autoStart={false} />     // inicia imediatamente (sem IO)
//
// Conteudo dos terminais e 100% hard-coded/confiavel (content.ts) -> o tokenizer
// de digitacao com innerHTML incremental e seguro.
// =============================================================================

import { useRef } from "react";
import { useMaquinaEngine } from "./useMaquinaEngine";
import { TRACK_ICONS, HERO_ICON } from "./icons";
import styles from "./maquina-cli.module.css";

export type MaquinaCliProps = {
  /** inicia a sequencia ao entrar no viewport (IntersectionObserver). Default: true. */
  autoStart?: boolean;
  /** voltas do loop de cliente (I2->I6) antes de pausar em I6. Default: 3. */
  loops?: number;
  /** classe extra aplicada ao wrapper externo. */
  className?: string;
};

// Icone "tela cheia" do top-bar (inline — nao precisa de arquivo).
function FullscreenIcon() {
  return (
    <svg
      width="100%"
      height="100%"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="fullscreen-icon"
      aria-hidden="true"
    >
      <path
        d="M9.75 2.25V0.75H0.75V9.75H2.25V3.31064L9.7822 10.8428L10.8428 9.7822L3.31064 2.25H9.75Z"
        fill="currentColor"
      />
      <path
        d="M21.749 14.2495V20.6889L14.0293 12.9692L12.9688 14.0298L20.6884 21.7495H14.249V23.2495H23.249V14.2495H21.749Z"
        fill="currentColor"
      />
    </svg>
  );
}

// Semaforo (3 bolinhas) do top-bar.
function TerminalDots() {
  return (
    <div className="left-element">
      <div className="circle-path small" />
      <div className="circle-path _02 small" />
      <div className="circle-path _03 small" />
    </div>
  );
}

export function MaquinaCli({ autoStart = true, loops = 3, className }: MaquinaCliProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  useMaquinaEngine(rootRef, { autoStart, loops });

  return (
    <div ref={rootRef} className={[styles.maquinaRoot, className].filter(Boolean).join(" ")}>
      <div
        className="hero-animation maquina-5pecas"
        data-bilhon-state="idle"
        role="region"
        aria-label="Demonstração interativa: A Máquina Bilhon · 5 peças instaladas"
      >
        <div
          id="bilhon-cli-narrator"
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
        />
        <div className="animation-wrapper">
          {/* TOP — 5 icones-trilha com luz correndo */}
          <div className="top-animation">
            {TRACK_ICONS.map((icon) => (
              <div
                key={icon.caption}
                className={`track-line${icon.yellow ? " yellow" : ""}`}
              >
                <div className="icon-hero">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={icon.src} loading="lazy" alt={icon.alt} className="icon-hero-01" />
                </div>
                <div className="bilhon-piece-caption">{icon.caption}</div>
                <div className="v-line" />
                <div className={`moving-line ${icon.trackColor}`} />
              </div>
            ))}
          </div>

          {/* MIDDLE — orquestrador central + haste vertical */}
          <div className="middle-animation">
            <div className="w-layout-vflex icon-hero-outlined">
              <div className="icon-hero center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={HERO_ICON.src}
                  loading="lazy"
                  alt={HERO_ICON.alt}
                  className="icon-hero-01"
                />
              </div>
            </div>
            <div className="v-line long" />
          </div>

          {/* BOTTOM — 3 terminais (back-left / center / back) */}
          <div className="bottom-animation">
            <div
              id="bilhon-term-1"
              data-bilhon-term="1"
              className="terminal-wrapper back left"
              role="presentation"
            >
              <div className="top-bar-terminal">
                <TerminalDots />
                <div className="tab-address">
                  <div className="code-tab grey-500" data-bilhon-tab />
                </div>
                <div className="icon-wrapper">
                  <FullscreenIcon />
                </div>
              </div>
              <div className="hero-terminal-wrapper">
                <div className="hero-code-wrapper" data-bilhon-code />
              </div>
            </div>

            <div
              id="bilhon-term-2"
              data-bilhon-term="2"
              className="terminal-wrapper center"
              role="presentation"
            >
              <div className="top-bar-terminal">
                <TerminalDots />
                <div className="tab-address">
                  <div className="xxs-mono-text grey-500 hover-scramble" data-bilhon-tab />
                </div>
                <div className="icon-wrapper">
                  <FullscreenIcon />
                </div>
              </div>
              <div className="hero-terminal-wrapper">
                <div className="hero-code-wrapper" data-bilhon-code />
              </div>
            </div>

            <div
              id="bilhon-term-3"
              data-bilhon-term="3"
              className="terminal-wrapper back"
              role="presentation"
            >
              <div className="top-bar-terminal">
                <TerminalDots />
                <div className="tab-address">
                  <div className="code-tab grey-500" data-bilhon-tab />
                </div>
                <div className="icon-wrapper">
                  <FullscreenIcon />
                </div>
              </div>
              <div className="hero-terminal-wrapper">
                <div className="hero-code-wrapper" data-bilhon-code />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MaquinaCli;
