import assert from "node:assert/strict";
import test from "node:test";
import { parsePathSegments, parseTikz } from "../src/frontend/parser.js";

test("modern circle and ellipse preserve the ordered local key source", () => {
  const raw = " radius=1pt, rotate=10, at={(1,2)}, x radius={max(1,2)}, radius={3pt}, rotate=20 ";
  for (const kind of ["circle", "ellipse"]) {
    const segments = parsePathSegments(`${kind} [${raw}][red] -- cycle`);
    assert.deepEqual(segments, [
      {
        kind, syntax: "modern", optionsRaw: raw, radius: kind === "circle" ? "3pt" : "",
        options: { at: "(1,2)", "x radius": "max(1,2)", radius: "3pt", rotate: "20" }
      },
      { kind: "options", options: { red: true } },
      { kind: "operator", value: "--", options: {} },
      { kind: "close" }
    ]);
  }
});

test("bare and empty-bracket operations leave inherited keys unresolved", () => {
  const { ast, diagnostics } = parseTikz(String.raw`\begin{tikzpicture}[radius=4mm]
    \draw[y radius=2mm] (0,0) circle--++(1,0) ellipse[](2,0) circle cycle;
    \end{tikzpicture}`);
  assert.deepEqual(diagnostics, []);
  const [picture] = ast.pictures;
  const [draw] = picture.statements;
  assert.equal(picture.options.radius, "4mm");
  assert.equal(draw.options["y radius"], "2mm");
  const modern = kind => ({ kind, syntax: "modern", options: {}, optionsRaw: "", radius: "" });
  assert.deepEqual(draw.path.segments, [
    { kind: "coordinate", raw: "0,0" }, modern("circle"),
    { kind: "operator", value: "--", options: {} },
    { kind: "coordinate", raw: "1,0", relative: "update" }, modern("ellipse"),
    { kind: "coordinate", raw: "2,0" }, modern("circle"), { kind: "close" }
  ]);
  assert.deepEqual(parsePathSegments("ellipse"), [modern("ellipse")]);
});

test("a bare circle leaves the next operation for the path scanner", () => {
  const segments = parsePathSegments("circle--cycle circlenode{A} ellipse rectangle (1,2) circleellipse[]cycle");
  assert.deepEqual(segments.map(s => s.kind), [
    "circle", "operator", "close", "circle", "node", "ellipse", "operator", "coordinate",
    "circle", "ellipse", "close"
  ]);
  assert.equal(segments[4].text, "A");
  assert.equal(segments[6].value, "rectangle");
  assert.deepEqual(parsePathSegments("circlecycle").map(s => s.kind), ["circle", "close"]);
});

test("both legacy spellings retain the radius text and distinguish scalars from pairs", () => {
  for (const kind of ["circle", "ellipse"]) {
    for (const [radius, legacyRadii] of [
      ["rand", ["rand"]],
      ["rand and rand", ["rand", "rand"]],
      [String.raw`\pgfkeysvalueof{/tikz/width and height}`, [String.raw`\pgfkeysvalueof{/tikz/width and height}`]],
      ["{max(1,2)}  and\n 3pt", ["{max(1,2)}", "3pt"]]
    ]) {
      assert.deepEqual(parsePathSegments(`${kind} (  ${radius}  )--cycle`), [
        { kind, syntax: "legacy", radius, legacyRadii, options: {}, optionsRaw: "" },
        { kind: "operator", value: "--", options: {} }, { kind: "close" }
      ]);
    }
  }
});

test("nested decoration and foreach paths retain radius variables until evaluation", () => {
  const [decoration] = parsePathSegments(String.raw`decorate {(0,0) \foreach \r in {1,2} {ellipse[radius=\r] circle(\r)}}`);
  const [, loop] = decoration.segments;
  const [modern, legacy] = loop.body;
  assert.equal(modern.optionsRaw, String.raw`radius=\r`);
  assert.deepEqual(legacy.legacyRadii, [String.raw`\r`]);
});

test("clip and simple paint paths keep compatible shape fields; units are left to evaluation", () => {
  const { ast, diagnostics } = parseTikz(String.raw`\begin{tikzpicture}
    \path[clip] (0,0) circle (2mm);
    \fill (1,0) circle[radius=4pt];
    \draw (2,0) ellipse (1 and 2pt);
    \draw (3,0) circle[x radius=1pt,y radius=2];
    \node[circle] at (4,0) {A};
    \end{tikzpicture}`);
  assert.deepEqual(diagnostics, []);
  const [clip, fill, legacy, modern, node] = ast.pictures[0].statements;
  assert.equal(clip.options.clip, true);
  assert.deepEqual(clip.path.segments.map(s => s.kind), ["coordinate", "circle"]);
  assert.equal(clip.path.segments[1].radius, "2mm");
  assert.equal(fill.path.segments[1].radius, "4pt");
  assert.deepEqual(legacy.path.segments[1].legacyRadii, ["1", "2pt"]);
  assert.deepEqual(modern.path.segments[1].options, { "x radius": "1pt", "y radius": "2" });
  assert.equal(node.type, "node");
  assert.equal(node.options.circle, true);
});
