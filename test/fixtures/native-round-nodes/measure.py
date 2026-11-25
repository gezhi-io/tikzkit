"""Physical measurements of round paths and ink; no TikZKit scene data."""

import argparse
import subprocess
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

import numpy as np
import pymupdf
from PIL import Image, ImageColor

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/"native-positioning-targets"))
from audit import csv_out, read, sha
from locate import DPI, MM_PER_BP as MM, PPM, components, point

AUT, NET, SEP, DOUBLE = "initial-accepting-states", "feed-forward-perceptron", "outer-seps", "double-circle"
NAMES = {AUT: "q0 q1 q2 q3", NET: "o1 b2 h1 h2 h3 b1 i1 i2 i3 i4 i5", SEP: "cw ew ct et"}
BLACK, WHITE, RED, BLUE = "#000000", "#ffffff", "#ff0000", "#0000ff"
def ink(rgb):
    return "#" + "".join("%02x"%int(round(v*255)) for v in rgb) if rgb is not None else "none"

def oval(p):
    # Recover the principal diameters from the four quarter-arc endpoints. The
    # PDF control hull is not the actual rotated curve or the TeX page.
    curves=np.array([[tuple(v) for v in op[1:]] for op in p["items"]])*MM
    ends=curves[:,0]; c=ends.mean(axis=0)
    val,vec=np.linalg.eigh((ends-c).T@(ends-c)/2)
    minor,major=2*np.sqrt(val)
    t=np.linspace(0,1,257)
    weights=np.stack([(1-t)**3,3*t*(1-t)**2,3*t*t*(1-t),t**3],axis=1)
    proj=(weights@curves).reshape(-1,2)
    return c,dict(major=major,minor=minor,curveW=np.ptp(proj[:,0]),curveH=np.ptp(proj[:,1]),
                  angle=np.degrees(np.arctan2(-vec[1,1],vec[0,1]))%180 if major-minor>.05 else 0.,
                  outerPen=(p["width"] or 0)*MM,outerColor=ink(p["color"]))

def sep_ids(items):
    # The fixture names the four cells independently of paint order and subpixel y jitter.
    assert len(items)==4,("outer-seps needs four shapes",len(items))
    points=np.sort([v[1] for v in items],axis=0)
    gaps=np.diff(points,axis=0)
    assert np.all(gaps[1]>np.maximum(gaps[0],gaps[2]))
    mid=points[1:3].mean(axis=0)
    by={("c" if x<mid[0] else "e")+("w" if y<mid[1] else "t"):v for v in items for x,y in [v[1]]}
    assert set(by)==set(NAMES[SEP].split()),("outer-seps ambiguous cell",list(by))
    return by

def sep_parts(bodies,ovals,file,mode,page,rgb,association):
    fills=sep_ids([(p,*oval(p)) for p in bodies])
    strokes=sep_ids([(p,*oval(p)) for p in ovals if p["color"] is not None])
    xml={}
    if mode in ("live","download","export"):
        root=ET.parse(file).getroot(); box=np.array(root.get("viewBox").split(),float)
        assert root.get("preserveAspectRatio","xMidYMid meet")=="xMidYMid meet"
        scale=min(page/box[2:]); origin=(page-scale*box[2:])/2-scale*box[:2]
        xml=sep_ids([(e,origin+scale*np.array([e.get("cx"),e.get("cy")],float),
                      2*scale*np.array([e.get("rx"),e.get("ry")],float)) for e in root.findall("{*}ellipse")])
    def dims(g): return np.array([g["curveW"],g["curveH"]])
    for node in NAMES[SEP].split():
        fill,c,h=fills[node]; stroke,s,t=strokes[node]
        # Cairo can emit separate f/s records for a single SVG ellipse; measure real pen ink.
        assert max(abs(c-s))<.002 and max(abs(dims(h)-dims(t)))<.002,(mode,node,"fill/stroke geometry")
        if xml:
            e,center,size=xml[node]
            assert e.get("transform") is None and e.get("fill","none")!="none",(mode,node,"SVG ellipse")
            assert max(abs(s-center))<.002 and max(abs(dims(t)-size))<.002,(mode,node,"SVG/stroke geometry")
            hue=ImageColor.getrgb(e.attrib["stroke"])
            assert ink(np.array(hue)/255)==t["outerColor"],(mode,node,"SVG/stroke color")
            assert abs(float(e.attrib["stroke-width"])*scale-t["outerPen"])<.0002,(mode,node,"SVG/stroke width")
            x,y=np.floor((center+[size[0]/2,0])*PPM).astype(int)
            assert tuple(rgb[y,x])==hue,(mode,node,"visible stroke",tuple(rgb[y,x]),hue)
        if association is not None:
            association.append(dict(panel=mode,node=node,fillOp=fill["seqno"],strokeOp=stroke["seqno"],
                                    fillCxMm=round(c[0],6),fillCyMm=round(c[1],6),strokeCxMm=round(s[0],6),
                                    strokeCyMm=round(s[1],6),pathBoxDeltaMm=round(max(abs(np.array(fill["rect"])-np.array(stroke["rect"])))*MM,6),
                                    measuredPenMm=round(t["outerPen"],6),measuredColor=t["outerColor"],
                                    svgCenter=" ".join(e.get(k) for k in ("cx","cy")) if xml else "",
                                    svgWidth=e.get("stroke-width") if xml else "",rimPixel=ink(rgb[y,x]/255) if xml else ""))
        yield fill,c,dict(h,outerPen=t["outerPen"],outerColor=t["outerColor"])

