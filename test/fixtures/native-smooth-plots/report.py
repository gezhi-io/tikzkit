"""Measure actual captures, package unique evidence once, and replay the sheet."""
import hashlib
import io
import json
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
sys.dont_write_bytecode = True
sys.path.insert(0, str(HERE.with_name("native-petri")))
from proof import DPI, difference, pixels, sha
from sheet import font, tile
from vectors import compare, geometry

BASE = "fe839777a401743cb0afc5a37f83caac224cfb9eec562ad42c8e79ba49b65cf1"
PANELS = ("pdf", "converter", "live", "download")
CHECKS = {
    "smooth-manual-tensions":["MCCCCZ"]*3, "smooth-manual-cycle-sharp":["MCCCCZMLLLZ"],
    "smooth-manual-parametric":["M"+"C"*24], "smooth-open-extremes":["MCCC"]*2,
    "smooth-pgfplots-manual":["MCC"], "smooth-pgfplots-dashed-cycle":["MCCCZ"],
}


def read(p):
    return json.loads(p.read_bytes())


def spec_body(p):
    return p.read_bytes().split(b"\\begin{document}\n", 1)[1].split(b"\\end{document}", 1)[0]


def check_source(s):
    body = spec_body(HERE/s["source"])
    if "manual" in s:
        name = s["manual"]
        archived = name.startswith("pgfplots.")
        source = subprocess.check_output(["kpsewhich", "-format=TeX system documentation",
            "pgfplots.doc.src.tar.bz2" if archived else name], text=True).strip()
        if archived:
            with tarfile.open(source) as a:
                data = a.extractfile(name).read()
        else:
            data = Path(source).read_bytes()
        first, last = s["lines"]
        sample = b"".join(data.splitlines(keepends=True)[first-1:last])
        if s.get("expandTikz"):
            sample = sample.replace(b"\\tikz ", b"\\tikz\n", 1) if sample.startswith(b"\\tikz ") else sample
            sample = sample.replace(b"\\tikz", b"\\begin{tikzpicture}", 1) + b"\\end{tikzpicture}\n"
        assert sample == body, s
    elif "variantOf" in s:
        original = spec_body(HERE/(s["variantOf"]+".tex"))
        assert body == original.replace(b"        smooth,", b"        smooth cycle, tension=1, dashed,")


def pixel_diff(a, b, edges=False):
    result = difference(a, b)
    if edges:
        h, w = np.maximum(a.shape[:2], b.shape[:2])
        def pad(im):
            return np.pad(im, ((0,h-im.shape[0]),(0,w-im.shape[1]),(0,0)), constant_values=255)
        a, b = pad(a), pad(b)
        mask = np.max(np.abs(a.astype("int16")-b), axis=2) > 16
        native = Image.fromarray(a)
        high = np.asarray(native.filter(ImageFilter.MaxFilter(5))).astype("int16")
        low = np.asarray(native.filter(ImageFilter.MinFilter(5)))
        result["outside5x5ReferenceEdge"] = int((mask & ((high-low).max(axis=2) <= 16)).sum())
    return result


