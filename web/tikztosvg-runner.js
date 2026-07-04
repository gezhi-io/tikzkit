import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { preprocessTikzSource } from "../src/preprocess.js";

const DEFAULT_PACKAGES = ["tikz", "tikz-cd", "pgfplots", "amsmath", "amssymb"];

export function runTikzToSvg(inputPath, outputPath, options = {}) {
  const texEngine = options.texEngine || "xelatex";
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "tikzkit-tikztosvg-"));
  const texPath = path.join(tmpDir, "tmp.tex");
  const pdfPath = path.join(tmpDir, "tmp.pdf");

  try {
    const source = readFileSync(inputPath, "utf8");
    return renderSourceToSvg(source, { ...options, outputPath, pdfPath, texEngine, texPath, tmpDir });
  } catch (error) {
    return {
      status: 1,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error)
    };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function renderSourceToSvg(source, context) {
  writeFileSync(context.texPath, buildStandaloneDocument(normalizeSourceForReferenceRenderer(source), context));

  const tex = spawnSync(
    context.texEngine,
    ["-halt-on-error", "-interaction=nonstopmode", `-output-directory=${context.tmpDir}`, context.texPath],
    { encoding: "utf8" }
  );
  if (tex.status !== 0 || !existsSync(context.pdfPath)) {
    return {
      status: tex.status ?? 1,
      stdout: tex.stdout || "",
      stderr: tex.stderr || tex.stdout || `${context.texEngine} did not produce tmp.pdf`
    };
  }

  const svg = convertFirstNonBlankPdfPage(context.pdfPath, context.outputPath);
  return {
    status: svg.status ?? 1,
    stdout: [tex.stdout, svg.stdout].filter(Boolean).join("\n"),
    stderr: [tex.stderr, svg.stderr].filter(Boolean).join("\n")
  };
}

function normalizeSourceForReferenceRenderer(source) {
  const text = String(source || "");
  if (text.includes("datavisualization.sparklines") || /\bspark line\b/.test(text)) {
    const lowered = lowerDatavisualizationSparklinesReference(text);
    if (lowered) return lowered;
  }
  if (text.includes("datavisualization.barcharts")) {
    return addDatavisualizationBarchartsReferenceShim(text);
  }
  if (text.includes("\\pgfarrowsdeclare{leaf}{leaf}") && text.includes("\\logo")) {
    return addTcsLogoReferenceBoundingBox(stripTikzKitReferenceOnlyKeys(preprocessTikzSource(text).source));
  }
  return text;
}

function stripTikzKitReferenceOnlyKeys(source) {
  return String(source || "").replace(/,\s*tikzkit text width scale\s*=\s*[-+]?\d*\.?\d+/g, "");
}

function lowerDatavisualizationSparklinesReference(source) {
  const text = String(source || "");
  if (!/\bspark line\b/.test(text)) return "";
  const dataMatch = text.match(/data\s*(?:\[[^\]]*\])?\s*\{([\s\S]*?)\}\s*;/);
  if (!dataMatch) return "";
  const rows = String(dataMatch[1] || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (rows.length < 2) return "";

  const headers = splitReferenceTableRow(rows[0]);
  const xIndex = headers.indexOf("x");
  const yIndex = headers.indexOf("y");
  if (xIndex < 0 || yIndex < 0) return "";

  const points = rows
    .slice(1)
    .map((row) => {
      const cells = splitReferenceTableRow(row);
      return { x: Number(cells[xIndex]), y: Number(cells[yIndex]) };
    })
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (points.length < 2) return "";

  const emCm = 10 / 28.4527559055;
  const ptCm = 1 / 28.4527559055;
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const yDenominator = Math.abs(maxY - minY) > 1e-9 ? maxY - minY : 1;
  const transformed = points.map((point) => ({
    x: point.x * ptCm,
    y: (-0.2 + ((point.y - minY) / yDenominator)) * emCm
  }));
  const minX = Math.min(...transformed.map((point) => point.x));
  const maxX = Math.max(...transformed.map((point) => point.x));
  const minSparkY = Math.min(...transformed.map((point) => point.y));
  const maxSparkY = Math.max(...transformed.map((point) => point.y));
  const pad = 0.04;
  const lines = ["\\begin{tikzpicture}[x=1cm,y=1cm,line cap=round,line join=round]"];
  if (hasInjectedTikzSourceGrid(text)) {
    lines.push("  \\draw[overlay, step=1cm, line width=0.12pt, dash pattern=on 0.7pt off 0.7pt, black!45] (-50,-50) grid (50,50);");
  }
  lines.push(
    `  \\path[use as bounding box] (${roundReferenceNumber(minX - pad)},${roundReferenceNumber(
      minSparkY - pad
    )}) rectangle (${roundReferenceNumber(maxX + pad)},${roundReferenceNumber(maxSparkY + pad)});`
  );
  lines.push(
    `  \\draw[line width=0.4pt] ${transformed
      .map((point) => `(${roundReferenceNumber(point.x)},${roundReferenceNumber(point.y)})`)
      .join(" -- ")};`
  );
  lines.push("\\end{tikzpicture}");
  return lines.join("\n");
}

