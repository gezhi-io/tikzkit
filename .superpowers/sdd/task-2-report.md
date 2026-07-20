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

## Review Follow-up

### TDD Evidence

#### RED

Added the focused assertions in `test/web-server.test.js` before changing `web/server.js`.

Command: `node --test test/web-server.test.js` (with permission to bind the ephemeral localhost port)

Observed font failure:

```text
TAP version 13
# Subtest: workbench server exposes browser assets and fixture source without rendering
not ok 1 - workbench server exposes browser assets and fixture source without rendering
error: |
  Expected values to be strictly equal:
  + actual - expected
  + 'application/octet-stream'
  - 'font/woff2'
```

The new `/src/` request then hung on the previous `EISDIR` stream failure instead of returning a response; the RED process was interrupted after confirming the hang.

#### GREEN

Command: `node --test test/web-server.test.js test/web-fixture-catalog.test.js`

Exact result:

```text
TAP version 13
# Subtest: workbench catalog freezes the accepted 30 real cases in order
ok 1 - workbench catalog freezes the accepted 30 real cases in order
  ---
  duration_ms: 4.39325
  type: 'test'
  ...
# Subtest: workbench server exposes browser assets and fixture source without rendering
ok 2 - workbench server exposes browser assets and fixture source without rendering
  ---
  duration_ms: 6023.453458
  type: 'test'
  ...
# Subtest: workbench server rejects allowlisted directories
ok 3 - workbench server rejects allowlisted directories
  ---
  duration_ms: 10.842959
  type: 'test'
  ...
# Subtest: workbench server rejects path traversal
ok 4 - workbench server rejects path traversal
  ---
  duration_ms: 8.17375
  type: 'test'
  ...
1..4
# tests 4
# suites 0
# pass 4
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6083.9065
```

The server now requires a regular file, serves `.woff2`, `.woff`, and `.ttf` with their font MIME types, and handles stream errors without attempting to write response headers twice.

## Symlink Containment Follow-up

### TDD Evidence

#### RED

Added a black-box test using a temporary `outputRoot` containing a symlink to an outside file before changing `web/server.js`.

Command: `node --test test/web-server.test.js`

Exact result:

```text
TAP version 13
# Subtest: workbench server exposes browser assets and fixture source without rendering
ok 1 - workbench server exposes browser assets and fixture source without rendering
  ---
  duration_ms: 6024.278583
  type: 'test'
  ...
# Subtest: workbench server rejects allowlisted directories
ok 2 - workbench server rejects allowlisted directories
  ---
  duration_ms: 12.758375
  type: 'test'
  ...
# Subtest: workbench server rejects artifact symlinks outside the output root
not ok 3 - workbench server rejects artifact symlinks outside the output root
  ---
  duration_ms: 11.907792
  type: 'test'
  location: '/Users/kaiwu/Documents/Codex/2026-06-20/ru/test/web-server.test.js:41:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:

    200 !== 404
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 404
  actual: 200
  operator: 'strictEqual'
  ...
# Subtest: workbench server rejects path traversal
ok 4 - workbench server rejects path traversal
  ---
  duration_ms: 6.286042
  type: 'test'
  ...
1..4
# tests 4
# suites 0
# pass 3
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6095.223708
```

The failing response was `200` for the symlinked outside file; the test also asserted that the body must be empty, so the outside content was not accepted.

#### GREEN

Command: `node --test test/web-server.test.js test/web-fixture-catalog.test.js`

Exact result:

```text
TAP version 13
# Subtest: workbench catalog freezes the accepted 30 real cases in order
ok 1 - workbench catalog freezes the accepted 30 real cases in order
  ---
  duration_ms: 4.376708
  type: 'test'
  ...
# Subtest: workbench server exposes browser assets and fixture source without rendering
ok 2 - workbench server exposes browser assets and fixture source without rendering
  ---
  duration_ms: 6024.837416
  type: 'test'
  ...
# Subtest: workbench server rejects allowlisted directories
ok 3 - workbench server rejects allowlisted directories
  ---
  duration_ms: 14.189
  type: 'test'
  ...
# Subtest: workbench server rejects artifact symlinks outside the output root
ok 4 - workbench server rejects artifact symlinks outside the output root
  ---
  duration_ms: 11.643166
  type: 'test'
  ...
# Subtest: workbench server rejects path traversal
ok 5 - workbench server rejects path traversal
  ---
  duration_ms: 6.041209
  type: 'test'
  ...
1..5
# tests 5
# suites 0
# pass 5
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6096.289958
```

Static routes now re-check containment after resolving both the route root and candidate with `realpath`, including symlinked files and nested symlink directories.
