import Link from "next/link";
import type { Game, Guide, Post } from "@fg/shared";
import { formatDate, formatHudDate, resolveMedia } from "@/lib/api";

export { ogImage, resolveMedia } from "@/lib/api";

function Art({ src, alt, ratio = "16 / 10" }: { src: string | null; alt: string; ratio?: string }) {
  const url = resolveMedia(src);
  if (url) {
    return <img src={url} alt={alt} loading="lazy" style={{ aspectRatio: ratio }} />;
  }
  return (
    <div
      aria-hidden
      style={{
        aspectRatio: ratio,
        width: "100%",
        background: "linear-gradient(135deg, #101729 0%, #0b101d 55%, #0e1a12 100%)",
        display: "grid",
        placeItems: "center",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: "0.3em",
        color: "var(--ink-3)",
        textTransform: "uppercase",
      }}
    >
      FGP
    </div>
  );
}

export function GameCard({ game, index }: { game: Game; index?: number }) {
  const playable = game.playableRef?.startsWith("http") ? game.playableRef : game.builtin?.engine ? `/games/${game.slug}` : null;
  return (
    <article className="game-card hud">
      <div className="game-card-art">
        <Art src={game.coverUrl} alt={`${game.title} cover art`} />
        {index !== undefined ? (
          <span className="chip chip-ice" style={{ position: "absolute", top: 14, left: 14, zIndex: 2 }}>
            {String(index).padStart(2, "0")}
          </span>
        ) : null}
        {playable ? (
          <span className="play-badge" aria-hidden>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        ) : null}
      </div>
      <div className="game-card-body">
        <div className="game-card-meta">
          <span>{game.genre ?? "game"}</span>
          <span>{game.categoryName ?? ""}</span>
        </div>
        <h3 className="game-card-title">
          <Link href={`/games/${game.slug}`}>{game.title}</Link>
        </h3>
        {game.tagline ? <p className="game-card-tagline">{game.tagline}</p> : null}
        <div className="game-card-meta" style={{ marginTop: "auto" }}>
          <span>{game.builtin?.engine ? "Playable here" : "External play"}</span>
          <span>{game.updatedAt ? formatHudDate(game.updatedAt) : ""}</span>
        </div>
      </div>
    </article>
  );
}

export function GameRail({ games }: { games: Game[] }) {
  return (
    <div className="rail" role="list" aria-label="Featured games">
      {games.map((g, i) => (
        <GameCard key={g.id} game={g} index={i + 1} />
      ))}
    </div>
  );
}

export function PostRow({ post, index }: { post: Post; index: number }) {
  return (
    <div className="index-row">
      <span className="index-num" aria-hidden>
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="index-main">
        <h3>
          <Link href={`/blog/${post.slug}`}>{post.title}</Link>
        </h3>
        {post.excerpt ? <p>{post.excerpt}</p> : null}
      </div>
      <div className="index-side">
        <span>
          <b>{post.categoryName ?? "blog"}</b>
        </span>
        <span>{formatDate(post.publishedAt)}</span>
        <span>{post.readingMinutes} min read</span>
      </div>
      <div className="index-thumb">
        <Art src={post.featuredImageUrl} alt="" />
      </div>
    </div>
  );
}

export function PostList({ posts }: { posts: Post[] }) {
  return (
    <div className="index-list">
      {posts.map((p, i) => (
        <PostRow key={p.id} post={p} index={i} />
      ))}
    </div>
  );
}

export function GuideCard({ guide }: { guide: Guide }) {
  return (
    <article className="guide-card">
      <span className="guide-kicker">{guide.gameSlug ? "Game guide" : "Guide"}</span>
      <h3>
        <Link href={`/guides/${guide.slug}`}>{guide.title}</Link>
      </h3>
      {guide.excerpt ? <p>{guide.excerpt}</p> : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {guide.tags?.slice(0, 3).map((t) => (
          <span className="chip" key={t.id}>
            {t.name}
          </span>
        ))}
      </div>
      <span className="game-ref">
        {guide.gameSlug ? (
          <>
            for <b>{guide.gameTitle ?? guide.gameSlug}</b>
            <Link href={`/games/${guide.gameSlug}`} aria-label={`Open ${guide.gameTitle ?? "game"}`}>
              →
            </Link>
          </>
        ) : (
          <>{formatDate(guide.publishedAt)}</>
        )}
      </span>
    </article>
  );
}

export function Ticker({ items }: { items: { label: string; href: string }[] }) {
  const doubled = [...items, ...items];
  return (
    <div className="ticker" aria-hidden>
      <div className="ticker-track">
        {doubled.map((it, i) => (
          <span className="ticker-item" key={i}>
            {it.label}
          </span>
        ))}
      </div>
    </div>
  );
}


