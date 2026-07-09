import { tikzToSvgAsync } from "../src/index.js";

export async function renderWorkbenchSource(source, options = {}) {
  const started = Date.now();
  const result = await tikzToSvgAsync(String(source || ""), options);
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
