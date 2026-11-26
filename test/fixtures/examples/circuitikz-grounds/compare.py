"""python3 -B compare.py STAGE [--before-audit]; requires Pillow, pdftocairo and rsvg-convert."""
import argparse
import hashlib
import json
import subprocess
import sys
from functools import partial
from math import ceil, floor
from pathlib import Path
from typing import NamedTuple

from PIL import Image, ImageChops, ImageDraw, ImageStat

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "helpers"))
import physical_plot_comparison as physical


HERE = Path(__file__).resolve().parent
CM, PT = physical.DPI / 2.54, physical.DPI / 72.27
PAPER = (ceil(6.4 * CM + 4 * PT), ceil(2.8 * CM + 4 * PT))
EDGE_SLOP, CHANNEL_SLOP = 2, 5


class Scan(NamedTuple):
    name: str
    color: str
    direction: str
    at: float
    lo: float
    hi: float
    count: int
    width_slop: int = 1


# Dimensions are centimeters in the TeX picture, not positions inferred from the image.
# Two sections at different heights distinguish hatch slopes as well as their count.
SCANS = {
    "tutorial-resistor-returns": [
        Scan("ground: three bars", "blue", "v", .795, .40, .84, 3),
        Scan("ground: tail", "blue", "h", .86, .55, .95, 1),
        Scan("tlground: bars start at terminal", "teal", "v", 2.40, .84, 1.14, 3),
        Scan("rground: tail", "red", "h", .87, 3.85, 4.25, 1),
        Scan("rground: thick beam", "red", "v", 4.15, .55, .82, 1),
        Scan("rground: round cap extent", "red", "h", .70, 3.72, 4.38, 1, 2),
        Scan("tground: heavier tailless beam", "blue", "v", 5.75, .85, 1.20, 1),
        Scan("tground: butt cap extent", "blue", "h", 1.05, 5.32, 5.98, 1, 2),
    ],
    "signal-and-protective-grounds": [
        Scan("sground: triangle walls", "blue", "h", .90, .55, 1.55, 2, 2),
        Scan("sground: class fill", "teal", "h", .90, .55, 1.55, 1, 2),
        Scan("nground: semicircle sides", "teal", "h", .89, 2.55, 3.85, 2, 2),
        Scan("nground: three bars", "teal", "v", 3.28, .63, 1.04, 3),
        Scan("nground: thickened connection", "teal", "h", 1.47, 3.05, 3.35, 1),
        Scan("pground: circle and connection", "red", "h", 1.17, 4.68, 6.02, 3, 2),
        Scan("pground: three bars", "red", "v", 5.42, .75, 1.19, 3),
    ],
    "chassis-and-european-grounds": [
        Scan("cground: upper hatches", "blue", "h", .76, .32, 1.78, 3, 2),
        Scan("cground: lower hatches", "blue", "h", .60, .32, 1.78, 3, 2),
        Scan("cground: beam thickness", "blue", "v", 1.27, .81, .94, 1),
        Scan("cground: connection thickness", "blue", "h", 1.38, .85, 1.25, 1),
        Scan("eground: four upper hatches", "teal", "h", 1.04, 2.46, 3.94, 4, 2),
        Scan("eground: four lower hatches", "teal", "h", .84, 2.46, 3.94, 4, 2),
        Scan("eground: beam thickness", "teal", "v", 3.28, 1.08, 1.23, 1),
        Scan("eground2: three upper hatches", "red", "h", 1.04, 4.61, 6.09, 3, 2),
        Scan("eground2: three lower hatches", "red", "h", .84, 4.61, 6.09, 3, 2),
        Scan("eground2: beam thickness", "red", "v", 5.69, 1.08, 1.23, 1),
    ],
    "rotated-ground-anchors": [
        Scan("PE: rotated circle and three vertical bars", "blue", "h", 1.48, 1.50, 2.98, 5, 2),
        Scan("CH: rotated chassis hatches", "red", "v", 4.54, .90, 1.87, 3, 2),
        Scan("PE.north: terminal wire", "wire", "h", 1.40, .16, 2.08, 1, 2),
        Scan("CH.right: terminal wire", "wire", "h", 1.35, 4.96, 6.24, 1, 2),
    ],
}

