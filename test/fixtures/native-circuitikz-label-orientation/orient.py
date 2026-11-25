"""Physical label, terminal and page measurements from the six real outputs."""
import argparse
import copy
import subprocess
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

import cv2
import numpy as np
import pymupdf

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"native-automata-arrow-labels"))
from labels import DPI, MM, PPM, csv_out, paint, read, sha

MIX="mixed-passives"; SPOKES=(0,45,90,135,180,-90,-45,-135)
JS=("live","download","export"); REFS=("pdf","tikztosvg","rsvg")
PARENT="1ffd8f5ea3fec5456f5ab228b52190e086a1cdf35edd2f3aaaf6d1ce63ed1113"
PATHS=np.array([[(0,3),(3,4.5)],[(6.5,4.5),(5,2.5)],[(3,1.5),(0,.5)],[(5,.3),(6.5,2.25)],[(0,-.8),(3,-.8)]])*[10,-10]
def check_manual(root):
    manual=subprocess.check_output(["kpsewhich","-format=TeX system documentation","circuitikzmanual.tex"],text=True).strip()
    lines=Path(manual).read_bytes().splitlines(keepends=True)
    for mode,start in (("straight",8870),("rotate",8879),("smart",8888)):
        src=(root.parent/("manual-"+mode+".tex")).read_bytes()
        assert src[src.index(b"\\begin{circuitikz}"):src.index(b"\\end{document}")]==b"".join(lines[start-1:start+6]),("installed manual block mismatch",mode)
def spec(case):
    if case==MIX: return ["R1","C2","R3","C4","R5"],PATHS
    t=np.radians(SPOKES); ends=25*np.stack([np.cos(t),-np.sin(t)],axis=1)
    return list(map(str,SPOKES)),np.stack([np.zeros_like(ends),ends],axis=1)
def angle(v): return np.degrees(np.arctan2(-v[1],v[0]))
def wrap(v): return (v+180)%360-180
def gray(file): return 255-cv2.imread(str(file),cv2.IMREAD_GRAYSCALE)
def rounded(d): return {k:round(float(v),5) if isinstance(v,(float,np.floating)) else v for k,v in d.items()}

def native(file,case):
    # Native converter glyph outlines have rotations baked in; placed uses still
    # carry the true baseline origins. No orientation is read from TikZ source.
    root=ET.parse(file).getroot(); v=np.fromstring(root.get("viewBox"),sep=" ")
    assert np.all(v[:2]==0) and all(abs(float(root.get(k).removesuffix("pt"))-n)<.001 for k,n in zip(("width","height"),v[2:]))
    uses=root.findall("./{*}g/{*}use"); words,_=spec(case)
    assert len(uses)==sum(map(len,words)) and all("transform" not in g.attrib for g in uses+root.findall("./{*}g"))
    pts=np.array([[float(u.get(k)) for k in ("x","y")] for u in uses])*MM
    starts=np.r_[0,np.cumsum(list(map(len,words)))]; parts=[pts[a:b] for a,b in zip(starts,starts[1:])]
    ids=[u.get("{http://www.w3.org/1999/xlink}href") for u in uses]; codes={}
    for g,c in zip(ids,"".join(words)): assert g and codes.setdefault(g,c)==c
    if case==MIX:
        # Unrotated R5 witnesses the subscript drop in this very SVG. The signed
        # main-to-subscript displacement includes it; its slope alone is not a baseline.
        drop=parts[-1][1,1]-parts[-1][0,1]
        assert .48<drop<.59 and ids[4]==ids[8]
        angles=[angle(p[-1]-p[0])+np.degrees(np.arcsin(drop/np.linalg.norm(p[-1]-p[0]))) for p in parts]
    else:
        angles=[angle(p[-1]-p[0]) if len(p)>1 else None for p in parts]
        assert ids[0]==ids[starts[5]-1]  # single 0 has exactly the glyph used in 180
        angles[0]=angles[4]
    templates=[]
    for a,b in zip(starts,starts[1:]):
        tile=copy.deepcopy(root); i=0
        for g in list(tile):
            if g.tag.endswith("}defs"): continue
            children=g.findall("{*}use")
            if not children: tile.remove(g); continue
            for u in children:
                if not a<=i<b: g.remove(u)
                i+=1
        data=subprocess.check_output(["rsvg-convert","-b","white","-d",str(DPI),"-p",str(DPI)],input=ET.tostring(tile))
        img=255-cv2.imdecode(np.frombuffer(data,np.uint8),cv2.IMREAD_GRAYSCALE)
        y,x=np.where(img>=128); templates.append((img[y.min():y.max()+1,x.min():x.max()+1],np.array([x.min(),y.min()])-pts[a]*PPM))
    return parts,angles,templates

