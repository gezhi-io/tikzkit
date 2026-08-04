#!/usr/bin/env node
import { access, chmod, copyFile, mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createExternalLatexAdapter } from "../src/adapters/externalLatex.js";
import { tikzToSvgAsync } from "../src/index.js";
import { lowerRawGnuplotAddplotsToCoordinates } from "../src/pgfplots/gnuplot.js";
import { withGalleryDebugGrid } from "./gallery-debug-grid.js";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const DEFAULT_FIXTURE_ROOT = path.resolve("test", "fixtures", "examples");
const DEFAULT_OUTPUT_ROOT = path.join(DEFAULT_FIXTURE_ROOT, "output");
const TEXLIVE_OPENTYPE_FONT_DIRS = [
  "/usr/local/texlive/2025/texmf-dist/fonts/opentype/public/cm-unicode",
  "/usr/local/texlive/2025/texmf-dist/fonts/opentype/public/lm",
  "/usr/local/texlive/2025/texmf-dist/fonts/opentype/public/lm-math"
];
const MANAGED_TIKZKIT_FONT_FILES = [
  "TikZKitCMUSans-Bold.otf",
  "TikZKitCMUSans-BoldItalic.otf",
  "TikZKitCMUSans-Italic.otf",
  "TikZKitCMUSans-Regular.otf",
  "TikZKitCMUSerif-Bold.otf",
  "TikZKitCMUSerif-BoldItalic.otf",
  "TikZKitCMUSerif-Italic.otf",
  "TikZKitCMUSerif-Roman.otf",
  "TikZKitCMR5-Regular.otf",
  "TikZKitCMR6-Regular.otf",
  "TikZKitCMR7-Regular.otf",
  "TikZKitCMR8-Regular.otf",
  "TikZKitCMR9-Regular.otf",
  "TikZKitCMR10-Regular.otf",
  "TikZKitCMR12-Regular.otf",
  "TikZKitCMR17-Regular.otf",
  "TikZKitCMBX5-Bold.otf",
  "TikZKitCMBX6-Bold.otf",
  "TikZKitCMBX7-Bold.otf",
  "TikZKitCMBX8-Bold.otf",
  "TikZKitCMBX9-Bold.otf",
  "TikZKitCMBX10-Bold.otf",
  "TikZKitCMBX12-Bold.otf",
  "TikZKitMath_Main-Bold.ttf",
  "TikZKitMath_Main-Regular.ttf",
  "TikZKitMath_Caligraphic-Bold.ttf",
  "TikZKitMath_Caligraphic-Regular.ttf",
  "TikZKitMath_Math-BoldItalic.ttf",
  "TikZKitMath_Math-Italic.ttf"
];
const TEX_PT_PER_CM = 28.4527559;

