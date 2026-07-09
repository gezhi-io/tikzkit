# Task 2: Restore a safe static workbench server

## Scope

- Added `web/server.js` with `createWorkbenchServer(options)`, fixture catalog/source APIs, and a strict static-file allowlist.
- Added `web/index.html` with the required import map and workbench element IDs only; it contains no rendering logic.
- Added black-box server route tests using ephemeral port `0`.
- Verified `package.json` already contains the exact required script, `"web": "node web/server.js"`; left its unrelated dirty changes untouched.
- Did not add server-side TikZ rendering.

## TDD Evidence

### RED

1. Added `test/web-server.test.js` before `web/server.js` existed.
2. Ran `node --test test/web-server.test.js`.
3. Observed the expected failure: `ERR_MODULE_NOT_FOUND` for `web/server.js`.

### GREEN

1. Implemented the allowlisted static server and the static HTML shell.
2. Ran `node --test test/web-server.test.js test/web-fixture-catalog.test.js` with local ephemeral-port permission after the sandbox rejected `listen(127.0.0.1:0)` with `EPERM`.
3. Result: 3 passing tests, 0 failures, 0 open server handles.

## Verification

- `node --test test/web-server.test.js test/web-fixture-catalog.test.js`: pass (3/3).
- `node --check web/server.js`: pass.
- `node --check test/web-server.test.js`: pass.
- Verified each required index element ID appears exactly once.
- `git diff --check`: pass.

## Self-review

- Static routes are restricted to `/src/`, the two browser dependency roots, KaTeX fonts, `/artifacts/`, and the `web/` shell.
- Every candidate path is resolved against its allowed root and rejected when `path.relative()` escapes that root.
- Fixture API responses omit local `sourcePath` and `outputRoot` fields.
- No concerns found within Task 2 scope.
