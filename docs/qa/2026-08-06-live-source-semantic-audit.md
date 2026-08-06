# Live Source Semantic Audit

## Scope

The workbench previously displayed a semantic inventory only for the saved
fixture. Once someone edited the CodeMirror source, the panel could still say
`fixture source only`, which hid the actual package, library, command,
parameter, declaration, numeric, and expression inventory of the source being
rendered.

This slice makes the inventory a companion to the rendered draft. It changes no
TikZ geometry or SVG rendering rule.

## Implementation

- `web/server.js` now exposes `POST /api/audit`, a bounded 1 MB JSON endpoint
  that invokes the existing semantic audit on supplied source and returns only
  public audit fields.
- `web/app.js` starts the browser render and current-source audit together.
  After the render succeeds, the current audit replaces the fixture audit.
- The inventory now marks results as `fixture source`, `current draft`, or
  `render to audit draft`, based on the exact source string that was audited.
- `test/web-server.test.js` covers the current-source request, its observed
  `calc`, `\\draw`, and `very thick` entries, malformed JSON, and a missing
  source field.

## Verification

```bash
node --test test/web-server.test.js
npm run gallery:audit
```

The server suite passes all five tests. The gallery semantic check reports
`fixture-core 288/288 rendered, 0 diagnostics`.

Browser verification used the current worktree at `http://127.0.0.1:5177/`.
After editing a fixture and clicking **Render**, the status reads `source audit
updated` and the inventory summary reads `current draft`, rather than retaining
the fixture-only marker. The direct endpoint check for a draft containing
`\\usetikzlibrary{calc}` and `\\draw[red, very thick]` returned the `calc`
dependency, `\\draw` command, and both draw options.

No MacTeX or `tikztosvg` artifact was regenerated for this slice because it
does not alter the interpreter, renderer, or visible SVG output. The prior
three-renderer baseline remains under
`/private/tmp/tikzkit-qa-feed-forward-after-2026-08-06/`.

## Next Work

Expose source ranges from the audit as editor links so selecting an inventory
row can focus the exact declaration, command, or option in the current draft.
