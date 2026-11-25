"""Measure actual paint in page millimetres; preserve PDF, browser and librsvg pixels."""
from collections import Counter
import json
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
import pymupdf
from PIL import Image

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent.with_name("native-pgfplots-boxplots")))
from evidence import DPI, MM, rect_path, rgb, sha


def scaled(values):
    return [round(float(v) * MM, 5) for v in values]


def pixels(file):
    with Image.open(file).convert("RGBA") as im:
        return np.asarray(Image.alpha_composite(Image.new("RGBA", im.size, "white"), im).convert("RGB"))


def difference(a, b):
    h, w = np.maximum(a.shape[:2], b.shape[:2])
    def page(im):
        return np.pad(im.astype("int16"), ((0, h-im.shape[0]), (0, w-im.shape[1]), (0, 0)), constant_values=255)
    a, b = page(a), page(b)
    delta = np.max(np.abs(a-b), axis=2)
    return {"changed": int((delta > 0).sum()), "changedOver16": int((delta > 16).sum()),
            "unionInk": int((np.minimum(a, b).min(axis=2) < 240).sum()), "maxChannel": int(delta.max())}


def label_windows(pdf):
    # In these pictures each black PDF text line is one label, across font changes.
    windows = {}
    with pymupdf.open(pdf) as doc:
        for block in doc[0].get_text("rawdict")["blocks"]:
            for line in block.get("lines", []):
                chars = [c for s in line["spans"] if s["color"] == 0 for c in s["chars"] if c["c"].strip()]
                if not chars:
                    continue
                text = "".join(c["c"] for c in chars)
                assert text not in windows, (pdf, "duplicate label", text)
                box = pymupdf.Rect(chars[0]["bbox"])
                for c in chars[1:]:
                    box |= pymupdf.Rect(c["bbox"])
                windows[text] = np.array(box)*DPI/72
    return windows


def label_ink(im, panel, windows):
    unit = DPI/25.4
    boxes = {}
    for text, box in windows.items():
        l,t = np.maximum(0, np.floor(box[:2]-unit*.65).astype(int))
        r,b = np.minimum(im.shape[:2][::-1], np.ceil(box[2:]+unit*.65).astype(int))
        ink = im[t:b, l:r].min(axis=2) < 128
        yy, xx = np.ogrid[t:b, l:r]
        for v in panel["places"]+panel["rects"]+panel["arcs"]:
            x, y = np.array(v["center"])*unit
            w, h = (np.array(v["size"])/2+.25)*unit
            if x+w < l or x-w > r or y+h < t or y-h > b:
                continue
            if v.get("path") == "l":
                a, z = np.array(v["points"][0])*unit
                dx, dy = z-a
                u = np.clip(((xx+.5-a[0])*dx+(yy+.5-a[1])*dy)/(dx*dx+dy*dy), 0, 1)
                ink &= (xx+.5-a[0]-u*dx)**2+(yy+.5-a[1]-u*dy)**2 > (unit*.25)**2
            else:
                ink &= (abs(xx+.5-x)>w) | (abs(yy+.5-y)>h)
        y,x = np.nonzero(ink)
        boxes[text] = [int(l+x.min()),int(t+y.min()),int(l+x.max()),int(t+y.max())] if len(x) else None
    return boxes


def inspect(file, im):
    with (pymupdf.open(file) if file.suffix == ".pdf" else pymupdf.open(stream=subprocess.check_output(
            ["rsvg-convert", "-f", "pdf", file]), filetype="pdf")) as doc:
        page = doc[0]
        data = {"pageMm": scaled(page.rect[2:]), "places": [], "dots": [], "rects": [], "arcs": [], "glyphs": []}
        for b in page.get_text("rawdict")["blocks"]:
            for line in b.get("lines", []):
                for s in line["spans"]:
                    for c in s["chars"]:
                        if c["c"].strip():
                            data["glyphs"].append([c["c"], s["font"], round(s["size"], 4),
                                                   "%06x" % s["color"], scaled(c["origin"])])
        for d in page.get_drawings():
            b, items = d["rect"], d["items"]
            seq = "".join(i[0] for i in items)
            geom = {"center": scaled(((b.x0+b.x1)/2, (b.y0+b.y1)/2)), "size": scaled((b.width, b.height)),
                    "fill": rgb(d["fill"]), "stroke": rgb(d["color"]), "pen": scaled([d["width"] or 0])[0]}
            if seq == "cccc" and abs(b.width-b.height) < .12:
                if b.width < 13 and d["fill"] is not None:
                    x, y = np.array(geom["center"]) * DPI / 25.4
                    r = geom["size"][0] * DPI / 25.4 * .40
                    yy, xx = np.ogrid[:im.shape[0], :im.shape[1]]
                    mask = (xx+.5-x)**2 + (yy+.5-y)**2 < r*r
                    white = np.nonzero(mask & (im.min(axis=2) > 190))
                    geom["lightGlyphPx"] = [int(white[1].min()), int(white[0].min()), int(white[1].max()),
                                            int(white[0].max())] if len(white[0]) else None
                    colors, n = np.unique(im[mask], axis=0, return_counts=True)
                    geom["observedRGB"] = bytes(colors[n.argmax()]).hex() if len(n) else None
                    data["dots"].append(geom)
                else:
                    data["places"].append(geom)
            elif rect_path(d):
                data["rects"].append(geom)
            elif d["color"] is not None and all(i[0] in ("l", "c") for i in items):
                data["arcs"].append({**geom, "path": seq, "points": [[scaled(p) for p in i[1:]] for i in items]})
    data["inkPixels"] = int((im.min(axis=2) < 240).sum())
    return data


