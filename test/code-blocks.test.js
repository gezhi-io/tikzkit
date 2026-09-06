import assert from "node:assert/strict";
import test from "node:test";
import { extractTikzCodeBlocks, splitTikzCodeBlocks } from "../src/code-blocks.js";
import {
  extractTikzCodeBlocks as frontendExtractTikzCodeBlocks,
  splitTikzCodeBlocks as frontendSplitTikzCodeBlocks
} from "../src/frontend/index.js";
import {
  extractTikzCodeBlocks as publicExtractTikzCodeBlocks,
  splitTikzCodeBlocks as publicSplitTikzCodeBlocks
} from "../src/index.js";

test("exposes tikz fenced code block extraction at the frontend seam", () => {
  assert.equal(frontendExtractTikzCodeBlocks, extractTikzCodeBlocks);
  assert.equal(frontendSplitTikzCodeBlocks, splitTikzCodeBlocks);
  assert.equal(publicExtractTikzCodeBlocks, extractTikzCodeBlocks);
  assert.equal(publicSplitTikzCodeBlocks, splitTikzCodeBlocks);
});

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

test("extracts CRLF fences while retaining source offsets and untouched text", () => {
  const input = "Before\r\n```tikz\r\n\\draw (0,0) -- (1,0);\r\n```\r\nAfter";
  const [block] = extractTikzCodeBlocks(input);
  assert.ok(block);
  assert.equal(block.code, "\\draw (0,0) -- (1,0);");
  assert.equal(input.slice(block.start, block.end), "```tikz\r\n\\draw (0,0) -- (1,0);\r\n```");
  assert.deepEqual(splitTikzCodeBlocks(input).map((part) => part.content), [
    "Before\r\n", block.code, "\r\nAfter"
  ]);
});

test("leaves TikZ examples inside other fenced code blocks untouched", () => {
  for (const outer of ["````markdown", "~~~markdown", "'''markdown"]) {
    const fence = outer.match(/^[`~']+/)[0];
    const input = `${outer}\n\`\`\`tikz\n\\node {example};\n\`\`\`\n${fence}\n`;
    assert.deepEqual(extractTikzCodeBlocks(input), [], outer);
    assert.deepEqual(splitTikzCodeBlocks(input), [{ type: "text", content: input }]);
  }
});

test("matches the exact TikZ language token and accepts metadata", () => {
  for (const language of ["tikzlibrary", "tikz-extra", "tikz.js", "TIKZ"]) {
    assert.deepEqual(extractTikzCodeBlocks(`\`\`\`${language}\ncode\n\`\`\``), []);
  }
  assert.equal(extractTikzCodeBlocks("``` tikz title=plot\ncode\n```")[0]?.code, "code");
});

test("recognizes longer and tilde fences with matching closing lengths", () => {
  for (const fence of ["````", "~~~~", "'''", "```", "~~~"]) {
    const input = `  ${fence}tikz\ncode\n  ${fence}${fence[0]} \t\nAfter`;
    const [block] = extractTikzCodeBlocks(input);
    assert.equal(block?.fence, fence);
    assert.equal(block?.code, "code");
    assert.equal(splitTikzCodeBlocks(input).at(-1).content, "\nAfter");
  }
  const input = "````tikz\ncode\n```\nstill code\n````";
  assert.equal(extractTikzCodeBlocks(input)[0]?.code, "code\n```\nstill code");
});

test("does not convert unclosed, indented-code, or mismatched fences", () => {
  for (const input of ["```tikz\ncode", "    ```tikz\ncode\n    ```", "```tikz\ncode\n~~~"]) {
    assert.deepEqual(extractTikzCodeBlocks(input), []);
  }
});
