import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import {
  createPgfplotsDateContext,
  normalizePgfplotsDateAxisOptions,
  parsePgfplotsDateCoordinate
} from "../src/pgfplots/dateCoordinates.js";
import {
  collectPgfplotsLibraries,
  dateplotLibrary,
  knownPgfplotsLibraries,
  pgfplotsLibraryCatalog
} from "../src/pgfplots/index.js";
import { collectTikzLibraries } from "../src/tikz/libraries/declarations.js";

const SOURCE = readFileSync(
  new URL("fixtures/examples/latex-examples/landtagswahlen-in-bayern.tex", import.meta.url),
  "utf8"
);
const CSV = readFileSync(
  new URL("fixtures/examples/latex-examples/resources/landtagswahlen-in-bayern/landtagswahlen-in-bayern.csv", import.meta.url),
  "utf8"
);

test("dateplot converts ISO dates to days relative to date ZERO", () => {
  const context = createPgfplotsDateContext({ "date coordinates in": "x", "date ZERO": "1946-06-30" });

  assert.equal(parsePgfplotsDateCoordinate("1946-06-30", "x", context), 0);
  assert.equal(parsePgfplotsDateCoordinate("1946-07-01", "x", context), 1);
  assert.equal(parsePgfplotsDateCoordinate("1946-07-01 12:00", "x", context), 1.5);
});

test("dateplot derives year labels for xtick=data", () => {
  const context = createPgfplotsDateContext({ "date coordinates in": "x", "date ZERO": "1946-06-30" });
  const options = normalizePgfplotsDateAxisOptions(
    { "date coordinates in": "x", "date ZERO": "1946-06-30", xtick: "data", xticklabel: "{\\year}" },
    [{ points: [
      { x: 0, y: 1, dateCoordinates: { x: "1946-06-30" } },
      { x: 366, y: 2, dateCoordinates: { x: "1947-07-01" } }
    ] }],
    context
  );

  assert.equal(options.xticklabels, "{1946,1947}");
  assert.equal(options["scaled x ticks"], false);
});

test("dateplot declarations resolve through independent PGFPlots and TikZ library modules", () => {
  const pgfplotsLibraries = collectPgfplotsLibraries(String.raw`\usepgfplotslibrary{dateplot}`);
  const tikzLibraries = collectTikzLibraries(String.raw`\usetikzlibrary{pgfplots.dateplot}`);

  assert.ok(knownPgfplotsLibraries.includes("dateplot"));
  assert.equal(dateplotLibrary.status, "partial");
  assert.equal(pgfplotsLibraryCatalog.dateplot.localSourceReviewed, dateplotLibrary.localSource);
  assert.equal(pgfplotsLibraries[0].status, "partial");
  assert.equal(pgfplotsLibraries[0].localSource, dateplotLibrary.localSource);
  assert.equal(tikzLibraries[0].status, "partial");
  assert.match(tikzLibraries[0].implementedBy, /dateCoordinates/);
});

test("real Bavaria election dateplot keeps a bounded axis and renders all series", () => {
  const result = tikzToSvg(SOURCE, {
    mathRenderer: "svg-text",
    pgfplotsTableResolver: (name) => name === "landtagswahlen-in-bayern.csv" ? CSV : undefined
  });
  const width = Number(result.svg.match(/\bwidth="([\d.]+)pt"/)?.[1]);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(width > 300 && width < 600, `expected a 15cm-class date plot, got ${width}pt`);
  assert.match(result.svg, />1946<\/text>|>1946<\/tspan>/);
  assert.ok(result.svg.includes('>100<tspan dx="0.166667em">%</tspan></text>'));
  assert.doesNotMatch(result.svg, />\d+ \\%<\/text>/);
  assert.doesNotMatch(result.svg, /10<\/tspan>|\\cdot 10|>10\^4</);
  assert.doesNotMatch(result.svg, /width="\d{5,}\.\d+pt"/);
});
