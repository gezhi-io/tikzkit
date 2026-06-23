import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { auditGalleryCases, renderAuditMarkdown } from "./gallery-audit-lib.js";
import { loadStructuralAnalysisCases, STRUCTURAL_ANALYSIS_ROOT } from "./structural-analysis-real-cases.js";

const outputRoot = "outputs/structural-analysis";
const cases = await loadStructuralAnalysisCases(STRUCTURAL_ANALYSIS_ROOT);
const summary = auditGalleryCases(cases);

await mkdir(outputRoot, { recursive: true });
await writeFile(path.join(outputRoot, "audit.json"), `${JSON.stringify(summary, null, 2)}\n`);
await writeFile(path.join(outputRoot, "audit.md"), renderAuditMarkdown(summary));

process.stdout.write(
  `structural-analysis:audit ${summary.rendered}/${summary.totalCases} rendered, ${summary.totalDiagnostics} diagnostics\n`
);
