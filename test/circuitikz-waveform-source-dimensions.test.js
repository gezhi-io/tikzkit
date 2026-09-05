import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

const FIXTURES = ["algorithm", "math", "physics"].map((name) => ({
  name,
  source: readFileSync(
    new URL(`./fixtures/examples/circuitikz/waveform-source-dimensions/${name}.tex`, import.meta.url),
    "utf8"
  )
}));

function commandBounds(commands = []) {
  const xs = [];
  const ys = [];
  for (const command of commands) {
    for (const suffix of ["", "1", "2"]) {
      if (Number.isFinite(command[`x${suffix}`])) xs.push(command[`x${suffix}`]);
      if (Number.isFinite(command[`y${suffix}`])) ys.push(command[`y${suffix}`]);
    }
  }
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  };
}

function render(body) {
  return tikzToSvg(String.raw`
    \documentclass[border=2pt]{standalone}
    \usepackage{circuitikz}
    \begin{document}
    ${body}
    \end{document}
  `, { margin: 0, mathRenderer: "svg-text" });
}

test("uses independent width and height for a square voltage source", () => {
  const result = render(String.raw`
    \begin{circuitikz}
      \ctikzset{bipoles/vsourcesquare/width=1.2,bipoles/vsourcesquare/height=.4}
      \draw (0,0) to[sqV] (4,0);
    \end{circuitikz}
  `);
  const outline = result.ir.items.find((item) => item.subtype === "circuitikz-square-voltage-source");
  const bounds = commandBounds(outline?.commands);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Math.abs(bounds.width - 1.68) < 1e-6);
  assert.ok(Math.abs(bounds.height - 0.56) < 1e-6);
});

test("composes source scale, asymmetric triangle dimensions, and vertical rotation", () => {
  const result = render(String.raw`
    \begin{circuitikz}
      \ctikzset{sources/scale=1.5,bipoles/vsourcetri/width=.5,bipoles/vsourcetri/height=1}
      \draw (0,0) to[vsourcetri] (0,4);
    \end{circuitikz}
  `);
  const outline = result.ir.items.find((item) => item.subtype === "circuitikz-triangular-voltage-source");
  const wave = result.ir.items.find((item) => item.subtype === "circuitikz-triangular-source-wave");
  const outlineBounds = commandBounds(outline?.commands);
  const waveBounds = commandBounds(wave?.commands);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Math.abs(outlineBounds.width - 2.1) < 1e-6);
  assert.ok(Math.abs(outlineBounds.height - 1.05) < 1e-6);
  assert.ok(waveBounds.width > waveBounds.height);
});

test("keeps class and local fills on the source outline but never on its open waveform", () => {
  const result = render(String.raw`
    \begin{circuitikz}
      \ctikzset{sources/fill=yellow!30}
      \draw (0,1) to[square voltage source] (3,1);
      \draw[fill=cyan!20] (0,-1) to[triangle voltage source] (3,-1);
    \end{circuitikz}
  `);
  const outlines = result.ir.items.filter((item) => /circuitikz-(?:square|triangular)-voltage-source/.test(item.subtype || ""));
  const waves = result.ir.items.filter((item) => /circuitikz-(?:square|triangular)-source-wave/.test(item.subtype || ""));

  assert.deepEqual(result.diagnostics, []);
  assert.equal(outlines.length, 2);
  assert.notEqual(outlines[0].style.fill, "none");
  assert.notEqual(outlines[1].style.fill, "none");
  assert.deepEqual(waves.map((item) => item.style.fill), ["none", "none"]);
});

