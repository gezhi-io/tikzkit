import { REAL_GALLERY_CASES, REAL_GALLERY_SUMMARY } from "./real-gallery-data.js";

export function createSampleGallery(count = REAL_GALLERY_CASES.length) {
  return createGalleryMarkdown(REAL_GALLERY_CASES.slice(0, count), REAL_GALLERY_SUMMARY);
}

export function createGalleryMarkdown(cases, summary = {}) {
  const sections = [
    `Real TikZ gallery: ${cases.length} fenced TikZ blocks from public TikZ example repositories, TikZ.net, MacTeX docs, and loaded corpus libraries.`,
    `Sources: ${formatOrigins(
      summary.origins || [...new Set(cases.map((item) => item.origin))]
    )}. The gallery is used as a live regression surface for parser diagnostics and MacTeX visual comparison reports.`
  ];

  for (const [index, item] of cases.entries()) {
    sections.push([
      `Case ${String(index + 1).padStart(3, "0")} - ${item.origin} - ${item.title}`,
      `Source: ${item.sourceUrl}`,
      "",
      "'''tikz",
      item.source.trim(),
      "'''"
    ].join("\n"));
  }

  return sections.join("\n\n");
}

function formatOrigins(origins = []) {
  return origins.join(", ");
}
