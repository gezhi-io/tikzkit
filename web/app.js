import { createRequestGate, renderWorkbenchSource } from "./workbench.js";
import { withQaGrid } from "./qaGrid.js";

const state = { fixtures: [], active: null, lastSvg: "", resources: new Map() };
const requestGate = createRequestGate();

async function loadFixture(id) {
  const token = requestGate.next();
  const fixture = state.fixtures.find((entry) => entry.id === id) || state.fixtures[0];
  if (!fixture) return;

  const source = await fetch(fixture.sourceUrl).then((response) => response.text());
  const resourceRows = await Promise.all((fixture.resources || []).map(loadFixtureResource));
  if (!requestGate.isCurrent(token)) return;

  state.active = fixture;
  state.resources = new Map(resourceRows);
  document.querySelector("#fixture-select").value = fixture.id;
  document.querySelector("#source-editor").value = source;
  history.replaceState(null, "", `#${encodeURIComponent(fixture.id)}`);

  const reference = document.querySelector("#reference-result");
  const referenceUrl = fixture.tikztosvgGridSvgUrl || fixture.tikztosvgSvgUrl;
  if (referenceUrl) {
    reference.data = referenceUrl;
    reference.textContent = "";
  } else {
    reference.removeAttribute("data");
    reference.textContent = "Reference artifact has not been generated yet.";
  }

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
    showTikzkitSvg(result.svg);
    showDiagnostics(result.diagnostics);
    document.querySelector("#render-status").textContent = `${result.elapsedMs}ms · ${result.diagnostics.length} diagnostics`;
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
  document.querySelector("#tikzkit-result").innerHTML = withQaGrid(svg, { enabled });
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
    const item = document.createElement("div");
    item.className = `diagnostic diagnostic-${row.severity}`;
    const heading = document.createElement("strong");
    heading.textContent = `${row.severity} · ${row.code}${row.location ? ` · ${row.location}` : ""}`;
    const message = document.createElement("span");
    message.textContent = row.message;
    item.append(heading, message);
    container.append(item);
  }
}

async function boot() {
  state.fixtures = await fetch("/api/fixtures").then((response) => response.json());
  const select = document.querySelector("#fixture-select");
  for (const fixture of state.fixtures) {
    const option = document.createElement("option");
    option.value = fixture.id;
    option.textContent = `${fixture.id} · ${fixture.title}`;
    select.append(option);
  }

  select.addEventListener("change", () => loadFixture(select.value));
  document.querySelector("#render-button").addEventListener("click", renderCurrentSource);
  document.querySelector("#grid-toggle").addEventListener("change", () => showTikzkitSvg(state.lastSvg));
  document.querySelector("#source-editor").addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      renderCurrentSource();
    }
  });

  const requested = decodeURIComponent(location.hash.replace(/^#/, ""));
  await loadFixture(requested);
}

boot().catch((error) => {
  document.querySelector("#render-status").textContent = error.message;
});
