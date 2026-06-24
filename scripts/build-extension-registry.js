import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { BUILTIN_EXTENSIONS } from "../src/extensions/index.js";
import { BUILTIN_TIKZ_LIBRARIES } from "../src/tikz-libraries.js";
import { splitTopLevel } from "../src/options.js";
import { loadRealGalleryCases } from "./gallery-case-source.js";

const outputCsv = "docs/extension-registry.csv";
const outputMd = "docs/extension-registry.md";

const CORE_PACKAGE_SUPPORT = {
  xcolor: {
    status: "builtin",
    implementedBy: "src/preprocess.js:collectColorDefinitions",
    notes: "\\definecolor, HTML/rgb/RGB/gray, color mixes, \\textcolor subset"
  },
  tikz: {
    status: "builtin",
    implementedBy: "src/parser.js + src/interpreter.js + src/renderer-svg.js",
    notes: "TikZ semantic interpreter core: draw/path/fill/node/coordinate subset"
  },
  pgf: {
    status: "partial",
    implementedBy: "src/preprocess.js + src/interpreter.js",
    notes: "Core PGF-style path/color/math compatibility only"
  },
  pgfmath: {
    status: "partial",
    implementedBy: "src/math.js + src/preprocess.js",
    notes: "\\pgfmathsetmacro and common expression subset"
  },
  pgfplots: {
    status: "partial",
    implementedBy: "src/preprocess.js:expandPgfplotsAxes",
    notes: "axis/groupplot/addplot subset, not full PGFPlots engine"
  },
  pgfplotstable: {
    status: "partial",
    implementedBy: "src/preprocess.js:collectPgfplotstableReads",
    notes: "\\pgfplotstableread table data usable by addplot table"
  },
  pgfcalendar: {
    status: "partial",
    implementedBy: "src/preprocess.js package compatibility",
    notes: "Package/library declaration compatibility; calendar rendering still minimal"
  },
  pgfgantt: {
    status: "partial",
    implementedBy: "src/preprocess.js:expandPgfganttCharts",
    notes: "ganttchart/gantttitle/ganttbar/ganttgroup/ganttmilestone subset"
  },
  amsmath: {
    status: "partial",
    implementedBy: "src/math-metrics.js + src/renderer-svg.js",
    notes: "Many formulas are delegated to KaTeX; TeX macro package itself is not interpreted"
  },
  amssymb: {
    status: "partial",
    implementedBy: "src/math-metrics.js + src/renderer-svg.js",
    notes: "Symbols mostly delegated to KaTeX or SVG text fallback"
  },
  mathtools: {
    status: "partial",
    implementedBy: "src/math-metrics.js + src/renderer-svg.js",
    notes: "Formula display delegated to KaTeX; package-level commands are not complete"
  },
  bm: {
    status: "partial",
    implementedBy: "src/tex-text.js + src/renderer-svg.js",
    notes: "\\bm is normalized for common math labels"
  },
  relsize: {
    status: "partial",
    implementedBy: "src/tex-text.js",
    notes: "Common size/style macros are normalized, not full relsize semantics"
  },
  etoolbox: {
    status: "partial",
    implementedBy: "src/preprocess.js toggle compatibility",
    notes: "newtoggle/toggletrue/togglefalse/iftoggle subset"
  }
};

const PGFPLOTS_LIBRARY_SUPPORT = {
  groupplots: {
    status: "partial",
    implementedBy: "src/preprocess.js:expandPgfplotsGroupplots",
    notes: "groupplot/nextgroupplot/group size/horizontal sep/vertical sep subset"
  }
};

const PGF_LIBRARY_SUPPORT = {
  bbox: {
    status: "partial",
    implementedBy: "src/renderer-svg.js:computeBounds",
    notes: "tight bezier bounding box compatibility for current cases"
  },
  "shapes.multipart": {
    status: "partial",
    implementedBy: "src/interpreter.js + src/renderer-svg.js",
    notes: "rectangle split and selected multipart shape behavior"
  }
};

const EXTENSION_SUPPORT = Object.fromEntries(
  BUILTIN_EXTENSIONS.map((extension) => [
    extension.name,
    {
      status: "extension",
      implementedBy: `src/extensions/${extensionFileName(extension.name)}.js`,
      notes: extension.description || "Preprocess extension"
    }
  ])
);

