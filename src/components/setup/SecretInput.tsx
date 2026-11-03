import { useState } from "react";
import { ExternalLink, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

/** Password-style input with show/hide toggle, used across the Setup wizard. */
export function SecretInput({
  id, label, placeholder, value, onChange, hint, link, linkLabel, required = false,
}: {
  id: string; label: string; placeholder: string; value: string;
  onChange: (v: string) => void; hint?: string; link?: string; linkLabel?: string; required?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-1.5">
        {label}
        {required && <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">obrigatório</Badge>}
        {!required && <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">opcional</Badge>}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-sm pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {(hint || link) && (
        <p className="text-xs text-muted-foreground">
          {hint}{" "}
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
              {linkLabel || link} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </p>
      )}
    </div>
  );
}
