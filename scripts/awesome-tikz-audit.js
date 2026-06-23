import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  loadAwesomeTikzCatalog,
  renderAwesomeTikzCoverageMarkdown,
  summarizeAwesomeTikzCoverage
} from "./awesome-tikz-catalog.js";

const outputRoot = "outputs/awesome-tikz";
const catalog = await loadAwesomeTikzCatalog();
const summary = summarizeAwesomeTikzCoverage(catalog);

await mkdir(outputRoot, { recursive: true });
await writeFile(path.join(outputRoot, "coverage.json"), `${JSON.stringify({ ...summary, resources: catalog.resources }, null, 2)}\n`);
await writeFile(path.join(outputRoot, "coverage.md"), `${renderAwesomeTikzCoverageMarkdown(catalog)}\n`);

process.stdout.write(
  `awesome-tikz:audit ${summary.supportedResources}/${summary.totalResources} resources mapped, ${summary.supportedPackages}/${summary.packageResources} packages mapped\n`
);
