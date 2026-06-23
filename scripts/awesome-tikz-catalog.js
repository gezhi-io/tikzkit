import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const AWESOME_TIKZ_ROOT = "work/awesome-TikZ";
export const AWESOME_TIKZ_README = "README.md";
export const AWESOME_TIKZ_EXPECTED_RESOURCE_COUNT = 299;
export const AWESOME_TIKZ_REPOSITORY_URL = "https://github.com/maphy-psd/awesome-TikZ";

const SUPPORT_MAP = new Map(
  [
    ["pgf", ["core-subset", "Core PGF/TikZ parser, interpreter, and SVG renderer."]],
    ["pgfplots", ["core-subset", "Common axis/addplot/function/table subset."]],
    ["pgfplotstable", ["core-subset", "Common setup/table statements and PGFPlots table inputs."]],
    ["circuitikz", ["corpus-subset", "circuitikz environment alias plus manual snippet corpus coverage."]],
    ["braids", ["compat-subset", "Small braid command compatibility layer used by current gallery cases."]],
    ["tikz-3dplot", ["extension-subset", "Built-in preprocess extension."]],
    ["tikz-bayesnet", ["extension-subset", "Built-in preprocess extension and library style support."]],
    ["tikz-bagua", ["extension-subset", "Built-in preprocess extension."]],
    ["tikz-bbox", ["core-subset", "Built-in bbox library behavior for Bezier/current bounding box."]],
    ["tikz-cd", ["extension-subset", "Built-in preprocess extension."]],
    ["tikz-dimline", ["extension-subset", "Built-in preprocess extension."]],
    ["tikz-ext", ["extension-subset", "Built-in preprocess extension."]],
    ["tikz-feynhand", ["extension-subset", "Built-in preprocess extension."]],
    ["tikz-feynman", ["extension-subset", "Built-in preprocess extension."]],
    ["tikz-network", ["extension-subset", "Built-in preprocess extension and external corpus."]],
    ["tikz-palattice", ["extension-subset", "Built-in preprocess extension."]],
    ["tikz-qtree", ["extension-subset", "Built-in preprocess extension."]],
    ["tikzquads", ["extension-subset", "Built-in preprocess extension."]],
    ["stanli", ["extension-subset", "Built-in preprocess extension and StructuralAnalysis corpus."]],
    ["tkz-graph", ["compat-subset", "Small tkz-graph compatibility layer used by current gallery cases."]]
  ].map(([name, details]) => [normalizeName(name), details])
);

export function hasAwesomeTikzCatalog(root = AWESOME_TIKZ_ROOT) {
  return existsSync(path.join(root, AWESOME_TIKZ_README));
}

export async function loadAwesomeTikzCatalog(root = AWESOME_TIKZ_ROOT) {
  const readmePath = path.join(root, AWESOME_TIKZ_README);
  const markdown = await readFile(readmePath, "utf8");
  const resources = parseAwesomeTikzMarkdown(markdown).map((resource, index) => enrichResource(resource, index));
  return {
    origin: "maphy-psd/awesome-TikZ",
    repositoryUrl: AWESOME_TIKZ_REPOSITORY_URL,
    root,
    resources,
    sections: countSections(resources)
  };
}

export function parseAwesomeTikzMarkdown(markdown) {
  const resources = [];
  let section = "";
  for (const [lineIndex, line] of String(markdown || "").split(/\r?\n/).entries()) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      section = heading[1].trim();
      continue;
    }
    if (!section) continue;
    const item = line.match(/^[-*]\s+\[([^\]]+)\]\(([^)]+)\)(?:\s*-\s*(.+))?\s*$/);
    if (!item) continue;
    resources.push({
      section,
      name: item[1].trim(),
      url: item[2].trim(),
      description: (item[3] || "").trim(),
      line: lineIndex + 1
    });
  }
  return resources;
}

export function summarizeAwesomeTikzCoverage(catalog) {
  const resources = catalog.resources || [];
  const supported = resources.filter((item) => item.supportStatus !== "unimplemented");
  const packages = resources.filter((item) => item.section === "Packages");
  const supportedPackages = packages.filter((item) => item.supportStatus !== "unimplemented");
  return {
    totalResources: resources.length,
    supportedResources: supported.length,
    packageResources: packages.length,
    supportedPackages: supportedPackages.length,
    unsupportedPackages: packages.length - supportedPackages.length,
    sections: countSections(resources),
    supportByStatus: countBy(supported, (item) => item.supportStatus),
    supportedNames: [...new Set(supported.map((item) => item.name))].sort((a, b) => a.localeCompare(b))
  };
}

export function renderAwesomeTikzCoverageMarkdown(catalog) {
  const summary = summarizeAwesomeTikzCoverage(catalog);
  const supported = (catalog.resources || []).filter((item) => item.supportStatus !== "unimplemented");
  const unsupportedPackages = (catalog.resources || [])
    .filter((item) => item.section === "Packages" && item.supportStatus === "unimplemented")
    .slice(0, 40);
  return [
    "# awesome-TikZ Coverage",
    "",
    `Source: ${AWESOME_TIKZ_REPOSITORY_URL}`,
    "",
    `Total resources: ${summary.totalResources}`,
    `Package resources: ${summary.packageResources}`,
    `Supported resources: ${summary.supportedResources}`,
    `Supported packages: ${summary.supportedPackages}`,
    "",
    "## Supported Items",
    "",
    ...supported.map((item) => `- ${item.name} (${item.supportStatus}) - ${item.supportNote}`),
    "",
    "## First Unsupported Packages",
    "",
    ...unsupportedPackages.map((item) => `- ${item.name} - ${item.description}`)
  ].join("\n");
}

function enrichResource(resource, index) {
  const [supportStatus, supportNote] = SUPPORT_MAP.get(normalizeName(resource.name)) || ["unimplemented", ""];
  return {
    id: String(index + 1).padStart(3, "0"),
    origin: "maphy-psd/awesome-TikZ",
    sourceUrl: `${AWESOME_TIKZ_REPOSITORY_URL}/blob/master/${AWESOME_TIKZ_README}#L${resource.line}`,
    supportStatus,
    supportNote,
    ...resource
  };
}

function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

function countSections(resources) {
  return countBy(resources, (item) => item.section);
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items || []) {
    const key = keyFn(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}
