import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { auditTikzSource } from "../scripts/case-semantic-audit.js";
import { compareDecodedPngs, compareExamplePngs, encodePng, findBestPixelAlignment } from "../scripts/diff-example-pngs.js";
import { normalizeTikztosvgInput, renderExampleFixtures, writeExampleComparisonPage } from "../scripts/render-example-fixtures.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE = String.raw`\begin{tikzpicture}\draw (0,0)--(1,1);\end{tikzpicture}`;

function image(width = 20, height = 20) {
  return { width, height, data: Buffer.alloc(width * height * 4, 255) };
}

async function fixture(t, source = SOURCE) {
  const root = await mkdtemp(path.join(os.tmpdir(), "tikzkit-qa-gates-"));
  const fixtureRoot = path.join(root, "fixtures");
  const outputRoot = path.join(root, "output");
  await mkdir(fixtureRoot);
  await writeFile(path.join(fixtureRoot, "probe.tex"), source);
  return { root, fixtureRoot, outputRoot };
}

function fakeExternal(png = encodePng(image())) {
  return {
    async commandExists() { return true; },
    async runCommand(command, args) {
      if (command === "tikztosvg") await writeFile(args[args.indexOf("-o") + 1], "<svg></svg>");
      else if (command === "rsvg-convert") await writeFile(args[args.indexOf("-o") + 1], png);
      else if (command === "pdftocairo") await writeFile(`${args.at(-1)}.png`, png);
      return { exitCode: 0, stdout: "", stderr: "" };
    }
  };
}

test("Q1: legacy reviews cannot accept a newly introduced option", () => {
  const source = `${SOURCE}\n` + String.raw`\draw[new-unreviewed-option=123] (0,0)--(1,1);`;
  const review = {
    caseStatus: "accepted",
    localSources: ["tikz.code.tex", "latex.ltx"],
    localSourceNotes: { "tikz.code.tex": "Reviewed drawing", "latex.ltx": "Reviewed shell" },
    rules: [{ match: "*", status: "verified", evidence: ["test/qa-acceptance-gates.test.js"] }]
  };
  const report = auditTikzSource(source, { review, localSourceResolver: (lookup) => lookup });
  assert.equal(report.gate.accepted, false);
  assert.match(report.gate.todos.join("\n"), /binding|fingerprint/i);
  assert.equal(report.options.find((entry) => entry.key === "new-unreviewed-option").reviewStatus, "unbound");
});

test("Q1: bound approvals expire on source, implementation, or evidence changes", async (t) => {
  const { root } = await fixture(t);
  const implementationRoot = path.join(root, "implementation");
  await mkdir(implementationRoot);
  await writeFile(path.join(implementationRoot, "owner.js"), "export const value = 1;\n");
  const evidence = path.join(root, "evidence.txt");
  await writeFile(evidence, "independently checked\n");
  const review = {
    caseStatus: "accepted",
    localSources: ["tikz.code.tex", "latex.ltx"],
    localSourceNotes: { "tikz.code.tex": "Reviewed drawing", "latex.ltx": "Reviewed shell" },
    rules: [{ match: "*", status: "verified", evidence: [evidence] }]
  };
  const options = { review, implementationRoot, localSourceResolver: (lookup) => lookup };
  review.binding = auditTikzSource(SOURCE, options).binding;
  assert.ok(review.binding?.sourceSha256);
  assert.equal(auditTikzSource(SOURCE, options).gate.accepted, true);
  assert.equal(auditTikzSource(SOURCE.replace("(1,1)", "(2,1)"), options).gate.accepted, false);
  await writeFile(path.join(implementationRoot, "owner.js"), "export const value = 2;\n");
  assert.equal(auditTikzSource(SOURCE, options).gate.accepted, false);
  review.binding = auditTikzSource(SOURCE, options).binding;
  await writeFile(evidence, "changed evidence\n");
  assert.equal(auditTikzSource(SOURCE, options).gate.accepted, false);
});

