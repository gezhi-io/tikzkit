import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("extension registry records implementation and MacTeX source status for key libraries", () => {
  const rows = parseCsv(readFileSync(new URL("../docs/extension-registry.csv", import.meta.url), "utf8"));
  const byKey = new Map(rows.map((row) => [`${row.kind}:${row.name}`, row]));

  assert.equal(rows.length, 142);
  assert.equal(byKey.get("package:circuitikz")?.implementationStatus, "partial");
  assert.equal(byKey.get("package:circuitikz")?.localSourceReviewed, "yes");
  assert.match(byKey.get("package:circuitikz")?.implementedBy || "", /src\/interpreter\.js:appendCircuitikzToSegment/);
  assert.match(byKey.get("package:circuitikz")?.notes || "", /Case 869\/871\/872 circuitikz slice/);
  assert.match(byKey.get("package:circuitikz")?.localSource || "", /circuitikz\.sty$/);
  assert.match(byKey.get("package:circuitikz")?.cases || "", /\bCase 859\b/);

  assert.equal(byKey.get("package:tikz-network")?.implementationStatus, "extension");
  assert.equal(byKey.get("package:tikz-network")?.localSourceReviewed, "yes");
  assert.match(byKey.get("package:tikz-network")?.implementedBy || "", /src\/extensions\/tikz-network\.js/);

  assert.equal(byKey.get("pgfplotslibrary:groupplots")?.implementationStatus, "partial");
  assert.equal(byKey.get("pgfplotslibrary:groupplots")?.localSourceFound, "yes");
  assert.match(byKey.get("pgfplotslibrary:groupplots")?.localSource || "", /tikzlibrarypgfplots\.groupplots\.code\.tex$/);

  assert.equal(byKey.get("tikzlibrary:datavisualization.formats.functions")?.implementationStatus, "partial");
  assert.equal(byKey.get("tikzlibrary:datavisualization.formats.functions")?.localSourceReviewed, "yes");
  assert.match(byKey.get("tikzlibrary:datavisualization.formats.functions")?.cases || "", /datavisualization-001\.\.099/);
  assert.match(byKey.get("tikzlibrary:datavisualization.formats.functions")?.notes || "", /veclen\/ifthenelse\/sinh\/cosh/);
  assert.match(byKey.get("tikzlibrary:datavisualization.formats.functions")?.notes || "", /rectangle visualizer \.list routing/);
  assert.match(byKey.get("tikzlibrary:datavisualization.formats.functions")?.notes || "", /visualize ticks low\/high\/style\/direction axis tick marks plus tick text/);
  assert.match(byKey.get("tikzlibrary:datavisualization.formats.functions")?.notes || "", /right then down, columns=2/);
  assert.match(byKey.get("tikzlibrary:datavisualization.formats.functions")?.notes || "", /max columns=2/);
  assert.match(byKey.get("tikzlibrary:datavisualization.formats.functions")?.notes || "", /degrees\/radians/);
  assert.match(byKey.get("tikzlibrary:datavisualization.formats.functions")?.notes || "", /legend label node style draw\/circle/);
  assert.match(byKey.get("tikzlibrary:datavisualization.formats.functions")?.notes || "", /explicit legend anchor\/at placement/);
  assert.match(byKey.get("tikzlibrary:datavisualization.formats.functions")?.notes || "", /legend at-coordinate projections/);
  assert.match(byKey.get("tikzlibrary:datavisualization.formats.functions")?.notes || "", /default auto selectors/);
  assert.match(byKey.get("tikzlibrary:datavisualization.formats.functions")?.notes || "", /legend matrix node style/);
  assert.match(byKey.get("tikzlibrary:datavisualization.formats.functions")?.notes || "", /opaque\/transparent/);
  assert.match(byKey.get("tikzlibrary:datavisualization.formats.functions")?.notes || "", /visualizer in legend style/);
  assert.match(byKey.get("tikzlibrary:datavisualization.formats.functions")?.notes || "", /ignore style sheets/);
  assert.match(byKey.get("tikzlibrary:datavisualization.formats.functions")?.notes || "", /repeated pin leader-edge overlays/);
  assert.match(byKey.get("tikzlibrary:datavisualization.formats.functions")?.notes || "", /tikzdatavisualizationset named styles/);

  assert.equal(byKey.get("tikzlibrary:datavisualization.barcharts")?.implementationStatus, "partial");
  assert.equal(byKey.get("tikzlibrary:datavisualization.barcharts")?.localSourceReviewed, "yes");
  assert.match(byKey.get("tikzlibrary:datavisualization.barcharts")?.cases || "", /datavisualization-065/);
  assert.match(byKey.get("tikzlibrary:datavisualization.barcharts")?.notes || "", /candle stick plot/);

  assert.equal(byKey.get("tikzlibrary:datavisualization.polar")?.implementationStatus, "partial");
  assert.equal(byKey.get("tikzlibrary:datavisualization.polar")?.localSourceReviewed, "yes");
  assert.match(byKey.get("tikzlibrary:datavisualization.polar")?.cases || "", /datavisualization-048/);
  assert.match(byKey.get("tikzlibrary:datavisualization.polar")?.notes || "", /inner\/outer angle ticks/);
  assert.match(byKey.get("tikzlibrary:datavisualization.polar")?.notes || "", /ticks=none/);
  assert.match(byKey.get("tikzlibrary:datavisualization.polar")?.notes || "", /angle axis degrees\/radians scaling/);

  assert.equal(byKey.get("tikzlibrary:datavisualization.sparklines")?.implementationStatus, "partial");
  assert.equal(byKey.get("tikzlibrary:datavisualization.sparklines")?.localSourceReviewed, "yes");
  assert.match(byKey.get("tikzlibrary:datavisualization.sparklines")?.cases || "", /datavisualization-066/);
  assert.match(byKey.get("tikzlibrary:datavisualization.sparklines")?.notes || "", /x axis unit length 1pt/);

  assert.equal(byKey.get("tikzlibrary:arrows.meta")?.implementationStatus, "builtin");
  assert.match(byKey.get("tikzlibrary:arrows.meta")?.localSource || "", /pgflibraryarrows\.meta\.code\.tex$/);

  assert.equal(byKey.get("tikzlibrary:decorations.pathreplacing")?.implementationStatus, "partial");
  assert.equal(byKey.get("tikzlibrary:decorations.pathreplacing")?.localSourceReviewed, "yes");
  assert.match(byKey.get("tikzlibrary:decorations.pathreplacing")?.notes || "", /amplitude/);

  for (const name of ["intersections", "plotmarks", "shadows", "trees"]) {
    assert.equal(byKey.get(`tikzlibrary:${name}`)?.implementationStatus, "partial");
    assert.equal(byKey.get(`tikzlibrary:${name}`)?.localSourceReviewed, "yes");
  }

  assert.equal(byKey.get("tikzlibrary:shadows.blur")?.implementationStatus, "partial");
  assert.equal(byKey.get("tikzlibrary:shadows.blur")?.localSourceReviewed, "yes");
  assert.match(byKey.get("tikzlibrary:shadows.blur")?.notes || "", /node blur shadow/);

  const cases = byKey.get("package:tikz")?.cases.split(/\s+(?=Case\s+\d+)/) || [];
  assert.equal(new Set(cases).size, cases.length);
});

test("extension registry markdown explains the implementation workflow", () => {
  const markdown = readFileSync(new URL("../docs/extension-registry.md", import.meta.url), "utf8");

  assert.match(markdown, /Highest-Priority Unsupported Entries/);
  assert.match(markdown, /\| package \| circuitikz \| 486 \| found \| yes \| Case 869\/871\/872 circuitikz slice/);
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
