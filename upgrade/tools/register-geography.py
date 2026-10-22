"""Georegister public OSM footprints to each existing circuit without changing the track."""
from pathlib import Path
import json,subprocess,time,sys,re,xml.etree.ElementTree as ET
import numpy as np
from scipy.interpolate import CubicSpline,CubicHermiteSpline
from scipy.ndimage import gaussian_filter1d
from scipy.spatial import cKDTree
from shapely.geometry import Polygon,LineString
U=Path('upgrade');D=U/'research/osm';D.mkdir(exist_ok=True);tour=json.loads((U/'src/world-tour-data.json').read_text());source=json.loads(Path('upgrade/vendor/work/circuit-sources/f1-circuits.geojson').read_text());result={};report=[];transforms={}
for ident,d in tour.items():
 if ident=='milano':continue
 f=next(f for f in source['features'] if f['properties']['id']==d['source']);ll=np.array(f['geometry']['coordinates'])[:,:2];ll=ll[np.r_[True,np.linalg.norm(np.diff(ll,axis=0),axis=1)>1e-10]]
 if np.linalg.norm(ll[-1]-ll[0])>1e-8:ll=np.vstack([ll,ll[0]])
 if ident=='singapore':ll=ll[::-1].copy()
 unit=np.array([111320*np.cos(np.radians(ll[:,1].mean())),-111320]);xy=(ll-ll[0])*unit;s=np.r_[0,np.cumsum(np.linalg.norm(np.diff(xy,axis=0),axis=1))];spline=CubicSpline(s,xy,bc_type='periodic')
 if ident=='bahrain':
  direction=(xy[2]-xy[0])/np.linalg.norm(xy[2]-xy[0]);derivatives=spline(s,1);xy[1]=xy[0]+direction*np.dot(xy[1]-xy[0],direction)
  for j in [0,1,2,len(xy)-1]:derivatives[j]=direction
  spline=CubicHermiteSpline(s,xy,derivatives)
 fine=spline(np.linspace(0,s[-1],18000));ss=np.r_[0,np.cumsum(np.linalg.norm(np.diff(fine,axis=0),axis=1))];anchor=(np.array(d['startGPS'])-ll[0])*unit;origin=ss[np.argmin(np.linalg.norm(fine-anchor,axis=1))];samples=(np.arange(1200)/1200*ss[-1]+origin)%ss[-1];q=np.column_stack([np.interp(samples,ss,fine[:,j]) for j in range(2)]);q=gaussian_filter1d(q,.75 if ident in ['spa','suzuka','interlagos','zandvoort'] else 1,axis=0,mode='wrap');target=np.column_stack([d['x'],d['z']]);a=q-q.mean(0);b=target-target.mean(0);u,sv,v=np.linalg.svd(a.T@b);rotation=u@v;scale=sv.sum()/(a*a).sum();translation=target.mean(0)-q.mean(0)@rotation*scale;rms=float(np.sqrt(np.mean(np.sum((q@rotation*scale+translation-target)**2,axis=1))));assert rms<3,(ident,rms)
 transforms[ident]={'origin':ll[0].tolist(),'unit':unit.tolist(),'rotation':rotation.tolist(),'scale':scale,'translation':translation.tolist(),'rms':rms}
(U/'src/geographic-transforms.json').write_text(json.dumps(transforms,indent=2),encoding='utf-8')
print('Registered',len(transforms),'circuits')