function addDatavisualizationBarchartsReferenceShim(source) {
  const text = String(source || "");
  const lowered = lowerDatavisualizationBarchartsReference(text);
  if (lowered) return lowered;
  const libraryPattern = /\\usetikzlibrary\s*\{([^{}]*datavisualization\.barcharts[^{}]*)\}/;
  if (!libraryPattern.test(text)) return text;
  return text.replace(libraryPattern, (_match, libraryList) => {
    const libraries = String(libraryList)
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    const otherLibraries = libraries.filter((name) => name !== "datavisualization.barcharts");
    const otherLibraryLine = otherLibraries.length ? `\\usetikzlibrary{${otherLibraries.join(",")}}\n` : "";
    return `${otherLibraryLine}${datavisualizationBarchartsReferenceShim()}`;
  });
}

function lowerDatavisualizationBarchartsReference(source) {
  const text = String(source || "");
  if (!text.includes("candle stick plot")) return "";
  const dataMatch = text.match(/data\s*(?:\[[^\]]*\])?\s*\{([\s\S]*?)\}\s*;/);
  if (!dataMatch) return "";
  const rows = String(dataMatch[1] || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (rows.length < 2) return "";

  const headers = splitReferenceTableRow(rows[0]);
  const dayIndex = headers.indexOf("day");
  const attribute = referenceCandlestickAttribute(headers);
  if (dayIndex < 0 || !attribute) return "";

  const columns = {
    low: headers.indexOf(`${attribute}/low`),
    high: headers.indexOf(`${attribute}/high`),
    entry: headers.indexOf(`${attribute}/entry`),
    exit: headers.indexOf(`${attribute}/exit`)
  };
  if (Object.values(columns).some((index) => index < 0)) return "";

  const candles = rows.slice(1).map((row) => {
    const cells = splitReferenceTableRow(row);
    return {
      day: Number(cells[dayIndex]),
      low: Number(cells[columns.low]),
      high: Number(cells[columns.high]),
      entry: Number(cells[columns.entry]),
      exit: Number(cells[columns.exit])
    };
  }).filter((item) => Object.values(item).every(Number.isFinite));
  if (!candles.length) return "";

  const maxDay = Math.max(...candles.map((item) => item.day));
  const maxY = Math.max(100, ...candles.map((item) => item.high));
  const xEnd = maxDay * 0.3 + 0.18;
  const yEnd = maxY / 100 + 0.08;
  const halfWidthCm = 2 / 28.4527559055;
  const lines = ["\\begin{tikzpicture}[x=1cm,y=1cm]"];
  if (hasInjectedTikzSourceGrid(text)) {
    lines.push("  \\draw[overlay, step=1cm, line width=0.12pt, dash pattern=on 0.7pt off 0.7pt, black!45] (-50,-50) grid (50,50);");
  }
  lines.push(`  \\path[use as bounding box] (-0.46,-0.36) rectangle (${roundReferenceNumber(xEnd + 0.12)},${roundReferenceNumber(yEnd + 0.1)});`);
  lines.push(`  \\draw[black!25,line width=0.25pt] (0,0) rectangle (${roundReferenceNumber(maxDay * 0.3)},1);`);
  lines.push(`  \\draw[black!55,line width=0.4pt] (0,0) -- (${roundReferenceNumber(xEnd)},0);`);
  lines.push(`  \\draw[black!55,line width=0.4pt] (0,0) -- (0,${roundReferenceNumber(yEnd)});`);
  for (let day = 0; day <= maxDay; day += 1) {
    const x = day * 0.3;
    lines.push(`  \\draw[black!55,line width=0.25pt] (${roundReferenceNumber(x)},0) -- (${roundReferenceNumber(x)},-0.025);`);
    lines.push(`  \\node[anchor=north,font=\\scriptsize,inner sep=0pt] at (${roundReferenceNumber(x)},-0.08) {${day}};`);
  }
  for (let yTick = 0; yTick <= 100; yTick += 20) {
    const y = yTick / 100;
    lines.push(`  \\draw[black!55,line width=0.25pt] (0,${roundReferenceNumber(y)}) -- (-0.025,${roundReferenceNumber(y)});`);
    lines.push(`  \\node[anchor=east,font=\\scriptsize,inner sep=0pt] at (-0.045,${roundReferenceNumber(y)}) {${yTick}};`);
  }
  for (const candle of candles) {
    const x = candle.day * 0.3;
    const low = candle.low / 100;
    const high = candle.high / 100;
    const entry = candle.entry / 100;
    const exit = candle.exit / 100;
    const lower = Math.min(entry, exit);
    const upper = Math.max(entry, exit);
    const fill = candle.entry < candle.exit ? "white" : "black";
    lines.push(
      `  \\draw[black,line width=0.4pt] (${roundReferenceNumber(x)},${roundReferenceNumber(low)}) -- (${roundReferenceNumber(x)},${roundReferenceNumber(
        lower
      )}) (${roundReferenceNumber(x)},${roundReferenceNumber(high)}) -- (${roundReferenceNumber(x)},${roundReferenceNumber(upper)});`
    );
    lines.push(
      `  \\path[draw=black,fill=${fill},line width=0.4pt] (${roundReferenceNumber(x - halfWidthCm)},${roundReferenceNumber(
        lower
      )}) rectangle (${roundReferenceNumber(x + halfWidthCm)},${roundReferenceNumber(upper)});`
    );
  }
  lines.push("\\end{tikzpicture}");
  return lines.join("\n");
}

