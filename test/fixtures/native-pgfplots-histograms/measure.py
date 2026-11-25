"""Measure actual histogram paint in page millimetres, never scale or align panels."""
import argparse
from collections import defaultdict
import json
from pathlib import Path
import re
import subprocess
import sys
import tarfile

import numpy as np
from PIL import Image
import pymupdf

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.with_name("native-pgfplots-boxplots")))
from evidence import DPI, MM, rect_path, rgb, sha

CI, STEP, CUM, SHARP = ["hist-manual-" + s for s in ("intervals","const","cumulative-x","sharp")]
FOUR = "hist-four-bin-modes"
LINES = {CI:(1024,1037), STEP:(1274,1287), CUM:(1179,1193), SHARP:(1310,1324)}
ASSET = "plotdata/pgfplots.randn.dat"
DATA_SHA = "a3ec53b6c02c38e42319a13b32324b8670a0ceb7e89b543a9b713a91603550f4"
PANELS = ("pdf","rsvg","live","download","cli")

def rounded(value):
    return np.asarray(value).round(5).tolist()

def ordered(p):
    a,b = sorted(tuple(x) for x in np.asarray(p).reshape(2,2))
    return np.array([a,b])

def label_ink(image, frame):
    # Absolute bounds of neutral dark raster ink outside the axis, excluding
    # the frame and grey tick strokes. This measures Chrome glyphs, not a guessed font.
    h,w = image.shape[:2]; unit = 25.4/DPI
    l,t,r,b = np.array(frame)/unit
    neutral = (image.max(2) < 112) & (np.ptp(image,axis=2) < 9)
    result = {}
    for side,(x0,y0,x1,y1) in {"bottom":(0,b+.45/unit,w,h), "left":(0,t-2/unit,l-.45/unit,b+.2/unit)}.items():
        x0,y0,x1,y1 = (max(0,int(v)) for v in (x0,y0,x1,y1))
        yy,xx = np.nonzero(neutral[y0:y1,x0:x1])
        result[side] = rounded(np.array([x0+xx.min(),y0+yy.min(),x0+xx.max()+1,y0+yy.max()+1])*unit) if len(xx) else None
    return result

def inspect(file, png):
    with (pymupdf.open(file) if file.suffix == ".pdf" else pymupdf.open(
            stream=subprocess.check_output(["rsvg-convert","-f","pdf",file]),filetype="pdf")) as doc:
        page = doc[0]; ops = page.get_drawings(); size = np.array(page.rect)[2:]*MM
        text = page.get_text().splitlines()
        grouped = {}
        for block in page.get_text("rawdict")["blocks"]:
            for line in block.get("lines",[]):
                chars=[c for span in line["spans"] for c in span["chars"] if not c["c"].isspace()]
                if "".join(c["c"] for c in chars)=="2,000":
                    grouped["originsMm"]=rounded(np.array([c["origin"] for c in chars])*MM)
    frames = [o for o in ops if rgb(o["color"])=="000000" and rect_path(o) and o["rect"].width>100]
    assert len(frames)==1, (file,"axis frames",len(frames))
    frame = np.array(frames[0]["rect"])*MM
    shapes = defaultdict(list); styles = defaultdict(set); axes = defaultdict(list)
    def put(kind, coords, op):
        key = kind + "/" + rgb(op["color"] or op["fill"])
        shapes[key].append(ordered(coords))
        styles[key].add((rgb(op["fill"]),round((op["width"] or 0)*MM,5)))
    for op in ops:
        color = op["color"] or op["fill"]; items = op["items"]
        if color is None: continue
        if max(color)-min(color)<.05:
            shade = max(color)
            if .4<shade<.8:
                for kind,*pts in items:
                    if kind!="l": continue
                    p = ordered(np.array(pts)*MM)
                    direction = "x" if abs(p[1,0]-p[0,0])<abs(p[1,1]-p[0,1]) else "y"
                    axes[("tick/" if shade<.6 else "grid/")+direction].append(p)
            continue
        if any(i[0]=="c" for i in items) and op["fill"]:
            put("mark",np.array(op["rect"])*MM,op); continue
        segments = []
        for kind,*pts in items:
            if kind=="re":
                put("bar",np.array(pts[0])*MM,op); continue
            assert kind=="l", (file,kind)
            p = np.array(pts)*MM
            if op["fill"] and abs(p[0,1]-p[1,1])<.0001:
                # Cairo writes the zero-height bin as a horizontal line plus its return.
                part = ordered(p)
                if not segments or np.max(abs(part-segments[-1]))>.0001:
                    put("bar",p,op)
                segments.append(part); continue
            if segments:
                a,b = segments[-1]; c,d = p; ab=b-a; cd=d-c
                cross = ab[0]*cd[1]-ab[1]*cd[0]
                if max(abs(b-c))<.002 and ab@cd>0 and abs(cross)<.0002*np.linalg.norm(ab):
                    segments[-1]=np.array([a,d]); continue
            segments.append(p)
        if not op["fill"]:
            for p in segments: put("line",p,op)
    def pack(d):
        return {k:[rounded(p) for p in sorted(v,key=lambda p:tuple(np.round(p.ravel(),3)))]
                for k,v in sorted(d.items())}
    im = Image.open(png).convert("RGB"); image = np.asarray(im)
    colors = [(n,bytes(c).hex()) for n,c in im.getcolors(im.width*im.height) if max(c)-min(c)>25]
    solid = sorted(colors,reverse=True)[:4]
    return dict(pageMm=rounded(size),frameMm=rounded(frame),paint=pack(shapes),axes=pack(axes),
                styles={k:sorted(v,key=str) for k,v in styles.items()},labelsInkMm=label_ink(image,frame),
                solidColorPixels={color:n for n,color in solid},text=text,groupedTick2000=grouped)

