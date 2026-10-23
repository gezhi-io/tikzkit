import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseTikz, tikzToSvg } from "../src/index.js";
import { renderFormOnlyPatternFill } from "../src/renderers/svg/formOnlyPatterns.js";

const WIDE_HATCHES = String.raw`
\begin{tikzpicture}
  \pgfdeclarepatternformonly{north east lines wide}
    {\pgfqpoint{-1pt}{-1pt}}
    {\pgfqpoint{10pt}{10pt}}
    {\pgfqpoint{9pt}{9pt}}
    {
      \pgfsetlinewidth{0.7pt}
      \pgfpathmoveto{\pgfqpoint{0pt}{0pt}}
      \pgfpathlineto{\pgfqpoint{9.1pt}{9.1pt}}
      \pgfusepath{stroke}
    }
  \draw[thick,red] (0,0) coordinate (a) -- (2,0) coordinate (b);
  \fill[pattern=north east lines wide,pattern color=red!50] (a) -- (b) -- (2,2) -- cycle;
\end{tikzpicture}`;

test("keeps form-only pattern declarations separate from following paths", () => {
  const parsed = parseTikz(WIDE_HATCHES);
  const statements = parsed.ast.pictures[0].statements;

  assert.deepEqual(parsed.diagnostics, []);
  assert.deepEqual(statements.map((statement) => statement.type), ["pgfdeclarepatternformonly", "path", "path"]);
  assert.equal(statements[0].name, "north east lines wide");
  assert.match(statements[0].body, /\\pgfpathlineto/);
});

test("renders declared form-only hatch geometry in SVG pattern defs", () => {
  const result = tikzToSvg(WIDE_HATCHES);
  const fill = result.ir.items.find((item) => item.type === "path" && item.style?.pattern);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(fill.style.patternDefinition.tileSize.x > 0, true);
  assert.equal(fill.style.patternDefinition.commands.length, 2);
  assert.match(result.svg, /x="-3\.514598" y="-35\.14598" width="31\.631382" height="31\.631382"/);
  assert.match(result.svg, /d="M 3\.514598 35\.14598 L 35\.49744 3\.163138"/);
  assert.match(result.svg, /stroke-width="2\.460219"/);
  assert.match(result.svg, /<g class="tikz-form-only-pattern" clip-path="url\(#tikzkit-[\da-f]{16}-tikz-form-pattern-clip-\d+\)">/);
  assert.equal((result.svg.match(/stroke="rgb\(255 128 128\)"/g) || []).length > 4, true);
});

test("renders form-only circle and rectangle primitives with their PGF fill actions", () => {
  const source = String.raw`
\begin{tikzpicture}
  \pgfdeclarepatternformonly{dots}
    {\pgfqpoint{-1pt}{-1pt}}
    {\pgfqpoint{1pt}{1pt}}
    {\pgfqpoint{3pt}{3pt}}
    {
      \pgfpathcircle{\pgfpointorigin}{.5pt}
      \pgfusepath{fill}
    }
  \pgfdeclarepatternformonly{checkerboard}
    {\pgfpointorigin}
    {\pgfqpoint{4mm}{4mm}}
    {\pgfqpoint{4mm}{4mm}}
    {
      \pgfpathrectangle{\pgfpointorigin}{\pgfqpoint{2mm}{2mm}}
      \pgfpathrectangle{\pgfqpoint{2mm}{2mm}}{\pgfqpoint{2mm}{2mm}}
      \pgfusepath{fill}
    }
  \fill[pattern=dots,pattern color=red] (0,0) rectangle (1,1);
  \fill[pattern=checkerboard,pattern color=blue] (1.2,0) rectangle (2.2,1);
\end{tikzpicture}`;
  const result = tikzToSvg(source);
  const fills = result.ir.items.filter((item) => item.type === "path" && item.style?.pattern);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(fills.length, 2);
  assert.equal(fills[0].style.patternDefinition.operations[0].commands[0].kind, "circle");
  assert.equal(fills[1].style.patternDefinition.operations[0].commands.filter((command) => command.kind === "rectangle").length, 2);
  assert.match(result.svg, /<circle cx="3\.514598" cy="3\.514598"/);
  assert.match(result.svg, /<circle[^>]+fill="red" stroke="none"/);
  assert.match(result.svg, /<rect[^>]+fill="blue" stroke="none"/);
});

