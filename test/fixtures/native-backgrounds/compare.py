"""Measure saved workbench captures; make a fixed-scale, whole-page comparison."""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import pymupdf
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
sys.dont_write_bytecode = True
sys.path.insert(0, str(HERE.with_name("native-petri")))
from proof import DPI, MM, difference, pixels, rgb, sha
from sheet import font, tile


def read(file):
    return json.loads(file.read_bytes())


def geometry(file):
    # Read the PDF directly; let librsvg resolve SVG units, transforms and pens.
    with (pymupdf.open(file) if file.suffix == ".pdf" else pymupdf.open(filetype="pdf",
            stream=subprocess.check_output(["rsvg-convert", "-f", "pdf", file]))) as doc:
        assert len(doc) == 1
        page = doc[0]
        mm = lambda v: np.round(np.array(v) * MM, 5).tolist()
        paths = []
        for d in page.get_drawings():
            lines = [mm([*i[1], *i[2]]) for i in d["items"] if i[0] == "l"]
            paths.append({"ops": " ".join(i[0] for i in d["items"]), "fill": rgb(d["fill"]),
                          "stroke": rgb(d["color"]), "penMm": mm(d["width"] or 0), "linesMm": lines})
        return {"pageMm": mm(page.rect[2:]), "paths": paths,
                "shades": sum(kind == "fill-shade" for kind, _ in page.get_bboxlog())}


def audit(stage):
    cap, summary = read(stage/"capture.json"), read(stage/"summary.json")
    assert cap["summarySha256"] == sha(stage/"summary.json") and summary["gate"]["accepted"]
    assert cap["dpi"] == DPI and not cap["errors"] and not cap["badRequests"]
    manual = Path(subprocess.check_output(["kpsewhich", "-format=TeX system documentation",
        "pgfmanual-en-library-backgrounds.tex"], text=True).strip()).read_bytes().splitlines(keepends=True)
    specs = {r["id"]:r for r in read(HERE/"manifest.json")["cases"]}
    assert sorted(specs) == sorted(r["id"] for r in cap["rows"])
    results = {}
    for row in cap["rows"]:
        case, panels = row["id"], row["panels"]
        src = HERE/specs[case]["source"]
        a,b = specs[case]["manualLines"]
        assert src.read_bytes().split(b"\\begin{document}\n")[1].split(b"\\end{document}")[0] == b"".join(manual[a-1:b])
        assert sha(src) == row["sourceSha256"] and row["originalPdfInputMatchesSource"]
        assert row["editorRenderClicked"] and row["previousSvgDetached"]
        measured, images = {}, {}
        for key in ("pdf", "rsvg", "live", "download", "cli"):
            p = panels[{"rsvg":"tikztosvg", "cli":"export"}.get(key,key)]
            ext = "pdf" if key == "pdf" else "svg"
            f, png = stage/p[ext+"File"], stage/p["file"]
            assert sha(f) == p[ext+"Sha256"] and sha(png) == p["sha256"]
            if key in ("cli","rsvg"):
                dest = stage/"capture"/key
                dest.mkdir(exist_ok=True)
                if key == "cli":
                    f = dest/(case+".svg")
                    subprocess.run(["node", Path(cap["tree"])/"bin/tikz2svg.js", "--strict",
                                    "--math-renderer", "svg-text", src, "-o", f], check=True)
                png = dest/(case+".png")
                subprocess.run(["rsvg-convert", "-b", "white", "-d", str(DPI), "-p", str(DPI),
                                "-o", png, f], check=True)
            im = images[key] = pixels(png)
            g = geometry(f)
            w,h = np.array(g["pageMm"]) * DPI/25.4
            g["quarterSamplesRGB"] = [im[int(h*y), int(w/2)].tolist() for y in (.25,.75)]
            colors, counts = np.unique(im[im.min(axis=2) < 240], axis=0, return_counts=True)
            g["mostFrequentInkRGB"] = colors[counts.argmax()].tolist() if len(colors) else None
            measured[key] = dict(**g, sha256=sha(f), png=str(png.relative_to(stage)), pngSha256=sha(png))
        record = results[case] = {
            "sourceSha256": sha(src), "diagnostics": row["diagnostics"], "exportDiagnostics": row["exportDiagnostics"],
            "downloadEqualsCli": measured["download"]["sha256"] == measured["cli"]["sha256"],
            "panels": measured, "vsPdf": {k:difference(images["pdf"],im) for k,im in images.items() if k != "pdf"},
            "liveVsDownload": difference(images["live"], images["download"]),
            "liveVsConverter": difference(images["live"], images["rsvg"])}
        print(case, "PDF vs Chrome (>16 RGB):", record["vsPdf"]["live"]["changedOver16"],
              "| Chrome vs download:", record["liveVsDownload"]["changedOver16"])
    out = {"renderer": cap["environment"]["rendererSha256"], "browser": cap["browser"],
           "revision": cap["revision"], "captureSha256": sha(stage/"capture.json"), "results": results}
    (stage/"metrics.json").write_text(json.dumps(out, indent=2)+"\n")


