// ─────────────────────────────────────────────────────────────────────────────
// Feed ingestion: RSS 2.0, generic Atom, and Blogger feeds → ImportRecords.
//
// This is the "pull content in by feed" path. It powers:
//   • one-click import of any RSS 2.0 / Atom feed (admin API + script)
//   • importing an old Blogspot blog from its public feed URL alone, e.g.
//       https://yourblog.blogspot.com/feeds/posts/default?alt=rss&max-results=500
//     (Blogger feeds carry full post content in <content:encoded>, so no
//      login or XML export is required.)
//
// Guarantees (same contract as the Blogger XML path):
//   • idempotent via source_id (feed guid / entry id)
//   • original publish dates preserved
//   • legacy URLs (the feed links) registered for 308 redirects
//   • images recorded as unresolved media for rights review (optional
//     download for Blogger-hosted media)
//   • comments are never present in feeds (nothing to do)
// ─────────────────────────────────────────────────────────────────────────────

import { DOMParser } from "@xmldom/xmldom";
import type { ImportMedia, ImportPage, ImportPost, ImportRecords } from "./types";
import { normalizeLegacyUrl, parseBloggerUrl, slugify } from "./slugs";
import { parseBloggerXml, type BloggerDiagnostic, type BloggerParseResult } from "./mapping";

// Types come from the parser itself (xmldom ships its own DOM typings).
const probe = new DOMParser().parseFromString("<x/>", "text/xml");
type XDocument = typeof probe;
type XElement = NonNullable<XDocument["documentElement"]>;

const ATOM = "http://www.w3.org/2005/Atom";
const CONTENT_NS = "http://purl.org/rss/1.0/modules/content/";
const DC_NS = "http://purl.org/dc/elements/1.1/";
const IMG_SRC_RE = /<img\b[^>]*\bsrc=["']([^"']+)["']/gi;
const MEDIA_THUMB_RE = /<media:thumbnail[^>]*\burl=["']([^"']+)["']/i;

export type FeedKind = "rss" | "atom" | "blogger";

/**
 * Detect what kind of feed XML we have.
 *  - <rss>            → classic RSS 2.0 (Blogger's alt=rss feed is RSS 2.0)
 *  - <feed> + blogger → Blogger Atom (exports or /feeds/posts/default)
 *  - <feed>           → generic Atom
 */
export function detectFeedKind(xml: string): FeedKind | null {
  const stripped = xml.replace(/<\?xml[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<!DOCTYPE[\s\S]*?>/g, "").trimStart();
  const m = stripped.match(/^<([a-zA-Z][\w:-]*)/);
  const root = m?.[1] ?? "";
  if (root === "rss") return "rss";
  if (root === "feed") {
    // Blogger Atom vs generic Atom. Every Blogger feed — export *or* public
    // posts feed — declares the Blogger namespace, so match on that as well as
    // on actual `blogger:` elements and the blogger.com/atom URI. A minimal
    // Blogger feed carrying only the declaration would otherwise fall into the
    // generic Atom parser and lose its legacy-URL mapping.
    if (
      /<blogger:/.test(xml) ||
      /xmlns:blogger\s*=\s*["'][^"']*(?:www\.blogger\.com\/atom|schemas\.google\.com\/blogger)/.test(xml) ||
      xml.includes("www.blogger.com/atom")
    ) {
      return "blogger";
    }
    return "atom";
  }
  return null;
}

export interface FeedParseResult extends BloggerParseResult {
  feedTitle: string | null;
  feedKind: FeedKind;
  /** true when no entry carried full content (every imported entry is a summary). */
  hasExcerptsOnly: boolean;
}

function childrenOf(el: XElement): XElement[] {
  const c = el.children;
  if (Array.isArray(c)) return [...c] as XElement[];
  return Array.from(c) as unknown as XElement[];
}

function childText(el: XElement | null | undefined, localName: string, ns?: string): string | null {
  if (!el) return null;
  const found = childrenOf(el).find((ch) => ch.localName === localName && (!ns || ch.namespaceURI === ns));
  return (found?.textContent ?? "").trim() || null;
}

function childElements(el: XElement, localName: string, ns?: string): XElement[] {
  return childrenOf(el).filter((ch) => ch.localName === localName && (!ns || ch.namespaceURI === ns));
}

function attr(el: XElement, name: string): string | null {
  return el.getAttribute(name) ?? null;
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

function excerptFrom(html: string, max = 220): string {
  const text = stripHtml(html);
  return text.length > max ? text.slice(0, max).replace(/\s+\S*$/, "") + "…" : text;
}

function extractImageUrls(html: string): string[] {
  const out: string[] = [];
  IMG_SRC_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = IMG_SRC_RE.exec(html)) !== null) {
    const u = m[1];
    if (u && /^https?:\/\//i.test(u)) out.push(u);
  }
  const t = MEDIA_THUMB_RE.exec(html);
  if (t?.[1]) out.push(t[1]);
  return out;
}

function metaImage(html: string): string | null {
  const m = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i);
  return m?.[1] ?? null;
}

function parseFeedDate(raw: string | null): { iso: string; ok: boolean } {
  if (!raw) return { iso: new Date().toISOString(), ok: false };
  const d = new Date(raw);
  return { iso: Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(), ok: !Number.isNaN(d.getTime()) };
}

/** Build a stable slug from a post URL (last path segment, .html stripped). */
function slugFromUrl(url: string, fallback: string): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean).pop() ?? "";
    const cleaned = seg.replace(/\.html?$/i, "");
    if (cleaned) return slugify(cleaned);
  } catch {
    /* fall through */
  }
  return slugify(fallback);
}

