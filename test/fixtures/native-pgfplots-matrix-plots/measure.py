"""Physical matrix paint, in unregistered page mm. No scaling to a reference."""
import argparse
import json
from pathlib import Path
import re
import subprocess
import sys

import numpy as np
from PIL import Image
import pymupdf

sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.with_name("native-pgfplots-boxplots")))
from evidence import DPI,MM,rect_path,rgb,sha

PANELS=("pdf","rsvg","live","download","cli")
SLOTS=("top left","top","top right","left","center","right","bottom left","bottom","bottom right")
def rnd(a): return np.asarray(a).round(5).tolist()
def diff(a,b): return round(float(np.max(np.abs(np.array(b)-a))),5)
def box(rect): return np.asarray(rect)*MM

def corners(op):
    its=op["items"]
    if len(its)==1 and its[0][0] in ("qu","re"):
        q=its[0][1]
        return np.array([q.ul,q.ur,q.lr,q.ll])*MM if its[0][0]=="qu" else np.array([q.tl,q.tr,q.br,q.bl])*MM
    if len(its) in (3,4) and all(i[0]=="l" for i in its):
        return np.array([i[1] for i in its[:3]]+[its[2][2]])*MM
    return None

def vertex_error(a,b):
    return min(diff(a,np.roll(v,n,axis=0)) for v in (b,b[::-1]) for n in range(4))

def consecutive_strokes(ops):
    # Cairo can emit the same closed SVG quadrilateral as adjacent fill and
    # stroke ops, with one vertex rounded one PDF output unit differently.
    def closed(o):
        items=o["items"]
        return (len(items)==1 and items[0][0] in ("qu","re") or o["closePath"] or
                len(items)==4 and all(i[0]=="l" for i in items) and
                np.max(np.abs(np.array(items[0][1])-items[-1][2]))<.001)
    out=[];pairs=[];i=0
    while i<len(ops):
        a=ops[i];i+=1
        if a["type"]=="f" and min(a["rect"].width,a["rect"].height)*MM>6 and i<len(ops):
            b=ops[i]
            if (b["type"]=="s" and b["seqno"]==a["seqno"]+1 and rgb(b["color"])==rgb(a["fill"]) and
                b["dashes"].replace(" ","")=="[]0" and closed(a) and closed(b)):
                p,q=corners(a),corners(b)
                if p is not None and q is not None and (delta:=vertex_error(p,q))<=.0005:
                    pairs.append(dict(fillOrder=a["seqno"],strokeOrder=b["seqno"],maxCornerMm=delta,
                                      stroke=rgb(b["color"]),penMm=round(b["width"]*MM,5)))
                    a={**a,"type":"fs","color":b["color"],"width":b["width"]};i+=1
        out.append(a)
    return out,pairs

