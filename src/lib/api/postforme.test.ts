import { describe, it, expect } from "vitest";
import { normalizePfmFeed } from "./postforme";

describe("normalizePfmFeed", () => {
  it("normaliza métricas básicas e marca hasMetrics", () => {
    const raw = {
      data: [
        {
          id: "p1",
          posted_at: "2026-06-10T12:00:00Z",
          caption: "Olá",
          platform_url: "https://insta/p1",
          media: ["https://cdn/img.jpg"],
          metrics: { likes: 10, comments: 2, reach: 100, video_views: 50 },
        },
      ],
      meta: { cursor: "c2" },
    };
    const { posts, cursor } = normalizePfmFeed(raw);
    expect(cursor).toBe("c2");
    expect(posts).toHaveLength(1);
    const p = posts[0];
    expect(p.id).toBe("p1");
    expect(p.caption).toBe("Olá");
    expect(p.platformUrl).toBe("https://insta/p1");
    expect(p.thumbUrl).toBe("https://cdn/img.jpg");
    expect(p.metrics.likes).toBe(10);
    expect(p.metrics.comments).toBe(2);
    expect(p.metrics.reach).toBe(100);
    expect(p.metrics.views).toBe(50); // video_views -> views
    expect(p.hasMetrics).toBe(true);
  });

  it("mapeia chaves alternativas (reposts->shares, bookmarks->saves, plays->views)", () => {
    const { posts } = normalizePfmFeed({ data: [{ id: "x", metrics: { reposts: 3, bookmarks: 4, plays: 7 } }] });
    expect(posts[0].metrics.shares).toBe(3);
    expect(posts[0].metrics.saves).toBe(4);
    expect(posts[0].metrics.views).toBe(7);
  });

  it("sem métricas => hasMetrics false", () => {
    const { posts } = normalizePfmFeed({ data: [{ id: "y", caption: "sem dados" }] });
    expect(posts[0].hasMetrics).toBe(false);
    expect(posts[0].metrics.likes).toBeUndefined();
  });

  it("extrai thumb de media aninhada", () => {
    const { posts } = normalizePfmFeed({ data: [{ id: "z", media: [{ url: "https://cdn/foto.png", type: "image" }] }] });
    expect(posts[0].thumbUrl).toBe("https://cdn/foto.png");
  });

  it("entrada inválida/vazia => lista vazia", () => {
    expect(normalizePfmFeed(null).posts).toEqual([]);
    expect(normalizePfmFeed({}).posts).toEqual([]);
    expect(normalizePfmFeed({ data: "nope" }).posts).toEqual([]);
  });

  it("aceita array cru direto (sem wrapper data)", () => {
    const { posts } = normalizePfmFeed([{ id: "a", metrics: { likes: 1 } }]);
    expect(posts).toHaveLength(1);
    expect(posts[0].metrics.likes).toBe(1);
  });
});
