import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { auditTikzSource, createReviewTemplate, renderAuditMarkdown, writeAuditArtifacts } from "../scripts/case-semantic-audit.js";

const SOURCE = String.raw`
\documentclass[border=2pt]{standalone}
\usepackage{pgfplots}
\usepackage{xcolor}
\usetikzlibrary{calc,positioning}
\usepgfplotslibrary{fillbetween}
\definecolor{curve}{HTML}{332288}
\newcommand{\scalevalue}{2}
\begin{document}
\begin{tikzpicture}[scale=\scalevalue]
  \begin{axis}[
    width=16cm,
    legend style={at={(0.95,0.95)},anchor=north west},
    grid=major,
    xmin=-2,
    xmax=2
  ]
    \foreach \k in {1,2,3} {
      \addplot+[domain=-2:2,samples=50,color=curve] {max(0,x/\k)};
      \addlegendentryexpanded{$k=\k$}
    }
  \end{axis}
\end{tikzpicture}
\end{document}
`;

function fakeResolver(lookup) {
  return `/texlive/${lookup}`;
}

test("semantic audit inventories local dependencies, nested options, variables, numbers, and expressions", () => {
  const report = auditTikzSource(SOURCE, {
    sourcePath: "/tmp/example.tex",
    localSourceResolver: fakeResolver
  });

  assert.deepEqual(
    report.dependencies.map((entry) => [entry.kind, entry.name, entry.localSource]),
    [
      ["package", "pgfplots", "/texlive/pgfplots.sty"],
      ["package", "xcolor", "/texlive/xcolor.sty"],
      ["tikz-library", "calc", "/texlive/tikzlibrarycalc.code.tex"],
      ["tikz-library", "positioning", "/texlive/tikzlibrarypositioning.code.tex"],
      ["pgfplots-library", "fillbetween", "/texlive/tikzlibrarypgfplots.fillbetween.code.tex"]
    ]
  );

  assert.ok(report.commands.some((entry) => entry.name === "\\addplot" && entry.implementedBy === "src/pgfplots/addplotParser.js"));
  assert.ok(report.environments.some((entry) => entry.name === "axis" && entry.implementedBy === "src/pgfplots/axisEnvironment.js"));
  assert.ok(report.declarations.some((entry) => entry.kind === "macro" && entry.name === "scalevalue"));
  assert.ok(report.declarations.some((entry) => entry.kind === "foreach-variable" && entry.name === "k" && entry.value === "1,2,3"));
  assert.ok(report.options.some((entry) => entry.id === "option:axis:legend style/anchor"));
  assert.ok(report.options.some((entry) => entry.id === "option:addplot:domain"));
  assert.ok(report.numbers.some((entry) => entry.literal === "16cm"));
  assert.deepEqual(report.expressions.map((entry) => entry.expression), ["max(0,x/\\k)"]);
  assert.equal(report.gate.accepted, false);
  assert.ok(report.gate.todos.some((entry) => entry.includes("option:axis:width")));
});

test("semantic audit inventories fill-between options and nested segment styles", () => {
  const report = auditTikzSource(String.raw`
    \addplot[fill=blue!20] fill between[
      of=A and B,
      split,
      every segment no 1/.style={fill=orange},
      every odd segment/.style={fill=yellow}
    ];
  `, { localSourceResolver: fakeResolver });

  assert.equal(report.options.find((entry) => entry.id === "option:fill between:of")?.implementedBy, "src/pgfplots/fillBetween.js");
  assert.ok(report.options.some((entry) => entry.id === "option:fill between:split"));
  assert.ok(report.options.some((entry) => entry.id === "option:fill between:every segment no 1/.style/fill"));
  assert.ok(report.options.some((entry) => entry.id === "option:fill between:every odd segment/.style/fill"));
  assert.ok(report.numbers.some((entry) => entry.id === "number:option:fill between:1"));
});

test("semantic audit maps logarithmic pgfplots environments and their axis options", () => {
  const report = auditTikzSource(String.raw`
\begin{semilogxaxis}[xmin=1,xmax=1000,grid=both]
\end{semilogxaxis}
\begin{semilogyaxis}[log basis y=2]
\end{semilogyaxis}
\begin{loglogaxis}[xmode=log,ymode=log]
\end{loglogaxis}
  `);

  for (const name of ["semilogxaxis", "semilogyaxis", "loglogaxis"]) {
    const environment = report.environments.find((entry) => entry.name === name);
    assert.equal(environment.implementedBy, "src/pgfplots/axisEnvironment.js");
    assert.equal(environment.implementationStatus, "partial");
  }
  assert.equal(
    report.options.find((entry) => entry.id === "option:semilogyaxis:log basis y").implementedBy,
    "src/pgfplots/axisOptions.js"
  );
  assert.equal(
    report.options.find((entry) => entry.id === "option:loglogaxis:xmode").implementedBy,
    "src/pgfplots/axisOptions.js"
  );
});

