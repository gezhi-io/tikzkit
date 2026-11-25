"""Inventory physical paint, not renderer roles. No image registration or fitting."""
import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import subprocess
import tarfile

import numpy as np
from PIL import Image
import pymupdf

PREP, RAW = "boxplot-manual-prepared", "boxplot-manual-samples"
VERT, OLD, NEW, ORD = "vertical-mixed", "compat-111", "compat-112", "ordinals-width"
MM, DPI, TOL = 25.4 / 72, 384, .02
ROLES = ("body", "stem", "cap", "median", "outlier", "regular", "otherLine", "otherMark")
# Native data limits (including default enlargement on the two manual axes).
# These only decode PDF observations; comparisons use unregistered page mm.
LIMITS = {PREP: (31.8, 58.2, .32, 3.68), RAW: (.1, 10.9, .52, 1.48),
          VERT: (0, 6, -1, 17), OLD: (-4, 12, 0, 2), NEW: (-4, 12, 0, 2), ORD: (0, 20, 0, 6)}
# Independent source predictions: (lane, Q1, Q3), median values, whisker tips, outliers.
EXPECTED = {
    PREP: ([(1,45,47.5),(2,39,41),(3,44,46)], [47,40,45], [42,48,36,43,41,47], [34,40,56,35,55]),
    RAW: ([(1,3.5,9)], [7.5], [1,10], []),
    VERT: ([(1,4,9),(2,6,10),(5,5,8)], [6,6], [1,12,3,13,4,9], [14,0,15]),
    OLD: ([(1,2,6)], [4], [-3,11.75], []), NEW: ([(1,2.75,6.25)], [4.5], [2,7], [-3,11.75]),
    ORD: ([(1,3,5),(1,13,15),(2,2,4),(2,11.75,13.5),(5,5,7)], [4,14,3,12.5,6],
          [2,6,11,16,1,5,11,15,4,8], [.7,7]),
}

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def rgb(c):
    return None if c is None else "".join(f"{round(v*255):02x}" for v in c)

def rect_path(op):
    items = op["items"]
    if len(items) == 1 and items[0][0] in ("qu", "re"):
        return True
    if len(items) not in (3,4) or not all(i[0] == "l" for i in items):
        return False
    pts = np.array([i[1:] for i in items])
    if min(np.ptp(pts.reshape(-1,2), axis=0)) < .05:
        return False
    corners = np.unique(np.round(pts.reshape(-1,2), 2), axis=0)
    return (len(corners) == 4 and all(min(abs(b-a)) < .01 for a,b in pts)
            and (op["closePath"] or np.max(abs(pts[0,0]-pts[-1,1])) < .01))

