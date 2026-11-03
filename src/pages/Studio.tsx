import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { AutoStudio } from "@/components/studio/workspace/AutoStudio";
import { StudioWorkspace } from "@/components/studio/workspace/StudioWorkspace";
import { emptyDoc } from "@/components/studio/workspace/StudioProvider";
import type { StudioDoc } from "@/components/studio/workspace/types";

interface NavState {
  sourceContent?: string;
  sourceTitle?: string;
  prompt?: string;
  mediaUrls?: string[];
  scheduleAt?: string;
}

function buildInitial(nav: NavState | null): StudioDoc | undefined {
  if (!nav) return undefined;
  const has = nav.sourceContent || nav.prompt || nav.sourceTitle || (nav.mediaUrls?.length ?? 0) > 0;
  if (!has) return undefined;
  const base = emptyDoc("post", null);
  return {
    ...base,
    caption: nav.sourceContent || nav.prompt || "",
    slides: nav.mediaUrls?.length ? [{ bg: base.slides[0].bg, bgImage: nav.mediaUrls[0], els: [] }] : base.slides,
    schedule: nav.scheduleAt ? { when: "schedule", at: nav.scheduleAt } : { when: "now" },
  };
}

export default function Studio() {
  const nav = (useLocation().state as NavState | null) || null;
  const navInitial = useMemo(() => buildInitial(nav), [nav]);

  // Deep-link com estado abre direto no canvas assistido pré-preenchido.
  // Sem estado: entra no fluxo conversacional (AutoStudio) que é a nova porta única.
  const [mode, setMode] = useState<"auto" | "assisted">(navInitial ? "assisted" : "auto");
  const [handoffDoc, setHandoffDoc] = useState<StudioDoc | undefined>(undefined);

  const back = () => { setHandoffDoc(undefined); setMode("auto"); };

  if (mode === "auto") {
    return (
      <AutoStudio
        onEditInCanvas={(d) => { setHandoffDoc(d); setMode("assisted"); }}
      />
    );
  }

  // assisted — full-bleed (cancela o padding do AppLayout)
  return (
    <div className="-m-4 sm:-m-6 lg:-m-8">
      <StudioWorkspace initial={handoffDoc ?? navInitial} onBack={back} />
    </div>
  );
}