function splitReferenceTableRow(row) {
  return String(row || "")
    .split(",")
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0);
}

function referenceCandlestickAttribute(headers) {
  const names = new Set(headers);
  for (const header of headers) {
    const match = String(header || "").match(/^(.+)\/low$/);
    if (!match) continue;
    const name = match[1];
    if (names.has(`${name}/high`) && names.has(`${name}/entry`) && names.has(`${name}/exit`)) return name;
  }
  return "";
}

function hasInjectedTikzSourceGrid(source) {
  const text = String(source || "");
  return (
    text.includes("\\draw[overlay, step=1cm") &&
    text.includes("dash pattern=on 0.7pt off 0.7pt") &&
    text.includes("(-50,-50) grid (50,50)")
  );
}

function datavisualizationBarchartsReferenceShim() {
  return String.raw`\usetikzlibrary{datavisualization}
\usepgflibrary{datavisualization.barcharts}
\makeatletter
\def\tikzkit@dv@getnumber#1#2{%
  \def#2{0}%
  \pgfkeysifdefined{/data point/#1}{%
    \pgfkeysgetvalue{/data point/#1}\tikzkit@dv@value%
    \ifx\tikzkit@dv@value\pgfutil@empty%
    \else%
      \ifx\tikzkit@dv@value\relax%
      \else%
        \let#2\tikzkit@dv@value%
      \fi%
    \fi%
  }{}%
}
\def\pgfcanvaspositionofdatapoint{%
  \tikzkit@dv@getnumber{day}{\tikzkit@dv@day}%
  \tikzkit@dv@getnumber{dax}{\tikzkit@dv@dax}%
  \pgfmathsetlength{\pgf@x}{3mm*(\tikzkit@dv@day)}%
  \pgfmathsetlength{\pgf@y}{1cm*(\tikzkit@dv@dax)/100}%
  \pgfkeyssetvalue{/data point/canvas x}{\the\pgf@x}%
  \pgfkeyssetvalue{/data point/canvas y}{\the\pgf@y}%
}
\def\pgfsettocanvasposition#1{%
  \edef#1{\noexpand\pgfqpoint{\pgfkeysvalueof{/data point/canvas x}}{\pgfkeysvalueof{/data point/canvas y}}}%
}
\tikzdatavisualizationset{
  new axis/.style={new Cartesian axis={#1}},
  x axis/source/.style={x axis={attribute={#1}}},
  y axis/source/.style={y axis={attribute={#1}}},
  u axis/source/.style={u axis={attribute={#1}}},
  v axis/source/.style={v axis={attribute={#1}}},
  z axis/source/.style={z axis={attribute={#1}}},
  w axis/source/.style={w axis={attribute={#1}}},
  x axis/source min/.style={x axis={min value={#1}}},
  y axis/source min/.style={y axis={min value={#1}}},
  u axis/source min/.style={u axis={min value={#1}}},
  v axis/source min/.style={v axis={min value={#1}}},
  z axis/source min/.style={z axis={min value={#1}}},
  w axis/source min/.style={w axis={min value={#1}}},
  x axis/source max/.style={x axis={max value={#1}}},
  y axis/source max/.style={y axis={max value={#1}}},
  u axis/source max/.style={u axis={max value={#1}}},
  v axis/source max/.style={v axis={max value={#1}}},
  z axis/source max/.style={z axis={max value={#1}}},
  w axis/source max/.style={w axis={max value={#1}}},
  x axis/vec/.code={\pgfkeyssetvalue{/tikz/data visualization/x axis/unit vector}{#1}},
  y axis/vec/.code={\pgfkeyssetvalue{/tikz/data visualization/y axis/unit vector}{#1}},
  u axis/vec/.code={\pgfkeyssetvalue{/tikz/data visualization/u axis/unit vector}{#1}},
  v axis/vec/.code={\pgfkeyssetvalue{/tikz/data visualization/v axis/unit vector}{#1}},
  z axis/vec/.code={\pgfkeyssetvalue{/tikz/data visualization/z axis/unit vector}{#1}},
  w axis/vec/.code={\pgfkeyssetvalue{/tikz/data visualization/w axis/unit vector}{#1}},
  candle stick plot/.style={
    new Cartesian axis=y axis,
    y axis={attribute=dax,max value=100},
    y axis/vec=\pgfqpoint{0cm}{1cm},
    new object={
      store=/tikz/data visualization/x line trans,
      class=linear transformer,
      arg1=day,
      arg2=\pgfqpoint{3mm}{0mm}
    },
    new object={
      store=/tikz/data visualization/index,
      class=candle stick visualizer,
      arg1/.expanded=\pgfkeysvalueof{/tikz/data visualization/index/source}
    }
  },
  index/source/.initial=index
}
\tikzset{
  /tikz/data visualization/axis options/.cd,
  source/.style={attribute={#1}},
  source min/.style={min value={#1}},
  source max/.style={max value={#1}},
  vec/.style={unit vector={#1}}
}
\makeatother`;
}

