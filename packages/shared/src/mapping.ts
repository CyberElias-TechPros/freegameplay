// ─────────────────────────────────────────────────────────────────────────────
// Blogger XML (Atom 1.0 with Blogger extensions) → ImportRecords.
//
// A Blogger "Back up content" export is an Atom feed where:
//   • every post and static page is an <entry>
//   • <content type="html"> holds CDATA-wrapped HTML
//   • <category term="…"> carries labels
//   • <link rel="alternate" href="…"> holds the canonical legacy URL
//   • comments (when exported) appear as entries whose in-reply-to href
//     points at the parent post
//
// The parser is defensive: missing fields, unknown entries and absent
// namespaces must degrade to diagnostics, never a crash.
// ─────────────────────────────────────────────────────────────────────────────

import { DOMParser } from "@xmldom/xmldom";
import type { ImportMedia, ImportPage, ImportPost, ImportRecords } from "./types";
import { parseBloggerUrl, slugify } from "./slugs";

// Types come from the parser itself (xmldom ships its own DOM typings).
const probe = new DOMParser().parseFromString("<x/>", "text/xml");
type XDocument = typeof probe;
type XElement = NonNullable<XDocument["documentElement"]>;

export interface BloggerDiagnostic {
  level: "warn" | "info" | "error";
  code: string;
  message: string;
  entry?: number;
}

export interface BloggerParseResult {
  records: ImportRecords;
  comments: { legacyUrl: string; author: string; body: string; published: string }[];
  mediaRefs: string[];
  diagnostics: BloggerDiagnostic[];
  totals: { entries: number; posts: number; pages: number; comments: number; labels: number; images: number };
}

const ATOM = "http://www.w3.org/2005/Atom";

function childrenOf(el: XElement): XElement[] {
  const c = el.children;
  if (Array.isArray(c)) return [...c] as XElement[];
  return Array.from(c) as unknown as XElement[];
}

function childText(el: XElement | null | undefined, localName: string, ns?: string): string | null {
  if (!el) return null;
  const found = childrenOf(el).find(
    (ch) => ch.localName === localName && (!ns || ch.namespaceURI === ns),
  );
  return (found?.textContent ?? "").trim() || null;
}

function childElements(el: XElement, localName: string, ns?: string): XElement[] {
  return childrenOf(el).filter((ch) => ch.localName === localName && (!ns || ch.namespaceURI === ns));
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;|&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const IMG_SRC_RE = /<img\b[^>]*\bsrc=["']([^"']+)["']/gi;

function extractImageUrls(html: string): string[] {
  const out: string[] = [];
  IMG_SRC_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = IMG_SRC_RE.exec(html)) !== null) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}

function attr(el: XElement | null | undefined, name: string): string | null {
  if (!el) return null;
  return (el as unknown as { getAttribute?: (n: string) => string | null }).getAttribute?.(name) ?? null;
}

function isCommentEntry(entry: XElement): boolean {
  if (childElements(entry, "in-reply-to").length > 0) return true;
  // Blogger exports mark comments with <blogger:comment>1</blogger:comment>
  if (childElements(entry, "comment").some((el) => (el.textContent ?? "").trim() === "1")) return true;
  // …and their ids carry a ".comment-…" suffix
  if ((childText(entry, "id", ATOM) ?? "").includes(".comment-")) return true;
  return childElements(entry, "category", ATOM).some((c) => (attr(c, "term") ?? "").toLowerCase() === "comment");
}

function isoDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const emptyResult = (diagnostics: BloggerDiagnostic[]): BloggerParseResult => ({
  records: { categories: [], tags: [], authors: [], games: [], posts: [], guides: [], pages: [], media: [] },
  comments: [],
  mediaRefs: [],
  diagnostics,
  totals: { entries: 0, posts: 0, pages: 0, comments: 0, labels: 0, images: 0 },
});

