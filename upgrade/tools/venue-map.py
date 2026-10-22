"""Georegister public OSM footprints to each existing circuit without changing the track."""
from pathlib import Path
import json,subprocess,time,sys,re,xml.etree.ElementTree as ET
import numpy as np
from scipy.interpolate import CubicSpline,CubicHermiteSpline
from scipy.ndimage import gaussian_filter1d
from scipy.spatial import cKDTree
from shapely.geometry import Polygon,LineString
U=Path('upgrade');D=U/'research/osm';D.mkdir(exist_ok=True);tour=json.loads((U/'src/world-tour-data.json').read_text());source=json.loads(Path('upgrade/vendor/work/circuit-sources/f1-circuits.geojson').read_text());result={};report=[]
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
 path=D/(ident+'.json');bb=[ll[:,1].min()-.003,ll[:,0].min()-.003,ll[:,1].max()+.003,ll[:,0].max()+.003];bbox=','.join(str(round(x,6)) for x in bb);query='[out:json][timeout:40];(way["building"]('+bbox+');way["natural"="wood"]('+bbox+');way["landuse"="forest"]('+bbox+');way["natural"="water"]('+bbox+'););out geom;';qfile=D/(ident+'.overpass');qfile.write_text(query)
 valid=False
 if path.exists():
  try:valid='elements' in json.loads(path.read_text())
  except ValueError:pass
 if not valid:
  xmlpath=D/(ident+'-map.osm')
  if not xmlpath.exists():
   box=','.join(str(round(x,6)) for x in [bb[1],bb[0],bb[3],bb[2]])
   subprocess.run(['curl.exe','-fsSL','--max-time','90','https://api.openstreetmap.org/api/0.6/map?bbox='+box,'-o',str(xmlpath)],check=True)
  root=ET.parse(xmlpath).getroot();nodes={n.attrib['id']:{'lon':float(n.attrib['lon']),'lat':float(n.attrib['lat'])} for n in root.findall('node')};elements=[]
  for way in root.findall('way'):
   tags={t.attrib['k']:t.attrib['v'] for t in way.findall('tag')}
   if not ('building' in tags or tags.get('natural') in ['wood','water'] or tags.get('landuse')=='forest'):continue
   refs=[n.attrib['ref'] for n in way.findall('nd')]
   if all(ref in nodes for ref in refs):elements.append({'id':int(way.attrib['id']),'tags':tags,'geometry':[nodes[ref] for ref in refs]})
  path.write_text(json.dumps({'elements':elements,'source':'OpenStreetMap API map extract','license':'ODbL 1.0'}));del root,nodes
 data=json.loads(path.read_text());road=LineString(np.vstack([target,target[0]])).buffer(d['width']/2+4);tree=cKDTree(target);features=[]
 for f in data.get('elements',[]):
  if len(f.get('geometry',[]))<4:continue
  coords=np.array([[p['lon'],p['lat']] for p in f['geometry']]);xz=((coords-ll[0])*unit)@rotation*scale+translation
  if np.linalg.norm(xz[0]-xz[-1])>1 or len(xz)>700:continue
  p=Polygon(xz)
  if not p.is_valid or p.area<12 or tree.query(np.array(p.centroid.coords)[0])[0]>650:continue
  tags=f.get('tags',{});kind='building' if 'building' in tags else 'water' if tags.get('natural')=='water' else 'forest'
  if kind=='building' and p.intersects(road):continue
  if kind=='building':
   try:height=float(re.findall(r'[\d.]+',tags.get('height',''))[0]);measured=True
   except (IndexError,ValueError):
    try:height=float(tags.get('building:levels',''))*3.2;measured=True
    except ValueError:height=12 if ident in ['monaco','singapore','interlagos'] else 7;measured=False
   height=max(3,min(220,height))
  else:height=0;measured=False
  poly=np.array(p.simplify(.4).exterior.coords)[:-1]
  features.append({'id':f['id'],'kind':kind,'name':tags.get('name',''),'footprint':poly.round(2).tolist(),'height':height,'heightFromMap':measured,'building':tags.get('building','')})
 result[ident]=features;report.append({'circuit':ident,'registrationRMSMetres':rms,'features':len(features),'buildings':sum(x['kind']=='building' for x in features),'mappedHeights':sum(x['heightFromMap'] for x in features)});print(report[-1],flush=True)
 (U/'src/venue-map-data.json').write_text(json.dumps(result,separators=(',',':')),encoding='utf-8');(U/'qa/venue-registration.json').write_text(json.dumps(report,indent=2));time.sleep(.5)
