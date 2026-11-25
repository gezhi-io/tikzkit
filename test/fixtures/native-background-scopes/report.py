"""Measure saved, real pages; seal the raw evidence or draw a sheet without rendering."""
import json
import subprocess
import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
sys.dont_write_bytecode = True
sys.path[:0] = [str(HERE.with_name("native-backgrounds")), str(HERE.with_name("native-petri"))]
from compare import geometry
from proof import DPI, difference, pixels, sha
from sheet import font, tile


def read(file):
    return json.loads(file.read_bytes())


def measure(stage):
    cap, summary = read(stage/"capture.json"), read(stage/"summary.json")
    assert cap["summarySha256"] == sha(stage/"summary.json") and summary["gate"]["accepted"]
    assert summary["tikztosvgEngine"] == summary["nativeLatexEngine"] == "pdflatex"
    assert cap["dpi"] == DPI and not cap["errors"] and not cap["badRequests"]
    specs = {s["id"]: s for s in read(HERE/"manifest.json")["cases"]}
    probes = read(HERE/"probes.json")
    entries = {e["id"]: e for e in summary["cases"]}
    assert sorted(specs) == sorted(probes) == sorted(entries) == sorted(r["id"] for r in cap["rows"])
    out = {"revision": cap["revision"], "renderer": cap["environment"]["rendererSha256"],
           "browser": cap["browser"], "dpi": DPI, "captureSha256": sha(stage/"capture.json"),
           "probesSha256": sha(HERE/"probes.json"), "results": {}}
    if cap["revision"] == "ef8f4152":
        assert out["renderer"] == "24a68f0ca1d3b4b8686fac9ca9780148e7f66b4fa65d6321f7bf2a0990e245ef"
    elif cap["revision"].startswith("after-"):
        assert cap["revision"] == "after-"+out["renderer"][:12]
    for row in cap["rows"]:
        case = row["id"]
        spec, entry = specs[case], entries[case]
        source = HERE/spec["source"]
        assert entry["source"] == row["source"] == spec["source"]
        assert sha(source) == row["sourceSha256"] == entry["fingerprints"]["sourceSha256"]
        assert sha(HERE/"manifest.json") == entry["fingerprints"]["manifestSha256"]
        assert cap["environment"] == entry["fingerprints"]["environment"]
        assert row["renderFingerprint"] == entry["renderFingerprint"]
        assert row["editorRenderClicked"] and row["previousSvgDetached"] and row["originalPdfInputMatchesSource"]
        assert row["suggestedDownload"] == case+".svg"
        assert entry["referenceKind"] == "tikztosvg" and entry["tikztosvgStatus"] == entry["mactexPngStatus"] == "rendered"
        original = stage/".mactex-work"/case/"reference.tex"
        assert sha(original) == sha(source) and sha(original.with_suffix(".pdf")) == row["panels"]["pdf"]["pdfSha256"]
        if "manual" in spec:
            manual = subprocess.check_output(["kpsewhich", "-format=TeX system documentation", spec["manual"]], text=True).strip()
            a, b = spec["manualLines"]
            body = source.read_bytes().split(b"\\begin{document}\n",1)[1].split(b"\\end{document}",1)[0]
            assert body == b"".join(Path(manual).read_bytes().splitlines(keepends=True)[a-1:b])
        images, panels = {}, {}
        for key in ("pdf", "converter", "live", "download"):
            p = row["panels"]["tikztosvg" if key == "converter" else key]
            ext = "pdf" if key == "pdf" else "svg"
            vector, png = stage/p[ext+"File"], stage/p["file"]
            assert sha(vector) == p[ext+"Sha256"] and sha(png) == p["sha256"]
            if key == "converter":
                assert vector == stage/entry["tikztosvgSvg"]
                png = stage/"capture"/"rsvg"/(case+".png")
                png.parent.mkdir(exist_ok=True)
                subprocess.run(["rsvg-convert", "-b", "white", "-d", str(DPI), "-p", str(DPI),
                                "-o", png, vector], check=True)
            im = images[key] = pixels(png)
            g = geometry(vector)
            # All probe addresses are millimetres from the original page's top left.
            samples = {k: bytes(im[int(y*DPI/25.4), int(x*DPI/25.4)]).hex()
                       for k, (x,y,_) in probes[case].items()}
            if key == "pdf":
                assert samples == {k: p[2] for k,p in probes[case].items()}, (case,samples)
            panels[key] = {"file": str(vector.relative_to(stage)), "sha256": sha(vector),
                           "png": str(png.relative_to(stage)), "pngSha256": sha(png),
                           "pageMm": g["pageMm"], "probes": samples,
                           "paintOrder": [{k:d[k] for k in ("fill","stroke","penMm")} for d in g["paths"]]}
            if case == "scopes-manual-crossed-pens":
                panels[key]["shafts"] = [{"stroke": d["stroke"], "penMm": d["penMm"], "endsMm": d["linesMm"][0]}
                                         for d in g["paths"] if d["ops"] == "l" and d["stroke"]]
        result = out["results"][case] = {
            "sourceSha256": sha(source), "converterInputSha256": sha(stage/entry["tikztosvgInput"]),
            "diagnostics": row["diagnostics"], "exportDiagnostics": row["exportDiagnostics"], "panels": panels,
            "vsPdf": {k:difference(images["pdf"], im) for k,im in images.items() if k != "pdf"},
            "vsConverter": difference(images["converter"], images["live"]),
            "liveVsDownload": difference(images["live"], images["download"])}
        if case == "scopes-manual-crossed-pens":
            ref = panels["pdf"]["shafts"]
            assert [s["stroke"] for s in ref] == ["ff0000","000000"]
            result["shaftChecks"] = {}
            for k,p in panels.items():
                same = [s["stroke"] for s in p["shafts"]] == [s["stroke"] for s in ref]
                pairs = list(zip(p["shafts"],ref)) if same else []
                result["shaftChecks"][k] = {"redThenBlack": same, "samplesMatch": p["probes"] == panels["pdf"]["probes"],
                    "maxPenDeltaMm": round(max(abs(s["penMm"]-t["penMm"]) for s,t in pairs),5) if same else None,
                    "maxEndpointDeltaMm": round(max(abs(x-y) for s,t in pairs for x,y in zip(s["endsMm"],t["endsMm"])),5) if same else None}
        print(case, "PDF vs Render / Download (>16):",
              *(result["vsPdf"][k]["changedOver16"] for k in ("live","download")))
    with (stage/"metrics.json").open("x") as f:
        json.dump(out, f, indent=2)
        f.write("\n")


