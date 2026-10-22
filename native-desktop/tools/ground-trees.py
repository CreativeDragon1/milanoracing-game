"""Project tree roots onto the actual authored ground meshes, without moving X/Z."""
from pathlib import Path
import json, sys
import numpy as np
from scipy.spatial import cKDTree

N=Path(__file__).resolve().parents[1];reports=[]
ids=[x for x in sys.argv[1:] if not x.startswith('--')] or list(json.loads((N/'game/circuits/physics.json').read_text()))
for ident in ids:
    file=N/'game/circuits'/f'{ident}.json';data=json.loads(file.read_text());raw=file.with_suffix('.bin').read_bytes();triangles=[]
    for obj in data['objects']:
        if not obj.get('ground') or 'water' in obj['name'].lower():continue
        g=data['geometry'][obj['geometry']];a=g['attributes']['position']
        vertices=np.frombuffer(raw,dtype='<f4',count=a['bytes']//4,offset=a['offset']).reshape(-1,3)
        if 'index' in g:
            a=g['index'];vertices=vertices[np.frombuffer(raw,dtype='<u4',count=a['bytes']//4,offset=a['offset'])]
        matrix=np.asarray(obj['matrix']).reshape(4,4).T
        vertices=vertices@matrix[:3,:3].T+matrix[:3,3]
        triangles.append(vertices.reshape(-1,3,3))
    tri=np.concatenate(triangles);xz=tri[:,:,[0,2]];centres=xz.mean(axis=1);spatial=cKDTree(centres)
    changed=[];missing=0;kept=[]
    for tree in data['trees']:
        p=np.asarray([tree[0],tree[2]]);ids=spatial.query(p,k=min(128,len(tri)))[1];candidate=tri[ids];q=xz[ids]
        a=q[:,1]-q[:,0];b=q[:,2]-q[:,0];c=p-q[:,0];den=a[:,0]*b[:,1]-a[:,1]*b[:,0]
        safe=np.where(abs(den)>1e-8,den,1)
        u=(c[:,0]*b[:,1]-c[:,1]*b[:,0])/safe;v=(a[:,0]*c[:,1]-a[:,1]*c[:,0])/safe
        valid=(abs(den)>1e-8)&(u>=-1e-6)&(v>=-1e-6)&(u+v<=1+1e-6)
        height=candidate[:,0,1]+u*(candidate[:,1,1]-candidate[:,0,1])+v*(candidate[:,2,1]-candidate[:,0,1])
        height=height[valid]
        if not len(height):
            # Long boundary triangles can have distant centroids; prove absence
            # against every authored ground triangle before discarding a root.
            a=xz[:,1]-xz[:,0];b=xz[:,2]-xz[:,0];c=p-xz[:,0];den=a[:,0]*b[:,1]-a[:,1]*b[:,0];safe=np.where(abs(den)>1e-8,den,1)
            u=(c[:,0]*b[:,1]-c[:,1]*b[:,0])/safe;v=(a[:,0]*c[:,1]-a[:,1]*c[:,0])/safe
            valid=(abs(den)>1e-8)&(u>=-1e-6)&(v>=-1e-6)&(u+v<=1+1e-6)
            height=(tri[:,0,1]+u*(tri[:,1,1]-tri[:,0,1])+v*(tri[:,2,1]-tri[:,0,1]))[valid]
        if not len(height):missing+=1;continue
        kept.append(tree)
        y=float(height[np.argmin(abs(height-tree[1]))]);delta=y-tree[1]
        if abs(delta)>.05:
            changed.append(delta)
            if '--write' in sys.argv:tree[1]=round(y,5)
    if '--write' in sys.argv:
        data['trees']=kept
        file.write_text(json.dumps(data,separators=(',',':')))
    report={'circuit':ident,'trees':len(data['trees']),'adjusted':len(changed),'uncovered':missing,'maxRootAdjustment':round(max(map(abs,changed),default=0),4)}
    reports.append(report);print(report,flush=True)
(N/'qa/tree-grounding.json').write_text(json.dumps({'written':'--write' in sys.argv,'reports':reports},indent=2))