test("anchors form-only tiles to the cropped page origin instead of the TikZ origin", async () => {
  const source = await readFile(
    new URL("./fixtures/examples/patterns/form-only-primitives.tex", import.meta.url),
    "utf8"
  );
  const result = tikzToSvg(source);

  assert.deepEqual(result.diagnostics, []);
  // The 2pt standalone border moves the PDF page origin by 8.435 SVG units.
  // PGF patterns are page-aligned, so their explicit SVG tiles must preserve
  // that offset rather than restarting at TikZ coordinate (0,0).
  // Native CMR10 em/ex metrics also determine the label's crop contribution.
  const viewBox = result.svg.match(/viewBox="([^"]+)"/)[1].split(" ").map(Number);
  const dimensions = result.svg.match(/width="([\d.]+)pt" height="([\d.]+)pt"/).slice(1).map(Number);
  // Independent MacTeX page: 132.475 x 74.835bp. The label's default
  // outer sep now contributes to its placement rather than being dropped.
  assert.ok(Math.abs(dimensions[0] - 132.475) < .02);
  assert.ok(Math.abs(dimensions[1] - 74.835) < .02);
  const paint = result.svg.replace(/<defs>[\s\S]*?<\/defs>/g, "");
  const tile = paint.match(/<rect x="([\d.-]+)" y="([\d.-]+)" width="20" height="20" fill="rgb\(255 128 0\)" stroke="none"/);
  assert.ok(tile);
  const latticeError = value => Math.abs(value / 20 - Math.round(value / 20));
  assert.ok(latticeError(Number(tile[1]) - viewBox[0]) < .000001);
  assert.ok(latticeError(Number(tile[2]) - viewBox[1] - viewBox[3]) < .000001);
  assert.doesNotMatch(result.svg, /<rect x="240" y="-220" width="20" height="20" fill="rgb\(255 128 0\)" stroke="none"/);
});

test("page-aligned tiles cover the complete clip after translating the page origin", () => {
  const unit = 100;
  const tile = 0.1;
  const radius = 0.015;
  const item = {
    commands: [{ kind: "move", x: 0, y: 0 }, { kind: "line", x: 2, y: 2 }],
    style: { pattern: "dots", patternDefinition: {
      tileSize: { x: tile, y: tile },
      lowerLeft: { x: -radius, y: -radius }, upperRight: { x: radius, y: radius },
      operations: [{ fill: true, commands: [{ kind: "circle", x: 0, y: 0, radius }] }]
    } }
  };
  for (const origin of [{ x: -8.4, y: 55.6 }, { x: 63, y: -27 }, { x: -140, y: 120 }]) {
    const svg = renderFormOnlyPatternFill(item, unit, "clip", origin);
    const circles = [...svg.matchAll(/<circle cx="([\d.-]+)" cy="([\d.-]+)"/g)]
      .map(match => ({ x: Number(match[1]), y: Number(match[2]) }));
    assert.ok(circles.length);
    // Inspect every lattice row/column that intersects the clip, including
    // the topmost row that disappeared when the crop gained a text descender.
    for (let y = Math.ceil(origin.y / (tile * unit)); y <= Math.floor((200 + origin.y) / (tile * unit)); y++) {
      for (let x = Math.ceil(-origin.x / (tile * unit)); x <= Math.floor((200 - origin.x) / (tile * unit)); x++) {
        const expectedX = origin.x + x * tile * unit;
        const expectedY = origin.y - y * tile * unit;
        assert.ok(circles.some(circle => Math.abs(circle.x - expectedX) < 1e-5 && Math.abs(circle.y - expectedY) < 1e-5),
          `missing tile at ${expectedX},${expectedY} for page origin ${JSON.stringify(origin)}`);
      }
    }
  }
});

test("uses preamble /.store in variables for a parameterized form-only tile", async () => {
  const source = await readFile(
    new URL("./fixtures/examples/patterns/parameterized-flexible-hatch.tex", import.meta.url),
    "utf8"
  );
  const parsed = parseTikz(source);
  const result = tikzToSvg(source);
  const fill = result.ir.items.find((item) => item.type === "path" && item.style?.pattern === "flexible hatch");

  assert.deepEqual(parsed.diagnostics, []);
  assert.deepEqual(parsed.ast.pictures[0].storedVariables, {
    hatchdistance: "10pt",
    hatchthickness: "2pt"
  });
  assert.deepEqual(parsed.ast.pictures[0].patternDeclarations.map((pattern) => pattern.name), ["flexible hatch"]);
  assert.deepEqual(result.diagnostics, []);
  assert.ok(fill?.style?.patternDefinition);
  assert.equal(fill.style.patternDefinition.tileSize.x, 9 / 28.4527559);
  assert.equal(fill.style.patternDefinition.tileSize.y, 9 / 28.4527559);
  assert.equal(fill.style.patternDefinition.lineWidth, 2 / 28.4527559);
  assert.match(result.svg, /stroke-width="7\.029196"/);
});
