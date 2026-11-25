"""python3 compare.py STAGE  (Pillow, pdftocairo and rsvg-convert required)."""
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "helpers"))
from physical_plot_comparison import (DPI, INK, PAIRS, RADIUS, SIZE_SLOP, compare, contact_sheet,
                                      font, inputs, load_png, masks, measure_images)


MANUAL = ("manual-const-handlers", "manual-jump-handlers")
# Probes use data coordinates in the original PDF's black frame, never the candidate's.
AXES = {
    "axis-clipped-plateaus": ((6, 4), [
        ("blue", 0, 2, True), ("blue", 6, 2.5, True), ("blue", 3, 4, True),
        ("blue", 4, 4, True), ("red", 0, .5, True), ("red", 6, .75, True),
        ("blue", 3.5, 4, False), ("red", 4, 0, False),
    ]),
    "axis-sampled-step-corner": ((4, 6), [
        ("blue", 0, 1, True), ("blue", 1, 6, True), ("red", 0, .5, True),
        ("red", 2, 3.5, True), ("red", .5, 2, False), ("red", 3.75, 6, False),
    ]),
}


def axis_checks(name, planes):
    (w, h), probes = AXES[name]
    frame = planes["pdf"][2]
    if not frame:
        raise ValueError(f"{name}: native PDF has no axis frame")
    l, t, r, b = frame
    checks = {}
    for panel, (_, near, _) in planes.items():
        missed = []
        for color, x, y, present in probes:
            xy = (round(l + x / w * (r - 1 - l)), round(b - 1 - y / h * (b - 1 - t)))
            if bool(near[color].getpixel(xy)) != present:
                missed.append(f"{color} at ({x},{y}): expected {'ink' if present else 'clear'}")
        checks[panel] = missed
    frame_ok = all(abs(n - cm * DPI / 2.54) <= SIZE_SLOP for n, cm in [(r - 1 - l, w), (b - 1 - t, h)])
    return {"native_frame_px": frame, "physical_frame_ok": frame_ok, "failed_probes": checks}


def evaluate(name, images):
    sizes, planes, comparisons, overlay, matches = measure_images(images)
    colors = ("red", "blue") if name in AXES else ("blue", "teal", "red")
    absent = [k for k in colors if not planes["pdf"][0][k].getbbox()]
    result = {"sizes_px": sizes, "missing_native_colors": absent, "comparisons": comparisons}
    ok = matches and not absent
    if name in AXES:
        edges = result["axis"] = axis_checks(name, planes)
        ok = ok and edges["physical_frame_ok"] and not any(v for k, v in edges["failed_probes"].items() if k != "before")
    result["passed"] = ok
    return result, overlay


def sheet(rows, path):
    contact_sheet("Step and jump plots", rows, path)


def main(stage):
    report = {"passed": False, "dpi": DPI, "thresholds": {"ink_8bit": INK, "position_px": RADIUS,
              "unmatched_px_allowed": 0, "viewport_px": SIZE_SLOP}, "baseline_gates": False, "cases": {}}
    rows = []
    try:
        catalog = json.loads(Path(__file__).with_name("manifest.json").read_text())["cases"]
        if {r["id"] for r in catalog} != {*MANUAL, *AXES}:
            raise ValueError("expected two manual and two axis fixtures")
        refs = {r["id"]: r for r in json.loads((stage / "summary.json").read_text())["cases"]}
        for case in catalog:
            name = case["id"]
            images = inputs(stage, refs[name])
            result, overlay = evaluate(name, images)
            report["cases"][name] = result
            rows.append((case, result["passed"], {**images, "overlay": overlay}))
            print(f"{'PASS' if result['passed'] else 'FAIL'}  {name}")
        sheet(rows, stage / "sheet.png")
        report["passed"] = all(c["passed"] for c in report["cases"].values())
    except (OSError, KeyError, ValueError, subprocess.CalledProcessError) as exc:
        report["input_error"] = str(exc)
        print(f"Comparison incomplete: {exc}", file=sys.stderr)
    (stage / "metrics.json").write_text(json.dumps(report, indent=2) + "\n")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.exit(main(Path(sys.argv[1])))
