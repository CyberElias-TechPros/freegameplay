import type { Metadata } from "next";
import { q } from "@/lib/api";
import { GuideCard } from "@/components/cards";
import { Reveal, SectionHead, EmptyState, Pagination } from "@/components/primitives";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Guides",
  description: "Step-by-step guides for the games on FreeGameplay — no paywalls, no fluff.",
  openGraph: { title: "Guides · FreeGameplay" },
};

const PAGE_SIZE = 8;

export default async function GuidesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; game?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const game = params.game ?? undefined;

  let data;
  try {
    data = await q.guides({ page: String(page), pageSize: String(PAGE_SIZE), game });
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
      <SectionHead index="03 / Learn" title="Guides" thin={`${data.total}`} />
      {data.items.length === 0 ? (
        <EmptyState code="NO_GUIDES" title="No guides yet" note="Guides land here as soon as they're written." />
      ) : (
        <div className="guide-grid">
          {data.items.map((g, i) => (
            <Reveal key={g.id} delay={Math.min(i, 6) * 0.04}>
              <GuideCard guide={g} />
            </Reveal>
          ))}
        </div>
      )}
      <Pagination page={data.page} pages={data.pages} basePath="/guides" query={game ? { game } : {}} />
    </div>
  );
}