test("applies document-scope ctikzset dimensions and preserves an in-picture override", () => {
  const result = tikzToSvg(String.raw`
    \documentclass[border=2pt]{standalone}
    \usepackage{circuitikz}
    \ctikzset{sources/scale=2,bipoles/vsourcesquare/width=1.2,bipoles/vsourcesquare/height=.4}
    \begin{document}
    \begin{circuitikz}
      \draw (0,1) to[sqV] (5,1);
      \ctikzset{bipoles/vsourcesquare/width=.5}
      \draw (0,-1) to[sqV] (5,-1);
    \end{circuitikz}
    \end{document}
  `, { margin: 0, mathRenderer: "svg-text" });
  const outlines = result.ir.items.filter((item) => item.subtype === "circuitikz-square-voltage-source");
  const bounds = outlines.map((item) => commandBounds(item.commands));

  assert.deepEqual(result.diagnostics, []);
  assert.equal(outlines.length, 2);
  assert.ok(Math.abs(bounds[0].width - 3.36) < 1e-6);
  assert.ok(Math.abs(bounds[1].width - 1.4) < 1e-6);
  assert.ok(bounds.every((item) => Math.abs(item.height - 1.12) < 1e-6));
});

test("does not leak an in-picture ctikzset override into the next picture", () => {
  const result = tikzToSvg(String.raw`
    \documentclass[border=2pt]{standalone}
    \usepackage{circuitikz}
    \ctikzset{bipoles/vsourcesquare/width=.8}
    \begin{document}
    \begin{circuitikz}
      \ctikzset{bipoles/vsourcesquare/width=1.2}
      \draw (0,0) to[sqV] (4,0);
    \end{circuitikz}
    \begin{circuitikz}
      \draw (0,0) to[sqV] (4,0);
    \end{circuitikz}
    \end{document}
  `, { margin: 0, mathRenderer: "svg-text" });
  const outlines = result.ir.items.filter((item) => item.subtype === "circuitikz-square-voltage-source");
  const bounds = outlines.map((item) => commandBounds(item.commands));

  assert.deepEqual(result.diagnostics, []);
  assert.equal(outlines.length, 2);
  assert.ok(Math.abs(bounds[0].width - 1.68) < 1e-6);
  assert.ok(Math.abs(bounds[1].width - 1.12) < 1e-6);
});

test("recognizes every documented square and triangle voltage-source alias", () => {
  const result = render(String.raw`
    \begin{circuitikz}
      \draw (0,0) to[sqV] (2,0) to[vsourcesquare] (4,0) to[square voltage source] (6,0);
      \draw (0,-2) to[tV] (2,-2) to[vsourcetri] (4,-2) to[triangle voltage source] (6,-2);
    \end{circuitikz}
  `);
  const outlines = result.ir.items.filter((item) => /circuitikz-(?:square|triangular)-voltage-source/.test(item.subtype || ""));

  assert.deepEqual(result.diagnostics, []);
  assert.equal(outlines.length, 6);
});

test("keeps component labels separate from voltage annotations and honors label sides", () => {
  const result = render(String.raw`
    \begin{circuitikz}
      \draw (0,0) to[sqV=wave,l_=source] (0,3)
            -- (3,3) to[R,l=resistor] (3,0) -- (0,0);
      \draw (5,0) to[tV,l_=ramp] (5,3)
            -- (8,3) to[C,l=capacitor] (8,0) -- (5,0);
    \end{circuitikz}
  `);
  const labels = result.ir.items.filter((item) => item.type === "textNode");
  const label = (text) => labels.find((item) => item.text === text);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(label("source")?.x > 0);
  assert.ok(label("resistor")?.x > 3);
  assert.ok(label("ramp")?.x > 5);
  assert.ok(label("capacitor")?.x > 8);
  assert.ok(label("wave"), "the active-source shortcut remains a voltage annotation");
  assert.equal(
    result.ir.items.filter((item) => item.subtype === "circuitikz-voltage-arrow").length,
    1
  );
});

test("renders asymmetric waveform sources in algorithm, mathematics, and physics graphics", () => {
  for (const fixture of FIXTURES) {
    const result = tikzToSvg(fixture.source, { margin: 0, mathRenderer: "svg-text" });
    const outlines = result.ir.items.filter((item) => /circuitikz-(?:square|triangular)-voltage-source/.test(item.subtype || ""));
    const waves = result.ir.items.filter((item) => /circuitikz-(?:square|triangular)-source-wave/.test(item.subtype || ""));

    assert.deepEqual(result.diagnostics, [], fixture.name);
    assert.ok(outlines.length >= 2, fixture.name);
    assert.equal(waves.length, outlines.length, fixture.name);
  }
});
