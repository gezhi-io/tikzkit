import assert from "node:assert/strict";
import test from "node:test";
import { buildCaseInsights, diffSeverity } from "../web/gallery-analysis.js";

test("builds concise capability insights from TikZ source and diff rows", () => {
  const source = String.raw`
\begin{tikzpicture}[cross/.style={path picture={\draw (0,0) -- (1,1);}}]
  \node {\includegraphics[width=2cm]{router.pdf}};
  \node[circle, shading=ball] {TikZ};
  \begin{axis}\addplot {x^2};\end{axis}
\end{tikzpicture}`;

  const insights = buildCaseInsights(source, [], {
    ok: false,
    changedPixelsRatio: 0.42,
    meanAbsDiff: 0.11
  });

  assert.equal(insights.diagnosticSummary, "0 diagnostics");
  assert.equal(insights.diffSummary, "diff fail · changed 42.00% · mean 0.1100");
  assert.deepEqual(
    insights.capabilities.map((item) => item.command),
    ["\\includegraphics", "path picture", "shading=ball", "pgfplots axis"]
  );
  assert.equal(insights.capabilities[0].status, "approximated");
  assert.equal(insights.capabilities[1].status, "partial");
});

test("classifies diff severity for gallery triage", () => {
  assert.equal(diffSeverity({ ok: true, changedPixelsRatio: 0.01 }), "pass");
  assert.equal(diffSeverity({ ok: false, changedPixelsRatio: 0.06 }), "near");
  assert.equal(diffSeverity({ ok: false, changedPixelsRatio: 0.18 }), "medium");
  assert.equal(diffSeverity({ ok: false, changedPixelsRatio: 0.7 }), "large");
  assert.equal(diffSeverity(null), "missing");
});
