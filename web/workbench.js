import * as tikzKitPublicApi from "../src/index.js";

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
  const result = await renderer(String(source || ""), options);
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
