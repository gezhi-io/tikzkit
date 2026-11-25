import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { layoutNativeMath } from "../src/tex/mathBox.js";

const source = readFileSync(new URL("./fixtures/native-petri/mutual-exclusion.tex", import.meta.url), "utf8");
const ptPerCm = 72.27 / 2.54;
const adjacency = [
  "<p1 >p2", "<p2 <m1f >p3 >m1t", "<p3 >p4 =h1", "<p3 <h2 >p4 >h1",
  "<p4 >p5 =m2f", "<p4 >p5 =h2", "<p5 <m1t >p6 >m1f", "<p6 >p1",
  "<q1 >q2", "<q2 <m2f >q3 >m2t", "<q3 >q4 =h2", "<q3 <h1 >q4 >h2",
  "<q4 >q5 =m1f", "<q4 >q5 =h1", "<q5 <m2t >q6 >m2f", "<q6 >q1"
];

function network() {
  const { ir, diagnostics } = tikzToSvg(source);
  assert.deepEqual(diagnostics, []);
  const boxes = ir.items.filter(p => p.type === "nodeBox");
  return {
    places: boxes.filter(p => p.shape === "circle" && p.id),
    tokens: boxes.filter(p => p.shape === "circle" && !p.id),
    transitions: boxes.filter(p => p.shape === "rectangle"),
    labels: ir.items.filter(p => p.type === "textNode" && p.text),
    arcs: ir.items.filter(p => p.type === "path")
  };
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const nearest = (p, nodes) => nodes.reduce((a, b) => distance(p, a) < distance(p, b) ? a : b);
const direction = p => p.style.markerStart ? (p.style.markerEnd ? "=" : "<") : (p.style.markerEnd ? ">" : "");

test("full Petri manual net expands both foreach lists and places its five initial tokens", () => {
  const { places, transitions, tokens, labels } = network();
  const numbers = Array.from({ length: 6 }, (_, i) => i + 1);
  assert.deepEqual(places.map(p => p.id), [...numbers.flatMap(i => ["p" + i, "q" + i]), "m1f", "m1t", "m2f", "m2t", "h1", "h2"]);
  assert.equal(transitions.length, 16);
  assert.deepEqual(tokens.map(p => nearest(p, places).id), ["p1", "q1", "m1f", "m2f", "h1"]);
  assert.ok(tokens.every(p => distance(p, nearest(p, places)) < 1e-6));
  assert.deepEqual(labels.map(p => p.text.replace(/^\{(.*)\}$/, "$1")), [
    ...numbers.flatMap(i => [`$p_${i}$`, `$q_${i}$`]), "$m_1 = f$", "$m_1 = t$", "$m_2 = f$", "$m_2 = t$",
    String.raw`$\mathit{hold} = 1$`, String.raw`$\mathit{hold} = 2$`
  ]);
});

test("all 50 directed relations start at their own anonymous Petri transition", () => {
  const { places, transitions, arcs } = network();
  assert.equal(arcs.length, 50);
  const observed = transitions.map(() => []);
  for (const p of arcs) {
    assert.deepEqual(p.commands.map(c => c.type), ["moveTo", "lineTo"]);
    const owner = nearest(p.commands[0], transitions);
    observed[transitions.indexOf(owner)].push(direction(p) + nearest(p.commands[1], places).id);
  }
  assert.deepEqual(observed.map(row => row.join(" ")), adjacency);
});

test("both SVG modes paint the two hold labels in scoped text italic", () => {
  const tiny = String.raw`\tikz\node[font=\tiny] {$\mathit{hold} = 1$};`;
  for (const options of [{}, { mathRenderer: "svg-text" }]) {
    const { svg } = tikzToSvg(source, options);
    const labels = Array.from(svg.matchAll(/<g class="tikz-math-native"[^>]*>(.*?)<\/g>/gs),
      ([, inner]) => Array.from(inner.matchAll(/<text\b[^>]*font-family="([^"]+)"[^>]*>([^<]+)<\/text>/g),
        ([, face, char]) => [char, face]));
    assert.equal(labels.length, 18);
    assert.deepEqual(labels.slice(-2), ["1", "2"].map(digit => [
      ...[..."hold"].map(char => [char, "TikZKitCMTI10"]), ["=", "TikZKitCMR10"], [digit, "TikZKitCMR10"]
    ]));
    // The exact tiny optical face isn't bundled. Its text fallback must
    // still paint the argument, not the alphabet selector.
    const fallback = tikzToSvg(tiny, options).svg;
    const text = Array.from(fallback.matchAll(/<text\b[^>]*>(.*?)<\/text>/gs), ([, s]) => s.replace(/<[^>]+>/g, ""));
    assert.equal(text.join("").replace(/\s+/g, ""), "hold=1");
  }
});

const mathProbes = [String.raw`\mathit{hold} = 1`, String.raw`\mathit{hold} = 2`,
  String.raw`\mathit{Ta}`, String.raw`\mathit{fi}`, String.raw`\mathit{hold}_2`, String.raw`\mathit{h}_2`];

