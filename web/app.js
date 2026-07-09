import { createRequestGate, renderWorkbenchSource } from "./workbench.js";

const state = { fixtures: [], active: null, lastSvg: "" };
const requestGate = createRequestGate();

async function loadFixture(id) {
  const token = requestGate.next();
  const fixture = state.fixtures.find((entry) => entry.id === id) || state.fixtures[0];
  if (!fixture) return;

  const source = await fetch(fixture.sourceUrl).then((response) => response.text());
  if (!requestGate.isCurrent(token)) return;

  state.active = fixture;
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
    const result = await renderWorkbenchSource(source, { activeFigureId });
    if (!requestGate.isCurrent(token)) return;

    state.lastSvg = result.svg;
    showTikzkitSvg(result.svg);
    showDiagnostics(result.diagnostics);
    document.querySelector("#render-status").textContent = `${result.elapsedMs}ms · ${result.diagnostics.length} diagnostics`;
  } finally {
    if (requestGate.isCurrent(token)) button.disabled = false;
  }
}

function showTikzkitSvg(svg) {
  document.querySelector("#tikzkit-result").innerHTML = svg;
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
