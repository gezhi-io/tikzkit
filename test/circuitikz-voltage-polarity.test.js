import assert from "node:assert/strict";
import test from "node:test";
import { interpretTikz, parseTikz } from "../src/index.js";

test("uses RP polarity signs instead of voltage arrows for American circuitikz bipoles", () => {
  const source = String.raw`
\usepackage[siunitx,RPvoltages]{circuitikz}
\begin{circuitikz}[american]
  \draw (0,0)
    to[R=2<\ohm>, v=84<\volt>] (3,0)
    -- (3,2)
    to[V<=$\SI{5}{\volt}$] (0,2)
    -- (0,0);
\end{circuitikz}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const voltageArrows = ir.items.filter((item) => item.subtype === "circuitikz-voltage-arrow");
  const symbols = ir.items.filter((item) => item.type === "textNode");
  const resistorPlus = symbols.find((item) => item.text === "+" && item.y < 0);
  const resistorMinus = symbols.find((item) => item.text === "-" && item.y < 0);
  const sourcePlus = symbols.find((item) => item.text === "+" && item.y > 1.5);
  const sourceMinus = symbols.find((item) => item.text === "-" && item.y > 1.5);
  const sourceValue = symbols.find((item) => item.text === "$5 V$");

  assert.deepEqual(diagnostics, []);
  assert.equal(voltageArrows.length, 0, "American voltage notation uses +/- signs, not arrows");
  assert.ok(resistorPlus?.x < 1.5, `expected backward RP plus on the resistor start side, got x=${resistorPlus?.x}`);
  assert.ok(resistorMinus?.x > 1.5, `expected backward RP minus on the resistor target side, got x=${resistorMinus?.x}`);
  assert.ok(sourcePlus?.x < sourceMinus?.x, "expected the source polarity signs inside the circle");
  assert.equal(sourcePlus?.rotation, 90, "expected the default American source plus sign to use the native vertical rotation");
  assert.equal(sourceMinus?.rotation, 90, "expected the default American source minus sign to use the native vertical rotation");
  assert.ok(sourceValue?.y > 1 && sourceValue?.y < 1.5, "expected the source value below the horizontal source");
});

test("honors circuitikz American source sign rotation modes", () => {
  const source = String.raw`
\usepackage{circuitikz}
\begin{circuitikz}[american]
  \draw (0,0) to[V=1] (2,0);
  \ctikzset{sources/symbol/sign rotation=auto}
  \draw (0,-1) to[V=1] (2,-1);
  \ctikzset{sources/symbol/sign rotation=straight}
  \draw (0,-2) to[V=1] (0,-4);
  \ctikzset{sources/symbol/sign rotation=30}
  \draw (1,-2) to[V=1] (3,-2);
\end{circuitikz}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const rotationsAt = (y, predicate = () => true) => ir.items
    .filter((item) => item.type === "textNode" && /^[+-]$/.test(item.text) && Math.abs(item.y - y) < 0.25 && predicate(item))
    .map((item) => Number(item.rotation) || 0);

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(rotationsAt(0), [90, 90], "default keeps traditional vertical signs");
  assert.deepEqual(rotationsAt(-1), [0, 0], "auto keeps horizontal-path signs readable");
  assert.deepEqual(rotationsAt(-3), [90, 90], "straight follows the vertical path transform");
  assert.deepEqual(rotationsAt(-2, (item) => item.x > 1), [30, 30], "numeric rotation is passed through");
});

test("keeps RP voltage arrows for European circuitikz notation", () => {
  const source = String.raw`
\usepackage[siunitx,RPvoltages]{circuitikz}
\begin{tikzpicture}
  \draw (0,0) to[R=2<\ohm>, v=84<\volt>] (3,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const voltageArrows = ir.items.filter((item) => item.subtype === "circuitikz-voltage-arrow");

  assert.deepEqual(diagnostics, []);
  assert.equal(voltageArrows.length, 1, "European voltage notation retains its reference-polarity arrow");
});
