import {
  SCRATCH_FIXTURE_ID,
  createRequestGate,
  createScratchFixture,
  createScratchSource,
  filterFixtures,
  isFixtureDraft,
  renderWorkbenchSource,
  sourceOffsetForLocation,
  svgDownloadName
} from "./workbench.js";
import { withQaGrid } from "./qaGrid.js";

const DRAFT_PREFIX = "tikzkit.workbench.draft.v1:";
const GRID_STORAGE_KEY = "tikzkit.workbench.grid.v1";
const state = {
  fixtures: [],
  active: null,
  originalSource: "",
  lastRenderedSource: "",
  lastSvg: "",
  previewIsStale: false,
  resources: new Map()
};
const requestGate = createRequestGate();

async function loadFixture(id) {
  const token = requestGate.next();
  const fixture = state.fixtures.find((entry) => entry.id === id) || state.fixtures[0];
  if (!fixture) return;

  const source = fixture.isScratch
    ? createScratchSource()
    : await fetch(fixture.sourceUrl).then(async (response) => {
      if (!response.ok) throw new Error(`Could not load ${fixture.id}`);
      return response.text();
    });
  const resourceRows = await Promise.all((fixture.resources || []).map(loadFixtureResource));
  if (!requestGate.isCurrent(token)) return;

  state.active = fixture;
  state.originalSource = source;
  state.lastRenderedSource = readDraft(fixture.id) ?? source;
  state.previewIsStale = false;
  state.resources = new Map(resourceRows);
  document.querySelector("#fixture-select").value = fixture.id;
  document.querySelector("#source-editor").value = state.lastRenderedSource;
  history.replaceState(null, "", `#${encodeURIComponent(fixture.id)}`);

  showFixtureDetails();
  showReference();
  updateDraftStatus();

  await renderCurrentSource(token);
}

async function renderCurrentSource(token = requestGate.current()) {
  const button = document.querySelector("#render-button");
  button.disabled = true;
  const source = document.querySelector("#source-editor").value;
  const activeFigureId = state.active?.activeFigureId || undefined;
  try {
    const result = await renderWorkbenchSource(source, {
      activeFigureId,
      pgfplotsTableResolver: (file) => {
        const resource = state.resources.get(normalizeResourceName(file));
        return typeof resource === "string" ? resource : undefined;
      },
      imageResolver: (file) => {
        const resource = state.resources.get(normalizeResourceName(file));
        return resource && typeof resource === "object" ? resource : undefined;
      }
    });
    if (!requestGate.isCurrent(token)) return;

    state.lastSvg = result.svg;
    state.lastRenderedSource = source;
    state.previewIsStale = false;
    showTikzkitSvg(result.svg);
    showDiagnostics(result.diagnostics);
    updateDraftStatus();
    setRenderStatus(`${result.elapsedMs}ms · ${result.diagnostics.length} diagnostics`);
  } finally {
    if (requestGate.isCurrent(token)) button.disabled = false;
  }
}

async function loadFixtureResource(resource) {
  const response = await fetch(resource.url);
  if (!response.ok) throw new Error(`Could not load fixture resource ${resource.name}`);
  const name = normalizeResourceName(resource.name);
  if (!/\.(?:png|jpe?g|gif|webp)$/i.test(name)) return [name, await response.text()];

  const href = await blobToDataUrl(await response.blob());
  const dimensions = await loadImageDimensions(href);
  return [name, { href, ...dimensions }];
}

function normalizeResourceName(value) {
  return String(value || "").trim().replace(/^\.\//, "").replaceAll("\\", "/");
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")), { once: true });
    reader.addEventListener("error", () => reject(reader.error), { once: true });
    reader.readAsDataURL(blob);
  });
}

function loadImageDimensions(href) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve({ naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight }), { once: true });
    image.addEventListener("error", () => reject(new Error("Could not decode fixture image")), { once: true });
    image.src = href;
  });
}

function showTikzkitSvg(svg) {
  const enabled = document.querySelector("#grid-toggle").checked;
  const surface = document.querySelector("#tikzkit-result");
  surface.innerHTML = withQaGrid(svg, { enabled });
  surface.classList.toggle("is-stale", state.previewIsStale);
  document.querySelector("#tikzkit-heading").textContent = enabled
    ? "TikZKit browser SVG + 1cm grid"
    : "TikZKit browser SVG";
  updateExportButtons();
}