// Observe the original node paint callback (including anonymous nodes and
// labels) and the original edge soft path before shorten/arrow processing.
const hook = String.raw`\makeatletter\newwrite\out \immediate\openout\out=net.points
\def\petriMeasure#1#2{\begingroup\setbox0=\hbox{$#2$}%
  \immediate\write\out{hbox|#1|\strip@pt\wd0|\strip@pt\ht0|\strip@pt\dp0}\endgroup}
\let\oldnode\pgfmultipartnode
\def\pgfmultipartnode#1#2#3#4{\oldnode{#1}{#2}{#3}{\begingroup
  \pgfpointtransformed{\pgf@sh@reanchor{#1}{center}}\edef\xy{\strip@pt\pgf@x|\strip@pt\pgf@y}
  \pgfpointtransformed{\pgf@sh@reanchor{#1}{north east}}
  \immediate\write\out{node|#1|#3|\xy|\strip@pt\pgf@x|\strip@pt\pgf@y}\endgroup#4}}
\def\capture#1{\begingroup\pgfgetpath\saved
  \def\pgfsyssoftpath@movetotoken##1##2{\pgf@x=##1\pgf@y=##2 \edef\xy{\strip@pt\pgf@x|\strip@pt\pgf@y}}
  \def\pgfsyssoftpath@linetotoken##1##2{\pgf@x=##1\pgf@y=##2 \immediate\write\out{edge|#1|\xy|\strip@pt\pgf@x|\strip@pt\pgf@y}}\saved\endgroup}
\tikzset{pre/.append code={\tikz@addmode{\capture{<}}},post/.append code={\tikz@addmode{\capture{>}}},
  pre and post/.append code={\tikz@addmode{\capture{=}}}}\makeatother`;

function nativeRecords() {
  const dir = mkdtempSync(join(tmpdir(), "petri-net-"));
  try {
    const probes = mathProbes.map((tex, i) => String.raw`\petriMeasure{${i}}{${tex}}`).join("\n");
    writeFileSync(join(dir, "probe.tex"), source.replace("\\begin{document}", () => hook + "\n\\begin{document}\n" + probes));
    const r = spawnSync(process.env.QA_LATEX_ENGINE || "pdflatex",
      ["-no-shell-escape", "-interaction=nonstopmode", "-halt-on-error", "probe.tex"], { cwd: dir, encoding: "utf8", timeout: 30000 });
    assert.ifError(r.error);
    assert.equal(r.status, 0, r.stdout.slice(-1800));
    return readFileSync(join(dir, "net.points"), "utf8").trim().split(/\r?\n/).map(s => s.split("|"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("full Petri net matches native node boxes, label centers and border-to-border arcs",
  { skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1" }, async t => {
    const records = nativeRecords(), scene = network();
    const near = (cm, pt, tol, label) => assert.ok(Math.abs(cm * ptPerCm - pt) <= tol, `${label}: JS ${cm * ptPerCm}, native ${pt} pt`);
    await t.test("text-italic hboxes, including ligature, kern and scripts", () => {
      const rows = records.filter(([kind]) => kind === "hbox");
      assert.equal(rows.length, mathProbes.length);
      rows.forEach(([, id, ...dims]) => {
        const tex = mathProbes[Number(id)], box = layoutNativeMath(tex);
        assert.ok(box, tex);
        ["width", "height", "depth"].forEach((key, i) =>
          assert.ok(Math.abs(box[key] - Number(dims[i])) < .001, `${tex} ${key}: JS ${box[key]}, native ${dims[i]} pt`));
      });
    });
    for (const [role, shape, named] of [["places", "circle", true], ["transitions", "rectangle", true],
      ["tokens", "circle", false], ["labels", "rectangle", false]]) await t.test(role, () => {
      const rows = records.filter(([kind, s, name]) => kind === "node" && s === shape && Boolean(name) === named);
      assert.equal(scene[role].length, rows.length);
      rows.forEach(([, , name, x, y, neX, neY], i) => {
        const p = scene[role][i], label = name || p.text || role + i;
        // Reusing named anchors under the reflected scale incurs up to .07pt
        // of native fixed-point transform error; absolute placements do not.
        const tol = named ? .005 : .09;
        near(p.x, Number(x), tol, label + " x"); near(p.y, Number(y), tol, label + " y");
        const diameter = shape === "circle" ? 2 * Math.SQRT2 : 2;
        // Native compass anchors include half the 0.8pt stroke at each end.
        near(p.width ?? p.nodeLayoutWidth, diameter * (neX - x) - .8, .015, label + " width");
        near(p.height ?? p.nodeLayoutHeight, diameter * (neY - y) - .8, .015, label + " height");
      });
    });
    await t.test("arc directions and endpoints", () => {
      const rows = records.filter(([kind]) => kind === "edge");
      assert.equal(rows.length, 50);
      assert.deepEqual(scene.arcs.map(direction), rows.map(r => r[1]));
      rows.forEach(([, , ...ref], i) => {
        const coords = scene.arcs[i].commands.flatMap(p => [p.x, p.y]);
        assert.equal(coords.length, 4);
        coords.forEach((v, j) => near(v, Number(ref[j]), .10, `edge ${i + 1} coordinate ${j}`));
      });
    });
  });