def verified(stage):
    m, cap = read(stage/"metrics.json"), read(stage/"capture.json")
    assert m["captureSha256"] == sha(stage/"capture.json") and cap["summarySha256"] == sha(stage/"summary.json")
    assert m["renderer"] == cap["environment"]["rendererSha256"] and m["revision"] == cap["revision"]
    for result in m["results"].values():
        for p in result["panels"].values():
            assert sha(stage/p["file"]) == p["sha256"] and sha(stage/p["png"]) == p["pngSha256"]
    return m


def seal(stage, archive):
    # Only capture evidence, not an entire copy of the renderer or its dependencies.
    verified(stage)
    files = {stage/name for name in ("metrics.json", "capture.json", "summary.json")}
    if (stage/"public-routes.json").exists():
        files.add(stage/"public-routes.json")
    for folder in ("capture", "tikztosvg-svg", "tikztosvg-input", "tikzkit-svg", ".tikzkit-preamble-inputs"):
        files.update(p for p in (stage/folder).rglob("*") if p.is_file())
    files.update((stage/".mactex-work").glob("*/reference.tex"))
    files.update((stage/".mactex-work").glob("*/reference.log"))
    archive.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(archive, "x", ZIP_DEFLATED) as z:
        for p in sorted(files):
            z.write(p, p.relative_to(stage))
        for name in ("manifest.json", "probes.json"):
            z.write(HERE/name, "inputs/"+name)
    print("Sealed", archive, sha(archive))


def edges(stage):
    for case, result in verified(stage)["results"].items():
        panels = result["panels"]
        for k in ("converter","live","download"):
            a, b = [pixels(stage/panels[s]["png"]) for s in ("pdf",k)]
            h,w = np.maximum(a.shape[:2], b.shape[:2])
            def pad(im):
                return np.pad(im, ((0,h-im.shape[0]),(0,w-im.shape[1]),(0,0)), constant_values=255)
            a, b = pad(a), pad(b)
            bad = np.abs(a.astype("int16")-b).max(axis=2) > 16
            ref = Image.fromarray(a)
            low = np.asarray(ref.filter(ImageFilter.MinFilter(5)))
            high = np.asarray(ref.filter(ImageFilter.MaxFilter(5))).astype("int16")
            near_edge = (high-low).max(axis=2) > 16
            assert bad.sum() == result["vsPdf"][k]["changedOver16"]
            print(f"{case} {k}: {bad.sum()} different; {(bad & ~near_edge).sum()} outside a 5x5 PDF edge window")


