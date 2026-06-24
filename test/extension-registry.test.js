import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("extension registry records implementation and MacTeX source status for key libraries", () => {
  const rows = parseCsv(readFileSync(new URL("../docs/extension-registry.csv", import.meta.url), "utf8"));
  const byKey = new Map(rows.map((row) => [`${row.kind}:${row.name}`, row]));

  assert.equal(rows.length, 138);
  assert.equal(byKey.get("package:circuitikz")?.implementationStatus, "unsupported");
  assert.match(byKey.get("package:circuitikz")?.localSource || "", /circuitikz\.sty$/);
  assert.match(byKey.get("package:circuitikz")?.cases || "", /\bCase 859\b/);

  assert.equal(byKey.get("package:tikz-network")?.implementationStatus, "extension");
  assert.equal(byKey.get("package:tikz-network")?.localSourceReviewed, "yes");
  assert.match(byKey.get("package:tikz-network")?.implementedBy || "", /src\/extensions\/tikz-network\.js/);

  assert.equal(byKey.get("pgfplotslibrary:groupplots")?.implementationStatus, "partial");
  assert.equal(byKey.get("pgfplotslibrary:groupplots")?.localSourceFound, "yes");
  assert.match(byKey.get("pgfplotslibrary:groupplots")?.localSource || "", /tikzlibrarypgfplots\.groupplots\.code\.tex$/);

  assert.equal(byKey.get("tikzlibrary:arrows.meta")?.implementationStatus, "builtin");
  assert.match(byKey.get("tikzlibrary:arrows.meta")?.localSource || "", /pgflibraryarrows\.meta\.code\.tex$/);

  assert.equal(byKey.get("tikzlibrary:decorations.pathreplacing")?.implementationStatus, "partial");
  assert.equal(byKey.get("tikzlibrary:decorations.pathreplacing")?.localSourceReviewed, "yes");
  assert.match(byKey.get("tikzlibrary:decorations.pathreplacing")?.notes || "", /amplitude/);

  for (const name of ["intersections", "plotmarks", "shadows", "trees"]) {
    assert.equal(byKey.get(`tikzlibrary:${name}`)?.implementationStatus, "partial");
    assert.equal(byKey.get(`tikzlibrary:${name}`)?.localSourceReviewed, "yes");
  }

  const cases = byKey.get("package:tikz")?.cases.split(/\s+(?=Case\s+\d+)/) || [];
  assert.equal(new Set(cases).size, cases.length);
});

test("extension registry markdown explains the implementation workflow", () => {
  const markdown = readFileSync(new URL("../docs/extension-registry.md", import.meta.url), "utf8");

  assert.match(markdown, /Highest-Priority Unsupported Entries/);
  assert.match(markdown, /\| package \| circuitikz \| 486 \| found \| no \|/);
  assert.match(markdown, /Open `localSource` and `localDoc`/);
  assert.match(markdown, /Regenerate this registry with `node scripts\/build-extension-registry\.js`/);
});

function parseCsv(text) {
  const [headerLine, ...lines] = text.trim().split("\n");
  const headers = parseCsvLine(headerLine);
  return lines.map((line) => Object.fromEntries(parseCsvLine(line).map((value, index) => [headers[index], value])));
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}
