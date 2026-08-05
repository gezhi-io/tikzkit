import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { lowerDeclaredArrowTips } from "../src/tikz/libraries/arrows.js";

const FIXTURE = new URL("./fixtures/examples/arrows/declared-leaf-tip.tex", import.meta.url);

function declaredPayload(source) {
  const match = source.match(/tikzkit declared arrow=([0-9a-f]+)/i);
  assert.ok(match, "expected a lowered declared-arrow payload");
  const encoded = match[1].match(/../g).map((byte) => String.fromCharCode(Number.parseInt(byte, 16))).join("");
  return JSON.parse(decodeURIComponent(encoded));
}

test("lowers legacy arrow extents into declared arrow geometry", () => {
  const lowered = lowerDeclaredArrowTips(readFileSync(FIXTURE, "utf8"));
  const payload = declaredPayload(lowered);

  assert.ok(Math.abs(payload.backEnd + 7.02919607165) < 1e-9);
  assert.ok(Math.abs(payload.tipEnd - 3.514598035827) < 1e-9);
  assert.equal(payload.lineEnd, 0);
});

test("uses declared tip and line ends to shorten the stem without generic arrow-bound expansion", () => {
  const result = tikzToSvg(readFileSync(FIXTURE, "utf8"), { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.match(result.svg, /d="M 0 0 L 296\.485402 0"/);
  assert.match(result.svg, /d="M 3\.514598 100 L 300 100"/);
  const width = Number(result.svg.match(/width="([\d.]+)pt"/)?.[1]);
  assert.equal(width, 90.22);
});