def inspect(file, png, case):
    with (pymupdf.open(file) if file.suffix == ".pdf" else pymupdf.open(
            stream=subprocess.check_output(["rsvg-convert", "-f", "pdf", file]), filetype="pdf")) as doc:
        page = doc[0]; ops = page.get_drawings(); size = np.array(page.rect)[2:] * MM
        text = page.get_text().split(); fonts = [f[3] for f in page.get_fonts()]
    frames = [o for o in ops if rgb(o["color"]) == "000000" and rect_path(o) and o["rect"].width > 100]
    assert len(frames) == 1, (case, file, "axis frame", len(frames))
    frame = np.array(frames[0]["rect"]) * MM
    v = int(case == VERT); c = 1-v
    # The two axes below always increase with the data, irrespective of page y.
    def uv(pt):
        return [pt[v] * (-1 if v else 1), pt[c] * (1 if v else -1)]
    roles = defaultdict(list); boxes = []; lines = []; marks = []; palette = set()
    def add(role, pts, op):
        p = np.asarray(sorted(map(tuple, pts)))
        entry = dict(mm=np.round(p,5).tolist(), stroke=rgb(op["color"]), fill=rgb(op["fill"]),
                     penMm=round((op["width"] or 0)*MM,5))
        if role in ("outlier","otherMark"):
            entry["interiorStrokes"] = sum(i[0] == "l" for i in op["items"])
        roles[role].append(entry)
    ticks = {k:[] for k in ("top","bottom","left","right")}
    for op in ops:
        color = op["color"] or op["fill"]
        if max(color)-min(color) < .05:
            if .3 < max(color) < .7:
                for kind,*p in op["items"]:
                    if kind != "l": continue
                    a,b = np.array(p)*MM; dx,dy = abs(b-a)
                    if dx > dy: side = "left" if abs(a[0]-frame[0]) < abs(b[0]-frame[2]) else "right"
                    else: side = "top" if abs(a[1]-frame[1]) < abs(b[1]-frame[3]) else "bottom"
                    ticks[side].append(round((a[1] if dx>dy else a[0]),5))
            continue
        palette.update(filter(None,[rgb(op["color"]),rgb(op["fill"])]))
        bb = np.array(op["rect"]).reshape(2,2)*MM
        if rect_path(op):
            boxes.append(bb); add("body",bb,op)
        elif any(i[0] == "c" for i in op["items"]) and op["fill"]:
            marks.append((bb,op))
        else:
            for kind,*p in op["items"]:
                if kind == "l": lines.append((np.array(p)*MM,op))
    tips = []; remaining = []
    for p,op in lines:
        mid = p.mean(0); step = np.ptp(p,axis=0)
        normal = abs(step[c]) < TOL and step[v] > TOL
        for b in boxes:
            near_face = [i for i in (0,1) if min(abs(p[i,v]-b[:,v])) < TOL]
            if normal and abs(mid[c]-b.mean(0)[c]) < TOL and len(near_face) == 1:
                tips.append(p[1-near_face[0]]); add("stem",p,op); break
            if step[v] < TOL and b[0,v]-TOL <= mid[v] <= b[1,v]+TOL and max(abs(np.sort(p[:,c])-b[:,c])) < TOL:
                add("median",p,op); break
        else: remaining.append((p,op))
    for p,op in remaining:
        mid = p.mean(0)
        # A whisker exactly on its quartile has a cap but no nonzero stem.
        on_face = any(min(abs(mid[v]-b[:,v])) < TOL and abs(mid[c]-b.mean(0)[c]) < TOL
                      and np.ptp(p[:,c]) < np.ptp(b[:,c])-TOL for b in boxes)
        if np.ptp(p[:,v]) < TOL and (on_face or any(max(abs(mid-t)) < TOL for t in tips)): role = "cap"
        elif case in (VERT,ORD) and op["color"] and op["color"][0] > .8 and op["color"][2] > .45: role = "regular"
        else: role = "otherLine"
        add(role,p,op)
    for b,op in marks:
        # Wrong-route ordinary marks are not counted as outliers just because they are round.
        role = "outlier" if any(abs(b.mean(0)[c]-x.mean(0)[c]) < TOL for x in boxes) else "otherMark"
        add(role,b,op)
    for role in ROLES:
        def order(r):
            u,lane = uv(np.mean(r["mm"],axis=0))
            return (round(lane,1),u)
        roles[role].sort(key=order)
    pix = np.asarray(Image.open(png).convert("RGB")).astype(np.int16)
    for box in roles["body"]:
        if box["fill"]:
            a,b = np.array(box["mm"]); x,y = np.floor((.69*a+.31*b)*DPI/25.4).astype(int)
            box["sampledFill"] = bytes(pix[y,x].astype("uint8")).hex()
            palette.add(box["sampledFill"])
    pixels = {k:int((np.max(abs(pix-list(bytes.fromhex(k))),axis=2)<=4).sum()) for k in sorted(palette)}
    return dict(pageMm=size.round(5).tolist(),frameMm=frame.round(5).tolist(),features=dict(roles),
                counts={k:len(roles[k]) for k in ROLES},tickPageMm=ticks,solidPixels=pixels,text=text,vectorFonts=fonts)

def decode(panel, case):
    l,t,r,b = panel["frameMm"]; x0,x1,y0,y1 = LIMITS[case]; vert = case == VERT
    def point(pt):
        x,y = pt; x = x0+(x-l)/(r-l)*(x1-x0); y = y0+(b-y)/(b-t)*(y1-y0)
        return (y,x) if vert else (x,y)
    result = []
    for role in ("body","median","cap","outlier"):
        rows = []
        for obj in panel["features"][role]:
            a,z = map(point,obj["mm"]); mid = (a[0]+z[0])/2
            rows.append([(a[1]+z[1])/2,min(a[0],z[0]),max(a[0],z[0])] if role=="body" else mid)
        result.append(np.round(rows,4).tolist())
    return result

def compare(ref, panel):
    diff = {}
    for key in ("pageMm","frameMm"):
        diff[key] = np.round(np.array(panel[key])-ref[key],5).tolist()
    diff["ticks"] = {}
    for side,ref_values in ref["tickPageMm"].items():
        values = panel["tickPageMm"][side]
        diff["ticks"][side] = (np.round(np.sort(values)-np.sort(ref_values),5).tolist() if len(values)==len(ref_values)
                               else {"expected":len(ref_values),"actual":len(values)})
    for role in ROLES:
        a,b = ref["features"][role],panel["features"][role]
        if len(a)!=len(b): diff[role] = {"expected":len(a),"actual":len(b)}; continue
        if not a: continue
        # When counts differ there is no invented pairing. Keep signed page deltas otherwise.
        delta = [(np.array(y["mm"])-x["mm"]).round(5).tolist() for x,y in zip(a,b)]
        changes = [[i,k,x[k],y[k]] for i,(x,y) in enumerate(zip(a,b)) for k in x if k!="mm" and x[k]!=y[k]]
        diff[role] = dict(maxMm=round(float(np.max(np.abs(delta))),5),signedMm=delta,styleChanges=changes)
    return diff

