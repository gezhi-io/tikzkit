import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { auditGalleryCases, renderAuditMarkdown } from "./gallery-audit-lib.js";
import { CIRCUITIKZ_ROOT, loadCircuitikzCases } from "./circuitikz-real-cases.js";

const outputRoot = "outputs/circuitikz";
const cases = await loadCircuitikzCases(CIRCUITIKZ_ROOT);
const summary = auditGalleryCases(cases);

await mkdir(outputRoot, { recursive: true });
await writeFile(path.join(outputRoot, "audit.json"), `${JSON.stringify(summary, null, 2)}\n`);
await writeFile(path.join(outputRoot, "audit.md"), renderAuditMarkdown(summary));

process.stdout.write(
  `circuitikz:audit ${summary.rendered}/${summary.totalCases} rendered, ${summary.totalDiagnostics} diagnostics\n`
);
