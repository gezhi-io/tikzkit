import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseStatements, parseTikz, preprocessTikzSource } from "../src/frontend/index.js";
import { interpretTikz } from "../src/interpreter.js";
import { lineWidthFromTikzDimension } from "../src/tikz-metrics.js";

const raw = String.raw;
// pgfmanual-en-library-backgrounds.tex, second codeexample, plus a foreground witness.
const manual = raw`\tikzset{
  every picture/.style={line width=1ex},
  every on background layer/.style={every picture}
}
\begin{tikzpicture}
  \draw [->] (0,0) -- (2,1);
  \scoped[on background layer]
    \draw[red] (0,1) -- (2,0);
  \draw (2,0) -- (3,1);
\end{tikzpicture}`;

test("the backgrounds example scopes only its red path, not the next foreground path", () => {
  const { ast, diagnostics } = parseTikz(raw`\usetikzlibrary{backgrounds}` + "\n" + manual);
  assert.deepEqual(diagnostics, []);
  const statements = ast.pictures[0].statements;
  assert.deepEqual(statements.map(s => s.type), ["path", "scope", "path"]);
  const [arrow, scope, foreground] = statements;
  assert.deepEqual(arrow.options, { "->": true });
  assert.deepEqual(scope.options, { "on background layer": true });
  assert.deepEqual(scope.body.map(s => [s.command, s.options, s.path.raw]),
    [["draw", { red: true }, "(0,1) -- (2,0)"]]);
  assert.deepEqual([foreground.command, foreground.options, foreground.path.raw],
    ["draw", {}, "(2,0) -- (3,1)"]);
});

test("options, node text, control symbols and comments cannot end the single statement", () => {
  const statements = parseStatements(raw`\scoped % ignore [ { ;
    [right delimiter=\{,tag/.style={label={a];b}},red] % ignore }
    \draw (0,0) node {A; \} \%} % ignore ; } \draw
      -- (1,0);
    \node {next};`);
  assert.deepEqual(statements.map(s => s.type), ["scope", "node"]);
  const [scope, next] = statements;
  assert.deepEqual(scope.options, { "right delimiter": raw`\{`, "tag/.style": "label={a];b}", red: true });
  assert.equal(scope.body.length, 1);
  assert.deepEqual(scope.body[0].path.segments.map(s => s.kind), ["coordinate", "node", "operator", "coordinate"]);
  assert.equal(scope.body[0].path.segments[1].text, raw`A; \} \%`);
  assert.equal(next.text, "next");
});

test("a group closes at its brace, even before a bare group; options and a final semicolon are optional", () => {
  const statements = parseStatements(raw`\scoped % ignore { ;
    {\node {A;B}; \scoped[blue] {\node {\{C\}}} \node {D}}
    {\node {E};}\scoped{}\scoped \node {F}; \node {G};`);
  assert.deepEqual(statements.map(s => s.type), ["scope", "scope", "scope", "scope", "node"]);
  const [group, bare, empty, single, last] = statements;
  assert.deepEqual(group.options, {});
  assert.deepEqual(group.body.map(s => s.type), ["node", "scope", "node"]);
  assert.equal(group.body[0].text, "A;B");
  assert.deepEqual(group.body[1].options, { blue: true });
  assert.deepEqual(group.body[1].body.map(s => s.text), [raw`\{C\}`]);
  assert.equal(group.body[2].text, "D");
  assert.deepEqual(bare.body.map(s => s.text), ["E"]);
  assert.deepEqual(empty.body, []);
  assert.deepEqual(single.options, {});
  assert.deepEqual(single.body.map(s => s.text), ["F"]);
  assert.equal(last.text, "G");
});

test("only the exact scoped control word at statement position opens a shorthand scope", () => {
  const statements = parseStatements(raw`\scopedExtra[red] \draw (0,0)--(1,0);
    \node {\string\scoped[blue]};`);
  assert.equal(statements[0].command, "scopedExtra");
  assert.equal(statements[0].type, "unsupported");
  assert.equal(statements[1].text, raw`\string\scoped[blue]`);
});

const path = raw`\draw (0,0) -- (1,0)`;
const nested = raw`\begin{tikzpicture}[line width=1pt]
  \scoped[line width=2pt] ${path};
  ${path};
  \scoped[line width=3pt] {
    ${path};
    \begin{scope}[line width=4pt]
      \scoped[line width=5pt] ${path};
      ${path};
    \end{scope}
    ${path}
  }
  ${path};
\end{tikzpicture}`;
const nativeWidthsPt = [2, 1, 3, 5, 4, 3, 1];

const layerBlocks = {
  environment: (name, body) => raw`\begin{pgfonlayer} {${name}}${body}\end{pgfonlayer}`,
  command: (name, body) => raw`\pgfonlayer % ignored \endpgfonlayer
    {${name}}${body}\endpgfonlayer`
};

