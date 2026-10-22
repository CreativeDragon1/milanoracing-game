"""Bounded minimum-time line search, tyre friction circles, aero, grade and banking."""
from pathlib import Path
import json,time,numpy as np
from scipy.optimize import minimize
from numba import njit
ROOT=Path(__file__).resolve().parents[2];U=ROOT/'upgrade';tour=json.loads((U/'src/world-tour-data.json').read_text(encoding='utf-8'));p=json.loads((U/'src/vehicle-model.json').read_text(encoding='utf-8'));reports=[]
@njit(cache=True)
def geometry(q):
 n=len(q);curv=np.zeros(n);ds=np.zeros(n)
 for i in range(n):
  u=q[i]-q[(i-1)%n];v=q[(i+1)%n]-q[i];curv[i]=2*(u[0]*v[1]-u[1]*v[0])/max(1e-12,np.sqrt((u*u).sum()*(v*v).sum()*((u+v)*(u+v)).sum()));ds[i]=np.sqrt((v*v).sum())
 return curv,ds
@njit(cache=True)
def envelope(v,k,grade,vc,bank):
 m=800.;g=9.81;cs=1/np.sqrt(1+grade*grade);vs=v/cs;normal=max(0,g*cs*np.cos(bank)+vs*vs*vc);df=5.2*vs*vs;front=m*normal*1.4/3+df*.45;rear=m*normal*1.6/3+df*.55;mu=2.;maxlat=min(48.,.82*mu*(normal+df/m));steer=min(.70/(1+(v/35)**2)*.85,np.arctan(maxlat*3/(v*v+16)))
 bankAid=g*np.sin(bank)*np.sign(k);lat=min(maxlat*.98,v*v/3*np.tan(steer)*.98,mu*front*3/(m*1.4)*.98,mu*rear*3/(m*1.6)*.98)+bankAid
 ay=abs(v*v*k-g*np.sin(bank));af=np.sqrt(max(0,(mu*front*.98)**2-(m*ay*1.4/3)**2));ar=np.sqrt(max(0,(mu*rear*.98)**2-(m*ay*1.6/3)**2));drag=.5*1.2*1.7*vs*vs+.015*m*normal;drive=min(19000.,720000./max(vs,6))*min(1,max(0,(100-vs)/5))
 return lat,(min(drive,ar)-drag)/m*cs-g*grade*cs*cs,(min(47000*.58,af)+min(47000*.42,ar)+drag)/m*cs+g*grade*cs*cs
@njit(cache=True)
def profile(k,ds,y,bank):
 n=len(k);gr=np.zeros(n);vc=np.zeros(n);v=np.zeros(n)
 for i in range(n):gr[i]=(y[(i+1)%n]-y[(i-1)%n])/(ds[i]+ds[(i-1)%n])
 for i in range(n):vc[i]=(np.arctan(gr[(i+1)%n])-np.arctan(gr[(i-1)%n]))/((ds[i]+ds[(i-1)%n])*np.sqrt(1+gr[i]*gr[i]))
 for i in range(n):
  lo=0.;hi=100.
  for j in range(24):
   mid=(lo+hi)/2;e=envelope(mid,k[i],gr[i],vc[i],bank[i])
   if mid*mid*abs(k[i])<=e[0]+1e-9 and e[1]>=0:lo=mid
   else:hi=mid
  v[i]=lo
 for iteration in range(32):
  change=0.
  for i in range(n-1,-1,-1):
   j=(i+1)%n;kk=k[i] if abs(k[i])>abs(k[j]) else k[j];vv=v[j]
   for r in range(5):vv=np.sqrt(max(0,v[j]**2+2*min(envelope(max(vv,v[j]),kk,gr[i],vc[i],bank[i])[2],envelope(max(vv,v[j]),kk,gr[j],vc[j],bank[j])[2])*ds[i]))
   if vv<v[i]:change=max(change,v[i]-vv);v[i]=vv
  for i in range(n):
   j=(i+1)%n;kk=k[i] if abs(k[i])>abs(k[j]) else k[j];vv=v[i]
   for r in range(5):vv=np.sqrt(max(.01,v[i]**2+2*min(envelope(max(vv,v[i]),kk,gr[i],vc[i],bank[i])[1],envelope(max(vv,v[i]),kk,gr[j],vc[j],bank[j])[1])*ds[i]))
   if vv<v[j]:change=max(change,v[j]-vv);v[j]=vv
  if change<1e-6:break
 total=0.
 for i in range(n):total+=2*ds[i]/max(.1,v[i]+v[(i+1)%n])
 return total,v
