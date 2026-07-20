import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve("test", "fixtures", "implementation-examples");
const REQUIRED_DIRECTORIES = ["basic", "paths", "nodes", "foreach", "pgfplots", "real-world", "output"];

test("implementation example workspace follows the target fixture layout", () => {
  for (const directory of REQUIRED_DIRECTORIES) {
    assert.equal(existsSync(path.join(ROOT, directory)), true, `missing ${directory}/`);
  }
});

test("implementation example manifest maps cases to semantic owner modules", () => {
  const manifestPath = path.join(ROOT, "manifest.json");
  assert.equal(existsSync(manifestPath), true, "missing manifest.json");

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.version, 1);
  assert.ok(Array.isArray(manifest.cases));
  assert.ok(manifest.cases.length >= REQUIRED_DIRECTORIES.length - 1);

  const seen = new Set();
  for (const entry of manifest.cases) {
    assert.equal(typeof entry.id, "string");
    assert.equal(seen.has(entry.id), false, `duplicate case id ${entry.id}`);
    seen.add(entry.id);
    assert.equal(typeof entry.source, "string", `missing source for ${entry.id}`);
    assert.equal(existsSync(path.join(ROOT, entry.source)), true, `missing source file for ${entry.id}`);
    assert.ok(entry.semanticOwner?.startsWith("src/"), `missing semantic owner for ${entry.id}`);
    assert.ok(Array.isArray(entry.features) && entry.features.length > 0, `missing features for ${entry.id}`);
  }
});

test("implementation examples are standalone TikZ units for external renderers", () => {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, "manifest.json"), "utf8"));

  for (const entry of manifest.cases) {
    const source = readFileSync(path.join(ROOT, entry.source), "utf8");
    assert.match(
      source,
      /\\begin\{tikzpicture\}|\\tikz\b/,
      `${entry.id} must include a tikzpicture or \\tikz command for tikztosvg comparison`
    );
  }
});

test("implementation example manifest covers every source file under the target directories", () => {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  const manifestSources = new Set(manifest.cases.map((entry) => entry.source));
  const sourceFiles = listSourceFiles(ROOT);

  assert.deepEqual(sourceFiles.filter((source) => !manifestSources.has(source)), []);
});

function listSourceFiles(root, directory = root) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      if (entry.name === "output") continue;
      files.push(...listSourceFiles(root, path.join(directory, entry.name)));
      continue;
    }
    if (entry.isFile() && /\.(tikz|tex)$/i.test(entry.name)) {
      files.push(path.relative(root, path.join(directory, entry.name)).split(path.sep).join("/"));
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}
