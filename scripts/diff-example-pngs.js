#!/usr/bin/env node
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";
import { fingerprintRenderEnvironment, validateRenderedCase, writeExampleComparisonPage } from "./render-example-fixtures.js";

const DEFAULT_OUTPUT_ROOT = path.resolve("test", "fixtures", "examples", "output");
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const DEFAULT_PIXEL_TOLERANCE = 6;
const DEFAULT_CHANGED_RATIO_TOLERANCE = 0.005;
const DEFAULT_MEAN_ABSOLUTE_TOLERANCE = 0.001;
const DEFAULT_ALIGNMENT_RADIUS = 3;
const DEFAULT_ALIGNMENT_SAMPLE_STEP = 3;
const DEFAULT_ALIGNMENT_CANDIDATES = 4;

export async function compareExamplePngs(options = {}) {
  const outputRoot = path.resolve(options.outputRoot || DEFAULT_OUTPUT_ROOT);
  const renderSummary = JSON.parse(await readFile(path.join(outputRoot, "summary.json"), "utf8"));
  await clearManagedDiffArtifacts(outputRoot);
  await mkdir(path.join(outputRoot, "diff"), { recursive: true });
  await mkdir(path.join(outputRoot, "diff-png"), { recursive: true });

  const cases = [];
  const environment = await fingerprintRenderEnvironment();
  const toolVersions = new Map();
  for (const entry of renderSummary.cases || []) {
    const result = await compareCase(outputRoot, entry, { ...options, environment, toolVersions, nativeReferenceRequested: renderSummary.nativeReferenceRequested });
    cases.push(result);
  }

  const summary = {
    outputRoot,
    total: cases.length,
    compared: cases.filter((entry) => entry.status === "same" || entry.status === "different" || entry.status === "dimension-mismatch").length,
    same: cases.filter((entry) => entry.status === "same").length,
    different: cases.filter((entry) => entry.status === "different" || entry.status === "dimension-mismatch").length,
    missing: cases.filter((entry) => entry.status === "missing").length,
    stale: cases.filter((entry) => entry.status === "stale").length,
    accepted: cases.length > 0 && cases.every((entry) => entry.accepted),
    acceptanceScope: options.paintingOnly ? "painting-only; numerical semantics not independently validated" : "independent-reference-comparison",
    acceptanceComparison: options.register ? "registered" : "raw",
    thresholds: {
      pixelTolerance: DEFAULT_PIXEL_TOLERANCE,
      changedRatioTolerance: DEFAULT_CHANGED_RATIO_TOLERANCE,
      meanAbsoluteTolerance: DEFAULT_MEAN_ABSOLUTE_TOLERANCE
    },
    cases
  };
  await writeFile(path.join(outputRoot, "diff", "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeExampleComparisonPage(outputRoot, renderSummary, summary);
  return summary;
}

async function clearManagedDiffArtifacts(outputRoot) {
  for (const directory of ["diff", "diff-png"]) {
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

async function compareCase(outputRoot, entry, options = {}) {
  const incomplete = (status, blockers) => ({
    id: entry.id, status, accepted: false, acceptanceBlockers: blockers,
    renderFingerprint: entry.renderFingerprint || null,
    tikzkitPng: entry.tikzkitPng || null, tikztosvgPng: entry.tikztosvgPng || null, diffPng: null
  });
  if (entry.tikzkitPngStatus !== "rendered" || entry.tikztosvgPngStatus !== "rendered" || !entry.tikzkitPng || !entry.tikztosvgPng) {
    return incomplete("missing", ["Both freshly rendered PNGs are required"]);
  }

  const acceptanceBlockers = await validateRenderedCase(outputRoot, entry, options.environment, options.toolVersions);
  if (entry.renderFingerprint && acceptanceBlockers.length) return incomplete("stale", acceptanceBlockers);
  if (!entry.referenceProvenance) acceptanceBlockers.push("Reference provenance is unverified");
  else if (!entry.referenceProvenance.independentNumerics && !options.paintingOnly) {
    acceptanceBlockers.push("Dependent raw-gnuplot JS sampling: independent numerical acceptance is unavailable; use --painting-only for a limited painting comparison");
  }
  if (options.nativeReferenceRequested && (entry.mactexPngStatus !== "rendered" || !entry.mactexPng)) {
    acceptanceBlockers.push("Requested native PNG is missing");
  }

  const tikzkitPath = path.join(outputRoot, entry.tikzkitPng);
  const tikztosvgPath = path.join(outputRoot, entry.tikztosvgPng);
  let tikzkit, tikztosvg;
  try {
    tikzkit = decodePng(await readFile(tikzkitPath));
    tikztosvg = decodePng(await readFile(tikztosvgPath));
  } catch (error) {
    if (error.code === "ENOENT") return incomplete("missing", ["PNG artifact no longer exists"]);
    throw error;
  }
  const comparison = compareDecodedPngs(tikzkit, tikztosvg);
  const registration = options.register
    ? findBestPixelAlignment(tikzkit, tikztosvg, {
      radius: options.alignmentRadius,
      sampleStep: options.alignmentSampleStep
    })
    : null;
  const diffPng = path.join(outputRoot, "diff-png", `${entry.id}.png`);
  const sheetPng = path.join(outputRoot, "diff", `${entry.id}-sheet.png`);
  await writeFile(diffPng, encodePng(comparison.diff));
  await writeFile(sheetPng, encodePng(composeComparisonSheet(tikzkit, tikztosvg, comparison.diff)));
  let registeredDiffPng = null;
  if (registration) {
    const registeredDiffPath = path.join(outputRoot, "diff-png", `${entry.id}-registered.png`);
    await writeFile(registeredDiffPath, encodePng(registration.diff));
    registeredDiffPng = path.relative(outputRoot, registeredDiffPath);
  }
  let nativeSheetPng = null;
  let mactexComparison = null;
  if (entry.mactexPngStatus === "rendered" && entry.mactexPng) {
    const native = decodePng(await readFile(path.join(outputRoot, entry.mactexPng)));
    const nativeSheetPath = path.join(outputRoot, "diff", `${entry.id}-native-sheet.png`);
    await writeFile(
      nativeSheetPath,
      encodePng(composeImageSheet([native, tikztosvg, tikzkit, comparison.diff], { columns: 2, gap: 24, padding: 16 }))
    );
    nativeSheetPng = path.relative(outputRoot, nativeSheetPath);
    mactexComparison = {
      tikzkit: summarizePairComparison(tikzkit, native, options),
      tikztosvg: summarizePairComparison(tikztosvg, native, options)
    };
    const nativeStatus = (mactexComparison.tikzkit.registration || mactexComparison.tikzkit).status;
    if (nativeStatus !== "same") acceptanceBlockers.push(`Native visual comparison: ${nativeStatus}`);
  }

  if ((registration || comparison).status !== "same") acceptanceBlockers.push(`Visual comparison: ${(registration || comparison).status}`);
  return {
    id: entry.id,
    status: comparison.status,
    accepted: acceptanceBlockers.length === 0,
    acceptanceBlockers,
    renderFingerprint: entry.renderFingerprint || null,
    referenceProvenance: entry.referenceProvenance || null,
    width: comparison.width,
    height: comparison.height,
    expectedWidth: tikztosvg.width,
    expectedHeight: tikztosvg.height,
    actualWidth: tikzkit.width,
    actualHeight: tikzkit.height,
    comparedPixels: comparison.comparedPixels,
    changedPixels: comparison.changedPixels,
    changedRatio: comparison.changedRatio,
    meanAbsoluteRGBA: comparison.meanAbsoluteRGBA,
    registration: registration && {
      offsetX: registration.offsetX,
      offsetY: registration.offsetY,
      status: registration.status,
      comparedPixels: registration.comparedPixels,
      changedPixels: registration.changedPixels,
      changedRatio: registration.changedRatio,
      meanAbsoluteRGBA: registration.meanAbsoluteRGBA,
      diffPng: registeredDiffPng
    },
    tikzkitPng: entry.tikzkitPng,
    tikztosvgPng: entry.tikztosvgPng,
    diffPng: path.relative(outputRoot, diffPng),
    sheetPng: path.relative(outputRoot, sheetPng),
    nativeSheetPng,
    mactexComparison
  };
}

function summarizePairComparison(actual, expected, options) {
  const raw = compareDecodedPngs(actual, expected);
  const registration = options.register ? findBestPixelAlignment(actual, expected, {
    radius: options.alignmentRadius,
    sampleStep: options.alignmentSampleStep
  }) : null;
  return {
    status: raw.status,
    comparedPixels: raw.comparedPixels,
    changedPixels: raw.changedPixels,
    changedRatio: raw.changedRatio,
    meanAbsoluteRGBA: raw.meanAbsoluteRGBA,
    registration: registration && {
      offsetX: registration.offsetX,
      offsetY: registration.offsetY,
      status: registration.status,
      comparedPixels: registration.comparedPixels,
      changedPixels: registration.changedPixels,
      changedRatio: registration.changedRatio,
      meanAbsoluteRGBA: registration.meanAbsoluteRGBA
    }
  };
}

export function compareDecodedPngs(actual, expected, options = {}) {
  return compareDecodedPngsAtOffset(actual, expected, 0, 0, options);
}

export function findBestPixelAlignment(actual, expected, options = {}) {
  const radius = Number.isFinite(options.radius)
    ? Math.max(0, Math.round(options.radius))
    : DEFAULT_ALIGNMENT_RADIUS;
  const sampleStep = Number.isFinite(options.sampleStep)
    ? Math.max(1, Math.round(options.sampleStep))
    : DEFAULT_ALIGNMENT_SAMPLE_STEP;
  const candidateCount = Number.isFinite(options.candidateCount)
    ? Math.max(1, Math.round(options.candidateCount))
    : DEFAULT_ALIGNMENT_CANDIDATES;
  const candidates = [];
  for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      const score = scorePngOffset(actual, expected, offsetX, offsetY, { ...options, sampleStep });
      candidates.push({ ...score, offsetX, offsetY });
    }
  }
  candidates.sort(compareAlignmentScore);
  const finalists = [{ offsetX: 0, offsetY: 0 }];
  for (const candidate of candidates.slice(0, candidateCount)) {
    if (!finalists.some((entry) => entry.offsetX === candidate.offsetX && entry.offsetY === candidate.offsetY)) {
      finalists.push(candidate);
    }
  }
  const comparisons = finalists.map(({ offsetX, offsetY }) => ({
    ...compareDecodedPngsAtOffset(actual, expected, offsetX, offsetY, options),
    offsetX,
    offsetY
  }));
  const baseline = comparisons.find((comparison) => comparison.offsetX === 0 && comparison.offsetY === 0);
  const nonWorsening = comparisons.filter((comparison) =>
    comparison.meanAbsoluteRGBA <= baseline.meanAbsoluteRGBA &&
    comparison.changedRatio <= baseline.changedRatio
  );
  nonWorsening.sort(compareAlignmentScore);
  return nonWorsening[0] || baseline;
}

function compareAlignmentScore(left, right) {
  if (left.meanAbsoluteRGBA !== right.meanAbsoluteRGBA) return left.meanAbsoluteRGBA - right.meanAbsoluteRGBA;
  if (left.changedRatio !== right.changedRatio) return left.changedRatio - right.changedRatio;
  return Math.abs(left.offsetX || 0) + Math.abs(left.offsetY || 0) - Math.abs(right.offsetX || 0) - Math.abs(right.offsetY || 0);
}

function compareDecodedPngsAtOffset(actual, expected, offsetX, offsetY, options = {}) {
  const pixelTolerance = Number.isFinite(options.pixelTolerance) ? options.pixelTolerance : DEFAULT_PIXEL_TOLERANCE;
  const changedRatioTolerance = Number.isFinite(options.changedRatioTolerance)
    ? options.changedRatioTolerance
    : DEFAULT_CHANGED_RATIO_TOLERANCE;
  const meanAbsoluteTolerance = Number.isFinite(options.meanAbsoluteTolerance)
    ? options.meanAbsoluteTolerance
    : DEFAULT_MEAN_ABSOLUTE_TOLERANCE;
  const canvas = pngUnion(actual, expected, offsetX, offsetY);
  const { width, height } = canvas;
  const diffPixels = Buffer.alloc(width * height * 4);
  let changedPixels = 0;
  let totalDelta = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const actualIndex = pixelIndex(actual, canvas.x + x - offsetX, canvas.y + y - offsetY);
      const expectedIndex = pixelIndex(expected, canvas.x + x, canvas.y + y);
      const diffIndex = (y * width + x) * 4;
      let pixelDelta = 0;
      let maxChannelDelta = 0;
      for (let channel = 0; channel < 4; channel += 1) {
        const channelDelta = Math.abs(whiteChannel(actual, actualIndex, channel) - whiteChannel(expected, expectedIndex, channel));
        pixelDelta += channelDelta;
        maxChannelDelta = Math.max(maxChannelDelta, channelDelta);
      }
      if (maxChannelDelta > pixelTolerance) {
        totalDelta += pixelDelta;
        changedPixels += 1;
        diffPixels[diffIndex] = 255;
        diffPixels[diffIndex + 1] = 0;
        diffPixels[diffIndex + 2] = 0;
        diffPixels[diffIndex + 3] = 255;
      } else {
        diffPixels[diffIndex] = 255;
        diffPixels[diffIndex + 1] = 255;
        diffPixels[diffIndex + 2] = 255;
        diffPixels[diffIndex + 3] = 0;
      }
    }
  }

  const comparedPixels = width * height;
  const dimensionMismatch = actual.width !== expected.width || actual.height !== expected.height;
  // Keep the denominator independent of translation: adding blank margins
  // during registration must not dilute a real error below the threshold.
  const normalizationPixels = Math.max(actual.width, expected.width) * Math.max(actual.height, expected.height);
  const changedRatio = normalizationPixels ? changedPixels / normalizationPixels : 0;
  const meanAbsoluteRGBA = normalizationPixels ? totalDelta / (normalizationPixels * 4 * 255) : 0;
  const visuallySame = changedPixels === 0 || (changedRatio <= changedRatioTolerance && meanAbsoluteRGBA <= meanAbsoluteTolerance);
  return {
    status: dimensionMismatch ? "dimension-mismatch" : visuallySame ? "same" : "different",
    width,
    height,
    comparedPixels,
    normalizationPixels,
    changedPixels,
    changedRatio,
    meanAbsoluteRGBA,
    pixelTolerance,
    changedRatioTolerance,
    meanAbsoluteTolerance,
    diff: { width, height, data: diffPixels }
  };
}

