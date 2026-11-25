"""Measure two-terminal resistor modifiers in original PDF and actual physical SVG paint."""
import argparse
import subprocess
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

import numpy as np
import pymupdf
from PIL import Image

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent/"native-circuitikz-potentiometers"))
from measure import DPI, JS, MM, PPM, REFS, csv_out, length, read, rounded, sha, vertices

MANUAL="manual-thickness"; CONTROL="angled-anchors"
BLACK="000000"; RED="ff0000"; BLUE="0000ff"
RINGS={"ec008c":"V.wiper","008000":"S.tip","ff8000":"E.W","800080":"E.tip"}
def color(v): return "none" if v is None else "".join("%02x"%x for x in np.rint(np.array(v)*255).astype(int))

def ink(rgb,points,hue):
    target=255-np.frombuffer(bytes.fromhex(hue),dtype=np.uint8).astype(float)
    for x,y in np.floor(np.atleast_2d(points)*PPM).astype(int):
        s=255-rgb[max(0,y-1):y+2,max(0,x-1):x+2].astype(float)
        a=(s@target)/(target@target)
        if not ((a>.30)&(np.max(abs(s-a[:,:,None]*target),axis=2)<24)).any(): return False
    return True

def frames(case,ops):
    configs=([(BLACK,(1,0),40,[("vR-1","sR-1"),("vR-2","sR-2"),("vR-3","sR-3")])] if case==MANUAL else
             [(BLUE,(24,-9),2*np.hypot(24,9),[("EU-vR","EU-sR")]),(RED,(24,-9),2*np.hypot(24,9),[("EU-old","US-old")]),(BLACK,(1,0),24,[("ordinary-R",)])])
    for hue,d,total,names in configs:
        t=np.array(d)/length(d); n=np.array([-t[1],t[0]]); groups=[]
        for o,_ in ops:
            if color(o["color"])!=hue or any(i[0]!="l" for i in o["items"]): continue
            segments=[np.array(i[1:])*MM for i in o["items"]]
            if any(np.ptp(p@n)>.03 for p in segments): continue
            for p in segments:
                if np.ptp(p@t)<3: continue
                level=p.mean(0)@n
                g=next((g for g in groups if abs(level-g[0])<.03),None)
                if g is None: g=(level,[]); groups.append(g)
                g[1].append((np.sort(p@t),o["width"]*MM))
        assert len(groups)==len(names),(case,hue,"lead rows",len(groups))
        for (level,segments),ids in zip(sorted(groups,key=lambda g:g[0]),names):
            lo=min(v[0] for v,_ in segments); hi=max(v[1] for v,_ in segments)
            assert abs(hi-lo-total)<1 and np.ptp([pen for _,pen in segments])<.001
            for i,name in enumerate(ids):
                c=lo+(i+.5)*(hi-lo)/len(ids); mid=c*t+level*n
                inner=[v-c for v,_ in segments]
                r=dict(midX=mid[0],midY=mid[1],leadSpan=(hi-lo)/len(ids),leadPen=segments[0][1],leadColor=hue,
                       throughWire=any(a<=.01 and b>=-.01 for a,b in inner))
                for key,values in (("leftLeadEnd",[b for a,b in inner if b<0]),("rightLeadStart",[a for a,b in inner if a>0])):
                    if values: r[key]=min(values,key=abs)
                yield name,mid,t,n,r