def sheet(before, after, output):
    old, new = [read(s/"metrics.json") for s in (before,after)]
    for s,m in ((before,old),(after,new)):
        assert m["captureSha256"] == sha(s/"capture.json")
    assert old["browser"] == new["browser"] and old["results"].keys() == new["results"].keys()
    columns = [("pdf","MacTeX","Original PDF"), ("rsvg","Local tikztosvg","librsvg"),
               ("before","Before","Chrome / Render"), ("live","After","Chrome / Render"),
               ("download","Download SVG","Reopened in Chrome")]
    rows = []
    for spec in read(HERE/"manifest.json")["cases"]:
        oldrow, row = [m["results"][spec["id"]] for m in (old,new)]
        assert oldrow["sourceSha256"] == row["sourceSha256"]
        for k in ("rsvg","pdf"):
            assert oldrow["panels"][k]["pngSha256"] == row["panels"][k]["pngSha256"]
        imgs = [tile(before, oldrow["panels"]["live"]) if k == "before" else tile(after, row["panels"][k]) for k,*_ in columns]
        rows.append((spec, imgs, [r["vsPdf"]["live"]["changedOver16"] for r in (oldrow,row)]))
    pad, gap = 18, 13
    label = max(round(font(14,True).getlength(s["title"])) for s,_,_ in rows)+16
    col = max(im.width for _,r,_ in rows for im in r)+gap
    w = pad*2+label+len(columns)*col
    h = 125+sum(max(im.height for im in r)+15 for _,r,_ in rows)+36
    canvas = Image.new("RGB", (w,h), "#f3f6f6")
    draw = ImageDraw.Draw(canvas)
    def text(x,y,s,n=14,bold=False,color="#244047"):
        draw.text((x,y), s, font=font(n,bold), fill=color)
    text(pad,8,"TikZ backgrounds  /  End-of-picture frames",27,True)
    text(pad,49,f"Before {old['revision'][:8]}   /   After {new['renderer'][:12]}   |   384 dpi shown at 192 dpi; original page origins, no trimming or alignment.",15)
    text(pad,82,"Original manual picture",16,True)
    text(pad,105,"PDF vs Chrome: pixels differing >16 RGB",12)
    for i,(k,name,sub) in enumerate(columns):
        x = pad+label+i*col
        text(x,82,name,17,True,"#93502f" if k == "before" else "#15645e")
        text(x,105,sub,13)
    y = 128
    for spec,imgs,delta in rows:
        draw.line((pad,y-3,w-pad,y-3), fill="#b3c5c5")
        a,b = spec["manualLines"]
        text(pad,y+8,spec["title"],14,True)
        text(pad,y+32,f"Manual lines {a}-{b}",13)
        text(pad,y+54,f"{delta[0]:,} before   /   {delta[1]:,} after",13)
        for i,im in enumerate(imgs):
            x = pad+label+i*col
            canvas.paste(im,(x,y+3))
            draw.rectangle((x-1,y+2,x+im.width,y+3+im.height), outline="#b4c2c3")
        y += max(im.height for im in imgs)+15
    records = list(new["results"].values())
    same = sum(r["downloadEqualsCli"] for r in records)
    nd, ne = [sum(len(r[k]) for r in records) for k in ("diagnostics","exportDiagnostics")]
    text(pad,y+4,f"Pictures: Till Tantau (2019), PGF/TikZ manual.   |   Pixel counts: any RGB channel changes >16 at 384 dpi.   |   "
         f"Download = strict CLI: {same}/{len(records)}   |   Render / export diagnostics: {nd} / {ne}",13)
    canvas.save(output, optimize=True, dpi=(192,192))


if __name__ == "__main__":
    args = [Path(p).resolve() for p in sys.argv[1:]]
    if len(args) == 1: audit(*args)
    elif len(args) == 3: sheet(*args)
    else: sys.exit("Usage: compare.py STAGE | compare.py BEFORE AFTER SHEET.png")
