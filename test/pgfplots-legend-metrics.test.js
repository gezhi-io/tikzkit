import assert from "node:assert/strict";
import test from "node:test";
import { renderLegendEntries } from "../src/pgfplots/legend.js";
import { layoutNativeText } from "../src/tex/textBox.js";
import { createAxisGeometry } from "../src/pgfplots/geometry.js";
import { tikzToSvg, tikzToSvgAsync } from "../src/index.js";

const pt = 72.27 / 2.54;
const geometry = { origin: { x: 0, y: 0 }, width: 4, height: 3 };
const coordinates = command => [...command.matchAll(/\((-?[\d.]+),\s*(-?[\d.]+)\)/g)]
  .map(match => ({ x: Number(match[1]) * pt, y: Number(match[2]) * pt }));
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.004,
  `${actual}pt should match the MacTeX box ${expected}pt`);
const render = (entries, extra = {}, plots = entries.map(() => ({ options: { "very thick": true } }))) =>
  renderLegendEntries({ "legend style": "at={(0,0)},anchor=north", ...extra }, {}, geometry, entries, plots);

// Native anchor and hbox measurements: test/fixtures/pgfplots-text-legend-metrics.tex.
for (const sample of [
  { title: "student counts", entries: ["Eingeschriebene Studenten", "davon Frauen", "davon Ausl\u00e4nder"],
    style: "legend columns=-1,draw=none", size: 10, anchor: "center", frame: 321.53256,
    lines: [[-157.36629, -8.42218], [-18.3276, -8.42218], [62.87767, -8.42218]],
    labels: [[-137.89447, -11.14442], [1.14421, -11.14442], [82.34949, -11.14442]] },
  { title: "small type with a partially filled last row", entries: ["Menge", "Werte", "Gesamtmenge"],
    style: "legend columns=2,column sep=4pt,row sep=2pt,font=\\small", size: 9, anchor: "west", frame: 142.31868,
    lines: [[-67.75935, -8.02495], [18.50858, -8.02495], [-67.75935, -21.67485]],
    labels: [[-44.28754, -10.34996], [41.9804, -10.34996], [-44.28754, -23.99986]] }
]) {
  test(`PGFPlots multi-column text legend matches MacTeX: ${sample.title}`, () => {
    const commands = render(sample.entries, { "legend style": "at={(0,0)},anchor=north," + sample.style,
      "legend cell align": sample.anchor === "west" ? "left" : "center" },
      sample.entries.map(() => ({ options: { thick: true, mark: "none" } })));
    const frame = coordinates(commands[0]);
    close(frame[1].x - frame[0].x, sample.frame);
    const lines = commands.filter(c => c.includes("axis legend image")).map(coordinates);
    const labels = commands.filter(c => c.includes("\\node[axis legend")).map(coordinates);
    for (const [i, entry] of sample.entries.entries()) {
      close(lines[i][0].x, sample.lines[i][0]);
      close(lines[i][0].y, sample.lines[i][1]);
      close(lines[i][1].x - lines[i][0].x, 0.6 * pt);
      const box = layoutNativeText(entry, { sizePt: sample.size });
      close(labels[i][0].x - (sample.anchor === "center" ? box.width / 2 : 0), sample.labels[i][0]);
      close(labels[i][0].y - (box.height - box.depth) / 2, sample.labels[i][1]);
    }
  });
}

test("upright CM diaereses use the accent and base glyphs at the MacTeX advance", () => {
  for (const [text, base, width, height, dx, dy] of [
    ["\u00e4", "a", 5.00002, 6.67859, 0, 0],
    ["\u00f6", "o", 5.00002, 6.67859, 0, 0],
    ["\u00fc", "u", 5.55557, 6.67859, 0.27778, 0],
    ["\u00c4", "A", 7.50002, 9.20636, 1.25, -2.52777],
    ["\u00d6", "O", 7.7778, 9.20636, 1.38889, -2.52777],
    ["\u00dc", "U", 7.50002, 9.20636, 1.25, -2.52777]
  ]) {
    const box = layoutNativeText(text);
    assert.ok(box);
    close(box.width, width);
    close(box.height, height);
    close(box.depth, 0);
    assert.deepEqual(box.items.map(i => i.text), ["\u00a8", base]);
    close(box.items[0].x, dx);
    close(box.items[0].y, dy);
    close(box.items[1].x, 0);
  }
  close(layoutNativeText("davon Ausl\u00e4nder").width, 73.41682);
  assert.equal(layoutNativeText("\u00e4", { style: "italic" }), null);
  assert.equal(layoutNativeText("\u2603"), null);
});