# (name, color, left, bottom, right, top). Include the entire colored glyph in its
# own fixed lane. Four separate leader boxes exercise both ends of all four anchors.
BOUNDS = {
    "tutorial-resistor-returns": [
        ("ground", "blue", .2, .23, 1.3, 1.25), ("tlground", "teal", 1.8, .23, 2.9, 1.25),
        ("rground", "red", 3.5, .23, 4.6, 1.25), ("tground", "blue", 5.1, .23, 6.2, 1.25)],
    "signal-and-protective-grounds": [
        ("sground", "blue", .3, .34, 1.8, 1.85), ("sground fill", "teal", .3, .34, 1.8, 1.85),
        ("nground", "teal", 2.45, .34, 3.95, 1.85), ("pground", "red", 4.60, .34, 6.10, 1.85),
        ("pground fill", "blue", 4.60, .34, 6.10, 1.85)],
    "chassis-and-european-grounds": [
        ("cground", "blue", .28, .3, 1.82, 1.9), ("eground", "teal", 2.42, .3, 3.98, 1.9),
        ("eground2", "red", 4.57, .3, 6.13, 1.9)],
    "rotated-ground-anchors": [
        ("PE", "blue", 1.45, .7, 3.0, 2.1), ("CH", "red", 4.2, .8, 5.44, 1.9),
        ("PE.north east", "teal", 1.5, 1.75, 2.0, 2.54), ("PE.south west", "teal", 2.5, .25, 3.0, 1.05),
        ("CH.north west", "teal", 5.0, 1.54, 5.43, 2.34), ("CH.south east", "teal", 4.27, .36, 4.73, 1.15)],
}
SWATCHES = {
    "signal-and-protective-grounds": [
        ("class fill", 1.05, .90, (0, 128, 128)), ("unfilled semicircle", 3.39, 1.07, (255, 255, 255)),
        ("node fill overrides class", 5.02, 1.24, (166, 166, 255))],
    "rotated-ground-anchors": [("unfilled protective circle", 2.11, 1.58, (255, 255, 255))],
}


def pixel(x, y):
    return floor(2 * PT + x * CM), floor(2 * PT + (2.8 - y) * CM)


def sections(mask, scan):
    horizontal = scan.direction == "h"
    endpoints = [pixel(i, scan.at) if horizontal else pixel(scan.at, i) for i in (scan.lo, scan.hi)]
    (x0, y0), (x1, y1) = sorted(endpoints)
    data = mask.crop((x0, y0, x1 + 1, y1 + 1)).tobytes()
    # Runs have absolute, half-open pixel endpoints; both length and position matter.
    start = None
    runs = []
    for i, ink in enumerate(data + b"\0", x0 if horizontal else y0):
        if ink and start is None:
            start = i
        elif not ink and start is not None:
            runs.append((start, i))
            start = None
    return runs


def image_paths(stage, name):
    native = stage / "reference-288dpi"
    return {"pdf": native / (name + ".png"), "strict": native / (name + "-svg.png"),
            "before": stage / "before" / (name + ".png"), "live": stage / "after" / (name + ".png"),
            "download": stage / "after" / (name + "-download.png"),
            "strict-browser": stage / "after" / (name + "-tikztosvg.png")}


