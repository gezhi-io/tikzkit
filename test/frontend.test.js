import assert from "node:assert/strict";
import test from "node:test";
import {
  createDiagnostic,
  createDocumentAst,
  createPictureAst,
  hasErrors,
  parseTikz,
  tokenizeTikzLikeSource
} from "../src/frontend/index.js";

test("frontend layer exposes parse, AST factories, diagnostics, and tokenization", () => {
  const tokens = tokenizeTikzLikeSource(String.raw`\draw[red] (0,0) -- (1,0);`);
  const parsed = parseTikz(String.raw`\draw (0,0) -- (1,0);`);
  const diagnostic = createDiagnostic("bad", { severity: "error" });

  assert.ok(tokens.some((token) => token.type === "control" && token.value === "\\draw"));
  assert.equal(createDocumentAst().type, "document");
  assert.equal(createPictureAst().type, "tikzpicture");
  assert.equal(parsed.diagnostics.length, 0);
  assert.equal(hasErrors([diagnostic]), true);
});