test("review prefix rules preserve individual numeric inventory while sharing evidence", () => {
  const report = auditTikzSource(String.raw`\addplot {max(0, x/2) + 0.5};`, {
    localSourceResolver: fakeResolver,
    review: {
      rules: [{
        match: "number:expression:addplot:1:*",
        status: "verified",
        evidence: ["test/pgfplots-seams.test.js"]
      }]
    }
  });

  assert.equal(report.numbers.length, 3);
  assert.ok(report.numbers.every((entry) => entry.reviewStatus === "verified"));
  assert.ok(report.numbers.every((entry) => entry.evidence[0] === "test/pgfplots-seams.test.js"));
  assert.ok(Object.keys(createReviewTemplate(report).features).includes("expression:addplot:1"));
});

test("a template todo entry does not shadow a later wildcard review", () => {
  const report = auditTikzSource(String.raw`\draw (0,0) -- (1,1);`, {
    localSourceResolver: fakeResolver,
    review: {
      features: {
        "command:\\draw": { status: "todo", evidence: [] }
      },
      rules: [{
        match: "command:*",
        status: "verified",
        evidence: ["test/interpreter.test.js"]
      }]
    }
  });

  const draw = report.commands.find((entry) => entry.name === "\\draw");
  assert.equal(draw.reviewStatus, "verified");
  assert.deepEqual(draw.evidence, ["test/interpreter.test.js"]);
});

test("semantic audit maps tkz-euclide line-circle result controls and their common option", () => {
  const report = auditTikzSource(String.raw`
\usepackage{tkz-euclide}
\begin{tikzpicture}
  \tkzDefPoint(0,0){O}
  \tkzDefPoint(1,0){A}
  \tkzInterLC[common=A](A,O)(O,A)\tkzGetPoints{Other}{Common}
\end{tikzpicture}`, {
    localSourceResolver: fakeResolver
  });

  assert.equal(
    report.commands.find((entry) => entry.name === "\\tkzInterLC").implementedBy,
    "src/extensions/tkz-euclide.js:expandInterLC/orderLineCircleIntersections"
  );
  assert.equal(
    report.commands.find((entry) => entry.name === "\\tkzGetPoints").implementedBy,
    "src/extensions/tkz-euclide.js:expandGetPoints"
  );
  assert.ok(report.options.some((entry) => entry.id === "option:tkzInterLC:common" && entry.rawValues.includes("A")));
});

test("declaration inventory connects parameterized macros and cycle lists to references", () => {
  const report = auditTikzSource(String.raw`
\newcommand{\twice}[1]{2*#1}
\pgfplotscreateplotcyclelist{custom}{{blue},{red,dashed}}
\begin{axis}[cycle list name=custom]
  \addplot {\twice{x}};
\end{axis}`, {
    localSourceResolver: fakeResolver
  });

  const macro = report.declarations.find((entry) => entry.name === "twice");
  const cycleList = report.declarations.find((entry) => entry.kind === "cycle-list");
  assert.equal(macro.value, "2*#1");
  assert.deepEqual(macro.referenceLines, [5]);
  assert.equal(cycleList.name, "custom");
  assert.deepEqual(cycleList.referenceLines, [4]);
});

test("strict audit blockers expose commands without an implementation owner", () => {
  const report = auditTikzSource(String.raw`\begin{tikzpicture}\mystery{4}\end{tikzpicture}`, {
    localSourceResolver: fakeResolver
  });

  assert.ok(report.gate.blockers.includes("command:\\mystery: no implementation owner"));
  assert.equal(report.gate.status, "blocked");
});

