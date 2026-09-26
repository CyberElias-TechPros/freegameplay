import type { Metadata } from "next";
import Link from "next/link";
import { q } from "@/lib/api";
import { Reveal, SectionHead, EmptyState } from "@/components/primitives";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Authors",
  description: "Everyone who writes for FreeGameplay.",
  alternates: { canonical: `/authors` },
};

export default async function AuthorsPage() {
  let authors;
  try {
    authors = (await q.authors()).items;
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
        <SectionHead index="A / Voices" title="Authors" thin={`${authors.length}`} />
        <div className="index-list">
          {authors.map((a, i) => (
            <Reveal key={a.id} delay={i * 0.03}>
              <div className="index-row" style={{ gridTemplateColumns: "56px 1fr 120px" }}>
                <span className="index-num" aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="index-main">
                  <h3>
                    <Link href={`/authors/${a.slug}`}>{a.name}</Link>
                  </h3>
                  {a.bio ? <p>{a.bio}</p> : null}
                </div>
                <div className="index-side">
                  <span>
                    <b>{a.postCount}</b> posts
                  </span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}
