import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { loadRealGalleryCases } from "../scripts/gallery-case-source.js";
import { parseTikz } from "../src/parser.js";
import { splitTopLevel } from "../src/options.js";
import {
  knownTexPackages,
  mathtoolsPackage,
  pgfplotsPackage,
  supportedTexPackages,
  texPackageCatalog
} from "../src/packages/index.js";

async function observedTexPackages() {
  const gallery = await loadRealGalleryCases();
  const packages = new Map();
  const pattern = /\\usepackage(?:\[[^\]]*\])?\{([^{}]*)\}/g;
  for (const item of gallery.cases || []) {
    let match;
    while ((match = pattern.exec(item.source || ""))) {
      for (const rawName of splitTopLevel(match[1], ",")) {
        const name = rawName.trim();
        if (!name) continue;
        const entry = packages.get(name) || { count: 0 };
        entry.count += 1;
        packages.set(name, entry);
      }
    }
  }
  return new Map([...packages].sort(([left], [right]) => left.localeCompare(right)));
}

test("keeps observed TeX packages in one module per package name", async () => {
  const observed = await observedTexPackages();
  assert.equal(observed.size, 89);
  assert.deepEqual(knownTexPackages, [...observed.keys()]);
  assert.ok(supportedTexPackages.includes("pgfplots"));
  assert.ok(supportedTexPackages.includes("mathtools"));

  for (const name of observed.keys()) {
    assert.equal(existsSync(path.resolve("src", "packages", `${name}.js`)), true, `missing src/packages/${name}.js`);
  }
});

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
