"""Measure the colored fixtures from the positioning audit's unmodified capture."""

import argparse
import subprocess
import sys
from pathlib import Path

import numpy as np
import pymupdf
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "native-positioning-targets"))
from audit import csv_out, read, sha
from locate import DPI, MM_PER_BP, PPM, components, point

ROWS = {"outline-anchors": ["zero", "default", "5mm", "fill"],
        "signed-insets": ["+5mm", "-2mm"], "signed-room": ["+5mm", "-2mm"]}


def color(rgb):
    return tuple(np.rint(np.array(rgb) * 255).astype(int)) if rgb is not None else ()


def row_values(case, stage, panel, mode):
    # librsvg/Cairo gives both SVG dialects the same vector reader as the original
    # PDF. Its sub-bp serialization is not the Chrome pixel measurement below.
    if mode == "pdf":
        file = stage / panel["pdfFile"]
        assert sha(file) == panel["pdfSha256"]
        doc = pymupdf.open(file)
    else:
        file = stage / panel["svgFile"]
        assert sha(file) == panel["svgSha256"]
        doc = pymupdf.open(stream=subprocess.check_output(["rsvg-convert", "-f", "pdf", file]), filetype="pdf")
    with doc:
        assert len(doc) == 1
        page = np.array(doc[0].rect)[2:] * MM_PER_BP
        paths = doc[0].get_drawings()
    if mode != "pdf":
        declared = np.array(panel["intrinsicCssPx"]) * 25.4 / 96
        assert max(abs(declared - page)) < .002
        page = declared
    png = stage / panel["file"]
    assert sha(png) == panel["sha256"]
    rgb = np.asarray(Image.open(png).convert("RGB"), dtype=int)
    r, g, b = rgb.transpose(2, 0, 1)
    blue_ink = (b > 225) & (b - np.maximum(r, g) > 35)
    red_ink = (r > 220) & (np.maximum(g, b) < 35)
    blue = [p for p in paths if color(p["color"]) == (0, 0, 255)]
    bodies = blue + [p for p in paths if color(p["fill"]) == (204, 204, 255)]
    labels = ROWS.get(case, [case])
    if case.startswith("double-"):
        # Legacy output may have a smaller second blue box instead of a red pen.
        bodies = [max(blue, key=lambda p: p["rect"].get_area())]
    assert len(bodies) == len(labels), (case, mode, "body count", len(bodies))
    bodies.sort(key=lambda p: p["rect"].y0 + p["rect"].y1)
    boxes = [np.array(p["rect"]) * MM_PER_BP for p in bodies]
    dots = [np.array(p["rect"])*MM_PER_BP for p in paths if color(p["fill"]) == (255, 0, 0)]
    if mode != "pdf" and case in ("outline-anchors", "fill-page"):
        v = panel["vectors"]  # Direct Chrome CTM measurements for these filled shapes.
        direct = sorted((np.array(s["boxMm"]) for s in v if s["fill"] in
                         ("rgb(255, 255, 255)", "rgb(204, 204, 255)")), key=lambda b: point(b)[1])
        assert len(direct) == len(boxes) and np.max(np.abs(np.array(direct)-boxes)) < .003
        boxes = direct
        dots = [np.array(s["boxMm"]) for s in v if s["fill"] == "rgb(255, 0, 0)"]
    ys = [point(box)[1] for box in boxes]
    splits = [0, *[round((a+b)/2*PPM) for a, b in zip(ys, ys[1:])], len(r)]
    sleeves = [p for p in paths if color(p["color"]) == (255, 0, 0)]
    for i, (label, body, box) in enumerate(zip(labels, bodies, boxes)):
        lo, hi = splits[i:i+2]
        y, x = np.nonzero(blue_ink[lo:hi])
        assert len(x), (case, mode, label, "missing blue ink")
        curves = [v for v in body["items"] if v[0] == "c"]
        row = dict(case=case, panel=mode, row=label, pageW=page[0], pageH=page[1],
                   cx=point(box)[0], cy=point(box)[1], pathW=box[2]-box[0], pathH=box[3]-box[1],
                   bluePen=(body["width"] or 0)*MM_PER_BP, inkW=(np.ptp(x)+1)/PPM, inkH=(np.ptp(y)+1)/PPM)
        if case == "outline-anchors":
            def span(bb):
                xx = sorted(point(v)[0] for v in bb)
                assert len(xx) == 2, (case, mode, label, "anchor dots", xx)
                return xx[1] - xx[0]
            row["anchorSpan"] = span([v for v in dots if lo <= point(v)[1]*PPM < hi])
            row["inkAnchorSpan"] = span(components(rgb[lo:hi].astype("uint8"), (255, 0, 0), .3))
        if case.startswith("signed-"):
            row["cubics"] = len(curves)
            row["curveReach"] = max((max(abs(np.array(v[-1])-v[1]))*MM_PER_BP for v in curves), default=0)
        if case.startswith("double-"):
            row.update(bluePasses=len(blue), redPasses=len(sleeves), redPen=None, redPathOffset=None)
            if sleeves:
                assert len(sleeves) == 1
                assert body["items"] == sleeves[0]["items"], (case, mode, "double passes follow different paths")
                row.update(redPen=sleeves[0]["width"]*MM_PER_BP,
                           redPathOffset=max(abs(np.array(sleeves[0]["rect"])*MM_PER_BP-box)))
            assert bool(sleeves) == bool(red_ink.any()), (case, mode, "red vector/paint disagreement")
        yield {k: round(float(v), 5) if isinstance(v, (float, np.number)) else v for k, v in row.items()}


