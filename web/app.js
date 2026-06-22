import { splitTikzCodeBlocks, tikzToSvg } from "../src/index.js";
import { withGalleryDebugGrid } from "../scripts/gallery-debug-grid.js";
import { buildCaseInsights, diffSeverity } from "./gallery-analysis.js";
import { createEmptyGalleryReportIndexes, createGalleryReportIndexes, reportForCase } from "./gallery-report-matching.js";
import { createSampleGallery } from "./sample-gallery.js";
import { REAL_GALLERY_CASES } from "./real-gallery-data.js";

const sample = createSampleGallery();
let galleryReports = createEmptyGalleryReportIndexes();

const input = document.querySelector("#source-input");
const preview = document.querySelector("#preview");
const renderButton = document.querySelector("#render-button");
const resetButton = document.querySelector("#reset-button");
const strictMode = document.querySelector("#strict-mode");
const sourceCount = document.querySelector("#source-count");
const statusLine = document.querySelector("#status-line");
const resultsViewButton = document.querySelector("#results-view-button");
const sourceViewButton = document.querySelector("#source-view-button");
const workspace = document.querySelector(".workspace");

input.value = sample;
renderButton.addEventListener("click", renderEditor);
resetButton.addEventListener("click", () => {
  input.value = sample;
  renderEditor();
});
input.addEventListener("input", debounce(renderEditor, 180));
strictMode.addEventListener("change", renderEditor);
resultsViewButton.addEventListener("click", () => setWorkspaceView("results"));
sourceViewButton.addEventListener("click", () => setWorkspaceView("source"));
preview.addEventListener("click", handlePreviewClick);

setWorkspaceView("results");
renderEditor();
loadGalleryReports();
renderTikzBlocks(document);

export function renderTikzBlocks(root = document, options = {}) {
  const blocks = root.querySelectorAll("pre code.language-tikz, pre code.tikz, pre code[class*='language-tikz']");
  for (const block of blocks) {
    const pre = block.closest("pre");
    if (!pre || pre.dataset.tikzRendered === "true") continue;
    const figure = renderTikzFigure(block.textContent, options);
    pre.replaceWith(figure);
  }
}

function renderEditor() {
  const parts = splitTikzCodeBlocks(input.value);
  const tikzCount = parts.filter((part) => part.type === "tikz").length;
  let tikzIndex = 0;
  sourceCount.textContent = `${tikzCount} block${tikzCount === 1 ? "" : "s"}`;
  preview.replaceChildren(
    ...parts.map((part) => {
      if (part.type !== "tikz") return renderPart(part);
      tikzIndex += 1;
      const galleryCase = REAL_GALLERY_CASES[tikzIndex - 1];
      return renderTikzFigure(part.content, {
        strict: strictMode.checked,
        galleryReport: reportForCase(tikzIndex, galleryCase, galleryReports),
        caseId: String(tikzIndex).padStart(3, "0")
      });
    })
  );
  const totalDiagnostics = [...preview.querySelectorAll(".tikz-figure")].reduce(
    (sum, figure) => sum + Number(figure.dataset.diagnosticsCount || 0),
    0
  );
  statusLine.textContent = `${tikzCount} rendered · ${totalDiagnostics} diagnostics${formatOverallDiffStatus(tikzCount)}`;
}

function renderPart(part) {
  if (part.type === "tikz") return renderTikzFigure(part.content, { strict: strictMode.checked });
  const section = document.createElement("section");
  section.className = "text-part";
  section.innerHTML = renderText(part.content);
  return section;
}

function renderTikzFigure(source, options = {}) {
  const figure = document.createElement("figure");
  figure.className = "tikz-figure";
  if (options.caseId) figure.dataset.caseId = options.caseId;

  const renderSource = options.debugGrid === false ? source : withGalleryDebugGrid(source);
  const result = tikzToSvg(renderSource, options);
  figure.dataset.diagnosticsCount = String(result.diagnostics.length);
  const hasBlockingDiagnostic =
    options.strict && result.diagnostics.some((diagnostic) => diagnostic.severity === "warning" || diagnostic.severity === "error");

  const surface = createCaseViewer(source, result, options.galleryReport, {
    blocked: hasBlockingDiagnostic,
    caseId: options.caseId
  });

  const caption = document.createElement("figcaption");
  caption.append(createDiagnostics(result.diagnostics, options.galleryReport));

  figure.append(surface, caption);
  return figure;
}