def compare(ref, obs):
    out = {"pageDeltaMm": np.round(np.subtract(obs["pageMm"], ref["pageMm"]), 5).tolist()}
    if ref.get("labelInkPx") and obs.get("labelInkPx"):
        out["labelInkDeltaPx"] = {t: np.subtract(obs["labelInkPx"][t], b).tolist()
                                  for t,b in ref["labelInkPx"].items() if b and obs["labelInkPx"].get(t)}
        out["labelInkMissing"] = [t for t,b in ref["labelInkPx"].items() if b and not obs["labelInkPx"].get(t)]
    out["glyphOrigins"] = {}
    for color in ("000000","ffffff"):
        orig = [g for g in ref["glyphs"] if g[3] == color]
        available = [g for g in obs["glyphs"] if g[3] == color]
        offsets = []
        for p in orig:
            same = [g for g in available if g[0] == p[0] and abs(g[2]-p[2]) < .02]
            if same:
                q = min(same, key=lambda g: np.linalg.norm(np.subtract(g[4],p[4])))
                available.remove(q)
                offsets.append(np.abs(np.subtract(q[4],p[4])))
        out["glyphOrigins"][color] = {"expected":len(orig), "matched":len(offsets), "extra":len(available),
                                      "maxAbsXYmm":np.round(np.max(offsets,axis=0),5).tolist() if offsets else None}
    for kind in ("places", "dots", "rects", "arcs"):
        a, b = ref[kind], obs[kind]
        rec = out[kind] = {"counts": [len(a), len(b)]}
        if kind == "arcs":
            ca, cb = (Counter(v["path"] for v in values) for values in (a,b))
            rec["pathCounts"] = {path: [ca[path], cb[path]] for path in sorted(ca | cb)}
        if not a or len(a) != len(b):
            continue
        pool = list(b)
        pairs = []
        for p in a:
            q = min(pool, key=lambda v: np.linalg.norm(np.subtract(p["center"], v["center"])))
            pool.remove(q)
            pairs.append((p, q))
        for key in ("center", "size", "pen"):
            rec[key+"MaxMm"] = round(max(float(np.max(np.abs(np.subtract(p[key], q[key])))) for p,q in pairs), 5)
        rec["paintChanges"] = sum(any(p[k] != q[k] for k in ("stroke", "fill")) for p, q in pairs)
        if kind == "dots":
            rec["sampleColorChanges"] = sum(p["observedRGB"] != q["observedRGB"] for p, q in pairs)
            rec["glyphPresenceChanges"] = sum(bool(p["lightGlyphPx"]) != bool(q["lightGlyphPx"]) for p, q in pairs)
            rec["glyphBoxMaxPx"] = max((int(np.max(np.abs(np.subtract(p["lightGlyphPx"], q["lightGlyphPx"]))))
                                        for p, q in pairs if p["lightGlyphPx"] and q["lightGlyphPx"]), default=None)
        if kind == "arcs":
            rec["pathChanges"] = sum(p["path"] != q["path"] for p, q in pairs)
            by_path = {}
            for p, q in pairs:
                if p["path"] == q["path"]:
                    delta = max(float(np.max(np.abs(np.subtract(x,y)))) for x,y in zip(p["points"],q["points"]))
                    by_path[p["path"]] = max(by_path.get(p["path"], 0), round(delta, 5))
            rec["pointMaxMmByPath"] = by_path
            rec["pointMaxMm"] = max(by_path.values(), default=None)
    return out


