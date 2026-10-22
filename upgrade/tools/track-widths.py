"""Register TUM satellite-derived boundary measurements; keep provenance per station.
The 2019 database is not a current homologation survey. Changed/absent layouts retain labelled estimates.
"""
from pathlib import Path
import json, numpy as np
from scipy.spatial import cKDTree
from scipy.ndimage import gaussian_filter1d
from scipy.interpolate import PchipInterpolator
U=Path(__file__).resolve().parents[1];D=U/'research/widths';tour=json.loads((U/'src/world-tour-data.json').read_text(encoding='utf-8'));reports=[]
names={'bahrain':'Sakhir','monza':'Monza','interlagos':'SaoPaulo','silverstone':'Silverstone','spa':'Spa','austria':'Spielberg','suzuka':'Suzuka','abu-dhabi':'YasMarina','zandvoort':'Zandvoort'}
def resample(q,n):
 q=np.vstack([q,q[0]]);s=np.r_[0,np.cumsum(np.linalg.norm(np.diff(q,axis=0),axis=1))];return np.column_stack([np.interp(np.arange(n)/n*s[-1],s,q[:,j]) for j in range(2)])
def fit(a,b):
 ac=a-a.mean(0);bc=b-b.mean(0);u,sv,v=np.linalg.svd(ac.T@bc);R=u@v;scale=sv.sum()/(ac*ac).sum();T=b.mean(0)-a.mean(0)@R*scale;return R,scale,T
for id,d in tour.items():
 q=np.column_stack([d['x'],d['z']]);n=len(q);normal=np.column_stack([-np.array(d['tz']),d['tx']]);status=np.full(n,'estimated',dtype=object)
 if id in names:
  data=np.loadtxt(D/(names[id]+'.csv'),delimiter=',',comments='#');raw=data[:,:2];a=resample(raw,300);b=resample(q,300);best=None
  for direction in [1,-1]:
   aa=a[::direction]
   for shift in range(300):
    bb=np.roll(b,shift,axis=0);R,s,T=fit(aa,bb);err=np.mean(np.sort(np.linalg.norm(aa@R*s+T-bb,axis=1))[:270]**2)
    if best is None or err<best[0]:best=(err,R,s,T)
  _,R,s,T=best
  # Trimmed closest-point registration tolerates rebuilt corner complexes.
  for _ in range(30):
   transformed=raw@R*s+T;dist,idx=cKDTree(q).query(transformed);ok=dist<np.quantile(dist,.85);R,s,T=fit(raw[ok],q[idx[ok]])
  transformed=raw@R*s+T;dist,idx=cKDTree(transformed).query(q)
  tangent=np.roll(transformed,-1,axis=0)-np.roll(transformed,1,axis=0);tangent/=np.linalg.norm(tangent,axis=1)[:,None]
  forward=np.sum(tangent[idx]*np.column_stack([d['tx'],d['tz']]),axis=1)>0
  # Source coordinates may be mirrored by the game XZ map; assign source boundaries geometrically.
  rawt=np.roll(raw,-1,axis=0)-np.roll(raw,1,axis=0);rawt/=np.linalg.norm(rawt,axis=1)[:,None];rn=np.column_stack([-rawt[:,1],rawt[:,0]])
  edge1=(raw+rn*data[:,3,None])@R*s+T;edge2=(raw-rn*data[:,2,None])@R*s+T
  o1=np.sum((edge1[idx]-q)*normal,axis=1);o2=np.sum((edge2[idx]-q)*normal,axis=1)
  lo=np.minimum(o1,o2);hi=np.maximum(o1,o2);total=(data[idx,2]+data[idx,3])*s
  good=(dist<7)&(lo<-2.8)&(hi>2.8)&(total>7)&(total<26)
  left=np.where(good,-lo,total/2);right=np.where(good,hi,total/2)
  status[good]='satellite-boundary';status[~good]='registered-width-estimate'
  if id=='abu-dhabi':
   # Current northern hairpin / banked turn complex differs from the historical database.
   changed=dist>10;left[changed]=8;right[changed]=8;status[changed]='layout-changed-estimate'
  left=gaussian_filter1d(np.clip(left,3,13),1.2,mode='wrap');right=gaussian_filter1d(np.clip(right,3,13),1.2,mode='wrap')
  report={'id':id,'source':names[id]+'.csv','registrationMedianMetres':float(np.median(dist)),'registrationP95Metres':float(np.quantile(dist,.95)),'scale':float(s),'boundaryCoverage':float(good.mean())}
 elif id=='milano':
  left=np.full(n,8.);right=np.full(n,8.);status[:]='original-design';report={'id':id,'source':'Milano original design'}
 else:
  # Venue-specific estimates, explicitly not survey data. Anchors reviewed against promoter maps.
  anchors=([[0,13],[.075,11],[.17,10],[.27,9],[.39,8],[.51,10],[.64,11],[.78,10],[.90,9],[1,13]] if id=='monaco' else [[0,15],[.10,13],[.22,12],[.35,14],[.46,11],[.56,10],[.64,12],[.75,13],[.88,14],[1,15]])
  a=np.array(anchors);width=PchipInterpolator(a[:,0],a[:,1])(np.arange(n)/n);left=right=width/2;report={'id':id,'source':'Promoter-map reconstruction; width estimates pending survey'}
 d['widthLeft']=left.round(4).tolist();d['widthRight']=right.round(4).tolist();d['widthProvenance']=status.tolist();d['widthReport']={**report,'minMetres':float(min(left+right)),'maxMetres':float(max(left+right)),'note':'Widths share the track metre scale. Satellite-derived boundaries and estimates, not certified survey dimensions.'};reports.append(d['widthReport']);print(json.dumps(d['widthReport']))
(U/'src/world-tour-data.json').write_text(json.dumps(tour,separators=(',',':')),encoding='utf-8');(U/'qa/track-widths.json').write_text(json.dumps(reports,indent=2),encoding='utf-8')
