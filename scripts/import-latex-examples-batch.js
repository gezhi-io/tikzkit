#!/usr/bin/env node
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SOURCE_ROOT = "/Users/kaiwu/Downloads/LaTeX-examples-master/tikz";
const FIXTURE_ROOT = path.join(REPO_ROOT, "test", "fixtures", "examples");
const TARGET_ROOT = path.join(FIXTURE_ROOT, "latex-examples");
const MANIFEST_PATH = path.join(FIXTURE_ROOT, "manifest.json");
const MILESTONE_PATH = path.join(FIXTURE_ROOT, "milestone-1.json");
const DEFAULT_EXCLUDED_SOURCES = new Set([
  "exponential-functions-gif/exponential-functions-gif.tex",
  "extended-euclidean-algorithm-runtime/extended-euclidean-algorithm-runtime.tex"
]);

export async function importLatexExamplesBatch(options = {}) {
  const sourceRoot = path.resolve(options.sourceRoot || DEFAULT_SOURCE_ROOT);
  const limit = Math.max(1, Number(options.limit) || 30);
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const milestone = JSON.parse(await readFile(MILESTONE_PATH, "utf8"));
  const manifestIds = new Set(manifest.cases.map((entry) => entry.id));
  const excludedSources = new Set([
    ...DEFAULT_EXCLUDED_SOURCES,
    ...(options.excludeSources || []).map(normalizeRelativePath)
  ]);
  const externalSources = new Set(
    manifest.cases.map((entry) => normalizeRelativePath(entry.externalSource)).filter(Boolean)
  );
  const milestoneIds = new Set(milestone.caseIds);
  const contentHashes = new Set();
  const imported = [];

  for (const entry of manifest.cases) {
    try {
      const source = await readFile(path.join(FIXTURE_ROOT, entry.source), "utf8");
      contentHashes.add(sourceHash(source));
    } catch {
      // A stale manifest entry must not stop a new corpus batch from being imported.
    }
  }

  await mkdir(TARGET_ROOT, { recursive: true });
  const sourceFiles = (await walkTexFiles(sourceRoot)).sort((left, right) => left.localeCompare(right));
  for (const sourcePath of sourceFiles) {
    if (imported.length >= limit) break;
    const relativeSource = normalizeRelativePath(path.relative(sourceRoot, sourcePath));
    if (excludedSources.has(relativeSource)) continue;
    if (externalSources.has(relativeSource)) continue;

    const source = await readFile(sourcePath, "utf8");
    if (!isStandaloneTikzDocument(source)) continue;
    const expanded = await inlineLocalInputs(source, path.dirname(sourcePath), new Set([sourcePath]));
    const hash = sourceHash(expanded);
    if (contentHashes.has(hash)) continue;

    const slug = uniqueSlug(relativeSource, manifestIds);
    const id = `latex-examples-${slug}`;
    const targetName = `${slug}.tex`;
    const importedSource = `% Source: ${sourcePath}\n${expanded}`;
    await writeFile(path.join(TARGET_ROOT, targetName), importedSource, "utf8");
    const resources = await copyReferencedResources(expanded, path.dirname(sourcePath), slug);

    manifest.cases.push(buildManifestEntry({ id, slug, targetName, relativeSource, source: expanded, resources }));
    manifestIds.add(id);
    externalSources.add(relativeSource);
    contentHashes.add(hash);
    if (!milestoneIds.has(id)) {
      milestone.caseIds.push(id);
      milestoneIds.add(id);
    }
    imported.push({ id, relativeSource });
  }

  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(MILESTONE_PATH, `${JSON.stringify(milestone, null, 2)}\n`, "utf8");
  return imported;
}

async function walkTexFiles(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await walkTexFiles(candidate));
    else if (entry.isFile() && entry.name.endsWith(".tex") && !entry.name.endsWith(".template.tex")) files.push(candidate);
  }
  return files;
}

async function inlineLocalInputs(source, currentDir, stack) {
  const pattern = /\\(?:input|include)\s*\{([^}]+)\}/g;
  let output = "";
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    output += source.slice(cursor, match.index);
    const requested = String(match[1] || "").trim();
    const inputPath = path.resolve(currentDir, requested.endsWith(".tex") ? requested : `${requested}.tex`);
    let replacement = match[0];
    if (!stack.has(inputPath)) {
      try {
        const nested = await readFile(inputPath, "utf8");
        const nextStack = new Set(stack);
        nextStack.add(inputPath);
        replacement = `% Inlined source: ${inputPath}\n${await inlineLocalInputs(nested, path.dirname(inputPath), nextStack)}`;
      } catch {
        replacement = match[0];
      }
    }
    output += replacement;
    cursor = match.index + match[0].length;
  }
  return output + source.slice(cursor);
}

