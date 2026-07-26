# Case-driven semantic acceptance

TikZKit treats each real TikZ example as a compiler compatibility contract, not
as a screenshot-only target.

Before implementation, run:

```sh
npm run case:audit -- path/to/case.tex --output outputs/case-audit.md
```

Create a non-destructive review checklist beside it:

```sh
npm run case:audit -- path/to/case.tex \
  --output outputs/case-audit.md \
  --init-review outputs/case-review.json
```

The report inventories:

- every `\usepackage`, `\usetikzlibrary`, and `\usepgfplotslibrary` dependency;
- the exact local MacTeX/TeX Live source found with `kpsewhich`;
- every command and environment, with its current JavaScript owner;
- nested option keys and all observed raw values;
- source macros, `\foreach` variables, colors, and math variables;
- numeric literals and dimensions, grouped by semantic context;
- `\addplot` and `\addplot3` expressions.

An audit is intentionally incomplete until a review JSON records each semantic
feature as `verified`, `implemented`, `native-noop`, or `not-applicable`.
Implemented and verified features must name test or artifact evidence.
The generated `localSourceCandidates` are discovery results, not proof of
review. Move only inspected files into `localSources`, add a non-empty
`localSourceNotes` entry naming the macros/keys read and the semantic finding,
and finally set `"caseStatus": "accepted"`.

Prefix rules can share one piece of evidence while the report continues to
show every matched parameter or number individually:

```json
{
  "rules": [
    {
      "match": "number:expression:addplot:1:*",
      "status": "verified",
      "evidence": [
        "test/pgfplots-seams.test.js"
      ]
    }
  ]
}
```

Example review fragment:

```json
{
  "caseStatus": "accepted",
  "localSources": [
    "/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex"
  ],
  "localSourceNotes": {
    "/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex": {
      "symbols": [
        "/pgfplots/axis x line",
        "/pgfplots/enlargelimits"
      ],
      "findings": "The unstarred middle-axis key delegates to the starred placement and also changes tick placement."
    }
  },
  "features": {
    "command:\\addplot": {
      "status": "verified",
      "implementedBy": "src/pgfplots/addplotParser.js",
      "evidence": [
        "test/pgfplots-seams.test.js",
        "outputs/qa-example/sheet.png"
      ]
    },
    "option:axis:xmin": {
      "status": "verified",
      "evidence": [
        "test/pgfplots-seams.test.js"
      ]
    }
  }
}
```

Use `--strict` in acceptance runs. It exits unsuccessfully when a dependency
source was not found, a command has no implementation owner, a semantic item
has not been reviewed, or claimed implementation lacks evidence:

```sh
npm run case:audit -- path/to/case.tex --review path/to/review.json --strict
```

The visual comparison remains required, but it is the final validation step.
The audit first establishes what the source asks TikZ to do and where each
behavior belongs in TikZKit.
