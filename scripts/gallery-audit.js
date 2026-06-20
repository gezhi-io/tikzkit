import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { REAL_GALLERY_CASES } from "../web/real-gallery-data.js";
import { auditGalleryCases, renderAuditMarkdown } from "./gallery-audit-lib.js";

const outputRoot = "outputs/real-gallery";
await mkdir(outputRoot, { recursive: true });

const summary = auditGalleryCases(REAL_GALLERY_CASES);
await writeFile(path.join(outputRoot, "audit.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
await writeFile(path.join(outputRoot, "summary.md"), renderAuditMarkdown(summary), "utf8");

process.stdout.write(
  `gallery:audit ${summary.rendered}/${summary.totalCases} rendered, ${summary.totalDiagnostics} diagnostics\n`
);

if (summary.totalDiagnostics > 0) {
  process.exitCode = 1;
}
