import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

// World coordinates from \pgfpointanchor, in integer TeX sp (TL 2025, CircuitikZ 1.8.3).
const spPerCm = 65536 * 72.27 / 2.54;
const anchors = (wiper, tip, w, e, label) => ({ wiper, W: wiper, tip, w, e, ...(label && { label }) });
const flatEnds = [[-1044219, 0], [1044219, 0]];
const variables = [
  { id: "US-vR", region: "american", part: "vR",
    expected: anchors([-417681, -783169], [417681, 783169], ...flatEnds) },
  { id: "EU-vR", region: "european", part: "vR",
    expected: anchors([-522109, -913685], [522109, 913685], ...flatEnds) }
];
const cases = [
  ...variables,
  // The two old paint branches differ, but neither redefines the saved anchors.
  ...variables.map(c => ({ ...c, id: c.id + "-old", keys: "bipoles/fix tunable direction=false" })),
  { id: "EU-vR-both", region: "american", part: "variable european resistor,mirror,invert",
    keys: "resistors/width=1.2,bipoles/tgeneric/height=.5",
    expected: anchors([783160, 652635], [-783160, -652635], [1566320, 0], [-1566320, 0]) },
  { id: "US-sR", region: "american", part: "sR",
    expected: anchors([-939790, -783169], [417681, 783169], ...flatEnds, [-417681, -783169]) },
  { id: "EU-sR", region: "european", part: "sR",
    expected: anchors([-1044219, -670374], [1044219, 558647], ...flatEnds, [-417681, -670374]) },
  { id: "US-sR-mirror", region: "european", part: "american resistive sensor,mirror", inclined: true,
    keys: "resistors/scale=.75,bipoles/resistivesens/width=1,bipoles/resistivesens/height=.5",
    expected: anchors([2730862, 2659964], [4336287, 2640391], [2946224, 2209656], [4512492, 3384380], [3122429, 2953645]) },
  { id: "EU-sR-invert", region: "american", part: "sR,invert", inclined: true,
    keys: "resistor=european,bipoles/thermistor/width=1.05,bipoles/thermistor/height=.54",
    expected: anchors([5333222, 2942709], [2210072, 2538559], [4825749, 3619327], [2632967, 1974709], [4675380, 2449318]) }
];

function picture(c, probe) {
  return String.raw`\begin{circuitikz}[${c.region} resistors]
${c.keys ? `\\ctikzset{${c.keys}}` : ""}
\draw (${c.inclined ? "0,0" : "-2,0"}) to[${c.part},name=R] (${c.inclined ? "4,3" : "2,0"});
${Object.keys(c.expected).map(probe).join("\n")}
\end{circuitikz}`;
}

for (const c of cases) {
  test(`${c.id}: named anchors resolve in a subsequent TikZ path`, () => {
    const source = picture(c, (name, i) => String.raw`\coordinate (probe${i}) at (R.${name});`);
    const { ir, diagnostics } = tikzToSvg(source, { mathRenderer: "svg-text" });
    assert.deepEqual(diagnostics, []);
    for (const [i, [name, expected]] of Object.entries(c.expected).entries()) {
      const p = ir.coordinates["probe" + i];
      assert.ok(p, `Missing coordinate for ${c.id}.${name}`);
      const actual = [p.x, p.y].map(v => Math.round(v * spPerCm));
      // Allow a few sp for the PGF rotation and conversion from public scene cm.
      assert.ok(actual.every((v, j) => Math.abs(v - expected[j]) <= 8),
        `${c.id}.${name}: got [${actual}] sp, expected [${expected}] sp (within 8 sp)`);
    }
  });
}

test("pdflatex remeasures the recorded CircuitikZ anchors", { skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1" }, () => {
  const source = String.raw`\documentclass{article}\usepackage{circuitikz}\makeatletter
\def\probe#1#2{\pgf@process{\pgfpointanchor{R}{#2}}\typeout{ANCHOR|#1|#2|\number\pgf@x|\number\pgf@y}}
\begin{document}
${cases.map(c => picture(c, name => String.raw`\probe{${c.id}}{${name}}`)).join("\n")}
\end{document}`;
  const cwd = mkdtempSync(join(tmpdir(), "resistor-modifiers-"));
  try {
    writeFileSync(join(cwd, "probe.tex"), source);
    const run = spawnSync("pdflatex", ["-draftmode", "-no-shell-escape", "-halt-on-error", "-interaction=nonstopmode", "probe.tex"],
      { cwd, encoding: "utf8" });
    assert.equal(run.status, 0, run.error?.message ?? run.stdout?.slice(-1500));
    const rows = readFileSync(join(cwd, "probe.log"), "utf8").split(/\r?\n/).filter(line => line.startsWith("ANCHOR|"));
    assert.deepEqual(rows, cases.flatMap(c => Object.entries(c.expected).map(([name, [x, y]]) =>
      `ANCHOR|${c.id}|${name}|${x}|${y}`)));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