function showReference() {
  const reference = document.querySelector("#reference-result");
  const empty = document.querySelector("#reference-empty");
  const enabled = document.querySelector("#grid-toggle").checked;
  const referenceUrl = enabled
    ? state.active?.tikztosvgGridSvgUrl || state.active?.tikztosvgSvgUrl
    : state.active?.tikztosvgSvgUrl || state.active?.tikztosvgGridSvgUrl;
  const heading = document.querySelector("#reference-heading");
  heading.textContent = enabled ? "tikztosvg reference + 1cm grid" : "tikztosvg reference";
  if (referenceUrl) {
    reference.hidden = false;
    reference.data = referenceUrl;
    empty.hidden = true;
    empty.textContent = "";
  } else {
    reference.hidden = true;
    reference.removeAttribute("data");
    empty.hidden = false;
    empty.textContent = state.active?.isScratch
      ? "Scratch sources have no reference artifact."
      : "Reference artifact has not been generated yet.";
  }
}

function showDiagnostics(rows) {
  const container = document.querySelector("#diagnostics");
  container.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "diagnostic-empty";
    empty.textContent = "No diagnostics";
    container.append(empty);
    return;
  }

  for (const row of rows) {
    const item = document.createElement(row.location ? "button" : "div");
    item.className = `diagnostic diagnostic-${row.severity}`;
    if (row.location) {
      item.type = "button";
      item.title = `Jump to ${row.location}`;
      item.addEventListener("click", () => focusDiagnostic(row.location));
    }
    const heading = document.createElement("strong");
    heading.textContent = `${row.severity} · ${row.code}${row.location ? ` · ${row.location}` : ""}`;
    const message = document.createElement("span");
    message.textContent = row.message;
    item.append(heading, message);
    container.append(item);
  }
}

function focusDiagnostic(location) {
  const editor = document.querySelector("#source-editor");
  const offset = sourceOffsetForLocation(editor.value, location);
  if (offset === null) return;
  editor.focus();
  editor.setSelectionRange(offset, offset);
  const lineHeight = Number.parseFloat(getComputedStyle(editor).lineHeight) || 20;
  const line = Number(location.split(":")[0]) || 1;
  editor.scrollTop = Math.max(0, (line - 3) * lineHeight);
}

function showFixtureDetails() {
  const fixture = state.active;
  document.querySelector("#fixture-title").textContent = fixture?.title || "TikZ source";
  const features = fixture?.features?.length ? fixture.features.join(" · ") : "ad hoc source";
  document.querySelector("#fixture-summary").textContent = `${fixture?.id || "scratch"} · ${features}`;
}

function updateDraftStatus() {
  const editor = document.querySelector("#source-editor");
  const modified = isFixtureDraft(editor.value, state.originalSource);
  const stale = state.previewIsStale;
  const status = document.querySelector("#draft-status");
  const reset = document.querySelector("#reset-source-button");
  reset.disabled = !modified;
  status.textContent = stale ? "Draft changed · render to refresh" : modified ? "Local draft saved" : "Fixture source";
  status.classList.toggle("is-draft", modified);
  status.classList.toggle("is-stale", stale);
}

function setRenderStatus(message) {
  document.querySelector("#render-status").textContent = message;
}

function updateExportButtons() {
  const disabled = !state.lastSvg;
  document.querySelector("#copy-svg-button").disabled = disabled;
  document.querySelector("#download-svg-button").disabled = disabled;
}

function rememberDraft() {
  if (!state.active) return;
  const editor = document.querySelector("#source-editor");
  if (isFixtureDraft(editor.value, state.originalSource)) {
    writeDraft(state.active.id, editor.value);
  } else {
    removeDraft(state.active.id);
  }
  state.previewIsStale = editor.value !== state.lastRenderedSource;
  document.querySelector("#tikzkit-result").classList.toggle("is-stale", state.previewIsStale);
  updateDraftStatus();
}

async function resetSource() {
  if (!state.active) return;
  const editor = document.querySelector("#source-editor");
  if (isFixtureDraft(editor.value, state.originalSource) && !window.confirm("Discard this locally saved draft and restore the fixture source?")) {
    return;
  }
  removeDraft(state.active.id);
  editor.value = state.originalSource;
  state.previewIsStale = editor.value !== state.lastRenderedSource;
  updateDraftStatus();
  await renderCurrentSource();
}

