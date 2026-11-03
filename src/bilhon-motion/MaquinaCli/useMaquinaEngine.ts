"use client";


/* GERADO por apply-bilhon-ds (make-motion-layer) — cópia de
   C:/Users/tech/bilhonos/bilhon-os/src/bos-web/components/motion/MaquinaCli/useMaquinaEngine.ts
   (remap de cor token → --bl-*; signature colors verbatim). NÃO editar à mão. */

// =============================================================================
// useMaquinaEngine — porta a state machine de animation.js como hook React.
//
// Diferencas em relacao ao IIFE original (intencionais):
//  - STATE encapsulado em useRef (NAO global de modulo) — seguro p/ multiplas
//    instancias e StrictMode (effects rodam 2x em dev).
//  - cleanup idempotente: clearAllPending + io.disconnect + remove listeners.
//  - useReducedMotion() do motion/react (consistencia com Reveal.tsx).
//  - gatilho SIMPLIFICADO: a sequencia inicia direto no `isIntersecting` >=
//    threshold (sem scroll-jacking de iframe). Removidos HOLD_AFTER_I1 /
//    scrollArmed / "primeiro scroll do usuario". A linha de transicao diegetica
//    da I1 continua aparecendo; a transicao I1->I2 acontece apos o HOLD.
//
// As CONSTANTES de timing sao identicas ao original (calibracao de UX).
// =============================================================================

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import {
  INTERACTIONS,
  INTERACTION_ORDER_LOOP,
  SWAP_LISTS,
  type Interaction,
  type InteractionKey,
  type Line,
  type SwapList,
  type TermPayload,
} from "./content";

// ============================================================================
// CONSTANTES (identicas a animation.js)
// ============================================================================
const FADE_MS = 280;
const TAB_CHAR_MS = 84;
const CMD_CHAR_MS = 66;
const LINE_GAP_MS = 420;

const TERMINAL_STAGGER_MS = 360;
const INTERACTION_HOLD_MS = 8400;
const INTER_GAP_MS = 700;
const INTER_GAP_END_OF_LOOP_MS = 900;
const I1_TO_I2_TRANSITION_HOLD_MS = 1500;

const WORD_SWAP_FADE_MS = 360;
const WORD_SWAP_HOLD_MS = 720;
const WORD_SWAP_FINAL_FLASH_MS = 600;

const STAR_LINE_GAP_MS = 840;
const HERO_LINE_GAP_MS = 1260;

const REDUCED_MOTION_HOLD_MS = 5000;

const START_AFTER_REVEAL_MS = 700; // espera o fade do reveal antes de digitar

type RunState =
  | "IDLE"
  | "PAUSED"
  | "I1_FOUNDER"
  | "HOLD_AFTER_I1"
  | InteractionKey;

type TermRef = {
  el: HTMLElement;
  tab: HTMLElement;
  code: HTMLElement;
  n: number;
};

type EngineOptions = {
  /** numero de voltas do loop I2->I6 antes de pausar em I6 (default 3) */
  loops?: number;
  /** se false, nao inicia automaticamente ao entrar no viewport (default true) */
  autoStart?: boolean;
};

const IO_THRESHOLD = 0.4;
const IO_ROOT_MARGIN = "0px 0px -120px 0px";
const REENTRY_RESET_THRESHOLD_MS = 5000;