def geometry(case, planes, stage):
    name = case["id"]
    out = {"passed": True, "expected_paper_px": PAPER, "panels": {}}
    for panel in ["pdf", *(k for k in planes if k != "pdf")]:
        core = planes[panel][0]
        masks = {**core, "wire": ImageChops.subtract(core["all-ink"], core["colored-ink"])}
        info = {"bounds_px": {}, "sections_px": {}, "swatches_rgb": {}, "failed_probes": []}
        errs = info["failed_probes"]
        ref = out["panels"].get("pdf", info)
        for label, color, left, bottom, right, top in BOUNDS[name]:
            x0, y0 = pixel(left, top)
            box = masks[color].crop((x0, y0, *pixel(right, bottom))).getbbox()
            bounds = None if box is None else (box[0] + x0, box[1] + y0, box[2] + x0, box[3] + y0)
            info["bounds_px"][label] = bounds
            target = ref["bounds_px"][label]
            if not bounds or not target or any(abs(a - b) > EDGE_SLOP for a, b in zip(bounds, target)):
                errs.append(label + ": absent or wrong bounds")
        for s in SCANS[name]:
            found = sections(masks[s.color], s)
            info["sections_px"][s.name] = found
            target = ref["sections_px"][s.name]
            if len(found) != s.count or len(target) != s.count:
                errs.append(f"{s.name}: expected {s.count} run(s), found {len(found)}")
            elif any(max(abs(a - c), abs(b - d)) > EDGE_SLOP or abs((b-a) - (d-c)) > s.width_slop
                     for (a, b), (c, d) in zip(found, target)):
                errs.append(s.name + ": wrong stroke position or width")
        if SWATCHES.get(name):
            image = physical.load_png(image_paths(stage, name)[panel])
            for label, x, y, expected in SWATCHES[name]:
                u, v = pixel(x, y)
                rgb = ImageStat.Stat(image.crop((u-1, v-1, u+2, v+2))).median
                info["swatches_rgb"][label] = rgb
                target = ref["swatches_rgb"][label]
                if any(max(abs(c-e), abs(c-r)) > CHANNEL_SLOP for c, e, r in zip(rgb, expected, target)):
                    errs.append(label + ": wrong interior color")
        out["panels"][panel] = info
        if panel != "before" and errs:
            out["passed"] = False
    return out


def baseline_inputs(stage, row):
    name = row["id"]
    if (row["referenceKind"] != "tikztosvg" or row["tikztosvgStatus"] != "rendered" or
            row["mactexPngStatus"] != "rendered" or not row["referenceProvenance"]["independentNumerics"]):
        raise ValueError(f"{name}: independent references required")
    paths = image_paths(stage, name)
    paths["pdf"].parent.mkdir(exist_ok=True)
    subprocess.run(["pdftocairo", "-png", "-singlefile", "-r", str(physical.DPI),
                    stage / ".mactex-work" / name / "reference.pdf", paths["pdf"].with_suffix("")], check=True)
    subprocess.run(["rsvg-convert", "--dpi-x", str(physical.DPI), "--dpi-y", str(physical.DPI),
                    "-o", paths["strict"], stage / row["tikztosvgSvg"]], check=True)
    return {k: physical.load_png(paths[k]) for k in ("pdf", "strict", "before")}


def baseline_sheet(rows, path):
    w = max(im.width for _, imgs in rows for im in imgs.values()) // 2 + 28
    h = max(im.height for _, imgs in rows for im in imgs.values()) // 2 + 40
    paper = Image.new("RGB", (3*w, 70 + len(rows)*h), "#f5f7f8")
    draw = ImageDraw.Draw(paper)
    draw.text((12, 6), "Circuitikz grounds: historical baseline", font=physical.font(22), fill="#23323d")
    for i, label in enumerate(("Chrome at 2ecf6063", "MacTeX PDF", "Strict tikztosvg via librsvg")):
        draw.text((12 + w*i, 42), label, font=physical.font(16), fill="#354451")
    for j, (title, imgs) in enumerate(rows):
        y = 68 + h*j
        draw.text((12, y), title, font=physical.font(16), fill="#23323d")
        for i, k in enumerate(("before", "pdf", "strict")):
            paper.paste(imgs[k].reduce(2), (12 + w*i, y + 24))
    paper.save(path, optimize=True)