test("audit assigns document-shell and font commands to explicit owners", () => {
  const report = auditTikzSource(String.raw`
    \usepackage[active]{preview}
    \setlength\PreviewBorder{2mm}
    \begin{tikzpicture}\node{\tiny\scriptsize\footnotesize\small\normalsize\large\Large\LARGE\huge\Huge\tt x};\end{tikzpicture}
  `, {
    localSourceResolver: fakeResolver
  });

  const ownerFor = (name) => report.commands.find((entry) => entry.name === name)?.implementedBy;
  assert.equal(ownerFor("\\PreviewBorder"), "src/frontend/latex-shell.js");
  assert.equal(ownerFor("\\setlength"), "src/frontend/latex-shell.js");
  for (const name of ["tiny", "scriptsize", "footnotesize", "small", "normalsize", "large", "Large", "LARGE", "huge", "Huge"]) {
    assert.equal(ownerFor(`\\${name}`), "src/tex/fontSpec.js");
  }
  assert.equal(ownerFor("\\tt"), "src/tex/fontSpec.js");
  assert.ok(!report.gate.blockers.some((entry) => /PreviewBorder|setlength|tiny|scriptsize|footnotesize|small|normalsize|large|huge|\\tt/i.test(entry)));
});

test("semantic audit maps PGFPlots tick-label template commands", () => {
  const report = auditTikzSource(String.raw`
    \begin{axis}[zticklabel={\pgfmathprintnumber{\tick}\%}]
    \end{axis}
  `, { localSourceResolver: fakeResolver });

  const ownerFor = (name) => report.commands.find((entry) => entry.name === name)?.implementedBy;
  assert.equal(ownerFor("\\pgfmathprintnumber"), "src/pgf/numberFormat.js:formatPgfScientificNumber + src/pgfplots/ticks.js:renderTickLabelTemplate");
  assert.equal(ownerFor("\\tick"), "src/pgfplots/ticks.js:renderTickLabelTemplate");
  assert.ok(!report.gate.blockers.some((entry) => /pgfmathprintnumber|tick/.test(entry)));
});

test("semantic audit maps calendar commands, options, and reviewed library metadata", () => {
  const report = auditTikzSource(String.raw`
    \usetikzlibrary{calendar}
    \begin{tikzpicture}
      \calendar [dates=2000-01-01 to 2000-02-last,week list,month yshift=3cm]
        if (Sunday) [red];
    \end{tikzpicture}
  `, { localSourceResolver: fakeResolver });

  const command = report.commands.find((entry) => entry.name === "\\calendar");
  const dependency = report.dependencies.find((entry) => entry.name === "calendar");
  assert.equal(command.implementedBy, "src/engine/evaluate.js:createCalendar/calendarLayout");
  assert.equal(command.implementationStatus, "partial");
  assert.equal(dependency.localSourceReviewed, true);
  assert.ok(report.options.some((entry) => entry.id === "option:calendar:dates"));
  assert.ok(report.options.some((entry) => entry.id === "option:calendar:week list"));
  assert.ok(report.options.some((entry) => entry.id === "option:calendar:month yshift"));
});

test("semantic audit maps graph commands and graph-wide Cartesian options", () => {
  const report = auditTikzSource(String.raw`
    \usetikzlibrary{graphs}
    \tikz \graph[grow right=1.4cm,branch down=1cm,nodes={draw,circle},edges={thick}] {a -> {b,c} -> d};
  `, { localSourceResolver: fakeResolver });
  const graph = report.commands.find((entry) => entry.name === "\\graph");

  assert.equal(graph.implementedBy, "src/tikz/libraries/graphs.js:expandTikzGraphs");
  assert.equal(graph.implementationStatus, "partial");
  assert.equal(graph.localSource, "/texlive/tikzlibrarygraphs.code.tex");
  assert.ok(report.options.some((entry) => entry.id === "option:graph:grow right"));
  assert.ok(report.options.some((entry) => entry.id === "option:graph:branch down"));
  assert.ok(report.options.some((entry) => entry.id === "option:graph:nodes/draw"));
  assert.ok(report.options.some((entry) => entry.id === "option:graph:edges" && entry.rawValues.includes("{thick}")));
  assert.ok(!report.gate.blockers.some((entry) => entry.includes("command:\\graph")));
});

test("semantic audit inventories tree child options and boolean overrides", () => {
  const report = auditTikzSource(String.raw`
    \usetikzlibrary{trees}
    \begin{tikzpicture}
      \node {root}
        child[missing]
        child[missing=false,level distance=12mm] {node {visible}};
    \end{tikzpicture}
  `, { localSourceResolver: fakeResolver });
  const missing = report.options.find((entry) => entry.id === "option:child:missing");
  const distance = report.options.find((entry) => entry.id === "option:child:level distance");

  assert.deepEqual(missing.rawValues, ["true", "false"]);
  assert.equal(missing.implementedBy, "src/frontend/parser.js:parseNodeTreeChild/parseNodeTreeForeach + src/engine/evaluate.js:createNodeTreeChildren/expandTreeChildForeach");
  assert.deepEqual(distance.rawValues, ["12mm"]);
  assert.ok(report.numbers.some((entry) => entry.id === "number:option:child:12mm"));
});

