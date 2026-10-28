import sanitize from "sanitize-html";

/** The shared rich-content boundary. No script, style, form, SVG or embed markup. */
export function sanitizeContent(html: unknown): string {
  if (typeof html !== "string") return "";
  return sanitize(html, {
    allowedTags: ["p", "br", "h2", "h3", "h4", "h5", "h6", "strong", "b", "em", "i", "u", "s", "blockquote", "pre", "code", "ul", "ol", "li", "a", "img", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td", "hr", "span", "div", "kbd"],
    allowedAttributes: { a: ["href", "title"], img: ["src", "alt", "width", "height", "loading"], th: ["scope", "colspan", "rowspan"], td: ["colspan", "rowspan"] },
    allowedSchemes: ["https", "mailto"],
    allowedSchemesByTag: { img: ["https"] },
    allowProtocolRelative: false,
    transformTags: { a: sanitize.simpleTransform("a", { rel: "noopener noreferrer" }), img: sanitize.simpleTransform("img", { loading: "lazy" }) },
  });
}

