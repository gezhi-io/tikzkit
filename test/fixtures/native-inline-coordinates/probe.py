"""Isolate the return-wire residual without changing any primary fixture."""
import argparse
import json
import os
import subprocess
from pathlib import Path

from check import GND, HERE, read_json, sha, vectors


def replace_once(source, old, new):
    assert source.count(old) == 1, old
    return source.replace(old, new)


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("output", type=Path, help="new, empty output location")
    cli.add_argument("baseline", type=Path, help="the extracted baseline renderer tree")
    args = cli.parse_args()
    root, base, repo = args.output.resolve(), args.baseline.resolve(), HERE.parents[2]
    root.mkdir(parents=True, exist_ok=False)
    inputs = root/"inputs"
    inputs.mkdir()
    original = (HERE/(GND+".tex")).read_text()
    nodes = replace_once(original, "coordinate[label=left:FB] (FB)", "node[shape=coordinate,label=left:FB] (FB) {}")
    nodes = replace_once(nodes, "coordinate[pground] (PE)", "node[pground] (PE) {}")
    cases = {"explicit-nodes": nodes, "absolute-return": replace_once(original, "-- ++(1,0)", "-- (2,0)")}
    for case, tex in cases.items():
        (inputs/(case+".tex")).write_text(tex)
    (inputs/"manifest.json").write_text(json.dumps({"version": 1, "cases": [
        {"id": c, "title": c, "source": c+".tex"} for c in cases]}))
    (inputs/"milestone-1.json").write_text(json.dumps({"sourceManifest": "manifest.json", "caseIds": list(cases)}))
    env = {**os.environ, "PATH": "/Library/TeX/texbin:"+os.environ["PATH"], "TIKZKIT_QA_RERENDER": "1"}
    run = lambda cmd: subprocess.run(cmd, check=True, env=env)
    stage = root/"captured"
    run(["node", repo/"scripts/render-example-fixtures.js", "--fixtures", inputs, "--output", stage,
         "--native-reference", "--native-latex-engine", "pdflatex", "--strict-tikztosvg",
         "--tikztosvg-engine", "pdflatex", "--no-comparison-grid", "--math-renderer", "svg-text"])
    run(["node", repo/"test/fixtures/native-positioning-targets/capture.mjs", repo, stage, env["PW"], "controls"])
    cap = read_json(stage/"capture.json")
    frozen = root/"frozen-cli"
    frozen.mkdir()
    report = {"browser": cap["browser"], "rendererSha256": cap["environment"]["rendererSha256"], "cases": {}}
    for row in cap["rows"]:
        case, panels = row["id"], row["panels"]
        src = inputs/(case+".tex")
        assert sha(src) == row["sourceSha256"] and row["originalPdfInputMatchesSource"]
        assert row["editorRenderClicked"] and row["previousSvgDetached"]
        historical = frozen/(case+".svg")
        run(["node", base/"bin/tikz2svg.js", src, "-o", historical, "--svg-text-math"])
        files = {p: stage/(v["pdfFile"] if p == "pdf" else v["svgFile"]) for p, v in panels.items()}
        files["frozen-cli"] = historical
        results = {p: {"file": str(f.relative_to(root)), "geometry": vectors(GND, f)} for p, f in files.items()}
        assert all(t["pass"] for p in ("pdf", "tikztosvg") for t in results[p]["geometry"].values())
        report["cases"][case] = {"editorDiagnostics": row["diagnostics"], "panels": results}
        print(case, {p: r["geometry"]["teal wire"]["maxAbsMm"] for p, r in results.items()})
    (root/"measurements.json").write_text(json.dumps(report, indent=2)+"\n")


if __name__ == "__main__":
    main()
