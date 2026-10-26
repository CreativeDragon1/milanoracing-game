from pathlib import Path
import json,sys,hashlib
import numpy as np
R=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(R/'upgrade/tools/deps'))
from shapely import Polygon,points
from shapely.strtree import STRtree
from scipy.spatial import cKDTree
ident=sys.argv[1] if len(sys.argv)>1 else 'spa'
d=json.loads((R/f'native-desktop/game/circuits/{ident}.json').read_text());raw=(R/f'native-desktop/game/circuits/{ident}.bin').read_bytes();t=json.loads((R/'upgrade/src/world-tour-data.json').read_text())[ident]
xz=np.column_stack((t['x'],t['z']));nn=np.column_stack((-np.array(t['tz']),t['tx']));left=xz-nn*(np.array(t['widthLeft'])+.05)[:,None];right=xz+nn*(np.array(t['widthRight'])+.05)[:,None]
polys=[Polygon([left[i],left[(i+1)%t['N']],right[(i+1)%t['N']],right[i]]).buffer(0) for i in range(t['N'])];tree=STRtree(polys);out=[];overhead=[]
for oi,o in enumerate(d['objects']):
 if o['car'] or o.get('ground') or 'instances' in o:continue
 g=d['geometry'][o['geometry']];a=g['attributes']['position'];v=np.frombuffer(raw,dtype='<f4',count=a['bytes']//4,offset=a['offset']).reshape(-1,3).astype(float)
 if not len(v):continue
 if 'index' in g:a=g['index'];v=v[np.frombuffer(raw,dtype='<u4',count=a['bytes']//4,offset=a['offset'])]
 m=np.array(o['matrix']).reshape(4,4).T;v=v@m[:3,:3].T+m[:3,3];tri=v.reshape(-1,3,3)
 probe=np.concatenate([tri.mean(1),tri[:,0]*.6+tri[:,1]*.2+tri[:,2]*.2,tri[:,0]*.2+tri[:,1]*.6+tri[:,2]*.2,tri[:,0]*.2+tri[:,1]*.2+tri[:,2]*.6])
 pairs=tree.query(points(probe[:,[0,2]]),predicate='within')
 if not pairs.size:continue
 rows,stations=pairs;pp=probe[rows];a=xz[stations];b=xz[(stations+1)%t['N']];delta=b-a
 u=np.clip(np.sum((pp[:,[0,2]]-a)*delta,axis=1)/np.sum(delta*delta,axis=1),0,1)
 off=np.sum((pp[:,[0,2]]-(a+delta*u[:,None]))*nn[stations],axis=1);heights=np.array(t['elevation']['height']);bank=np.array(t['bank']);y=heights[stations]*(1-u)+heights[(stations+1)%t['N']]*u-off*np.tan(bank[stations])
 clear=pp[:,1]-y;mask=(clear>.12)&(clear<6)
 if mask.any():
  p=pp[mask];st=stations[mask];gap=clear[mask];record={'object':o['name'],'objectIndex':oi,'samples':int(mask.sum()),'stations':sorted(set(st.tolist())),'clearance':[float(gap.min()),float(gap.max())],'points':p[:8].tolist()};
  approved_tunnel=ident=='monaco' and o['name']=='Louis II continuous tunnel soffit' and gap.min()>=5.5
  approved_bridge=False
  if ident=='suzuka' and gap.min()>=5.0:
   upper=max(t['features']['overpass']['stations'],key=lambda k:t['elevation']['height'][k])
   expected=np.array([t['x'][upper],t['elevation']['height'][upper]-.65,t['z'][upper]])
   approved_bridge=np.linalg.norm(m[:3,3]-expected)<.001 and abs(np.ptp(v[:,1])-.75)<.001
  if approved_tunnel or approved_bridge:overhead.append(record)
  else:out.append(record)
  print(record['object'],oi,record['samples'],record['stations'][:20],record['clearance'])
report={'circuit':ident,'scope':'Four barycentric samples per noninstanced static triangle, road interior, 0.12 to 6 metres clearance. Excludes ground, cars and instanced geometry; not an exhaustive collision proof.','exportSHA256':hashlib.sha256(raw).hexdigest(),'obstructions':out,'verifiedOverhead':overhead}
(R/f'native-desktop/qa/{ident}-static-clearance.json').write_text(json.dumps(report,indent=2))
assert not out,out
print('Static clearance samples passed:',ident)