def measure(stage):
    cap, sm = (read(stage/s) for s in ("capture.json", "summary.json"))
    specs = {s["id"]:s for s in read(HERE/"manifest.json")["cases"]}
    entries = {e["id"]:e for e in sm["cases"]}
    assert cap["dpi"] == DPI and not cap["errors"] and not cap["badRequests"]
    assert cap["summarySha256"] == sha(stage/"summary.json") and sm["gate"]["accepted"]
    assert sm["tikztosvgEngine"] == sm["nativeLatexEngine"] == "pdflatex" and sm["comparisonGridMode"] == "none"
    assert specs.keys() == entries.keys() == CHECKS.keys() == {r["id"] for r in cap["rows"]}
    renderer = cap["environment"]["rendererSha256"]
    assert (cap["revision"] == "75b9b386") == (renderer == BASE)
    # The shared renderer fingerprint omits the browser UI; also identify its actual assets.
    web = Path(cap["tree"])/"web"
    workbench = hashlib.sha256(json.dumps(sorted(
        (p.name, sha(p)) for p in web.iterdir() if p.suffix in (".js", ".css", ".html"))).encode()).hexdigest()
    result = {"revision":cap["revision"], "environment":cap["environment"], "workbenchSha256":workbench,
              "browser":cap["browser"], "dpi":DPI, "pdftocairo":cap["pdftocairo"],
              "captureSha256":sha(stage/"capture.json"), "summarySha256":sha(stage/"summary.json"),
              "results":{}}
    for row in cap["rows"]:
        case = row["id"]
        spec, e = specs[case], entries[case]
        src, original = HERE/spec["source"], stage/".mactex-work"/case/"reference.tex"
        assert e["source"] == row["source"] == spec["source"] and sha(original) == sha(src)
        assert sha(src) == row["sourceSha256"] == e["fingerprints"]["sourceSha256"]
        assert row["renderFingerprint"] == e["renderFingerprint"] and sha(HERE/"manifest.json") == e["fingerprints"]["manifestSha256"]
        assert cap["environment"] == e["fingerprints"]["environment"] and row["suggestedDownload"] == case+".svg"
        assert row["editorRenderClicked"] and row["previousSvgDetached"] and row["originalPdfInputMatchesSource"]
        assert e["referenceKind"] == "tikztosvg" and e["tikztosvgStatus"] == e["mactexPngStatus"] == "rendered"
        assert e["referenceProvenance"]["independentNumerics"]
        assert sha(original.with_suffix(".pdf")) == row["panels"]["pdf"]["pdfSha256"]
        check_source(spec)
        images, panels = {}, {}
        for k in PANELS:
            p = row["panels"]["tikztosvg" if k == "converter" else k]
            ext = "pdf" if k == "pdf" else "svg"
            vec, png = stage/p[ext+"File"], stage/p["file"]
            assert sha(vec) == p[ext+"Sha256"] and sha(png) == p["sha256"]
            if k == "converter":
                assert vec == stage/e["tikztosvgSvg"] and sha(vec) == e["fingerprints"]["artifacts"]["tikztosvgSvg"]
                png = stage/"capture"/"rsvg"/(case+".png")
                png.parent.mkdir(exist_ok=True)
                subprocess.run(["rsvg-convert", "-b", "white", "-d", str(DPI), "-p", str(DPI), "-o", png, vec], check=True)
            images[k] = pixels(png)
            panels[k] = {**geometry(vec, case), "file":str(vec.relative_to(stage)), "sha256":sha(vec),
                         "png":str(png.relative_to(stage)), "pngSha256":sha(png)}
        ref = panels["pdf"]
        assert compare(ref,ref)["observedOperators"] == CHECKS[case]
        if case.startswith("smooth-pgfplots-"):
            assert all(p["blueMarks"] == 3 for p in panels.values())
        rec = result["results"][case] = {
            "sourceSha256":sha(src), "inputSha256":sha(stage/e["tikztosvgInput"]), "panels":panels,
            "diagnostics":row["diagnostics"], "exportDiagnostics":row["exportDiagnostics"],
            "vsPdf":{k:pixel_diff(images["pdf"],images[k],True) for k in PANELS[1:]},
            "vsConverter":{k:pixel_diff(images["converter"],images[k]) for k in PANELS[2:]},
            "geometryVsPdf":{k:compare(ref,panels[k]) for k in PANELS[1:]},
            "geometryVsConverter":{k:compare(panels["converter"],panels[k]) for k in PANELS[2:]},
            "liveVsDownload":pixel_diff(images["live"],images["download"])}
        print(case, "PDF vs converter / Render / Download:", *(rec["vsPdf"][k]["changedOver16"] for k in PANELS[1:]),
              "max Render control error (mm):", rec["geometryVsPdf"]["live"]["handlesMaxAbsMm"])
    with (stage/"metrics.json").open("x") as f:
        json.dump(result, f, separators=(",",":"))
        f.write("\n")


