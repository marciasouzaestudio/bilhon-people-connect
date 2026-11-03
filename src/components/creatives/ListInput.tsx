/**
 * Editor de lista curta (chips): dores, benefícios, provas... Enter ou vírgula
 * adiciona; X remove. Sem dependência nova.
 */
import { useState, type KeyboardEvent } from "react";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ListInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  max?: number;
  className?: string;
}

export function ListInput({ value, onChange, placeholder, disabled, max = 12, className }: ListInputProps) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const parts = draft.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = Array.from(new Set([...value, ...parts])).slice(0, max);
    onChange(next);
    setDraft("");
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
    if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
  };

  return (
    <div className={cn("space-y-2", className)}>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((item, i) => (
            <span key={`${item}-${i}`} className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-accent/40 px-2.5 py-1 text-xs">
              <span className="truncate">{item}</span>
              {!disabled && (
                <button type="button" aria-label={`Remover ${item}`} onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={add}
          placeholder={placeholder || "Digite e pressione Enter"}
          disabled={disabled || value.length >= max}
          className="h-9"
        />
        <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={add} disabled={disabled || !draft.trim()} aria-label="Adicionar">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