def ring_profile(rgb,c,r,red):
    # A northern sector avoids all incident arrows and the label. Oversampling
    # stabilizes edge finding; physical raster resolution remains 1/PPM.
    radii=np.arange(r*.45,r*1.45,1/PPM/4)
    ang=np.radians(np.linspace(-101,-79,31))
    xy=np.floor((c+np.stack([np.cos(ang),np.sin(ang)],axis=1)[:,None]*radii[None,:,None])*PPM).astype(int)
    xy=np.clip(xy,[0,0],[rgb.shape[1]-1,rgb.shape[0]-1])
    line=np.median(rgb[xy[:,:,1],xy[:,:,0]],axis=0)
    mask=(line[:,0]>155)&(line[:,1]<115)&(line[:,2]<115) if red else np.max(line,axis=1)<128
    edges=np.flatnonzero(np.diff(np.r_[False,mask,False])).reshape(-1,2)
    if len(edges)!=2: return dict(rails=len(edges),paintGap=None,gapHue="missing",northOD=None,gapRGB="")
    a,b=edges[0,1],edges[1,0]
    col=np.median(line[(2*a+b)//3:(a+2*b)//3+1],axis=0)
    hue="white" if min(col)>235 and np.ptp(col)<8 else "blue" if col[2]-col[0]>90 else "pale-blue" if col[2]-col[0]>7 else "other"
    return dict(rails=2,paintGap=(b-a)/(4*PPM),gapHue=hue,northOD=2*radii[edges[-1,1]-1],gapRGB=ink(col/255))

def panel(stage,case,mode,meta,association=None):
    key="pdf" if mode=="pdf" else "svg"
    file=stage/meta[key+"File"]
    assert sha(file)==meta[key+"Sha256"] and sha(stage/meta["file"])==meta["sha256"]
    doc=pymupdf.open(file) if mode=="pdf" else pymupdf.open(stream=subprocess.check_output(["rsvg-convert","-f","pdf",file]),filetype="pdf")
    with doc:
        assert len(doc)==1
        page=np.array(doc[0].rect)[2:]*MM; paths=doc[0].get_drawings()
    if mode!="pdf":
        declared=np.array(meta["intrinsicCssPx"])*25.4/96
        assert max(abs(declared-page))<.002
        page=declared
    rgb=np.asarray(Image.open(stage/meta["file"]).convert("RGB"))
    ovals=[p for p in paths if [k[0] for k in p["items"]]==["c"]*4 and min(p["rect"].width,p["rect"].height)*MM>2.5]
    bodies=[p for p in ovals if ink(p["fill"]) not in ("none",BLACK,WHITE) or (case=="ellipse-30" and ink(p["color"])==BLUE)]
    parts=(list(sep_parts(bodies,ovals,file,mode,page,rgb,association)) if case==SEP else
           sorted([(p,*oval(p)) for p in bodies],key=lambda v:(round(v[1][1]),v[1][0])))
    names=NAMES.get(case,case).split()
    assert len(parts)==len(names),(case,mode,len(parts),names)
    centers=np.array([v[1] for v in parts])
    if case==SEP:
        dots=[np.array(p["rect"])*MM for p in paths if ink(p["fill"])==RED and p["rect"].width*MM<1.1]
        pixels=components(rgb,(255,0,0),.3)
        assert len(dots)==len(pixels)==16
    for i,((p,c,h),node) in enumerate(zip(parts,names)):
        row=dict(case=case,panel=mode,node=node,pageW=page[0],pageH=page[1],cx=c[0],cy=c[1],
                 relX=c[0]-centers[0,0],relY=c[1]-centers[0,1],**h)
        if node=="q1" or case==DOUBLE:
            extra=[s for s in ovals if s is not p and np.linalg.norm(oval(s)[0]-c)<.03 and s["color"]]
            row.update(passes=1+len(extra),innerPen=None,innerColor="missing",trackDelta=None,sameTrack=0,
                       inkOD=h["major"]+h["outerPen"],**ring_profile(rgb,c,h["major"]/2,case==DOUBLE))
            if extra:
                assert len(extra)==1
                s=extra[0]; row.update(innerPen=s["width"]*MM,innerColor=ink(s["color"]),
                                       trackDelta=abs(oval(s)[1]["major"]-h["major"])/2,sameTrack=int(s["items"]==p["items"]))
            if node=="q1":
                heads=[s for s in paths if ink(s["fill"])==BLACK and ink(s["color"])==BLACK and all(op[0]=="l" for op in s["items"])
                       and 0<s["rect"].x0*MM-c[0]<8 and abs((s["rect"].y0+s["rect"].y1)*MM/2-c[1])<.08]
                shafts=[s for s in paths if [op[0] for op in s["items"]]==["l"] and s["rect"].x0*MM>c[0] and abs(s["rect"].y0*MM-c[1])<.08 and s["rect"].height*MM<.02]
                assert len(heads)==len(shafts)==1,(mode,"entry arrow",len(heads),len(shafts))
                row.update(tipX=heads[0]["rect"].x0*MM-c[0],shaftX=shafts[0]["rect"].x0*MM-c[0])
        if case==SEP:
            for prefix,marks in [("anchor",dots),("paintAnchor",pixels)]:
                local=[point(b) for b in marks if np.argmin(np.linalg.norm(centers-point(b),axis=1))==i]
                assert len(local)==4
                row[prefix+"W"],row[prefix+"H"]=np.ptp(local,axis=0)
            if node=="ew":
                ray=[s["items"][0] for s in paths if [op[0] for op in s["items"]]==["l"] and s["color"] and s["color"][1]>.4 and s["color"][0]<.1]
                assert len(ray)==1
                end=min([np.array(v)*MM for v in ray[0][1:]],key=lambda v:np.linalg.norm(v-c))
                row["rayX"],row["rayY"]=end-c
        if case.startswith("ellipse-"):
            r,g,b=rgb.astype(int).transpose(2,0,1)
            y,x=np.nonzero((b>220)&(b-np.maximum(r,g)>40))
            row.update(paintW=(np.ptp(x)+1)/PPM,paintH=(np.ptp(y)+1)/PPM)
        yield {k:round(float(v),5) if isinstance(v,(float,np.number)) else v for k,v in row.items()}

def run(stage,baseline,strict):
    cap=read(stage/"capture.json"); summary=read(stage/"summary.json")
    assert sha(stage/"summary.json")==cap["summarySha256"] and summary["gate"]["accepted"]
    assert not cap["errors"] and not cap["badRequests"] and cap["dpi"]==DPI
    old={e["id"]:e for e in read(baseline/"capture.json")["rows"]} if baseline else {}
    rows=[]; residual=[]; association=[]
    for e in cap["rows"]:
        case=e["id"]
        assert not e["diagnostics"] and not e["exportDiagnostics"] and e["originalPdfInputMatchesSource"]
        assert e["sourceSha256"]==sha(Path(cap["fixtureRoot"])/e["source"])
        if baseline:
            assert e["sourceSha256"]==old[case]["sourceSha256"]
            for k in ("pdf","tikztosvg"):
                assert e["panels"][k]["sha256"]==old[case]["panels"][k]["sha256"],(case,k,"frozen native PNG differs")
            assert e["panels"]["tikztosvg"]["svgSha256"]==old[case]["panels"]["tikztosvg"]["svgSha256"],(case,"frozen native SVG differs")
        group=[r for k,m in e["panels"].items() for r in panel(stage,case,k,m,association)]; rows.extend(group)
        for r in group:
            for ref in ("pdf","tikztosvg"):
                if ref==r["panel"]: continue
                n=next(a for a in group if a["panel"]==ref and a["node"]==r["node"])
                delta={}; bad=[]
                for k in r.keys()-{"case","panel","node","gapRGB"}:
                    v,w=r[k],n[k]
                    d=(round(v-w,5) if isinstance(v,(float,int)) and isinstance(w,(float,int)) else None if v is None or w is None else "same" if v==w else str(v)+" vs "+str(w))
                    if k=="angle": d=round((d+90)%180-90,5)
                    delta[k]=d
                    if k in ("tipX","shaftX") or (case==AUT and k in ("pageW","pageH","cx","cy")): continue
                    tol=.20 if k.startswith("paint") or k=="northOD" else .12 if k=="angle" else .02
                    if d is None or (d!="same" and (isinstance(d,str) or abs(d)>tol)): bad.append(k)
                residual.append(dict(case=case,node=r["node"],panel=r["panel"],reference=ref,differences=" ".join(sorted(bad)),**dict(sorted(delta.items()))))
                if r["panel"] in ("pdf","tikztosvg"): assert not bad,(case,r["node"],"native disagreement",bad,delta)
    csv_out(stage/"round-values.csv",rows); csv_out(stage/"round-residuals.csv",residual)
    csv_out(stage/"outer-seps-association.csv",association)
    fails=[r for r in residual if r["differences"]]
    for r in fails:
        if r["panel"]=="live" and r["reference"]=="pdf": print(r["case"],r["node"],r["differences"])
    print(cap["revision"],len(residual)-len(fails),"/",len(residual),"comparisons within limits")
    if strict and fails: raise SystemExit(1)

if __name__=="__main__":
    ap=argparse.ArgumentParser(description=__doc__); ap.add_argument("stage",type=Path)
    ap.add_argument("--baseline",type=Path); ap.add_argument("--require-match",action="store_true")
    args=ap.parse_args(); run(args.stage,args.baseline,args.require_match)
