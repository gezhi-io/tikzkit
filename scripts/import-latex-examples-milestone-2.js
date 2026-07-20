#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SOURCE_ROOT = "/Users/kaiwu/Downloads/LaTeX-examples-master/tikz";
const FIXTURE_ROOT = path.join(REPO_ROOT, "test", "fixtures", "examples");
const TARGET_ROOT = path.join(FIXTURE_ROOT, "latex-examples");
const MANIFEST_PATH = path.join(FIXTURE_ROOT, "manifest.json");
const MILESTONE_PATH = path.join(FIXTURE_ROOT, "milestone-1.json");

const BATCH = [
  ["2d-caro", "2d-utility/2d-caro.tex"],
  ["array", "array/array.tex"],
  ["artificial-neuron", "artificial-neuron/artificial-neuron.tex"],
  ["b-tree-2", "b-tree/b-tree-2.tex"],
  ["b-tree-3-evolution", "b-tree-3-evolution/b-tree-3-evolution.tex"],
  ["b-tree-node", "b-tree-node/b-tree-node.tex"],
  ["bar-chart-grouping", "bar-chart-grouping/bar-chart-grouping.tex"],
  ["bar-chart-military-budget", "bar-chart-military-budget/bar-chart-military-budget.tex"],
  ["bar-chart-simple", "bar-chart-simple/bar-chart-simple.tex"],
  ["bchart-simple", "bchart-simple/bchart-simple.tex"],
  ["bellman-ford-algorithm", "bellman-ford-algorithm/bellman-ford-algorithm.tex"],
  ["bias-variance", "bias-variance/bias-variance.tex"],
  ["binary-search-tree", "binary-search-tree/binary-search-tree.tex"],
  ["binary-tree", "binary-tree/binary-tree.tex"],
  ["bounding-box-lines-1", "bounding-box-lines-1/bounding-box-lines-1.tex"],
  ["cache-4-way-associative", "cache-4-way-associative/cache-4-way-associative.tex"],
  ["cascade-correlation-network", "cascade-correlation-network/cascade-correlation-network.tex"],
  ["cbc-mode-decryption", "CBC-Mode-Decryption/CBC-Mode-Decryption.tex"],
  ["cbc-mode-encryption", "CBC-Mode-Encryption/CBC-Mode-Encryption.tex"],
  ["center", "center/center.tex"],
  ["center-line", "center-line/center-line.tex"],
  ["center-two-cluster", "center-two-cluster/center-two-cluster.tex"],
  ["cfb-mode-decryption", "CFB-Mode-Decryption/CFB-Mode-Decryption.tex"],
  ["cfb-mode-encryption", "CFB-Mode-Encryption/CFB-Mode-Encryption.tex"],
  ["chemistry-example", "chemistry-example/chemistry-example.tex"],
  ["circle-convex-metric-space", "circle-convex-metric-space/circle-convex-metric-space.tex"],
  ["circle-inscribed-circumscribed-polygon", "circle-inscribed-circumscribed-polygon/circle-inscribed-circumscribed-polygon.tex"],
  ["circles-closed", "circles-closed/circles-closed.tex"],
  ["circular-cone", "circular-cone/circular-cone.tex"],
  ["circular-sector-centroid", "circular-sector-centroid/circular-sector-centroid.tex"]
];

export async function importLatexExamplesMilestone2(options = {}) {
  const sourceRoot = path.resolve(options.sourceRoot || DEFAULT_SOURCE_ROOT);
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const milestone = JSON.parse(await readFile(MILESTONE_PATH, "utf8"));
  const manifestIds = new Set(manifest.cases.map((entry) => entry.id));
  const milestoneIds = new Set(milestone.caseIds);
  const imported = [];

  await mkdir(TARGET_ROOT, { recursive: true });
  for (const [slug, relativeSource] of BATCH) {
    const id = `latex-examples-${slug}`;
    const sourcePath = path.join(sourceRoot, relativeSource);
    const source = await readFile(sourcePath, "utf8");
    const targetName = `${slug}.tex`;
    const header = `% Source: ${sourcePath}\n`;
    await writeFile(path.join(TARGET_ROOT, targetName), source.startsWith("% Source:") ? source : `${header}${source}`, "utf8");

    if (!manifestIds.has(id)) {
      manifest.cases.push(buildManifestEntry({ id, slug, targetName, relativeSource, source }));
      manifestIds.add(id);
    }
    if (!milestoneIds.has(id)) {
      milestone.caseIds.push(id);
      milestoneIds.add(id);
    }
    imported.push(id);
  }

  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(MILESTONE_PATH, `${JSON.stringify(milestone, null, 2)}\n`, "utf8");
  return imported;
}

function buildManifestEntry({ id, slug, targetName, relativeSource, source }) {
  return {
    id,
    title: `LaTeX-examples ${titleCase(slug)}`,
    source: `latex-examples/${targetName}`,
    sourceCorpus: "LaTeX-examples-master/tikz",
    externalSource: relativeSource,
    semanticOwner: semanticOwner(source),
    features: detectedFeatures(source)
  };
}

function semanticOwner(source) {
  if (/\\usepackage(?:\[[^\]]*\])?\{bchart\}|\\begin\{bchart\}/.test(source)) return "src/extensions/bchart.js";
  if (/\\begin\{axis\}|\\addplot\b/.test(source)) return "src/pgfplots/index.js";
  if (/\\(?:usetikzlibrary\{[^}]*trees|node\s*\{[^}]*\}\s*child\b)|\bchild\s*\{/.test(source)) return "src/libraries/trees.js";
  if (/\\matrix\b|matrix of nodes/.test(source)) return "src/libraries/matrix.js";
  if (/tikz-3dplot|tdplot_/.test(source)) return "src/libraries/3d.js";
  if (/\\foreach\b/.test(source)) return "src/tikz/commands/foreach.js";
  return "src/engine/evaluate.js";
}

function detectedFeatures(source) {
  const features = [];
  const add = (condition, name) => {
    if (condition && !features.includes(name)) features.push(name);
  };
  add(/\\begin\{axis\}/.test(source), "pgfplots axis");
  add(/\\addplot\b/.test(source), "addplot");
  add(/\\foreach\b/.test(source), "foreach expansion");
  add(/\\matrix\b|matrix of nodes/.test(source), "matrix");
  add(/\bchild\s*\{/.test(source), "tree layout");
  add(/\\node\b/.test(source), "node layout");
  add(/\\draw\b|\\path\b/.test(source), "path drawing");
  add(/(?:->|<-|Stealth|Latex)/.test(source), "arrow tips");
  add(/tikz-3dplot|tdplot_/.test(source), "3d transform");
  add(/\$[^$]+\$/.test(source), "math labels");
  add(/\\usepackage\{(?:bchart|chemfig|tkz-fct)/.test(source), "third-party package");
  return features.slice(0, 6);
}

function titleCase(value) {
  return String(value)
    .split("-")
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : "")
    .join(" ");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const imported = await importLatexExamplesMilestone2({ sourceRoot: process.argv[2] });
  process.stdout.write(`Imported ${imported.length} LaTeX-examples cases into the web milestone.\n`);
}
