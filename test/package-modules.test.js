import assert from "node:assert/strict";
import test from "node:test";
import { parseTikz } from "../src/parser.js";
import {
  mathtoolsPackage,
  pgfplotsPackage,
  texPackageCatalog
} from "../src/packages/index.js";
import {
  collectTexPackages,
  resolveTexPackage,
  resolveTexPackages
} from "../src/packages/declarations.js";
import { collectTexPackages as compatCollectTexPackages } from "../src/tex-packages.js";

test("records local TeX Live sources for high-priority packages", () => {
  assert.equal(pgfplotsPackage.name, "pgfplots");
  assert.equal(mathtoolsPackage.name, "mathtools");
  assert.match(pgfplotsPackage.localSource || "", /\/pgfplots\/pgfplots\.sty$/);
  assert.match(mathtoolsPackage.localSource || "", /\/mathtools\/mathtools\.sty$/);
  assert.ok(pgfplotsPackage.requires.includes("tikz"));
  assert.ok(mathtoolsPackage.requires.includes("amsmath"));
  assert.equal(texPackageCatalog.pgfplots.status, "partial");
  assert.equal(texPackageCatalog.mathtools.status, "partial");
});

test("documents circuitikz siunitx and RPvoltages package option support", () => {
  const circuitikz = texPackageCatalog.circuitikz;

  assert.equal(circuitikz.status, "partial");
  assert.ok(circuitikz.observedOptions.includes("siunitx,RPvoltages"));
  assert.ok(circuitikz.features.some((feature) => feature.includes("siunitx")));
  assert.ok(circuitikz.features.some((feature) => feature.includes("RPvoltages")));
});

test("package declarations are parsed at the packages seam", () => {
  const packages = collectTexPackages(String.raw`\usepackage[siunitx,RPvoltages]{circuitikz}\usepackage{pgfplots,mathtools}`);

  assert.deepEqual(packages.map((pkg) => pkg.name), ["circuitikz", "pgfplots", "mathtools"]);
  assert.equal(packages[0].options.siunitx, true);
  assert.equal(packages[0].options.RPvoltages, true);
  assert.equal(resolveTexPackage("mathtools").status, "partial");
  assert.equal(resolveTexPackages(["pgfplots"])[0].localSource, pgfplotsPackage.localSource);
  assert.equal(compatCollectTexPackages, collectTexPackages);
});

test("uses package catalog and expands DeclareMathOperator definitions", () => {
  const parsed = parseTikz(String.raw`
\documentclass{standalone}
\usepackage{pgfplots,mathtools}
\DeclareMathOperator{\Re}{Re}
\begin{document}
\begin{tikzpicture}
\node at (0,0) {$\Re(p_0)$};
\end{tikzpicture}
\end{document}
`);
  const packages = parsed.ast.packages;
  assert.equal(packages.find((pkg) => pkg.name === "mathtools")?.status, "partial");
  assert.equal(packages.find((pkg) => pkg.name === "pgfplots")?.status, "partial");
  assert.equal(parsed.ast.pictures[0].statements[0].text, "$\\operatorname{Re}(p_0)$");
});
