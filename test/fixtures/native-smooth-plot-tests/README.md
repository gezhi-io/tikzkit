# TikZ smooth plot oracle

`cases.tex` is the common input to both interpreters. `texlive-2025.trace` is
unmodified output from `oracle.tex` under pdfTeX 1.40.28, TeX Live 2025,
PGF 3.1.11a. No renderer code or PDF path reconstruction generates expectations.

From the repository root:

```sh
node --test test/smooth-plots-native.test.js
TIKZKIT_TEST_PDFLATEX=1 node --test test/smooth-plots-native.test.js
```

The second command additionally compiles the same sources and compares the
entire native trace. For a standalone TeX replay, run in this fixture directory:

```sh
out=$(mktemp -d)
pdflatex -no-shell-escape -halt-on-error -output-directory="$out" oracle.tex
diff -u texlive-2025.trace "$out/oracle.trace"
pdflatex -no-shell-escape -halt-on-error -output-directory="$out" paper.tex
pdfinfo -box -f 1 -l 3 "$out/paper.pdf"
```

## What was measured

- Each `PATH` is one TikZ path at the same observation point as `save path`.
  `M L C Z` are native softpath operations, including repeated moves, repeated
  endpoints and endpoint-coincident control points. All payloads are **integer sp**.
- `BOX` is PGF's final picture min x/y and max x/y in **TeX pt**. `SIZE` is
  the actual TeX box width and height plus depth, measured with no border.
  For an empty box the tests check absence of geometry, not the application's
  empty-document viewport. Move-only boxes are checked normally.
- For samples A, B: open 0/1/2 emits nothing, `M A`, `M A C A B B`;
  closed 0/1/2 emits nothing, nothing, `M B`. With 3+ samples a closed plot
  moves to B even after `-- plot`, curves back through A to B, then closes.
  Open `-- plot` connects to A; plain `plot` starts a subpath at A. A later
  `-- cycle` therefore closes to different points in those two cases.
- In the explicit-list probes, both `+` and `++` use the saved pre-plot base.
  After a plot the last input supplies the relative base (origin for empty
  input), independently of the emitted path. In `plot-local-transform` the
  last cubic ends at (22,8)pt, a zero-offset move lands at (8,-3)pt and the
  following `++(1,2)` lands at (10,3)pt in the restored outer basis.
- Repeated inputs are retained, including a final A in a closed list. Zero
  tension still emits cubic commands; negative tension reverses the supports.
  The tension-6 cases measure supports outside the sample bounds with no clamp.
  The plotting macros can be inspected locally in `pgflibraryplothandlers.code.tex`
  (open/closed handlers and `\pgfsetplottension`) and `tikz.code.tex`
  (`\tikz@plot@scan@points`, `\tikz@@@plot`).

## Legacy tension=1

The exact input from the interpreter regression is reproduced in
`legacy-tension-one`. Each triple is (first control x, second control x, end x).

| Cubic | Measured sp | In units of the scanned TikZ cm basis |
| --- | --- | --- |
| 1 | 0, 829796, 1864679 | 0, 0.445007424870, 1 |
| 2 | 2899562, 2694475, 3729358 | 1.554992575130, 1.445007424870, 2 |
| 3 | 4764241, 5594037, 5594037 | 2.554992575130, 3, 3 |

TeX scanned `1cm = 1864679sp` and `1pt = 65536sp`. The last column divides
by **1864679**. For physical cm, multiply the integer sp by
`2.54 / (72.27 * 65536)` instead (e.g. **0.445007231319 cm** for 829796sp).
The tests compare physical coordinates within four sp; the old literal
`0.445 cm` misses by more than thirteen sp.

## Physical cross-check

The optional `paper.tex` uses the same pictures without the trace hooks. PDF
points are bp (72/in), not TeX pt (72.27/in).

| Picture | Native TeX width x height (pt) | Standalone PDF width x height (bp) |
| --- | --- | --- |
| tension-large-open | 268.39648 x 145.24890 | 267.394 x 144.706 |
| tension-large-closed | 318.39648 x 145.24890 | 317.207 x 144.706 |
| ordinary-plot | 21 x 15 | 20.922 x 14.944 |
