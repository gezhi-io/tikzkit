import { tikzToSvg } from "../src/index.js";

export function auditGalleryCases(cases) {
  const rows = cases.map((item, index) => {
    const result = tikzToSvg(item.source);
    return {
      id: String(index + 1).padStart(3, "0"),
      origin: item.origin,
      path: item.path,
      sourceUrl: item.sourceUrl,
      diagnostics: result.diagnostics.map((diagnostic) => ({
        severity: diagnostic.severity,
        message: diagnostic.message
      })),
      irItems: result.ir.items.length,
      svgBytes: result.svg.length
    };
  });
  return {
    totalCases: rows.length,
    rendered: rows.filter((row) => row.svgBytes > 0).length,
    totalDiagnostics: rows.reduce((total, row) => total + row.diagnostics.length, 0),
    casesWithDiagnostics: rows.filter((row) => row.diagnostics.length > 0).length,
    rows
  };
}

export function renderAuditMarkdown(summary) {
  const lines = [
    "# Real Gallery Audit",
    "",
    `- cases: ${summary.totalCases}`,
    `- rendered: ${summary.rendered}`,
    `- diagnostics: ${summary.totalDiagnostics}`,
    `- cases with diagnostics: ${summary.casesWithDiagnostics}`,
    "",
    "| Case | Origin | Source | Diagnostics | IR items |",
    "| - | - | - | - | - |"
  ];
  for (const row of summary.rows) {
    const diagnostics = row.diagnostics.length
      ? row.diagnostics.map((diagnostic) => diagnostic.message).join("<br>")
      : "none";
    lines.push(`| ${row.id} | ${row.origin} | ${row.path} | ${diagnostics} | ${row.irItems} |`);
  }
  lines.push("");
  return lines.join("\n");
}