function isStandaloneTikzDocument(source) {
  return /\\documentclass(?:\[[^\]]*\])?\s*\{[^}]+\}/.test(source) &&
    /\\begin\s*\{document\}/.test(source) &&
    /\\(?:begin\s*\{(?:tikzpicture|axis|tikzcd)\}|tikz\b|datavisualization\b)/.test(source);
}

function sourceHash(source) {
  const canonical = String(source || "")
    .replace(/^\s*%\s*(?:Source|Inlined source):.*$/gim, "")
    .replace(/(^|[^\\])%.*$/gm, "$1")
    .replace(/\s+/g, "")
    .trim();
  return createHash("sha256").update(canonical).digest("hex");
}

function uniqueSlug(relativeSource, manifestIds) {
  const fileSlug = slugify(path.basename(relativeSource, ".tex"));
  if (!manifestIds.has(`latex-examples-${fileSlug}`)) return fileSlug;
  const parentSlug = slugify(path.basename(path.dirname(relativeSource)));
  let candidate = `${parentSlug}-${fileSlug}`;
  let suffix = 2;
  while (manifestIds.has(`latex-examples-${candidate}`)) candidate = `${parentSlug}-${fileSlug}-${suffix++}`;
  return candidate;
}

function buildManifestEntry({ id, slug, targetName, relativeSource, source, resources = [] }) {
  const entry = {
    id,
    title: `LaTeX-examples ${titleCase(slug)}`,
    source: `latex-examples/${targetName}`,
    sourceCorpus: "LaTeX-examples-master/tikz",
    externalSource: relativeSource,
    semanticOwner: semanticOwner(source),
    features: detectedFeatures(source)
  };
  if (resources.length) entry.resources = resources;
  return entry;
}

async function copyReferencedResources(source, sourceDir, slug) {
  const resources = [];
  for (const name of referencedResourceNames(source)) {
    const sourcePath = path.resolve(sourceDir, name);
    const relative = path.relative(sourceDir, sourcePath);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) continue;
    const normalizedRelative = normalizeRelativePath(relative);
    const targetRelative = path.posix.join("latex-examples", "resources", slug, normalizedRelative);
    const targetPath = path.join(FIXTURE_ROOT, targetRelative);
    try {
      await mkdir(path.dirname(targetPath), { recursive: true });
      await copyFile(sourcePath, targetPath);
      resources.push({ name: normalizeRelativePath(name), source: targetRelative });
    } catch {
      // A missing optional asset should remain visible as a renderer diagnostic.
    }
  }
  return resources;
}

export function referencedResourceNames(source) {
  const names = new Set();
  const patterns = [
    /\btable\s*(?:\[[^\]]*\])?\s*\{([^{}\r\n]+)\}/g,
    /\\includegraphics(?:\[[^\]]*\])?\s*\{([^{}\r\n]+)\}/g
  ];
  for (const pattern of patterns) {
    for (const match of String(source || "").matchAll(pattern)) {
      const name = String(match[1] || "").trim();
      if (name && !name.includes("\\") && !path.isAbsolute(name)) names.add(name);
    }
  }
  for (const match of String(source || "").matchAll(/\\usepackage(?:\[[^\]]*\])?\s*\{([^}]*)\}/g)) {
    for (const packageName of String(match[1] || "").split(",")) {
      const name = packageName.trim();
      if (name && !name.includes("\\") && !path.isAbsolute(name)) names.add(`${name}.sty`);
    }
  }
  return [...names];
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
  add(/\\usepackage(?:\[[^\]]*\])?\{(?:bchart|chemfig|tkz-fct|circuitikz)/.test(source), "third-party package");
  return features.slice(0, 6);
}

function normalizeRelativePath(value) {
  return String(value || "").replaceAll(path.sep, "/").replace(/^\.\//, "");
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "case";
}

function titleCase(value) {
  return String(value)
    .split("-")
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : "")
    .join(" ");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sourceRoot = process.argv[2] || DEFAULT_SOURCE_ROOT;
  const limit = Number(process.argv[3]) || 30;
  const imported = await importLatexExamplesBatch({ sourceRoot, limit });
  process.stdout.write(`${JSON.stringify(imported, null, 2)}\nImported ${imported.length} unique LaTeX-examples cases.\n`);
}