function scorePngOffset(actual, expected, offsetX, offsetY, options = {}) {
  const pixelTolerance = Number.isFinite(options.pixelTolerance) ? options.pixelTolerance : DEFAULT_PIXEL_TOLERANCE;
  const sampleStep = Math.max(1, Number(options.sampleStep) || 1);
  const canvas = pngUnion(actual, expected, offsetX, offsetY);
  let changedPixels = 0;
  let comparedPixels = 0;
  let totalDelta = 0;
  for (let y = 0; y < canvas.height; y += sampleStep) {
    for (let x = 0; x < canvas.width; x += sampleStep) {
      const actualIndex = pixelIndex(actual, canvas.x + x - offsetX, canvas.y + y - offsetY);
      const expectedIndex = pixelIndex(expected, canvas.x + x, canvas.y + y);
      let pixelDelta = 0;
      let maxChannelDelta = 0;
      for (let channel = 0; channel < 4; channel += 1) {
        const channelDelta = Math.abs(whiteChannel(actual, actualIndex, channel) - whiteChannel(expected, expectedIndex, channel));
        pixelDelta += channelDelta;
        maxChannelDelta = Math.max(maxChannelDelta, channelDelta);
      }
      comparedPixels += 1;
      if (maxChannelDelta > pixelTolerance) {
        totalDelta += pixelDelta;
        changedPixels += 1;
      }
    }
  }
  return {
    comparedPixels,
    changedRatio: comparedPixels ? changedPixels / comparedPixels : 0,
    meanAbsoluteRGBA: comparedPixels ? totalDelta / (comparedPixels * 4 * 255) : 0
  };
}

