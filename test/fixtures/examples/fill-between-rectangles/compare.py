"""python3 compare.py STAGE  (Pillow, pdftocairo and rsvg-convert required)."""
import sys
from math import ceil
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "helpers"))
from physical_plot_comparison import DPI, run


CM, PT = DPI / 2.54, DPI / 72.27
# (0,0) in data coordinates, on the declared paper. Never register images to the fill.
OX, OY = 1.25 * CM + 2 * PT, 3.25 * CM + 2 * PT
BOUND_SLOP, ROW_SLOP = 3, 5  # A one-pixel row change can move the intersection of a shallow line.
CASES = {
    "force-distance-rectangle": {
        "rows": (.35, .85, 1.25, 1.55),
        "teal": ((1.1, .9), (2, 1.2), (2.85, 1.52)),
        "white": ((.82, .5), (3.18, .5), (2, 1.65), (1.9, -.13)),
        "blue": ((.25, .5), (4, 2)), "red": ((.5, 0), (3.6, 0)),
    },
    "independent-flipped-rectangles": {
        "rows": (-.25, .2, .78, 1.4, 1.65),
        "teal": ((.8, .65), (1.35, -.22), (2.32, 1.68), (3.18, .27)),
        "white": ((.1, .42), (.75, -.25), (2.85, 1.45), (3.75, .25)),
        "blue": ((0, .9), (4.25, 2.6)), "red": ((0, -.65), (4.25, .2)),
    },
    "cubic-two-side-rectangle": {
        # Single-axis cuts in either order would leave the last two rows empty.
        # Local PGF intersects one rectangle with the original cubic: at y=2.20
        # the native fill is about 40 pixels wide, well above antialiasing noise.
        "rows": (-.25, .5, 1.5, 2.12, 2.2),
        "teal": ((.9, .65), (2, 1.8), (2.43, 2.19), (3.5, .52)),
        "white": ((.45, .25), (1.3, 2.15), (3, 2.2), (4.2, .15)),
        "blue": ((-.5, -.1), (4.3, 2.75)), "red": ((0, -.55), (4.1, -.55)),
    },
}


def band(mask, y):
    v = round(OY - y * CM)
    row = mask.crop((0, v, mask.width, v + 1))
    box = row.getbbox()
    if not box:
        return None
    return {"left_px": box[0], "right_px": box[2], "ink_px": row.histogram()[255]}


def probe(case, planes):
    spec = CASES[case["id"]]
    native = planes["pdf"][0]
    colors = ("teal", "blue", "red")
    bounds = {c: native[c].getbbox() for c in colors}
    rows = {y: band(native["teal"], y) for y in spec["rows"]}
    if not all(bounds.values()) or any(not r or r["ink_px"] != r["right_px"] - r["left_px"] for r in rows.values()):
        raise ValueError(f"{case['id']}: native PDF must have both strokes and one uninterrupted fill at every test height")
    result = {"passed": True, "expected_paper_px": [ceil(6.5 * CM + 4 * PT), ceil(4.5 * CM + 4 * PT)],
              "native_bounds_px": bounds, "native_bands_at_y_cm": rows, "panels": {}}
    frame_box = (OX - CM, OY - 3 * CM, OX + 5 * CM, OY + CM)
    for panel, (core, near, frame) in planes.items():
        failed = []
        if not frame or max(abs(a - b) for a, b in zip(frame, frame_box)) > BOUND_SLOP:
            failed.append("wrong 6 x 4 cm frame")
        for color in colors:
            actual = core[color].getbbox()
            if not actual or max(abs(a - b) for a, b in zip(actual, bounds[color])) > BOUND_SLOP:
                failed.append(color + " bounds differ from the PDF")
        observed = {y: band(core["teal"], y) for y in rows}
        for y, r in observed.items():
            if (not r or r["ink_px"] != r["right_px"] - r["left_px"] or
                    any(abs(r[k] - rows[y][k]) > ROW_SLOP for k in ("left_px", "right_px"))):
                failed.append(f"wrong horizontal fill at y={y}")
        for color in (*colors, "white"):
            for x, y in spec[color]:
                u, v = round(OX + x * CM), round(OY - y * CM)
                if color in ("teal", "white"):
                    mask, value = (core["teal"], 255) if color == "teal" else (core["all-ink"], 0)
                    ok = mask.crop((u - 1, v - 1, u + 2, v + 2)).getextrema() == (value, value)
                else:
                    ok = bool(near[color].getpixel((u, v)))
                if not ok:
                    failed.append(f"expected {color} at ({x},{y})")
        result["panels"][panel] = {"bands_at_y_cm": observed, "failed_probes": failed}
        if panel != "before" and failed:
            result["passed"] = False
    return result


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.exit(run(Path(sys.argv[1]), Path(__file__).with_name("manifest.json"), "Finite rectangle clips", CASES, probe))
