"""python3 compare.py STAGE  (Pillow, pdftocairo and rsvg-convert required)."""
import sys
from itertools import groupby
from math import ceil
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "helpers"))
from physical_plot_comparison import DPI, run


CM, PT = DPI / 2.54, DPI / 72.27
OX, OY = .25 * CM + 2 * PT, 4.25 * CM + 2 * PT
BOUND_SLOP, CUT_SLOP = 3, 4  # A one-column slice can cross a steep, antialiased end cap.
CASES = {
    "opposite-traced-band": {
        "cuts": (.85, 1.8, 3, 4.2, 5.15),
        "teal": ((1, 1.6), (3, 2), (5, 2.4)),
        "white": ((.3, 1.6), (3, 1.05), (3, 2.95), (5.7, 2.4)),
        "blue": ((3, 2.75),), "red": ((3, 1.25),),
    },
    "smooth-over-steps": {
        "cuts": (1.05, 1.65, 1.9, 3.1, 3.45, 4.35, 4.75),
        "teal": ((1.05, 2.92), (1.65, .9), (3.45, .9)),
        "white": ((1.95, 1.05), (3, 1), (4.35, 2.36), (4.75, .95)),
        "blue": ((1.6, 3.5), (3.8, 2)), "red": ((1.75, .95), (3.25, 1), (4.5, .95)),
    },
    "bezier-over-line": {
        "cuts": (.85, 1.7, 3, 4.3, 5.15),
        "teal": ((1.25, 2.35), (3, 3.1), (4.65, 2.35)),
        "white": ((1.7, 3.25), (3, 3.6), (3, .5)),
        "blue": ((3, 3.3),), "red": ((2, .75),),
    },
    "soft-clipped-rising-cubic": {
        "cuts": (1.24, 1.55, 2.45, 3.45, 4.05, 4.3),
        "teal": ((1.5, .85), (2.45, 2.4), (3.7, 2.7), (4.05, 2.1)),
        "white": ((.95, .75), (1.22, .82), (2.45, 2.72), (4.22, 2.8), (4.85, .72)),
        "blue": ((.6, .6), (5.4, 3.7)), "red": ((.85, .4), (5.2, .4)),
    },
}


def column_spans(mask, x_cm):
    x = round(OX + x_cm * CM)
    col = mask.crop((x, 0, x + 1, mask.height)).getprojection()[1]
    spans = []
    for painted, group in groupby(enumerate(col), key=lambda pair: bool(pair[1])):
        if painted:
            rows = [y for y, _ in group]
            spans.append((rows[0], rows[-1] + 1))
    return spans


def probe(case, planes):
    spec = CASES[case["id"]]
    ref = planes["pdf"][0]
    colors = ("blue", "red", "teal")
    bounds = {c: ref[c].getbbox() for c in colors}
    cuts = {x: column_spans(ref["teal"], x) for x in spec["cuts"]}
    if not all(bounds.values()) or any(len(s) != 1 for s in cuts.values()):
        raise ValueError(f"{case['id']}: expected native boundary strokes and one solid span at every sampled x")

    frame_box = (OX, OY - 4 * CM, OX + 6 * CM, OY)
    result = {"passed": True, "expected_paper_px": [ceil(6.5 * CM + 4 * PT), ceil(4.5 * CM + 4 * PT)],
              "native_bounds_px": bounds, "native_spans_px_at_x_cm": cuts, "panels": {}}
    for panel, (core, near, frame) in planes.items():
        failed = []
        if not frame or max(abs(a - b) for a, b in zip(frame, frame_box)) > BOUND_SLOP:
            failed.append("6 x 4 cm frame displaced")
        for color in colors:
            actual = core[color].getbbox()
            if not actual or max(abs(a - b) for a, b in zip(actual, bounds[color])) > BOUND_SLOP:
                failed.append(color + " bounds differ from the PDF")
        observed = {x: column_spans(core["teal"], x) for x in cuts}
        for x, spans in observed.items():
            if len(spans) != 1 or max(abs(a - b) for a, b in zip(spans[0], cuts[x][0])) > CUT_SLOP:
                failed.append(f"wrong fill span at x={x} cm")
        for color in (*colors, "white"):
            for x, y in spec[color]:
                u, v = round(OX + x * CM), round(OY - y * CM)
                if color in ("teal", "white"):
                    mask = core["teal" if color == "teal" else "all-ink"]
                    value = 255 if color == "teal" else 0
                    found = mask.crop((u-1, v-1, u+2, v+2)).getextrema() == (value, value)
                else:
                    found = near[color].getpixel((u, v)) != 0
                if not found:
                    failed.append(f"expected {color} at ({x},{y}) cm")
        result["panels"][panel] = {"spans_px_at_x_cm": observed, "failed_probes": failed}
        if panel != "before" and failed:
            result["passed"] = False
    return result


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.exit(run(Path(sys.argv[1]), Path(__file__).with_name("manifest.json"), "Fill between boundaries", CASES, probe))
