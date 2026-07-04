import test from "node:test";
import assert from "node:assert/strict";
import { addSvgUnitGrid } from "../web/svg-grid.js";

test("inserts unit grid above TikZKit white background and below drawing content", () => {
  const svg = `<svg viewBox="0 0 100 100"><defs><style>.x{}</style></defs><rect class="tikz-background" x="0" y="0" width="100" height="100" fill="white" /><path class="draw" d="M0 0H100"/></svg>`;

  const withGrid = addSvgUnitGrid(svg, { unit: "tikzkit", id: "test-grid" });

  assert.match(withGrid, /<pattern id="test-grid"/);
  assert.ok(withGrid.indexOf('<pattern id="test-grid"') < withGrid.indexOf("</defs>"));
  assert.ok(withGrid.indexOf('class="tikz-background"') < withGrid.indexOf('class="tikzkit-unit-grid"'));
  assert.ok(withGrid.indexOf('class="tikzkit-unit-grid"') < withGrid.indexOf('class="draw"'));
});

test("inserts unit grid after defs when SVG has no renderer background", () => {
  const svg = `<svg viewBox="0 0 100 100"><defs><g id="glyph"/></defs><path class="draw" d="M0 0H100"/></svg>`;

  const withGrid = addSvgUnitGrid(svg, { unit: "pt", id: "native-grid" });

  assert.ok(withGrid.indexOf('<pattern id="native-grid"') < withGrid.indexOf("</defs>"));
  assert.ok(withGrid.indexOf("</defs>") < withGrid.indexOf('class="tikzkit-unit-grid"'));
  assert.ok(withGrid.indexOf('class="tikzkit-unit-grid"') < withGrid.indexOf('class="draw"'));
});
