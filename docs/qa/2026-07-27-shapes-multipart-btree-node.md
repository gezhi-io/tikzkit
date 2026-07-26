# shapes.multipart: `b-tree-node` math-size QA

## Scope

This slice covers horizontal `rectangle split` nodes, `\nodepart` anchors,
per-part fills, and the text/script/scriptscript size transition used by the
external B-tree labels. It does not claim support for arbitrary multipart
shapes or complete TeX box metrics.

## Local MacTeX review

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryshapes.multipart.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.multipart.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/latex/base/fontmath.ltx`
- `/usr/local/texlive/2025/texmf-dist/tex/latex/base/size10.clo`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryarrows.code.tex`

The TikZ library forwards `rectangle split/parts`, part alignment, and
part-fill keys to PGF's boxed part implementation. `fontmath.ltx` declares
the normal 10pt math triplet as text/script/scriptscript = 10/7/5; the 5pt
floor remains 5/5/5. The renderer previously used `0.78` for both styles,
which made `\scriptscriptstyle` labels oversized.

## Artifacts

- MacTeX native PNG: `outputs/qa-shapes-multipart-btree-node/native-mactex/b-tree-node.png`
- TikZKit SVG/PNG: `outputs/qa-shapes-multipart-btree-node/tikzkit.svg`, `outputs/qa-shapes-multipart-btree-node/tikzkit-grid.png`
- tikztosvg SVG/PNG: `outputs/qa-shapes-multipart-btree-node/tikztosvg.svg`, `outputs/qa-shapes-multipart-btree-node/tikztosvg-grid.png`
- Two-renderer visual sheet: `outputs/qa-shapes-multipart-btree-node/tikzkit-tikztosvg-diff-sheet.png`

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. The reference SVG has a `0 0 208.45 50.6`
viewBox and path-converted TeX glyphs. TikZKit keeps text as `<text>` nodes,
so outlines differ, but the investigated geometry must agree independently of
that rasterization difference.

## Visual result

Before the change, TikZKit was 283x65px while tikztosvg was 278x68px. The
external `isLeaf`, `key_i`, and `c_i` labels were visibly too large, widening
the scene and crowding the arrows. After applying the 10/7/5 mapping, the
TikZKit width is 278px, equal to tikztosvg. The horizontal split cells,
centered values, named part anchors, black start dots, and arrow endpoints
remain in their previous locations. TikZKit is still four pixels shorter in
the raster bounding box because browser text bounds and TeX path outlines
have different ascender/depth coverage; this is recorded rather than hidden.

The regression panel for `equilateral-triangle-heights` also retains matching
triangle geometry and `\scriptstyle` height labels.

## Verification

```sh
node --test test/math-style-scale.test.js
node --test --test-name-pattern "optically centers rectangle split text|matches PGF horizontal split" test/interpreter.test.js
npm run case:audit -- test/fixtures/examples/latex-examples/b-tree-node.tex \
  --review outputs/semantic-audits/b-tree-node.review.json \
  --output outputs/semantic-audits/b-tree-node.md --strict
```

`test/font-spec.test.js` still has one pre-existing failure in the unrelated
inline-path font-source precedence assertion. The size-table, tiny text, and
multipart targeted tests pass.

## Next

Measure SVG text ascender/depth from the bundled Computer Modern font tables
so the remaining four-pixel height difference can be resolved without adding
arbitrary bounding-box padding.
