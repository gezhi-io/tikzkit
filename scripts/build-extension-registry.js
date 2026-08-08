import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { BUILTIN_EXTENSIONS } from "../src/extensions/index.js";
import { BUILTIN_TIKZ_LIBRARIES } from "../src/tikz/libraries/declarations.js";
import { texPackageCatalog } from "../src/packages/index.js";
import { PGFPLOTS_LIBRARY_SUPPORT as RUNTIME_PGFPLOTS_LIBRARY_SUPPORT } from "../src/pgfplots/axisOptions.js";
import { splitTopLevel } from "../src/engine/options.js";
import { loadRealGalleryCases } from "./gallery-case-source.js";

const outputCsv = "docs/extension-registry.csv";
const outputMd = "docs/extension-registry.md";

const CORE_PACKAGE_SUPPORT = {
  xcolor: {
    status: "builtin",
    implementedBy: "src/frontend/latex-shell.js:collectColorDefinitions + src/frontend/parser.js + src/engine/evaluate.js + src/tikz/text.js + src/renderers/svg/mathNode.js",
    localSourceReviewed: "yes",
    notes: "\\definecolor, HTML/rgb/RGB/gray, color mixes, \\textcolor, leading text/math \\color declarations, and scoped standalone \\color{name} state. Optional xcolor models and arbitrary mid-text color-state segmentation remain partial."
  },
  tikz: {
    status: "builtin",
    implementedBy: "src/frontend/parser.js + src/engine/evaluate.js:interpretPathStatement/transformCanvasTransform/estimateNodeSize + src/tikz/textMetrics.js + src/renderers/svg/renderSvg.js",
    localSourceReviewed: "yes",
    notes: "TikZ semantic interpreter core: draw/path/fill/node/coordinate subset; named nodes and coordinates persist across consecutive tikzpictures without inheriting web-only inline layout translations. An outer node minipage maps its required width, including TeX's implicit scalar/register syntax such as 0.35\\textwidth, into shared text-width wrapping unless TikZ sets text width explicitly. Browser foreignObject rich text delegates mixed prose/formula wrapping to the shared TeX-sized SVG-text token layout, so supported fixed-width nodes use the same word grouping in browser and fallback renderers. Bare corpus .tikz fragments are wrapped with their declared packages/libraries before a native MacTeX visual reference is generated. Reviewed locally on 2026-08-08: TikZ's text-width action creates a ragged-right minipage paragraph with rightskip stretch; it remains only an approximation here. PGF circle sizing takes the Euclidean diagonal of its TeX text box. Multi-line math circles therefore bypass the wider SVG measurement box and use calibrated TeX row metrics, while SVG still paints the text. transform canvas now keeps the backend matrix separate from coordinate transforms for scale/rotate/xshift/yshift paths and nodes, scales stroke/text geometry, and preserves PGF's locally disabled automatic picture-size tracking; TeX hyphenation, nested minipage layout, and arbitrary non-uniform node-anchor geometry remain partial.",
  },
  pgf: {
    status: "partial",
    implementedBy: "src/frontend/latex-shell.js + src/engine/evaluate.js",
    notes: "Core PGF-style path/color/math compatibility only"
  },
  pgfmath: {
    status: "partial",
    implementedBy: "src/engine/math.js + src/frontend/latex-shell.js",
    notes: "\\pgfmathsetmacro and common expression subset"
  },
  pgfplots: {
    status: "partial",
    implementedBy: "src/frontend/latex-shell.js:expandPgfplotsAxes + lowerStandalonePgfplotsCustomLegends; src/pgfplots/axisTikzLowering.js:renderPgfplotsAxisAsTikz; src/pgfplots/axisOverlay.js:renderAxisOverlayStatements",
    notes: "axis/groupplot/addplot subset plus standalone custom legend samples. Retained user annotations inherit the active axis font scope; not a full PGFPlots engine"
  },
  pgfplotstable: {
    status: "partial",
    implementedBy: "src/frontend/latex-shell.js:collectPgfplotstableReads",
    notes: "\\pgfplotstableread table data usable by addplot table"
  },
  pgfcalendar: {
    status: "partial",
    implementedBy: "src/engine/evaluate.js:createCalendar/calendarLayout",
    notes: "Calendar declaration compatibility plus documented week-list date layout, month labels, and basic date conditions; not a full pgfcalendar implementation"
  },
  pgfgantt: {
    status: "partial",
    implementedBy: "src/frontend/latex-shell.js:expandPgfganttCharts",
    notes: "ganttchart/gantttitle/ganttbar/ganttgroup/ganttmilestone subset"
  },
  amsmath: {
    status: "partial",
    implementedBy: "src/tikz/text.js + src/tikz/textMetrics.js + src/tikz/mathMatrixSyntax.js + src/renderers/svg/mathMatrixFallback.js + src/renderers/svg/mathNode.js + src/renderers/svg/textEngine.js",
    notes: "Scoped browser math handles interactive formulas. The SVG-text fallback structurally lays out array l/c/r columns, @{} zero gaps, basic *{n}{...} repetition, and \\left...\\right delimiters; tags, cross-reference expansion, nonempty/custom array preambles, and complete TeX macro semantics remain partial."
  },
  amssymb: {
    status: "partial",
    implementedBy: "src/tikz/text.js + src/tikz/textMetrics.js + src/renderers/svg/mathScriptFallback.js + src/renderers/svg/mathNode.js",
    localSourceReviewed: "yes",
    notes: "SVG-text fallback covers varnothing plus common AMSa/AMSb relations: leqslant/geqslant, nleq/ngeq, nsubseteq/nsupseteq, rightsquigarrow/leadsto, and therefore/because. Broad AMSa/AMSb coverage remains partial."
  },
  mathtools: {
    status: "partial",
    implementedBy: "src/tikz/textMetrics.js + src/renderers/svg/renderSvg.js",
    notes: "Formula display delegated to KaTeX; package-level commands are not complete"
  },
  bm: {
    status: "partial",
    implementedBy: "src/tikz/text.js + src/renderers/svg/renderSvg.js",
    notes: "\\bm is normalized for common math labels"
  },
  relsize: {
    status: "partial",
    implementedBy: "src/tikz/text.js",
    notes: "Common size/style macros are normalized, not full relsize semantics"
  },
  etoolbox: {
    status: "partial",
    implementedBy: "src/frontend/latex-shell.js toggle compatibility",
    notes: "newtoggle/toggletrue/togglefalse/iftoggle subset"
  }
};

