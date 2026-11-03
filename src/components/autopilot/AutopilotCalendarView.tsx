import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AutopilotPostCard } from "./AutopilotPostCard";
import { useAutopilotPosts } from "@/hooks/use-autopilot";
import type { AutopilotPost } from "@/types";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface Props {
  calendarId: string | null;
}

export function AutopilotCalendarView({ calendarId }: Props) {
  const { data: posts, isLoading } = useAutopilotPosts(calendarId);

  // Group posts by date
  const grouped = useMemo(() => {
    if (!posts?.length) return new Map<string, AutopilotPost[]>();
    const map = new Map<string, AutopilotPost[]>();
    for (const post of posts) {
      const dateKey = post.scheduled_at
        ? new Date(post.scheduled_at).toISOString().split("T")[0]
        : "sem-data";
      const existing = map.get(dateKey) || [];
      existing.push(post);
      map.set(dateKey, existing);
    }
    return map;
  }, [posts]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!calendarId || !posts?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm">Nenhum post gerado ainda.</p>
        <p className="text-xs mt-1">
          Configure e ative a Emily para gerar o primeiro ciclo.
        </p>
      </div>
    );
  }

  const sortedDates = Array.from(grouped.keys()).sort();

  return (
    <div className="space-y-6">
      {sortedDates.map((dateKey) => {
        const dayPosts = grouped.get(dateKey) || [];
        const date = dateKey !== "sem-data" ? new Date(dateKey + "T12:00:00") : null;
        const label = date
          ? `${DAYS[date.getDay()]}, ${date.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
            })}`
          : "Sem data";

        return (
          <div key={dateKey}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">
              {label}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {dayPosts.map((post) => (
                <AutopilotPostCard key={post.id} post={post} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