def component(ops,mid,t,n,r,rgb):
    bodies=[]; fills=[]; mods=[]; heads=[]
    for o,p in ops:
        x,y=(p-mid)@t,(p-mid)@n; w,h=np.ptp(x),np.ptp(y)
        cx,cy=(x.max()+x.min())/2,(y.max()+y.min())/2
        if abs(cx)>8 or abs(cy)>7: continue
        if len(p)>=4 and abs(cx)<2 and abs(cy)<2 and w>7 and h>2 and all(i[0]!="c" for i in o["items"]):
            if o["color"] is not None: bodies.append((o,p))
            if o["fill"] is not None: fills.append((o,p))
        elif o["color"] is not None and 2<=len(p)<=3 and h>3 and abs(cx)<3 and abs(cy)<2.8:
            mods.append((o,p))
        elif o["fill"] is not None and .4<w<5 and .4<h<5: heads.append((o,p))
    if mods:
        ends=mods[0][1][[0,-1]]
        heads=[(o,p) for o,p in heads if min(length(ends-p.mean(0)))<2.8]
    assert all(len(g)<=1 for g in (bodies,fills,mods,heads)),("ambiguous painted feature",r,mid)
    r.update(body="missing",bodyFill=color(fills[0][0]["fill"] if fills else None),modifier="none",headColor=color(heads[0][0]["fill"] if heads else None))
    if bodies:
        o,p=bodies[0]; x,y=(p-mid)@t,(p-mid)@n
        closed=bool(o["closePath"]) or length(p[0]-p[-1])<.01
        signs=np.sign(y[abs(y)>.05])
        r.update(body="rectangle" if closed else "zigzag",zigs=0 if closed else (1+np.count_nonzero(np.diff(signs)))/2,
                 bodyPen=o["width"]*MM,bodyColor=color(o["color"]),bodyLength=np.ptp(x),bodyHeight=np.ptp(y),
                 bodyAlong=(x.min()+x.max())/2,bodyAcross=(y.min()+y.max())/2,bodyInk=ink(rgb,(p[1:]+p[:-1])/2,color(o["color"])))
        if fills: r["fillInk"]=ink(rgb,mid+3*t+.7*n,r["bodyFill"])
    if not mods: return
    o,p=mods[0]; r.update(modifier="arrow" if len(p)==2 else "bar",modifierPen=o["width"]*MM,modifierColor=color(o["color"]))
    if len(p)==3:
        if abs((p[0]-p[1])@n)<abs((p[-1]-p[1])@n): p=p[::-1]
        r.update(bendX=p[1,0],bendY=p[1,1],footLength=length(p[2]-p[1]))
    elif heads:
        head=heads[0][1]; center=head.mean(0)
        if length(p[0]-center)<length(p[1]-center): p=p[::-1]
        axis=(p[1]-p[0])/length(p[1]-p[0]); cross=np.array([-axis[1],axis[0]])
        tip=head[(head@axis).argmax()]; x,y=(head-head[0]).T
        r.update(tipX=tip[0],tipY=tip[1],headLength=np.ptp(head@axis),headWidth=np.ptp(head@cross),
                 headArea=abs(x@np.roll(y,-1)-y@np.roll(x,-1))/2,headInk=ink(rgb,center,r["headColor"]))
    r.update(startX=p[0,0],startY=p[0,1],endX=p[-1,0],endY=p[-1,1],lineLength=length(np.diff(p,axis=0)).sum(),
             modifierInk=ink(rgb,p[:-1]*.76+p[1:]*.24,color(o["color"])))

def panel(stage,e,k):
    case=e["id"]; m=e["panels"]["tikztosvg" if k=="rsvg" else k]; ext="pdf" if k=="pdf" else "svg"
    f=stage/m[ext+"File"]; png=stage/m["file"]; assert sha(f)==m[ext+"Sha256"] and sha(png)==m["sha256"]
    if k=="rsvg":
        png=stage/"capture/rsvg"/(case+".png"); png.parent.mkdir(exist_ok=True)
        subprocess.run(["rsvg-convert","-b","white","-d",str(DPI),"-p",str(DPI),"-o",png,f],check=True)
    rgb=np.array(Image.open(png).convert("RGB"))
    with (pymupdf.open(f) if k=="pdf" else pymupdf.open(stream=subprocess.check_output(["rsvg-convert","-f","pdf",f]),filetype="pdf")) as doc:
        assert len(doc)==1; g=doc[0]; size=np.array(g.rect)[2:]*MM
        ops=[(o,vertices(o)) for o in g.get_drawings()]
    if k!="pdf":
        actual=np.array(m["intrinsicCssPx"])*25.4/96; assert max(abs(actual-size))<.002; size=actual
    rows={}
    for name,mid,t,n,r in frames(case,ops): component(ops,mid,t,n,r,rgb); rows[name]=r
    if case==CONTROL:
        for hue,name in RINGS.items():
            marks=[(o,p) for o,p in ops if color(o["color"])==hue]; assert len(marks)==1,(case,name)
            o,p=marks[0]; mid=(p.min(0)+p.max(0))/2; radius=np.ptp(p,axis=0)/2
            rows[name]=dict(centerX=mid[0],centerY=mid[1],radiusX=radius[0],radiusY=radius[1],pen=o["width"]*MM,
                            ringColor=hue,ringInk=ink(rgb,mid+radius*np.array([[1,0],[-1,0],[0,1],[0,-1]]),hue))
    return dict(pageW=size[0],pageH=size[1]),rows,sha(png)