export function parseBloggerXml(xml: string): BloggerParseResult {
  const diagnostics: BloggerDiagnostic[] = [];
  const mediaRefs = new Set<string>();
  const records: ImportRecords = { categories: [], tags: [], authors: [], games: [], posts: [], guides: [], pages: [], media: [] };
  const comments: BloggerParseResult["comments"] = [];
  const labelSet = new Set<string>();
  const authorSet = new Set<string>();
  let entriesSeen = 0;
  let pagesCount = 0;

  let doc: XDocument;
  try {
    doc = new DOMParser().parseFromString(xml, "text/xml");
  } catch (e) {
    diagnostics.push({ level: "error", code: "XML_PARSE", message: String(e) });
    return emptyResult(diagnostics);
  }
  const parserErrors = ((doc as unknown as { getElementsByTagName?: (n: string) => unknown[] }).getElementsByTagName?.("parsererror") ?? []).length;
  if (parserErrors > 0) {
    diagnostics.push({ level: "error", code: "XML_PARSE", message: "XML is not well-formed" });
    return emptyResult(diagnostics);
  }

  const getTags = (name: string): XElement[] => {
    const g = (doc as unknown as { getElementsByTagName?: (n: string) => unknown[] }).getElementsByTagName?.(name);
    return (g ?? []) as unknown as XElement[];
  };
  const getTagsNS = (ns: string, name: string): XElement[] => {
    const g = (doc as unknown as { getElementsByTagNameNS?: (ns: string, n: string) => unknown[] }).getElementsByTagNameNS?.(ns, name);
    return (g ?? []) as unknown as XElement[];
  };

  const entries = getTagsNS(ATOM, "entry").length > 0 ? getTagsNS(ATOM, "entry") : getTags("entry");

  for (const entry of entries) {
    entriesSeen++;
    const idx = entriesSeen;
    const title = childText(entry, "title", ATOM) ?? "";
    const contentEl = childElements(entry, "content", ATOM)[0] ?? childElements(entry, "content")[0];
    const contentHtml = contentEl?.textContent ?? "";
    const published = isoDate(childText(entry, "published", ATOM));
    const updated = isoDate(childText(entry, "updated", ATOM));
    const authorEl = childElements(entry, "author", ATOM)[0];
    const authorName = (authorEl && childText(authorEl, "name")) || "Blogger Author";
    const linkEl = childrenOf(entry).find((ch) => ch.localName === "link" && attr(ch, "rel") === "alternate");
    const legacyUrl = attr(linkEl ?? null, "href");
    const cats = childElements(entry, "category", ATOM).map((c) => attr(c, "term") ?? "").filter(Boolean);

    authorSet.add(authorName);

    if (isCommentEntry(entry)) {
      const parentLink = attr(childElements(entry, "in-reply-to")[0] ?? null, "href") ?? legacyUrl ?? "";
      comments.push({
        legacyUrl: parentLink,
        author: authorName,
        body: contentHtml,
        published: published ?? updated ?? "",
      });
      continue;
    }
    if (!legacyUrl) {
      diagnostics.push({ level: "warn", code: "NO_LEGACY_URL", message: `Entry ${idx} ("${title}") has no alternate link; skipped URL mapping.`, entry: idx });
    }
    const parsedUrl = legacyUrl ? parseBloggerUrl(legacyUrl) : null;

    for (const c of cats) labelSet.add(c);

    if (parsedUrl?.kind === "page") {
      pagesCount++;
      const slug = parsedUrl.slug ? slugify(parsedUrl.slug) : slugify(title);
      const page: ImportPage = {
        slug,
        title,
        contentHtml,
        sourceId: parsedUrl.slug ?? title,
      };
      if (legacyUrl) page.legacyUrl = legacyUrl;
      records.pages.push(page);
      diagnostics.push({ level: "info", code: "PAGE", message: `Static page → /${slug}`, entry: idx });
      for (const u of extractImageUrls(contentHtml)) mediaRefs.add(u);
      continue;
    }

    if (parsedUrl?.kind !== "post" && parsedUrl?.kind !== "other") {
      diagnostics.push({ level: "info", code: "ARCHIVE_SKIPPED", message: `Entry ${idx} ("${title}") maps to an archive URL; skipped.`, entry: idx });
      continue;
    }

    const urlSlug = parsedUrl?.slug && parsedUrl.slug !== "index" ? slugify(parsedUrl.slug) : null;
    const slug = urlSlug && urlSlug.length > 1 ? urlSlug : slugify(title);
    const excerpt = stripHtml(contentHtml).slice(0, 220);

    // Content-type heuristics: entries labelled guide/walkthrough/tips become
    // guides; everything else is a post. Games are curated in the CMS — a
    // Blogger export never contains structured game records.
    const labelLower = new Set(cats.map((c) => c.toLowerCase()));
    const isGuide = labelLower.has("guide") || labelLower.has("walkthrough") || labelLower.has("tips");

    const post: ImportPost = {
      slug,
      title,
      excerpt,
      contentHtml,
      tags: Array.from(labelLower),
      publishedAt: published ?? undefined,
      author: slugify(authorName),
      sourceId: legacyUrl ? `blogger:${slug}` : undefined,
    };
    if (labelLower.size > 0) post.category = Array.from(labelLower)[0];
    if (legacyUrl) post.legacyUrl = legacyUrl;

    const imgs = extractImageUrls(contentHtml);
    for (const u of imgs) mediaRefs.add(u);
    if (imgs[0]) post.featuredImageUrl = imgs[0];

    if (isGuide) {
      records.guides.push(post as ImportPost & { contentHtml: string });
    } else {
      records.posts.push(post);
    }
    diagnostics.push({
      level: "info",
      code: isGuide ? "GUIDE" : "POST",
      message: `Entry ${idx} → ${isGuide ? "guides" : "posts"}/${slug} (${imgs.length} image ref${imgs.length === 1 ? "" : "s"})`,
      entry: idx,
    });
  }

  records.tags = [...labelSet].map((l) => ({ slug: slugify(l), name: l }));
  records.categories = records.tags.slice(0, 12).map((t, i) => ({ slug: t.slug, name: t.name, sortOrder: i }));
  records.authors = [...authorSet].map((a) => ({ slug: slugify(a), name: a }));

  // Media inventory: external images referenced by content. Recorded as
  // "unresolved" so editors decide what to transfer (rights first).
  const media: ImportMedia[] = [...mediaRefs].map((url) => ({
    url,
    status: "unresolved",
    notes: "Referenced in imported HTML. Review rights before transferring to R2.",
  }));
  records.media = media;

  if (entries.length === 0) {
    diagnostics.push({ level: "warn", code: "NO_ENTRIES", message: "Feed contains no <entry> elements." });
  }

  return {
    records,
    comments,
    mediaRefs: [...mediaRefs],
    diagnostics,
    totals: {
      entries: entriesSeen,
      posts: records.posts.length,
      pages: pagesCount,
      comments: comments.length,
      labels: labelSet.size,
      images: mediaRefs.size,
    },
  };
}
