#!/bin/sh
set -eu
if [ "$#" != 4 ]; then
  echo "usage: sh capture.sh RENDERER_TREE NEW_STAGE PLAYWRIGHT/index.mjs REVISION_LABEL" >&2
  exit 2
fi
F=$(CDPATH= cd "$(dirname "$0")" && pwd)
tree=$1 stage=$2 pw=$3 rev=$4
export PATH="/Library/TeX/texbin:$PATH"
test "$(command -v tikztosvg)" = /Library/TeX/texbin/tikztosvg
test "$(command -v pdflatex)" = /Library/TeX/texbin/pdflatex
test -f "$tree/scripts/render-example-fixtures.js"
test -f "$pw"
mkdir -p "$(dirname "$stage")"
mkdir "$stage"
node "$tree/scripts/render-example-fixtures.js" --fixtures "$F" --output "$stage" \
  --native-reference --native-latex-engine pdflatex --strict-tikztosvg \
  --tikztosvg-engine pdflatex --math-renderer svg-text --no-comparison-grid
TIKZKIT_QA_RERENDER=1 node "$F/../native-positioning-targets/capture.mjs" "$tree" "$stage" "$pw" "$rev"
python3 -B "$F/report.py" measure "$stage"
