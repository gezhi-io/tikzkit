import test from "node:test";
import assert from "node:assert/strict";

import { auditTikzSource, createReviewTemplate, renderAuditMarkdown } from "../scripts/case-semantic-audit.js";

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
    \begin{tikzpicture}\node{\tiny\tt x};\end{tikzpicture}
  `, {
    localSourceResolver: fakeResolver
  });

  const ownerFor = (name) => report.commands.find((entry) => entry.name === name)?.implementedBy;
  assert.equal(ownerFor("\\PreviewBorder"), "src/frontend/latex-shell.js");
  assert.equal(ownerFor("\\setlength"), "src/frontend/latex-shell.js");
  assert.equal(ownerFor("\\tiny"), "src/tex/fontSpec.js");
  assert.equal(ownerFor("\\tt"), "src/tex/fontSpec.js");
  assert.ok(!report.gate.blockers.some((entry) => /PreviewBorder|setlength|tiny|\\tt/.test(entry)));
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
  assert.equal(dependency.implementedBy, "src/engine/options.js:parseArrowOption + src/tikz/metrics.js:createArrowTip");
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