test("Q2: strict CLI fails when requested reference tools are unavailable", async (t) => {
  const { root, fixtureRoot, outputRoot } = await fixture(t);
  const result = spawnSync(process.execPath, ["scripts/render-example-fixtures.js", "--fixtures", fixtureRoot, "--output", outputRoot, "--strict-tikztosvg", "--native-reference", "--quiet-progress"], {
    cwd: REPO_ROOT, encoding: "utf8", env: { ...process.env, PATH: path.join(root, "no-tools") }
  });
  assert.equal(result.status, 1, result.stdout + result.stderr);
});

test("Q2: command success without new artifacts cannot satisfy strict rendering", async (t) => {
  const options = await fixture(t);
  const summary = await renderExampleFixtures({
    ...options, comparisonGrid: false, strictTikztosvg: true, continueOnExternalFailure: true,
    external: { async commandExists() { return true; }, async runCommand() { return { exitCode: 0 }; } }
  });
  assert.equal(summary.gate?.accepted, false);
  assert.notEqual(summary.cases[0].tikztosvgStatus, "rendered");
});

test("Q3: strict diff rejects differences, missing references, and empty batches", async (t) => {
  const { outputRoot } = await fixture(t);
  await mkdir(outputRoot);
  const changed = image();
  changed.data.fill(0);
  await writeFile(path.join(outputRoot, "actual.png"), encodePng(image()));
  await writeFile(path.join(outputRoot, "expected.png"), encodePng(changed));
  for (const cases of [[{ id: "changed", tikzkitPngStatus: "rendered", tikztosvgPngStatus: "rendered", tikzkitPng: "actual.png", tikztosvgPng: "expected.png" }, { id: "missing" }], []]) {
    await writeFile(path.join(outputRoot, "summary.json"), JSON.stringify({ cases }));
    const result = spawnSync(process.execPath, ["scripts/diff-example-pngs.js", "--output", outputRoot, "--strict"], { cwd: REPO_ROOT, encoding: "utf8" });
    assert.equal(result.status, 1, result.stdout + result.stderr);
  }
});

test("Q4: rerendering invalidates old passing comparisons even when PNGs are skipped", async (t) => {
  const options = await fixture(t);
  await mkdir(path.join(options.outputRoot, "diff"), { recursive: true });
  await writeFile(path.join(options.outputRoot, "diff", "summary.json"), JSON.stringify({ cases: [{ id: "probe", status: "same", changedRatio: 0 }] }));
  await renderExampleFixtures({ ...options, skipPng: true, skipTikztosvg: true });
  assert.doesNotMatch(await readFile(path.join(options.outputRoot, "index.html"), "utf8"), /diff: same/);
});

test("Q4: source or image mutation expires a fingerprinted passing report", async (t) => {
  const options = await fixture(t);
  const render = await renderExampleFixtures({ ...options, comparisonGrid: false, external: fakeExternal() });
  assert.ok(render.cases[0].renderFingerprint);
  const diff = await compareExamplePngs({ outputRoot: options.outputRoot });
  assert.equal(diff.accepted, true);
  const strict = spawnSync(process.execPath, ["scripts/diff-example-pngs.js", "--output", options.outputRoot, "--strict"], { cwd: REPO_ROOT, encoding: "utf8" });
  assert.equal(strict.status, 0, strict.stdout + strict.stderr);
  await writeFile(path.join(options.fixtureRoot, "probe.tex"), SOURCE.replace("(1,1)", "(3,1)"));
  await writeExampleComparisonPage(options.outputRoot);
  assert.doesNotMatch(await readFile(path.join(options.outputRoot, "index.html"), "utf8"), /diff: same/);
  const stale = await compareExamplePngs({ outputRoot: options.outputRoot });
  assert.equal(stale.accepted, false);
  assert.equal(stale.cases[0].status, "stale");
  await writeFile(path.join(options.fixtureRoot, "probe.tex"), SOURCE);
  const changed = image();
  changed.data.set([0, 0, 0, 255], 0);
  await writeFile(path.join(options.outputRoot, render.cases[0].tikzkitPng), encodePng(changed));
  const tampered = await compareExamplePngs({ outputRoot: options.outputRoot });
  assert.equal(tampered.cases[0].status, "stale");
});