def inspect(file,png):
    with (pymupdf.open(file) if file.suffix==".pdf" else pymupdf.open(
            stream=subprocess.check_output(["rsvg-convert","-f","pdf",file]),filetype="pdf")) as doc:
        page=doc[0]; ops=page.get_drawings(); size=box(page.rect)[2:]; words=page.get_text("words")
        native_text=page.get_text().splitlines()
    ops,pairs=consecutive_strokes(ops)
    pix=np.asarray(Image.open(png).convert("RGB")); ppm=DPI/25.4
    def pixel(pt):
        x,y=np.rint(np.asarray(pt)*ppm-.5).astype(int)
        return bytes(pix[y,x]).hex() if 0<=y<pix.shape[0] and 0<=x<pix.shape[1] else None
    frames=[o for o in ops if rgb(o["color"])=="000000" and not o["fill"] and rect_path(o) and o["rect"].height>70]
    main,=([o for o in frames if o["rect"].width>100])
    f=box(main["rect"]);l,t,r,b=f; bar=next((box(o["rect"]) for o in frames if o["rect"].x0*MM>r+.1),None)
    cells=[];marks=[];ticks={s:[] for s in ("bottom","top","left","right","bar")};links=[]
    for o in ops:
        bb=box(o["rect"]); mid=(bb[:2]+bb[2:])/2; stroke=rgb(o["color"]); fill=rgb(o["fill"])
        inside=l-.1<=mid[0]<=r+.1 and t-.1<=mid[1]<=b+.1
        if inside and fill and min(bb[2:]-bb[:2])>6:
            p=corners(o)
            if p is not None:
                cells.append(dict(cornersMm=rnd(p),fill=fill,stroke=stroke,penMm=round((o["width"] or 0)*MM,5),
                    solid=pixel(.60*p[0]+.23*p[1]+.17*p[3]),order=o["seqno"]))
        elif inside and fill and len(o["items"])==4 and all(i[0]=="c" for i in o["items"]):
            marks.append(dict(centerMm=rnd(mid),sizeMm=rnd(bb[2:]-bb[:2]),fill=fill,stroke=stroke,order=o["seqno"]))
        elif o["color"] and max(o["color"])-min(o["color"])<.01 and .4<max(o["color"])<.6 and not fill:
            for kind,*pts in o["items"]:
                if kind!="l": continue
                a,z=np.array(pts)*MM; m=(a+z)/2
                if bar is not None and m[0]>r+1: side="bar"
                elif abs(a[0]-z[0])<abs(a[1]-z[1]): side="top" if abs(m[1]-t)<abs(m[1]-b) else "bottom"
                else: side="left" if abs(m[0]-l)<abs(m[0]-r) else "right"
                ticks[side].append(rnd(sorted([list(a),list(z)])))
        elif inside and o is not main and not fill and all(i[0]=="l" for i in o["items"]) and min(bb[2:]-bb[:2])>4:
            links.append(dict(stroke=stroke,segments=len(o["items"]),boxMm=rnd(bb)))
    for side,rows in ticks.items():
        rows.sort(key=lambda seg: tuple(np.round(np.mean(seg,axis=0)[[0,1] if side in ("top","bottom") else [1,0]],3)))
    marks.sort(key=lambda o:o["centerMm"][1])
    if len(marks)==9:
        marks=[m for i in (0,3,6) for m in sorted(marks[i:i+3],key=lambda o:o["centerMm"][0])]
    centers=np.array([m["centerMm"] for m in marks])
    for m in marks: m.update(labels=[],cellSample=None)
    for c in cells:
        mid=np.mean(c["cornersMm"],axis=0)
        nearest=int(np.argmin(np.linalg.norm(centers-mid,axis=1))) if len(centers) else None
        c["slot"]=nearest
    for x0,y0,x1,y1,txt,*_ in words:
        if not re.fullmatch("[0-8]",txt) or not len(centers):continue
        anchor=np.array([(x0+x1)/2,(y0+y1)/2])*MM
        if l<anchor[0]<r and t<anchor[1]<b:
            n=int(np.argmin(np.linalg.norm(centers-anchor,axis=1)))
            marks[n]["labels"].append(dict(text=txt,boxMm=rnd(box([x0,y0,x1,y1]))))
    for i,m in enumerate(marks):
        m["cellSample"]=pixel(np.array(m["centerMm"])+[1.8,1.8])
        # Native index labels sit above the marks. The black-on-black cell is
        # deliberately unmeasurable in the raster; PDF text still proves its index exists.
        m["labelInkMm"]=None
        if m["cellSample"] and max(bytes.fromhex(m["cellSample"]))>80:
            x,y=m["centerMm"];x0,y0,x1,y1=np.rint(np.array([x-2.4,y-4.4,x+2.4,y-.85])*ppm).astype(int)
            x0,y0=max(0,x0),max(0,y0);window=pix[y0:max(0,y1),x0:max(0,x1)]
            yy,xx=np.nonzero((window.max(2)<80)&(np.ptp(window,axis=2)<12))
            if len(xx):m["labelInkMm"]=rnd(np.array([x0+xx.min(),y0+yy.min(),x0+xx.max()+1,y0+yy.max()+1])/ppm)
    bar_samples=None if bar is None else [pixel([bar[0]+.53*(bar[2]-bar[0]),bar[1]+v*(bar[3]-bar[1])])
                                       for v in (.03,.14,.28,.43,.56,.72,.86,.97)]
    below=pix[int((b+.15)*ppm):int((b+1.2)*ppm),int(l*ppm):int(r*ppm)]
    seqs=[c.pop("order") for c in cells]; marker_order=[m.pop("order") for m in marks]
    return dict(pageMm=rnd(size),frameMm=rnd(f),cells=sorted(cells,key=lambda c:c["slot"] or 0),marks=marks,extraLines=links,
        splitStrokePairs=pairs,
        frameAfterCells=bool(seqs) and main["seqno"]>max(seqs),marksAfterCells=bool(seqs and marker_order) and min(marker_order)>max(seqs),
        ticksMm=ticks,colorbarMm=None if bar is None else rnd(bar),colorbarTopToBottom=bar_samples,
        coloredPixelsBelowFrame=int(np.count_nonzero(np.ptp(below,axis=2)>40)),text=native_text)

def native_data(p,case):
    # Read the native major tick marks (unit spacing) rather than estimating a transform from a candidate.
    x=[np.mean(pair,axis=0)[0] for pair in p["ticksMm"]["bottom"]]
    y=[np.mean(pair,axis=0)[1] for pair in p["ticksMm"]["left"]]
    x0,x1=x[1:3] if case.endswith("skewed") else x[:2]
    y0,y1=(y[-1],y[-2]) if case.endswith("starred") else y[:2]
    def xy(a):return rnd((np.array(a)-[x0,y0])/[x1-x0,y1-y0])
    return dict(frame=xy(np.array(p["frameMm"]).reshape(2,2)),cells={SLOTS[c["slot"]]:xy(c["cornersMm"]) for c in p["cells"]})