test("semantic audit maps three-point tree growth to its geometry owner", () => {
  const report = auditTikzSource(String.raw`
    \usetikzlibrary{trees}
    \begin{tikzpicture}[
      level 1/.style={grow via three points={one child at (0,-1) and two children at (-.5,-1.5) and (.5,-1.5)}}
    ]
      \node {root} child {node {a}} child {node {b}} child {node {c}};
    \end{tikzpicture}
  `, { localSourceResolver: fakeResolver });
  const growth = report.options.find((entry) => entry.key === "grow via three points");

  assert.equal(
    growth?.implementedBy,
    "src/tikz/libraries/trees.js:parseGrowViaThreePoints/threePointChildOffset + src/engine/evaluate.js:treeGrowthSpec/treeChildOffset"
  );
});

test("semantic audit maps edge-from-parent templates and node macros to the tree path owner", () => {
  const report = auditTikzSource(String.raw`
    \begin{tikzpicture}[
      edge from parent/.style={draw,thick},
      edge from parent path={(\tikzparentnode.south) -- +(0,-.4\tikzleveldistance) -| (\tikzchildnode.north)}
    ]
      \node {root} child {node {child}};
    \end{tikzpicture}
  `);
  const template = report.options.find((entry) => entry.id === "option:tikzpicture:edge from parent path");
  const style = report.options.find((entry) => entry.id === "option:tikzpicture:edge from parent/.style");
  const parent = report.commands.find((entry) => entry.name === "\\tikzparentnode");
  const child = report.commands.find((entry) => entry.name === "\\tikzchildnode");
  const levelDistance = report.commands.find((entry) => entry.name === "\\tikzleveldistance");

  assert.match(template?.implementedBy || "", /parseEdgeFromParentPathTemplate/);
  assert.match(style?.implementedBy || "", /withImplicitStyleOption/);
  assert.match(parent?.implementedBy || "", /treeEdgeRoute/);
  assert.match(child?.implementedBy || "", /treeEdgeRoute/);
  assert.match(levelDistance?.implementedBy || "", /parseEdgeFromParentPathTemplate/);
  assert.ok(!report.gate.blockers.some((entry) => /tikz(?:parentnode|childnode|leveldistance)/.test(entry)));
});

test("semantic audit inventories multi-variable child foreach declarations", () => {
  const report = auditTikzSource(String.raw`
    \begin{tikzpicture}[grow=down,sibling distance=20mm]
      \node {root}
        child[draw=\tone] foreach \name/\tone in {A/red,B/blue}
          {node[draw=\tone] {\name}};
    \end{tikzpicture}
  `);
  const variables = report.declarations
    .filter((entry) => entry.kind === "foreach-variable")
    .map((entry) => [entry.name, entry.value]);

  assert.deepEqual(variables, [["name", "A/red,B/blue"], ["tone", "A/red,B/blue"]]);
  assert.ok(report.options.some((entry) => entry.id === "option:child:draw" && entry.rawValues.includes("\\tone")));
  assert.ok(report.numbers.some((entry) => entry.literal === "20mm"));
});

test("semantic audit maps named math operators stored in foreach values", () => {
  const report = auditTikzSource(String.raw`
    \begin{tikzpicture}
      \node {$f$} child foreach \op in {\sin,\cos} {node {$\op x$}};
    \end{tikzpicture}
  `);

  for (const name of ["\\sin", "\\cos"]) {
    const command = report.commands.find((entry) => entry.name === name);
    assert.equal(command?.implementedBy, "src/renderers/svg/mathNode.js");
    assert.equal(command?.implementationStatus, "partial");
  }
});

test("semantic audit preserves the PGF-backed MacTeX source for arrows.meta", () => {
  const report = auditTikzSource(String.raw`\usetikzlibrary{arrows.meta}`, {
    localSourceResolver: (_lookup, dependency) => dependency.localSource || null
  });
  const dependency = report.dependencies.find((entry) => entry.name === "arrows.meta");

  assert.equal(
    dependency.localSource,
    "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.meta.code.tex"
  );
  assert.equal(dependency.localSourceFound, true);
  assert.equal(dependency.localSourceReviewed, true);
  assert.equal(
    dependency.implementedBy,
    "src/engine/options.js:parseArrowOption/parseArrowTipSpec/parseArrowTipDimensionSpec/parseArrowTipBending + src/tikz/metrics.js:createArrowTip/latexArrowGeometryFromLineWidth/stealthMetaArrowGeometryFromLineWidth/straightBarbArrowGeometryFromLineWidth/arcBarbArrowGeometryFromLineWidth + src/renderers/svg/paths.js:renderArrowedPath/resolveInlineArrowTipSequence/placeResolvedInlineArrowTips + src/renderers/svg/arrowBending.js:curvedArrowPaint + src/renderers/svg/bounds.js:arrowEndpointBounds"
  );
});

