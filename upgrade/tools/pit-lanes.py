"""Mapped pit routes. Source: OpenStreetMap contributors (ODbL); widths and service marks reconstructed."""
from pathlib import Path
import sys,json,xml.etree.ElementTree as ET,numpy as np
from scipy.spatial import cKDTree
from scipy.interpolate import CubicSpline
from scipy.ndimage import gaussian_filter1d
U=Path(__file__).resolve().parents[1];tour=json.loads((U/'src/world-tour-data.json').read_text(encoding='utf-8'));trs=json.loads((U/'src/geographic-transforms.json').read_text());result=json.loads((U/'src/pit-lanes.json').read_text()) if len(sys.argv)>1 else {}
ids={'bahrain':[187123422],'singapore':[100484287],'monza':[38168747],'monaco':[850261588,1388331347],'austria':[289111668],'silverstone':[227902927],'abu-dhabi':[176695253,176695254,176695255],'spa':[323851541],'suzuka':[120917578],'interlagos':[33779109],'zandvoort':[38144527]}
for ident,d in tour.items():
 if len(sys.argv)>1 and ident not in sys.argv[1:]:continue
 q=np.column_stack([d['x'],d['z']]);n=len(q);ds=d['length']/n;tree=cKDTree(q);norm=np.column_stack([-np.array(d['tz']),d['tx']]);tunnel=[]
 if ident!='milano':
  tr=trs[ident];r=ET.parse(U/f'research/osm/{ident}-map.osm').getroot();nodes={int(x.get('id')):[float(x.get('lon')),float(x.get('lat'))] for x in r.findall('node')};parts=[]
  for w in r.findall('way'):
   if int(w.get('id')) not in ids[ident]:continue
   ll=np.array([nodes[int(x.get('ref'))] for x in w.findall('nd')]);a=((ll-np.array(tr['origin']))*np.array(tr['unit']))@np.array(tr['rotation'])*tr['scale']+np.array(tr['translation']);parts.append(a)
   if any(t.get('k')=='tunnel' and t.get('v')=='yes' for t in w.findall('tag')):tunnel.extend(a.tolist())
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
 a=int(tree.query(route[0])[1]);b=int(tree.query(route[-1])[1]);entry=(a-round(48/ds))%n;exit=(b+round(54/ds))%n
 line=np.column_stack([d['line']['x'],d['line']['z']]);route=np.vstack([line[entry],route,line[exit]])
 s=np.r_[0,np.cumsum(np.linalg.norm(np.diff(route,axis=0),axis=1))]
 tangent=lambda i:(line[(i+1)%n]-line[(i-1)%n])/np.linalg.norm(line[(i+1)%n]-line[(i-1)%n])
 curve=CubicSpline(s,route,axis=0,bc_type=((1,tangent(entry)),(1,tangent(exit))))
 dense=curve(np.linspace(0,s[-1],int(s[-1]*3)+1));denseS=np.r_[0,np.cumsum(np.linalg.norm(np.diff(dense,axis=0),axis=1))]
 sample=np.linspace(0,denseS[-1],int(denseS[-1]/1.5)+1);path=np.column_stack([np.interp(sample,denseS,dense[:,k]) for k in [0,1]])
 # A short fairing removes mapping-node chatter without straightening the real bends.
 fair=gaussian_filter1d(path,2.0,axis=0,mode='nearest');fade=np.minimum(np.clip(sample/18,0,1),np.clip((sample[-1]-sample)/18,0,1));fade=fade*fade*(3-2*fade);path=path*(1-fade[:,None])+fair*fade[:,None]
 length=np.r_[0,np.cumsum(np.linalg.norm(np.diff(path,axis=0),axis=1))];dist,ix=tree.query(path);progress=np.unwrap(ix/n*2*np.pi)*n/(2*np.pi)
 # Pit progress is monotonic through the legal bypass, including the timing line.
 progress=np.maximum.accumulate(progress);progress=entry+(progress-progress[0])/(progress[-1]-progress[0])*((exit-entry)%n)
 # Height is sampled by physical position, not the monotonic timing coordinate.
 # Timing progress can compress a bypass and previously created 33 percent ramps.
 lateral=np.sum((path-q[ix])*norm[ix],axis=1)
 raw=np.asarray(d['elevation']['height'])[ix]-lateral*np.tan(np.asarray(d['bank'])[ix])
 y=gaussian_filter1d(raw,(42 if ident=='interlagos' else 18)/np.mean(np.diff(length)),mode='nearest')
 for end,station in [(0,entry),(-1,exit)]:
  target=d['elevation']['height'][station]-d['line']['offset'][station]*np.tan(d['bank'][station]);delta=target-y[end]
  distance=length if end==0 else length[-1]-length;blend=np.clip(1-distance/65,0,1);y+=delta*blend*blend*(3-2*blend)
 tunnelInfo=None
 if tunnel:
  ti=cKDTree(path).query(np.asarray(tunnel))[1];lo,hi=int(min(ti)),int(max(ti));ramp=100.0
  descent=np.clip((length-(length[lo]-ramp))/ramp,0,1);ascent=np.clip(((length[hi]+ramp)-length)/ramp,0,1)
  descent=descent*descent*(3-2*descent);ascent=ascent*ascent*(3-2*ascent);y-=6.5*np.minimum(descent,ascent)
  tunnelInfo={'start':lo,'end':hi,'clearance':4.6,'depth':6.5,'source':'OSM tunnel=yes; clearance and ramp elevations reconstructed'}
 heading=np.unwrap(np.arctan2(np.gradient(path[:,1],length),np.gradient(path[:,0],length)));heading[0]=np.arctan2(tangent(entry)[1],tangent(entry)[0]);heading[-1]=np.arctan2(tangent(exit)[1],tangent(exit)[0]);heading=np.unwrap(heading)
 curvature=np.gradient(heading,length);grade=np.gradient(y,length)
 # A route-level pit box is chosen on the working lane, clear of entry/exit tapers.
 valid=np.arange(len(path))[int(len(path)*.27):int(len(path)*.70)];box=int(valid[np.argmin(abs(progress[valid]%n-np.where(progress[valid]%n>n/2,n,0)))])
 box=max(int(len(path)*.3),min(int(len(path)*.68),box));speed=60 if ident=='monaco' else 80
 targetSpeed=np.minimum(speed/3.6,np.sqrt(6/np.maximum(abs(curvature),.0001)))
 for k in range(len(path)-2,-1,-1):targetSpeed[k]=min(targetSpeed[k],np.sqrt(targetSpeed[k+1]**2+2*8*(length[k+1]-length[k])))
 result[ident]={'x':path[:,0].round(5).tolist(),'z':path[:,1].round(5).tolist(),'y':y.round(5).tolist(),'s':length.round(5).tolist(),'heading':heading.round(7).tolist(),'grade':grade.round(6).tolist(),'cornerSpeed':targetSpeed.round(5).tolist(),'station':progress.round(5).tolist(),'length':float(length[-1]),'entry':int(entry),'exit':int(exit),'box':box,'speedLimitKmh':speed,'limitStart':float(length[min(12,len(path)//10)]),'limitEnd':float(length[-min(12,len(path)//10)]),'width':7,'sourceWayIds':ids.get(ident,[]),'note':'OSM alignment with tangent-continuous merges; reconstructed width and smoothed height, not surveyed pit elevations. Curvature-limited assisted travel.'}
 if tunnelInfo:result[ident]['tunnel']=tunnelInfo
 print(ident,'entry',round(entry/n,3),'exit',round(exit/n,3),'metres',round(length[-1]),'box',round(length[box]))
(U/'src/pit-lanes.json').write_text(json.dumps(result,separators=(',',':')),encoding='utf-8')
