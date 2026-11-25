import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { tikzToSvg } from "../../src/index.js";

// The golden file is literal pdflatex output, not a model of the plot handler.
// Coordinates are integer TeX sp. BOX (min x/y, max x/y) and SIZE are in TeX pt.
function readOracle(source, trace) {
  const pictures = new Map(Array.from(source.matchAll(
    /^\\Case\{([\w-]+)\}\{\s*(\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\})\s*\}/gm
  ), ([, id, picture]) => [id, picture]));
  const [units, ...blocks] = trace.trimEnd().split(/^CASE /m);
  const [, spPerPt] = /^SP-PER-PT-CM (\d+) (\d+)$/.exec(units.trim());
  const oracle = new Map(blocks.map(block => {
    const [id, ...lines] = block.trimEnd().split(/\r?\n/);
    const paths = [];
    let boxPt, sizePt;
    for (const line of lines) {
      const [op, ...args] = line.split(" ");
      const numbers = args.map(Number);
      if (op === "PATH") paths.push([]);
      else if (op === "BOX") boxPt = args[0] === "empty" ? null : numbers;
      else if (op === "SIZE") sizePt = numbers;
      else {
        assert.equal(numbers.length, { M: 2, L: 2, C: 6, Z: 0 }[op], line);
        assert.ok(numbers.every(Number.isSafeInteger), line);
        paths.at(-1).push([op, ...numbers]);
      }
    }
    assert.ok(paths.length && (boxPt === null || boxPt?.length === 4) && sizePt?.length === 2, id);
    return [id, { paths, boxPt, sizePt }];
  }));
  assert.equal(pictures.size, source.match(/^\\Case\{/gm).length, "duplicate or unreadable TikZ case");
  assert.equal(oracle.size, blocks.length, "duplicate case in native trace");
  assert.deepEqual([...pictures.keys()], [...oracle.keys()], "TikZ pictures and native trace disagree");
  return { pictures, oracle, spPerPhysicalCm: Number(spPerPt) * ptPerCm };
}

const ptPerCm = 72.27 / 2.54;
const svgUnitsPerCm = 100;

function pathToken(c, spPerPhysicalCm) {
  const sp = v => v * spPerPhysicalCm;
  switch (c.type) {
    case "moveTo": return ["M", sp(c.x), sp(c.y)];
    case "lineTo": return ["L", sp(c.x), sp(c.y)];
    case "curveTo": return ["C", ...[c.x1, c.y1, c.x2, c.y2, c.x, c.y].map(sp)];
    case "closePath": return ["Z"];
    default: assert.fail("unexpected path command: " + c.type);
  }
}

function near(actual, expected, tolerance, label) {
  assert.equal(actual.length, expected.length, label);
  actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) <= tolerance,
    `${label} [${i}]: got ${value}, native ${expected[i]} (tolerance ${tolerance})`));
}

function assertBox(svg, { boxPt, sizePt }, id) {
  // Empty scenes have an application-level fallback viewport; the empty softpath
  // still matters. A move-only scene, in contrast, has a measurable native box.
  if (!boxPt) return;
  const root = svg.match(/<svg\b[^>]*>/)[0];
  const [x, y, w, h] = root.match(/\bviewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  near([x, -y - h, x + w, -y].map(v => v * ptPerCm / svgUnitsPerCm),
    boxPt, .002, id + " viewBox in TeX pt");
  const physicalPt = ["width", "height"].map(key => {
    const value = root.match(new RegExp(`\\b${key}="([.\\d]+)pt"`));
    assert.ok(value, id + ": missing physical " + key);
    return Number(value[1]) * 72.27 / 72; // SVG/CSS pt are big points.
  });
  near(physicalPt, sizePt, .002, id + " typeset width/height in TeX pt");
}

export function nativePlotSuite(family, fixtureUrl, files = []) {
  const dir = fileURLToPath(fixtureUrl);
  const source = readFileSync(join(dir, "cases.tex"), "utf8");
  const trace = readFileSync(join(dir, "texlive-2025.trace"), "utf8");
  const dataFiles = Object.fromEntries(files.map(file => [file, readFileSync(join(dir, file), "utf8")]));
  const { pictures, oracle, spPerPhysicalCm } = readOracle(source, trace);
  for (const [id, picture] of pictures) {
    test("native " + family + " plot: " + id, () => {
      const { diagnostics, ir, svg } = tikzToSvg(picture, { unit: svgUnitsPerCm, margin: 0, dataFiles });
      assert.deepEqual(diagnostics, [], id);
      const actual = ir.items.filter(item => item.type === "path" && item.commands.length)
        .map(item => item.commands.map(c => pathToken(c, spPerPhysicalCm)));
      const expected = oracle.get(id);
      const paths = expected.paths.filter(path => path.length);
      assert.equal(actual.length, paths.length, id + ": number of nonempty paths");
      paths.forEach((path, i) => {
        const label = `${id} path ${i + 1}`;
        assert.deepEqual(actual[i].map(t => t[0]), path.map(t => t[0]), label + " commands");
        path.forEach(([op, ...coords], j) => {
          // Four sp allow for the scanned 1cm basis versus physical cm (up to 3cm
          // in these pictures). This still distinguishes the legacy 0.445 shortcut.
          near(actual[i][j].slice(1), coords, 4, `${label} command ${j + 1} ${op} in sp`);
        });
      });
      assertBox(svg, expected, id);
    });
  }

  test("local pdflatex reproduces the " + family + " plot oracle", {
    skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1" && "set TIKZKIT_TEST_PDFLATEX=1 to replay"
  }, () => {
    const out = mkdtempSync(join(tmpdir(), "tikz-" + family + "-plots-"));
    try {
      execFileSync("pdflatex", ["-no-shell-escape", "-interaction=nonstopmode", "-halt-on-error",
        "-output-directory=" + out, "oracle.tex"], { cwd: dir, timeout: 30000 });
      const measured = readFileSync(join(out, "oracle.trace"), "utf8");
      assert.equal(measured.replaceAll("\r\n", "\n"), trace.replaceAll("\r\n", "\n"));
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
}