test("axis description positions honor either spelling of the y tick label style", () => {
  const ranges = { xMin: 1986, xMax: 2014, yMin: 0, yMax: 26000, zMin: 0, zMax: 1 };
  for (const key of ["yticklabel style", "y tick label style", "ticklabel style"]) {
    const geometry = createAxisGeometry({ width: "15cm", height: "8cm", "axis lines": "middle",
      "enlarge y limits": true, [key]: "{scaled ticks=false}" }, ranges);
    close(geometry.mapAxisDescriptionPoint({ x: 0.5, y: 1 }).x * pt, (15 * pt - 45) / 2);
  }
});

test("a composed text label keeps its complete accessible name as well as both painted glyphs", async () => {
  const source = "\\begin{tikzpicture}\\node {Harte Abh\u00e4ngigkeit};\\end{tikzpicture}";
  for (const { svg, diagnostics } of [tikzToSvg(source), await tikzToSvgAsync(source)]) {
    assert.deepEqual(diagnostics, []);
    assert.match(svg, /role="img" aria-label="Harte Abh\u00e4ngigkeit"/);
    assert.match(svg, />\u00a8<\/text><text\b[^>]+>a<\/text>/);
  }
});

test("legend cells use TeX text depth, node padding, and the stroked sample bbox", () => {
  const commands = render([String.raw`$\cos x$`, "$x$"]);
  const frame = coordinates(commands[0]);
  // Measured with every axis legend in PGFPlots, not from a TikZKit export.
  close(frame[1].x - frame[0].x, 49.04256);
  close(frame[0].y - frame[2].y, 23.61096);
  close(frame[0].y, -0.2); // The matrix anchor includes half its border stroke.
  const samples = commands.filter(c => c.includes("axis legend image")).map(coordinates);
  const labels = commands.filter(c => c.includes("\\node[axis legend")).map(coordinates);
  close(samples[0][0].x, -20.9213);
  close(samples[0][0].y, -7.10274);
  close(samples[1][0].y, -16.90822);
  close(labels[0][0].y - samples[0][0].y, 0.75);
});

test("legend fraction depth moves the glyph box, not the matrix row or line sample", () => {
  const commands = render([String.raw`$\varphi_1(x)=\frac{1}{1+e^{-x}}$`, String.raw`$\varphi_2(x)=\tanh(x)$`]);
  const samples = commands.filter(c => c.includes("axis legend image")).map(coordinates);
  const labels = commands.filter(c => c.includes("\\node[axis legend")).map(coordinates);
  close(samples[0][0].y - samples[1][0].y, 13.474216);
  close(labels[0][0].y - samples[0][0].y, (1.5 - 4.281754) / 2);
  close(labels[1][0].y - samples[1][0].y, -0.5);
});

test("legend sample stroke changes cell width but does not change text padding", () => {
  const entries = [String.raw`$\cos x$`];
  const thin = render(entries, {}, [{ options: { "line width": "0.4pt" } }]);
  const thick = render(entries, {}, [{ options: { "line width": "2pt" } }]);
  const width = cmds => { const c = coordinates(cmds[0]); return c[1].x - c[0].x; };
  close(width(thick) - width(thin), 1.6);
});

test("tiny matrix legends retain the surrounding font for the forced 0.15em depth", () => {
  const entries = ["0", "12", "-42", "50"].map(n => `$\\begin{pmatrix}0\\\\${n}\\end{pmatrix}+U$`);
  const commands = renderLegendEntries({ "legend style": "at={(0,0)},anchor=north west,font=\\tiny",
    "legend cell align": "left" }, {}, geometry, entries,
    entries.map(() => ({ options: { thick: true } })), { mathExtension: "ams" });
  const frame = coordinates(commands[0]);
  close(frame[1].x - frame[0].x, 62.23669);
  close(frame[0].y - frame[2].y, 54.99987);
  const samples = commands.filter(c => c.includes("axis legend image")).map(coordinates);
  close(samples[0][0].y - samples[1][0].y, 12.74997);
});

test("default legend placement differs from the explicit north east preset", () => {
  const entries = ["$x$"];
  const defaults = renderLegendEntries({}, {}, geometry, entries);
  const preset = renderLegendEntries({ "legend pos": "north east" }, {}, geometry, entries);
  close(coordinates(defaults[0])[1].x - coordinates(preset[0])[1].x, 0.01 * geometry.width * pt);
});

test("simple math legends use the same CM glyph boxes in sync and async browser SVG", async () => {
  const source = String.raw`\usepackage{pgfplots}
\begin{tikzpicture}\begin{axis}[ticks=none,legend style={at={(0,0)},anchor=north}]
\addplot[blue] coordinates {(0,0)(1,1)};\addlegendentry{$\cos x$}
\end{axis}\end{tikzpicture}`;
  for (const result of [tikzToSvg(source), await tikzToSvgAsync(source)]) {
    assert.deepEqual(result.diagnostics, []);
    assert.ok(result.svg.includes('data-math-layout="cm-tex-box"'));
    assert.ok(!result.svg.includes("foreignObject"), "A supported CM legend must not switch to browser HTML math");
  }
});
