import assert from "node:assert/strict";
import test from "node:test";
import { createSvgDefs, escapeAttribute, renderSvg, renderSvgText, svgPathData } from "../src/renderers/svg/index.js";
import { createSceneGraph } from "../src/scene/index.js";

test("svg renderer layer exposes render, escaping, defs, text, and path-data helpers", () => {
  const scene = createSceneGraph({
    items: [{ type: "path", commands: [{ type: "moveTo", x: 0, y: 0 }, { type: "lineTo", x: 1, y: 0 }], style: { stroke: "black" } }]
  });

  assert.match(renderSvg(scene), /<svg/);
  assert.equal(escapeAttribute(`"<&>`), "&quot;&lt;&amp;&gt;");
  assert.equal(svgPathData(scene.items[0].commands, 10), "M 0 0 L 10 0");
  assert.equal(createSvgDefs(["<marker />"]), "<defs><marker /></defs>");
  assert.match(renderSvgText({ text: "<x>", x: 1, y: 2 }), /&lt;x&gt;/);
});
