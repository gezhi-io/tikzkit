import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { expandChemfigSchemes } from "../src/extensions/chemfig.js";
import { tikzToSvg } from "../src/index.js";
import { texPackageCatalog } from "../src/packages/index.js";

const SOURCE_PATH = "test/fixtures/examples/latex-examples/chemistry-example.tex";

test("chemfig package records the bounded scheme compatibility slice", () => {
  assert.equal(texPackageCatalog.chemfig.status, "partial");
  assert.equal(texPackageCatalog.chemmacros.status, "partial");
  assert.match(texPackageCatalog.chemfig.implementedBy, /extensions\/chemfig/);
});

test("lowers the corpus chemfig scheme to ordinary TikZ aromatic rings and reaction arrows", () => {
  const source = readFileSync(SOURCE_PATH, "utf8");
  const diagnostics = [];
  const lowered = expandChemfigSchemes(source, diagnostics);

  assert.deepEqual(diagnostics, []);
  assert.doesNotMatch(lowered, /\\schemestart|\\schemestop|\\chemfig|\\setatomsep|\\lewis/);
  assert.match(lowered, /\\begin\{tikzpicture\}/);
  assert.equal((lowered.match(/\\draw\[->\]/g) || []).length, 2);
  assert.match(lowered, /at \([^,]+,-0\.38\) \{2\}/, "reaction coefficients use the molecule baseline, not the arrow baseline");
  assert.match(lowered, /at \([^,]+,-0\.24\) \{\$2CO_2\^\\uparrow\$\}/, "formula products use the molecule baseline");
});

test("renders the chemistry example with rings, carbonyl oxygens, radicals, and no diagnostics", () => {
  const source = readFileSync(SOURCE_PATH, "utf8");
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path");
  const oxygens = result.ir.items.filter((item) => item.type === "textNode" && item.text === "O");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(paths.length >= 24, `expected structural and reaction paths, got ${paths.length}`);
  assert.ok(oxygens.length >= 5, `expected carbonyl/peroxide oxygen labels, got ${oxygens.length}`);
  assert.match(result.svg, /tikz-arrow-tip/);
});
