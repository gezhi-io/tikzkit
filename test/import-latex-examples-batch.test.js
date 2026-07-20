import assert from "node:assert/strict";
import test from "node:test";
import { referencedResourceNames } from "../scripts/import-latex-examples-batch.js";

test("LaTeX example importer discovers local package files alongside data and images", () => {
  const resources = referencedResourceNames(String.raw`
    \usepackage{xcolor,brunnian}
    \includegraphics{diagram.png}
    \addplot table {points.csv};
  `);

  assert.equal(resources.includes("brunnian.sty"), true);
  assert.equal(resources.includes("xcolor.sty"), true);
  assert.equal(resources.includes("diagram.png"), true);
  assert.equal(resources.includes("points.csv"), true);
});
