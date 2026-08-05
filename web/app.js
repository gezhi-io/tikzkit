import {
  SCRATCH_FIXTURE_ID,
  createRequestGate,
  createScratchFixture,
  createScratchSource,
  filterFixtures,
  isFixtureDraft,
  renderWorkbenchSource,
  svgDownloadName
} from "./workbench.js";
import { createTikzEditor } from "./tikzEditor.js";
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
  audit: null,
  resources: new Map(),
  editor: null
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
  const [resourceRows, audit] = await Promise.all([
    Promise.all((fixture.resources || []).map(loadFixtureResource)),
    loadFixtureAudit(fixture)
  ]);
  if (!requestGate.isCurrent(token)) return;

  state.active = fixture;
  state.originalSource = source;
  state.lastRenderedSource = readDraft(fixture.id) ?? source;
  state.previewIsStale = false;
  state.audit = audit;
  state.resources = new Map(resourceRows);
  document.querySelector("#fixture-select").value = fixture.id;
  state.editor.setValue(state.lastRenderedSource, { silent: true });
  history.replaceState(null, "", `#${encodeURIComponent(fixture.id)}`);

  showFixtureDetails();
  showSemanticInventory();
  showReference();
  showDiagnostics([]);
  updateDraftStatus();

  await renderCurrentSource(token);
}

async function loadFixtureAudit(fixture) {
  if (fixture.isScratch) return null;
  try {
    const response = await fetch(`/api/fixtures/${encodeURIComponent(fixture.id)}/audit`);
    if (!response.ok) throw new Error(`Could not audit ${fixture.id}`);
    return response.json();
  } catch (error) {
    return { error: error.message };
  }
}

async function renderCurrentSource(token = requestGate.current()) {
  const button = document.querySelector("#render-button");
  button.disabled = true;
  const source = state.editor.getValue();
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
  state.editor?.setDiagnostics(rows);
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
  state.editor?.focusLocation(location);
}

function showFixtureDetails() {
  const fixture = state.active;
  document.querySelector("#fixture-title").textContent = fixture?.title || "TikZ source";
  const features = fixture?.features?.length ? fixture.features.join(" · ") : "ad hoc source";
  document.querySelector("#fixture-summary").textContent = `${fixture?.id || "scratch"} · ${features}`;
}

function showSemanticInventory() {
  const summary = document.querySelector("#semantic-summary");
  const container = document.querySelector("#semantic-content");
  container.replaceChildren();
  const audit = state.audit;
  if (!audit) {
    summary.textContent = "Scratch source";
    const message = document.createElement("p");
    message.className = "semantic-empty";
    message.textContent = "Select a fixture to inspect its semantic inventory.";
    container.append(message);
    return;
  }
  if (audit.error) {
    summary.textContent = "Audit unavailable";
    const message = document.createElement("p");
    message.className = "semantic-empty";
    message.textContent = audit.error;
    container.append(message);
    return;
  }

  const { summary: counts, gate } = audit;
  summary.textContent = semanticSummaryText(counts, gate);
  container.append(
    semanticOverview(audit),
    semanticGroup("Dependencies", audit.dependencies, renderDependency),
    semanticGroup("Commands", audit.commands, renderCommand),
    semanticGroup("Environments", audit.environments, renderEnvironment),
    semanticGroup("Parameters", audit.options, renderOption),
    semanticGroup("Variables and definitions", audit.declarations, renderDeclaration),
    semanticGroup("Numbers and dimensions", audit.numbers, renderNumber),
    semanticGroup("Plot expressions", audit.expressions, renderExpression)
  );
}

function semanticSummaryText(counts, gate, suffix = "") {
  return `${counts.commands} commands · ${counts.options} options · ${counts.numbers} values · ${gate.status}${suffix}`;
}

function updateSemanticDraftState(modified) {
  const details = document.querySelector("#semantic-details");
  const summary = document.querySelector("#semantic-summary");
  details.classList.toggle("is-stale", Boolean(modified && state.audit && !state.audit.error));
  if (state.audit?.summary && state.audit?.gate) {
    summary.textContent = semanticSummaryText(
      state.audit.summary,
      state.audit.gate,
      modified ? " · fixture source only" : ""
    );
  }
}

function semanticOverview(audit) {
  const section = document.createElement("section");
  section.className = `semantic-overview semantic-${audit.gate.status}`;
  const summary = document.createElement("p");
  summary.textContent = audit.gate.accepted
    ? "All semantic items have been reviewed with evidence."
    : `${audit.gate.blockers.length} blockers · ${audit.gate.todos.length} reviews still required`;
  section.append(summary);
  const items = [...audit.gate.blockers, ...audit.gate.todos];
  if (items.length) {
    const list = document.createElement("ul");
    for (const item of items) {
      const row = document.createElement("li");
      row.textContent = item;
      list.append(row);
    }
    section.append(list);
  }
  return section;
}

