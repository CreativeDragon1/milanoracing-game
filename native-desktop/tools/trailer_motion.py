"""Bake continuous, collision-checked choreography for both trailer renderers.

This is a film tool, not gameplay AI. Cars use distinct lines through a staged
pass or defence; the exported 60 Hz poses are shared by browser and desktop.
No frame interpolation or motion-blur filter is used to conceal pose jumps.
"""
from pathlib import Path
import json, math, hashlib
import numpy as np
from scipy.interpolate import CubicSpline
from scipy.ndimage import gaussian_filter1d, maximum_filter1d
from scipy.spatial import cKDTree

ROOT=Path(__file__).resolve().parents[2]
FPS=60

def smoothstep(v):
    v=np.clip(v,0,1)
    return v*v*v*(v*(v*6-15)+10)

def unit(v):
    return v/np.maximum(np.linalg.norm(v,axis=-1,keepdims=True),1e-10)

class Road:
    def __init__(self,d):
        self.d=d;self.n=d['N'];self.q=np.column_stack((d['x'],d['z']))
        self.seg=np.roll(self.q,-1,axis=0)-self.q
        self.tree=cKDTree(self.q)
        self.normal=np.column_stack((-np.array(d['tz']),d['tx']))
        self.h=np.array(d['elevation']['height']);self.bank=np.array(d['bank'])
        self.left=np.array(d['widthLeft']);self.right=np.array(d['widthRight'])
        left=self.q-self.normal*self.left[:,None];right=self.q+self.normal*self.right[:,None]
        ly=self.h+self.left*np.tan(self.bank)+.025;ry=self.h-self.right*np.tan(self.bank)+.025
        a=np.column_stack((left[:,0],ly,left[:,1]));b=np.column_stack((right[:,0],ry,right[:,1]))
        self.tri=np.stack((np.stack((a,b,np.roll(b,-1,axis=0)),1),np.stack((a,np.roll(b,-1,axis=0),np.roll(a,-1,axis=0)),1)),1)

    def sample(self,v,f):
        f=np.asarray(f)%self.n;i=f.astype(int);u=f-i
        return np.asarray(v)[i]*(1-u)+np.asarray(v)[(i+1)%self.n]*u

    def project(self,p):
        p=np.asarray(p);shape=p.shape[:-1];p=p.reshape(-1,2)
        _,ix=self.tree.query(p,k=5);ix=np.concatenate((ix,(ix-1)%self.n),1)
        a=self.q[ix];v=self.seg[ix];f=np.clip(np.sum((p[:,None]-a)*v,2)/np.sum(v*v,2),0,1)
        delta=p[:,None]-a-v*f[:,:,None];dist=np.sum(delta*delta,2);j=dist.argmin(1);row=np.arange(len(p))
        idx=ix[row,j];u=f[row,j];dx=delta[row,j];vv=unit(self.seg[idx]);off=dx[:,1]*vv[:,0]-dx[:,0]*vv[:,1]
        return (idx+u).reshape(shape),off.reshape(shape)

    def height(self,p):
        # Actual rendered road triangles, not an extrapolated flat centre line.
        p=np.asarray(p);shape=p.shape[:-1];flat=p.reshape(-1,2);f,off=self.project(flat)
        idx=f.astype(int)%self.n;candidates=(idx[:,None]+np.arange(-2,3))%self.n
        tri=self.tri[candidates].reshape(-1,10,3,3);a,b,c=tri[:,:,0],tri[:,:,1],tri[:,:,2]
        den=(b[:,:,2]-c[:,:,2])*(a[:,:,0]-c[:,:,0])+(c[:,:,0]-b[:,:,0])*(a[:,:,2]-c[:,:,2])
        x=flat[:,0,None];z=flat[:,1,None]
        u=((b[:,:,2]-c[:,:,2])*(x-c[:,:,0])+(c[:,:,0]-b[:,:,0])*(z-c[:,:,2]))/den
        v=((c[:,:,2]-a[:,:,2])*(x-c[:,:,0])+(a[:,:,0]-c[:,:,0])*(z-c[:,:,2]))/den
        ok=(u>=-1e-5)&(v>=-1e-5)&(u+v<=1.00001)
        ys=u*a[:,:,1]+v*b[:,:,1]+(1-u-v)*c[:,:,1];pick=np.argmax(ok,axis=1)
        result=ys[np.arange(len(flat)),pick]
        fallback=self.sample(self.h,f)-off*np.tan(self.sample(self.bank,f))+.025
        return np.where(ok.any(1),result,fallback).reshape(shape)

    def margin(self,p):
        f,o=self.project(p)
        return np.where(o>=0,self.sample(self.right,f)-o,self.sample(self.left,f)+o)

