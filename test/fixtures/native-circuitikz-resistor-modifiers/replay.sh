#!/usr/bin/env bash
# Run locally; never replace an existing evidence directory.
set -euo pipefail
fixture=$(cd "$(dirname "$0")" && pwd)
root=$(git -C "$fixture" rev-parse --show-toplevel)
mode=${1:?before or after}; stage=${2:?absolute new output directory}; tree="$stage.renderer"
pw=${PLAYWRIGHT_INDEX_MJS:?absolute path to the local playwright/index.mjs}
export PATH="/Library/TeX/texbin:$PATH"
[[ $stage = /* && ! -e $stage && ! -e $tree && -f $pw ]] || { echo "Expected a new absolute output path and local Playwright" >&2; exit 2; }
parts=(src web scripts package.json package-lock.json)
args=()
case "$mode" in
    before) mkdir -p "$tree"; git -C "$root" archive 6f251f72 "${parts[@]}" | tar -x -C "$tree" ;;
    after) base=${3:?absolute measured before directory}; [[ -f "$base/pages.csv" ]]
           mkdir -p "$tree"; for p in "${parts[@]}"; do cp -R "$root/$p" "$tree/"; done
           args=(--before "$base") ;;
    *) exit 2 ;;
esac
rsync -a "$root/node_modules" "$tree/"
node "$tree/scripts/render-example-fixtures.js" --fixtures "$fixture/catalog" --output "$stage" \
    --native-reference --native-latex-engine pdflatex --strict-tikztosvg --tikztosvg-engine pdflatex \
    --math-renderer svg-text --no-comparison-grid
TIKZKIT_QA_RERENDER=1 node "$fixture/../native-positioning-targets/capture.mjs" "$tree" "$stage" "$pw" "$mode"
status=0
if [[ $mode = after ]]; then
    python3 -B "$fixture/check.py" "$stage" "${args[@]}" --require-all || status=$?
    python3 -B "$fixture/proof.py" "$stage" "${args[@]}"
else
    python3 -B "$fixture/check.py" "$stage"
    python3 -B "$fixture/proof.py" "$stage"
fi
exit "$status"