def audit(stage,before,strict):
    cap=read(stage/"capture.json"); summary=read(stage/"summary.json")
    assert summary["gate"]["accepted"] and sha(stage/"summary.json")==cap["summarySha256"]
    assert cap["dpi"]==DPI and not cap["errors"] and not cap["badRequests"] and {e["id"] for e in cap["rows"]}=={MANUAL,CONTROL}
    manual=Path(subprocess.check_output(["kpsewhich","-format=TeX system documentation","circuitikzmanual.tex"],text=True).strip()).read_bytes().splitlines(keepends=True)
    old={e["id"]:e for e in read(before/"capture.json")["rows"]} if before else {}
    rows=[]; pages=[]; diffs=[]; locks=[]; diag=[]
    for entry in cap["rows"]:
        case=entry["id"]; f=Path(cap["fixtureRoot"])/entry["source"]; src=f.read_bytes()
        assert entry["originalPdfInputMatchesSource"] and sha(f)==entry["sourceSha256"] and entry["editorRenderClicked"] and entry["previousSvgDetached"]
        body=src[src.index(b"\\begin{circuitikz}"):src.index(b"\\end{document}")]
        if case==MANUAL: assert body==b"".join(manual[2362:2369])
        adapter=(stage/"tikztosvg-input"/(case+".tex")).read_bytes().lstrip(b"\n")
        assert adapter.startswith(body.split(b"\\end{circuitikz}")[0].replace(b"\\begin{circuitikz}",b"\\begin{tikzpicture}")+b"\\tikzset{execute at end picture=")
        def xml(k): return ET.tostring(ET.parse(stage/entry["panels"][k]["svgFile"]).getroot())
        assert xml("live")==xml("download")
        if entry["diagnostics"] or entry["exportDiagnostics"]: diag.append(case)
        panels={}
        for k in (*JS,*REFS):
            pg,objects,h=panel(stage,entry,k); panels[k]={**objects,"page":pg}
            pages.append(dict(case=case,panel=k,rasterSha=h,**rounded(pg)))
            rows.extend(dict(case=case,panel=k,feature=name,**rounded(obj)) for name,obj in objects.items())
        for k,set_ in panels.items():
            for ref in ("pdf","tikztosvg"):
                if k==ref: continue
                for name,goal in panels[ref].items():
                    actual=set_[name]; bad=[]; result={}
                    if "body" in goal:
                        want=("rectangle" if name.startswith("EU") else "zigzag")
                        mod="none" if name=="ordinary-R" else "bar" if "sR" in name else "arrow"
                        assert goal["body"]==want and goal["modifier"]==mod and ("tipX" in goal)==(mod=="arrow"),(case,name,ref,goal)
                    for key in sorted(set(goal)|set(actual)):
                        a=actual.get(key); b=goal.get(key)
                        if key.endswith("Ink"): assert b is True,(ref,case,name,key)
                        if a is None or b is None: result[key]="missing" if a is None else "extra"; bad.append(key)
                        elif isinstance(b,(str,bool,np.bool_)):
                            result[key]="same" if a==b else f"{a} vs {b}"
                            if a!=b: bad.append(key)
                        else:
                            result[key]=a-b
                            if abs(a-b)>(.035 if key=="headArea" else 0 if key=="zigs" else .02): bad.append(key)
                    diffs.append(dict(case=case,panel=k,reference=ref,feature=name,fail=" ".join(bad),**rounded(result)))
                    if k in REFS: assert not bad,(case,k,ref,name,bad,{j:result[j] for j in bad})
        if before:
            assert old[case]["sourceSha256"]==entry["sourceSha256"]
            for route,key in (("pdf","sha256"),("tikztosvg","svgSha256"),("tikztosvg","sha256"),("rsvg","sha256")):
                if route=="rsvg":
                    rel=Path("capture/rsvg")/(case+".png"); a,b=sha(before/rel),sha(stage/rel)
                else: a,b=(e["panels"][route][key] for e in (old[case],entry))
                locks.append(dict(case=case,route=route,field=key,baseline=a,current=b,match=a==b))
    for file,data in (("pages",pages),("features",rows),("residuals",diffs),("reference-locks",locks)):
        if data: csv_out(stage/(file+".csv"),data)
    bad=[r for r in diffs if r["fail"]]; unlocked=[r for r in locks if not r["match"]]
    print(cap["revision"],f"{len(diffs)-len(bad)}/{len(diffs)} comparisons; diagnostics: {diag}; reference changes: {[(r['case'],r['route']) for r in unlocked]}")
    if strict and (bad or unlocked or diag or not before): raise SystemExit(1)

if __name__=="__main__":
    ap=argparse.ArgumentParser(description=__doc__); ap.add_argument("stage",type=Path); ap.add_argument("--before",type=Path); ap.add_argument("--require-all",action="store_true")
    a=ap.parse_args(); audit(a.stage,a.before,a.require_all)
