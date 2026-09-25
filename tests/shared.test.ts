// Unit tests for the pure logic in @fg/shared.
//
//   npm test                     (from the repo root)
//   npm run test:watch
//
// These run on Node's built-in test runner with type stripping — no build step
// and no test framework dependency, so `npm ci` is enough to run them.

import test from "node:test";
import assert from "node:assert/strict";

import { parseBloggerUrl, normalizeLegacyUrl, readingTime, slugify } from "../packages/shared/src/slugs.ts";
import { parseBloggerXml } from "../packages/shared/src/mapping.ts";
import { detectFeedKind, parseFeedXml } from "../packages/shared/src/rss.ts";

// ── slugify ──────────────────────────────────────────────────────────────────

test("slugify: lowercases, de-accented, hyphenated", () => {
  assert.equal(slugify("Hello World"), "hello-world");
  assert.equal(slugify("Café & Bar"), "cafe-and-bar");
  assert.equal(slugify("  Multiple   Spaces  "), "multiple-spaces");
  assert.equal(slugify("Ünïcödé Tëst"), "unicode-test");
});

test("slugify: never returns an empty slug", () => {
  assert.equal(slugify(""), "untitled");
  assert.equal(slugify("!!!"), "untitled");
  assert.equal(slugify("---"), "untitled");
});

test("slugify: truncates very long input", () => {
  assert.ok(slugify("a".repeat(300)).length <= 96);
});

// ── parseBloggerUrl ──────────────────────────────────────────────────────────

test("parseBloggerUrl: dated post", () => {
  assert.deepEqual(parseBloggerUrl("/2024/05/some-post-title.html"), {
    kind: "post",
    slug: "some-post-title",
    year: 2024,
    month: 5,
  });
});

test("parseBloggerUrl: static page", () => {
  assert.deepEqual(parseBloggerUrl("/p/about-us.html"), { kind: "page", slug: "about-us", year: null, month: null });
});

test("parseBloggerUrl: archives carry no slug", () => {
  assert.equal(parseBloggerUrl("/2024/05.html").kind, "archive");
  assert.equal(parseBloggerUrl("/2024.html").kind, "archive");
  assert.equal(parseBloggerUrl("/search/label/arcade.html").kind, "archive");
});

test("parseBloggerUrl: absolute URLs reduce to their path", () => {
  assert.equal(parseBloggerUrl("https://old.blogspot.com/2024/05/a-post.html").slug, "a-post");
});

test("parseBloggerUrl: query strings are dropped", () => {
  assert.equal(parseBloggerUrl("/2024/05/a-post.html?m=1").slug, "a-post");
});

// ── normalizeLegacyUrl ───────────────────────────────────────────────────────

test("normalizeLegacyUrl: absolute → path", () => {
  assert.equal(normalizeLegacyUrl("https://www.old.com/2024/05/a-post.html"), "/2024/05/a-post.html");
});

test("normalizeLegacyUrl: keeps query strings, drops the trailing slash", () => {
  assert.equal(normalizeLegacyUrl("/search/label/arcade?m=1"), "/search/label/arcade?m=1");
  assert.equal(normalizeLegacyUrl("/p/about/"), "/p/about");
});

test("normalizeLegacyUrl: bare paths are rooted", () => {
  assert.equal(normalizeLegacyUrl("2024/05/a-post.html"), "/2024/05/a-post.html");
});

// ── readingTime ──────────────────────────────────────────────────────────────

test("readingTime: counts words, never below one minute", () => {
  assert.equal(readingTime("<p>short</p>"), 1);
  assert.equal(readingTime(`<p>${"word ".repeat(600)}</p>`), 3);
  assert.equal(readingTime("<p>a<br>b</p>"), 1);
});

// ── detectFeedKind ───────────────────────────────────────────────────────────

