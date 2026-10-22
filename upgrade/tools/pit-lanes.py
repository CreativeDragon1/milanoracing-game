"""Mapped pit routes. Source: OpenStreetMap contributors (ODbL); widths and service marks reconstructed."""
from pathlib import Path
import json,xml.etree.ElementTree as ET,numpy as np
from scipy.spatial import cKDTree
from scipy.interpolate import PchipInterpolator
U=Path(__file__).resolve().parents[1];tour=json.loads((U/'src/world-tour-data.json').read_text(encoding='utf-8'));trs=json.loads((U/'src/geographic-transforms.json').read_text());result={}
ids={'bahrain':[187123422],'singapore':[100484287],'monza':[38168747],'monaco':[850261588,1388331347],'austria':[289111668],'silverstone':[227902927],'abu-dhabi':[176695253,176695254,176695255],'spa':[323851541],'suzuka':[120917578],'interlagos':[33779109],'zandvoort':[38144527]}
for ident,d in tour.items():
 q=np.column_stack([d['x'],d['z']]);n=len(q);ds=d['length']/n;tree=cKDTree(q);norm=np.column_stack([-np.array(d['tz']),d['tx']]);tunnel=[]
 if ident!='milano':
  tr=trs[ident];r=ET.parse(U/f'research/osm/{ident}-map.osm').getroot();nodes={int(x.get('id')):[float(x.get('lon')),float(x.get('lat'))] for x in r.findall('node')};parts=[]
  for w in r.findall('way'):
   if int(w.get('id')) not in ids[ident]:continue
   ll=np.array([nodes[int(x.get('ref'))] for x in w.findall('nd')]);a=((ll-np.array(tr['origin']))*np.array(tr['unit']))@np.array(tr['rotation'])*tr['scale']+np.array(tr['translation']);parts.append(a)
  # Join endpoint-connected mapped sections, respecting circuit-forward orientation afterwards.
  route=parts.pop(0)
  while parts:
   choices=[(np.linalg.norm(route[-1]-p[0]),i,0) for i,p in enumerate(parts)]+[(np.linalg.norm(route[-1]-p[-1]),i,1) for i,p in enumerate(parts)]+[(np.linalg.norm(route[0]-p[-1]),i,2) for i,p in enumerate(parts)]+[(np.linalg.norm(route[0]-p[0]),i,3) for i,p in enumerate(parts)]
   _,i,k=min(choices);a=parts.pop(i)
   if k==0:route=np.vstack([route,a])
   if k==1:route=np.vstack([route,a[::-1]])
   if k==2:route=np.vstack([a,route])
   if k==3:route=np.vstack([a[::-1],route])
  start=tree.query(route[0])[1];end=tree.query(route[-1])[1]
  if (end-start)%n>n/2:route=route[::-1]
 else:
  stations=np.arange(n-85,n+65)%n;route=q[stations]+norm[stations]*(-22*np.sin(np.linspace(0,np.pi,len(stations)))**.4)[:,None]
 route=route[np.r_[True,np.linalg.norm(np.diff(route,axis=0),axis=1)>.3]]
 a=int(tree.query(route[0])[1]);b=int(tree.query(route[-1])[1]);entry=(a-round(12/ds))%n;exit=(b+round(12/ds))%n
 line=np.column_stack([d['line']['x'],d['line']['z']]);route=np.vstack([line[entry],route,line[exit]])
 s=np.r_[0,np.cumsum(np.linalg.norm(np.diff(route,axis=0),axis=1))];sample=np.linspace(0,s[-1],max(80,int(s[-1]/2.5)));path=PchipInterpolator(s,route,axis=0)(sample);length=np.r_[0,np.cumsum(np.linalg.norm(np.diff(path,axis=0),axis=1))];dist,ix=tree.query(path);progress=np.unwrap(ix/n*2*np.pi)*n/(2*np.pi)
 # Pit progress is monotonic through the legal bypass, including the timing line.
 progress=np.maximum.accumulate(progress);progress=entry+(progress-progress[0])/(progress[-1]-progress[0])*((exit-entry)%n)
 y=np.interp(progress%n,np.arange(n),d['elevation']['height']);y=np.convolve(np.pad(y,(4,4),mode='edge'),np.ones(9)/9,'valid')
 # A route-level pit box is chosen on the working lane, clear of entry/exit tapers.
 valid=np.arange(len(path))[int(len(path)*.27):int(len(path)*.70)];box=int(valid[np.argmin(abs(progress[valid]%n-np.where(progress[valid]%n>n/2,n,0)))])
 box=max(int(len(path)*.3),min(int(len(path)*.68),box));speed=60 if ident=='monaco' else 80
 result[ident]={'x':path[:,0].round(5).tolist(),'z':path[:,1].round(5).tolist(),'y':y.round(5).tolist(),'s':length.round(5).tolist(),'station':progress.round(5).tolist(),'length':float(length[-1]),'entry':int(entry),'exit':int(exit),'box':box,'speedLimitKmh':speed,'limitStart':float(length[min(12,len(path)//10)]),'limitEnd':float(length[-min(12,len(path)//10)]),'width':7,'sourceWayIds':ids.get(ident,[]),'note':'OSM route; reconstructed pit width, service position and height. Assisted entry and exit; venue limit configurable.'}
 print(ident,'entry',round(entry/n,3),'exit',round(exit/n,3),'metres',round(length[-1]),'box',round(length[box]))
(U/'src/pit-lanes.json').write_text(json.dumps(result,separators=(',',':')),encoding='utf-8')
