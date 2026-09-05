import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { resolveInlineArrowTip } from "../src/renderers/svg/paths.js";
import { lowerDeclaredArrowTips, resolveDeclaredArrowGeometry } from "../src/tikz/libraries/arrows.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";

const unitsPerPt = lineWidthFromPt(1);

function inPt(value) {
  return Number(value) / unitsPerPt;
}

function close(actual, expected, label, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}

function declaredPayload(input) {
  const lowered = lowerDeclaredArrowTips(input);
  const match = lowered.match(/tikzkit declared arrow=([0-9a-f]+)/iu);
  assert.ok(match, "expected a lowered declared-arrow payload");
  const encoded = match[1].match(/../gu)
    .map((byte) => String.fromCharCode(Number.parseInt(byte, 16)))
    .join("");
  return JSON.parse(decodeURIComponent(encoded));
}

const hullArrow = String.raw`
  \pgfarrowsdeclare{hull leaf}{hull leaf}{
    \pgfarrowsleftextend{-1pt}
    \pgfarrowsrightextend{2pt}
    \pgfarrowshullpoint{2.5pt}{0pt}
    \pgfarrowsupperhullpoint{-1.5pt}{4pt}
  }{
    \pgfpathmoveto{\pgfqpoint{-1pt}{0pt}}
    \pgfpathlineto{\pgfqpoint{2pt}{0pt}}
    \pgfusepathqstroke
  }
  \draw[-{hull leaf}] (0,0) -- (1,0);
`;

test("uses explicit declared-arrow hull points for transformed picture bounds", () => {
  const geometry = resolveDeclaredArrowGeometry(declaredPayload(hullArrow), lineWidthFromPt(0.4));

  assert.equal(geometry.hasExplicitHull, true);
  assert.equal(geometry.strokeBoundsIncluded, true);
  close(inPt(geometry.bounds.minX), -1.5, "hull min x");
  close(inPt(geometry.bounds.maxX), 2.5, "hull max x");
  close(inPt(geometry.bounds.minY), -4, "mirrored hull min y");
  close(inPt(geometry.bounds.maxY), 4, "mirrored hull max y");

  const tip = resolveInlineArrowTip({ kind: "hull leaf", declaredArrow: declaredPayload(hullArrow) }, {
    stroke: "black",
    lineWidth: lineWidthFromPt(0.4)
  });
  assert.notEqual(tip.geometry.includeBounds, false);
  assert.equal(tip.geometry.hasExplicitHull, true);
});

test("evaluates declared hull registers and inline coordinate advances at the active line width", () => {
  const declaration = declaredPayload(String.raw`
    \pgfarrowsdeclare{adaptive hull}{adaptive hull}{
      \pgfutil@tempdima=.5pt
      \advance\pgfutil@tempdima by.5\pgflinewidth
      \pgfarrowsleftextend{-\pgfutil@tempdima}
      \pgfarrowsrightextend{2\pgfutil@tempdima}
      \pgfarrowshullpoint{2\pgfutil@tempdima\advance\pgf@x by.5\pgflinewidth}{0pt}
      \pgfarrowsupperhullpoint{-\pgfutil@tempdima}{2\pgfutil@tempdima\advance\pgf@y by\pgflinewidth}
    }{
      \pgfpathmoveto{\pgfqpoint{-1pt}{0pt}}
      \pgfpathlineto{\pgfqpoint{1pt}{0pt}}
      \pgfusepathqstroke
    }
    \draw[-{adaptive hull}] (0,0) -- (1,0);
  `);
  const thin = resolveDeclaredArrowGeometry(declaration, lineWidthFromPt(0.4));
  const thick = resolveDeclaredArrowGeometry(declaration, lineWidthFromPt(1.6));

  close(inPt(thin.bounds.maxX), 1.6, "thin hull max x");
  close(inPt(thin.bounds.maxY), 1.8, "thin hull max y");
  close(inPt(thick.bounds.maxX), 3.4, "thick hull max x");
  close(inPt(thick.bounds.maxY), 4.2, "thick hull max y");
  assert.ok(thick.bounds.maxX > thin.bounds.maxX);
});

test("reflects an explicit declared hull for reversed aliases", () => {
  const payload = declaredPayload(String.raw`
    \pgfarrowsdeclare{asymmetric hull}{asymmetric hull}{
      \pgfarrowsleftextend{-1pt}
      \pgfarrowsrightextend{2pt}
      \pgfarrowshullpoint{-2pt}{-1pt}
      \pgfarrowshullpoint{3pt}{4pt}
    }{
      \pgfpathmoveto{\pgfqpoint{-1pt}{0pt}}
      \pgfpathlineto{\pgfqpoint{2pt}{0pt}}
      \pgfusepathqstroke
    }
    \pgfarrowsdeclarereversed{asymmetric reversed}{asymmetric reversed}{asymmetric hull}{asymmetric hull}
    \draw[-{asymmetric reversed}] (0,0) -- (1,0);
  `);
  const geometry = resolveDeclaredArrowGeometry(payload, lineWidthFromPt(0.4));

  close(inPt(geometry.bounds.minX), -3, "reversed hull min x");
  close(inPt(geometry.bounds.maxX), 2, "reversed hull max x");
  close(inPt(geometry.bounds.minY), -4, "reversed hull min y");
  close(inPt(geometry.bounds.maxY), 1, "reversed hull max y");
});

test("suppresses arrow tips and endpoint shortening when a path also clips", () => {
  const result = tikzToSvg(String.raw`
    \begin{tikzpicture}
      \draw[clip,->] (0,0) -- (2,0);
    \end{tikzpicture}
  `);
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(path.style.markerStart, undefined);
  assert.equal(path.style.markerEnd, undefined);
  assert.equal(path.commands.at(-1).x, 2);
  assert.doesNotMatch(result.svg, /tikz-arrow-tip/u);
});

test("keeps declared hull bounds in the real control network with inline labels", () => {
  const source = readFileSync(
    new URL("fixtures/examples/arrows/declared-hull-control-network.tex", import.meta.url),
    "utf8"
  );
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const viewBox = result.svg.match(/\bviewBox="([^"]+)"/u)?.[1].split(/\s+/u).map(Number);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.svg.match(/class="tikz-arrow-tip/g)?.length, 5);
  assert.ok(viewBox && viewBox[1] < -260, `expected hull-expanded top bound, got ${viewBox?.[1]}`);
});