export async function renderExampleFixtures(options = {}) {
  const fixtureRoot = path.resolve(options.fixtureRoot || DEFAULT_FIXTURE_ROOT);
  const outputRoot = path.resolve(options.outputRoot || DEFAULT_OUTPUT_ROOT);
  const external = createExternalLatexAdapter(options.external);
  const manifest = await loadExampleManifest(fixtureRoot);
  const allCases = await discoverExampleCases(fixtureRoot, manifest.cases || []);
  const selected = limitCases(selectCases(allCases, options.only), options.limit);
  const tikztosvgAvailable = options.skipTikztosvg ? false : await external.commandExists("tikztosvg");
  const svgToPngAvailable = options.skipPng ? false : await external.commandExists("rsvg-convert");
  const tikztosvgEnv = tikztosvgAvailable
    ? await createTikztosvgCompatibilityEnv(outputRoot, options.env || process.env, fixtureRoot)
    : null;
  const rsvgEnv = svgToPngAvailable ? await createRsvgFontEnv(outputRoot, options.env || process.env) : null;
  const tikztosvgEngine = options.tikztosvgEngine || "xelatex";
  const externalCommandTimeoutMs = normalizedTimeoutMs(options.externalCommandTimeoutMs);
  const renderOptions = {
    margin: 0,
    mathRenderer: "svg-text",
    fontUrlPrefix: "../fonts/",
    ...definedRenderOptions(options.renderOptions)
  };
  const comparisonGridMode = normalizedComparisonGridMode(options);
  const sourceComparisonGrid = comparisonGridMode === "source";
  const svgComparisonGrid = comparisonGridMode === "svg";
  const previousSummary = options.preserveOutput
    ? await readOptionalJson(path.join(outputRoot, "summary.json"))
    : null;

  if (!options.preserveOutput) await clearManagedOutputArtifacts(outputRoot);
  await copyManagedFontAssets(outputRoot);
  await mkdir(path.join(outputRoot, "tikzkit-svg"), { recursive: true });
  if (svgToPngAvailable) await mkdir(path.join(outputRoot, "tikzkit-png"), { recursive: true });
  if (svgComparisonGrid) {
    await mkdir(path.join(outputRoot, "tikzkit-grid-svg"), { recursive: true });
    if (svgToPngAvailable) await mkdir(path.join(outputRoot, "tikzkit-grid-png"), { recursive: true });
  }
  if (tikztosvgAvailable) {
    await mkdir(path.join(outputRoot, "tikztosvg-svg"), { recursive: true });
    await mkdir(path.join(outputRoot, "tikztosvg-input"), { recursive: true });
    await mkdir(path.join(outputRoot, "tikztosvg-log"), { recursive: true });
    if (svgToPngAvailable) await mkdir(path.join(outputRoot, "tikztosvg-png"), { recursive: true });
    if (svgComparisonGrid) {
      await mkdir(path.join(outputRoot, "tikztosvg-grid-svg"), { recursive: true });
      if (svgToPngAvailable) await mkdir(path.join(outputRoot, "tikztosvg-grid-png"), { recursive: true });
    }
  }

  const cases = [];
  for (const entry of selected) {
    const sourcePath = path.join(fixtureRoot, entry.source);
    const source = await readExampleSource(sourcePath, fixtureRoot);
    const renderSource = sourceComparisonGrid ? withGalleryDebugGrid(source) : source;
    const resourceMap = await loadExampleResourceMap(entry, fixtureRoot);
    const imageResourceMap = await loadExampleImageResourceMap(entry, fixtureRoot);
    const entryRenderOptions = {
      ...renderOptions,
      ...(resourceMap.size
        ? { pgfplotsTableResolver: (file) => resourceMap.get(normalizeResourceName(file)) }
        : {}),
      ...(imageResourceMap.size
        ? { imageResolver: (file) => imageResourceMap.get(normalizeResourceName(file)) }
        : {})
    };
    const activeFigureId = entry.activeFigureId || null;
    const tikzkitSvg = path.join(outputRoot, "tikzkit-svg", `${entry.id}.svg`);
    const tikzkit = await tikzToSvgAsync(
      renderSource,
      activeFigureId ? { ...entryRenderOptions, activeFigureId } : entryRenderOptions
    );
    await writeFile(tikzkitSvg, tikzkit.svg, "utf8");
    let tikzkitGridSvg = null;
    let tikzkitGridPng = null;
    let tikzkitGridPngStatus = "skipped";
    if (svgComparisonGrid) {
      tikzkitGridSvg = path.join(outputRoot, "tikzkit-grid-svg", `${entry.id}.svg`);
      await writeFile(tikzkitGridSvg, addComparisonGridToSvg(tikzkit.svg), "utf8");
      if (svgToPngAvailable) {
        tikzkitGridPng = path.join(outputRoot, "tikzkit-grid-png", `${entry.id}.png`);
        tikzkitGridPngStatus = await convertSvgToPng(external, tikzkitGridSvg, tikzkitGridPng, rsvgEnv, {
          timeoutMs: externalCommandTimeoutMs
        });
      }
    }
    const tikzkitPng = svgToPngAvailable ? path.join(outputRoot, "tikzkit-png", `${entry.id}.png`) : null;
    const tikzkitPngStatus = tikzkitPng
      ? await convertSvgToPng(external, tikzkitSvg, tikzkitPng, rsvgEnv, { timeoutMs: externalCommandTimeoutMs })
      : "skipped";

    let tikztosvgSvg = null;
    let tikztosvgInput = null;
    let tikztosvgPng = null;
    let tikztosvgGridSvg = null;
    let tikztosvgGridPng = null;
    let tikztosvgLog = null;
    let tikztosvgPngStatus = "skipped";
    let tikztosvgGridPngStatus = "skipped";
    let tikztosvgStatus = "skipped";
    let referenceKind = "tikztosvg";
    if (tikztosvgAvailable) {
      tikztosvgSvg = path.join(outputRoot, "tikztosvg-svg", `${entry.id}.svg`);
      tikztosvgInput = await writeTikztosvgInput(
        outputRoot,
        entry,
        rewriteExampleResourceReferences(renderSource, entry.resources || []),
        { activeFigureId }
      );
      const tikztosvgArgs = [
        ...tikztosvgEngineArgs(tikztosvgEngine, source),
        ...tikztosvgPackageArgs(source),
        ...tikztosvgLibraryArgs(source),
        "-q",
        "-o",
        tikztosvgSvg,
        tikztosvgInput
      ];
      const result = await external.runCommand("tikztosvg", tikztosvgArgs, {
        cwd: fixtureRoot,
        env: tikztosvgEnv,
        timeoutMs: externalCommandTimeoutMs
      });
      tikztosvgStatus = result.exitCode === 0 ? "rendered" : "failed";
      if (result.exitCode !== 0) {
        const diagnosticResult = shouldRetryTikztosvgWithoutQuiet(result)
          ? await external.runCommand("tikztosvg", tikztosvgArgs.filter((arg) => arg !== "-q"), {
              cwd: fixtureRoot,
              env: tikztosvgEnv,
              timeoutMs: externalCommandTimeoutMs
            })
          : null;
        tikztosvgLog = await writeTikztosvgLog(outputRoot, entry, diagnosticResult || result, result);
        if (shouldUseNativeLatexReference(source)) {
          const fallback = await renderNativeLatexReference(external, {
            entry,
            source,
            outputRoot,
            svgPath: tikztosvgSvg,
            env: options.env || process.env,
            timeoutMs: externalCommandTimeoutMs
          });
          if (fallback.rendered) {
            tikztosvgStatus = "rendered";
            referenceKind = "native-latex";
          }
        }
      } else {
        await removeTikztosvgLog(outputRoot, entry);
      }
      if (result.exitCode !== 0 && options.strictTikztosvg) {
        throw new Error(`tikztosvg failed for ${entry.id}: ${result.stderr || result.stdout || "see tikztosvg log"}`);
      }
      if (tikztosvgStatus === "rendered" && svgComparisonGrid) {
        tikztosvgGridSvg = path.join(outputRoot, "tikztosvg-grid-svg", `${entry.id}.svg`);
        await writeFile(tikztosvgGridSvg, addComparisonGridToSvg(await readFile(tikztosvgSvg, "utf8")), "utf8");
      }
      if (svgToPngAvailable && tikztosvgStatus === "rendered") {
        tikztosvgPng = path.join(outputRoot, "tikztosvg-png", `${entry.id}.png`);
        tikztosvgPngStatus = await convertSvgToPng(external, tikztosvgSvg, tikztosvgPng, rsvgEnv, {
          timeoutMs: externalCommandTimeoutMs
        });
        if (tikztosvgGridSvg) {
          tikztosvgGridPng = path.join(outputRoot, "tikztosvg-grid-png", `${entry.id}.png`);
          tikztosvgGridPngStatus = await convertSvgToPng(external, tikztosvgGridSvg, tikztosvgGridPng, rsvgEnv, {
            timeoutMs: externalCommandTimeoutMs
          });
        }
      }
    }

    cases.push({
      id: entry.id,
      title: entry.title,
      source: entry.source,
      activeFigureId,
      semanticOwner: entry.semanticOwner,
      tikzkitSvg: path.relative(outputRoot, tikzkitSvg),
      tikzkitPng: tikzkitPng ? path.relative(outputRoot, tikzkitPng) : null,
      tikzkitPngStatus,
      tikzkitGridSvg: tikzkitGridSvg ? path.relative(outputRoot, tikzkitGridSvg) : null,
      tikzkitGridPng: tikzkitGridPng ? path.relative(outputRoot, tikzkitGridPng) : null,
      tikzkitGridPngStatus,
      tikztosvgInput: tikztosvgInput ? path.relative(outputRoot, tikztosvgInput) : null,
      tikztosvgSvg: tikztosvgSvg ? path.relative(outputRoot, tikztosvgSvg) : null,
      tikztosvgLog: tikztosvgLog ? path.relative(outputRoot, tikztosvgLog) : null,
      tikztosvgPng: tikztosvgPng ? path.relative(outputRoot, tikztosvgPng) : null,
      tikztosvgPngStatus,
      tikztosvgGridSvg: tikztosvgGridSvg ? path.relative(outputRoot, tikztosvgGridSvg) : null,
      tikztosvgGridPng: tikztosvgGridPng ? path.relative(outputRoot, tikztosvgGridPng) : null,
      tikztosvgGridPngStatus,
      tikztosvgStatus,
      referenceKind,
      diagnostics: tikzkit.diagnostics
    });
  }

  const renderedIds = new Set(cases.map((entry) => entry.id));
  const summaryCases = [
    ...(previousSummary?.cases || []).filter((entry) => !renderedIds.has(entry.id)),
    ...cases
  ];
  const summary = {
    fixtureRoot,
    outputRoot,
    total: summaryCases.length,
    tikztosvgAvailable,
    svgToPngAvailable,
    tikztosvgEngine,
    comparisonGridMode,
    renderedTikzkit: summaryCases.filter((entry) => entry.tikzkitSvg).length,
    renderedTikztosvg: summaryCases.filter((entry) => entry.tikztosvgStatus === "rendered").length,
    renderedTikzkitPng: summaryCases.filter((entry) => entry.tikzkitPngStatus === "rendered").length,
    renderedTikztosvgPng: summaryCases.filter((entry) => entry.tikztosvgPngStatus === "rendered").length,
    cases: summaryCases
  };
  await writeFile(path.join(outputRoot, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeExampleComparisonPage(outputRoot, summary);
  return summary;
}

function shouldUseNativeLatexReference(source) {
  const text = String(source || "");
  return (
    /\\(?:input\s*\{?kvmacros|karnaughmap|kvmap)\b/.test(text) ||
    (/\\begin\{preview\}/.test(text) && /\\tikzmark\s*\{/.test(text) && /\\begin\{array\}/.test(text))
  );
}

async function renderNativeLatexReference(external, options = {}) {
  const workDir = path.join(options.outputRoot, ".native-latex", options.entry.id);
  const texPath = path.join(workDir, "reference.tex");
  const pdfPath = path.join(workDir, "reference.pdf");
  await mkdir(workDir, { recursive: true });
  await writeFile(texPath, `${String(options.source || "").trimEnd()}\n`, "utf8");

  const latexArgs = [
    "-interaction=nonstopmode",
    "-halt-on-error",
    `-output-directory=${workDir}`,
    texPath
  ];
  for (let pass = 0; pass < 2; pass += 1) {
    const latex = await external.runCommand("pdflatex", latexArgs, {
      cwd: workDir,
      env: options.env,
      timeoutMs: options.timeoutMs
    });
    if (latex.exitCode !== 0) return { rendered: false, stage: `pdflatex-pass-${pass + 1}`, result: latex };
  }
  const converted = await external.runCommand("pdf2svg", [pdfPath, options.svgPath, "1"], {
    cwd: workDir,
    env: options.env,
    timeoutMs: options.timeoutMs
  });
  return { rendered: converted.exitCode === 0, stage: "pdf2svg", result: converted };
}

async function loadExampleResourceMap(entry, fixtureRoot) {
  const resources = new Map();
  for (const resource of entry.resources || []) {
    if (isImageResource(resource.name)) continue;
    try {
      resources.set(normalizeResourceName(resource.name), await readFile(path.join(fixtureRoot, resource.source), "utf8"));
    } catch {
      // Missing resources are reported by the pgfplots resolver as diagnostics.
    }
  }
  return resources;
}

async function loadExampleImageResourceMap(entry, fixtureRoot) {
  const resources = new Map();
  for (const resource of entry.resources || []) {
    if (!isImageResource(resource.name)) continue;
    try {
      const source = await readFile(path.join(fixtureRoot, resource.source));
      const dimensions = imageDimensions(source);
      resources.set(normalizeResourceName(resource.name), {
        href: `data:${imageMimeType(resource.name)};base64,${source.toString("base64")}`,
        ...dimensions
      });
    } catch {
      // Missing or malformed images retain the visible includegraphics placeholder.
    }
  }
  return resources;
}

function isImageResource(name) {
  return /\.(?:png|jpe?g|gif|webp)$/i.test(String(name || ""));
}

function imageMimeType(name) {
  return /\.png$/i.test(String(name || "")) ? "image/png" : "image/jpeg";
}

function imageDimensions(source) {
  if (source.length >= 24 && source.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { naturalWidth: source.readUInt32BE(16), naturalHeight: source.readUInt32BE(20) };
  }
  if (source.length >= 4 && source[0] === 0xff && source[1] === 0xd8) {
    let offset = 2;
    while (offset + 8 < source.length) {
      if (source[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = source[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
        continue;
      }
      const length = source.readUInt16BE(offset + 2);
      if (length < 2 || offset + 2 + length > source.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { naturalWidth: source.readUInt16BE(offset + 7), naturalHeight: source.readUInt16BE(offset + 5) };
      }
      offset += 2 + length;
    }
  }
  return {};
}

function normalizeResourceName(value) {
  return String(value || "").trim().replace(/^\.\//, "").replaceAll("\\", "/");
}

function rewriteExampleResourceReferences(source, resources) {
  let output = String(source || "");
  for (const resource of resources || []) {
    const name = String(resource.name || "").trim();
    if (!name || !resource.source) continue;
    output = output.split(`{${name}}`).join(`{${normalizeResourceName(resource.source)}}`);
  }
  return output;
}

async function readExampleSource(sourcePath, fixtureRoot) {
  const resolvedSourcePath = path.resolve(sourcePath);
  return expandLocalInputFiles(await readFile(resolvedSourcePath, "utf8"), {
    currentDir: path.dirname(resolvedSourcePath),
    fixtureRoot: path.resolve(fixtureRoot),
    seen: new Set([resolvedSourcePath])
  });
}

async function expandLocalInputFiles(source, context) {
  const inputPattern = /\\input\s*(?:\{([^}]+)\}|([^\s%{}]+))/g;
  let expanded = "";
  let lastIndex = 0;

  for (const match of source.matchAll(inputPattern)) {
    const matchIndex = match.index ?? 0;
    if (isEscapedCommand(source, matchIndex) || isInTexComment(source, matchIndex)) {
      continue;
    }

    const inputName = (match[1] ?? match[2] ?? "").trim();
    const inputPath = await resolveLocalInputPath(inputName, context.currentDir, context.fixtureRoot);
    if (!inputPath || context.seen.has(inputPath)) {
      continue;
    }

    const included = await expandLocalInputFiles(await readFile(inputPath, "utf8"), {
      currentDir: path.dirname(inputPath),
      fixtureRoot: context.fixtureRoot,
      seen: new Set([...context.seen, inputPath])
    });
    expanded += source.slice(lastIndex, matchIndex);
    expanded += included;
    lastIndex = matchIndex + match[0].length;
  }

  expanded += source.slice(lastIndex);
  return expanded;
}

async function resolveLocalInputPath(inputName, currentDir, fixtureRoot) {
  const normalized = inputName.replace(/^["']|["']$/g, "").trim();
  if (!normalized || normalized.includes("\\") || path.isAbsolute(normalized)) return null;

  const candidates = normalized.endsWith(".tex") ? [normalized] : [normalized, `${normalized}.tex`];
  for (const candidate of candidates) {
    const resolved = path.resolve(currentDir, candidate);
    if (!isWithinDirectory(resolved, fixtureRoot)) continue;
    try {
      await access(resolved);
      return resolved;
    } catch {
      // Try the next local candidate.
    }
  }
  return null;
}

function isWithinDirectory(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isEscapedCommand(source, index) {
  let count = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) {
    count += 1;
  }
  return count % 2 === 1;
}

function isInTexComment(source, index) {
  const lineStart = source.lastIndexOf("\n", index - 1) + 1;
  for (let cursor = lineStart; cursor < index; cursor += 1) {
    if (source[cursor] === "%" && !isEscapedCommand(source, cursor)) {
      return true;
    }
  }
  return false;
}

async function clearManagedOutputArtifacts(outputRoot) {
  const managedDirectories = [
    "tikzkit-svg",
    "tikzkit-png",
    "tikzkit-grid-svg",
    "tikzkit-grid-png",
    "tikztosvg-svg",
    "tikztosvg-input",
    "tikztosvg-log",
    "tikztosvg-png",
    "tikztosvg-grid-svg",
    "tikztosvg-grid-png"
  ];
  for (const directory of managedDirectories) {
    const directoryPath = path.join(outputRoot, directory);
    let entries = [];
    try {
      entries = await readdir(directoryPath, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isFile() && !entry.isSymbolicLink()) continue;
      await unlink(path.join(directoryPath, entry.name));
    }
  }
}

async function copyManagedFontAssets(outputRoot) {
  const outputFontDir = path.join(outputRoot, "fonts");
  const sourceFontDir = path.join(REPO_ROOT, "web", "fonts");
  await mkdir(outputFontDir, { recursive: true });
  for (const fileName of MANAGED_TIKZKIT_FONT_FILES) {
    await copyFile(path.join(sourceFontDir, fileName), path.join(outputFontDir, fileName));
  }
}

export async function convertSvgToPng(external, svgPath, pngPath, env = process.env, options = {}) {
  const result = await external.runCommand("rsvg-convert", ["-b", "white", "-o", pngPath, svgPath], {
    env,
    timeoutMs: options.timeoutMs
  });
  return result.exitCode === 0 ? "rendered" : "failed";
}

export async function writeTikztosvgInput(outputRoot, entry, source, options = {}) {
  const inputPath = path.join(outputRoot, "tikztosvg-input", `${entry.id}.tex`);
  await writeFile(inputPath, `${normalizeTikztosvgInput(source, options).trimEnd()}\n`, "utf8");
  return inputPath;
}

export async function writeTikztosvgLog(outputRoot, entry, result, primaryResult = null) {
  const logPath = path.join(outputRoot, "tikztosvg-log", `${entry.id}.log`);
  const primary = primaryResult && primaryResult !== result
    ? [
        "primary quiet run:",
        `exitCode: ${primaryResult.exitCode}`,
        "stdout:",
        primaryResult.stdout || "",
        "stderr:",
        primaryResult.stderr || "",
        "",
        "diagnostic non-quiet run:"
      ]
    : [];
  await writeFile(
    logPath,
    [
      `case: ${entry.id}`,
      `source: ${entry.source}`,
      ...primary,
      `exitCode: ${result.exitCode}`,
      "",
      "stdout:",
      result.stdout || "",
      "",
      "stderr:",
      result.stderr || "",
      ""
    ].join("\n"),
    "utf8"
  );
  return logPath;
}

export async function removeTikztosvgLog(outputRoot, entry) {
  try {
    await unlink(path.join(outputRoot, "tikztosvg-log", `${entry.id}.log`));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function shouldRetryTikztosvgWithoutQuiet(result) {
  return result.exitCode !== 0 && !String(result.stdout || "").trim() && !String(result.stderr || "").trim();
}

export function normalizeTikztosvgInput(source, options = {}) {
  const selectedSource = selectActiveFigureSource(source, options.activeFigureId);
  const withoutDocumentShell = selectedSource
    .split(/\r?\n/)
    .filter((line) => !/^\\documentclass\b/.test(line.trim()))
    .filter((line) => !/^\\usepackage\b/.test(line.trim()))
    .filter((line) => !/^\\(?:usetikzlibrary|usepgfplotslibrary)\b/.test(line.trim()))
    .filter((line) => !/^\\setlength\\PreviewBorder\b/.test(line.trim()))
    .filter((line) => !/^\\begin\{document\}\s*$/.test(line.trim()))
    .filter((line) => !/^\\end\{document\}\s*$/.test(line.trim()))
    .filter((line) => !/^\\usetkzobj\{[^}]*\}\s*$/.test(line.trim()))
    .join("\n");
  const body = unwrapResizebox(unwrapEnvironment(withoutDocumentShell, "preview"));
  const loweredBody = lowerRawGnuplotAddplotsToCoordinates(body);
  return `${tikztosvgInputPreamble(selectedSource, loweredBody)}${loweredBody}`;
}

export function selectActiveFigureSource(source, activeFigureId) {
  const original = String(source || "");
  if (!activeFigureId) return original;
  const documentStart = original.indexOf("\\begin{document}");
  const allRanges = findTikzPictureRanges(original);
  const documentRanges = documentStart === -1
    ? allRanges
    : allRanges.filter((range) => range.beginIndex > documentStart);
  // A custom environment may contain the literal tikzpicture only in its
  // preamble definition. In that case the native converter must receive the
  // original source so TeX can expand the requested page itself.
  const ranges = documentRanges.length ? documentRanges : documentStart === -1 ? allRanges : [];
  if (ranges.length === 0) return original;
  const index = resolveActiveFigureIndex(activeFigureId, ranges.length);
  const selected = ranges[index];
  if (!selected) return original;

  const context = extractActiveFigureContext(original.slice(0, selected.beginIndex));
  const selectedPicture = original.slice(selected.beginIndex, selected.endIndex).trim();
  const hasDocumentEnd = /\\end\{document\}/.test(original.slice(selected.endIndex));
  return [context.trimEnd(), selectedPicture, hasDocumentEnd ? "\\end{document}" : ""]
    .filter(Boolean)
    .join("\n");
}

function findTikzPictureRanges(source) {
  const begin = String.raw`\begin{tikzpicture}`;
  const end = String.raw`\end{tikzpicture}`;
  const ranges = [];
  let cursor = 0;
  let depth = 0;
  let currentBegin = null;

  while (cursor < source.length) {
    const nextBegin = source.indexOf(begin, cursor);
    const nextEnd = source.indexOf(end, cursor);
    if (nextBegin === -1 && nextEnd === -1) break;
    if (nextBegin !== -1 && (nextEnd === -1 || nextBegin < nextEnd)) {
      if (depth === 0) currentBegin = nextBegin;
      depth += 1;
      cursor = nextBegin + begin.length;
      continue;
    }
    if (nextEnd !== -1) {
      depth = Math.max(0, depth - 1);
      cursor = nextEnd + end.length;
      if (depth === 0 && currentBegin != null) {
        ranges.push({
          beginIndex: currentBegin,
          endIndex: cursor
        });
        currentBegin = null;
      }
      continue;
    }
    break;
  }

  return ranges;
}

function resolveActiveFigureIndex(activeFigureId, count) {
  const match = /^figure:(\d+)(?::|$)/.exec(String(activeFigureId || "").trim());
  const rawIndex = match ? Number.parseInt(match[1], 10) : 0;
  const index = Number.isFinite(rawIndex) ? rawIndex : 0;
  return Math.max(0, Math.min(count - 1, index));
}

function extractActiveFigureContext(prefix) {
  const withoutPreviousPictures = removeTikzPictureRanges(prefix);
  const documentMatch = /\\begin\{document\}/.exec(withoutPreviousPictures);
  if (!documentMatch) return keepLikelyTexContext(withoutPreviousPictures);

  const documentBeginEnd = documentMatch.index + documentMatch[0].length;
  const preamble = withoutPreviousPictures.slice(0, documentBeginEnd);
  const bodyContext = withoutPreviousPictures.slice(documentBeginEnd);
  return `${preamble}${keepLikelyTexContext(bodyContext)}`;
}

function removeTikzPictureRanges(source) {
  const ranges = findTikzPictureRanges(source);
  if (!ranges.length) return source;
  let output = "";
  let cursor = 0;
  for (const range of ranges) {
    output += source.slice(cursor, range.beginIndex);
    cursor = range.endIndex;
  }
  output += source.slice(cursor);
  return output;
}

function keepLikelyTexContext(source) {
  const lines = String(source || "").split(/\r?\n/);
  const kept = [];
  let braceDepth = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    const keep = !trimmed || trimmed.startsWith("%") || trimmed.startsWith("\\") || braceDepth > 0;
    if (keep) kept.push(line);
    if (keep || braceDepth > 0) {
      braceDepth = Math.max(0, braceDepth + countUnescaped(line, "{") - countUnescaped(line, "}"));
    }
  }
  return kept.join("\n");
}

function countUnescaped(text, char) {
  let count = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === char && !isEscapedCommand(text, index)) count += 1;
  }
  return count;
}

function unwrapEnvironment(source, environmentName) {
  const beginPattern = new RegExp(`^\\\\begin\\{${environmentName}\\}\\s*$`);
  const endPattern = new RegExp(`^\\\\end\\{${environmentName}\\}\\s*$`);
  return source
    .split(/\r?\n/)
    .filter((line) => !beginPattern.test(line.trim()))
    .filter((line) => !endPattern.test(line.trim()))
    .join("\n");
}

function unwrapResizebox(source) {
  const lines = source.split(/\r?\n/);
  const resizeboxIndex = lines.findIndex((line) => /^\\resizebox\{[^}]*\}\{[^}]*\}\{\s*$/.test(line.trim()));
  if (resizeboxIndex < 0) return source;

  lines.splice(resizeboxIndex, 1);
  const tikzEndIndex = lines.findIndex((line) => /\\end\{tikzpicture\}/.test(line));
  const closeIndex = lines.findIndex((line, index) => index > tikzEndIndex && line.trim() === "}");
  if (closeIndex >= 0) lines.splice(closeIndex, 1);
  return lines.join("\n");
}

export async function createTikztosvgCompatibilityEnv(
  outputRoot = DEFAULT_OUTPUT_ROOT,
  baseEnv = process.env,
  fixtureRoot = DEFAULT_FIXTURE_ROOT
) {
  const wrapperDir = path.join(path.resolve(outputRoot), ".tikzkit-bin");
  await mkdir(wrapperDir, { recursive: true });
  const rmWrapper = path.join(wrapperDir, "rm");
  await writeFile(
    rmWrapper,
    [
      "#!/bin/sh",
      "if [ \"$#\" -eq 2 ]; then",
      "  case \"$2\" in",
      "    -r|-rf|-fr) exec /bin/rm \"$2\" \"$1\" ;;",
      "  esac",
      "fi",
      "exec /bin/rm \"$@\"",
      ""
    ].join("\n"),
    "utf8"
  );
  await chmod(rmWrapper, 0o755);
  return {
    ...baseEnv,
    PATH: `${wrapperDir}${path.delimiter}${baseEnv.PATH || ""}`,
    TEXINPUTS: `${path.resolve(fixtureRoot)}//${path.delimiter}${baseEnv.TEXINPUTS || ""}`
  };
}

export async function createRsvgFontEnv(outputRoot = DEFAULT_OUTPUT_ROOT, baseEnv = process.env) {
  const configDir = path.join(path.resolve(outputRoot), ".tikzkit-fontconfig");
  const cacheDir = path.join(configDir, "cache");
  const outputFontDir = path.join(path.resolve(outputRoot), "fonts");
  await mkdir(cacheDir, { recursive: true });
  await mkdir(outputFontDir, { recursive: true });
  const homeFontDir = baseEnv.HOME ? path.join(baseEnv.HOME, "Library", "Fonts") : null;
  const fontDirs = await existingDirectories([
    outputFontDir,
    ...TEXLIVE_OPENTYPE_FONT_DIRS,
    "/System/Library/Fonts",
    "/Library/Fonts",
    homeFontDir
  ]);
  const configPath = path.join(configDir, "fonts.conf");
  await writeFile(
    configPath,
    [
      '<?xml version="1.0"?>',
      '<!DOCTYPE fontconfig SYSTEM "fonts.dtd">',
      "<fontconfig>",
      ...fontDirs.map((dir) => `  <dir>${escapeXml(dir)}</dir>`),
      `  <cachedir>${escapeXml(cacheDir)}</cachedir>`,
      "</fontconfig>",
      ""
    ].join("\n"),
    "utf8"
  );
  return {
    ...baseEnv,
    FONTCONFIG_FILE: configPath,
    PANGOCAIRO_BACKEND: "fontconfig",
    XDG_CACHE_HOME: cacheDir
  };
}

async function existingDirectories(directories) {
  const existing = [];
  for (const directory of directories.filter(Boolean)) {
    try {
      await access(directory);
      existing.push(directory);
    } catch {
      // Ignore missing optional font directories.
    }
  }
  return existing;
}

export async function loadExampleManifest(fixtureRoot = DEFAULT_FIXTURE_ROOT) {
  try {
    return JSON.parse(await readFile(path.join(fixtureRoot, "manifest.json"), "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return { version: 1, cases: [] };
    throw error;
  }
}

export async function discoverExampleCases(fixtureRoot = DEFAULT_FIXTURE_ROOT, manifestCases = []) {
  const sourceFiles = await discoverExampleSources(fixtureRoot);
  const bySource = new Map(manifestCases.map((entry) => [normalizeFixtureSource(entry.source), entry]));
  const discovered = sourceFiles.map((source) => {
    const manifestEntry = bySource.get(source);
    return {
      id: slugifyCaseId(source),
      title: titleFromSource(source),
      semanticOwner: "src/index.js",
      features: ["fixture discovery"],
      ...(manifestEntry || {}),
      source
    };
  });

  const knownSources = new Set(discovered.map((entry) => entry.source));
  const manifestOnly = manifestCases
    .filter((entry) => !knownSources.has(normalizeFixtureSource(entry.source)))
    .map((entry) => ({ ...entry, source: normalizeFixtureSource(entry.source) }));

  return [...discovered, ...manifestOnly].sort((left, right) => left.id.localeCompare(right.id));
}

export async function discoverExampleSources(fixtureRoot = DEFAULT_FIXTURE_ROOT) {
  const root = path.resolve(fixtureRoot);
  const files = [];

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.isDirectory()) {
        if (entry.name === "output" || entry.name === "node_modules") continue;
        await visit(path.join(directory, entry.name));
        continue;
      }

      if (!entry.isFile()) continue;
      if (!/\.(tikz|tex)$/i.test(entry.name)) continue;
      files.push(normalizeFixtureSource(path.relative(root, path.join(directory, entry.name))));
    }
  }

  await visit(root);
  return files.sort((left, right) => left.localeCompare(right));
}

export async function writeExampleComparisonPage(outputRoot = DEFAULT_OUTPUT_ROOT, renderSummary = null, diffSummary = null) {
  const root = path.resolve(outputRoot);
  const summary = renderSummary || JSON.parse(await readFile(path.join(root, "summary.json"), "utf8"));
  const diff =
    diffSummary ||
    (await readOptionalJson(path.join(root, "diff", "summary.json"))) || {
      cases: []
    };
  const diffById = new Map((diff.cases || []).map((entry) => [entry.id, entry]));
  const html = renderComparisonHtml(summary, diffById);
  await writeFile(path.join(root, "index.html"), html, "utf8");
}

export function addComparisonGridToSvg(svg, options = {}) {
  const viewBox = parseSvgViewBox(svg);
  if (!viewBox) return svg;
  const unitPerCm = Number(options.unitPerCm || inferredComparisonGridUnitPerCm(svg, viewBox) || TEX_PT_PER_CM);
  if (!Number.isFinite(unitPerCm) || unitPerCm <= 0) return svg;
  const origin = options.origin || inferredComparisonGridOrigin(svg) || { x: 0, y: 0 };

  const grid = renderComparisonGrid(viewBox, {
    unitPerCm,
    originX: Number(origin.x) || 0,
    originY: Number(origin.y) || 0,
    stroke: options.stroke || "#94a3b8",
    strokeWidth: options.strokeWidth ?? Math.max(0.14, unitPerCm * 0.004),
    dashLength: options.dashLength ?? unitPerCm * 0.035,
    dashGap: options.dashGap ?? unitPerCm * 0.035
  });
  return insertComparisonGrid(svg, grid);
}

export function selectCases(cases, only) {
  const wanted = normalizeOnly(only);
  if (!wanted.length) return cases;
  return cases.filter((entry) => wanted.includes(entry.id));
}

export function limitCases(cases, limit) {
  const normalized = normalizedCaseLimit(limit);
  return normalized == null ? cases : cases.slice(0, normalized);
}

export function parseExampleRenderArgs(argv = process.argv.slice(2)) {
  const only = valuesAfter(argv, "--only");
  return {
    fixtureRoot: valueAfter(argv, "--fixtures") || DEFAULT_FIXTURE_ROOT,
    outputRoot: valueAfter(argv, "--output") || DEFAULT_OUTPUT_ROOT,
    only,
    limit: normalizedCaseLimit(valueAfter(argv, "--limit")),
    skipTikztosvg: argv.includes("--skip-tikztosvg"),
    skipPng: argv.includes("--skip-png"),
    strictTikztosvg: argv.includes("--strict-tikztosvg"),
    preserveOutput: argv.includes("--preserve-output"),
    tikztosvgEngine: valueAfter(argv, "--tikztosvg-engine") || "xelatex",
    externalCommandTimeoutMs: normalizedTimeoutMs(valueAfter(argv, "--external-timeout-ms")),
    comparisonGrid: !argv.includes("--no-comparison-grid"),
    comparisonGridMode: valueAfter(argv, "--comparison-grid-mode") || valueAfter(argv, "--comparison-grid"),
    renderOptions: {
      mathRenderer: valueAfter(argv, "--math-renderer")
    }
  };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(exampleRenderUsage());
    return;
  }
  const summary = await renderExampleFixtures(parseExampleRenderArgs(argv));
  process.stdout.write(formatExampleRenderSummary(summary));
}

function exampleRenderUsage() {
  return [
    "Usage: node scripts/render-example-fixtures.js [options]",
    "",
    "Options:",
    "  --fixtures <directory>          Fixture root (default: test/fixtures/examples)",
    "  --output <directory>            Artifact output root",
    "  --only <fixture-id>             Render one fixture; may be repeated",
    "  --limit <count>                 Render only the first count fixtures",
    "  --preserve-output               Keep existing output-root artifacts",
    "  --skip-tikztosvg                Do not invoke the local tikztosvg reference",
    "  --skip-png                      Keep SVG artifacts only",
    "  --strict-tikztosvg              Fail when tikztosvg cannot render a case",
    "  --tikztosvg-engine <engine>     TeX engine for tikztosvg (default: xelatex)",
    "  --no-comparison-grid            Do not add the 1cm comparison grid",
    "  --math-renderer <renderer>      TikZKit math renderer, such as svg-text"
  ].join("\n") + "\n";
}

export function formatExampleRenderSummary(summary) {
  return (
    `Rendered ${summary.renderedTikzkit}/${summary.total} TikZKit SVG files` +
    `, ${summary.renderedTikztosvg}/${summary.total} tikztosvg SVG files` +
    `, ${summary.renderedTikzkitPng}/${summary.total} TikZKit PNG files` +
    `, and ${summary.renderedTikztosvgPng}/${summary.total} tikztosvg PNG files` +
    ` into ${summary.outputRoot}\n`
  );
}

function tikztosvgEngineArgs(engine, source = "") {
  const requestedEngine = engine || "default";
  const sourcePackages = tikztosvgPackageNames(source);
  // brunnian's colorinfo dependency emits its raw "gray 1" definition under XeTeX/LuaTeX.
  const compatibleEngine = sourcePackages.includes("brunnian") ? "pdflatex" : requestedEngine;
  if (compatibleEngine === "default") return [];
  if (compatibleEngine === "xelatex") return ["--xelatex"];
  if (compatibleEngine === "lualatex") return ["--lualatex"];
  if (compatibleEngine === "pdflatex") return ["--pdflatex"];
  return [`--${compatibleEngine}`];
}

function tikztosvgPackageArgs(source) {
  const builtInPackages = new Set(["amsmath", "amssymb", "pgfplots", "tikz", "tikz-cd", "xcolor"]);
  const supportedExternalPackages = new Set([
    "bchart",
    "brunnian",
    "circuitikz",
    "helvet",
    "nicefrac",
    "sansmath",
    "tikz-3dplot",
    "tkz-base",
    "tkz-euclide",
    "tkz-fct"
  ]);
  const packages = [];
  for (const packageName of tikztosvgPackageNames(source)) {
    if (builtInPackages.has(packageName) || !supportedExternalPackages.has(packageName)) continue;
    if (packageName === "tkz-euclide" && !packages.includes("tkz-base")) packages.push("tkz-base");
    if (!packages.includes(packageName)) packages.push(packageName);
  }
  return packages.flatMap((packageName) => ["-p", packageName]);
}

function tikztosvgPackageNames(source) {
  const packages = [];
  const pattern = /^\\usepackage(?:\[[^\]]*\])?\{([^}]*)\}/gm;
  for (const match of String(source || "").matchAll(pattern)) {
    for (const name of match[1].split(",")) {
      const packageName = name.trim();
      if (packageName && !packages.includes(packageName)) packages.push(packageName);
    }
  }
  return packages;
}

function tikztosvgLibraryArgs(source) {
  const libraries = [];
  const add = (library) => {
    const normalized = String(library || "").trim();
    if (normalized && !libraries.includes(normalized)) libraries.push(normalized);
  };
  for (const match of String(source || "").matchAll(/\\usetikzlibrary\s*\{([^}]*)\}/g)) {
    match[1].split(",").forEach(add);
  }
  for (const match of String(source || "").matchAll(/\\usepgfplotslibrary\s*\{([^}]*)\}/g)) {
    match[1].split(",").forEach((library) => add(`pgfplots.${String(library).trim()}`));
  }
  return libraries.flatMap((library) => ["-l", library]);
}

