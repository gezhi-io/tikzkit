import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

const SOURCE = readFileSync(
  new URL("./fixtures/examples/circuitikz/sinusoidal-sources.tex", import.meta.url),
  "utf8"
);

test("renders scaled circuitikz sinusoidal voltage and current sources", () => {
  const result = tikzToSvg(SOURCE, { margin: 0, mathRenderer: "svg-text" });
  const voltage = result.ir.items.find((item) => item.subtype === "circuitikz-sinusoidal-voltage-source");
  const currentOutlines = result.ir.items.filter((item) => item.subtype === "circuitikz-sinusoidal-current-source");
  const waves = result.ir.items.filter((item) => item.subtype === "circuitikz-sinusoidal-source-wave");
  const openCurrent = currentOutlines.find((item) => item.sourceShape === "open");
  const currentLabelArrow = result.ir.items.find((item) => item.subtype === "circuitikz-current-arrow");
  const voltageLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === "$V$");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(voltage, "expected the sV source outline");
  assert.equal(currentOutlines.length, 2, "expected both sI source outlines");
  assert.equal(waves.length, 3, "expected one four-segment wave per sinusoidal source");
  assert.ok(openCurrent, "expected bipoles/isourcesin/angle to open the third sI outline");
  assert.equal(openCurrent.commands.filter((command) => command.type === "moveTo").length, 2);
  assert.ok(voltage.r > 0.49, "expected sources/scale=1.2 to enlarge the source radius");
  assert.ok(
    Math.abs(waves[0].style.lineWidth - voltage.style.lineWidth * 1.5) < 1e-9,
    "expected sources/symbol/thickness to scale only the internal wave"
  );
  assert.ok(currentLabelArrow, "expected sI=$I$ to render its external current arrow");
  assert.ok(voltageLabel?.y > 2.9, "expected the sinusoidal voltage label to clear the scaled source body");
  assert.ok(waves.every((item) => item.commands.filter((command) => command.type === "curveTo").length === 4));
});

test("accepts circuitikz sinusoidal source aliases", () => {
  const result = tikzToSvg(String.raw`\begin{circuitikz}
  \draw (0,0) to[vsourcesin,l=$V$] (2,0);
  \draw (0,1) to[isourcesin,i=$I$] (2,1);
  \draw (0,2) to[sinusoidal voltage source,l=$U$] (2,2);
\end{circuitikz}`, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ir.items.filter((item) => item.subtype === "circuitikz-sinusoidal-voltage-source").length, 2);
  assert.equal(result.ir.items.filter((item) => item.subtype === "circuitikz-sinusoidal-current-source").length, 1);
  assert.equal(result.ir.items.filter((item) => item.subtype === "circuitikz-sinusoidal-source-wave").length, 3);
});
