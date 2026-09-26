import { Fragment } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { q, siteUrl, ApiError } from "@/lib/api";
import { Breadcrumb, Reveal } from "@/components/primitives";
import { ContactForm } from "@/components/contact-form";
import { AdUnit } from "@/components/ads";
import { splitProse } from "@/lib/split-prose";

export const revalidate = 3600;

// Static pages live in the CMS (pages table), so this route renders *any* page
// that actually exists — including ones that arrived through a Blogger import
// (`/p/about-this-blog.html` → `/about-this-blog`). Only these three are
// prerendered at build time; everything else is resolved on demand and 404s
// through the API when the page genuinely does not exist.
const PRERENDERED = ["about", "contact", "privacy-policy"];

export function generateStaticParams() {
  return PRERENDERED.map((slug) => ({ slug }));
}

interface Props {
  params: Promise<{ page: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { page } = await params;
  try {
    const { item } = await q.page(page);
    return {
      title: item.title,
      description: item.seoDescription ?? undefined,
      alternates: { canonical: `${siteUrl()}/${item.slug}` },
    };
  } catch {
    return { title: "Page not found" };
  }
}

export default async function StaticPage({ params }: Props) {
  const { page } = await params;
  let payload;
  try {
    payload = await q.page(page);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const { item } = payload;
  const isContact = page === "contact";
  const isPrivacy = page === "privacy-policy";
  const isAbout = page === "about";
  // Text pages (about / privacy) get one mid-content ad unit at ~50%.
  const topPlacement = isAbout ? "about-top" : isContact ? "contact-top" : null;
  const belowPlacement = isAbout ? "about-below" : isContact ? "contact-below" : isPrivacy ? "privacy-below" : null;
  const parts = isContact ? [item.contentHtml] : splitProse(item.contentHtml, [0.5]);

  return (
    <div className="section" style={{ paddingTop: 140 }}>
      <div className="container">
        <Breadcrumb items={[{ label: item.title, href: undefined }]} />
        {topPlacement ? <AdUnit placement={topPlacement} /> : null}
        <article className="article" style={{ marginTop: 48 }}>
          <div className="article-head">
            <p className="article-kicker">page</p>
            <h1 className="article-title">{item.title}</h1>
          </div>

          {isContact ? (
            <Reveal>
              <ContactForm />
            </Reveal>
          ) : (
            <>
              {parts.map((part, i) => (
                <Fragment key={i}>
                  <Reveal>
                    <div className="prose" dangerouslySetInnerHTML={{ __html: part }} />
                  </Reveal>
                  {i === 0 && parts.length > 1 ? (
                    <AdUnit placement={isPrivacy ? "privacy-between" : "about-inline"} />
                  ) : null}
                </Fragment>
              ))}
            </>
          )}

          {belowPlacement ? <AdUnit placement={belowPlacement} /> : null}
        </article>
      </div>
    </div>
  );
}