def compare(ref,p):
    d={k:rnd(np.array(p[k])-ref[k]) for k in ("pageMm","frameMm")}
    d["cellCounts"]=[len(ref["cells"]),len(p["cells"])];d["markCounts"]=[len(ref["marks"]),len(p["marks"])]
    d["cellDifferences"]={}; d["extraLines"]=p["extraLines"]
    for i,slot in enumerate(SLOTS):
        a=[c for c in ref["cells"] if c["slot"]==i]; b=[c for c in p["cells"] if c["slot"]==i]
        if len(a)!=len(b) or len(a)>1: d["cellDifferences"][slot]={"counts":[len(a),len(b)]};continue
        if not a:continue
        a,b=a[0],b[0]; vertices=np.array(b["cornersMm"])
        # A polygon's initial vertex and winding do not affect physical paint.
        error=vertex_error(a["cornersMm"],vertices)
        d["cellDifferences"][slot]={"cornerMm":error,**{k:[a[k],b[k]] for k in ("fill","stroke","penMm","solid") if a[k]!=b[k]}}
    if len(ref["marks"])==len(p["marks"]) and p["marks"]:
        d["markCenterMm"]=max(diff(a["centerMm"],b["centerMm"]) for a,b in zip(ref["marks"],p["marks"]))
        d["markSizeMm"]=max(diff(a["sizeMm"],b["sizeMm"]) for a,b in zip(ref["marks"],p["marks"]))
        ink=[(m["labelInkMm"],n["labelInkMm"]) for m,n in zip(ref["marks"],p["marks"])]
        d["labelInkMaxMm"]=max((diff(a,b) for a,b in ink if a and b),default=None)
        d["labelInkMissingSlots"]=[i for i,(a,b) in enumerate(ink) if bool(a)!=bool(b)]
        if p["text"]:
            d["labels"]=[];boxes=[]
            for i,(a,b) in enumerate(zip(ref["marks"],p["marks"])):
                al,bl=a["labels"],b["labels"]
                if [l["text"] for l in al]!=[l["text"] for l in bl]: d["labels"].append([i,al,bl])
                elif len(al)==1:boxes.append(diff(al[0]["boxMm"],bl[0]["boxMm"]))
            d["labelBoxMaxMm"]=max(boxes,default=None)
    d["ticks"]={k:(diff(a,p["ticksMm"][k]) if len(a)==len(p["ticksMm"][k]) and a else
                   [len(a),len(p["ticksMm"][k])]) for k,a in ref["ticksMm"].items()}
    a,b=ref["colorbarMm"],p["colorbarMm"]
    d["colorbarMm"]=None if a is None and b is None else [a,b] if a is None or b is None else rnd(np.array(b)-a)
    if a and b:
        d["colorbarMaxRGB"]=max(abs(x-y) for a,b in zip(ref["colorbarTopToBottom"],p["colorbarTopToBottom"])
                                for x,y in zip(bytes.fromhex(a),bytes.fromhex(b)))
    d["frameAfterCells"]=p["frameAfterCells"];d["marksAfterCells"]=p["marksAfterCells"]
    return d