async function startNewSource() {
  removeDraft(SCRATCH_FIXTURE_ID);
  document.querySelector("#fixture-filter").value = "";
  refreshFixtureOptions();
  await loadFixture(SCRATCH_FIXTURE_ID);
}

async function copySvg() {
  if (!state.lastSvg) return;
  try {
    await navigator.clipboard.writeText(state.lastSvg);
    setRenderStatus("SVG copied to clipboard");
  } catch {
    const fallback = document.createElement("textarea");
    fallback.value = state.lastSvg;
    fallback.setAttribute("readonly", "");
    fallback.style.position = "fixed";
    fallback.style.opacity = "0";
    document.body.append(fallback);
    fallback.select();
    document.execCommand("copy");
    fallback.remove();
    setRenderStatus("SVG copied to clipboard");
  }
}

function downloadSvg() {
  if (!state.lastSvg) return;
  const blob = new Blob([state.lastSvg], { type: "image/svg+xml;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = svgDownloadName(state.active?.id);
  anchor.click();
  URL.revokeObjectURL(href);
}

function readDraft(id) {
  try {
    return localStorage.getItem(`${DRAFT_PREFIX}${id}`);
  } catch {
    return null;
  }
}

function writeDraft(id, source) {
  try {
    localStorage.setItem(`${DRAFT_PREFIX}${id}`, source);
  } catch {
    setRenderStatus("Draft could not be saved in this browser");
  }
}

function removeDraft(id) {
  try {
    localStorage.removeItem(`${DRAFT_PREFIX}${id}`);
  } catch {
    // Browser privacy mode can make local storage unavailable.
  }
}

function applyGridPreference() {
  try {
    const saved = localStorage.getItem(GRID_STORAGE_KEY);
    if (saved !== null) document.querySelector("#grid-toggle").checked = saved === "true";
  } catch {
    // Keep the checked HTML default when browser storage is unavailable.
  }
}

function rememberGridPreference() {
  try {
    localStorage.setItem(GRID_STORAGE_KEY, String(document.querySelector("#grid-toggle").checked));
  } catch {
    // The grid still works for the current browser session.
  }
}

function refreshFixtureOptions() {
  const select = document.querySelector("#fixture-select");
  const query = document.querySelector("#fixture-filter").value;
  const matches = filterFixtures(state.fixtures, query);
  const activeId = state.active?.id;
  const active = state.fixtures.find((fixture) => fixture.id === activeId);
  const activeIsFilteredOut = Boolean(active && !matches.some((fixture) => fixture.id === active.id));
  const choices = activeIsFilteredOut ? [active, ...matches] : matches;
  select.replaceChildren();
  for (const fixture of choices) {
    const option = document.createElement("option");
    option.value = fixture.id;
    option.textContent = `${fixture.id} · ${fixture.title}${activeIsFilteredOut && fixture.id === activeId ? " (current)" : ""}`;
    select.append(option);
  }
  if (activeId && choices.some((fixture) => fixture.id === activeId)) select.value = activeId;
  if (!choices.length) setRenderStatus("No cases match this filter");
}

async function boot() {
  const fixtures = await fetch("/api/fixtures").then((response) => response.json());
  state.fixtures = [createScratchFixture(), ...fixtures];
  applyGridPreference();
  refreshFixtureOptions();

  const select = document.querySelector("#fixture-select");
  select.addEventListener("change", () => loadFixture(select.value));
  document.querySelector("#fixture-filter").addEventListener("input", refreshFixtureOptions);
  document.querySelector("#new-source-button").addEventListener("click", startNewSource);
  document.querySelector("#render-button").addEventListener("click", () => renderCurrentSource());
  document.querySelector("#reset-source-button").addEventListener("click", resetSource);
  document.querySelector("#copy-svg-button").addEventListener("click", copySvg);
  document.querySelector("#download-svg-button").addEventListener("click", downloadSvg);
  document.querySelector("#grid-toggle").addEventListener("change", () => {
    rememberGridPreference();
    if (state.lastSvg) showTikzkitSvg(state.lastSvg);
    showReference();
  });
  document.querySelector("#source-editor").addEventListener("input", rememberDraft);
  document.querySelector("#source-editor").addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      renderCurrentSource();
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      rememberDraft();
      setRenderStatus("Draft saved locally");
    }
  });

  const requested = decodeURIComponent(location.hash.replace(/^#/, "")) || state.fixtures[1]?.id;
  await loadFixture(requested);
}

boot().catch((error) => {
  document.querySelector("#render-status").textContent = error.message;
});