test("semantic audit preserves reviewed PGFPlots library metadata and date label ownership", () => {
  const report = auditTikzSource(String.raw`
    \usepgfplotslibrary{dateplot}
    \usetikzlibrary{pgfplots.dateplot}
    \begin{axis}[date coordinates in=x,date ZERO=1946-06-30,xtick=data,xticklabel={\year}]
    \end{axis}
  `, {
    localSourceResolver: (_lookup, dependency) => dependency.localSource || null
  });
  const pgfplotsDependency = report.dependencies.find((entry) => entry.kind === "pgfplots-library" && entry.name === "dateplot");
  const tikzDependency = report.dependencies.find((entry) => entry.kind === "tikz-library" && entry.name === "pgfplots.dateplot");
  const year = report.commands.find((entry) => entry.name === "\\year");

  assert.match(pgfplotsDependency.localSource, /tikzlibrarypgfplots\.dateplot\.code\.tex$/);
  assert.equal(pgfplotsDependency.localSourceReviewed, true);
  assert.equal(tikzDependency.localSourceReviewed, true);
  assert.equal(year.implementedBy, "src/pgfplots/dateCoordinates.js:formatPgfplotsDateLabel");
  assert.equal(year.implementationStatus, "partial");
});

test("review evidence can satisfy individual semantic features without hiding remaining work", () => {
  const report = auditTikzSource(String.raw`\draw[line width=1pt] (0,0) -- (1,1);`, {
    localSourceResolver: fakeResolver,
    review: {
      features: {
        "command:\\draw": {
          status: "verified",
          evidence: ["test/interpreter.test.js"]
        },
        "option:draw:line width": {
          status: "verified",
          evidence: ["test/options.test.js"]
        }
      }
    }
  });

  assert.equal(report.commands.find((entry) => entry.name === "\\draw").reviewStatus, "verified");
  assert.match(renderAuditMarkdown(report), /Numeric Semantics/);
  assert.equal(report.gate.accepted, false);
});

test("a discovered or listed MacTeX path is not reviewed without semantic source notes", () => {
  const localPath = "/texlive/tikz.sty";
  const withoutNotes = auditTikzSource(String.raw`\usepackage{tikz}`, {
    localSourceResolver: () => localPath,
    review: {
      localSources: [localPath]
    }
  });
  assert.equal(withoutNotes.dependencies[0].localSourceReviewed, false);

  const withNotes = auditTikzSource(String.raw`\usepackage{tikz}`, {
    localSourceResolver: () => localPath,
    review: {
      localSources: [localPath],
      localSourceNotes: {
        [localPath]: {
          symbols: ["\\usepackage", "\\usetikzlibrary"],
          findings: "The package initializes TikZ and delegates library loading by name."
        }
      }
    }
  });
  assert.equal(withNotes.dependencies[0].localSourceReviewed, true);
});

test("audit artifact writing creates missing QA directories without overwriting a review", () => {
  const root = mkdtempSync(path.join(tmpdir(), "tikzkit-case-audit-"));
  const reviewPath = path.join(root, "new", "case", "review.json");
  const outputPath = path.join(root, "new", "case", "audit.md");
  try {
    const report = auditTikzSource(String.raw`\draw (0,0) -- (1,1);`, { localSourceResolver: fakeResolver });
    writeAuditArtifacts({ report, initReviewPath: reviewPath, outputPath });

    assert.equal(existsSync(reviewPath), true);
    assert.equal(existsSync(outputPath), true);
    assert.equal(JSON.parse(readFileSync(reviewPath, "utf8")).caseStatus, "incomplete");
    const auditMarkdown = readFileSync(outputPath, "utf8");
    assert.match(auditMarkdown, /Semantic Audit/);
    assert.ok(!auditMarkdown.endsWith("\n\n"));
    assert.throws(() => writeAuditArtifacts({ report, initReviewPath: reviewPath }), /Refusing to overwrite/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
