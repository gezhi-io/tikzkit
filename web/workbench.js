import * as tikzKitPublicApi from "../src/index.js";

export const SCRATCH_FIXTURE_ID = "tikzkit-scratch";

export function createScratchFixture() {
  return {
    id: SCRATCH_FIXTURE_ID,
    title: "Scratch source",
    isScratch: true,
    features: ["ad hoc source"],
    resources: [],
    tikztosvgSvgUrl: null,
    tikztosvgGridSvgUrl: null
  };
}

export function createScratchSource() {
  return String.raw`\begin{tikzpicture}
  \draw[-stealth] (0,0) -- (3,0) node[right] {$x$};
  \draw[-stealth] (0,0) -- (0,2) node[above] {$y$};
\end{tikzpicture}
`;
}

export function filterFixtures(fixtures = [], query = "") {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) return [...fixtures];
  return fixtures.filter((fixture) => {
    const haystack = [fixture.id, fixture.title, ...(fixture.features || [])].join(" ").toLowerCase();
    return haystack.includes(normalized);
  });
}

export function sourceOffsetForLocation(source, location = "") {
  const match = String(location || "").match(/^(\d+)(?::(\d+))?$/);
  if (!match) return null;

  const line = Number(match[1]);
  const column = Number(match[2] || 1);
  if (line < 1 || column < 1) return null;

  const lines = String(source || "").split("\n");
  if (line > lines.length) return null;
  const offset = lines.slice(0, line - 1).reduce((total, entry) => total + entry.length + 1, 0);
  return Math.min(offset + column - 1, offset + lines[line - 1].length);
}

export function isFixtureDraft(source, originalSource) {
  return String(source || "") !== String(originalSource || "");
}

export function svgDownloadName(fixtureId) {
  const basename = String(fixtureId || "tikzkit-render")
    .trim()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "tikzkit-render";
  return `${basename}.svg`;
}

export function createRequestGate() {
  let currentToken = 0;

  return {
    next() {
      currentToken += 1;
      return currentToken;
    },
    current() {
      return currentToken;
    },
    isCurrent(token) {
      return token === currentToken;
    }
  };
}

export function selectTikzRenderer(publicApi = tikzKitPublicApi) {
  return typeof publicApi.tikzToSvgAsync === "function"
    ? publicApi.tikzToSvgAsync
    : publicApi.tikzToSvg;
}

export async function renderWorkbenchSource(source, options = {}) {
  const started = Date.now();
  const renderer = selectTikzRenderer();
  if (typeof renderer !== "function") {
    throw new TypeError("TikZKit public API does not expose a renderer");
  }
  const result = await renderer(String(source || ""), {
    margin: 0,
    // Keep the workbench on the browser-focused math path. The SVG-text
    // fallback remains available explicitly for raster comparison tooling.
    mathRenderer: "katex",
    ...options
  });
  return {
    svg: result.svg,
    diagnostics: diagnosticRows(result.diagnostics),
    elapsedMs: Date.now() - started
  };
}

export function diagnosticRows(diagnostics = []) {
  return diagnostics.map((entry) => ({
    severity: entry.severity || "warning",
    code: entry.code || "tikz-diagnostic",
    message: entry.message || String(entry),
    location: Number.isFinite(entry.line)
      ? `${entry.line}:${Number.isFinite(entry.column) ? entry.column : 1}`
      : ""
  }));
}