function layerTree(body) {
  const { ast, diagnostics } = parseTikz(raw`\begin{tikzpicture}${body}\end{tikzpicture}`);
  assert.deepEqual(diagnostics, []);
  const tree = statements => statements.map(s => {
    if (s.type === "node") return s.text;
    assert.equal(s.type, "scope");
    assert.deepEqual(s.options, { layer: "background" });
    return tree(s.body);
  });
  return tree(ast.pictures[0].statements);
}

test("nested pgfonlayer blocks pair their own delimiters in both spellings", () => {
  for (const outer of Object.values(layerBlocks)) {
    for (const inner of Object.values(layerBlocks)) {
      const middle = inner("background", raw`\node {inside};`);
      const background = outer("background", raw`\node {first};${middle}\node {last};`);
      assert.deepEqual(layerTree(raw`\node {before};${background}\node {after};`),
        ["before", ["first", ["inside"], "last"], "after"]);
    }
  }
});

test("non-background pgfonlayer blocks stay transparent, including around a background", () => {
  const { command, environment } = layerBlocks;
  const transparent = command("other", raw`\node {\string\endpgfonlayerExtra};`);
  const background = command("background", raw`${transparent}\node {B};`);
  assert.deepEqual(layerTree(environment("custom layer", raw`\node {A};${background}\node {C};`)),
    ["A", [raw`\string\endpgfonlayerExtra`, "B"], "C"]);
});

test("a quoted layer command stays in node text and a following braced foreground stays outside", () => {
  const label = raw`\string\pgfonlayer{background} and \string\endpgfonlayer`;
  const { ast, diagnostics } = parseTikz(raw`\begin{tikzpicture}
    \pgfonlayer{background}\node {${label}};\endpgfonlayer{\node {next};}
  \end{tikzpicture}`);
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(ast.pictures[0].statements.map(s => [s.type, s.options, s.body.map(n => n.text)]),
    [["scope", { layer: "background" }, [label]], ["scope", {}, ["next"]]]);
});

test("an unclosed pgfonlayer keeps its source and reports the unclosed block", () => {
  const body = raw`\begin{pgfonlayer}{background}\pgfonlayer{background}\draw (0,0);\endpgfonlayer`;
  const result = preprocessTikzSource(raw`\begin{tikzpicture}${body}\end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, [{ severity: "warning", message: "Unclosed pgfonlayer environment" }]);
  assert.ok(result.source.includes(body));
});

test("single, braced and ordinary nested scopes restore the pen measured in TikZ", () => {
  const { ast, diagnostics } = parseTikz(nested);
  assert.deepEqual(diagnostics, []);
  const result = interpretTikz(ast);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.ir.items.map(item => item.style.lineWidth),
    nativeWidthsPt.map(pt => lineWidthFromTikzDimension(`${pt}pt`)));
});

test("pdfLaTeX remeasures the manual, mixed low-level layer boundaries and nested scope pens", {
  skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1"
}, () => {
  const document = raw`\documentclass{article}\usepackage{tikz}\usetikzlibrary{backgrounds}
\makeatletter
\tikzset{every path/.append code={\typeout{SCOPED|\sample|\pgfonlayer@name|\the\pgflinewidth}}}
\makeatother
\begin{document}
\def\sample{manual}{${manual}}
\def\sample{pens}
${nested}
\def\sample{blocks}
\begin{tikzpicture}
  ${path};
  \pgfonlayer{background}
    ${path};
    \begin{pgfonlayer}{background}${path};\end{pgfonlayer}
    ${path};
  \endpgfonlayer
  ${path};
\end{tikzpicture}
\end{document}`;
  const cwd = mkdtempSync(join(tmpdir(), "tikz-scoped-"));
  try {
    writeFileSync(join(cwd, "scoped.tex"), document);
    const run = spawnSync("pdflatex", ["-no-shell-escape", "-draftmode", "-halt-on-error",
      "-interaction=nonstopmode", "scoped.tex"], { cwd, encoding: "utf8", timeout: 20000 });
    assert.equal(run.status, 0, run.error?.message ?? run.stdout.slice(-1500));
    const rows = [...run.stdout.matchAll(/^SCOPED\|(\w+)\|(\w+)\|([\d.]+)pt$/gm)];
    const layers = sample => rows.filter(m => m[1] === sample).map(m => m[2]);
    assert.deepEqual(layers("manual"), ["main", "background", "main"]);
    assert.deepEqual(layers("blocks"), ["main", "background", "background", "background", "main"]);
    assert.deepEqual(rows.filter(m => m[1] === "pens").map(m => Number(m[3])), nativeWidthsPt);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
