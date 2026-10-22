"""Deterministic surface-bound native details. Never scatter grass onto the race or pit road."""
from pathlib import Path
import json,numpy as np
from scipy.spatial import cKDTree
G=Path(__file__).resolve().parents[1]/'game';tracks=json.loads((G/'circuits/physics.json').read_text())
for ident,track in tracks.items():
 source=G/'circuits'/f'{ident}.json'
 if not source.exists():continue
 d=json.loads(source.read_text());binary=(G/'circuits'/f'{ident}.bin').read_bytes();rng=np.random.default_rng(sum(map(ord,ident))*971);tree=cKDTree(np.column_stack([track['x'],track['z']]));records=[]
 for kind,names,density in [(0,['Grass verge','Mapped lawn ground detail','Mapped meadow ground detail'],.7),(1,['Mapped gravel ground detail'],.9)]:
  triangles=[]
  for obj in d['objects']:
   if obj['name'] not in names:continue
   geo=d['geometry'][obj['geometry']];desc=geo['attributes']['position'];p=np.frombuffer(binary,dtype='<f4',count=desc['bytes']//4,offset=desc['offset']).reshape(-1,3)
   if 'index' in geo:
    index=geo['index'];p=p[np.frombuffer(binary,dtype='<u4',count=index['bytes']//4,offset=index['offset'])]
   triangles.append(p.reshape(-1,3,3))
  if not triangles:continue
  tris=np.concatenate(triangles);centres=tris.mean(axis=1);tris=tris[tree.query(centres[:,[0,2]])[0]<75]
  area=np.linalg.norm(np.cross(tris[:,1]-tris[:,0],tris[:,2]-tris[:,0]),axis=1)/2;valid=area>1e-4;tris=tris[valid];area=area[valid]
  if not len(area):continue
  count=min(50000,int(area.sum()*density));ix=rng.choice(len(tris),count,p=area/area.sum());u=rng.random((count,1));v=rng.random((count,1));s=np.sqrt(u);p=(1-s)*tris[ix,0]+s*(1-v)*tris[ix,1]+s*v*tris[ix,2]
  dist,nearest=tree.query(p[:,[0,2]]);norm=np.column_stack([-np.asarray(track['tz'])[nearest],np.asarray(track['tx'])[nearest]]);signed=np.sum((p[:,[0,2]]-np.column_stack([np.asarray(track['x'])[nearest],np.asarray(track['z'])[nearest]]))*norm,axis=1)
  edges=np.where(signed>=0,np.asarray(track['widthRight'])[nearest],np.asarray(track['widthLeft'])[nearest]);p=p[(np.abs(signed)>edges+3.2)]
  # Quantized positions suppress overlapping landcover sources without shifting points.
  seen=set()
  for point in p:
   key=tuple(np.floor(point[[0,2]]*2).astype(int))
   if key in seen:continue
   seen.add(key);records.append([*map(float,point),float(rng.uniform(.12,.28) if kind==0 else rng.uniform(.018,.05)),float(rng.uniform(0,np.pi*2)),float(rng.uniform(.7,1.2)),kind])
 array=np.asarray(records,dtype='<f4');(G/'circuits'/f'{ident}-detail.dat').write_bytes(array.tobytes());print(ident,len(records),'surface-bound details')