test("Q5: registration retains missing edge paint and compares the union canvas", () => {
  const actual = image();
  const expected = image();
  for (let y = 0; y < expected.height; y++) expected.data.set([0, 0, 0, 255], y * expected.width * 4);
  assert.equal(compareDecodedPngs(actual, expected).changedPixels, 20);
  const registered = findBestPixelAlignment(actual, expected, { radius: 3, sampleStep: 1 });
  assert.equal(registered.status, "different");
  assert.equal(registered.changedPixels, 20);
  assert.ok(registered.comparedPixels >= 400);
  const larger = image(21, 20);
  for (let y = 0; y < 20; y++) larger.data.set([0, 0, 0, 255], (y * 21 + 20) * 4);
  assert.equal(compareDecodedPngs(actual, larger).changedPixels, 20);
});

test("Q4: changing manifest-selected inputs invalidates an otherwise unchanged comparison", async (t) => {
  const options = await fixture(t);
  await renderExampleFixtures({ ...options, comparisonGrid: false, external: fakeExternal() });
  assert.equal((await compareExamplePngs({ outputRoot: options.outputRoot })).accepted, true);
  await writeFile(path.join(options.fixtureRoot, "manifest.json"), JSON.stringify({ cases: [{ id: "probe", source: "probe.tex", activeFigureId: "figure:1" }] }));
  const changed = await compareExamplePngs({ outputRoot: options.outputRoot });
  assert.equal(changed.accepted, false);
  assert.equal(changed.cases[0].status, "stale");
  assert.match(changed.cases[0].acceptanceBlockers.join("\n"), /manifest/i);
});

test("Q6: dependent raw-gnuplot references cannot claim independent acceptance", async (t) => {
  const source = String.raw`\begin{tikzpicture}\begin{axis}\addplot gnuplot[raw gnuplot] {set samples 3; set xrange [0:2]; plot x*x;};\end{axis}\end{tikzpicture}`;
  const options = await fixture(t, source);
  const render = await renderExampleFixtures({ ...options, comparisonGrid: false, nativeReference: true, external: fakeExternal() });
  assert.equal(render.cases[0].referenceProvenance?.independentNumerics, false);
  const diff = await compareExamplePngs({ outputRoot: options.outputRoot });
  assert.equal(diff.cases[0].status, "same");
  assert.equal(diff.accepted, false);
  assert.match(diff.cases[0].acceptanceBlockers.join("\n"), /dependent|sampling/i);
  const painting = await compareExamplePngs({ outputRoot: options.outputRoot, paintingOnly: true });
  assert.equal(painting.accepted, true);
  assert.match(painting.acceptanceScope, /painting-only/);
  assert.match(normalizeTikztosvgInput(source), /coordinates \{\(0,0\) \(1,1\) \(2,4\)\}/);
});

test("Q2/Q4: a preserved case whose source changed blocks strict batch acceptance", async (t) => {
  const options = await fixture(t);
  await renderExampleFixtures({ ...options, comparisonGrid: false, external: fakeExternal() });
  await writeFile(path.join(options.fixtureRoot, "probe.tex"), SOURCE.replace("(1,1)", "(2,1)"));
  await writeFile(path.join(options.fixtureRoot, "next.tex"), SOURCE);
  const summary = await renderExampleFixtures({
    ...options, only: ["next"], preserveOutput: true, comparisonGrid: false,
    strictTikztosvg: true, continueOnExternalFailure: true, external: fakeExternal()
  });
  assert.equal(summary.gate.accepted, false);
  assert.match(summary.gate.blockers.join("\n"), /probe.*[Ss]ource/);
});

test("Q2/Q6: a requested native mismatch blocks acceptance without --register", async (t) => {
  const options = await fixture(t);
  const external = fakeExternal();
  const run = external.runCommand;
  external.runCommand = async (command, args) => {
    if (command !== "pdftocairo") return run(command, args);
    const black = image();
    for (let index = 0; index < black.data.length; index += 4) black.data.set([0, 0, 0, 255], index);
    await writeFile(`${args.at(-1)}.png`, encodePng(black));
    return { exitCode: 0 };
  };
  await renderExampleFixtures({ ...options, comparisonGrid: false, nativeReference: true, external });
  const diff = await compareExamplePngs({ outputRoot: options.outputRoot });
  assert.equal(diff.cases[0].status, "same");
  assert.equal(diff.accepted, false);
  assert.match(diff.cases[0].acceptanceBlockers.join("\n"), /native/i);
});
