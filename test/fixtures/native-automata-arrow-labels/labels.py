"""Measure arrow-label baselines, visible ink, state centers and pages in mm."""
import argparse
import copy
import subprocess
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

import cv2
import numpy as np
import pymupdf

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"native-round-nodes"))
from measure import DPI, MM, PPM, csv_out, oval, read, sha

GALLERY="initial-accepting-states"
MODES=("live","download","export","pdf","tikztosvg")
CELLS=("nw","ne","sw","se")
def spec(case):
    gallery=case==GALLERY; direct=case=="direct-cardinals"
    states="q0 q1 q2 q3".split() if gallery else list("ABCD")
    words=("start entry start start" if gallery else "west north south east").split()
    sides=("left right above below" if gallery else "left above below right").split()
    order=states+words if direct else [s for pair in zip(states,words) for s in pair]
    slots=(4,5,6,7) if direct else (1,3,5,7)
    starts=np.r_[0,np.cumsum(list(map(len,order)))]
    runs=[slice(starts[i],starts[i+1]) for i in slots]
    return states,words,sides,"".join(order)+("abc" if gallery else ""),runs

def native_runs(file,case):
    root=ET.parse(file).getroot(); vb=np.fromstring(root.attrib["viewBox"],sep=" ")
    assert np.all(vb[:2]==0) and all(abs(float(root.get(k).removesuffix("pt"))-n)<.001 for k,n in zip(("width","height"),vb[2:]))
    uses=root.findall("./{*}g/{*}use"); _,_,_,sequence,runs=spec(case)
    assert len(uses)==len(sequence) and not any("transform" in g.attrib for g in root.findall("./{*}g")+uses)
    key={}; pts=[]
    for u,char in zip(uses,sequence):
        glyph=u.get("{http://www.w3.org/1999/xlink}href"); assert glyph and key.setdefault(glyph,char)==char
        pts.append([float(u.get("x")),float(u.get("y"))])
    return root,np.array(pts)*MM,runs

def ink_templates(file,case):
    # Isolate the converter's existing glyph uses in memory, only to identify the word
    # on unmodified screenshots (not neighboring arrows, letters or the state).
    root,points,runs=native_runs(file,case); out=[]
    for run in runs:
        tile=copy.deepcopy(root); i=0
        for g in list(tile):
            if g.tag.endswith("}defs"): continue
            children=g.findall("{*}use")
            if not children: tile.remove(g); continue
            for u in children:
                if i not in range(run.start,run.stop): g.remove(u)
                i+=1
        data=subprocess.check_output(["rsvg-convert","-b","white","-d",str(DPI),"-p",str(DPI)],input=ET.tostring(tile))
        ink=255-cv2.imdecode(np.frombuffer(data,np.uint8),cv2.IMREAD_GRAYSCALE)
        y,x=np.where(ink>=128); a,b=x.min(),y.min()
        out.append((ink[b:y.max()+1,a:x.max()+1],np.array([a,b])-points[run.start]*PPM))
    return out

def paint(frame,origin,template):
    word,offset=template; h,w=word.shape
    pred=np.rint(origin*PPM+offset).astype(int); pad=round(.55*PPM)
    x,y=np.maximum(0,pred-pad); r,b=np.minimum(frame.shape[::-1],pred+[w,h]+pad)
    score=cv2.matchTemplate(frame[y:b,x:r],word,cv2.TM_CCOEFF_NORMED)
    _,confidence,_,(dx,dy)=cv2.minMaxLoc(score); x+=dx; y+=dy
    assert confidence>=.65,("word not identifiable on original capture",confidence)
    support=cv2.dilate(np.pad((word>=128).astype("uint8"),2),np.ones((3,3),np.uint8))
    assert x>=2 and y>=2 and x+w+2<=frame.shape[1] and y+h+2<=frame.shape[0]
    iy,ix=np.where((frame[y-2:y+h+2,x-2:x+w+2]>=128)&(support>0))
    return np.array([x-2+ix.min(),y-2+iy.min(),x-2+ix.max()+1,y-2+iy.max()+1])/PPM,confidence

