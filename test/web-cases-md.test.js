import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findTikzCaseIndexByHash, parseTikzCasesMarkdown } from "../web/cases-md.js";

test("finds TikZ case index from URL hash ids", () => {
  const cases = parseTikzCasesMarkdown(
    [
      "## datavisualization-023: Closed visualizer handlers",
      "",
      "```tikz",
      "\\tikz \\draw (0,0) -- (1,0);",
      "```",
      "",
      "## datavisualization-024: Vary thickness and dashing style sheet",
      "",
      "```tikz",
      "\\tikz \\draw (0,0) -- (1,1);",
      "```"
    ].join("\n")
  );

  assert.equal(findTikzCaseIndexByHash(cases, "#datavisualization-024"), 1);
  assert.equal(findTikzCaseIndexByHash(cases, "datavisualization-023"), 0);
  assert.equal(findTikzCaseIndexByHash(cases, "#missing"), -1);
});

test("includes Section 85 low-level polar degrees and radians comparison cases", () => {
  const cases = parseTikzCasesMarkdown(readFileSync(new URL("../web/cases.md", import.meta.url), "utf8"));
  const byId = new Map(cases.map((item) => [item.id, item]));

  assert.match(byId.get("datavisualization-082")?.source || "", /angle axis=\{degrees\}/);
  assert.match(byId.get("datavisualization-083")?.source || "", /angle axis=\{radians\}/);
});