test("detectFeedKind: recognises the three shapes", () => {
  // Blogger Atom is told apart from generic Atom by its namespace markers.
  assert.equal(detectFeedKind(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:blogger="http://schemas.google.com/blogger/2018"><entry/></feed>`), "blogger");
  assert.equal(detectFeedKind(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><link rel="alternate" href="https://www.blogger.com/atom/7712345678901234"/></entry></feed>`), "blogger");
  assert.equal(detectFeedKind(`<?xml version="1.0"?><rss version="2.0"><channel/></rss>`), "rss");
  assert.equal(detectFeedKind(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>x</title></feed>`), "atom");
  // Unrecognised roots are reported as null (the caller turns that into a
  // 400 with a helpful message) — never as a throw.
  assert.equal(detectFeedKind("<html><body>nope</body></html>"), null);
  assert.equal(detectFeedKind(""), null);
  assert.equal(detectFeedKind("not xml at all"), null);
});

// ── parseFeedXml ─────────────────────────────────────────────────────────────

const RSS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Old Arcade Blog</title>
    <link>https://oldarcade.blogspot.com/</link>
    <item>
      <title>Why I Built My First Browser Game</title>
      <link>https://oldarcade.blogspot.com/2016/05/why-i-built-my-first-browser-game.html</link>
      <guid isPermaLink="true">tag:blogger.com,1999:blog-1.post-501</guid>
      <pubDate>Thu, 12 May 2016 21:14:00 +0000</pubDate>
      <dc:creator>Elias</dc:creator>
      <category>retro</category>
      <description>It started with a broken keyboard.</description>
      <content:encoded><![CDATA[<p>Full body with an <img src="https://1.bp.blogspot.com/x/s1600/pic.jpg"/> image.</p>]]></content:encoded>
    </item>
    <item>
      <title>Second Post</title>
      <link>https://oldarcade.blogspot.com/2017/01/second-post.html</link>
      <pubDate>Mon, 02 Jan 2017 10:00:00 +0000</pubDate>
      <description>Summary only, no content.</description>
    </item>
  </channel>
</rss>`;

test("parseFeedXml: extracts posts, dates and legacy URLs", () => {
  const parsed = parseFeedXml(RSS_FIXTURE);
  assert.ok(parsed, "fixture should parse");
  assert.equal(parsed.records.posts.length, 2);

  const first = parsed.records.posts[0];
  assert.equal(first.slug, "why-i-built-my-first-browser-game");
  assert.equal(first.publishedAt, "2016-05-12T21:14:00.000Z");
  // Legacy URLs are normalised to paths — that is the form the redirect
  // registry keys on, so an absolute feed link and a bare path collide
  // correctly on re-import.
  assert.equal(first.legacyUrl, "/2016/05/why-i-built-my-first-browser-game.html");
  assert.equal(first.author, "elias");
  assert.ok(first.contentHtml?.includes("Full body"));
  assert.equal(first.featuredImageUrl, "https://1.bp.blogspot.com/x/s1600/pic.jpg");
});

test("parseFeedXml: summary-only entries are imported with their date", () => {
  const parsed = parseFeedXml(RSS_FIXTURE);
  assert.equal(parsed.records.posts[1].slug, "second-post");
  assert.equal(parsed.records.posts[1].publishedAt, "2017-01-02T10:00:00.000Z");
  // The fixture has one full-content entry, so the feed is not summary-only.
  assert.equal(parsed.hasExcerptsOnly, false);
});

test("parseFeedXml: a feed of pure summaries is flagged hasExcerptsOnly", () => {
  const summaryOnly = `<?xml version="1.0"?><rss version="2.0"><channel><title>Summaries</title>
    <item><title>One</title><link>https://x.blogspot.com/2019/01/one.html</link><description>Just a summary.</description></item>
    <item><title>Two</title><link>https://x.blogspot.com/2019/02/two.html</link><description>Another summary.</description></item>
  </channel></rss>`;
  const parsed = parseFeedXml(summaryOnly);
  assert.ok(parsed);
  assert.equal(parsed.records.posts.length, 2);
  assert.equal(parsed.hasExcerptsOnly, true);
  assert.ok(parsed.diagnostics.some((d) => d.code === "EXCERPT_ONLY"));
});

test("parseFeedXml: images are recorded for rights review", () => {
  const parsed = parseFeedXml(RSS_FIXTURE);
  assert.equal(parsed.records.media.length, 1);
  assert.equal(parsed.records.media[0].status, "unresolved");
});

test("parseFeedXml: re-running is idempotent by sourceId", () => {
  const a = parseFeedXml(RSS_FIXTURE);
  const b = parseFeedXml(RSS_FIXTURE);
  assert.deepEqual(
    a.records.posts.map((p) => p.sourceId),
    b.records.posts.map((p) => p.sourceId),
  );
});

test("parseFeedXml: malformed XML returns null instead of throwing", () => {
  assert.equal(parseFeedXml("<rss><channel><item><title>unclosed"), null);
});

test("parseFeedXml: empty channel parses to zero records", () => {
  const parsed = parseFeedXml(`<?xml version="1.0"?><rss version="2.0"><channel><title>Empty</title></channel></rss>`);
  assert.ok(parsed);
  assert.equal(parsed.records.posts.length, 0);
  assert.equal(parsed.totals.entries, 0);
});

// ── parseBloggerXml ──────────────────────────────────────────────────────────

const BLOGGER_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:blogger="http://schemas.google.com/blogger/2018">
  <title>Old Arcade Blog</title>
  <entry>
    <id>tag:blogger.com,1999:blog-1.post-1</id>
    <published>2016-05-12T21:14:00.000Z</published>
    <updated>2016-05-13T09:00:00.000Z</updated>
    <category scheme="http://www.blogger.com/atom/ns#" term="retro"/>
    <title type="text">Why I Built My First Browser Game</title>
    <content type="html">&lt;p&gt;Body text.&lt;/p&gt;</content>
    <link rel="alternate" type="text/html" href="https://freegameplay.site/2016/05/why-i-built-my-first-browser-game.html"/>
    <author><name>Elias</name></author>
  </entry>
  <entry>
    <id>tag:blogger.com,1999:blog-1.post-2</id>
    <published>2017-02-01T10:00:00.000Z</published>
    <category scheme="http://www.blogger.com/atom/ns#" term="guide"/>
    <title type="text">How To Beat Level 5</title>
    <content type="html">&lt;p&gt;Guide body.&lt;/p&gt;</content>
    <link rel="alternate" type="text/html" href="https://freegameplay.site/2017/02/how-to-beat-level-5.html"/>
    <author><name>Elias</name></author>
  </entry>
  <entry>
    <id>tag:blogger.com,1999:blog-1.page-1</id>
    <published>2015-01-01T00:00:00.000Z</published>
    <title type="text">About This Blog</title>
    <content type="html">&lt;p&gt;About body.&lt;/p&gt;</content>
    <link rel="alternate" type="text/html" href="https://freegameplay.site/p/about-this-blog.html"/>
    <author><name>Elias</name></author>
  </entry>
  <entry>
    <id>tag:blogger.com,1999:blog-1.post-1.comment-1</id>
    <published>2016-05-13T08:00:00.000Z</published>
    <title type="text">Nice post!</title>
    <content type="html">Loved it.</content>
    <link rel="replies" type="text/html" href="https://freegameplay.site/2016/05/why-i-built-my-first-browser-game.html"/>
    <link rel="alternate" type="text/html" href="https://freegameplay.site/2016/05/why-i-built-my-first-browser-game.html#comment-1"/>
    <author><name>Reader</name></author>
  </entry>
</feed>`;

test("parseBloggerXml: splits posts, guides, pages and comments", () => {
  const parsed = parseBloggerXml(BLOGGER_FIXTURE);
  assert.equal(parsed.records.posts.length, 1);
  assert.equal(parsed.records.guides.length, 1);
  assert.equal(parsed.records.pages.length, 1);
  assert.equal(parsed.comments.length, 1);
  assert.equal(parsed.totals.entries, 4);
});

test("parseBloggerXml: guide label routes the entry to guides", () => {
  const parsed = parseBloggerXml(BLOGGER_FIXTURE);
  assert.equal(parsed.records.guides[0].slug, "how-to-beat-level-5");
});

test("parseBloggerXml: original publish dates are preserved", () => {
  const parsed = parseBloggerXml(BLOGGER_FIXTURE);
  assert.equal(parsed.records.posts[0].publishedAt, "2016-05-12T21:14:00.000Z");
});

test("parseBloggerXml: legacy URLs survive for the redirect registry", () => {
  const parsed = parseBloggerXml(BLOGGER_FIXTURE);
  assert.equal(parsed.records.posts[0].legacyUrl, "https://freegameplay.site/2016/05/why-i-built-my-first-browser-game.html");
  assert.equal(parsed.records.pages[0].legacyUrl, "https://freegameplay.site/p/about-this-blog.html");
});

test("parseBloggerXml: labels become tags", () => {
  const parsed = parseBloggerXml(BLOGGER_FIXTURE);
  assert.ok(parsed.records.tags.some((t) => t.slug === "retro"));
  assert.ok(parsed.records.tags.some((t) => t.slug === "guide"));
});

test("parseBloggerXml: malformed XML yields an error diagnostic, not a throw", () => {
  const parsed = parseBloggerXml("<feed><entry><title>unclosed");
  assert.ok(parsed.diagnostics.some((d) => d.level === "error"));
  assert.equal(parsed.records.posts.length, 0);
});

test("parseBloggerXml: empty feed is a warning, not a crash", () => {
  const parsed = parseBloggerXml(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Empty</title></feed>`);
  assert.ok(parsed.diagnostics.some((d) => d.code === "NO_ENTRIES"));
});