interface FeedItem {
  title: string;
  url: string | null;
  sourceId: string;
  contentHtml: string;
  hasFullContent: boolean;
  publishedAt: string;
  dateOk: boolean;
  author: string | null;
  tags: string[];
  imageUrl: string | null;
}

function emptyRecords(): ImportRecords {
  return { categories: [], tags: [], authors: [], games: [], posts: [], guides: [], pages: [], media: [] };
}

/** Parse RSS 2.0 (<rss><channel><item>) or generic Atom (<feed><entry>). */
function parseGenericFeed(doc: XDocument, kind: "rss" | "atom", rawXml: string): FeedParseResult {
  const diagnostics: BloggerDiagnostic[] = [];
  const root = doc.documentElement as XElement;
  const feedTitle = kind === "rss" ? childText(childElements(root, "channel")[0], "title") : childText(root, "title", ATOM);
  const mediaRefs = new Set<string>();
  const tagSet = new Set<string>();
  const authorSet = new Map<string, string>(); // slug → display name
  const posts: ImportPost[] = [];
  const pages: ImportPage[] = [];
  const seen = new Set<string>();
  let fullCount = 0;

  let entries: XElement[];
  let entriesTotal = 0;
  if (kind === "rss") {
    const channel = childElements(root, "channel")[0] ?? root;
    entries = childElements(channel, "item");
    entriesTotal = entries.length;
  } else {
    entries = childElements(root, "entry", ATOM);
    entriesTotal = entries.length;
  }
  if (entriesTotal === 0) diagnostics.push({ level: "warn", code: "NO_ENTRIES", message: "Feed parsed but contained no items/entries." });

  entries.forEach((el, i) => {
    const entryNo = i + 1;
    const title = (childText(el, "title") ?? childText(el, "title", ATOM)) ?? "(untitled)";

    // url: RSS <link> text; Atom <link rel="alternate">
    let url: string | null = null;
    if (kind === "rss") {
      url = childText(el, "link");
    } else {
      const links = childElements(el, "link", ATOM);
      const alt = links.find((l) => attr(l, "rel") === "alternate") ?? links[0];
      url = alt ? attr(alt, "href") : null;
    }
    const sourceId = (kind === "rss" ? childText(el, "guid") : childText(el, "id", ATOM)) ?? url ?? title;
    if (seen.has(sourceId)) {
      diagnostics.push({ level: "warn", code: "DUPLICATE_ENTRY", entry: entryNo, message: `Entry ${entryNo} ("${title}") duplicates an earlier guid/id; skipped.` });
      return;
    }
    seen.add(sourceId);

    // content: prefer full content, fall back to description/summary
    let contentHtml = "";
    let hasFullContent = false;
    if (kind === "rss") {
      contentHtml = childText(el, "encoded", CONTENT_NS) ?? "";
      hasFullContent = contentHtml.length > 0;
      if (!hasFullContent) contentHtml = childText(el, "description") ?? "";
    } else {
      const content = childElements(el, "content", ATOM)[0];
      const type = attr(content, "type");
      if (content) {
        if (type === "xhtml") {
          // serialize the XHTML children back to HTML
          const div = childrenOf(content)[0];
          contentHtml = div ? (div as unknown as { outerHTML?: string }).outerHTML ?? "" : "";
        } else {
          contentHtml = content.textContent ?? "";
        }
        hasFullContent = contentHtml.length > 0;
      }
      if (!hasFullContent) contentHtml = childText(el, "summary", ATOM) ?? "";
    }

    if (!contentHtml || contentHtml.trim().length === 0) {
      diagnostics.push({ level: "warn", code: "EMPTY_CONTENT", entry: entryNo, message: `Entry ${entryNo} ("${title}") has no content in the feed; skipped.` });
      return;
    }
    if (hasFullContent) fullCount++;
    if (!hasFullContent) {
      diagnostics.push({ level: "warn", code: "EXCERPT_ONLY", entry: entryNo, message: `Entry ${entryNo} ("${title}"): feed carries a summary only — imported content may be truncated.` });
    }

    // date
    const dateRaw = kind === "rss" ? childText(el, "pubDate") : childText(el, "published", ATOM) ?? childText(el, "updated", ATOM);
    const { iso, ok } = parseFeedDate(dateRaw);
    if (!ok) diagnostics.push({ level: "warn", code: "NO_DATE", entry: entryNo, message: `Entry ${entryNo} ("${title}") had no parseable date; using import time.` });

    // author
    let author: string | null = null;
    if (kind === "rss") {
      const dc = childText(el, "creator", DC_NS);
      if (dc) author = dc;
      else {
        const a = childText(el, "author"); // often an email address
        if (a) author = a.replace(/@.*$/, "").replace(/[._-]+/g, " ") || a;
      }
    } else {
      const au = childElements(el, "author", ATOM)[0];
      author = au ? childText(au, "name", ATOM) : null;
    }
    if (author) {
      const aslug = slugify(author);
      if (!authorSet.has(aslug)) authorSet.set(aslug, author);
    }

    // tags / categories
    const tags: string[] = [];
    if (kind === "rss") {
      for (const cEl of childElements(el, "category")) {
        const name = attr(cEl, "name") ?? (cEl.textContent ?? "").trim();
        if (name) tags.push(name);
      }
    } else {
      for (const cEl of childElements(el, "category", ATOM)) {
        const term = attr(cEl, "term") ?? attr(cEl, "label") ?? null;
        if (term) tags.push(term);
      }
    }
    for (const t of tags) tagSet.add(slugify(t));

    // featured image: enclosure → media:thumbnail → og:image → first <img>
    let imageUrl: string | null = null;
    if (kind === "rss") {
      const enc = childElements(el, "enclosure")[0];
      if (enc) {
        const etype = attr(enc, "type") ?? "";
        const eurl = attr(enc, "url");
        if (etype.startsWith("image/") && eurl) imageUrl = eurl;
      }
    } else {
      const enc = childElements(el, "enclosure", ATOM)[0];
      imageUrl = enc ? attr(enc, "url") : null;
    }
    if (!imageUrl) imageUrl = metaImage(contentHtml);
    if (!imageUrl) {
      const imgs = extractImageUrls(contentHtml);
      if (imgs.length > 0) imageUrl = imgs[0];
    }

    if (url) for (const u of extractImageUrls(contentHtml)) mediaRefs.add(u);
    if (imageUrl) mediaRefs.add(imageUrl);

    const legacy = url ? normalizeLegacyUrl(url) : null;
    const isBloggerPage = url ? parseBloggerUrl(url).kind === "page" : false;
    const slug = url ? slugFromUrl(url, title) : slugify(title);

    if (isBloggerPage) {
      pages.push({
        slug,
        title,
        contentHtml,
        sourceId,
        legacyUrl: legacy ?? undefined,
      });
      diagnostics.push({ level: "info", code: "PAGE", entry: entryNo, message: `Entry ${entryNo} ("${title}") is a static page → pages/${slug}` });
      return;
    }

    posts.push({
      slug,
      title,
      excerpt: excerptFrom(contentHtml),
      contentHtml,
      featuredImageUrl: imageUrl ?? undefined,
      author: author ? slugify(author) : undefined,
      tags,
      sourceId,
      legacyUrl: legacy ?? undefined,
      publishedAt: iso,
    });
    diagnostics.push({ level: "info", code: "POST", entry: entryNo, message: `Entry ${entryNo} → posts/${slug}${hasFullContent ? "" : " (summary only)"}` });
  });

  const media: ImportMedia[] = [...mediaRefs].map((url) => ({
    url,
    status: "unresolved" as const,
    notes: "Referenced by imported feed content — verify rights before use, or re-import with media download enabled.",
  }));
  const authors = [...authorSet.entries()].map(([slug, name]) => ({ slug, name }));
  const tagsOut = [...tagSet].map((slug) => ({ slug, name: slug.split("-").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ") }));

  return {
    records: { ...emptyRecords(), posts, pages, media, authors, tags: tagsOut },
    comments: [],
    mediaRefs: [...mediaRefs],
    diagnostics,
    totals: { entries: entriesTotal, posts: posts.length, pages: pages.length, comments: 0, labels: tagSet.size, images: mediaRefs.size },
    feedTitle,
    feedKind: kind,
    hasExcerptsOnly: entriesTotal > 0 && fullCount === 0,
  };
}

/**
 * Parse any supported feed (RSS 2.0 / Atom / Blogger). Blogger-shaped feeds
 * are delegated to the dedicated Blogger parser (same contract as the XML
 * export path). Returns null when the XML is not a recognizable feed.
 */
export function parseFeedXml(xml: string): FeedParseResult | null {
  const kind = detectFeedKind(xml);
  if (!kind) return null;
  if (kind === "blogger") {
    const parsed = parseBloggerXml(xml);
    const docProbe = new DOMParser().parseFromString(xml, "text/xml");
    const root = docProbe.documentElement;
    const title = root ? (childText(root as XElement, "title") ?? null) : null;
    return { ...parsed, feedTitle: title, feedKind: "blogger", hasExcerptsOnly: false };
  }
  let doc: XDocument;
  try {
    doc = new DOMParser().parseFromString(xml, "text/xml");
  } catch {
    return null;
  }
  if (!doc.documentElement) return null;
  return parseGenericFeed(doc, kind, xml);
}