def corners(pos,head):
    # Conservative complete MR 26 lower footprint, not just the centre point.
    local=np.array([[-2.85,-.85],[-2.85,.85],[2.85,.85],[2.85,-.85]])
    forward=np.stack((np.cos(head),np.sin(head)),-1);right=np.stack((-np.sin(head),np.cos(head)),-1)
    return pos[...,None,:]+forward[...,None,:]*local[:,0,None]+right[...,None,:]*local[:,1,None]

def separation(a,b):
    # Separating-axis gap between rotated vehicle rectangles. Positive is clear.
    axes=unit(np.concatenate((np.roll(a,-1,axis=1)-a,np.roll(b,-1,axis=1)-b),axis=1))
    axes=axes[:,:,[1,0]]*np.array([-1,1])
    aa=np.einsum('fpi,fai->fap',a,axes);bb=np.einsum('fpi,fai->fap',b,axes)
    return np.maximum(bb.min(2)-aa.max(2),aa.min(2)-bb.max(2)).max(1)

def bake(shot,index,out):
    data=json.loads((ROOT/'upgrade/src/world-tour-data.json').read_text())[shot['id']]
    r=Road(data);n=r.n;total=round(shot['seconds']*FPS);pad=48;count=120+total+pad
    times=np.arange(count)/FPS-2
    # C2 interpolation and a small spatial low-pass remove station-scale kinks.
    line=np.column_stack((data['line']['x'],data['line']['z']))
    softened=gaussian_filter1d(line,1.2,axis=0,mode='wrap')
    delta=np.linalg.norm(softened-line,axis=1).max()
    softened=line+(softened-line)*min(1,.12/max(delta,1e-9))
    spline=CubicSpline(np.arange(n+1),np.vstack((softened,softened[0])),bc_type='periodic')
    speed_curve=CubicSpline(np.arange(n+1),np.r_[data['line']['speed'],data['line']['speed'][0]],bc_type='periodic')
    station=np.empty(count);f=shot['station']*n
    for k in range(count):
        velocity=float(speed_curve(f%n))*.97
        # Integrate against the continuous path derivative, not polygon lengths.
        f+=velocity/FPS/max(.5,np.linalg.norm(spline(f%n,1)));station[k]=f
    t=smoothstep((times+.3)/(shot['seconds']+.6))
    # Some shots show a completed pass; others a defence or a corner-exit chase.
    mode=index%3
    gap=np.array([11.,9.,13.])[mode]+np.array([-22.,-6.,-10.])[mode]*t
    other_gaps=[np.zeros(count),gap,24-5*t,-25+t]
    sign=1 if index%2==0 else -1
    pair=smoothstep((12-np.abs(gap))/7)
    positions=[];heads=[];stations=[]
    for car_id,dist in enumerate(other_gaps):
        f=station+dist/(data['length']/n)
        base=spline(f%n);ff,off=r.project(base)
        # Give both cars space before overlap. Pair centre is bounded by both
        # road edges; this permits an inside/outside line without cutting grass.
        pair_centre=np.clip(off,-r.sample(r.left,ff)+3.45,r.sample(r.right,ff)-3.45)
        if car_id<2:
            lane=pair_centre+sign*(-1.30 if car_id==0 else 1.30)
            wanted=off*(1-pair)+lane*pair
        else:
            wanted=off+(1 if car_id==2 else -1)*.20*np.sin(np.pi*t)
        tangent=unit(spline(f%n,1));normal=np.stack((-tangent[:,1],tangent[:,0]),1)
        xy=base+normal*(wanted-off)[:,None]
        # Future-aware smoothing has no lag and cannot accumulate a corner cut.
        xy=gaussian_filter1d(xy,7.0,axis=0,mode='nearest')
        deriv=np.gradient(xy,1/FPS,axis=0);h=np.unwrap(np.arctan2(deriv[:,1],deriv[:,0]))
        positions.append(xy);heads.append(h);stations.append(f)
    positions=np.stack(positions,1);heads=np.stack(heads,1);stations=np.stack(stations,1)
    speed=np.linalg.norm(np.gradient(positions,1/FPS,axis=0),axis=2)
    acceleration=np.abs(np.gradient(heads,1/FPS,axis=0)*speed)
    pace=min(1,math.sqrt(5.5*9.81/float(acceleration[80:-pad].max())))
    if pace<1:
        # Re-time the physical trajectory, keeping the first visible frame fixed.
        # This bounds cornering loads without interpolating the finished video.
        timeline=120+(np.arange(count)-120)*pace
        positions=CubicSpline(np.arange(count),positions,axis=0)(timeline)
        stations=CubicSpline(np.arange(count),stations,axis=0)(timeline)
        velocity=np.gradient(positions,1/FPS,axis=0)
        heads=np.unwrap(np.arctan2(velocity[:,:,1],velocity[:,:,0]),axis=0)
    footprint=corners(positions,heads);valid=slice(120,120+total)
    margin=float(r.margin(footprint[valid]).min())
    gaps=[float(separation(footprint[valid,i],footprint[valid,j]).min()) for i in range(4) for j in range(i+1,4)]
    assert margin>.15,(shot['id'],'road clearance',margin)
    assert min(gaps)>.15,(shot['id'],'car separation',gaps)
    # Align bodies to measured front/rear and left/right road contact gradients.
    forward=np.stack((np.cos(heads),np.zeros_like(heads),np.sin(heads)),-1)
    right=np.stack((-np.sin(heads),np.zeros_like(heads),np.cos(heads)),-1)
    fy=(r.height(positions+forward[:,:,[0,2]]*1.6)-r.height(positions-forward[:,:,[0,2]]*1.6))/3.2
    ry=(r.height(positions+right[:,:,[0,2]]*.65)-r.height(positions-right[:,:,[0,2]]*.65))/1.3
    forward[:,:,1]=gaussian_filter1d(fy,3,axis=0,mode='nearest');right[:,:,1]=gaussian_filter1d(ry,3,axis=0,mode='nearest')
    forward=unit(forward);up=unit(np.cross(right,forward));right=unit(np.cross(forward,up))
    basis=np.stack((forward,up,right),-1)
    xyz=np.stack((positions[:,:,0],r.height(positions),positions[:,:,1]),-1)
    lower=np.array([[x,.025,z] for x in np.linspace(-2.85,2.85,9) for z in np.linspace(-.806,.806,5)])
    envelope=np.einsum('fcij,pj->fcpi',basis,lower)+xyz[:,:,None,:]
    clear=envelope[:,:,:,1]-r.height(envelope[:,:,:,[0,2]])
    lift=np.maximum(0,.02-clear.min(2))
    # A filtered upper envelope avoids tiny chassis bounces at triangle joins.
    lift=gaussian_filter1d(maximum_filter1d(lift,size=15,axis=0,mode='nearest'),3,axis=0,mode='nearest')
    lift=np.maximum(lift,np.maximum(0,.02-clear.min(2)))
    xyz[:,:,1]+=lift
    assert float(lift[valid].max())<.30,(shot['id'],'excessive chassis correction',lift[valid].max())
    # Gimbal follows a continuous planned path, with no frame-by-frame barrier
    # snap or automatic zoom pumping. Car positions themselves are never lagged.
    h=gaussian_filter1d(heads[:,0],8,mode='nearest');fwd=np.stack((np.cos(h),np.zeros(count),np.sin(h)),1);side=np.stack((-np.sin(h),np.zeros(count),np.cos(h)),1)
    u=smoothstep(np.clip(times/shot['seconds'],0,1));angle=shot['angle']
    if angle==0:back=-8.6+u;lat=-2.7+u*.8;height=1.65+u*.3;lead=2
    elif angle==1:back=9-u*1.2;lat=2.6-u*.9;height=3.1-u*1.3;lead=-.2
    elif angle==2:back=-11+u*2;lat=-3.8+u;height=8-u*4.5;lead=4
    elif angle==3:back=6.8-u*2;lat=-5+u*.6;height=2.15+u*.5;lead=0
    elif angle==4:back=-13+u*4;lat=np.full(count,2);height=12-u*7;lead=3
    else:back=np.full(count,-8.3);lat=2.6-u*5.2;height=np.full(count,1.85);lead=2
    camera=xyz[:,0]+fwd*back[:,None]+side*lat[:,None];camera[:,1]+=height
    for _ in range(8):
        camera=gaussian_filter1d(camera,4,axis=0,mode='nearest')
        f,o=r.project(camera[:,[0,2]]);edge=np.where(o>0,r.sample(r.right,f),r.sample(r.left,f))-1.15
        correction=np.clip(o,-edge,edge)-o
        normal=unit(np.stack((-r.sample(data['tz'],f),r.sample(data['tx'],f)),1))
        camera[:,[0,2]]+=normal*correction[:,None]
        floor=r.height(camera[:,[0,2]])+1.25
        camera[:,1]=np.maximum(camera[:,1],floor)
    focus=xyz[:,0]+fwd*lead+np.array([0,.55,0]);focus=gaussian_filter1d(focus,3,axis=0,mode='nearest')
    camera_velocity=np.gradient(camera,1/FPS,axis=0)
    yaw_velocity=np.diff(heads,axis=0)*FPS
    yaw_accel=np.diff(yaw_velocity,axis=0)*FPS
    speed=np.linalg.norm(np.gradient(positions,1/FPS,axis=0),axis=2)
    lateral_g=np.abs(np.gradient(heads,1/FPS,axis=0)*speed)/9.81
    assert float(lateral_g[valid].max())<5.65,(shot['id'],'cornering load',lateral_g[valid].max())
    report={'circuit':shot['id'],'choreography':['outside pass','defensive side-by-side run','corner-exit chase'][mode],
        'paceFactor':pace,'maximumLateralG':float(lateral_g[valid].max()),
        'minimumRoadMarginM':margin,'minimumCarGapM':min(gaps),'minimumSurfaceClearanceM':float((clear+lift[:,:,None])[valid].min()),
        'maximumSurfaceLiftM':float(lift[valid].max()),'maximumYawStepDegrees':float(np.rad2deg(np.abs(np.diff(heads[valid],axis=0))).max()),
        'yawAccelerationP95Degrees':float(np.percentile(np.rad2deg(np.abs(yaw_accel[120:120+total-2])),95)),
        'maximumCameraStepM':float(np.linalg.norm(np.diff(camera[valid],axis=0),axis=1).max()),
        'source':'Deterministic staged racing choreography; shared continuous paths; actual road triangles; no gameplay AI claim'}
    frames=[]
    for k in range(120+total):
        yaw=np.gradient(heads,1/FPS,axis=0)
        cars=[{'position':xyz[k,j].tolist(),'basis':basis[k,j].T.reshape(-1).tolist(),'heading':float(heads[k,j]),'station':float(stations[k,j]%n),'speed':float(speed[k,j]),'steering':float(math.atan(3.3*yaw[k,j]/max(5,speed[k,j])))} for j in range(4)]
        frames.append({'cars':cars,'camera':camera[k].tolist(),'focus':focus[k].tolist()})
    payload={'fps':FPS,'warmupFrames':120,'frames':frames,'report':report}
    out.mkdir(parents=True,exist_ok=True);(out/(shot['id']+'.json')).write_text(json.dumps(payload,separators=(',',':')))
    return report

def main():
    plan=json.loads((ROOT/'native-desktop/tools/trailer-plan.json').read_text());out=ROOT/'work/mixed-trailer/motion'
    report=[bake(s,i,out) for i,s in enumerate(plan['shots'])]
    (ROOT/'native-desktop/qa/trailer-motion.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))

if __name__=='__main__':main()