def panel(stage,e,k,oracle):
    case=e["id"]; core="tikztosvg" if k=="rsvg" else k; m=e["panels"][core]
    key="pdf" if k=="pdf" else "svg"; file=stage/m[key+"File"]; png=stage/m["file"]
    assert sha(file)==m[key+"Sha256"] and sha(png)==m["sha256"]
    if k=="rsvg":
        png=stage/"capture"/"rsvg"/(case+".png"); png.parent.mkdir(exist_ok=True)
        subprocess.run(["rsvg-convert","-b","white","-d",str(DPI),"-p",str(DPI),"-o",png,file],check=True)
    frame=gray(png)
    with (pymupdf.open(file) if k=="pdf" else pymupdf.open(stream=subprocess.check_output(["rsvg-convert","-f","pdf",file]),filetype="pdf")) as doc:
        assert len(doc)==1
        page=np.array(doc[0].rect)[2:]*MM; ops=doc[0].get_drawings()
        chars=[(chr(ch[0]),np.array(ch[2])*MM,angle(s["dir"])) for s in doc[0].get_texttrace() for ch in s["chars"]]
    if k!="pdf":
        declared=np.array(m["intrinsicCssPx"])*25.4/96; assert max(abs(declared-page))<.002; page=declared
    blank=not ops and not chars
    p=dict(case=case,panel=k,pageW=page[0],pageH=page[1],darkPixels=int((frame>=128).sum()),blank=blank,rasterSha=sha(png))
    words,paths=spec(case); rows=[]
    if blank:
        assert k in JS and frame.max()==0
        return rounded(p),[dict(case=case,panel=k,label=w,present=False) for w in words]
    loops=[op for op in ops if [it[0] for it in op["items"]]==["c"]*4]
    hubs=[np.array(op["rect"])*MM for op in loops if op["fill"]==((1.,0.,0.) if case==MIX else (0.,0.,0.)) and op["rect"].width*MM<1.3]
    assert len(hubs)==(1 if case==MIX else 8) and np.max(np.ptp(hubs,axis=0))<.002
    origin=(hubs[0][:2]+hubs[0][2:])/2; p.update(originX=origin[0],originY=origin[1])
    if case!=MIX:
        dots=[op for op in loops if op["fill"]==(1.,1.,1.)]; assert len(dots)==8
        for op,xy in zip(dots,paths[:,1]):
            b=np.array(op["rect"])*MM
            assert np.linalg.norm((b[:2]+b[2:])/2-origin-xy)<.006,("terminal identity",case,k,xy)
        assert all(d["color"]==(0.,0.,0.) and d["width"]>0 for d in dots)
        east=dots[0]
        diameter=east["rect"].width*MM
        p.update(eastPathD=diameter,eastInkD=diameter+east["width"]*MM)
        edges=np.array([np.array(d["rect"])*MM+d["width"]*MM/2*np.array([-1,-1,1,1]) for d in dots])
        p.update(marginL=edges[:,0].min(),marginT=edges[:,1].min(),marginR=page[0]-edges[:,2].max(),marginB=page[1]-edges[:,3].max())
    if k in ("tikztosvg","rsvg"): parts,angles=oracle[:2]
    else:
        assert "".join(c[0] for c in chars)=="".join(words),(case,k,"actual glyph sequence")
        parts=[]; angles=[]; i=0
        for w in words:
            group=chars[i:i+len(w)]; i+=len(w); angles.append(group[0][2])
            assert all(abs(wrap(c[2]-angles[-1]))<.12 for c in group)
            parts.append(np.stack([c[1] for c in group]))
    for w,path,points,theta,tpl in zip(words,paths,parts,angles,oracle[2]):
        first,last=points[0],points[-1]; vector=path[1]-path[0]; t=vector/np.linalg.norm(vector); n=[t[1],-t[0]]
        q=first-origin-path.mean(axis=0); end=last-origin
        r=dict(case=case,panel=k,label=w,present=True,angle=theta,baseX=first[0],baseY=first[1],along=q@t,normal=q@n,
               lastX=end[0],lastY=end[1],ink=False)
        # No rotation or stretching to force a match: the true native glyph shape
        # must be visible near this output's own vector origin. Parent failures remain red.
        try: box,score=paint(frame,first,tpl)
        except AssertionError: pass
        else:
            c=(box[:2]+box[2:])/2-origin; r.update(ink=True,inkX=c[0],inkY=c[1],score=score)
        rows.append(r)
    return p,rows