def geometry_ok(delta):
    for k in ("pageMm","frameMm",*delta["ticks"]):
        d = delta.get(k,delta["ticks"].get(k))
        if isinstance(d,dict) or any(abs(v)>TOL for v in d): return False
    return all("expected" not in d and d["maxMm"]<=TOL and
               all(k!="penMm" or abs(a-b)<=.002 for _,k,a,b in d["styleChanges"])
               for role,d in delta.items() if role in ROLES)

def run(stage,strict):
    cap = json.loads((stage/"capture.json").read_text()); assert cap["dpi"]==DPI and not cap["errors"] and not cap["badRequests"]
    assert cap["summarySha256"]==sha(stage/"summary.json") and json.loads((stage/"summary.json").read_text())["gate"]["accepted"]
    archive = subprocess.check_output(["kpsewhich","-format=TeX system documentation","pgfplots.doc.src.tar.bz2"],text=True).strip()
    with tarfile.open(archive) as tf: manual = tf.extractfile("pgfplots.libs.statistics.tex").readlines()
    results = {}
    for row in cap["rows"]:
        case = row["id"]; src = Path(cap["fixtureRoot"])/row["source"]; s = src.read_bytes()
        assert sha(src)==row["sourceSha256"] and row["editorRenderClicked"] and row["previousSvgDetached"]
        assert row["originalPdfInputMatchesSource"] and (stage/".mactex-work"/case/"reference.tex").read_bytes()==s
        body = s[s.index(b"\\begin{tikzpicture}"):s.index(b"\\end{document}")]
        if case in (PREP,RAW):
            a,b = (116,144) if case==PREP else (638,647)
            assert body==b"".join(manual[a-1:b])
        assert (stage/"tikztosvg-input"/(case+".tex")).read_bytes().lstrip(b"\n").startswith(body.split(b"\\end{tikzpicture}")[0]+b"\\tikzset{execute at end picture=")
        dest = stage/"capture/cli"; dest.mkdir(exist_ok=True); cli = dest/(case+".svg")
        cmd = ["node",str(Path(cap["tree"])/"bin/tikz2svg.js"),"--strict","--math-renderer","svg-text",str(src),"-o",str(cli)]
        subprocess.run(cmd,check=True)
        panels = {}
        for k in ("pdf","rsvg","tikztosvg","live","download","cli","export"):
            srcpanel = row["panels"]["tikztosvg" if k=="rsvg" else "download" if k=="cli" else k]
            kind = "pdf" if k=="pdf" else "svg"; f = stage/srcpanel[kind+"File"]
            assert sha(f)==srcpanel[kind+"Sha256"]; png = stage/srcpanel["file"]; assert sha(png)==srcpanel["sha256"]
            if k in ("rsvg","cli"):
                if k=="cli": f = cli
                png = stage/"capture"/k/(case+".png"); png.parent.mkdir(exist_ok=True)
                subprocess.run(["rsvg-convert","-b","white","-d",str(DPI),"-p",str(DPI),"-o",str(png),str(f)],check=True)
            panels[k] = dict(**inspect(f,png,case),file=str(f.relative_to(stage)),sha256=sha(f),
                             png=str(png.relative_to(stage)),pngSha256=sha(png))
        native = decode(panels["pdf"],case)
        for observed,expected in zip(native,EXPECTED[case]):
            np.testing.assert_allclose(observed,expected,atol=.003,rtol=0,err_msg=case)
        vs_pdf = {k:compare(panels["pdf"],p) for k,p in panels.items() if k!="pdf"}
        vs_converter = {k:compare(panels["rsvg"],panels[k]) for k in ("live","download","cli","export")}
        results[case] = dict(sourceSha256=sha(src),cliMatchesDownload=sha(cli)==panels["download"]["sha256"],
            diagnostics=row["diagnostics"],exportDiagnostics=row["exportDiagnostics"],pdfValues=native,
            converterValues=decode(panels["rsvg"],case),panels=panels,vsPdf=vs_pdf,vsConverter=vs_converter)
        print(case,"PDF / converter / live:",*[panels[k]["counts"] for k in ("pdf","rsvg","live")],flush=True)
    (stage/"geometry.json").write_text(json.dumps(dict(revision=cap["revision"],results=results),indent=2)+"\n")
    if strict:
        assert all(e["cliMatchesDownload"] and not e["diagnostics"] and not e["exportDiagnostics"]
                   and all(geometry_ok(d) for ref in ("vsPdf","vsConverter") for d in e[ref].values())
                   for e in results.values()), "Geometry, diagnostics or CLI mismatch; inspect geometry.json"

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__); ap.add_argument("stages",nargs="+",type=Path)
    ap.add_argument("--require-geometry",action="store_true")
    args=ap.parse_args()
    for arg in args.stages: run(arg.resolve(),args.require_geometry)
