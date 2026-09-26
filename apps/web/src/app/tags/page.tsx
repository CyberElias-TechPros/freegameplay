import type { Metadata } from "next";
import Link from "next/link";
import { q } from "@/lib/api";
import { Reveal, SectionHead, EmptyState } from "@/components/primitives";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Tags",
  description: "Browse FreeGameplay writing by tag.",
  alternates: { canonical: `/tags` },
};

export default async function TagsPage() {
  let tags;
  try {
    tags = (await q.tags()).items;
  } catch {
    return (
      <div className="section" style={{ paddingTop: 160 }}>
        <div className="container">
          <EmptyState
            code="NO_SIGNAL"
            title="The content API is unreachable"
            note="Start the backend (npm run dev:api) and check API_BASE in apps/web/.env.local."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="section" style={{ paddingTop: 140 }}>
      <div className="container">
        <SectionHead index="A / Topics" title="Tags" thin={`${tags.length}`} />
        {tags.length === 0 ? (
          <EmptyState code="NO_TAGS" title="No tags yet" note="Tags appear as posts are published." />
        ) : (
          <Reveal>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 24 }}>
              {tags.map((t) => (
                <Link key={t.id} href={`/tags/${t.slug}`} className="chip">
                  {t.name}
                  <span style={{ color: "var(--ink-3)", marginLeft: 8 }}>{t.postCount}</span>
                </Link>
              ))}
            </div>
          </Reveal>
        )}
      </div>
    </div>
  );
}