def panel(stage,e,mode,templates):
    case=e["id"]; m=e["panels"][mode]; key="pdf" if mode=="pdf" else "svg"
    file=stage/m[key+"File"]; png=stage/m["file"]
    assert sha(file)==m[key+"Sha256"] and sha(png)==m["sha256"]
    with (pymupdf.open(file) if mode=="pdf" else pymupdf.open(stream=subprocess.check_output(["rsvg-convert","-f","pdf",file]),filetype="pdf")) as d:
        assert len(d)==1
        page=np.array(d[0].rect)[2:]*MM
        bodies=[oval(p) for p in d[0].get_drawings() if p["fill"] and p["fill"][2]-p["fill"][0]>.05 and [k[0] for k in p["items"]]==["c"]*4]
        chars=[c for t in d[0].get_texttrace() for c in t["chars"]]
    if mode!="pdf":
        declared=np.array(m["intrinsicCssPx"])*25.4/96; assert max(abs(declared-page))<.002; page=declared
    states,words,sides,seq,runs=spec(case)
    if mode=="tikztosvg": _,points,_=native_runs(file,case)
    else:
        assert "".join(chr(c[0]) for c in chars)==seq,(case,mode,"glyph sequence")
        points=np.array([c[2] for c in chars])*MM
    assert len(bodies)==4
    mid=np.median([c for c,_ in bodies],axis=0)
    cells={("n" if c[1]<mid[1] else "s")+("w" if c[0]<mid[0] else "e"):(c,s) for c,s in bodies}
    assert set(cells)==set(CELLS)
    frame=255-cv2.imread(str(png),cv2.IMREAD_GRAYSCALE)
    for cell,state,word,side,run,template in zip(CELLS,states,words,sides,runs,templates):
        c,h=cells[cell]; glyphs=points[run]; first=glyphs[0]
        assert np.ptp(glyphs[:,1])<.002 and min(np.diff(glyphs[:,0]))>0
        box,confidence=paint(frame,first,template); x0,y0,x1,y1=box
        ix,iy=(box[:2]+box[2:])/2
        outward={"left":c[0]-x1,"right":x0-c[0],"above":c[1]-y1,"below":y0-c[1]}[side]
        values=dict(pageW=page[0],pageH=page[1],cx=c[0],cy=c[1],baseX=first[0],baseY=first[1],
                    dx=first[0]-c[0],dy=first[1]-c[1],glyphSpan=glyphs[-1,0]-first[0],
                    inkX=ix,inkY=iy,inkDx=ix-c[0],inkDy=iy-c[1],inkFromCenter=outward,
                    inkFromRim=outward-(h["major"]+h["outerPen"])/2,inkMatch=confidence)
        yield dict(case=case,panel=mode,state=state,word=word,side=side,**{k:round(v,5) for k,v in values.items()})

def audit(stage,parent=None,strict=False):
    cap=read(stage/"capture.json"); summary=read(stage/"summary.json")
    assert cap["dpi"]==DPI and not cap["errors"] and not cap["badRequests"] and summary["gate"]["accepted"] and sha(stage/"summary.json")==cap["summarySha256"]
    old={e["id"]:e for e in read(parent/"capture.json")["rows"]} if parent else {}
    rows=[]; diffs=[]; locks=[]
    for e in cap["rows"]:
        case=e["id"]; assert not e["diagnostics"] and not e["exportDiagnostics"] and e["originalPdfInputMatchesSource"]
        assert e["sourceSha256"]==sha(Path(cap["fixtureRoot"])/e["source"])
        if parent:
            assert e["sourceSha256"]==old[case]["sourceSha256"]
            for k,fields in (("pdf",["sha256"]),("tikztosvg",["sha256","svgSha256"])):
                for f in fields:
                    if e["panels"][k][f]!=old[case]["panels"][k][f]: locks.append((case,k,f))
        templates=ink_templates(stage/e["panels"]["tikztosvg"]["svgFile"],case)
        group=[r for k in MODES for r in panel(stage,e,k,templates)]; rows+=group
        for r in group:
            for ref in ("pdf","tikztosvg"):
                if r["panel"]==ref: continue
                n=next(n for n in group if n["panel"]==ref and n["state"]==r["state"])
                delta={k:round(v-n[k],5) for k,v in r.items() if k not in ("case","panel","state","word","side","inkMatch")}
                bad=[k for k,v in delta.items() if abs(v)>(.20 if k.startswith("ink") else .02)]
                diffs.append(dict(case=case,state=r["state"],word=r["word"],panel=r["panel"],reference=ref,fail=" ".join(bad),**delta))
                if r["panel"] in ("pdf","tikztosvg"): assert not bad,(case,r["state"],"native disagreement",bad)
    csv_out(stage/"labels.csv",rows); csv_out(stage/"residuals.csv",diffs)
    fails=sum(bool(r["fail"]) for r in diffs)
    print(cap["revision"],len(diffs)-fails,"/",len(diffs),"comparisons pass; historical native hash mismatches:",locks)
    if strict and (fails or locks): raise SystemExit(1)

if __name__=="__main__":
    ap=argparse.ArgumentParser(description=__doc__); ap.add_argument("stage",type=Path)
    ap.add_argument("--parent",type=Path); ap.add_argument("--require-match",action="store_true")
    a=ap.parse_args(); audit(a.stage,a.parent,a.require_match)