const PGFPLOTS_LIBRARY_SUPPORT = RUNTIME_PGFPLOTS_LIBRARY_SUPPORT;

const PGF_LIBRARY_SUPPORT = {
  bbox: {
    status: "partial",
    implementedBy: "src/renderers/svg/renderSvg.js:computeBounds",
    notes: "tight bezier bounding box compatibility for current cases"
  },
  "shapes.multipart": {
    status: "partial",
    implementedBy: "src/engine/evaluate.js:rectangleSplitLayout/rectangleSplitTextAnchorShift/rectangleSplitLocalAnchor/circleSplitLayout + src/renderers/svg/rectangleSplitNodes.js + src/renderers/svg/circleSplitNodes.js + src/renderers/svg/mathNode.js",
    notes: "Horizontal rectangle splits use intrinsic accumulated part widths: PGF ignores `minimum width` and the width component of `minimum size`, while preserving their shared minimum height. nodepart text boxes, named part anchors, per-part fill, and TeX text/script/scriptscript math sizing are supported. Arbitrary multipart shapes, repeated low-level empty-part rules, and complete TeX box metrics remain partial."
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
  bchart: "bchart",
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
  "tkz-euclide": "tkz-euclide",
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
  bchart: "bchart.pdf",
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
  "tkz-euclide": "tkz-euclide.pdf",
  tikzquads: "tikzquads.tex",
  tikzfxgraph: "tikzfxgraph.tex"
};

const LOCAL_SOURCE_REVIEWED = {
  "package:bchart": "yes",
  "tikzlibrary:calendar": "yes",
  "package:pgfplots": "yes",
  "tikzlibrary:arrows": "yes",
  "tikzlibrary:decorations.text": "yes",
  "tikzlibrary:decorations.pathreplacing": "yes",
  "tikzlibrary:intersections": "yes",
  "tikzlibrary:lindenmayersystems": "yes",
  "tikzlibrary:mindmap": "yes",
  "tikzlibrary:patterns": "yes",
  "tikzlibrary:plotmarks": "yes",
  "tikzlibrary:shadows": "yes",
  "tikzlibrary:shapes.multipart": "yes",
  "tikzlibrary:spy": "yes",
  "tikzlibrary:trees": "yes",
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
  "package:tkz-euclide": "yes",
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
  entry.localSource = support.localSource || findLocalSource(entry);
  entry.localDoc = support.localDoc || findLocalDoc(entry);
  const reviewedKey = `${entry.kind}:${entry.name}`;
  entry.localSourceReviewed = support.localSourceReviewed
    ? "yes"
    : LOCAL_SOURCE_REVIEWED[reviewedKey] || (entry.localSource ? "no" : "not-found");
}

function implementationSupport(entry) {
  if (entry.kind === "package") {
    const packageMetadata = texPackageCatalog[entry.name];
    if (packageMetadata) return packageMetadataSupport(packageMetadata);
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
        notes: builtin.notes || builtin.features.join("; "),
        localSource: builtin.localSource || "",
        localDoc: builtin.localDoc || "",
        localSourceReviewed: builtin.localSourceReviewed || ""
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

function packageMetadataSupport(metadata) {
  return {
    status: metadata.implementationStatus || metadata.status || "unsupported",
    implementedBy: [metadata.implementedBy, metadata.registryImplementedBySuffix, metadata.registryImplementedByLatest].filter(Boolean).join(";"),
    notes: [metadata.notes, metadata.registryNoteSuffix, metadata.registryNoteSuffixExtra, metadata.registryNoteSuffixLatest].filter(Boolean).join(" ") || (metadata.features || []).join("; "),
    localSource: metadata.localSource || "",
    localDoc: metadata.localDoc || "",
    localSourceReviewed: [metadata.localSourceReviewed, metadata.localSourceReviewedExtra, metadata.localSourceReviewedExtraAppend, metadata.localSourceReviewedLatest].filter(Boolean).join("; ")
  };
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
  const coreTikz = entries.find((entry) => entry.kind === "package" && entry.name === "tikz");
  const unsupported = entries.filter((entry) => entry.implementationStatus === "unsupported");
  const partial = entries.filter((entry) => entry.implementationStatus === "partial");
  const topUnsupported = [...unsupported].sort((a, b) => b.count - a.count).slice(0, 20);
  const topPartial = [...partial].sort((a, b) => b.count - a.count).slice(0, 20);
  const reviewedSmallSlices = [...partial]
    .filter((entry) => entry.localSourceReviewed === "yes" && entry.count <= 3)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 12);
  return `# TikZ Extension Registry

Generated by \`node scripts/build-extension-registry.js\` from the active fixture corpus.

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

## Core TikZ Tracking

| package | implementationStatus | local source reviewed | implemented by | current focused note |
| --- | --- | --- | --- | --- |
| ${coreTikz?.name || "tikz"} | ${coreTikz?.implementationStatus || "not-found"} | ${coreTikz?.localSourceReviewed || "not-found"} | ${coreTikz?.implementedBy || "not-found"} | The core renderer and its local reference harness are tracked together: explicit document crops only affect executable top-level pictures, while full-document preamble declarations are isolated before third-party reference rendering. Exact TeX paragraph layout, arbitrary non-uniform node anchors, and some third-party wrappers remain partial. |

## Latest Core TikZ Update

On 2026-08-08, the browser rich-text/KaTeX path started reusing the SVG-text
renderer’s TeX-sized mixed-math token breaker. A real 6cm text-width node
therefore now keeps the same three lines in browser and fallback rendering;
the native comparison harness also wraps body-only .tikz fragments with their
declared packages/libraries before calling MacTeX. Full TeX paragraph
glue/penalties, full hyphenation dictionaries, footnotes, and nested minipage
layout remain partial. Evidence:
[2026-08-08 rich-text fixed-width QA](./qa/2026-08-08-rich-text-fixed-width-wrap.md).

## Highest-Priority Unsupported Entries

${renderPriorityTable(topUnsupported)}

## Highest-Priority Partial Entries

${renderPriorityTable(topPartial)}

## Reviewed Focused Slices

${renderPriorityTable(reviewedSmallSlices)}

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
