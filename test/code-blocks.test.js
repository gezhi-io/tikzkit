import assert from "node:assert/strict";
import test from "node:test";
import { extractTikzCodeBlocks, splitTikzCodeBlocks } from "../src/code-blocks.js";

test("extracts tikz fenced code blocks from backtick and apostrophe fences", () => {
  const input = [
    "Before",
    "```tikz",
    "\\draw (0,0) -- (1,0);",
    "```",
    "Between",
    "'''tikz",
    "\\draw[red] (0,0) -- (0,1);",
    "'''",
    "After"
  ].join("\n");

  const blocks = extractTikzCodeBlocks(input);

  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].code.trim(), "\\draw (0,0) -- (1,0);");
  assert.equal(blocks[0].fence, "```");
  assert.equal(blocks[1].code.trim(), "\\draw[red] (0,0) -- (0,1);");
  assert.equal(blocks[1].fence, "'''");
});

test("splits markdown into text and tikz render parts in source order", () => {
  const input = "Alpha\n```tikz\n\\draw (0,0) -- (1,0);\n```\nOmega";

  const parts = splitTikzCodeBlocks(input);

  assert.deepEqual(
    parts.map((part) => part.type),
    ["text", "tikz", "text"]
  );
  assert.equal(parts[0].content.trim(), "Alpha");
  assert.equal(parts[1].content.trim(), "\\draw (0,0) -- (1,0);");
  assert.equal(parts[2].content.trim(), "Omega");
});
