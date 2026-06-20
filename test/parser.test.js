import assert from "node:assert/strict";
import test from "node:test";
import { parseTikz } from "../src/index.js";

test("parses tikzpicture commands, options, coordinates, foreach, and nodes", () => {
  const source = String.raw`
\begin{tikzpicture}[scale=2]
  \coordinate (A) at (0,0);
  \foreach \x in {0,1,2} { \draw[red, thick] (\x,0) -- (\x,1); }
  \node at (1,0.5) {Hello};
\end{tikzpicture}`;

  const result = parseTikz(source);

  assert.equal(result.diagnostics.length, 0);
  assert.equal(result.ast.type, "document");
  assert.equal(result.ast.pictures.length, 1);
  assert.equal(result.ast.pictures[0].options.scale, "2");
  assert.equal(result.ast.pictures[0].statements.length, 3);
  assert.equal(result.ast.pictures[0].statements[1].type, "foreach");
  assert.equal(result.ast.pictures[0].statements[2].type, "node");
});

test("parses calc expressions without splitting path coordinates", () => {
  const source = String.raw`
\begin{tikzpicture}
  \coordinate (A) at (0,0);
  \coordinate (B) at (2,0);
  \draw ($(A)!0.5!(B)$) -- ($(A)+(0,1)$) -- (30:2);
\end{tikzpicture}`;

  const result = parseTikz(source);

  assert.equal(result.diagnostics.length, 0);
  const draw = result.ast.pictures[0].statements[2];
  assert.equal(draw.type, "path");
  assert.equal(draw.path.segments.length, 5);
  assert.equal(draw.path.segments[0].kind, "coordinate");
  assert.match(draw.path.segments[0].raw, /\$\(A\)!0\.5!\(B\)\$/);
});