function createCaseViewer(source, result, galleryReport = {}, options = {}) {
  const viewer = document.createElement("div");
  viewer.className = "case-viewer";
  viewer.dataset.activeView = "compare";

  const toolbar = document.createElement("div");
  toolbar.className = "case-toolbar";
  for (const [view, label] of [
    ["compare", "对比"],
    ["render", "JS 渲染"],
    ["native", "Native"],
    ["diff", "Diff"],
    ["source", "源码"],
    ["analysis", "分析"]
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `case-tab${view === "compare" ? " active" : ""}`;
    button.dataset.view = view;
    button.textContent = label;
    toolbar.append(button);
  }

  const panels = document.createElement("div");
  panels.className = "case-panels";
  panels.append(
    panel("compare", createComparePanel(result, galleryReport, options), true),
    panel("render", createRenderPanel(result, options)),
    panel("native", createImagePanel("MacTeX native PNG", galleryReport.native?.pngPath)),
    panel("diff", createImagePanel("Pixel diff heatmap", galleryReport.diff?.diffPath)),
    panel("source", createSourcePanel(source)),
    panel("analysis", createAnalysisPanel(source, result.diagnostics, galleryReport))
  );

  viewer.append(toolbar, panels);
  return viewer;
}

function panel(view, child, active = false) {
  const wrapper = document.createElement("div");
  wrapper.className = `case-panel${active ? " active" : ""}`;
  wrapper.dataset.view = view;
  wrapper.append(child);
  return wrapper;
}

function createComparePanel(result, galleryReport, options = {}) {
  const grid = document.createElement("div");
  grid.className = "compare-grid";
  grid.append(
    comparePane("JS SVG", createRenderPanel(result, options)),
    comparePane("MacTeX PNG", createImagePanel("MacTeX native PNG", galleryReport.native?.pngPath))
  );
  return grid;
}

function comparePane(title, child) {
  const pane = document.createElement("section");
  pane.className = "compare-pane";
  const heading = document.createElement("div");
  heading.className = "compare-heading";
  heading.textContent = title;
  pane.append(heading, child);
  return pane;
}

function createRenderPanel(result, options = {}) {
  const surface = document.createElement("div");
  surface.className = "svg-surface";
  if (options.blocked) {
    surface.innerHTML = `<div class="error-state">Strict mode stopped this block.</div>`;
  } else {
    surface.innerHTML = result.svg;
  }
  return surface;
}

function createImagePanel(title, path) {
  const surface = document.createElement("div");
  surface.className = "image-surface";
  if (!path) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = `${title} not generated`;
    surface.append(empty);
    return surface;
  }
  const image = document.createElement("img");
  image.alt = title;
  image.loading = "lazy";
  image.src = `/${path}`;
  surface.append(image);
  return surface;
}

function createSourcePanel(source) {
  const pre = document.createElement("pre");
  pre.className = "source-panel";
  const code = document.createElement("code");
  code.textContent = source.trim();
  pre.append(code);
  return pre;
}

function createAnalysisPanel(source, diagnostics, galleryReport = {}) {
  const insights = buildCaseInsights(source, diagnostics, galleryReport.diff, galleryReport.native);
  const wrapper = document.createElement("div");
  wrapper.className = `analysis-panel severity-${insights.severity}`;

  const recommendation = document.createElement("p");
  recommendation.className = "analysis-recommendation";
  recommendation.textContent = insights.recommendation;
  wrapper.append(recommendation);
  wrapper.append(createUnitMetricsPanel(galleryReport.diff?.unit));

  const list = document.createElement("div");
  list.className = "capability-list";
  if (insights.capabilities.length === 0) {
    const empty = document.createElement("div");
    empty.className = "capability-item";
    empty.textContent = "没有扫描到明显高阶宏；优先比较节点尺寸、字体、线宽和坐标缩放。";
    list.append(empty);
  } else {
    for (const item of insights.capabilities) {
      const entry = document.createElement("div");
      entry.className = `capability-item ${item.status}`;
      const title = document.createElement("strong");
      title.textContent = `${item.command} · ${formatCapabilityStatus(item.status)}`;
      const note = document.createElement("span");
      note.textContent = item.note;
      entry.append(title, note);
      list.append(entry);
    }
  }
  wrapper.append(list);
  return wrapper;
}

function createDiagnostics(diagnostics, galleryReport = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = "diagnostics-panel";

  const meta = document.createElement("div");
  meta.className = "figure-status";
  meta.append(
    statusPill(`${diagnostics.length} diagnostics`, diagnostics.length ? "error" : "ok"),
    statusPill(formatNativeStatus(galleryReport.native), nativeStatusKind(galleryReport.native)),
    statusPill(formatDiffStatus(galleryReport.diff), diffStatusKind(galleryReport.diff)),
    statusPill(formatUnitStatus(galleryReport.diff), unitStatusKind(galleryReport.diff))
  );
  wrapper.append(meta);

  const list = document.createElement("div");
  list.className = diagnostics.length ? "diagnostics" : "diagnostics empty";
  if (diagnostics.length === 0) {
    list.textContent = "Rendered without diagnostics";
    wrapper.append(list);
    return wrapper;
  }
  for (const diagnostic of diagnostics) {
    const item = document.createElement("div");
    item.className = `diagnostic ${diagnostic.severity}`;
    item.textContent = `${diagnostic.severity}: ${diagnostic.message}`;
    list.append(item);
  }
  wrapper.append(list);
  return wrapper;
}

async function loadGalleryReports() {
  try {
    const [diffRows, nativeRows] = await Promise.all([
      fetchJson("/outputs/real-gallery/diff/report.json"),
      fetchJson("/outputs/real-gallery/native/report.json")
    ]);
    galleryReports = createGalleryReportIndexes(diffRows, nativeRows);
  } catch (error) {
    galleryReports = createEmptyGalleryReportIndexes(error instanceof Error ? error.message : String(error));
  }
  renderEditor();
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;
  return response.json();
}

