import assert from "node:assert/strict";
import test from "node:test";
import { renderLegendEntries } from "../src/pgfplots/legend.js";
import { tikzToSvg, tikzToSvgAsync } from "../src/index.js";

const pt = 72.27 / 2.54;
const geometry = { origin: { x: 0, y: 0 }, width: 4, height: 3 };
const coordinates = command => [...command.matchAll(/\((-?[\d.]+),\s*(-?[\d.]+)\)/g)]
  .map(match => ({ x: Number(match[1]) * pt, y: Number(match[2]) * pt }));
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.004,
  `${actual}pt should match the MacTeX box ${expected}pt`);
const render = (entries, extra = {}, plots = entries.map(() => ({ options: { "very thick": true } }))) =>
  renderLegendEntries({ "legend style": "at={(0,0)},anchor=north", ...extra }, {}, geometry, entries, plots);

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
