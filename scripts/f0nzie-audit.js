import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { auditGalleryCases, renderAuditMarkdown } from "./gallery-audit-lib.js";
import { F0NZIE_ROOT, loadF0nzieCases } from "./f0nzie-real-cases.js";

const outputRoot = "outputs/f0nzie-tikz-favorites";
const cases = await loadF0nzieCases(F0NZIE_ROOT);
const summary = auditGalleryCases(cases);

await mkdir(outputRoot, { recursive: true });
await writeFile(path.join(outputRoot, "audit.json"), `${JSON.stringify(summary, null, 2)}\n`);
await writeFile(path.join(outputRoot, "audit.md"), renderAuditMarkdown(summary));

process.stdout.write(
  `f0nzie:audit ${summary.rendered}/${summary.totalCases} rendered, ${summary.totalDiagnostics} diagnostics\n`
);