function semanticGroup(title, entries, renderEntry) {
  const section = document.createElement("details");
  section.className = "semantic-group";
  section.open = title === "Dependencies" || title === "Commands" || title === "Parameters";
  const heading = document.createElement("summary");
  heading.textContent = `${title} (${entries.length})`;
  section.append(heading);
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "semantic-empty";
    empty.textContent = "None";
    section.append(empty);
    return section;
  }
  const list = document.createElement("div");
  list.className = "semantic-list";
  for (const entry of entries) list.append(renderEntry(entry));
  section.append(list);
  return section;
}

function semanticRow(primary, metadata, status) {
  const row = document.createElement("div");
  row.className = "semantic-row";
  const main = document.createElement("code");
  main.textContent = primary;
  const details = document.createElement("span");
  details.textContent = metadata.filter(Boolean).join(" · ");
  const badge = document.createElement("span");
  badge.className = `semantic-badge semantic-badge-${status || "todo"}`;
  badge.textContent = status || "todo";
  row.append(main, details, badge);
  return row;
}

function renderDependency(entry) {
  return semanticRow(
    `${entry.kind}: ${entry.name}`,
    [
      entry.implementedBy || "no JS owner",
      entry.localSourceFound ? `MacTeX: ${entry.localSourceName}` : `MacTeX not found: ${entry.lookup}`,
      entry.localSourceReviewed ? "source reviewed" : "source not reviewed"
    ],
    entry.implementationStatus
  );
}

function renderCommand(entry) {
  return semanticRow(entry.name, [
    `${entry.count} uses`,
    `line ${entry.lines.join(", ")}`,
    entry.implementedBy || "no JS owner",
    entry.localSourceName ? `MacTeX: ${entry.localSourceName}` : null
  ], entry.implementationStatus);
}

function renderEnvironment(entry) {
  return semanticRow(`\\begin{${entry.name}}`, [
    `${entry.count} uses`,
    `line ${entry.lines.join(", ")}`,
    entry.implementedBy || "no JS owner"
  ], entry.implementationStatus);
}

function renderOption(entry) {
  return semanticRow(entry.keyPath.join(" / "), [
    entry.context,
    entry.rawValues.join(" | "),
    `line ${entry.lines.join(", ")}`,
    entry.implementedBy || "no JS owner"
  ], entry.reviewStatus);
}

function renderDeclaration(entry) {
  return semanticRow(`${entry.kind}: ${entry.name || "anonymous"}`, [
    entry.value || "no value",
    `line ${entry.line}`,
    `${entry.referenceCount || 0} references`
  ], entry.reviewStatus);
}

function renderNumber(entry) {
  return semanticRow(entry.literal, [
    entry.context,
    `${entry.count} uses`,
    `line ${entry.lines.join(", ")}`,
    entry.implementedBy || "no JS owner"
  ], entry.reviewStatus);
}

function renderExpression(entry) {
  return semanticRow(entry.expression, [
    `line ${entry.line}`,
    entry.implementedBy || "no JS owner"
  ], entry.reviewStatus);
}

function updateDraftStatus() {
  const modified = isFixtureDraft(state.editor.getValue(), state.originalSource);
  const stale = state.previewIsStale;
  const status = document.querySelector("#draft-status");
  const reset = document.querySelector("#reset-source-button");
  reset.disabled = !modified;
  status.textContent = stale ? "Draft changed · render to refresh" : modified ? "Local draft saved" : "Fixture source";
  status.classList.toggle("is-draft", modified);
  status.classList.toggle("is-stale", stale);
  updateSemanticDraftState(modified);
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
  const source = state.editor.getValue();
  if (isFixtureDraft(source, state.originalSource)) {
    writeDraft(state.active.id, source);
  } else {
    removeDraft(state.active.id);
  }
  state.previewIsStale = source !== state.lastRenderedSource;
  document.querySelector("#tikzkit-result").classList.toggle("is-stale", state.previewIsStale);
  updateDraftStatus();
}

async function resetSource() {
  if (!state.active) return;
  if (isFixtureDraft(state.editor.getValue(), state.originalSource) && !window.confirm("Discard this locally saved draft and restore the fixture source?")) {
    return;
  }
  removeDraft(state.active.id);
  state.editor.setValue(state.originalSource, { silent: true });
  state.previewIsStale = state.editor.getValue() !== state.lastRenderedSource;
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

function showCursorPosition(position = { line: 1, column: 1 }) {
  document.querySelector("#cursor-status").textContent = `Ln ${position.line}, Col ${position.column}`;
}

function handleEditorKeydown(event) {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    renderCurrentSource();
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    rememberDraft();
    setRenderStatus("Draft saved locally");
  }
}

async function boot() {
  const fixtures = await fetch("/api/fixtures").then((response) => response.json());
  state.fixtures = [createScratchFixture(), ...fixtures];
  state.editor = createTikzEditor(document.querySelector("#source-editor"));
  state.editor.onChange(rememberDraft);
  state.editor.onKeydown(handleEditorKeydown);
  state.editor.onCursorActivity(showCursorPosition);
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
  const requested = decodeURIComponent(location.hash.replace(/^#/, "")) || state.fixtures[1]?.id;
  await loadFixture(requested);
}

boot().catch((error) => {
  document.querySelector("#render-status").textContent = error.message;
});