function statusPill(text, kind) {
  const pill = document.createElement("span");
  pill.className = `status-pill ${kind}`;
  pill.textContent = text;
  return pill;
}

function nativeStatusKind(row) {
  if (!row) return galleryReports.loaded ? "missing" : "pending";
  return row.ok ? "ok" : "error";
}

function diffStatusKind(row) {
  if (!row) return galleryReports.loaded ? "missing" : "pending";
  return row.ok ? "ok" : "error";
}

function unitStatusKind(row) {
  if (!row) return galleryReports.loaded ? "missing" : "pending";
  return row.unit ? "info" : "missing";
}

function formatNativeStatus(row) {
  if (!row) return galleryReports.loaded ? "native PNG missing" : "native PNG pending";
  if (!row.ok) return "native PNG failed";
  const fallbacks = row.assetFallbacks?.length ? ` · fallback ${row.assetFallbacks.join(", ")}` : "";
  return `native PNG ok${fallbacks}`;
}

function formatDiffStatus(row) {
  if (!row) return galleryReports.loaded ? "native diff missing" : "native diff pending";
  if (row.reason) return `native diff ${row.reason}`;
  const changed = formatPercent(row.changedPixelsRatio);
  const mean = Number.isFinite(row.meanAbsDiff) ? row.meanAbsDiff.toFixed(4) : "n/a";
  return `native diff ${row.ok ? "pass" : "fail"} · changed ${changed} · mean ${mean}`;
}

function formatUnitStatus(row) {
  if (!row) return galleryReports.loaded ? "unit scale missing" : "unit scale pending";
  if (!row.unit) return "unit scale missing";
  const unit = row.unit;
  return `unit ${unit.step || "1cm"} · JS ${formatPx(unit.jsSvgPxPerXUnit)}px · native ${formatPx(unit.nativeRasterPxPerXUnit)}px`;
}

function createUnitMetricsPanel(unit) {
  const panel = document.createElement("div");
  panel.className = "unit-metrics";
  const title = document.createElement("strong");
  title.textContent = "单位标尺";
  const detail = document.createElement("span");
  if (!unit) {
    detail.textContent = "还没有生成单位长度报告；重新运行 gallery:js 和 gallery:diff 后会显示每个 case 的 1cm 对比尺度。";
  } else {
    detail.textContent = [
      `${unit.step || "1cm"}: JS ${formatPx(unit.jsSvgPxPerXUnit)}px/${formatPx(unit.jsSvgPxPerYUnit)}px`,
      `MacTeX @${unit.nativeRasterDpi || 144}dpi ${formatPx(unit.nativeRasterPxPerXUnit)}px/${formatPx(unit.nativeRasterPxPerYUnit)}px`,
      `对齐后 x/y ${formatPx(unit.compareJsPxPerXUnit)}:${formatPx(unit.compareNativePxPerXUnit)} / ${formatPx(unit.compareJsPxPerYUnit)}:${formatPx(unit.compareNativePxPerYUnit)}`
    ].join(" · ");
  }
  panel.append(title, detail);
  return panel;
}

function formatOverallDiffStatus(tikzCount) {
  if (!galleryReports.loaded || galleryReports.diffRows.size === 0) return "";
  const rows = [...galleryReports.diffRows.values()];
  const passed = rows.filter((row) => row.ok).length;
  return ` · diff ${passed}/${Math.max(tikzCount, rows.length)} passed`;
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : "n/a";
}

function formatPx(value) {
  if (!Number.isFinite(value)) return "n/a";
  return value >= 10 ? value.toFixed(1) : value.toFixed(2);
}

function formatCapabilityStatus(status) {
  if (status === "approximated") return "已有近似";
  if (status === "partial") return "部分支持";
  return status;
}

function handlePreviewClick(event) {
  const button = event.target.closest(".case-tab");
  if (!button) return;
  const viewer = button.closest(".case-viewer");
  if (!viewer) return;
  setCaseView(viewer, button.dataset.view || "compare");
}

function setCaseView(viewer, view) {
  viewer.dataset.activeView = view;
  for (const tab of viewer.querySelectorAll(".case-tab")) {
    tab.classList.toggle("active", tab.dataset.view === view);
  }
  for (const panelElement of viewer.querySelectorAll(".case-panel")) {
    panelElement.classList.toggle("active", panelElement.dataset.view === view);
  }
}

function setWorkspaceView(view) {
  const sourceActive = view === "source";
  workspace.classList.toggle("source-visible", sourceActive);
  resultsViewButton.classList.toggle("active", !sourceActive);
  sourceViewButton.classList.toggle("active", sourceActive);
}

function renderText(text) {
  return text
    .trim()
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function debounce(fn, delay) {
  let timer = 0;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}

window.TikzRenderer = {
  renderTikzBlocks,
  tikzToSvg,
  splitTikzCodeBlocks
};