def pair(before, after):
    a, b = (read(stage/"metrics.json") for stage in (before, after))
    assert a["revision"] == "75b9b386" and a["environment"]["rendererSha256"] == BASE
    assert b["revision"] == "after" and b["environment"]["rendererSha256"] != BASE
    assert a["browser"] == b["browser"] and a["results"].keys() == b["results"].keys() == CHECKS.keys()
    for stage, m in ((before,a),(after,b)):
        assert m["captureSha256"] == sha(stage/"capture.json") and m["summarySha256"] == sha(stage/"summary.json")
        cap = read(stage/"capture.json")
        assert m["environment"] == cap["environment"] and m["revision"] == cap["revision"]
    routes = read(after/"public-routes.json")
    assert len(routes) == 5 and {p["route"] for p in routes} == {"/#"+c for c in CHECKS if c != "smooth-open-extremes"}
    for p in routes:
        assert b["results"][p["route"][2:]]["panels"]["download"]["sha256"] == p["downloadSha256"]
    for k in ("fontsSha256","externalFontInventorySha256"):
        assert a["environment"][k] == b["environment"][k]
    for case, r in a["results"].items():
        t = b["results"][case]
        for key in ("sourceSha256","inputSha256"):
            assert r[key] == t[key]
        for key in ("pdf","converter"):
            assert r["panels"][key]["pngSha256"] == t["panels"][key]["pngSha256"]
            assert r["panels"][key]["paths"] == t["panels"][key]["paths"]
    return a, b


