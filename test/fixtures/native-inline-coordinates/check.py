"""Independent physical-page checks for the three editable coordinate fixtures."""
import argparse
import hashlib
import json
import os
import subprocess
from pathlib import Path

import fitz
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.spatial import cKDTree


HERE = Path(__file__).resolve().parent
BASE = "8d1bdbdab8c4ac38facc84fab83e05f8617f25d6"
DPI = 384
PX_MM = 25.4 / DPI
BP_MM = 25.4 / 72
BORDER = 2 * 25.4 / 72.27  # standalone's two TeX pt
VECTOR_TOL = 0.02
RGB = {"red": (255, 0, 0), "blue": (0, 0, 255), "orange": (255, 128, 0),
       "teal": (0, 128, 128), "magenta": (255, 0, 255), "black": (0, 0, 0)}

# Fixed unpainted frames and takeoff endpoints, in source millimetres, Y up.
MID, TAP, GND = "manual-named-midpoint", "shifted-test-point", "tutorial-feedback-ground"
FRAMES = {MID: (-4, -10, 40, 18), TAP: (-4, -3, 36, 26), GND: (-2, -7, 30, 34)}
WIRES = {
    MID: {"red": (0, 0, 20, 10), "blue": (10, 5, 10, 13)},
    TAP: {"red": (8, 10, 8, 14), "blue": (16, 0, 16, 4),
          "orange": (20, 15, 27, 15), "teal": (20, 15, 20, 18.5)},
    GND: {"blue": (10, 20, 25, 20), "red": (10, 0, 2, 0), "teal": (20, 0, 20, 6)},
}