export function useMaquinaEngine(
  rootRef: React.RefObject<HTMLElement | null>,
  options: EngineOptions = {},
): void {
  const reduceMotion = useReducedMotion();
  // Mantem as opcoes frescas sem re-disparar o effect.
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return;

    const REDUCED_MOTION = !!reduceMotion;
    const MAX_LOOPS = optsRef.current.loops ?? 3;
    const AUTO_START = optsRef.current.autoStart ?? true;

    // ========================================================================
    // STATE encapsulado (por instancia)
    // ========================================================================
    const STATE = {
      state: "IDLE" as RunState,
      loopCount: 0,
      lastExitTime: 0,
      pendingTimeouts: [] as ReturnType<typeof setTimeout>[],
      started: false,
    };
    let disposed = false;

    // ========================================================================
    // DOM REFS
    // ========================================================================
    const container = root.querySelector<HTMLElement>(".maquina-5pecas");
    if (!container) return;
    const narrator = container.querySelector<HTMLElement>("#bilhon-cli-narrator");
    const refs: TermRef[] = [];
    for (const n of [1, 2, 3]) {
      const el = container.querySelector<HTMLElement>(`#bilhon-term-${n}`);
      if (!el) continue;
      const tab = el.querySelector<HTMLElement>("[data-bilhon-tab]");
      const code = el.querySelector<HTMLElement>("[data-bilhon-code]");
      if (!tab || !code) continue;
      refs.push({ el, tab, code, n });
    }
    if (refs.length !== 3) return;

    const animWrap = container.querySelector<HTMLElement>(".animation-wrapper");

    // ========================================================================
    // TIMER UTILS (cancelaveis)
    // ========================================================================
    function track(fn: () => void, ms: number) {
      const id = setTimeout(() => {
        const i = STATE.pendingTimeouts.indexOf(id);
        if (i >= 0) STATE.pendingTimeouts.splice(i, 1);
        if (!disposed) fn();
      }, ms);
      STATE.pendingTimeouts.push(id);
      return id;
    }
    function clearAllPending() {
      STATE.pendingTimeouts.forEach((id) => clearTimeout(id));
      STATE.pendingTimeouts = [];
    }
    function sleep(ms: number): Promise<void> {
      return new Promise((resolve) => {
        track(() => resolve(), ms);
      });
    }
    function isStopped() {
      return disposed || STATE.state === "IDLE" || STATE.state === "PAUSED";
    }

    // ========================================================================
    // TYPING (tokeniza HTML preservando spans + entidades)
    // ========================================================================
    type Token = { type: "char" | "tag"; value: string };
    function tokenizeHtml(html: string): Token[] {
      const tokens: Token[] = [];
      let i = 0;
      while (i < html.length) {
        if (html[i] === "<") {
          const end = html.indexOf(">", i);
          if (end === -1) {
            tokens.push({ type: "char", value: html[i] });
            i++;
            continue;
          }
          tokens.push({ type: "tag", value: html.slice(i, end + 1) });
          i = end + 1;
        } else if (html[i] === "&") {
          const sc = html.indexOf(";", i);
          if (sc !== -1 && sc - i < 8) {
            tokens.push({ type: "char", value: html.slice(i, sc + 1) });
            i = sc + 1;
          } else {
            tokens.push({ type: "char", value: html[i] });
            i++;
          }
        } else {
          tokens.push({ type: "char", value: html[i] });
          i++;
        }
      }
      return tokens;
    }

    function typeInto(target: HTMLElement, html: string, charMs: number): Promise<void> {
      return new Promise((resolve) => {
        const tokens = tokenizeHtml(html);
        target.innerHTML = "";
        const cursor = document.createElement("span");
        cursor.className = "bilhon-cursor";
        target.appendChild(cursor);
        let idx = 0;
        function step() {
          if (isStopped()) {
            if (cursor.parentNode) cursor.parentNode.removeChild(cursor);
            resolve();
            return;
          }
          while (idx < tokens.length && tokens[idx].type === "tag") {
            target.insertBefore(
              document.createRange().createContextualFragment(tokens[idx].value),
              cursor,
            );
            idx++;
          }
          if (idx < tokens.length) {
            target.insertBefore(
              document.createRange().createContextualFragment(tokens[idx].value),
              cursor,
            );
            idx++;
            track(step, charMs);
          } else {
            if (cursor.parentNode) cursor.parentNode.removeChild(cursor);
            resolve();
          }
        }
        step();
      });
    }

    // ========================================================================
    // FADE
    // ========================================================================
    function fadeOutAll(): Promise<void> {
      return new Promise((resolve) => {
        refs.forEach((r) => {
          r.tab.classList.add("is-fading");
          r.code.classList.add("is-fading");
        });
        track(() => {
          refs.forEach((r) => {
            r.tab.classList.remove("is-fading");
            r.code.classList.remove("is-fading");
          });
          resolve();
        }, FADE_MS);
      });
    }

    function clearTerminals() {
      refs.forEach((r) => {
        r.tab.textContent = "";
        r.code.innerHTML = "";
        const wrapper = r.code.closest<HTMLElement>(".hero-terminal-wrapper");
        if (wrapper) wrapper.scrollTop = 0;
      });
    }

    function scrollTerminalToBottom(codeEl: HTMLElement) {
      const wrapper = codeEl.closest<HTMLElement>(".hero-terminal-wrapper");
      if (!wrapper) return;
      requestAnimationFrame(() => {
        wrapper.scrollTop = wrapper.scrollHeight;
      });
    }

    // ========================================================================
    // WORD-SWAP
    // ========================================================================
    function findSwapElements(codeEl: HTMLElement, swapKeys: string[]) {
      const els: Record<string, HTMLElement | null> = {};
      swapKeys.forEach((key) => {
        els[key] = codeEl.querySelector<HTMLElement>(
          `.bilhon-word-swap[data-swap-key="${key}"]`,
        );
      });
      return els;
    }

    function runSingleWordSwap(
      swapEl: HTMLElement | null,
      listObj: SwapList,
    ): Promise<void> {
      return new Promise((resolve) => {
        if (!swapEl) {
          resolve();
          return;
        }
        const currentSpan = swapEl.querySelector<HTMLElement>(".bilhon-word-swap__current");
        if (!currentSpan) {
          resolve();
          return;
        }
        const words = listObj.words.slice();
        const selected = listObj.selected;

        function cycleWord(i: number) {
          if (isStopped()) {
            resolve();
            return;
          }
          if (i >= words.length) {
            // swap final para a palavra "selecionada"
            currentSpan!.classList.add("is-leaving");
            track(() => {
              currentSpan!.textContent = selected;
              currentSpan!.classList.remove("is-leaving");
              swapEl!.classList.add("is-selected");
              track(() => {
                track(() => {
                  swapEl!.classList.add("flash-done");
                }, 1500);
                resolve();
              }, WORD_SWAP_FINAL_FLASH_MS);
            }, WORD_SWAP_FADE_MS);
            return;
          }
          currentSpan!.classList.add("is-leaving");
          track(() => {
            currentSpan!.textContent = words[i];
            currentSpan!.classList.remove("is-leaving");
            currentSpan!.classList.add("is-entering");
            track(() => {
              currentSpan!.classList.remove("is-entering");
              cycleWord(i + 1);
            }, WORD_SWAP_HOLD_MS);
          }, WORD_SWAP_FADE_MS);
        }
        cycleWord(0);
      });
    }

    function runWordSwapsSequential(codeEl: HTMLElement, swapKeys: string[]): Promise<void> {
      return new Promise((resolve) => {
        const els = findSwapElements(codeEl, swapKeys);
        let i = 0;
        function next() {
          if (i >= swapKeys.length) {
            resolve();
            return;
          }
          const key = swapKeys[i];
          runSingleWordSwap(els[key], SWAP_LISTS[key]).then(() => {
            i++;
            next();
          });
        }
        next();
      });
    }

    // ========================================================================
    // RENDER LINHA POR LINHA (output do terminal)
    // ========================================================================
    function renderOutputLines(
      containerEl: HTMLElement,
      outClass: string,
      lines: Line[],
    ): Promise<void> {
      return new Promise((resolve) => {
        const p = document.createElement("p");
        p.className = outClass;
        containerEl.appendChild(p);
        let i = 0;
        function next() {
          if (isStopped()) {
            resolve();
            return;
          }
          if (i >= lines.length) {
            resolve();
            return;
          }
          const line = lines[i];
          if (i > 0) p.insertAdjacentHTML("beforeend", "<br>");
          const span = document.createElement("span");
          span.style.opacity = "0";
          span.style.transition = "opacity 240ms ease-out";
          span.innerHTML = line.html;
          if (line.hero) {
            const heroSpan = span.querySelector<HTMLElement>(".bilhon-star-line");
            if (heroSpan) {
              track(() => {
                heroSpan.classList.add("is-revealing");
              }, 240);
            }
          }
          p.appendChild(span);
          requestAnimationFrame(() => {
            span.style.opacity = "1";
          });
          scrollTerminalToBottom(containerEl);
          let gap = LINE_GAP_MS;
          if (line.hero) gap = HERO_LINE_GAP_MS;
          else if (line.star) gap = STAR_LINE_GAP_MS;
          i++;
          track(next, gap);
        }
        next();
      });
    }

    // ========================================================================
    // TYPE TERMINAL (tab -> cmd -> outputs · com word-swap inline)
    // ========================================================================
    function runTerminal(ref: TermRef, payload: TermPayload): Promise<void> {
      return new Promise((resolve) => {
        ref.tab.textContent = "";
        ref.code.innerHTML = "";
        const wrapper = ref.code.closest<HTMLElement>(".hero-terminal-wrapper");
        if (wrapper) wrapper.scrollTop = 0;

        typeInto(ref.tab, payload.tab, TAB_CHAR_MS).then(() => {
          if (isStopped()) {
            resolve();
            return;
          }
          const pCmd = document.createElement("p");
          pCmd.className = payload.cmdClass;
          ref.code.appendChild(pCmd);
          typeInto(pCmd, payload.cmdHtml, CMD_CHAR_MS).then(() => {
            if (isStopped()) {
              resolve();
              return;
            }
            const swapPromise =
              payload.wordSwapKeys && payload.wordSwapKeys.length > 0
                ? runWordSwapsSequential(pCmd, payload.wordSwapKeys)
                : Promise.resolve();
            swapPromise.then(() => {
              if (isStopped()) {
                resolve();
                return;
              }
              renderOutputLines(ref.code, payload.outClass, payload.lines).then(() => {
                resolve();
              });
            });
          });
        });
      });
    }

    // ========================================================================
    // STATIC SNAPSHOT (reduced-motion · render direto sem typing)
    // ========================================================================
    function renderStaticTerminal(ref: TermRef, payload: TermPayload) {
      ref.tab.textContent = payload.tab;
      let html = `<p class="${payload.cmdClass}">${payload.cmdHtml}</p>`;
      html += `<p class="${payload.outClass}">`;
      html += payload.lines.map((l) => l.html).join("<br>");
      html += "</p>";
      ref.code.innerHTML = html;
      if (payload.wordSwapKeys) {
        payload.wordSwapKeys.forEach((key) => {
          const swapEl = ref.code.querySelector<HTMLElement>(
            `.bilhon-word-swap[data-swap-key="${key}"]`,
          );
          if (swapEl) {
            const listObj = SWAP_LISTS[key];
            const span = swapEl.querySelector<HTMLElement>(".bilhon-word-swap__current");
            if (span && listObj) {
              span.textContent = listObj.selected;
              swapEl.classList.add("is-selected", "flash-done");
            }
          }
        });
      }
    }

    // ========================================================================
    // ANNOUNCER (a11y)
    // ========================================================================
    function announceToNarrator(text: string) {
      if (narrator) narrator.textContent = text;
    }

    // ========================================================================
    // RUN INTERACTION (T1+T2+T3 sincronizados com micro-stagger)
    // ========================================================================
    function runInteraction(key: InteractionKey): Promise<void> {
      return new Promise((resolve) => {
        const data: Interaction | undefined = INTERACTIONS[key];
        if (!data) {
          resolve();
          return;
        }
        announceToNarrator(data.summary);
        if (container) container.setAttribute("data-bilhon-state", key);

        if (REDUCED_MOTION) {
          renderStaticTerminal(refs[0], data.T1);
          renderStaticTerminal(refs[1], data.T2);
          renderStaticTerminal(refs[2], data.T3);
          track(resolve, REDUCED_MOTION_HOLD_MS);
          return;
        }

        const p1 = runTerminal(refs[0], data.T1);
        const p2 = sleep(TERMINAL_STAGGER_MS).then(() => runTerminal(refs[1], data.T2));
        const p3 = sleep(TERMINAL_STAGGER_MS * 2).then(() => runTerminal(refs[2], data.T3));

        Promise.all([p1, p2, p3]).then(() => {
          if (isStopped()) {
            resolve();
            return;
          }
          // Linha de transicao diegetica (somente I1)
          if (data.T2.transitionLine) {
            const tline = data.T2.transitionLine;
            sleep(INTERACTION_HOLD_MS).then(() => {
              if (isStopped()) {
                resolve();
                return;
              }
              const lastP = refs[1].code.querySelector<HTMLElement>("p:last-child");
              if (lastP) {
                lastP.insertAdjacentHTML("beforeend", "<br>");
                const span = document.createElement("span");
                span.style.opacity = "0";
                span.style.transition = "opacity 240ms ease-out";
                span.innerHTML = tline.html;
                lastP.appendChild(span);
                requestAnimationFrame(() => {
                  span.style.opacity = "1";
                });
              }
              sleep(I1_TO_I2_TRANSITION_HOLD_MS).then(() => resolve());
            });
          } else {
            sleep(INTERACTION_HOLD_MS).then(() => resolve());
          }
        });
      });
    }

    // ========================================================================
    // SEQUENCE ENGINE
    // ========================================================================
    function startSequence(opts: { reset?: boolean } = {}) {
      if (opts.reset) {
        STATE.loopCount = 0;
      }
      STATE.state = "I1_FOUNDER";
      runI1ThenLoop();
    }

    function runI1ThenLoop() {
      runInteraction("I1_FOUNDER").then(() => {
        if (isStopped()) return;
        // Gatilho simplificado: sem esperar scroll, avanca direto para I2.
        transitionToNext("I2_MOVIMENTO");
      });
    }

    function transitionToNext(nextKey: InteractionKey) {
      fadeOutAll().then(() => {
        if (isStopped()) return;
        clearTerminals();
        const endOfLoop = nextKey === "I2_MOVIMENTO" && STATE.loopCount > 0;
        const gap = endOfLoop ? INTER_GAP_END_OF_LOOP_MS : INTER_GAP_MS;
        sleep(gap).then(() => {
          if (isStopped()) return;
          STATE.state = nextKey;
          runInteractionInLoop(nextKey);
        });
      });
    }

    function runInteractionInLoop(key: InteractionKey) {
      runInteraction(key).then(() => {
        if (isStopped()) return;
        const idx = INTERACTION_ORDER_LOOP.indexOf(key);
        const nextIdx = (idx + 1) % INTERACTION_ORDER_LOOP.length;
        const nextKey = INTERACTION_ORDER_LOOP[nextIdx];
        if (key === "I6_RECORRENCIA") {
          STATE.loopCount++;
          if (STATE.loopCount >= MAX_LOOPS) {
            STATE.state = "PAUSED";
            if (container) container.setAttribute("data-bilhon-state", "paused-i6");
            return;
          }
        }
        transitionToNext(nextKey);
      });
    }

    function pauseSequence() {
      STATE.state = "PAUSED";
      clearAllPending();
    }

    function resumeSequence() {
      if (STATE.state !== "PAUSED") return;
      const gap = Date.now() - STATE.lastExitTime;
      // Sem checkpoint mid-interaction: reinicia de I1 (aceitavel — igual original).
      startSequence({ reset: gap > REENTRY_RESET_THRESHOLD_MS });
    }

    // ========================================================================
    // STATIC SNAPSHOT (reduced-motion render only)
    // ========================================================================
    function applyStaticSnapshot() {
      if (!container) return;
      container.setAttribute("data-bilhon-state", "static");
      container.classList.add("bilhon-revealed");
      if (animWrap) {
        animWrap.classList.remove("bilhon-cli-hidden");
        animWrap.classList.add("bilhon-cli-revealed");
      }
      renderStaticTerminal(refs[0], INTERACTIONS.I1_FOUNDER.T1);
      renderStaticTerminal(refs[1], INTERACTIONS.I1_FOUNDER.T2);
      renderStaticTerminal(refs[2], INTERACTIONS.I1_FOUNDER.T3);
    }

    // ========================================================================
    // REVEAL + INTERSECTION OBSERVER (gatilho simplificado)
    // ========================================================================
    function revealAndStart(entry: IntersectionObserverEntry) {
      if (animWrap) {
        animWrap.classList.remove("bilhon-cli-hidden");
        animWrap.classList.add("bilhon-cli-revealed");
      }
      container!.classList.add("bilhon-revealed");
      track(() => {
        if (disposed) return;
        const rect = entry.target.getBoundingClientRect();
        const stillVisible = rect.top < window.innerHeight && rect.bottom > 0;
        if (stillVisible) startSequence({ reset: true });
      }, START_AFTER_REVEAL_MS);
    }

    // Esconde o bloco interno ANTES do reveal.
    if (animWrap && !REDUCED_MOTION) animWrap.classList.add("bilhon-cli-hidden");

    if (REDUCED_MOTION) {
      applyStaticSnapshot();
      return () => {
        disposed = true;
        clearAllPending();
      };
    }

    let io: IntersectionObserver | null = null;
    const onVisibilityChange = () => {
      if (document.hidden) {
        if (STATE.state !== "IDLE") pauseSequence();
      } else {
        if (STATE.state === "PAUSED") resumeSequence();
      }
    };

    if (AUTO_START) {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              if (!STATE.started) {
                STATE.started = true;
                revealAndStart(entry);
              } else if (STATE.state === "IDLE" || STATE.state === "PAUSED") {
                resumeSequence();
              }
            } else {
              STATE.lastExitTime = Date.now();
              if (STATE.state !== "PAUSED" && STATE.state !== "IDLE") pauseSequence();
            }
          });
        },
        { threshold: IO_THRESHOLD, rootMargin: IO_ROOT_MARGIN },
      );
      io.observe(container);
      document.addEventListener("visibilitychange", onVisibilityChange);
    } else {
      // Sem autoStart: revela e inicia imediatamente (client-side).
      if (animWrap) {
        animWrap.classList.remove("bilhon-cli-hidden");
        animWrap.classList.add("bilhon-cli-revealed");
      }
      container.classList.add("bilhon-revealed");
      STATE.started = true;
      track(() => {
        if (!disposed) startSequence({ reset: true });
      }, START_AFTER_REVEAL_MS);
    }

    // ========================================================================
    // CLEANUP (idempotente — critico p/ StrictMode double-mount)
    // ========================================================================
    return () => {
      disposed = true;
      STATE.state = "IDLE";
      clearAllPending();
      if (io) io.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [reduceMotion, rootRef]);
}
