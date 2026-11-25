import assert from "node:assert/strict";
import test from "node:test";
import { interpretTikz, parseTikz } from "../src/index.js";

function run(source, options = {}) {
  const parsed = parseTikz(source, options);
  const { ir, diagnostics } = interpretTikz(parsed.ast, options);
  return { items: ir.items, diagnostics: [...parsed.diagnostics, ...diagnostics] };
}

function starts(result) {
  return result.items.filter(i => i.type === "path").map(i => i.commands[0].x);
}

test("list definitions are read at the loop, then restored after their scope", () => {
  const actual = run(String.raw`\begin{tikzpicture}
    \newcommand{\xs}{1,2}
    \foreach \x in \xs \draw (\x,0)--+(0,1);
    \begin{scope}
      \def\xs{5,7,...,11}
      \foreach \x in \xs {\draw (\x,0)--+(0,1);}
    \end{scope}
    \foreach \x in \xs {\draw (\x,0)--+(0,1);}
    \def\xs{} \foreach \x in \xs {\draw (99,0)--+(0,1);}
  \end{tikzpicture}`);
  assert.deepEqual(actual.diagnostics, []);
  assert.deepEqual(starts(actual), [1, 2, 5, 7, 9, 11, 1, 2]);
});

test("an iteration variable shadows a TeX list macro inside the body only", () => {
  const actual = run(String.raw`\def\row{8,9}
    \foreach \row in {{1,2},{3,5,7,9}} {
      \foreach \x in \row {\draw (\x,0)--+(0,1);}
    }
    \foreach \x in \row {\draw (\x,0)--+(0,1);}`);
  assert.deepEqual(actual.diagnostics, []);
  assert.deepEqual(starts(actual), [1, 2, 3, 5, 7, 9, 8, 9]);
});

test("a no-argument alias is one pgffor item, not a recursively spliced comma list", () => {
  const actual = run(String.raw`\def\pair{2,3}\def\alias{\pair,{a,b},c}
    \foreach \value in \alias {\node at (0,0) {\value};}`);
  assert.deepEqual(actual.diagnostics, []);
  assert.deepEqual(actual.items.filter(i => i.type === "textNode").map(i => i.text), ["2,3", "a,b", "c"]);
});

test("current runtime variables can supply a list without turning literal names into lookups", () => {
  const actual = run(String.raw`\tikzset{data/.store in=\xs, data={2,4,...,8}, one/.store in=\a, one=9,
      letters/.store in=\letters, letters={a,b}, pair/.store in=\pair, pair={2,3}, alias/.store in=\alias, alias={\pair}}
    \foreach \x in \xs {\draw (\x,0)--+(0,1);}
    \pgfmathsetmacro{\scalar}{2+3} \foreach \x in \scalar {\draw (\x,0)--+(0,1);}
    \foreach \x in \letters {\node at (0,0) {\x};}
    \def\static{a,b} \foreach \x in \static {\node at (0,0) {\x};}
    \foreach \x in \alias {\node at (0,0) {\x};}`);
  assert.deepEqual(actual.diagnostics, []);
  assert.deepEqual(starts(actual), [2, 4, 6, 8, 5]);
  assert.deepEqual(actual.items.filter(i => i.type === "textNode").map(i => i.text), ["a", "b", "a", "b", "2,3"]);
});

test("unbraced literal tokens are not accepted as comma lists", () => {
  for (const operand of ["0,45,90", "data"]) {
    const actual = run(String.raw`\foreach \x in ${operand} {\draw (99,0)--+(0,1);}`);
    assert.ok(actual.diagnostics.some(d => d.message === "Malformed \\foreach value list"));
    assert.deepEqual(starts(actual), []);
  }
});

test("invalid macro lists do not consume the body or the following statement", () => {
  for (const [setup, code] of [
    ["", "foreach-undefined-list"],
    [String.raw`\def\xs#1{1,2}`, "foreach-list-arguments"],
    [String.raw`\def\xs{\ys}\def\ys{\xs}`, "foreach-expansion-limit"]
  ]) {
    const actual = run(setup + String.raw`\foreach \x in \xs {\draw (99,0)--+(0,1);} \draw (4,0)--+(0,1);`);
    assert.ok(actual.diagnostics.some(d => d.code === code), JSON.stringify(actual.diagnostics));
    assert.deepEqual(starts(actual), [4]);
  }
  const badOption = run(String.raw`\def\bad{\bad}\def\data{1,2}
    \foreach \x[count=\n from \bad] in \data {\draw (99,0)--+(0,1);} \draw (4,0)--+(0,1);`);
  assert.deepEqual(badOption.diagnostics.map(d => d.code), ["foreach-expansion-limit"]);
  assert.deepEqual(starts(badOption), [4]);
});

test("macro lists and literal siblings share the iteration limit and reject oversized output", () => {
  const source = String.raw`\foreach \x in {0,1} {\draw (\x,0)--+(0,1);}
    \def\xs{2,3,...,3000000000}
    \foreach \x in \xs {\draw (\x,0)--+(0,1);}
    \draw (7,0)--+(0,1);`;
  for (const list of ["2,3,...,3000000000", "2,3,4"]) {
    const actual = run(source.replace("2,3,...,3000000000", list), { foreachLimits: { maxIterations: 4 } });
    assert.ok(actual.diagnostics.some(d => d.code === "foreach-expansion-limit"), JSON.stringify(actual.diagnostics));
    assert.deepEqual(starts(actual), [0, 1, 7]);
  }
  const tooLong = run(String.raw`\def\xs{abcdef}\foreach \x in \xs {\draw (99,0)--+(0,1);}`,
    { foreachLimits: { maxCharacters: 3 } });
  assert.ok(tooLong.diagnostics.some(d => d.code === "foreach-expansion-limit"));
  assert.deepEqual(starts(tooLong), []);
  const emptyScans = run(String.raw`\tikzset{data/.store in=\xs, data={,,,,}}
    ` + String.raw`\foreach \x in \xs {\draw (99,0)--+(0,1);}`.repeat(4) + String.raw`\draw (7,0)--+(0,1);`,
    { foreachLimits: { maxCharacters: 5 } });
  assert.ok(emptyScans.diagnostics.some(d => d.code === "foreach-expansion-limit"));
  assert.deepEqual(starts(emptyScans), [7]);
});
