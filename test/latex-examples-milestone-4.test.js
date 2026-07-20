import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const FIXTURE_ROOT = path.resolve("test", "fixtures", "examples");
const manifest = JSON.parse(readFileSync(path.join(FIXTURE_ROOT, "manifest.json"), "utf8"));
const milestone = JSON.parse(readFileSync(path.join(FIXTURE_ROOT, "milestone-4.json"), "utf8"));

function sourceHash(source) {
  const canonical = source
    .replace(/^\s*%\s*(?:Source|Inlined source):.*$/gim, "")
    .replace(/(^|[^\\])%.*$/gm, "$1")
    .replace(/\s+/g, "")
    .trim();
  return createHash("sha256").update(canonical).digest("hex");
}

test("LaTeX-examples batch 4 contains 30 unique imported cases", () => {
  assert.equal(milestone.name, "LaTeX-examples batch 4");
  assert.equal(milestone.caseIds.length, 30);
  assert.equal(new Set(milestone.caseIds).size, 30);

  const manifestById = new Map(manifest.cases.map((entry) => [entry.id, entry]));
  const importedCases = manifest.cases.filter((entry) => entry.sourceCorpus === "LaTeX-examples-master/tikz");
  const externalSources = new Set();
  const contentHashes = new Set();

  for (const entry of importedCases) {
    assert.equal(externalSources.has(entry.externalSource), false, `duplicate external source ${entry.externalSource}`);
    externalSources.add(entry.externalSource);

    const source = readFileSync(path.join(FIXTURE_ROOT, entry.source), "utf8");
    const hash = sourceHash(source);
    assert.equal(contentHashes.has(hash), false, `duplicate source content for ${entry.id}`);
    contentHashes.add(hash);
  }

  for (const id of milestone.caseIds) {
    const entry = manifestById.get(id);
    assert.ok(entry, `missing manifest entry for ${id}`);
    assert.equal(entry.sourceCorpus, "LaTeX-examples-master/tikz");
    assert.match(entry.source, /^latex-examples\/[a-z0-9-]+\.tex$/);
    assert.equal(existsSync(path.join(FIXTURE_ROOT, entry.source)), true, `missing imported source for ${id}`);

    const source = readFileSync(path.join(FIXTURE_ROOT, entry.source), "utf8");
    assert.equal(source.split("\n", 1)[0].endsWith(`/tikz/${entry.externalSource}`), true, `source provenance mismatch for ${id}`);
    assert.match(source, /\\documentclass(?:\[[^\]]*\])?\s*\{[^}]+\}/);
    assert.match(source, /\\begin\s*\{document\}/);
    assert.match(source, /\\(?:begin\s*\{(?:tikzpicture|axis|tikzcd)\}|tikz\b|datavisualization\b)/);
  }
});
