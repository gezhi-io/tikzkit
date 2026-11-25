"""Validate workbench captures against actual tikztosvg and the standalone PDF.

Run after render-example-fixtures.js --native-reference --strict-tikztosvg,
audit-module-regressions.js --workbench, and measure-vector-ink.mjs.
Pass --baseline REVISION to record old JS failures without waiving reference checks.
Requires local PyMuPDF, Pillow, NumPy and SciPy; no network or JS renderer imports.
"""

import argparse
import hashlib
import json
import shutil
from pathlib import Path

import fitz
import numpy as np
from PIL import Image, ImageDraw
from scipy.spatial import cKDTree


STEP = 0.02  # bp; bound point spacing by the maximum Bezier derivative
PAGE_TOL, NATIVE_TOL, JS_TOL, INK_MIN = 0.01, 0.025, 0.06, 0.95
SUITE = Path(__file__).resolve().parent


def load(path):
    return json.loads(path.read_bytes())


def sample(points):
    pts = np.asarray(points, dtype=float)
    degree = len(pts) - 1
    n = max(1, int(np.ceil(degree * np.linalg.norm(np.diff(pts, axis=0), axis=1).max() / STEP)))
    t = np.linspace(0, 1, n + 1)[:, None]
    if degree == 1:
        return (1 - t) * pts[0] + t * pts[1]
    return (1 - t)**3 * pts[0] + 3 * (1 - t)**2 * t * pts[1] + 3 * (1 - t) * t**2 * pts[2] + t**3 * pts[3]


def geometry(page):
    strokes, commands = [], []
    for shape in page.get_drawings():
        if shape["type"] not in ("s", "fs"):
            continue
        items, cloud = [], []
        first = last = None
        for op, *points in shape["items"]:
            if op not in ("l", "c"):
                raise ValueError(f"Unexpected {op!r} in this line/cubic/rounded-rectangle suite")
            points = [tuple(p) for p in points]
            if last != points[0]:
                first = points[0]
                items.append(["M", *first])
            items.append([op.upper(), *[v for point in points[1:] for v in point]])
            cloud.append(sample(points))
            last = points[-1]
        if shape["closePath"] and last != first:
            cloud.append(sample([last, first]))
            items.append(["Z"])
        strokes.append(np.concatenate(cloud))
        commands.append(items)
    if not strokes:
        raise ValueError("No painted strokes")
    return (np.array([page.rect.width, page.rect.height]), strokes, commands)


def svg_geometry(file):
    # Only decode the already-captured SVG to get its physical page coordinates.
    # The ink gate below uses actual Chrome screenshots, not this vector decoder.
    with fitz.open(file) as svg, fitz.open(stream=svg.convert_to_pdf(), filetype="pdf") as pdf:
        return geometry(pdf[0])


def compare_geometry(actual, native):
    page_error = float(np.abs(actual[0] - native[0]).max())
    per_stroke = []
    if len(actual[1]) == len(native[1]):
        per_stroke = [max(float(cKDTree(t).query(s)[0].max()) for s, t in ((a, b), (b, a)))
                      for a, b in zip(actual[1], native[1])]
    return {"pageErrorBp": page_error, "maxCenterlineErrorBp": max(per_stroke, default=None),
            "perStrokeCenterlineErrorBp": per_stroke}


def geometry_ok(result, tolerance):
    d = result["maxCenterlineErrorBp"]
    return result["pageErrorBp"] <= PAGE_TOL and d is not None and d <= tolerance


def elbow_insets_pt(strokes):
    # The nested-scope fixture draws four up-then-right elbows. A turn's
    # outgoing tangent starts one inset to the right of the incoming line.
    values = []
    for commands in strokes:
        curves = [cmd for cmd in commands if cmd[0] == "C"]
        values.append((curves[0][-2] - commands[0][1]) * 72.27/72 if len(curves) == 1
                      else 0.0 if not curves else None)
    return values