def difference(pdf, panel):
    def delta(a,b):
        return rounded(np.asarray(b)-a)
    result = {k:delta(pdf[k],panel[k]) for k in ("pageMm","frameMm")}
    def compare(k):
        d = {}
        for c in sorted(set(pdf[k]) | set(panel[k])):
            a,b = pdf[k].get(c,[]),panel[k].get(c,[])
            d[c] = ({"maxMm":round(float(np.max(np.abs(np.asarray(b)-a))),5)} if len(a)==len(b)
                    else {"original":len(a),"observed":len(b)})
        return d
    result.update(paint=compare("paint"),axes=compare("axes"),labelsInkMm={k:delta(a,panel["labelsInkMm"][k])
                  for k,a in pdf["labelsInkMm"].items() if a and panel["labelsInkMm"][k]})
    for key,values in result["paint"].items():
        if "maxMm" in values:
            ds=np.array(panel["paint"][key])-pdf["paint"][key]
            values["maxXYmm"]=rounded(np.abs(ds).max(axis=(0,1)))
    result["styles"] = {k:[v,panel["styles"].get(k)] for k,v in pdf["styles"].items() if v!=panel["styles"].get(k)}
    return result

def decoded(p, case, samples):
    x0,x1,y0,y1 = {CI:(.1,10.9,1.5,7.5), STEP:(.1,10.9,1.5,7.5), SHARP:(.4,7.6,1.5,7.5),
                    FOUR:(-.05,1.05,-.25,6.5), CUM:(samples.min()-.1*np.ptp(samples),
                    samples.max()+.1*np.ptp(samples),-787.9,8798.9)}[case]
    l,t,r,b = p["frameMm"]
    def xy(pt):
        x,y = pt; return [x0+(x-l)*(x1-x0)/(r-l),y0+(b-y)*(y1-y0)/(b-t)]
    rows = {}
    for role,paths in p["paint"].items():
        if role.startswith("bar"):
            rows[role] = [rounded([xy(a)[0],xy(z)[0],xy(a)[1],xy(z)[1]]) for a,z in paths]
        elif role.startswith("mark"):
            rows[role] = [rounded(xy(np.mean(pair,axis=0))) for pair in paths]
        else: rows[role] = [[rounded(xy(pt)) for pt in pair] for pair in paths]
    return rows

def check_values(values, case):
    def close(data,expected,tol=.002):
        np.testing.assert_allclose(data,expected,rtol=0,atol=tol,err_msg=case)
    if case in (CI,CUM,FOUR):
        bars = np.array(values["bar/" + ("000099" if case==FOUR else "0000ff")])
        close(bars[:,2], {CI:[3,2,7], CUM:[11,154,811,2491,4841,6828,7733,7957,7996,8000],
              FOUR:[2,0,1,3]}[case], .45 if case==CUM else .002)
        if case==FOUR:
            close(bars[:,0],[0,.25,.5,.75]); close(bars[:,1],[.25,.5,.75,1])
            for color,expected in (("008080",[4/3,0,2/3,2]),("ff0000",[2,2,3,6])):
                hs = [(a[0],b[0],a[1]) for a,b in values["line/"+color] if abs(a[1]-b[1])<.002]
                close([next(y for l,r,y in hs if l<i<r) for i in (.125,.375,.625,.875)],expected)
            close(values["mark/0000ff"],list(zip([0,.25,.5,.75,1],[1/3,1/3,.5,1,1])))
    else:
        close(values["mark/0000ff"],list(zip([1,4,7,10],[3,2,7,7]))[:4 if case==STEP else 3])