function tikztosvgInputPreamble(source, body) {
  const lines = [];
  const libraries = tikztosvgRequiredLibraries(body);
  if (libraries.length) lines.push(`\\usetikzlibrary{${libraries.join(",")}}`);

  if (!/\\usepackage\[[^\]]*dvipsnames[^\]]*\]\{xcolor\}/.test(source)) return lines.length ? `${lines.join("\n")}\n` : "";

  const dvipsNamedColors = {
    Blue: "1,1,0,0",
    Green: "1,0,1,0",
    LimeGreen: "0.50,0,1,0",
    Red: "0,1,1,0",
    Sepia: "0,0.83,1,0.70",
    SkyBlue: "0.62,0,0.12,0",
    SpringGreen: "0.26,0,0.76,0",
    WildStrawberry: "0,0.96,0.39,0"
  };
  const colorDefinitions = Object.entries(dvipsNamedColors)
    .filter(([name]) => new RegExp(`\\b${name}\\b`).test(body))
    .map(([name, value]) => `\\definecolor{${name}}{cmyk}{${value}}`);
  lines.push(...colorDefinitions);
  return lines.length ? `${lines.join("\n")}\n` : "";
}

function tikztosvgRequiredLibraries(body) {
  const libraries = [];
  if (/text\s+along\s+path/.test(body)) libraries.push("decorations.text");
  if (/\\begin\{pgfonlayer\}\{background\}/.test(body) || /\\begin\{scope\}\[on background layer\]/.test(body)) {
    libraries.push("backgrounds");
  }
  if (/\(\s*\$[\s\S]*?\$\s*\)/.test(body)) libraries.push("calc");
  return libraries;
}

