"""Deterministic surface-bound native details. Never scatter grass onto the race or pit road."""
from pathlib import Path
import json,numpy as np
from scipy.spatial import cKDTree
G=Path(__file__).resolve().parents[1]/'game';tracks=json.loads((G/'circuits/physics.json').read_text())
reports=[]
for ident,track in tracks.items():
 source=G/'circuits'/f'{ident}.json'
 if not source.exists():continue
 d=json.loads(source.read_text());binary=(G/'circuits'/f'{ident}.bin').read_bytes();rng=np.random.default_rng(sum(map(ord,ident))*971);tree=cKDTree(np.column_stack([track['x'],track['z']]));records=[]
 def triangles_for(obj):
  geo=d['geometry'][obj['geometry']];desc=geo['attributes']['position'];p=np.frombuffer(binary,dtype='<f4',count=desc['bytes']//4,offset=desc['offset']).reshape(-1,3)
  if 'index' in geo:
   index=geo['index'];p=p[np.frombuffer(binary,dtype='<u4',count=index['bytes']//4,offset=index['offset'])]
  matrix=np.asarray(obj['matrix']).reshape(4,4).T
  return (p@matrix[:3,:3].T+matrix[:3,3]).reshape(-1,3,3)
 # The generic grass verge can sit beneath a mapped gravel or paved patch.
 # Use the actual triangles above it, rather than scattering through that patch.
 blocked={0:[],1:[]};removed={0:0,1:0}
 for obj in d['objects']:
  name=obj['name'].lower()
  hard=any(token in name for token in ['asphalt','paved runoff','raised kerb','mapped water','runoff sponsor'])
  gravel='gravel' in name
  if hard or gravel:
   tris=triangles_for(obj)
   blocked[0].append(tris)
   if hard:blocked[1].append(tris)
 filters={}
 for kind,parts in blocked.items():
  if not parts:continue
  tri=np.concatenate(parts);xz=tri[:,:,[0,2]];lo=np.floor(xz.min(axis=1)/25).astype(int);hi=np.floor(xz.max(axis=1)/25).astype(int);cells={}
  for j in range(len(tri)):
   for x in range(lo[j,0],hi[j,0]+1):
    for z in range(lo[j,1],hi[j,1]+1):cells.setdefault((x,z),[]).append(j)
  filters[kind]=(tri,xz,cells)
 def exclude_covered(points,kind):
  if kind not in filters:return points
  tri,xz,cells=filters[kind];keep=np.ones(len(points),dtype=bool);groups={}
  for i,key in enumerate(np.floor(points[:,[0,2]]/25).astype(int)):groups.setdefault(tuple(key),[]).append(i)
  for key,ids in groups.items():
   candidates=cells.get(key)
   if not candidates:continue
   q=xz[candidates];t=tri[candidates];a=q[:,1]-q[:,0];b=q[:,2]-q[:,0];den=a[:,0]*b[:,1]-a[:,1]*b[:,0];safe=np.where(abs(den)>1e-8,den,1)
   for start in range(0,len(ids),256):
    batch=np.asarray(ids[start:start+256]);c=points[batch][:,None,[0,2]]-q[None,:,0]
    u=(c[:,:,0]*b[:,1]-c[:,:,1]*b[:,0])/safe;v=(a[:,0]*c[:,:,1]-a[:,1]*c[:,:,0])/safe
    height=t[:,0,1]+u*(t[:,1,1]-t[:,0,1])+v*(t[:,2,1]-t[:,0,1]);relative=height-points[batch,None,1]
    covered=(abs(den)>1e-8)&(u>=-1e-6)&(v>=-1e-6)&(u+v<=1+1e-6)&(relative>=-.03)&(relative<1)
    keep[batch]=~covered.any(axis=1)
  removed[kind]+=int((~keep).sum());return points[keep]
 for kind,names,density in [(0,['Grass verge','Mapped lawn ground detail','Mapped meadow ground detail'],.7),(1,['Mapped gravel ground detail'],.9)]:
  triangles=[]
  for obj in d['objects']:
   if obj['name'] not in names:continue
   triangles.append(triangles_for(obj))
  if not triangles:continue
  tris=np.concatenate(triangles);centres=tris.mean(axis=1);tris=tris[tree.query(centres[:,[0,2]])[0]<75]
  area=np.linalg.norm(np.cross(tris[:,1]-tris[:,0],tris[:,2]-tris[:,0]),axis=1)/2;valid=area>1e-4;tris=tris[valid];area=area[valid]
  if not len(area):continue
  count=min(50000,int(area.sum()*density));ix=rng.choice(len(tris),count,p=area/area.sum());u=rng.random((count,1));v=rng.random((count,1));s=np.sqrt(u);p=(1-s)*tris[ix,0]+s*(1-v)*tris[ix,1]+s*v*tris[ix,2]
  dist,nearest=tree.query(p[:,[0,2]]);norm=np.column_stack([-np.asarray(track['tz'])[nearest],np.asarray(track['tx'])[nearest]]);signed=np.sum((p[:,[0,2]]-np.column_stack([np.asarray(track['x'])[nearest],np.asarray(track['z'])[nearest]]))*norm,axis=1)
  edges=np.where(signed>=0,np.asarray(track['widthRight'])[nearest],np.asarray(track['widthLeft'])[nearest]);p=p[(np.abs(signed)>edges+3.2)]
  p=exclude_covered(p,kind)
  # Quantized positions suppress overlapping landcover sources without shifting points.
  seen=set()
  for point in p:
   key=tuple(np.floor(point[[0,2]]*2).astype(int))
   if key in seen:continue
   seen.add(key);records.append([*map(float,point),float(rng.uniform(.045,.11) if kind==0 else rng.uniform(.018,.05)),float(rng.uniform(0,np.pi*2)),float(rng.uniform(.7,1.2)),kind])
 array=np.asarray(records,dtype='<f4');(G/'circuits'/f'{ident}-detail.dat').write_bytes(array.tobytes());print(ident,len(records),'surface-bound details')
 reports.append({'circuit':ident,'details':len(records),'removedGrassUnderHardSurfaces':removed[0],'removedGravelUnderPaving':removed[1]})
(G.parent/'qa/ground-detail.json').write_text(json.dumps(reports,indent=2),encoding='utf-8')
