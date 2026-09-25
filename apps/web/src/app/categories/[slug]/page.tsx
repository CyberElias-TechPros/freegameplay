import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { q, ApiError } from "@/lib/api";
import { Breadcrumb, Reveal, EmptyState } from "@/components/primitives";
import { GameCard, GuideCard, PostList } from "@/components/cards";

export const revalidate = 120;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { category } = await q.category(slug);
    return {
      title: category.name,
      description: category.description ?? `Games and writing in ${category.name}.`,
    };
  } catch {
    return { title: "Category not found" };
  }
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  let data;
  try {
    data = await q.category(slug);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const { category, posts, games, guides } = data;

  return (
    <div className="section" style={{ paddingTop: 140 }}>
      <Breadcrumb items={[{ label: "Categories", href: "/categories" }, { label: category.name, href: undefined }]} />

      <Reveal className="section-head" style={{ marginTop: 48 }}>
        <div>
          <p className="section-index">{category.name}</p>
          <h2 className="section-title" style={{ textTransform: "none", fontSize: "clamp(2.4rem, 6vw, 5rem)" }}>
            {category.name}
          </h2>
          {category.description ? <p style={{ color: "var(--ink-2)", marginTop: 16, maxWidth: "60ch" }}>{category.description}</p> : null}
        </div>
      </Reveal>

      {games.length > 0 ? (
        <section style={{ marginBottom: 64 }}>
          <p className="section-index" style={{ marginBottom: 20 }}>
            Games · {games.length}
          </p>
          <div className="game-grid">
            {games.map((g, i) => (
              <Reveal key={g.id} delay={i * 0.04}>
                <GameCard game={g} index={i + 1} />
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      {posts.length > 0 ? (
        <section style={{ marginBottom: 64 }}>
          <p className="section-index" style={{ marginBottom: 8 }}>
            Writing · {posts.length}
          </p>
          <Reveal>
            <PostList posts={posts} />
          </Reveal>
        </section>
      ) : null}

      {guides.length > 0 ? (
        <section>
          <p className="section-index" style={{ marginBottom: 20 }}>
            Guides · {guides.length}
          </p>
          <div className="guide-grid">
            {guides.map((g, i) => (
              <Reveal key={g.id} delay={i * 0.04}>
                <GuideCard guide={g} />
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      {games.length === 0 && posts.length === 0 && guides.length === 0 ? (
        <EmptyState code="EMPTY_CATEGORY" title="Nothing here yet" note="This category is waiting for its first entry." />
      ) : null}
    </div>
  );
}