def read_json(path):
    return json.loads(path.read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def page_box(case, endpoints):
    left, _, _, top = FRAMES[case]
    x, y, u, v = endpoints
    return [min(x, u)-left+BORDER, top-max(y, v)+BORDER,
            max(x, u)-left+BORDER, top-min(y, v)+BORDER]


def difference(wanted, observed):
    same_shape = np.shape(wanted) == np.shape(observed)
    delta = float(np.max(np.abs(np.array(wanted) - observed))) if same_shape else None
    return {"expectedMm": np.round(wanted, 5).tolist(), "observedMm": observed,
            "maxAbsMm": None if delta is None else round(delta, 5),
            "pass": delta is not None and delta <= VECTOR_TOL}


def vectors(case, file):
    # Let librsvg apply the SVG viewport and all transforms at declared size.
    # For the original PDF read its actual page and paths, not a converted SVG.
    doc = (fitz.open(file) if file.suffix == ".pdf" else
           fitz.open(stream=subprocess.check_output(["rsvg-convert", "--format", "pdf", str(file)]),
                     filetype="pdf"))
    with doc:
        assert len(doc) == 1
        page = doc[0]
        assert page.rotation == 0 and page.cropbox == page.mediabox
        left, bottom, right, top = FRAMES[case]
        mm = lambda pts: np.round(np.array(pts) * BP_MM, 5).tolist()
        checks = {"page": difference([right-left+2*BORDER, top-bottom+2*BORDER],
                                     mm([page.rect.width, page.rect.height]))}
        strokes = [s for s in page.get_drawings() if s["color"] is not None and "s" in s["type"]]

        def colored(pen):
            return [s for s in strokes if max(abs(np.array(s["color"])*255-RGB[pen])) < 2]

        boxes = {}
        for pen, line in WIRES[case].items():
            rects = [s["rect"] for s in colored(pen)]
            boxes[pen] = mm([min(r.x0 for r in rects), min(r.y0 for r in rects),
                             max(r.x1 for r in rects), max(r.y1 for r in rects)]) if rects else []
            checks[pen+" wire"] = difference(page_box(case, line), boxes[pen])
        if case == TAP:
            rails = {}
            for stroke in colored("black"):
                for item in stroke["items"]:
                    if item[0] != "l":
                        continue
                    (x, y), (u, v) = item[1:3]
                    if abs(y-v)*BP_MM < 0.002 and x != u:
                        key = round(y*BP_MM, 3)
                        rails.setdefault(key, []).extend([x, u])
            measured = [[round(min(xs)*BP_MM, 5), y, round(max(xs)*BP_MM, 5), y]
                        for y, xs in sorted(rails.items())]
            checks["three uninterrupted rails"] = difference(
                [page_box(case, (0, y, 32, y)) for y in (20, 10, 0)], measured)
            # The horizontal lead starts at east; the upward lead starts at north.
            a, b = boxes["orange"], boxes["teal"]
            checks["east minus north"] = difference([0, 0], [] if not a or not b else
                                                    [round(a[0]-b[0], 5), round(a[1]-b[3], 5)])
        if case == GND:
            ground_y = page_box(case, (10, 0, 10, 0))[1]
            rings, stem, bars = [], [], []
            for stroke in colored("black"):
                if any(op[0] == "c" for op in stroke["items"]):
                    rings.append(mm(stroke["rect"]))
                for item in stroke["items"]:
                    if item[0] != "l":
                        continue
                    (x, y), (u, v) = item[1:3]
                    box = mm([min(x, u), min(y, v), max(x, u), max(y, v)])
                    if abs(x-u)*BP_MM < 0.002 and abs(ground_y-box[1]) < VECTOR_TOL and box[3] > ground_y+1:
                        stem.append(box)
                    if abs(y-v)*BP_MM < 0.002 and box[1] > ground_y+.5 and x != u:
                        bars.append(box)
            # CircuitikZ uses a 3.5 mm ground step and a 0.9-step radius.
            checks["one ground ring"] = difference([page_box(case, (6.85, -6.3, 13.15, 0))], rings)
            checks["ground stem from PE"] = difference([page_box(case, (10, 0, 10, -3.5))], stem)
            checks["three ground bars"] = difference(
                [page_box(case, (10-half, y, 10+half, y)) for y, half in [(-3.5, 2.1), (-4.2, 1.4), (-4.9, .875)]],
                sorted(bars, key=lambda b: b[1]))
        return checks


def white_rgb(file):
    with Image.open(file) as im:
        rgba = im.convert("RGBA")
        out = Image.new("RGB", im.size, "white")
        out.paste(rgba, mask=rgba.getchannel("A"))
        return out


def raster_pair(ref, observed):
    # Full physical pages; pad right/bottom only. Never register ink or rescale.
    size = np.maximum(ref.size, observed.size)
    def padded(img):
        page = Image.new("RGB", tuple(size), "white")
        page.paste(img, (0, 0))
        return np.asarray(page, dtype=np.int16)
    return padded(ref), padded(observed)


def mask(rgb, pen):
    if pen == "black":
        return (rgb.max(axis=2) < 160) & (np.ptp(rgb, axis=2) < 20)
    return (np.ptp(rgb, axis=2) > 70) & (np.max(np.abs(rgb-RGB[pen]), axis=2) <= 65)


def paint(case, ref, observed):
    r, o = raster_pair(ref, observed)
    raw_diff = int(np.count_nonzero(np.max(np.abs(r-o), axis=2) > 16))
    features = [(p+" wire", p, None, False, 0.20) for p in WIRES[case]]
    if case == MID:
        features += [("straight segment label", "black", None, False, 0.50)]
    if case == TAP:
        features += [("all three rails", "black", None, False, 0.20),
                     ("no coordinate outline", "magenta", None, True, 0)]
    if case == GND:
        features += [
            ("FB label", "black", (0, 16, 9.5, 24), False, 0.50),
            ("protective ring, stem and bars", "black", (5.5, -6.8, 14.5, .45), False, 0.20),
            ("return bridge", "black", (10.4, -.15, 19.8, .15), False, 0.20),
            ("no ground on RET", "black", (16, -6.8, 24, -.18), True, 0),
        ]
    checks = {}
    for name, pen, region, blank, tolerance in features:
        a, b = mask(r, pen), mask(o, pen)
        if region:
            x, y, u, v = np.rint(np.array(page_box(case, region))/PX_MM).astype(int)
            a, b = a[y:v, x:u], b[y:v, x:u]
        a, b = np.argwhere(a), np.argwhere(b)
        assert bool(len(a)) != blank, f"Invalid native ink control: {case}: {name}"
        distance = None
        if len(a) and len(b):
            distance = max(cKDTree(a).query(b)[0].max(), cKDTree(b).query(a)[0].max()) * PX_MM
        checks[name] = {"pdfPixels": len(a), "observedPixels": len(b), "toleranceMm": tolerance,
                        "maxNearestInkMm": None if distance is None else round(float(distance), 4),
                        "pass": bool(not len(b) if blank else distance is not None and distance <= tolerance)}
    return checks, raw_diff


def measure(stage, before):
    cap, strict = read_json(stage/"capture.json"), read_json(stage/"summary.json")
    assert cap["revision"] == ("after" if before else BASE)
    assert cap["dpi"] == DPI and not cap["errors"] and not cap["badRequests"]
    assert cap["summarySha256"] == sha(stage/"summary.json") and strict["gate"]["accepted"]
    assert strict["comparisonGridMode"] == "none" and strict["tikztosvgEngine"] == "pdflatex"
    assert strict["nativeReferenceRequested"] and strict["nativeLatexEngine"] == "pdflatex"
    manifest = read_json(HERE/"manifest.json")["cases"]
    assert [c["id"] for c in manifest] == [row["id"] for row in cap["rows"]] == list(FRAMES)
    assert read_json(HERE/"milestone-1.json")["caseIds"] == list(FRAMES)
    old = read_json(before/"capture.json") if before else None
    if old:
        assert old["revision"] == BASE and old["browser"] == cap["browser"] and old["dpi"] == DPI
        for key in ("fontsSha256", "externalFontInventorySha256"):
            assert old["environment"][key] == cap["environment"][key], key
    cases = {}
    for i, (fixture, row) in enumerate(zip(manifest, cap["rows"])):
        case, panels = row["id"], row["panels"]
        entry = next(e for e in strict["cases"] if e["id"] == case)
        assert entry["referenceKind"] == "tikztosvg" and entry["mactexPngStatus"] == "rendered"
        assert entry["fingerprints"]["referenceProvenance"]["independentNumerics"]
        assert entry["fingerprints"]["referenceProvenance"]["tools"]["kind"] == "local-tools"
        assert entry["fingerprints"]["manifestSha256"] == sha(HERE/"manifest.json")
        assert row["editorRenderClicked"] and row["previousSvgDetached"] and row["originalPdfInputMatchesSource"]
        assert sha(HERE/fixture["source"]) == row["sourceSha256"] == sha(stage/".mactex-work"/case/"reference.tex")
        if old:
            prior = old["rows"][i]
            assert (prior["id"], prior["sourceSha256"]) == (case, row["sourceSha256"])
            for route in ("pdf", "tikztosvg"):
                assert prior["panels"][route]["sha256"] == panels[route]["sha256"], (case, route, "reference changed")
            assert prior["panels"]["tikztosvg"]["svgSha256"] == panels["tikztosvg"]["svgSha256"]
        ref = white_rgb(stage/panels["pdf"]["file"])
        results = {}
        for route in ("pdf", "tikztosvg", "live", "download", "export"):
            p = panels[route]
            page = stage / (p["pdfFile"] if route == "pdf" else p["svgFile"])
            assert sha(page) == p.get("pdfSha256", p.get("svgSha256"))
            assert sha(stage/p["file"]) == p["sha256"]
            geometry = vectors(case, page)
            ink, diff = paint(case, ref, white_rgb(stage/p["file"]))
            failures = [f"{kind}: {k}" for kind, tests in [("vector", geometry), ("ink", ink)]
                        for k, t in tests.items() if not t["pass"]]
            results[route] = {"geometry": geometry, "ink": ink, "differentPixelsVsPdf": diff, "failures": failures}
        cases[case] = {"panels": results, "editorDiagnostics": row["diagnostics"],
                       "exportDiagnostics": row["exportDiagnostics"]}
    return {"revision": cap["revision"], "rendererSha256": cap["environment"]["rendererSha256"],
            "browser": cap["browser"], "dpi": DPI, "vectorToleranceMm": VECTOR_TOL, "cases": cases}


def sheet(stage, before):
    columns = [(stage, "pdf", "MacTeX PDF"), (stage, "tikztosvg", "Strict tikztosvg")]
    if before:
        columns.append((before, "live", "Frozen Render"))
    tag = "After" if before else "Frozen"
    columns += [(stage, "live", tag+" Render"), (stage, "download", tag+" Download")]
    cell = 352
    images = [[white_rgb(s/"capture"/p/(c+".png")) for s, p, _ in columns] for c in FRAMES]
    heights = [max(im.height for im in row)//2 + 39 for row in images]
    board = Image.new("RGB", (cell*len(columns)+10, sum(heights)+45), "#eeeeee")
    d = ImageDraw.Draw(board)
    font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
    for i, (_, _, label) in enumerate(columns):
        d.text((10+i*cell, 10), label, fill="black", font=font)
    y = 40
    for case, row, height in zip(FRAMES, images, heights):
        d.text((10, y), case, fill="black", font=font)
        for i, im in enumerate(row):
            board.paste(im.resize((im.width//2, im.height//2), Image.Resampling.LANCZOS), (10+i*cell, y+25))
        y += height
    board.save(stage/"proof.png")


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("stage", type=Path)
    cli.add_argument("--before", type=Path, help="required when measuring a captured after stage")
    args = cli.parse_args()
    stage, before = args.stage, args.before
    if before:
        frozen = measure(before, None)
        for row in frozen["cases"].values():
            p = row["panels"]
            assert all(not p[n]["failures"] for n in ("pdf", "tikztosvg"))
            assert all(p[n]["failures"] for n in ("live", "download"))
    result = measure(stage, before)
    accepted, lines = True, ["# Physical coordinate checks", "",
        f"Chrome {result['browser']}; {DPI} dpi; revision `{result['revision']}`.", "",
        "[Comparison sheet](proof.png) | [Physical measurements](measurements.json) | [Chrome capture](capture.json)", "",
        "| Editable fixture | MacTeX PDF | Strict SVG | Render | Reopened Download | Editor diagnostics |",
        "|---|---|---|---|---|---:|"]
    for case, row in result["cases"].items():
        p = row["panels"]
        status = lambda route: "FAIL" if p[route]["failures"] else "PASS"
        native = all(not p[k]["failures"] for k in ("pdf", "tikztosvg"))
        if before:
            ok = all(not p[k]["failures"] for k in ("live", "download", "export"))
            ok = ok and not row["editorDiagnostics"] and not row["exportDiagnostics"]
        else:
            ok = all(p[k]["failures"] for k in ("live", "download"))
        accepted = accepted and native and ok
        prefix = os.path.relpath(HERE, stage)
        lines.append(f"| [{case}]({prefix}/{case}.tex) | [{status('pdf')}](capture/pdf/{case}.pdf) | "
                     f"[{status('tikztosvg')}](tikztosvg-svg/{case}.svg) | [{status('live')}](capture/live/{case}.png) | "
                     f"[{status('download')}](capture/download/{case}.svg) | {len(row['editorDiagnostics'])} |")
        print(case, " | ".join(f"{k}: {status(k)}" for k in p))
    result["expectedStageOutcomeVerified"] = bool(accepted)
    (stage/"measurements.json").write_text(json.dumps(result, indent=2)+"\n")
    sheet(stage, before)
    lines += ["", ("After acceptance: " if before else "Frozen failure reproduction: ") +
              ("verified." if accepted else "NOT verified."), ""]
    (stage/"report.md").write_text("\n".join(lines))
    if not accepted:
        raise SystemExit("Unexpected physical checks; inspect measurements.json")


if __name__ == "__main__":
    main()