const PACKAGE_EXTENSION_ALIASES = {
  "tikz-3dplot": "tikz-3dplot",
  "tikz-bagua": "tikz-bagua",
  "tikz-bayesnet": "tikz-bayesnet",
  "tikz-bpmn": "tikz-bpmn",
  "tikz-cd": "tikz-cd",
  "tikz-cnn": "tikz-cnn",
  "tikz-decofonts": "tikz-decofonts",
  "tikz-dimline": "tikz-dimline",
  "tikz-ext": "tikz-ext",
  "tikz-feynhand": "tikz-feynhand",
  "tikz-feynman": "tikz-feynman",
  "tikz-network": "tikz-network",
  "tikz-palattice": "tikz-palattice",
  "tikz-qtree": "tikz-qtree",
  tikzfxgraph: "tikzfxgraph",
  tikzquads: "tikzquads",
  stanli: "stanli"
};

const TIKZ_LIBRARY_EXTENSION_ALIASES = {
  bayesnet: "tikz-bayesnet",
  bpmn: "tikz-bpmn",
  cd: "tikz-cd",
  feynhand: "tikz-feynhand",
  feynman: "tikz-feynman"
};

const DOC_CANDIDATES = {
  "tikz-3dplot": "tikz-3dplot_documentation.tex",
  "tikz-bagua": "tikz-bagua.tex",
  "tikz-bbox": "pgfmanual-en-library-bbox.tex",
  "tikz-bpmn": "tikz-bpmn-doc.tex",
  "tikz-cd": "tikz-cd-doc.tex",
  "tikz-decofonts": "tikz-decofonts-doc.tex",
  "tikz-dimline": "tikz-dimline-doc.tex",
  "tikz-ext": "tikz-ext-manual.tex",
  "tikz-feynhand": "tikz-feynhand.userguide.tex",
  "tikz-feynman": "tikz-feynman.tex",
  "tikz-network": "tikz-network.tex",
  "tikz-qtree": "tikz-qtree-manual.tex",
  tikzquads: "tikzquads.tex",
  tikzfxgraph: "tikzfxgraph.tex"
};

const LOCAL_SOURCE_REVIEWED = {
  "tikzlibrary:decorations.pathreplacing": "yes",
  "package:tikz-network": "yes",
  "package:tikz-3dplot": "yes",
  "package:tikz-bagua": "yes",
  "package:tikz-bpmn": "yes",
  "package:tikz-cd": "yes",
  "package:tikz-decofonts": "yes",
  "package:tikz-dimline": "yes",
  "package:tikz-feynhand": "yes",
  "package:tikz-feynman": "yes",
  "package:tikz-palattice": "yes",
  "package:tikz-qtree": "yes",
  "package:tikzquads": "yes",
  "package:tikzfxgraph": "yes"
};

const gallery = await loadRealGalleryCases();
const entries = collectEntries(gallery.cases);
for (const entry of entries) enrichEntry(entry);

await mkdir("docs", { recursive: true });
await writeFile(outputCsv, renderCsv(entries), "utf8");
await writeFile(outputMd, renderMarkdown(entries, gallery), "utf8");

process.stdout.write(`extension-registry wrote ${entries.length} entries from ${gallery.cases.length} core cases\n`);
process.stdout.write(`${outputCsv}\n${outputMd}\n`);

function collectEntries(cases) {
  const map = new Map();
  for (const [index, item] of cases.entries()) {
    const caseId = `Case ${String(index + 1).padStart(3, "0")}`;
    const source = stripTexComments(item.source || "");
    collectDeclarations(source, /\\usepackage(?:\[[^\]]*\])?\{([^{}]*)\}/g, "package", map, item, caseId);
    collectDeclarations(source, /\\usetikzlibrary(?:\[[^\]]*\])?\{([^{}]*)\}/g, "tikzlibrary", map, item, caseId);
    collectDeclarations(source, /\\usepgfplotslibrary(?:\[[^\]]*\])?\{([^{}]*)\}/g, "pgfplotslibrary", map, item, caseId);
    collectDeclarations(source, /\\usepgflibrary(?:\[[^\]]*\])?\{([^{}]*)\}/g, "pgflibrary", map, item, caseId);
  }
  return [...map.values()].sort(compareEntries);
}