def run(stage,parent,require):
    cap=read(stage/"capture.json"); s=read(stage/"summary.json"); is_parent=cap["revision"]=="parent-0833e9a6"
    assert s["gate"]["accepted"] and sha(stage/"summary.json")==cap["summarySha256"] and cap["dpi"]==DPI and not cap["errors"] and not cap["badRequests"]
    check_manual(Path(cap["fixtureRoot"]))
    if is_parent: assert cap["environment"]["rendererSha256"]==PARENT and not parent
    old={e["id"]:e for e in read(parent/"capture.json")["rows"]} if parent else {}
    pages=[]; labels=[]; diffs=[]; layout=[]; diagnostics=[]; locks=[]
    for e in cap["rows"]:
        case=e["id"]; assert e["originalPdfInputMatchesSource"] and e["sourceSha256"]==sha(Path(cap["fixtureRoot"])/e["source"])
        if parent:
            o=old[case]; assert o["sourceSha256"]==e["sourceSha256"]
            for k,f in (("pdf","sha256"),("tikztosvg","sha256"),("tikztosvg","svgSha256")):
                if e["panels"][k][f]!=o["panels"][k][f]: locks.append((case,k,f))
        if e["diagnostics"] or e["exportDiagnostics"]: diagnostics.append(case)
        oracle=native(stage/e["panels"]["tikztosvg"]["svgFile"],case); group={}; pg={}
        for k in (*JS,*REFS):
            pg[k],group[k]=panel(stage,e,k,oracle); pages.append(rounded(pg[k])); labels.extend(map(rounded,group[k]))
        if is_parent and case.startswith("manual-"):
            assert all(pg[k]["blank"] for k in JS) and "Malformed \\foreach value list" in " ".join(e["diagnostics"])
        for k in (*JS,*REFS):
            for ref in ("pdf","tikztosvg"):
                if k==ref: continue
                p,n=pg[k],pg[ref]; pd={j:p[j]-n[j] for j in ("pageW","pageH","originX","originY","eastPathD","eastInkD","marginL","marginR","marginT","marginB") if j in p and j in n}
                bad=[j for j,v in pd.items() if abs(v)>.02]; layout.append(dict(case=case,panel=k,reference=ref,fail=" ".join(bad),**rounded(pd)))
                if k in REFS: assert not bad,(case,k,ref,bad)
                for r,v in zip(group[k],group[ref]):
                    assert r["label"]==v["label"]; d={}; bad=[]; absolute=[]
                    if not r["present"]: bad.append("missing"); absolute.append("missing")
                    else:
                        for j in ("angle","along","normal","lastX","lastY","baseX","baseY","inkX","inkY"):
                            if j in r and j in v: d[j]=wrap(r[j]-v[j]) if j=="angle" else r[j]-v[j]
                        bad=[j for j,a in d.items() if j not in ("baseX","baseY") and abs(a)>(.20 if j.startswith("ink") else .12 if j=="angle" else .02)]
                        absolute=[j for j in ("baseX","baseY") if abs(d[j])>.02]
                        if not r["ink"] or not v["ink"]: bad.append("visibleGlyph")
                    combined=" ".join(dict.fromkeys(bad+absolute))
                    diffs.append(dict(case=case,panel=k,reference=ref,label=v["label"],fail=combined,
                                      localFail=" ".join(bad),absoluteFail=" ".join(absolute),**rounded(d)))
                    if k in REFS: assert not combined,(case,k,ref,v["label"],combined,d)
    for name,rows in (("panels",pages),("glyphs",labels),("label-residuals",diffs),("page-residuals",layout)): csv_out(stage/(name+".csv"),rows)
    local=sum(bool(r["localFail"]) for r in diffs); failed=sum(bool(r["fail"]) for r in diffs); ff=[r for r in layout if r["fail"]]
    print(cap["revision"],"local labels:",len(diffs)-local,"/",len(diffs),"; labels including absolute page baselines:",len(diffs)-failed,"/",len(diffs),"; page/terminal rows:",len(layout)-len(ff),"/",len(layout),"; diagnostics:",diagnostics,"; native hash differences:",locks)
    bad_view=any(r["case"]==MIX or "margin" in r["fail"] for r in ff)
    if require and (local or diagnostics or locks or bad_view or (require=="all" and (failed or ff))): raise SystemExit(1)

if __name__=="__main__":
    ap=argparse.ArgumentParser(description=__doc__); ap.add_argument("stage",type=Path); ap.add_argument("--parent",type=Path)
    ap.add_argument("--require",choices=("labels","all")); a=ap.parse_args(); run(a.stage,a.parent,a.require)
