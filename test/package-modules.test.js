import assert from "node:assert/strict";
import test from "node:test";
import { parseTikz } from "../src/parser.js";
import {
  mathtoolsPackage,
  pgfplotsPackage,
  texPackageCatalog
} from "../src/packages/index.js";

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
