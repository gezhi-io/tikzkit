"""Physical page contact sheet; transparent gutters, unchanged white pages."""
import argparse
import csv
from pathlib import Path

from PIL import Image, ImageDraw

from log_audit import EDGE, JUMP, MANUAL, MIXED, SEMI, csv_out
from proof import difference
from sheet import rasters
from sheets import ACCENT, INK, MUTED, RULE, line

ROWS = [
    (MANUAL, "01   Manual  /  Relative errors on a log-log table",
     "Seven points; the first two each carry two superimposed caps under the marker."),
    (SEMI, "02   Semilogy  /  Linear x, logarithmic y",
     "Blue: both directions. Red: positive arms only. Green: negative arms only."),
    (MIXED, "03   Log-log  /  Base 2 on x, base 10 on y",
     "A fixed x error of 6 changes length with x. The relative y error of 50% does not."),
    (EDGE, "04   Semilogx  /  Lower endpoint at zero or below",
     "Blue: absolute. Red: relative. Left arms are absent in the lower four rows and present in the upper two."),
    (JUMP, "05   Semilogy  /  Two invalid centers must break the line",
     "The rows at x = 100 and 20000 have no valid log y. Four measured points remain, connected as 1-2 and 3-4."),
]


def gallery(stage, before):
    cap, images = rasters(stage)
    old, old_images = rasters(before)
    assert {e["id"]:e["sourceSha256"] for e in cap["rows"]} == {e["id"]:e["sourceSha256"] for e in old["rows"]}
    with (stage/"case-summary.csv").open() as f:
        summary = {r["case"]:r for r in csv.DictReader(f) if r["panel"] == "live" and r["reference"] == "pdf"}
    with (stage/"inventory.csv").open() as f:
        counts = {r["case"]:r for r in csv.DictReader(f) if r["panel"] == "live"}
    overlays = stage/"overlays"
    overlays.mkdir(exist_ok=True)
    metrics = []
    for case, ims in images.items():
        ims["before"] = old_images[case]["live"]
        for k in ("live", "download", "export", "tikztosvg"):
            diff, stats = difference(ims["rsvg"], ims[k])
            diff.save(overlays/f"{case}-{k}.png")
            metrics.append(dict(case=case, panel=k, **stats))
            if k == "live":
                ims["diff"] = diff
    csv_out(stage/"overlay-pixels.csv", metrics)
    native = [("pdf", "Original MacTeX PDF"), ("rsvg", "tikztosvg / librsvg")]
    skin = "#f4f7f7"
    for name, columns in (
        ("gallery", native + [("before", "Chrome / before"), ("live", "Chrome / candidate"), ("diff", "Candidate vs converter")]),
        ("all-routes", native + [("live", "Chrome / editor"), ("download", "Download / packaged CLI"), ("export", "Fixture CLI export")])):
        cw, pad = 261, 14
        w = pad*2 + len(columns)*cw
        sheet = Image.new("RGBA", (w, 1300))
        draw = ImageDraw.Draw(sheet)
        draw.rectangle((0, 0, w, 96), fill=skin)
        line(draw, (pad, 7), "PGFPlots  /  Log-axis error bars", 25, INK, True)
        line(draw, (pad, 43), f"Before {old['revision'][:8]}  /  candidate {cap['environment']['rendererSha256'][:12]}   |   384 dpi at one-quarter scale. Same page origin; no alignment or fitting.", 14, MUTED)
        for j, (_, label) in enumerate(columns):
            line(draw, (pad+j*cw, 72), label, 16, ACCENT, True)
        y = 100
        for case, title, desc in ROWS:
            if case not in images:
                continue
            s, c = summary[case], counts[case]
            detail = (f"{c['markers']} points / {c['stems']} nonzero stems / {c['caps']} caps. "
                      f"Max endpoint error (plot / page): {s['plotEnd']} / {s['pageEnd']} mm vs PDF."
                      if s["pageEnd"] else "No nonzero error stems in this capture.")
            draw.rectangle((0, y, w, y+61), fill=skin)
            line(draw, (pad, y+2), title, 17, INK, True)
            line(draw, (pad, y+25), desc, 13, MUTED)
            line(draw, (pad, y+43), detail, 13, MUTED)
            y += 65
            h = 0
            for j, (k, _) in enumerate(columns):
                im = images[case][k]
                tile = im.resize(tuple(round(v/4) for v in im.size), Image.Resampling.LANCZOS)
                assert tile.width < cw-8
                x = pad + j*cw
                sheet.paste(tile, (x, y))
                draw.rectangle((x-1, y-1, x+tile.width, y+tile.height), outline=RULE)
                h = max(h, tile.height)
            y += h+9
        draw.rectangle((0, y, w, y+29), fill=skin)
        line(draw, (pad, y+6), "Difference: dark = shared ink; magenta = converter only; green = editor only; amber = different hues. White is the original paper; gutters are transparent."
             if name == "gallery" else "Actual editor DOM, downloaded file and CLI export; only the display scale above is reduced.", 13, MUTED)
        assert y+30 < sheet.height
        sheet.crop((0, 0, w, y+30)).save(stage/(name+".png"), dpi=(96, 96), optimize=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("stage", type=Path)
    ap.add_argument("--before", type=Path, required=True)
    a = ap.parse_args()
    gallery(a.stage, a.before)