def audit_before(stage):
    cases = json.loads((HERE / "manifest.json").read_text())["cases"]
    summary = json.loads((stage / "summary.json").read_text())
    refs = {r["id"]: r for r in summary["cases"]}
    browser = json.loads((stage / "before/browser.json").read_text())
    ids = [case["id"] for case in cases]
    if (browser["errors"] or [r["id"] for r in browser["results"]] != ids
            or set(ids) != set(refs) or set(ids) != set(SCANS) or len(ids) != len(SCANS)):
        raise ValueError("Incomplete browser or reference catalog")
    report = {"passed": True, "dpi": physical.DPI,
              "expected_baseline_commit": "2ecf6063e7979c371dcd738571a8aee84a302d4c", "browser": browser["browser"],
              "thresholds": {"ink_8bit": physical.INK, "position_px": physical.RADIUS, "unmatched_px_allowed": 0,
                             "viewport_px": physical.SIZE_SLOP, "section_edge_px": EDGE_SLOP,
                             "section_width_px": "1 for flat strokes; 2 for caps, spans and oblique sections",
                             "swatch_rgb_per_channel": CHANNEL_SLOP},
              "policy": "Both references must agree and pass the probes. Every historical case must fail against both.",
              "cases": {}}
    rows = []
    for case in cases:
        name, ref = case["id"], refs[case["id"]]
        source_hash = hashlib.sha256((HERE / case["source"]).read_bytes()).hexdigest()
        if source_hash != ref["fingerprints"]["sourceSha256"]:
            raise ValueError(f"{name}: TeX changed since reference generation")
        imgs = baseline_inputs(stage, ref)
        sizes = {k: im.size for k, im in imgs.items()}
        size = tuple(map(max, zip(*sizes.values())))
        plane = {k: physical.masks(im, size) for k, im in imgs.items()}
        pairs = {(a + "_vs_" + b): physical.compare(plane[a], plane[b], sizes[a], sizes[b])[0]
                 for a, b in (("strict", "pdf"), ("before", "pdf"), ("before", "strict"))}
        detail = geometry(case, plane, stage)
        paper_ok = all(max(abs(a-b) for a, b in zip(sz, PAPER)) <= physical.SIZE_SLOP for sz in sizes.values())
        rejected = not pairs["before_vs_pdf"]["passed"] and not pairs["before_vs_strict"]["passed"]
        passed = bool(paper_ok and detail["passed"] and pairs["strict_vs_pdf"]["passed"]
                      and rejected and detail["panels"]["before"]["failed_probes"])
        report["cases"][name] = {"passed": passed, "baseline_rejected": rejected, "paper_ok": paper_ok,
                                 "sizes_px": sizes, "source_sha256": source_hash,
                                 "before_png_sha256": hashlib.sha256(image_paths(stage, name)["before"].read_bytes()).hexdigest(),
                                 "comparisons": pairs, "geometry": detail}
        report["passed"] &= passed
        rows.append((case["title"], imgs))
        print(f"{'PASS' if passed else 'FAIL'} baseline audit: {name}")
    baseline_sheet(rows, stage / "before-sheet.png")
    (stage / "before-metrics.json").write_text(json.dumps(report, indent=2) + "\n")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stage", type=Path)
    parser.add_argument("--before-audit", action="store_true")
    args = parser.parse_args()
    if args.before_audit:
        try:
            sys.exit(audit_before(args.stage))
        except (OSError, KeyError, ValueError, subprocess.CalledProcessError) as exc:
            if args.stage.is_dir():
                (args.stage / "before-metrics.json").write_text(json.dumps({"passed": False, "input_error": str(exc)}) + "\n")
            sys.exit(f"Baseline audit incomplete: {exc}")
    sys.exit(physical.run(args.stage, HERE / "manifest.json", "Circuitikz grounds", SCANS,
                          partial(geometry, stage=args.stage)))
