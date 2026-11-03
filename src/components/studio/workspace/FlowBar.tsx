import { Send, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio } from "./StudioProvider";

export function FlowBar({ onPublish }: { onPublish: () => void }) {
  const { doc } = useStudio();
  const hasContent = doc.format === "video"
    ? !!doc.videoUrl
    : doc.slides.some((s) => s.els.length > 0 || s.bgImage);

  const Step = ({ label, done, active }: { label: string; done?: boolean; active?: boolean }) => (
    <span className={`flex items-center gap-1.5 ${active ? "text-primary font-medium" : done ? "text-foreground" : "text-muted-foreground"}`}>
      <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${done ? "bg-green-500 text-white" : active ? "bg-primary text-white" : "bg-muted"}`}>
        {done ? <Check className="h-2.5 w-2.5" /> : ""}
      </span>
      {label}
    </span>
  );

  return (
    <footer className="flex h-14 shrink-0 items-center gap-4 border-t border-border px-4 text-sm">
      <div className="hidden items-center gap-3 sm:flex">
        <Step label="Criar" done={hasContent} active={!hasContent} />
        <span className="text-border">→</span>
        <Step label="Revisar" active={hasContent} />
        <span className="text-border">→</span>
        <Step label="Postar/Agendar" />
      </div>
      <Button
        className="ml-auto bg-gradient-to-r from-primary to-primary/80"
        onClick={onPublish}
        disabled={!hasContent}
      >
        <Send className="mr-2 h-4 w-4" /> {doc.schedule.when === "schedule" ? "Revisar e agendar" : "Revisar e postar"}
      </Button>
    </footer>
  );
}