function collectDeclarations(source, pattern, kind, map, item, caseId) {
  let match;
  while ((match = pattern.exec(source))) {
    for (const rawName of splitTopLevel(match[1], ",")) {
      const name = rawName.trim();
      if (!name) continue;
      const key = `${kind}:${name}`;
      if (!map.has(key)) {
        map.set(key, {
          kind,
          name,
          count: 0,
          cases: [],
          caseSet: new Set(),
          origins: new Set(),
          paths: [],
          localSource: "",
          localDoc: "",
          implementationStatus: "unsupported",
          implementedBy: "",
          localSourceReviewed: "no",
          notes: ""
        });
      }
      const entry = map.get(key);
      if (!entry.caseSet.has(caseId)) {
        entry.caseSet.add(caseId);
        entry.count += 1;
        entry.cases.push(caseId);
      }
      entry.origins.add(item.origin || "unknown");
      if (item.path && entry.paths.length < 5) entry.paths.push(item.path);
    }
  }
}

function enrichEntry(entry) {
  const support = implementationSupport(entry);
  entry.implementationStatus = support.status;
  entry.implementedBy = support.implementedBy || "";
  entry.notes = support.notes || "";
  entry.localSource = findLocalSource(entry);
  entry.localDoc = findLocalDoc(entry);
  const reviewedKey = `${entry.kind}:${entry.name}`;
  entry.localSourceReviewed = LOCAL_SOURCE_REVIEWED[reviewedKey] || (entry.localSource ? "no" : "not-found");
}

function implementationSupport(entry) {
  if (entry.kind === "package") {
    const extensionName = PACKAGE_EXTENSION_ALIASES[entry.name];
    if (extensionName && EXTENSION_SUPPORT[extensionName]) return EXTENSION_SUPPORT[extensionName];
    return CORE_PACKAGE_SUPPORT[entry.name] || unsupportedSupport(entry);
  }
  if (entry.kind === "tikzlibrary") {
    const builtin = BUILTIN_TIKZ_LIBRARIES[entry.name];
    if (builtin) {
      return {
        status: builtin.status,
        implementedBy: builtin.implementedBy,
        notes: builtin.features.join("; ")
      };
    }
    const extensionName = TIKZ_LIBRARY_EXTENSION_ALIASES[entry.name];
    if (extensionName && EXTENSION_SUPPORT[extensionName]) return EXTENSION_SUPPORT[extensionName];
    return unsupportedSupport(entry);
  }
  if (entry.kind === "pgfplotslibrary") return PGFPLOTS_LIBRARY_SUPPORT[entry.name] || unsupportedSupport(entry);
  if (entry.kind === "pgflibrary") return PGF_LIBRARY_SUPPORT[entry.name] || unsupportedSupport(entry);
  return unsupportedSupport(entry);
}

function unsupportedSupport(entry) {
  return {
    status: "unsupported",
    implementedBy: "",
    notes: `Needs ${entry.kind} compatibility pass`
  };
}

function findLocalSource(entry) {
  const candidates = [];
  if (entry.kind === "package") candidates.push(`${entry.name}.sty`);
  if (entry.kind === "tikzlibrary") {
    candidates.push(`tikzlibrary${entry.name}.code.tex`);
    candidates.push(`pgflibrary${entry.name}.code.tex`);
  }
  if (entry.kind === "pgfplotslibrary") {
    candidates.push(`pgfplotslibrary${entry.name}.code.tex`);
    candidates.push(`tikzlibrarypgfplots.${entry.name}.code.tex`);
  }
  if (entry.kind === "pgflibrary") candidates.push(`pgflibrary${entry.name}.code.tex`);
  for (const candidate of candidates) {
    const path = kpsewhich(candidate);
    if (path) return path;
  }
  return "";
}

function findLocalDoc(entry) {
  const candidates = [];
  if (DOC_CANDIDATES[entry.name]) candidates.push(DOC_CANDIDATES[entry.name]);
  if (entry.kind === "package") candidates.push(`${entry.name}.tex`);
  for (const candidate of candidates) {
    const path = kpsewhich(candidate);
    if (path) return path;
  }
  return "";
}

function kpsewhich(fileName) {
  const result = spawnSync("kpsewhich", [fileName], { encoding: "utf8" });
  if (result.status !== 0) return "";
  return result.stdout.trim();
}

