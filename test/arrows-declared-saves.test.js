import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { lowerDeclaredArrowTips, resolveDeclaredArrowGeometry } from "../src/tikz/libraries/arrows.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";

const unitsPerPt = lineWidthFromPt(1);

function inPt(value) {
  return Number(value) / unitsPerPt;
}

function close(actual, expected, label, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}

function declaredPayload(source) {
  const diagnostics = [];
  const lowered = lowerDeclaredArrowTips(source, diagnostics);
  const match = lowered.match(/tikzkit declared arrow=([0-9a-f]+)/iu);
  assert.deepEqual(diagnostics, []);
  assert.ok(match, "expected a lowered declared-arrow payload");
  const encoded = match[1].match(/../gu)
    .map((byte) => String.fromCharCode(Number.parseInt(byte, 16)))
    .join("");
  return JSON.parse(decodeURIComponent(encoded));
}

test("restores a pgfarrowssavethe dimension register in drawing code", () => {
  const declaration = declaredPayload(String.raw`
    \pgfarrowsdeclare{saved wedge}{saved wedge}{
      \pgfutil@tempdima=.8pt
      \advance\pgfutil@tempdima by.5\pgflinewidth
      \pgfarrowssavethe\pgfutil@tempdima
      \pgfarrowsleftextend{-\pgfutil@tempdima}
      \pgfarrowsrightextend{2\pgfutil@tempdima}
    }{
      \pgfpathmoveto{\pgfqpoint{-\pgfutil@tempdima}{-\pgfutil@tempdima}}
      \pgfpathlineto{\pgfqpoint{2\pgfutil@tempdima}{0pt}}
      \pgfpathlineto{\pgfqpoint{-\pgfutil@tempdima}{\pgfutil@tempdima}}
      \pgfpathclose
      \pgfusepathqfill
    }
    \draw[-{saved wedge}] (0,0) -- (2,0);
  `);
  const geometry = resolveDeclaredArrowGeometry(declaration, lineWidthFromPt(1.2));

  close(inPt(geometry.backEnd), -1.4, "backend");
  close(inPt(geometry.tipEnd), 2.8, "tip end");
  close(inPt(geometry.bounds.minX), -1.4, "path min x");
  close(inPt(geometry.bounds.maxX), 2.8, "path max x");
  close(inPt(geometry.bounds.minY), -1.4, "path min y");
  close(inPt(geometry.bounds.maxY), 1.4, "path max y");
});

test("restores a pgfarrowssave scalar macro with a saved dimension register", () => {
  const declaration = declaredPayload(String.raw`
    \pgfarrowsdeclare{saved scaled wedge}{saved scaled wedge}{
      \def\arrowfactor{2}
      \pgfarrowssave\arrowfactor
      \pgfutil@tempdima=.5pt
      \advance\pgfutil@tempdima by.25\pgflinewidth
      \pgfarrowssavethe\pgfutil@tempdima
      \pgfarrowsleftextend{-\pgfutil@tempdima}
      \pgfarrowsrightextend{\arrowfactor\pgfutil@tempdima}
    }{
      \pgfpathmoveto{\pgfqpoint{-\pgfutil@tempdima}{-\arrowfactor\pgfutil@tempdima}}
      \pgfpathlineto{\pgfqpoint{\arrowfactor\pgfutil@tempdima}{0pt}}
      \pgfpathlineto{\pgfqpoint{-\pgfutil@tempdima}{\arrowfactor\pgfutil@tempdima}}
      \pgfpathclose
      \pgfusepathqfillstroke
    }
    \draw[-{saved scaled wedge}] (0,0) -- (2,0);
  `);
  const geometry = resolveDeclaredArrowGeometry(declaration, lineWidthFromPt(0.8));

  close(inPt(geometry.backEnd), -0.7, "backend");
  close(inPt(geometry.tipEnd), 1.4, "tip end");
  close(inPt(geometry.bounds.minY), -1.4, "path min y");
  close(inPt(geometry.bounds.maxY), 1.4, "path max y");
  assert.equal(geometry.paint, "fillstroke");
});

test("snapshots the final register value when assignment, advance, and save share a line", () => {
  const declaration = declaredPayload(String.raw`
    \pgfarrowsdeclare{compact saved}{compact saved}{
      \pgfutil@tempdima=.5pt \advance\pgfutil@tempdima by.25\pgflinewidth \pgfarrowssavethe\pgfutil@tempdima
      \pgfarrowsleftextend{-\pgfutil@tempdima}
      \pgfarrowsrightextend{2\pgfutil@tempdima}
    }{
      \pgfpathmoveto{\pgfqpoint{-\pgfutil@tempdima}{-\pgfutil@tempdima}}
      \pgfpathlineto{\pgfqpoint{2\pgfutil@tempdima}{0pt}}
      \pgfpathlineto{\pgfqpoint{-\pgfutil@tempdima}{\pgfutil@tempdima}}
      \pgfpathclose
      \pgfusepathqfill
    }
    \draw[-{compact saved}] (0,0) -- (2,0);
  `);
  const geometry = resolveDeclaredArrowGeometry(declaration, lineWidthFromPt(0.8));

  close(inPt(geometry.backEnd), -0.7, "same-line backend");
  close(inPt(geometry.tipEnd), 1.4, "same-line tip end");
  close(inPt(geometry.bounds.maxY), 0.7, "same-line aperture");
});