def measure(stage, baseline, require_match):
    cap = read(stage/"capture.json")
    assert cap["dpi"] == DPI and not cap["errors"] and not cap["badRequests"]
    assert sha(stage/"summary.json") == cap["summarySha256"] and read(stage/"summary.json")["gate"]["accepted"]
    old = {e["id"]: e for e in read(baseline/"capture.json")["rows"]} if baseline else {}
    rows, residuals = [], []
    for e in cap["rows"]:
        case = e["id"]
        assert not e["diagnostics"] and not e["exportDiagnostics"] and e["originalPdfInputMatchesSource"]
        assert sha(Path(cap["fixtureRoot"])/e["source"]) == e["sourceSha256"]
        if baseline:
            assert e["sourceSha256"] == old[case]["sourceSha256"]
            for ref in ("pdf", "tikztosvg"):
                assert e["panels"][ref]["sha256"] == old[case]["panels"][ref]["sha256"], (case, ref, "native pixels changed")
        group = [r for mode, p in e["panels"].items() for r in row_values(case, stage, p, mode)]
        for r in group:
            for ref in ("pdf", "tikztosvg"):
                if r["panel"] == ref:
                    continue
                other = next(v for v in group if v["panel"] == ref and v["row"] == r["row"])
                ds = {k: round(r[k]-other[k], 5) if r[k] is not None and other[k] is not None else None
                      for k in r if k not in ("case", "panel", "row")}
                bad = [k for k,v in ds.items() if v is None or abs(v) > (.20 if k.startswith("ink") else .005)]
                residuals.append(dict(case=case, panel=r["panel"], reference=ref, row=r["row"],
                                      differences=" ".join(bad), **ds))
                if r["panel"] in ("pdf", "tikztosvg"):
                    assert not bad, (case, "native references disagree", bad, ds)
        rows.extend(group)
    csv_out(stage/"probe-values.csv", rows)
    csv_out(stage/"probe-residuals.csv", residuals)
    diffs = [r for r in residuals if r["panel"]=="live" and r["reference"]=="pdf" and r["differences"]]
    for r in diffs:
        print(r["case"], r["row"], ":", r["differences"])
    print(cap["revision"], len(rows), "panel/row measurements;", len(diffs), "live rows with differences")
    if require_match and any(r["differences"] for r in residuals):
        raise SystemExit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stage", type=Path)
    parser.add_argument("--baseline", type=Path)
    parser.add_argument("--require-match", action="store_true")
    args = parser.parse_args()
    measure(args.stage, args.baseline, args.require_match)