function normalizeOnly(only) {
  if (!only) return [];
  const values = Array.isArray(only) ? only : [only];
  return values.flatMap((value) => String(value || "").split(",")).map((value) => value.trim()).filter(Boolean);
}

function normalizedCaseLimit(limit) {
  if (limit == null || limit === "") return null;
  const numeric = Number(limit);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.floor(numeric);
}

function valueAfter(args, flag) {
  const index = args.findIndex((arg) => arg === flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function valuesAfter(args, flag) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== flag) continue;
    for (let cursor = index + 1; cursor < args.length && !String(args[cursor]).startsWith("--"); cursor += 1) {
      values.push(args[cursor]);
      index = cursor;
    }
  }
  return values;
}

function definedRenderOptions(options = {}) {
  return Object.fromEntries(Object.entries(options).filter((entry) => entry[1] !== undefined));
}

function normalizedTimeoutMs(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function normalizedComparisonGridMode(options = {}) {
  if (options.comparisonGrid === false) return "none";
  const rawMode = options.comparisonGridMode ?? (typeof options.comparisonGrid === "string" ? options.comparisonGrid : "svg");
  const mode = String(rawMode || "svg").trim().toLowerCase();
  if (mode === "none" || mode === "off" || mode === "false" || mode === "0") return "none";
  if (mode === "source" || mode === "tikz") return "source";
  return "svg";
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function renderComparisonHtml(summary, diffById) {
  const rows = (summary.cases || []).map((entry) => renderCaseHtml(entry, diffById.get(entry.id))).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TikZKit implementation examples</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #172033; background: #f6f8fb; }
    body { margin: 0; padding: 24px; }
    header { max-width: 1280px; margin: 0 auto 18px; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    .meta { color: #536079; font-size: 13px; display: flex; gap: 12px; flex-wrap: wrap; }
    .case { max-width: 1280px; margin: 0 auto 24px; background: white; border: 1px solid #d7deea; border-radius: 8px; overflow: hidden; }
    .case-header { padding: 14px 16px; border-bottom: 1px solid #e5eaf2; display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
    .case-title { margin: 0; font-size: 18px; }
    .case-info { color: #5d6980; font-size: 12px; }
    .panels { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: #e5eaf2; }
    .panel { background: #fff; min-width: 0; }
    .panel h3 { margin: 0; padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #edf1f6; color: #334155; }
    .viewport { min-height: 180px; padding: 14px; display: grid; place-items: center; overflow: auto; }
    img { max-width: 100%; height: auto; display: block; }
    .missing { color: #9a3412; font-size: 13px; }
    .status { padding: 10px 16px; color: #475569; font-size: 12px; border-top: 1px solid #edf1f6; display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; }
    .status a { color: #2563eb; text-decoration: none; }
    .status a:hover { text-decoration: underline; }
    .diagnostics { padding: 0 16px 14px; border-top: 1px solid #edf1f6; color: #7c2d12; font-size: 12px; line-height: 1.45; }
    .diagnostics strong { display: inline-block; margin-top: 10px; color: #9a3412; }
    .diagnostics ul { margin: 6px 0 0; padding-left: 18px; }
    .diagnostics li { margin: 3px 0; }
    .diagnostic-code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; color: #9a3412; }
    @media (max-width: 900px) { .panels { grid-template-columns: 1fr; } body { padding: 12px; } }
  </style>
</head>
<body>
  <header>
    <h1>TikZKit implementation examples</h1>
    <div class="meta">
      <span>${escapeHtml(String(summary.total || 0))} cases</span>
      <span>TikZKit SVG: ${escapeHtml(String(summary.renderedTikzkit || 0))}</span>
      <span>tikztosvg SVG: ${escapeHtml(String(summary.renderedTikztosvg || 0))}</span>
      <span>output: ${escapeHtml(summary.outputRoot || "")}</span>
    </div>
  </header>
  ${rows}
</body>
</html>
`;
}

function renderCaseHtml(entry, diff) {
  const tikzkitPanelPng = entry.tikzkitGridPng || entry.tikzkitPng;
  const tikztosvgPanelPng = entry.tikztosvgGridPng || entry.tikztosvgPng;
  const tikzkitPanelTitle = entry.tikzkitGridPng ? "TikZKit JS PNG + 1cm grid" : "TikZKit JS PNG";
  const referenceLabel = entry.referenceKind === "native-latex" ? "MacTeX native reference PNG" : "tikztosvg PNG";
  const tikztosvgPanelTitle = entry.tikztosvgGridPng ? `${referenceLabel} + 1cm grid` : referenceLabel;
  return `<section class="case" id="${escapeHtml(entry.id)}">
  <div class="case-header">
    <h2 class="case-title">${escapeHtml(entry.id)} · ${escapeHtml(entry.title || "")}</h2>
    <div class="case-info">${escapeHtml(entry.source || "")}</div>
  </div>
  <div class="panels">
    ${renderImagePanel(tikzkitPanelTitle, tikzkitPanelPng)}
    ${renderImagePanel(tikztosvgPanelTitle, tikztosvgPanelPng)}
  </div>
  <div class="status">
    <span>diff: ${escapeHtml(diff?.status || "not generated")} ${renderDiffNumbers(diff)}</span>
    <span>diagnostics: ${escapeHtml(String(entry.diagnostics?.length || 0))}</span>
    ${entry.activeFigureId ? `<span>active figure: ${escapeHtml(entry.activeFigureId)}</span>` : ""}
    ${renderArtifactLink("TikZKit SVG", entry.tikzkitSvg)}
    ${renderArtifactLink("TikZKit grid SVG", entry.tikzkitGridSvg)}
    ${renderArtifactLink("tikztosvg SVG", entry.tikztosvgSvg)}
    ${renderArtifactLink("tikztosvg grid SVG", entry.tikztosvgGridSvg)}
    ${renderArtifactLink("tikztosvg log", entry.tikztosvgLog)}
    ${renderArtifactLink("diff PNG", diff?.diffPng)}
  </div>
  ${renderDiagnostics(entry.diagnostics)}
</section>`;
}

function renderImagePanel(title, href) {
  return `<div class="panel"><h3>${escapeHtml(title)}</h3><div class="viewport">${href ? `<img src="${escapeAttribute(href)}" alt="${escapeAttribute(title)}">` : `<span class="missing">missing</span>`}</div></div>`;
}

function renderArtifactLink(title, href) {
  return href ? `<a href="${escapeAttribute(href)}">${escapeHtml(title)}</a>` : `<span>${escapeHtml(title)}: missing</span>`;
}

function renderDiffNumbers(diff) {
  if (!diff || typeof diff.changedRatio !== "number") return "";
  return ` · changed ${(diff.changedRatio * 100).toFixed(2)}% · mean ${Number(diff.meanAbsoluteRGBA || 0).toFixed(4)}`;
}

function renderDiagnostics(diagnostics = []) {
  if (!Array.isArray(diagnostics) || diagnostics.length === 0) return "";
  const items = diagnostics.map((diagnostic) => {
    const severity = diagnostic?.severity || "warning";
    const code = diagnostic?.code ? ` <span class="diagnostic-code">${escapeHtml(diagnostic.code)}</span>` : "";
    const message = diagnostic?.message || "";
    return `<li><strong>${escapeHtml(severity)}</strong>${code}: ${escapeHtml(message)}</li>`;
  });
  return `<div class="diagnostics"><strong>TikZKit diagnostics</strong><ul>${items.join("")}</ul></div>`;
}

function normalizeFixtureSource(source) {
  return String(source || "").split(path.sep).join("/");
}

function slugifyCaseId(source) {
  return normalizeFixtureSource(source)
    .replace(/\.(tikz|tex)$/i, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function titleFromSource(source) {
  return normalizeFixtureSource(source)
    .replace(/\.(tikz|tex)$/i, "")
    .split("/")
    .at(-1)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function parseSvgViewBox(svg) {
  const match = String(svg).match(/\bviewBox=(["'])([^"']+)\1/);
  if (!match) return null;
  const values = match[2].trim().split(/[\s,]+/).map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) return null;
  const [x, y, width, height] = values;
  if (width <= 0 || height <= 0) return null;
  return {
    x,
    y,
    width,
    height,
    maxX: x + width,
    maxY: y + height
  };
}

function inferredComparisonGridUnitPerCm(svg, viewBox) {
  const widthPt = parseSvgLengthInTexPt(String(svg).match(/\bwidth=(["'])([^"']+)\1/)?.[2]);
  const heightPt = parseSvgLengthInTexPt(String(svg).match(/\bheight=(["'])([^"']+)\1/)?.[2]);
  const scaleX = widthPt && widthPt > 0 ? viewBox.width / widthPt : null;
  const scaleY = heightPt && heightPt > 0 ? viewBox.height / heightPt : null;
  const scales = [scaleX, scaleY].filter((value) => Number.isFinite(value) && value > 0);
  if (!scales.length) return TEX_PT_PER_CM;
  const scale = scales.reduce((sum, value) => sum + value, 0) / scales.length;
  return TEX_PT_PER_CM * scale;
}

function parseSvgLengthInTexPt(raw) {
  if (raw === undefined || raw === null) return null;
  const match = String(raw).trim().match(/^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*([a-z%]*)$/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = (match[2] || "pt").toLowerCase();
  if (unit === "pt") return value;
  if (unit === "cm") return value * TEX_PT_PER_CM;
  if (unit === "mm") return value * (TEX_PT_PER_CM / 10);
  if (unit === "in") return value * 72.27;
  if (unit === "bp" || unit === "px") return value * (72.27 / 72);
  return null;
}

function inferredComparisonGridOrigin(svg) {
  const source = String(svg || "");
  const body = source.replace(/<defs\b[\s\S]*?<\/defs>/gi, "");
  const pathTransformPattern =
    /<path\b(?=[^>]*\btransform=(["'])matrix\(\s*1\s*[, ]\s*0\s*[, ]\s*0\s*[, ]\s*-1\s*[, ]\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*[, ]\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*\)\1)[^>]*>/gi;
  const anyTransformPattern =
    /\btransform=(["'])matrix\(\s*1\s*[, ]\s*0\s*[, ]\s*0\s*[, ]\s*-1\s*[, ]\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*[, ]\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*\)\1/gi;
  for (const match of body.matchAll(pathTransformPattern)) {
    const x = Number(match[2]);
    const y = Number(match[3]);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  }
  for (const match of body.matchAll(anyTransformPattern)) {
    const x = Number(match[2]);
    const y = Number(match[3]);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  }
  return null;
}

function renderComparisonGrid(viewBox, options) {
  const { unitPerCm, originX = 0, originY = 0, stroke, strokeWidth, dashLength, dashGap } = options;
  const minX = originX + Math.floor((viewBox.x - originX) / unitPerCm) * unitPerCm;
  const maxX = originX + Math.ceil((viewBox.maxX - originX) / unitPerCm) * unitPerCm;
  const minY = originY + Math.floor((viewBox.y - originY) / unitPerCm) * unitPerCm;
  const maxY = originY + Math.ceil((viewBox.maxY - originY) / unitPerCm) * unitPerCm;
  const commands = [];

  for (let x = minX; x <= maxX + unitPerCm * 1e-6; x += unitPerCm) {
    commands.push(`M ${formatGridNumber(x)} ${formatGridNumber(viewBox.y)} L ${formatGridNumber(x)} ${formatGridNumber(viewBox.maxY)}`);
  }
  for (let y = minY; y <= maxY + unitPerCm * 1e-6; y += unitPerCm) {
    commands.push(`M ${formatGridNumber(viewBox.x)} ${formatGridNumber(y)} L ${formatGridNumber(viewBox.maxX)} ${formatGridNumber(y)}`);
  }

  return `<path class="tikzkit-comparison-grid" d="${commands.join(" ")}" stroke="${escapeAttribute(stroke)}" fill="none" stroke-width="${formatGridNumber(strokeWidth)}" stroke-dasharray="${formatGridNumber(dashLength)} ${formatGridNumber(dashGap)}" stroke-linecap="butt" vector-effect="non-scaling-stroke" pointer-events="none" />`;
}

function insertComparisonGrid(svg, grid) {
  const backgroundMatch = String(svg).match(/<rect\b[^>]*class=(["'])tikz-background\1[^>]*\/?>/);
  if (backgroundMatch?.index != null) {
    const insertAt = backgroundMatch.index + backgroundMatch[0].length;
    return `${svg.slice(0, insertAt)}\n  ${grid}${svg.slice(insertAt)}`;
  }

  const defsEnd = String(svg).indexOf("</defs>");
  if (defsEnd >= 0) {
    const insertAt = defsEnd + "</defs>".length;
    return `${svg.slice(0, insertAt)}\n${grid}${svg.slice(insertAt)}`;
  }

  const svgOpen = String(svg).match(/<svg\b[^>]*>/i);
  if (svgOpen?.index == null) return svg;
  const insertAt = svgOpen.index + svgOpen[0].length;
  return `${svg.slice(0, insertAt)}\n${grid}${svg.slice(insertAt)}`;
}

function formatGridNumber(value) {
  const rounded = Math.round((Number(value) + Number.EPSILON) * 1000000) / 1000000;
  if (Object.is(rounded, -0)) return "0";
  return String(rounded).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;
if (isCli) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