test("uses saved scalar macros as dimensions and pgfpatharc angles", () => {
  const declaration = declaredPayload(String.raw`
    \pgfarrowsdeclare{saved arc}{saved arc}{
      \def\savedradius{1.25}
      \def\savedangle{-90}
      \pgfarrowssave\savedradius
      \pgfarrowssave\savedangle
      \pgfarrowsleftextend{-\savedradius pt}
      \pgfarrowsrightextend{\savedradius pt}
    }{
      \pgfpathmoveto{\pgfqpoint{0pt}{\savedradius pt}}
      \pgfpatharc{90}{\savedangle}{\savedradius pt}
      \pgfusepathqstroke
    }
    \draw[-{saved arc}] (0,0) -- (2,0);
  `);
  const geometry = resolveDeclaredArrowGeometry(declaration, lineWidthFromPt(0.4));

  close(inPt(geometry.backEnd), -1.25, "arc backend");
  close(inPt(geometry.tipEnd), 1.25, "arc tip end");
  close(inPt(geometry.bounds.minY), -1.25, "arc min y");
  close(inPt(geometry.bounds.maxY), 1.25, "arc max y");
  assert.match(geometry.path, /^M .* C .* C /u);
});

test("does not leak an unsaved setup register into drawing code", () => {
  const diagnostics = [];
  const source = String.raw`
    \pgfarrowsdeclare{unsaved wedge}{unsaved wedge}{
      \pgfutil@tempdima=1pt
      \pgfarrowsleftextend{-1pt}
      \pgfarrowsrightextend{2pt}
    }{
      \pgfpathmoveto{\pgfqpoint{-\pgfutil@tempdima}{-1pt}}
      \pgfpathlineto{\pgfqpoint{2pt}{0pt}}
      \pgfpathlineto{\pgfqpoint{-1pt}{1pt}}
      \pgfpathclose
      \pgfusepathqfill
    }
    \draw[-{unsaved wedge}] (0,0) -- (2,0);
  `;
  const lowered = lowerDeclaredArrowTips(source, diagnostics);

  assert.deepEqual(diagnostics, [
    { severity: "warning", message: "Unsupported pgfarrowsdeclare drawing program" }
  ]);
  assert.doesNotMatch(lowered, /tikzkit declared arrow=/u);
});

test("keeps saved state through declared aliases and double-arrow composition", () => {
  const result = tikzToSvg(String.raw`
    \pgfarrowsdeclare{saved tooth}{saved tooth}{
      \pgfutil@tempdima=.6pt
      \advance\pgfutil@tempdima by.25\pgflinewidth
      \pgfarrowssavethe\pgfutil@tempdima
      \pgfarrowsleftextend{-\pgfutil@tempdima}
      \pgfarrowsrightextend{2\pgfutil@tempdima}
    }{
      \pgfpathmoveto{\pgfqpoint{-\pgfutil@tempdima}{-\pgfutil@tempdima}}
      \pgfpathlineto{\pgfqpoint{2\pgfutil@tempdima}{0pt}}
      \pgfpathlineto{\pgfqpoint{-\pgfutil@tempdima}{\pgfutil@tempdima}}
      \pgfpathclose
      \pgfusepathqfill
    }
    \pgfarrowsdeclarealias{saved alias}{saved alias}{saved tooth}{saved tooth}
    \pgfarrowsdeclaredouble[.5\pgflinewidth]{saved double}{saved double}{saved alias}{saved alias}
    \begin{tikzpicture}
      \draw[blue,line width=.4pt,-{saved alias}] (0,0) -- (2,0);
      \draw[red,line width=1.6pt,-{saved double}] (0,-.5) -- (2,-.5);
    \end{tikzpicture}
  `, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.svg.match(/class="tikz-arrow-tip/g)?.length, 3);
  assert.equal(result.svg.match(/tikz-arrow-saved alias/g)?.length, 3);
});

test("renders saved setup values in algorithm, mathematics, and physics graphics", () => {
  for (const name of ["algorithm", "math", "physics"]) {
    const source = readFileSync(
      new URL(`fixtures/examples/arrows/declared-saves/${name}.tex`, import.meta.url),
      "utf8"
    );
    const result = tikzToSvg(source, { mathRenderer: "svg-text" });

    assert.deepEqual(result.diagnostics, [], name);
    assert.equal(result.svg.match(/class="tikz-arrow-tip/g)?.length, 3, name);
  }
});