def sheet(before, after, dest):
    old, new = [verified(stage) for stage in (before,after)]
    assert old["revision"] == "ef8f4152" and new["revision"].startswith("after-")
    assert old["renderer"] != new["renderer"] and old["browser"] == new["browser"]
    assert old["probesSha256"] == new["probesSha256"] and old["results"].keys() == new["results"].keys()
    cols = [("pdf","Original PDF","pdflatex / Poppler"), ("converter","Native converter","tikztosvg / librsvg"),
            ("before","Before","Chrome / Render"), ("live","After","Chrome / Render"),
            ("download","After download","SVG reopened in Chrome")]
    rows = []
    for spec in read(HERE/"manifest.json")["cases"]:
        case = spec["id"]
        a, b = old["results"][case], new["results"][case]
        for k in ("sourceSha256", "converterInputSha256"):
            assert a[k] == b[k]
        for k in ("pdf","converter"):
            assert a["panels"][k]["pngSha256"] == b["panels"][k]["pngSha256"]
        imgs = [tile(before,a["panels"]["live"]) if k == "before" else tile(after,b["panels"][k]) for k,*_ in cols]
        if "corpus" in spec:
            # A second uniform 2:1 downsample for this wider row; never fit individual cells.
            small = []
            for im in imgs:
                page = Image.new("RGB",(im.width+im.width%2,im.height+im.height%2),"white")
                page.paste(im)
                small.append(page.resize((page.width//2,page.height//2), Image.Resampling.LANCZOS))
            imgs = small
        rows.append((spec, imgs, [r["vsPdf"]["live"]["changedOver16"] for r in (a,b)]))
    pad, gap = 20, 16
    col = max(im.width for _,imgs,_ in rows for im in imgs) + gap
    width = 2*pad + len(cols)*col-gap
    height = 152 + sum(max(im.height for im in imgs)+54 for _,imgs,_ in rows) + 29
    page = Image.new("RGB",(width,height),"#f4f7f7")
    draw = ImageDraw.Draw(page)
    def text(x,y,s,size=15,bold=False,color="#243e44"):
        draw.text((x,y),s,font=font(size,bold),fill=color)
    text(pad,12,"Explicit background scopes",29,True)
    text(pad,55,f"Before {old['revision']}   /   After {new['renderer'][:12]}   |   Chrome {new['browser']}   |   Whole pages, fixed top-left origin.",15)
    for i,(k,name,sub) in enumerate(cols):
        text(pad+i*col,89,name,19,True,"#954f35" if k == "before" else "#14645b")
        text(pad+i*col,115,sub,14)
    y = 147
    for i,(spec,imgs,counts) in enumerate(rows,1):
        draw.line((pad,y-6,width-pad,y-6),fill="#adbfbd")
        text(pad,y,f"{i:02}   {spec['title']}",18,True)
        label = f"PDF vs Render: {counts[0]:,} to {counts[1]:,} px   |   Shown at {96 if 'corpus' in spec else 192} dpi"
        text(width-pad-draw.textlength(label,font=font(14)),y+3,label,14)
        for j,im in enumerate(imgs):
            x = pad+j*col
            page.paste(im,(x,y+32))
            draw.rectangle((x-1,y+31,x+im.width,y+32+im.height),outline="#a9b7b8")
        y += max(im.height for im in imgs)+54
    text(pad,y-2,"Pixel counts: any 8-bit RGB channel differs by >16 at 384 dpi. White padding on right and bottom only. No ink fitting, shifting or trimming.",14)
    page.save(dest, optimize=True, dpi=(192,192))


if __name__ == "__main__":
    op, *args = sys.argv[1:]
    paths = [Path(s).resolve() for s in args]
    if op == "measure" and len(paths) == 1: measure(*paths)
    elif op == "seal" and len(paths) == 2: seal(*paths)
    elif op == "edges" and len(paths) == 1: edges(*paths)
    elif op == "sheet" and len(paths) == 3: sheet(*paths)
    else: sys.exit("report.py measure STAGE | seal STAGE NEW.zip | edges STAGE | sheet BEFORE AFTER OUT.png")