function renderCsv(entries) {
  const header = [
    "kind",
    "name",
    "caseCount",
    "implementationStatus",
    "implementedBy",
    "localSourceFound",
    "localSourceReviewed",
    "localSource",
    "localDoc",
    "cases",
    "origins",
    "samplePaths",
    "notes"
  ];
  const rows = entries.map((entry) => [
    entry.kind,
    entry.name,
    String(entry.count),
    entry.implementationStatus,
    entry.implementedBy,
    entry.localSource ? "yes" : "no",
    entry.localSourceReviewed,
    entry.localSource,
    entry.localDoc,
    entry.cases.join(" "),
    [...entry.origins].sort().join(" | "),
    entry.paths.join(" | "),
    entry.notes
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function renderMarkdown(entries, gallery) {
  const grouped = groupByKind(entries);
  const unsupported = entries.filter((entry) => entry.implementationStatus === "unsupported");
  const partial = entries.filter((entry) => entry.implementationStatus === "partial");
  const topUnsupported = [...unsupported].sort((a, b) => b.count - a.count).slice(0, 20);
  const topPartial = [...partial].sort((a, b) => b.count - a.count).slice(0, 20);
  return `# TikZ Extension Registry

Generated by \`node scripts/build-extension-registry.js\` from the merged core gallery.

## Scope

- Corpus: \`${gallery.id}\`
- Cases: ${gallery.cases.length}
- Entries: ${entries.length}
- Packages: ${grouped.package?.length || 0}
- TikZ libraries: ${grouped.tikzlibrary?.length || 0}
- PGFPlots libraries: ${grouped.pgfplotslibrary?.length || 0}
- PGF libraries: ${grouped.pgflibrary?.length || 0}

## Status Columns

- \`implementationStatus\`: \`builtin\`, \`extension\`, \`partial\`, or \`unsupported\`.
- \`localSourceFound\`: whether MacTeX/TeX Live can locate the source with \`kpsewhich\`.
- \`localSourceReviewed\`: \`yes\` only when we have actually inspected the local source/doc for the current implementation. \`no\` means source exists but still needs review. \`not-found\` means no local source was found.
- \`cases\`: core gallery case IDs using the declaration.

The complete machine-readable table is [extension-registry.csv](./extension-registry.csv).

## Highest-Priority Unsupported Entries

${renderPriorityTable(topUnsupported)}

## Highest-Priority Partial Entries

${renderPriorityTable(topPartial)}

## Implementation Workflow

1. Pick the highest-impact unsupported or partial entry by case count and visual severity.
2. Open \`localSource\` and \`localDoc\` when available, then record \`localSourceReviewed=yes\` only after reading the relevant macros/algorithm.
3. Add or update a focused extension file under \`src/extensions/\` for third-party packages, or a focused core module for built-in TikZ/PGF libraries.
4. Add a minimal unit test and at least one gallery/corpus visual case.
5. Regenerate this registry with \`node scripts/build-extension-registry.js\` and update the status/notes if the implementation changed.
`;
}

function renderPriorityTable(entries) {
  if (!entries.length) return "None.\n";
  const lines = [
    "| kind | name | cases | local source | reviewed | next note |",
    "| --- | --- | ---: | --- | --- | --- |"
  ];
  for (const entry of entries) {
    lines.push(
      `| ${entry.kind} | ${entry.name} | ${entry.count} | ${entry.localSource ? "found" : "missing"} | ${entry.localSourceReviewed} | ${entry.notes} |`
    );
  }
  return `${lines.join("\n")}\n`;
}

function groupByKind(entries) {
  const result = {};
  for (const entry of entries) {
    if (!result[entry.kind]) result[entry.kind] = [];
    result[entry.kind].push(entry);
  }
  return result;
}

function stripTexComments(source) {
  let output = "";
  let inComment = false;
  for (let index = 0; index < String(source).length; index += 1) {
    const char = source[index];
    if (inComment) {
      if (char === "\n") {
        inComment = false;
        output += char;
      }
      continue;
    }
    if (char === "%" && source[index - 1] !== "\\") {
      inComment = true;
      continue;
    }
    output += char;
  }
  return output;
}

function extensionFileName(name) {
  const overrides = {
    tikzfxgraph: "tikzfxgraph",
    tikzquads: "tikzquads",
    stanli: "stanli"
  };
  return overrides[name] || name;
}

function compareEntries(a, b) {
  const kindOrder = { package: 0, tikzlibrary: 1, pgfplotslibrary: 2, pgflibrary: 3 };
  const kindDiff = (kindOrder[a.kind] ?? 9) - (kindOrder[b.kind] ?? 9);
  if (kindDiff) return kindDiff;
  if (b.count !== a.count) return b.count - a.count;
  return a.name.localeCompare(b.name);
}

function csvCell(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}
