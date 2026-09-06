import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseTikz, tikzToSvg } from "../src/index.js";

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
  assert.match(result.svg, /viewBox="-8\.435035 -208\.435035 467\.390138 263\.299352"/);
  assert.match(result.svg, /<rect x="231\.564965" y="-205\.135683" width="20" height="20" fill="rgb\(255 128 0\)" stroke="none"/);
  assert.doesNotMatch(result.svg, /<rect x="240" y="-220" width="20" height="20" fill="rgb\(255 128 0\)" stroke="none"/);
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