def sheet(before, after, target):
    a, b = pair(before, after)
    cols = [("pdf","Original PDF","pdflatex / Poppler"), ("converter","Native SVG","tikztosvg / librsvg"),
            ("before","Before","Chrome / Render"), ("live","After","Chrome / Render"),
            ("download","After download","Reopened in Chrome")]
    rows = []
    for s in read(HERE/"manifest.json")["cases"]:
        old, new = a["results"][s["id"]], b["results"][s["id"]]
        imgs = [tile(before,old["panels"]["live"]) if k == "before" else tile(after,new["panels"][k]) for k,*_ in cols]
        dpi = 192
        if s["id"].startswith("smooth-pgfplots-") or s["id"] == "smooth-manual-tensions":
            dpi = 96
            downsized = []
            for im in imgs:
                page = Image.new("RGB", (im.width+im.width%2,im.height+im.height%2), "white")
                page.paste(im)
                downsized.append(page.resize((page.width//2,page.height//2), Image.Resampling.LANCZOS))
            imgs = downsized
        rows.append((s["title"],imgs,dpi,old["vsPdf"]["live"]["changedOver16"],new["vsPdf"]["live"]["changedOver16"]))
    pad = 21
    col = max(im.width for _,imgs,*_ in rows for im in imgs)+24
    width, height = 2*pad+len(cols)*col-24, 150+sum(max(im.height for im in imgs)+56 for _,imgs,*_ in rows)+38
    canvas = Image.new("RGB",(width,height),"#f3f6f6")
    d = ImageDraw.Draw(canvas)
    def text(x,y,s,n=15,b=False,fill="#233c43"):
        d.text((x,y),s,font=font(n,b),fill=fill)
    text(pad,10,"Smooth plots   /   TikZ and PGFPlots",30,True)
    text(pad,55,f"Baseline 75b9b386   |   Final renderer {b['environment']['rendererSha256'][:12]}   |   Chrome {b['browser']}   |   Full physical pages, common top-left origin.")
    for i,(k,name,sub) in enumerate(cols):
        text(pad+i*col,89,name,19,True,"#975034" if k == "before" else "#14645b")
        text(pad+i*col,115,sub,14)
    y = 148
    for i,(title,imgs,dpi,old,new) in enumerate(rows,1):
        d.line((pad,y-5,width-pad,y-5),fill="#a7bfba")
        text(pad,y,f"{i:02}    {title}",17,True)
        note = f"PDF vs Render: {old:,} to {new:,} pixels   |   shown at {dpi} dpi"
        text(width-pad-d.textlength(note,font=font(14)),y+3,note,14)
        for j,im in enumerate(imgs):
            x = pad+j*col
            canvas.paste(im,(x,y+32))
            d.rectangle((x-1,y+31,x+im.width,y+32+im.height),outline="#aabbbb")
        y += max(im.height for im in imgs)+56
    text(pad,y,"Counts: any RGB channel differs by >16 at 384 dpi. White padding only at right/bottom. No ink fitting or registration.",14)
    canvas.save(target, optimize=True, dpi=(192,192))


def bundle(before, after, target):
    pair(before, after)
    # Share exact byte strings across panels and runs. No renderer trees, duplicate native pages,
    # full-window screenshots, CLI comparison tiles or LaTeX scratch directories in the bundle.
    index, saved = {}, {}
    with tarfile.open(target, "x:xz") as z:
        for name, stage in (("before",before), ("after",after)):
            m = read(stage/"metrics.json")
            assert m["captureSha256"] == sha(stage/"capture.json") and m["summarySha256"] == sha(stage/"summary.json")
            files = {stage/n for n in ("capture.json","summary.json","metrics.json")}
            if name == "after":
                files.add(stage/"public-routes.json")
            for r in m["results"].values():
                for p in r["panels"].values():
                    for key, digest in (("file","sha256"),("png","pngSha256")):
                        assert sha(stage/p[key]) == p[digest]
                        files.add(stage/p[key])
            for root in ("tikztosvg-input",".tikzkit-preamble-inputs"):
                files.update(p for p in (stage/root).rglob("*") if p.is_file())
            files.update((stage/".mactex-work").glob("*/reference.tex"))
            for p in sorted(files):
                digest = sha(p)
                member = name+"/"+p.relative_to(stage).as_posix()
                index[member] = digest
                info = tarfile.TarInfo(member)
                if digest in saved:
                    info.type, info.linkname = tarfile.LNKTYPE, saved[digest]
                    z.addfile(info)
                else:
                    info.size = p.stat().st_size
                    with p.open("rb") as src:
                        z.addfile(info,src)
                    saved[digest] = member
        checksums = (json.dumps(index,sort_keys=True,indent=2)+"\n").encode()
        info = tarfile.TarInfo("sha256.json")
        info.size = len(checksums)
        z.addfile(info,io.BytesIO(checksums))
    print(f"{len(index)} entries, {len(saved)} distinct files, {target.stat().st_size:,} bytes; SHA-256 {sha(target)}")


def replay(archive, target):
    with tempfile.TemporaryDirectory() as tmp, tarfile.open(archive,"r:xz") as z:
        base = Path(tmp).resolve()
        z.extractall(base,filter="data")
        for name,digest in read(base/"sha256.json").items():
            p = (base/name).resolve()
            assert p.is_relative_to(base) and sha(p) == digest, name
        for stage in (base/"before", base/"after"):
            m = read(stage/"metrics.json")
            for case, r in m["results"].items():
                assert r["sourceSha256"] == sha(HERE/(case+".tex"))
                images = {}
                for k,p in r["panels"].items():
                    assert sha(stage/p["file"]) == p["sha256"] and sha(stage/p["png"]) == p["pngSha256"]
                    g = geometry(stage/p["file"],case)
                    assert all(p[key] == v for key,v in g.items())
                    images[k] = pixels(stage/p["png"])
                for k in PANELS[1:]:
                    assert pixel_diff(images["pdf"],images[k],True) == r["vsPdf"][k]
                    assert compare(r["panels"]["pdf"],r["panels"][k]) == r["geometryVsPdf"][k]
                for k in PANELS[2:]:
                    assert pixel_diff(images["converter"],images[k]) == r["vsConverter"][k]
                    assert compare(r["panels"]["converter"],r["panels"][k]) == r["geometryVsConverter"][k]
                assert pixel_diff(images["live"],images["download"]) == r["liveVsDownload"]
        sheet(base/"before",base/"after",target)


if __name__ == "__main__":
    op, *args = sys.argv[1:]
    fn = {"measure":measure,"sheet":sheet,"bundle":bundle,"replay":replay}[op]
    fn(*(Path(p).resolve() for p in args))