function pngUnion(actual, expected, offsetX, offsetY) {
  const x = Math.min(0, offsetX);
  const y = Math.min(0, offsetY);
  return {
    x, y,
    width: Math.max(expected.width, actual.width + offsetX) - x,
    height: Math.max(expected.height, actual.height + offsetY) - y
  };
}

function pixelIndex(image, x, y) {
  return x < 0 || y < 0 || x >= image.width || y >= image.height ? -1 : (y * image.width + x) * 4;
}

function whiteChannel(image, index, channel) {
  if (index < 0 || channel === 3) return 255;
  return 255 + (image.data[index + channel] - 255) * image.data[index + 3] / 255;
}

export function decodePng(buffer) {
  if (!buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error("Invalid PNG signature");
  }

  let offset = PNG_SIGNATURE.length;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth ${bitDepth}`);
  const channels = channelsForColorType(colorType);
  const raw = inflateSync(Buffer.concat(idatChunks));
  const stride = width * channels;
  const unfiltered = Buffer.alloc(height * stride);
  let rawOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset];
    rawOffset += 1;
    const row = raw.subarray(rawOffset, rawOffset + stride);
    rawOffset += stride;
    unfilterRow(filter, row, unfiltered, y * stride, stride, channels);
  }

  return {
    width,
    height,
    data: expandToRgba(unfiltered, width, height, colorType, channels)
  };
}

export function encodePng(image) {
  const rows = [];
  for (let y = 0; y < image.height; y += 1) {
    const rowStart = y * image.width * 4;
    rows.push(Buffer.from([0]));
    rows.push(image.data.subarray(rowStart, rowStart + image.width * 4));
  }
  const ihdr = Buffer.concat([u32(image.width), u32(image.height), Buffer.from([8, 6, 0, 0, 0])]);
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(Buffer.concat(rows))),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

export function composeComparisonSheet(actual, expected, diff, options = {}) {
  return composeImageSheet([actual, expected, diff], { ...options, columns: options.columns || 3 });
}

export function composeImageSheet(panels, options = {}) {
  const gap = Number.isFinite(options.gap) ? Math.max(0, Math.round(options.gap)) : 16;
  const padding = Number.isFinite(options.padding) ? Math.max(0, Math.round(options.padding)) : 12;
  const panelStroke = options.panelStroke || [210, 218, 230, 255];
  const columns = Math.max(1, Math.min(panels.length, Math.round(options.columns || panels.length)));
  const rows = Math.ceil(panels.length / columns);
  const columnWidths = Array.from({ length: columns }, (_, column) =>
    Math.max(0, ...panels.filter((_, index) => index % columns === column).map((panel) => panel.width))
  );
  const rowHeights = Array.from({ length: rows }, (_, row) =>
    Math.max(0, ...panels.slice(row * columns, row * columns + columns).map((panel) => panel.height))
  );
  const width = columnWidths.reduce((sum, value) => sum + value, 0) + gap * Math.max(0, columns - 1) + padding * 2;
  const height = rowHeights.reduce((sum, value) => sum + value, 0) + gap * Math.max(0, rows - 1) + padding * 2;
  const data = Buffer.alloc(width * height * 4);
  fillImage(data, width, height, [255, 255, 255, 255]);

  const columnOffsets = cumulativeOffsets(columnWidths, gap, padding);
  const rowOffsets = cumulativeOffsets(rowHeights, gap, padding);
  for (let index = 0; index < panels.length; index += 1) {
    const panel = panels[index];
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = columnOffsets[column] + Math.round((columnWidths[column] - panel.width) / 2);
    const y = rowOffsets[row] + Math.round((rowHeights[row] - panel.height) / 2);
    drawPanelBorder(data, width, height, x - 1, y - 1, panel.width + 2, panel.height + 2, panelStroke);
    pasteImage(data, width, height, panel, x, y);
  }

  return { width, height, data };
}

function cumulativeOffsets(sizes, gap, padding) {
  const offsets = [];
  let offset = padding;
  for (const size of sizes) {
    offsets.push(offset);
    offset += size + gap;
  }
  return offsets;
}

export function formatExampleDiffSummary(summary) {
  return (
    `Compared ${summary.compared}/${summary.total} example PNG pairs` +
    `: ${summary.different} different, ${summary.missing} missing` +
    `, ${summary.stale || 0} stale; acceptance ${summary.accepted ? "passed" : "blocked"}` +
    ` in ${summary.outputRoot}\n`
  );
}

function channelsForColorType(colorType) {
  if (colorType === 0) return 1;
  if (colorType === 2) return 3;
  if (colorType === 4) return 2;
  if (colorType === 6) return 4;
  throw new Error(`Unsupported PNG color type ${colorType}`);
}

function unfilterRow(filter, row, output, outputOffset, stride, bytesPerPixel) {
  for (let index = 0; index < stride; index += 1) {
    const left = index >= bytesPerPixel ? output[outputOffset + index - bytesPerPixel] : 0;
    const up = outputOffset >= stride ? output[outputOffset + index - stride] : 0;
    const upLeft = outputOffset >= stride && index >= bytesPerPixel ? output[outputOffset + index - stride - bytesPerPixel] : 0;
    if (filter === 0) output[outputOffset + index] = row[index];
    else if (filter === 1) output[outputOffset + index] = (row[index] + left) & 0xff;
    else if (filter === 2) output[outputOffset + index] = (row[index] + up) & 0xff;
    else if (filter === 3) output[outputOffset + index] = (row[index] + Math.floor((left + up) / 2)) & 0xff;
    else if (filter === 4) output[outputOffset + index] = (row[index] + paeth(left, up, upLeft)) & 0xff;
    else throw new Error(`Unsupported PNG filter ${filter}`);
  }
}

function expandToRgba(source, width, height, colorType, channels) {
  const data = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const sourceIndex = index * channels;
    const targetIndex = index * 4;
    if (colorType === 0) {
      data[targetIndex] = source[sourceIndex];
      data[targetIndex + 1] = source[sourceIndex];
      data[targetIndex + 2] = source[sourceIndex];
      data[targetIndex + 3] = 255;
    } else if (colorType === 2) {
      data[targetIndex] = source[sourceIndex];
      data[targetIndex + 1] = source[sourceIndex + 1];
      data[targetIndex + 2] = source[sourceIndex + 2];
      data[targetIndex + 3] = 255;
    } else if (colorType === 4) {
      data[targetIndex] = source[sourceIndex];
      data[targetIndex + 1] = source[sourceIndex];
      data[targetIndex + 2] = source[sourceIndex];
      data[targetIndex + 3] = source[sourceIndex + 1];
    } else if (colorType === 6) {
      data[targetIndex] = source[sourceIndex];
      data[targetIndex + 1] = source[sourceIndex + 1];
      data[targetIndex + 2] = source[sourceIndex + 2];
      data[targetIndex + 3] = source[sourceIndex + 3];
    }
  }
  return data;
}

function fillImage(target, width, height, pixel) {
  for (let index = 0; index < width * height; index += 1) {
    Buffer.from(pixel).copy(target, index * 4);
  }
}

function pasteImage(target, targetWidth, targetHeight, source, offsetX, offsetY) {
  for (let y = 0; y < source.height; y += 1) {
    const targetY = offsetY + y;
    if (targetY < 0 || targetY >= targetHeight) continue;
    for (let x = 0; x < source.width; x += 1) {
      const targetX = offsetX + x;
      if (targetX < 0 || targetX >= targetWidth) continue;
      const sourceIndex = (y * source.width + x) * 4;
      const targetIndex = (targetY * targetWidth + targetX) * 4;
      blendPixel(target, targetIndex, source.data, sourceIndex);
    }
  }
}

function blendPixel(target, targetIndex, source, sourceIndex) {
  const alpha = source[sourceIndex + 3] / 255;
  if (alpha >= 1) {
    source.copy(target, targetIndex, sourceIndex, sourceIndex + 4);
    return;
  }
  for (let channel = 0; channel < 3; channel += 1) {
    target[targetIndex + channel] = Math.round(source[sourceIndex + channel] * alpha + target[targetIndex + channel] * (1 - alpha));
  }
  target[targetIndex + 3] = 255;
}

function drawPanelBorder(target, width, height, x, y, borderWidth, borderHeight, pixel) {
  for (let dx = 0; dx < borderWidth; dx += 1) {
    setPixel(target, width, height, x + dx, y, pixel);
    setPixel(target, width, height, x + dx, y + borderHeight - 1, pixel);
  }
  for (let dy = 0; dy < borderHeight; dy += 1) {
    setPixel(target, width, height, x, y + dy, pixel);
    setPixel(target, width, height, x + borderWidth - 1, y + dy, pixel);
  }
}

function setPixel(target, width, height, x, y, pixel) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  Buffer.from(pixel).copy(target, (y * width + x) * 4);
}

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  return Buffer.concat([u32(data.length), typeBuffer, data, u32(crc32(Buffer.concat([typeBuffer, data])) >>> 0)]);
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write("Usage: node scripts/diff-example-pngs.js [--output <directory>] [--strict] [--register] [--alignment-radius <pixels>] [--painting-only]\n\n--strict exits 1 for empty, missing, stale, different, unverified or dependent-reference comparisons. Without it, the command writes a report only. Per-channel tolerance: 6/255; changed-pixel ratio: 0.005; mean absolute RGBA: 0.001. Dimensions must match. --register uses union-canvas alignment for acceptance while retaining the raw comparison. --painting-only explicitly excludes independent numerical validation from acceptance. Legacy render summaries must be regenerated.\n");
    return;
  }
  const options = parseArgs(argv);
  const summary = await compareExamplePngs(options);
  process.stdout.write(formatExampleDiffSummary(summary));
  if (options.strict && !summary.accepted) process.exitCode = 1;
}

function parseArgs(argv) {
  return {
    outputRoot: valueAfter(argv, "--output") || DEFAULT_OUTPUT_ROOT,
    register: argv.includes("--register"),
    strict: argv.includes("--strict"),
    paintingOnly: argv.includes("--painting-only"),
    alignmentRadius: valueAfter(argv, "--alignment-radius") === undefined ? undefined : Number(valueAfter(argv, "--alignment-radius"))
  };
}

function valueAfter(args, flag) {
  const index = args.findIndex((arg) => arg === flag);
  return index >= 0 ? args[index + 1] : undefined;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