def reference_ink(paper, screen):
    a, b = (255 - np.asarray(im.convert("RGB"), dtype=float) for im in (paper, screen))
    h, w = min(a.shape[0], b.shape[0]), min(a.shape[1], b.shape[1])
    if max(abs(a.shape[0] - b.shape[0]), abs(a.shape[1] - b.shape[1])) > 1:
        return 0.0
    # Some fractional page widths round up in PDF rasterization but down in
    # Chrome. Only an entirely white terminal row/column may be disregarded.
    if any(np.any(x[h:]) or np.any(x[:, w:]) for x in (a, b)):
        return 0.0
    a, b = a[:h, :w], b[:h, :w]
    energy = np.sum(a*a) + np.sum(b*b)
    return float(2 * np.sum(a*b) / energy) if energy else 0.0


def contact_sheet(root, rows, captures):
    w, h = 292, 132
    sheet = Image.new("RGB", (4*w, 34 + h*len(rows)), "#f2f4f5")
    draw = ImageDraw.Draw(sheet)
    for i, title in enumerate(("Chrome workbench", "Strict tikztosvg in Chrome", "Standalone PDF at 288 dpi",
                               "Difference: JS excess blue / missing red")):
        draw.text((i*w + 8, 9), title, fill="#15222c")
    for j, row in enumerate(rows):
        key = row["id"]
        panels = {p["title"]: p for p in captures[key]["panels"]}
        a, b = [Image.open(root / panels[t]["image"]).convert("RGB") for t in ("Live workbench JS", "Local tikztosvg")]
        paper = Image.open(root / "native-pdf" / f"{key}-288dpi.png").convert("RGB")
        # Preserve the page origin even for mismatched page extents. The sheet
        # is presentation only; the full-resolution numerical gates never resize.
        extent = (max(a.width, b.width, paper.width), max(a.height, b.height, paper.height))
        def ink(im):
            canvas = Image.new("RGB", extent, "white")
            canvas.paste(im, (0, 0))
            return 255 - np.asarray(canvas).min(axis=2).astype(float)
        left, right = ink(a), ink(b)
        common = 255 - 0.30*np.minimum(left, right)
        excess, missing = np.maximum(left-right, 0), np.maximum(right-left, 0)
        diff = Image.fromarray(np.clip(np.stack((common-excess, common-excess-missing, common-missing),
                                                axis=2), 0, 255).astype(np.uint8))
        y = 34 + j*h
        actual = row["panels"]["Live workbench JS"]
        distance = actual["maxCenterlineErrorBp"]
        error = f"{distance:.3f} bp" if distance is not None else "stroke count mismatch"
        draw.text((8, y), f"{key}     ink {actual['unalignedChromeInk']:.4f}     centerline {error}", fill="#15222c")
        scale = min((w-14)/extent[0], (h-25)/extent[1], 8 if max(extent) < 20 else 1)
        for i, img in enumerate((a, b, paper, diff)):
            size = tuple(max(1, round(v*scale)) for v in img.size)
            shown = img.resize(size, Image.Resampling.NEAREST if scale > 1 else Image.Resampling.LANCZOS)
            sheet.paste(shown, (i*w + 7, y + 18))
    sheet.save(root / "corner-contact-sheet.png")


