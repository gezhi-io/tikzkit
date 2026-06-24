import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadRealGalleryCases } from "./gallery-case-source.js";
import { auditGalleryCases, renderAuditMarkdown } from "./gallery-audit-lib.js";

const outputRoot = "outputs/real-gallery";
await mkdir(outputRoot, { recursive: true });

const gallery = await loadRealGalleryCases();
const summary = auditGalleryCases(gallery.cases);
await writeFile(path.join(outputRoot, "audit.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
await writeFile(path.join(outputRoot, "summary.md"), renderAuditMarkdown(summary), "utf8");

process.stdout.write(
  `gallery:audit ${gallery.id} ${summary.rendered}/${summary.totalCases} rendered, ${summary.totalDiagnostics} diagnostics\n`
);

if (summary.totalDiagnostics > 0) {
  process.exitCode = 1;
}