for ident,d in tour.items():
 t=time.time();q=np.array([d['x'],d['z']]).T;normal=np.array([-np.array(d['tz']),d['tx']]).T;n=len(q);K=180;y=np.array(d['elevation']['height']);bank=np.array(d['bank']);left=np.array(d.get('widthLeft',[d['width']/2]*n));right=np.array(d.get('widthRight',[d['width']/2]*n));lower=-left+1.25;upper=right-1.25
 basis=np.zeros((n,K))
 for i in range(n):
  j=int(i/n*K);u=i/n*K-j
  for a,w in zip([j-1,j,j+1,j+2],[(1-u)**3/6,(3*u**3-6*u*u+4)/6,(-3*u**3+3*u*u+3*u+1)/6,u**3/6]):basis[i,a%K]=w
 # Sparse four-tap interpolation avoids a dense matrix product in every objective.
 indices=np.stack([(np.floor(np.arange(n)/n*K).astype(int)+off)%K for off in [-1,0,1,2]],axis=1);weights=np.take_along_axis(basis,indices,axis=1)
 controlLow=np.array([max(lower[basis[:,i]>0]) for i in range(K)]);controlHigh=np.array([min(upper[basis[:,i]>0]) for i in range(K)]);bounds=list(zip(controlLow,controlHigh))
 def path(c):
  o=(c[indices]*weights).sum(axis=1);return q+normal*o[:,None],o
 def evaluate(c):
  pp,o=path(c);k,ds=geometry(pp);h=y-o*np.tan(bank);lap,v=profile(k,ds,h,bank);return lap,v,pp,o,k,ds
 def smooth(c):
  pp,o=path(c);k,ds=geometry(pp);return 100*np.sum(k*k*ds)+.001*np.sum(np.diff(np.r_[c,c[:2]],n=2)**2)
 def objective(c):return evaluate(c)[0]+.0006*np.sum(np.diff(np.r_[c,c[:2]],n=2)**2)
 initial=np.clip(np.linalg.lstsq(basis,np.array(d['line']['offset']),rcond=None)[0],controlLow,controlHigh)
 centre=evaluate(np.zeros(K))[0];baseline=evaluate(initial)[0];print('Optimizing',ident,'centre',round(centre,2),flush=True)
 seed=minimize(smooth,initial,method='L-BFGS-B',bounds=bounds,options={'maxiter':80,'ftol':1e-10,'eps':.004})
 candidates=[initial,seed.x]
 best=min(candidates,key=objective)
 result=minimize(objective,best,method='L-BFGS-B',bounds=bounds,options={'maxiter':38,'ftol':1e-8,'eps':.012,'maxls':15,'maxfun':16000});candidates.append(result.x)
 coeff=min(candidates,key=objective);lap,v,pp,o,k,ds=evaluate(coeff)
 assert np.isfinite(v).all() and np.all(o>=lower-1e-7) and np.all(o<=upper+1e-7) and lap<=min(centre,baseline)+.05,(ident,lap,baseline)
 report=dict(id=ident,centrelineSeconds=float(centre),previousPathSeconds=float(baseline),optimizedSeconds=float(lap),maxSpeedKmh=float(max(v)*3.6),minSpeedKmh=float(min(v)*3.6),maxOffsetMetres=float(abs(o).max()),minimumCentreClearanceMetres=float(np.minimum(o+left,right-o).min()),iterations=int(result.nit),converged=bool(result.success),message=str(result.message),elapsedSeconds=time.time()-t)
 d['line']=dict(x=pp[:,0].round(7).tolist(),z=pp[:,1].round(7).tolist(),offset=o.round(7).tolist(),curvature=k.tolist(),speed=v.tolist(),ds=ds.tolist(),report={**report,'optimizedTime':lap,'description':'Local bounded lap-time optimization of a 180-control periodic spline with aero, axle friction circles, elevation and banking. No global-optimum claim.'});reports.append(report)
 (U/'src/world-tour-data.json').write_text(json.dumps(tour,separators=(',',':')));(U/'qa/line-optimization.json').write_text(json.dumps(reports,indent=2));print(json.dumps(report),flush=True)
