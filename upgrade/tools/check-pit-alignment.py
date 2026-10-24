from pathlib import Path
import json,sys,numpy as np
from pit_alignment import project
U=Path(__file__).resolve().parents[1];tracks=json.loads((U/'src/world-tour-data.json').read_text(encoding='utf-8'));pits=json.loads((U/'src/pit-lanes.json').read_text(encoding='utf-8'));reports=[]
for ident,p in pits.items():
    d=tracks[ident];xy=np.c_[p['x'],p['z']];s=np.array(p['s']);_,lateral,width,_=project(xy,d);clear=np.abs(lateral)-width-p['width']/2
    core=(s>120)&(s<s[-1]-120)
    if p.get('tunnel'):core&=s<p['s'][p['tunnel']['start']]-100
    k=np.gradient(p['heading'],s);box=p['box']
    r={'id':ident,'minBodyClearance':float(np.min(clear[core])),'boxClearance':float(clear[box]),'maxCurvature':float(np.max(np.abs(k))),'maxHeadingStepDegrees':float(np.max(np.abs(np.diff(p['heading'])))*180/np.pi),'bodyOverlaps':int(np.sum(clear[core]<-.02)),'length':p['length']}
    reports.append(r);print(ident,*(f'{key}={value:.3f}' for key,value in r.items() if key not in ['id','length']),flush=True)
(U/'qa/pit-alignment.json').write_text(json.dumps({'reports':reports,'passed':all(r['bodyOverlaps']==0 and r['boxClearance']>1.0 and r['maxCurvature']<.20 for r in reports)},indent=2),encoding='utf-8')
if '--assert' in sys.argv:assert all(r['bodyOverlaps']==0 and r['boxClearance']>1.0 and r['maxCurvature']<.20 for r in reports)