def run(stage, verify):
    cap = json.loads((stage/"capture.json").read_text()); summary=json.loads((stage/"summary.json").read_text())
    assert cap["dpi"]==DPI and not cap["errors"] and not cap["badRequests"] and summary["gate"]["accepted"]
    assert sha(stage/"summary.json")==cap["summarySha256"]
    installed=subprocess.check_output(["kpsewhich","-format=TeX system documentation","pgfplots.doc.src.tar.bz2"],text=True).strip()
    canonical=HERE.parent/"examples/pgfplots"/ASSET
    with tarfile.open(installed) as archive:
        manual=archive.extractfile("pgfplots.libs.statistics.tex").readlines()
        assert archive.extractfile(ASSET).read()==canonical.read_bytes() and sha(canonical)==DATA_SHA
    nums=np.loadtxt(canonical); assert len(nums)==8000
    results={}
    for row in cap["rows"]:
        case=row["id"]; src=Path(cap["fixtureRoot"])/row["source"]; s=src.read_bytes()
        native=stage/".mactex-work"/case; entry=next(e for e in summary["cases"] if e["id"]==case)
        assert row["editorRenderClicked"] and row["previousSvgDetached"] and sha(src)==row["sourceSha256"]
        assert (native/"reference.tex").read_bytes()==s and (case!=CUM or sha(native/ASSET)==DATA_SHA)
        body=s[s.index(b"\\begin{tikzpicture}"):s.index(b"\\end{tikzpicture}")]
        if case in LINES:
            a,b=LINES[case]; assert body+b"\\end{tikzpicture}\n"==b"".join(manual[a-1:b]),case
        assert (stage/entry["tikztosvgInput"]).read_bytes().lstrip(b"\n").startswith(body+b"\\tikzset{execute at end picture=")
        dest=stage/"capture/cli"; dest.mkdir(exist_ok=True); cli=dest/(case+".svg")
        out=subprocess.run(["node",str(Path(cap["tree"])/"bin/tikz2svg.js"),"--strict","--math-renderer","svg-text",
                            str(src.resolve()),"-o",str(cli)],capture_output=True,text=True,check=True)
        log=(stage/entry["mactexLog"]).read_text()
        native_status=dict(converter=entry["tikztosvgStatus"],reference=entry["referenceKind"],
            pdf=entry["mactexPngStatus"],exits=re.findall(r"^(?:MacTeX pass \d+|pdftocairo): exitCode \d+",log,re.M),
            texWarnings=[l for l in (native/"reference.log").read_text().splitlines() if re.match(r"^(?:!|.*Warning:|Overfull|Underfull)",l)])
        panels={}
        for k in PANELS:
            meta=row["panels"][{"rsvg":"tikztosvg","cli":"download"}.get(k,k)]
            ext="pdf" if k=="pdf" else "svg"; f=stage/meta[ext+"File"]; png=stage/meta["file"]
            assert sha(f)==meta[ext+"Sha256"] and sha(png)==meta["sha256"]
            if k in ("rsvg","cli"):
                if k=="cli": f=cli
                png=stage/"capture"/k/(case+".png"); png.parent.mkdir(exist_ok=True)
                subprocess.run(["rsvg-convert","-b","white","-d",str(DPI),"-p",str(DPI),"-o",png,f],check=True)
            p=inspect(f,png); panels[k]=dict(**p,png=str(png.relative_to(stage)),file=str(f.relative_to(stage)),
                sha256=sha(f),pngSha256=sha(png),readWithNativeLimits=decoded(p,case,nums))
        check_values(panels["pdf"]["readWithNativeLimits"],case)
        vs={k:difference(panels["pdf"],p) for k,p in panels.items() if k!="pdf"}
        same=sha(cli)==panels["download"]["sha256"]
        results[case]=dict(sourceSha256=sha(src),cliMatchesDownload=same,diagnostics=row["diagnostics"],
            exportDiagnostics=row["exportDiagnostics"],cliStderr=out.stderr,native=native_status,panels=panels,vsPdf=vs)
        print(case,"live - PDF (mm):",vs["live"]["pageMm"],"paint:",vs["live"]["paint"],"Download = CLI:",same,flush=True)
    (stage/"geometry.json").write_text(json.dumps(dict(renderer=cap["environment"]["rendererSha256"],
        archiveDataSha256=DATA_SHA,binary64Cumulative=np.histogram(nums,bins=10)[0].cumsum().tolist(),results=results),indent=2)+"\n")
    if verify:
        for case,record in results.items():
            assert record["cliMatchesDownload"] and not any(record[k] for k in ("diagnostics","exportDiagnostics","cliStderr"))
            assert record["native"]["reference"]=="tikztosvg" and not record["native"]["texWarnings"]
            for k,p in record["panels"].items():
                check_values(p["readWithNativeLimits"],case)
                if k!="pdf":
                    d=record["vsPdf"][k]
                    assert max(map(abs,d["pageMm"]+d["frameMm"]))<=.02,(case,k,d)
                    assert all(v.get("maxMm",float("inf"))<=.02 for group in ("axes","paint")
                               for v in d[group].values()), (case,k,d)
                    for role,styles in record["panels"]["pdf"]["styles"].items():
                        other=p["styles"][role]
                        assert len(styles)==len(other) and all((a[0] is None)==(b[0] is None) and
                            abs(a[1]-b[1])<.002 for a,b in zip(styles,other)),(case,k,role,styles,other)
        print("Verified numerical surveys, physical geometry <= 0.02 mm, native jobs, diagnostics and Download/CLI equality.")

if __name__=="__main__":
    ap=argparse.ArgumentParser(description=__doc__); ap.add_argument("stages",nargs="+",type=Path)
    ap.add_argument("--verify",action="store_true",help="Require matching data and topology, physical geometry within 0.02 mm and clean diagnostics.")
    a=ap.parse_args()
    for stage in a.stages: run(stage.resolve(),a.verify)