def audit(root, revision):
    manifest = load(SUITE / "manifest.json")
    manifest_hash = hashlib.sha256((SUITE / "manifest.json").read_bytes()).hexdigest()
    summary, browser = load(root / "summary.json"), load(root / "browser-audit.json")
    ink = {(r["id"], r["panel"]): r for r in load(root / "vector-ink.json")}
    cases = {c["id"]: c for c in summary["cases"]}
    captures = {c["id"]: c for c in browser["cases"]}
    expected = {c["id"] for c in manifest["cases"]}
    if not summary["gate"]["accepted"] or browser["errors"] or expected != cases.keys() or expected != captures.keys():
        raise ValueError("Incomplete native or Chrome capture")
    archive = root / "native-pdf"
    archive.mkdir(exist_ok=True)
    rows = []
    for spec in manifest["cases"]:
        key = spec["id"]
        case, capture = cases[key], captures[key]
        inputs = {p["title"]: p for p in capture["panels"]}
        fp = case["fingerprints"]
        source_hash = hashlib.sha256((SUITE / spec["source"]).read_bytes()).hexdigest()
        if (case["referenceKind"] != "tikztosvg" or case["tikztosvgStatus"] != "rendered"
                or case["mactexPngStatus"] != "rendered" or not case["referenceProvenance"]["independentNumerics"]
                or fp["sourceSha256"] != source_hash or fp["manifestSha256"] != manifest_hash
                or case["diagnostics"] or capture["diagnostics"]):
            raise ValueError(f"Missing, stale or substituted reference for {key}")
        pdf_file = archive / f"{key}.pdf"
        shutil.copyfile(root / ".mactex-work" / key / "reference.pdf", pdf_file)
        with fitz.open(pdf_file) as pdf:
            if len(pdf) != 1:
                raise ValueError(f"{key} is not a single page")
            native = geometry(pdf[0])
            pix = pdf[0].get_pixmap(matrix=fitz.Matrix(4, 4), colorspace=fitz.csRGB, alpha=False)
            paper = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            paper.save(archive / f"{key}-288dpi.png")
        ref = inputs["Local tikztosvg"]
        native_check = compare_geometry(svg_geometry(root / ref["svg"]), native)
        with Image.open(root / ref["image"]) as im:
            native_check["pdfToChromeInk"] = reference_ink(paper, im)
        native_check["passed"] = geometry_ok(native_check, NATIVE_TOL) and native_check["pdfToChromeInk"] >= INK_MIN
        panel_checks = {}
        for title in ("Live workbench JS", "After SVG-text"):
            actual = svg_geometry(root / inputs[title]["svg"])
            panel = compare_geometry(actual, native)
            image = ink[key, title]
            panel["unalignedChromeInk"] = image["score"]
            panel["passed"] = geometry_ok(panel, JS_TOL) and image["passed"]
            if key == "round-nested-scopes":
                panel["insetsPt"] = elbow_insets_pt(actual[2])
            panel_checks[title] = panel
        points = np.concatenate(native[1])
        if key == "round-oversize-bbox":
            if np.max(np.abs(native[0] - 2.4 * 72 / 72.27)) > 0.001 or np.any(points.min(axis=0) >= -17):
                raise ValueError("Oversize elbow no longer exercises paint beyond its native page")
        if key == "round-nested-scopes":
            native_check["insetsPt"] = elbow_insets_pt(native[2])
            if not np.allclose(native_check["insetsPt"], [0, 7, 0, 1], atol=0.005):
                raise ValueError("Native nested-scope oracle changed")
        rows.append(dict(id=key, sourceSha256=source_hash, pdfPageBp=native[0].tolist(),
                         pdfCenterlineBoundsBp=[*points.min(axis=0), *points.max(axis=0)],
                         pdfStrokeCommands=native[2], reference=native_check, panels=panel_checks))
    report = dict(baselineRevision=revision, chrome=browser["browser"], coordinates="page bp, top-left, no registration",
                  sampleSpacingBp=STEP, pageToleranceBp=PAGE_TOL, referenceCurveToleranceBp=NATIVE_TOL,
                  actualCurveToleranceBp=JS_TOL, minimumInkAgreement=INK_MIN, cases=rows)
    (root / "corner-audit.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    contact_sheet(root, rows, captures)
    valid = sum(row["reference"]["passed"] for row in rows)
    passing = sum(c["passed"] for row in rows for c in row["panels"].values())
    print(f"Independent native references: {valid}/{len(rows)}; JS geometry + ink: {passing}/{2*len(rows)}")
    return valid == len(rows) and all(c["passed"] for row in rows if row["id"] == "round-sharp-control"
                                      for c in row["panels"].values()) and (bool(revision) or passing == 2*len(rows))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--baseline", metavar="PRE_CHANGE_REVISION")
    args = parser.parse_args()
    raise SystemExit(0 if audit(args.output, args.baseline) else 1)
