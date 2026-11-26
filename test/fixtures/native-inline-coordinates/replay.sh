#!/bin/sh
set -eu

usage() { echo "usage: sh replay.sh before|after [QA_OUTPUT_ROOT [AFTER_ATTEMPT_NAME]]  (optional: PW=/path/to/playwright/index.mjs)" >&2; exit 2; }
case ${1:-} in before|after) phase=$1 ;; *) usage ;; esac
[ "$#" -le 3 ] || usage
attempt=${3:-$phase}
case "$attempt" in ""|.*|*/*) usage ;; esac
if [ "$#" = 3 ] && [ "$phase" != after ]; then usage; fi
fixtures=$(CDPATH= cd "$(dirname "$0")" && pwd)
repo=$(CDPATH= cd "$fixtures/../../.." && pwd)
qa=${2:-"$repo/outputs/qa/2026-11-26-inline-coordinates"}
stage="$qa/$attempt"
if [ -e "$stage" ]; then echo "Refusing to overwrite $stage; choose a fresh QA root." >&2; exit 1; fi
if [ "$phase" = after ] && [ ! -s "$qa/before/measurements.json" ]; then
  echo "Missing measured before stage: $qa/before" >&2; exit 1
fi
export PATH="/Library/TeX/texbin:$PATH"
for tool in tikztosvg pdflatex; do
  [ "$(command -v "$tool")" = "/Library/TeX/texbin/$tool" ] || exit 1
done
command -v rsvg-convert >/dev/null
command -v pdftocairo >/dev/null
python3 -B -c 'import fitz, numpy, PIL, scipy.spatial'
if [ -z "${PW:-}" ]; then
  for p in "$repo/node_modules/playwright/index.mjs" "$HOME"/.npm/_npx/*/node_modules/playwright/index.mjs; do
    if [ -f "$p" ]; then PW=$p; break; fi
  done
fi
[ -f "${PW:-}" ] || { echo "Set PW to the installed Playwright index.mjs. No packages are installed by this script." >&2; exit 1; }

rev=8d1bdbdab8c4ac38facc84fab83e05f8617f25d6
driver=test/fixtures/native-positioning-targets/capture.mjs
if [ "$phase" = before ]; then
  tree=$(mktemp -d "${TMPDIR:-/tmp}/tikzkit-inline-8d1bdbda.XXXXXX")
  git -C "$repo" archive --format=tar --output="$tree/baseline.tar" "$rev" \
    bin package.json package-lock.json scripts src web "$driver"
  [ "$(git get-tar-commit-id < "$tree/baseline.tar")" = "$rev" ]
  tar -xf "$tree/baseline.tar" -C "$tree"
  ln -s "$repo/node_modules" "$tree/node_modules"
else
  tree=$repo
  rev=after
fi
mkdir -p "$qa"
mkdir "$stage"
node "$tree/scripts/render-example-fixtures.js" --fixtures "$fixtures" --output "$stage" \
  --native-reference --native-latex-engine pdflatex --strict-tikztosvg \
  --tikztosvg-engine pdflatex --no-comparison-grid --math-renderer svg-text
TIKZKIT_QA_RERENDER=1 node "$tree/$driver" "$tree" "$stage" "$PW" "$rev"
if [ "$phase" = after ]; then
  python3 -B "$fixtures/check.py" "$stage" --before "$qa/before"
else
  python3 -B "$fixtures/check.py" "$stage"
fi