def run(stage):
    load = lambda file: json.loads(file.read_text())
    cap = load(stage / "capture.json")
    summary = load(stage / "summary.json")
    assert cap["summarySha256"] == sha(stage/"summary.json") and summary["gate"]["accepted"]
    assert cap["dpi"] == DPI and not cap["errors"] and not cap["badRequests"]
    entries = {e["id"]: e for e in summary["cases"]}
    assert Counter(r["id"] for r in cap["rows"]) == Counter(e["id"] for e in summary["cases"])
    assert len(entries) == len(cap["rows"])
    root = Path(cap["fixtureRoot"])
    manual = Path(subprocess.check_output(["kpsewhich", "-format=TeX system documentation",
                                          "pgfmanual-en-library-petri.tex"], text=True).strip())
    lines = manual.read_bytes().splitlines(keepends=True)
    manifest = {r["id"]: r for r in load(root/"manifest.json")["cases"]}
    evidence = {"renderer": cap["environment"]["rendererSha256"], "revision": cap["revision"],
                "browser": cap["browser"], "dpi": DPI, "captureSha256": sha(stage/"capture.json"), "manual": str(manual),
                "manualSha256": sha(manual), "converter": shutil.which("tikztosvg"), "results": {}}
    for row in cap["rows"]:
        case = row["id"]
        a, b = manifest[case]["manualLines"]
        src = root / row["source"]
        tex = src.read_bytes()
        entry = entries[case]
        assert row["source"] == manifest[case]["source"] == entry["source"]
        assert row["editorRenderClicked"] and row["previousSvgDetached"] and row["originalPdfInputMatchesSource"]
        assert row["renderFingerprint"] == entry["renderFingerprint"] and entry["fingerprints"]["environment"] == cap["environment"]
        assert entry["referenceKind"] == "tikztosvg" and entry["tikztosvgStatus"] == entry["mactexPngStatus"] == "rendered"
        assert entry["fingerprints"]["artifacts"]["tikztosvgSvg"] == row["panels"]["tikztosvg"]["svgSha256"]
        assert tex.split(b"\\begin{document}\n",1)[1].split(b"\\end{document}",1)[0] == b"".join(lines[a-1:b])
        work = stage/".mactex-work"/case
        assert (work/"reference.tex").read_bytes() == tex and sha(src) == row["sourceSha256"]
        assert sha(work/"reference.pdf") == row["panels"]["pdf"]["pdfSha256"]
        windows = label_windows(work/"reference.pdf")
        panels, images = {}, {}
        for k in ("pdf", "rsvg", "live", "download", "cli"):
            source = row["panels"][{"rsvg":"tikztosvg", "cli":"download"}.get(k,k)]
            ext = "pdf" if k == "pdf" else "svg"
            f, png = stage/source[ext+"File"], stage/source["file"]
            assert sha(f) == source[ext+"Sha256"] and sha(png) == source["sha256"]
            if k in ("cli", "rsvg"):
                dest = stage/"capture"/k
                dest.mkdir(exist_ok=True)
                if k == "cli":
                    f = dest/(case+".svg")
                    subprocess.run(["node", Path(cap["tree"])/"bin/tikz2svg.js", "--strict", "--math-renderer",
                                    "svg-text", src, "-o", f], check=True)
                png = dest/(case+".png")
                subprocess.run(["rsvg-convert", "-b", "white", "-d", str(DPI), "-p", str(DPI), "-o", png, f], check=True)
            images[k] = pixels(png)
            panels[k] = dict(**inspect(f, images[k]), file=str(f.relative_to(stage)), png=str(png.relative_to(stage)),
                             sha256=sha(f), pngSha256=sha(png))
            if len(panels[k]["places"]) == len(panels["pdf"]["places"]):
                panels[k]["labelInkPx"] = label_ink(images[k], panels[k], windows)
        if case == "mutual-exclusion":
            pdf = panels["pdf"]
            labels = ({f"{p}{i}" for p in "pq" for i in range(1,7)} |
                      {f"m{i}={v}" for i in (1,2) for v in "ft"} | {"hold=1", "hold=2"})
            assert pdf["labelInkPx"].keys() == labels and all(pdf["labelInkPx"].values())
            assert [len(pdf[k]) for k in ("places","rects","dots")] == [18,16,5]
            assert Counter(v["path"] for v in pdf["arcs"]) == {"l": 50, "cc": 56}
        rec = evidence["results"][case] = {
            "sourceSha256": sha(src), "manualLines": [a,b], "nativeWarnings": [l for l in (work/"reference.log").read_text(
                errors="replace").splitlines() if "Warning:" in l], "diagnostics": row["diagnostics"],
            "converterInputSha256": sha(stage/entry["tikztosvgInput"]),
            "converterTransformations": entry["referenceProvenance"]["transformations"],
            "exportDiagnostics": row["exportDiagnostics"], "loadedFonts": row["panels"]["live"]["fonts"],
            "cliEqualsDownload": panels["cli"]["sha256"] == panels["download"]["sha256"],
            "vsPdf": {k: compare(panels["pdf"], p) for k,p in panels.items() if k != "pdf"},
            "vsConverter": {k: compare(panels["rsvg"], panels[k]) for k in ("live","download","cli")},
            "pixelDiff": {k: difference(images["pdf"], im) for k, im in images.items() if k != "pdf"},
            "pixelDiffVsConverter": {k: difference(images["rsvg"], images[k]) for k in ("live","download","cli")},
            "liveVsDownloadPx": difference(images["live"], images["download"]), "panels": panels}
        print(case, "dots PDF / converter / Chrome:", *(len(panels[k]["dots"]) for k in ("pdf","rsvg","live")),
              "| live vs Download:", rec["liveVsDownloadPx"]["changed"], "pixels")
    (stage/"proof.json").write_text(json.dumps(evidence, indent=2)+"\n")


if __name__ == "__main__":
    run(Path(sys.argv[1]).resolve())