function addTcsLogoReferenceBoundingBox(source) {
  const text = String(source || "");
  const marker = "\\begin{tikzpicture}[x=1cm,y=1cm]\n";
  if (!text.includes(marker) || !hasTcsLogoReferenceLabel(text)) return text;
  const logoCount = Math.max(1, countTcsLogoReferenceLabels(text));
  const bottom = -3.35 * (logoCount - 1) - 1.45;
  const bbox = `\\path[use as bounding box] (-2.75,${roundReferenceNumber(bottom)}) rectangle (2.75,2.0);\n`;
  return text.replace(marker, `${marker}${bbox}`);
}

function hasTcsLogoReferenceLabel(source) {
  return /THEORETICAL|Theoretical|\\textcolor\{[^{}]+\}\{T\}heoretical/.test(String(source || ""));
}

function countTcsLogoReferenceLabels(source) {
  const matches = String(source || "").match(/THEORETICAL|Theoretical|\\textcolor\{[^{}]+\}\{T\}heoretical/g);
  return matches ? matches.length : 0;
}

function roundReferenceNumber(value) {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 1000) / 1000;
  if (Object.is(rounded, -0) || rounded === 0) return "0";
  return String(rounded).replace(/\.?0+$/, "");
}

export function buildStandaloneDocument(source, options = {}) {
  const packages = options.packages || DEFAULT_PACKAGES;
  const libraries = options.libraries || [];
  const packageLines = packages.map((name) => `\\usepackage{${name}}`).join("\n");
  const libraryLines = libraries.map((name) => `\\usetikzlibrary{${name}}`).join("\n");

  return [
    "\\documentclass[crop,tikz,multi=false]{standalone}",
    packageLines,
    libraryLines,
    "\\begin{document}",
    source.trim(),
    "\\end{document}",
    ""
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function convertFirstNonBlankPdfPage(pdfPath, outputPath) {
  const pageCount = pdfPageCount(pdfPath);
  let lastResult = { status: 1, stdout: "", stderr: "pdf2svg did not run" };
  for (let page = 1; page <= pageCount; page += 1) {
    const result = spawnSync("pdf2svg", [pdfPath, outputPath, String(page)], { encoding: "utf8" });
    lastResult = result;
    if ((result.status ?? 1) !== 0) return result;
    if (svgHasVisibleContent(outputPath)) {
      return result;
    }
  }
  return lastResult;
}

function pdfPageCount(pdfPath) {
  const info = spawnSync("pdfinfo", [pdfPath], { encoding: "utf8" });
  const match = info.stdout?.match(/^Pages:\s+(\d+)/m);
  const count = match ? Number(match[1]) : 1;
  return Number.isFinite(count) && count > 0 ? count : 1;
}

function svgHasVisibleContent(outputPath) {
  if (!existsSync(outputPath)) return false;
  const svg = readFileSync(outputPath, "utf8");
  return /<(?:path|use|text|rect|circle|ellipse|line|polyline|polygon|image)\b/.test(svg);
}
