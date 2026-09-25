import type { Metadata } from "next";
import Link from "next/link";
import { q } from "@/lib/api";
import { Reveal, SectionHead, EmptyState } from "@/components/primitives";
import { AdUnit } from "@/components/ads";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Categories",
  description: "Browse the FreeGameplay library by category.",
};

export default async function CategoriesPage() {
  let cats;
  try {
    cats = (await q.categories()).items;
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
      <SectionHead index="A / Browse" title="Categories" thin={`${cats.length}`} />
      <div className="index-list">
        {cats.map((c, i) => (
          <Reveal key={c.id} delay={i * 0.03}>
            <div className="index-row" style={{ gridTemplateColumns: "56px 1fr 120px" }}>
              <span className="index-num" aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="index-main">
                <h3>
                  <Link href={`/categories/${c.slug}`}>{c.name}</Link>
                </h3>
                {c.description ? <p>{c.description}</p> : null}
              </div>
              <div className="index-side">
                <span>
                  <b>view</b> →
                </span>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
      <AdUnit placement="list-below" />
    </div>
  );
}
