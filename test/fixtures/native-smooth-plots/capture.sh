#!/bin/sh
set -eu
if [ "$#" != 4 ]; then
  echo "usage: sh capture.sh TREE NEW_STAGE PLAYWRIGHT/index.mjs 75b9b386|after" >&2
  exit 2
fi
F=$(CDPATH= cd "$(dirname "$0")" && pwd)
tree=$(CDPATH= cd "$1" && pwd)
stage=$2 pw=$3 rev=$4
export PATH="/Library/TeX/texbin:$PATH"
test "$(command -v pdflatex)" = /Library/TeX/texbin/pdflatex
test "$(command -v tikztosvg)" = /Library/TeX/texbin/tikztosvg
command -v rsvg-convert >/dev/null
test -f "$pw"
case "$rev" in 75b9b386|after) ;; *) exit 2 ;; esac
mkdir -p "$(dirname "$stage")"
mkdir "$stage"
node "$tree/scripts/render-example-fixtures.js" --fixtures "$F" --output "$stage" \
  --native-reference --native-latex-engine pdflatex --strict-tikztosvg \
  --tikztosvg-engine pdflatex --math-renderer svg-text --no-comparison-grid
TIKZKIT_QA_RERENDER=1 node "$F/../native-positioning-targets/capture.mjs" "$tree" "$stage" "$pw" "$rev"
if [ "$rev" = after ]; then
  node "$F/routes.mjs" "$stage" "$pw"
fi
python3 -B "$F/report.py" measure "$stage"