def run(stage,verify):
    cap=json.loads((stage/"capture.json").read_text()); summ=json.loads((stage/"summary.json").read_text())
    assert not cap["errors"] and not cap["badRequests"] and cap["dpi"]==DPI and summ["gate"]["accepted"]
    assert sha(stage/"summary.json")==cap["summarySha256"]
    inputs=json.loads((stage/"inputs.json").read_text());results={}
    for row in cap["rows"]:
        case=row["id"]; src=(Path(cap["fixtureRoot"])/row["source"]).resolve(); entry=next(e for e in summ["cases"] if e["id"]==case)
        assert sha(src)==inputs[case]["sourceSha256"]==row["sourceSha256"] and row["editorRenderClicked"] and row["previousSvgDetached"]
        native=stage/".mactex-work"/case;assert sha(native/"reference.tex")==sha(src)
        body=src.read_bytes().split(b"\\begin{tikzpicture}",1)[1].split(b"\\end{tikzpicture}",1)[0]
        assert (stage/entry["tikztosvgInput"]).read_bytes().lstrip(b"\n").startswith(b"\\begin{tikzpicture}"+body+b"\\tikzset{execute at end picture=")
        cli=stage/"capture/cli"/(case+".svg");cli.parent.mkdir(exist_ok=True)
        result=subprocess.run(["node",str(Path(cap["tree"])/"bin/tikz2svg.js"),"--strict","--math-renderer","svg-text",
                               src,"-o",cli],capture_output=True,text=True)
        panels={}
        for k in PANELS:
            if k=="cli" and result.returncode:continue
            m=row["panels"][{"rsvg":"tikztosvg","cli":"download"}.get(k,k)]
            ext="pdf" if k=="pdf" else "svg";f=stage/m[ext+"File"];png=stage/m["file"]
            assert sha(f)==m[ext+"Sha256"] and sha(png)==m["sha256"]
            if k in ("cli","rsvg"):
                if k=="cli":f=cli
                png=stage/"capture"/k/(case+".png");png.parent.mkdir(exist_ok=True)
                subprocess.run(["rsvg-convert","-b","white","-d",str(DPI),"-p",str(DPI),"-o",png,f],check=True)
            panels[k]=dict(**inspect(f,png),file=str(f.relative_to(stage)),png=str(png.relative_to(stage)),sha256=sha(f),pngSha256=sha(png))
        pdf=panels["pdf"];slots=[c["slot"] for c in pdf["cells"]];hole=case.endswith(("hole","nan-colorbar"))
        assert slots==[i for i in range(9) if not hole or i!=4] and len(pdf["marks"])==9
        expected=list(range(6,9))+list(range(3,6))+list(range(3)) if case.endswith("starred") else list(range(9))
        assert [m["labels"][0]["text"] for m in pdf["marks"]]==list(map(str,expected))
        assert (pdf["colorbarMm"] is not None)==case.endswith(("nan-colorbar","skewed"))
        vs={k:compare(pdf,p) for k,p in panels.items() if k!="pdf"}
        native_log=(native/"reference.log").read_text()
        results[case]=dict(sourceSha256=sha(src),nativeData=native_data(pdf,case),native=dict(
            tikztosvg=entry["tikztosvgStatus"],pdf=entry["mactexPngStatus"],reference=entry["referenceKind"],
            warnings=re.findall(r"(?:Package pgfplots Warning:[^\n]*(?:\n[^\n]+)*)",native_log)),
            diagnostics=row["diagnostics"],exportDiagnostics=row["exportDiagnostics"],cliStatus=result.returncode,cliStderr=result.stderr,
            cliMatchesDownload="cli" in panels and panels["cli"]["sha256"]==panels["download"]["sha256"],panels=panels,vsPdf=vs)
        print(case,"PDF/live cells",vs["live"]["cellCounts"],"page delta mm",vs["live"]["pageMm"],flush=True)
    (stage/"geometry.json").write_text(json.dumps(dict(renderer=cap["environment"]["rendererSha256"],results=results),indent=2)+"\n")
    if verify:
        errors=[]
        for case,res in results.items():
            if not res["cliMatchesDownload"] or res["diagnostics"] or res["exportDiagnostics"]:
                errors.append((case,"diagnostics or CLI"))
            for k,d in res["vsPdf"].items():
                def check(ok,key):
                    if not ok:errors.append((case,k,key))
                check(max(map(abs,d["pageMm"]+d["frameMm"]))<=.02,"page/frame")
                check(d["markCounts"]==[9,9] and d.get("markCenterMm",99)<=.02 and d.get("markSizeMm",99)<=.02,"marks")
                check(d["cellCounts"][0]==d["cellCounts"][1] and all(c.get("cornerMm",99)<=.02 for c in d["cellDifferences"].values()),"cell corners")
                check(not d["extraLines"] and d["frameAfterCells"] and d["marksAfterCells"],"paint order or connecting line")
                check(not d.get("labels"),"label text/slot")
                for c in d["cellDifferences"].values():
                    for key in ("fill","stroke","solid"):
                        if key in c:
                            a,b=c[key];check(bool(a and b) and max(abs(x-y) for x,y in zip(bytes.fromhex(a),bytes.fromhex(b)))<=2,key)
                    if "penMm" in c:check(abs(c["penMm"][0]-c["penMm"][1])<=.002,"pen")
                check(all(v==[0,0] if isinstance(v,list) else v<=.02 for v in d["ticks"].values()),"ticks")
                bar=d["colorbarMm"]
                check(bar is None or len(bar)==4 and max(map(abs,bar))<=.02,"colorbar position")
                check(d.get("colorbarMaxRGB",0)<=3,"colorbar colors")
                check(res["panels"][k]["coloredPixelsBelowFrame"]==0,"colored pixels below frame")
        if errors:raise SystemExit("Measured differences (see geometry.json): "+str(errors))
        print("Five native figures verified against all four independent output panels.")

if __name__=="__main__":
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument("stages",nargs="+",type=Path)
    ap.add_argument("--verify",action="store_true",help="Fail on numerical/physical paint differences; always keep the measurements.")
    a=ap.parse_args()
    for stage in a.stages:run(stage.resolve(),a.verify)
