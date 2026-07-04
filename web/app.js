import { findTikzCaseIndexByHash, parseTikzCasesMarkdown } from "./cases-md.js";
import { inferSvgGridStep, parseViewBoxWidth, svgPhysicalWidthPx } from "./svg-display-scale.js";

const caseSelect = document.querySelector("#case-select");
const sourceInput = document.querySelector("#source-input");
const renderButton = document.querySelector("#render-button");
const preview = document.querySelector("#preview");
const diagnostics = document.querySelector("#diagnostics");
const statusLine = document.querySelector("#status-line");
const caseTitle = document.querySelector("#case-title");
const previewPane = document.querySelector(".preview-pane");
const outputArtifacts = document.querySelector("#output-artifacts");
const lineNumbers = document.querySelector("#line-numbers");

let cases = [];
let activeCase = null;

async function boot() {
  const markdown = await fetch("/web/cases.md", { cache: "no-store" }).then((response) => response.text());
  cases = parseTikzCasesMarkdown(markdown);
  caseSelect.replaceChildren(
    ...cases.map((item, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${item.id} - ${item.title}`;
      return option;
    })
  );

  const hashIndex = findTikzCaseIndexByHash(cases, window.location.hash);
  if (hashIndex >= 0) caseSelect.value = String(hashIndex);

  caseSelect.addEventListener("change", () => loadSelectedCase({ updateHash: true }));
  window.addEventListener("hashchange", loadCaseFromHash);
  renderButton.addEventListener("click", render);
  sourceInput.addEventListener("input", () => {
    updateLineNumbers();
    statusLine.textContent = "edited";
  });
  sourceInput.addEventListener("scroll", syncLineNumberScroll);

  loadSelectedCase({ updateHash: false });
}

function loadCaseFromHash() {
  const index = findTikzCaseIndexByHash(cases, window.location.hash);
  if (index < 0 || caseSelect.value === String(index)) return;
  caseSelect.value = String(index);
  loadSelectedCase({ updateHash: false });
}

function loadSelectedCase(options = {}) {
  const item = cases[Number(caseSelect.value) || 0] || cases[0];
  activeCase = item || null;
  sourceInput.value = item?.source?.trim() || "";
  caseTitle.textContent = item ? `${item.id} - ${item.title}` : "No case";
  document.body.dataset.activeCase = item?.id || "";
  if (previewPane) {
    if (item?.id) {
      previewPane.id = item.id;
    } else {
      previewPane.removeAttribute("id");
    }
  }
  if (options.updateHash && item?.id && window.location.hash !== `#${item.id}`) {
    history.replaceState(null, "", `#${item.id}`);
  }
  updateLineNumbers();
  renderArtifacts(item);
  render();
}

async function render() {
  const source = sourceInput.value;
  const startedAt = performance.now();
  renderButton.disabled = true;
  renderButton.textContent = "Rendering...";
  statusLine.textContent = "rendering";
  try {
    const response = await fetch("/api/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source })
    });
    const result = await response.json();
    if (!response.ok || result.error) throw new Error(result.error || `HTTP ${response.status}`);
    const elapsed = Math.round(performance.now() - startedAt);

    await renderComparison(result, activeCase);
    diagnostics.replaceChildren(...renderDiagnostics(result.diagnostics || []));
    statusLine.textContent = `${(result.diagnostics || []).length} diagnostics · ${elapsed}ms`;
  } catch (error) {
    preview.innerHTML = `<div class="error-state">Render failed</div>`;
    diagnostics.replaceChildren(renderDiagnostic("error", error instanceof Error ? error.message : String(error)));
    statusLine.textContent = "render failed";
  } finally {
    renderButton.disabled = false;
    renderButton.textContent = "Render";
  }
}

function renderArtifacts(item) {
  outputArtifacts.replaceChildren();
  if (!item) return;
  const paths = [
    ["TikZKit JS SVG", `/web/output/${item.id}/js-grid.svg`],
    ["tikztosvg SVG", `/web/output/${item.id}/tikztosvg-grid.svg`],
    ["TikZKit normalized PNG", `/web/output/${item.id}/js-normalized.png`],
    ["tikztosvg normalized PNG", `/web/output/${item.id}/tikztosvg-normalized.png`],
    ["PNG diff", `/web/output/${item.id}/image-diff.png`],
    ["Aligned PNG diff", `/web/output/${item.id}/image-diff-aligned.png`]
  ];
  for (const [label, href] of paths) {
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = label;
    outputArtifacts.append(link);
  }
}

async function renderComparison(result, item) {
  const grid = document.createElement("div");
  grid.className = "compare-grid";
  grid.append(createSvgPane("TikZKit JS SVG live + 1cm grid", result.gridSvg || result.svg));
  grid.append(
    item
      ? await createFetchedSvgPane("tikztosvg SVG + 1cm grid", `/web/output/${item.id}/tikztosvg-grid.svg`)
      : createEmptyPane("tikztosvg SVG + 1cm grid", "No selected case")
  );

  preview.replaceChildren(grid);
}

async function createFetchedSvgPane(title, href) {
  try {
    const response = await fetch(href, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return createSvgPane(title, await response.text());
  } catch (error) {
    return createEmptyPane(title, `${href} not generated`);
  }
}

function createSvgPane(title, svg) {
  const pane = createComparePane(title);
  const surface = pane.querySelector(".compare-surface");
  surface.innerHTML = svg || `<div class="empty-state">No SVG</div>`;
  normalizeSvgPhysicalScale(surface);
  return pane;
}

function normalizeSvgPhysicalScale(surface) {
  const svg = [...surface.children].find((child) => child.tagName?.toLowerCase() === "svg");
  if (!svg) return;
  const viewBoxWidth = parseViewBoxWidth(svg.getAttribute("viewBox"));
  const gridStep = inferSvgGridStep(svg.outerHTML);
  const widthPx = svgPhysicalWidthPx(viewBoxWidth, gridStep);
  if (!widthPx) return;
  svg.dataset.physicalScale = "true";
  svg.style.width = `${widthPx.toFixed(3)}px`;
  svg.style.height = "auto";
}

function createImagePane(title, src) {
  const pane = createComparePane(title);
  const surface = pane.querySelector(".compare-surface");
  const image = document.createElement("img");
  image.alt = title;
  image.loading = "lazy";
  image.src = src;
  image.addEventListener("error", () => {
    surface.replaceChildren(createEmptyMessage(`${src} not generated`));
  }, { once: true });
  surface.append(image);
  return pane;
}

function createEmptyPane(title, message) {
  const pane = createComparePane(title);
  pane.querySelector(".compare-surface").append(createEmptyMessage(message));
  return pane;
}

function createComparePane(title) {
  const pane = document.createElement("section");
  pane.className = "compare-pane";
  const heading = document.createElement("div");
  heading.className = "compare-heading";
  heading.textContent = title;
  const surface = document.createElement("div");
  surface.className = "compare-surface";
  pane.append(heading, surface);
  return pane;
}

function createEmptyMessage(message) {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = message;
  return empty;
}

function renderDiagnostics(items) {
  if (!items.length) {
    const ok = document.createElement("div");
    ok.className = "diagnostic ok";
    ok.textContent = "Rendered without diagnostics";
    return [ok];
  }
  return items.map((item) => {
    return renderDiagnostic(item.severity || "warning", item.message);
  });
}

function renderDiagnostic(severity, message) {
  const row = document.createElement("div");
  row.className = `diagnostic ${severity}`;
  row.textContent = `${severity}: ${message}`;
  return row;
}

function updateLineNumbers() {
  const count = Math.max(1, sourceInput.value.split("\n").length);
  lineNumbers.textContent = Array.from({ length: count }, (_, index) => String(index + 1)).join("\n");
  syncLineNumberScroll();
}

function syncLineNumberScroll() {
  lineNumbers.scrollTop = sourceInput.scrollTop;
}

boot().catch((error) => {
  diagnostics.textContent = `Failed to load web/cases.md: ${error instanceof Error ? error.message : String(error)}`;
});
