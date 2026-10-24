"""Fair pit routes and enforce a separate working corridor in the game geometry."""
import numpy as np
from scipy.spatial import cKDTree
from scipy.ndimage import gaussian_filter1d

def project(points, track):
    road=np.column_stack([track['x'],track['z']]); n=len(road)
    _,near=cKDTree(road).query(points)
    indices=(near[:,None]+np.arange(-2,3))%n
    a=road[indices];v=road[(indices+1)%n]-a
    u=np.clip(np.sum((points[:,None,:]-a)*v,axis=2)/np.sum(v*v,axis=2),0,1)
    p=a+u[:,:,None]*v; k=np.argmin(np.sum((points[:,None,:]-p)**2,axis=2),axis=1);rows=np.arange(len(points))
    i=indices[rows,k]; fraction=u[rows,k]; centre=p[rows,k]; tangent=v[rows,k];tangent/=np.linalg.norm(tangent,axis=1)[:,None]
    normal=np.column_stack([-tangent[:,1],tangent[:,0]]);signed=np.sum((points-centre)*normal,axis=1)
    left=np.asarray(track['widthLeft']);right=np.asarray(track['widthRight']); widths=np.where(signed>=0,right[i]*(1-fraction)+right[(i+1)%n]*fraction,left[i]*(1-fraction)+left[(i+1)%n]*fraction)
    return i+fraction,signed,widths,normal

def quintic(a,b,ta,tb,ka,kb,count):
    length=np.linalg.norm(b-a)*1.03
    c0=a;c1=ta*length;c2=ka*length*length/2
    rhs=np.stack([b-c0-c1-c2,tb*length-c1-2*c2,kb*length*length-2*c2])
    c3,c4,c5=np.linalg.solve(np.array([[1,1,1],[3,4,5],[6,12,20]],float),rhs)
    t=np.linspace(0,1,count)[:,None]
    return c0+c1*t+c2*t*t+c3*t**3+c4*t**4+c5*t**5

def fair_pit(path,track,entry,exit,tunnel=False):
    s=np.r_[0,np.cumsum(np.linalg.norm(np.diff(path,axis=0),axis=1))]
    fade=np.clip(np.minimum(s,s[-1]-s)/110,0,1);fade=fade**3*(10-15*fade+6*fade*fade)
    _,signed,_,_=project(path,track);side=1 if np.median(signed[(s>s[-1]*.3)&(s<s[-1]*.65)])>=0 else -1
    # The underground Yas Marina crossing has intentional horizontal overlap.
    for _ in range(35):
        smoothed=gaussian_filter1d(path,5,axis=0,mode='nearest')
        path+=(smoothed-path)*.3*fade[:,None]
        station,signed,edge,normal=project(path,track)
        active=fade.copy()
        if tunnel:
            ramp=np.clip((s[-1]*.62-s)/80,0,1);active*=ramp*ramp*(3-2*ramp)
        deficit=np.maximum(0,edge+5.6-side*signed)*active
        shift=normal*(deficit*side)[:,None]
        shift=gaussian_filter1d(shift,3,axis=0,mode='nearest')
        path+=shift*active[:,None];path[0]=[track['line']['x'][entry],track['line']['z'][entry]];path[-1]=[track['line']['x'][exit],track['line']['z'][exit]]
    # Replace endpoint hooks with C2 joins, then resample at one metre.
    lengths=np.r_[0,np.cumsum(np.linalg.norm(np.diff(path,axis=0),axis=1))]
    a=np.searchsorted(lengths,95);b=np.searchsorted(lengths,lengths[-1]-95)
    def derivatives(points,arc,i):
        v=np.gradient(points,arc,axis=0);v/=np.linalg.norm(v,axis=1)[:,None]
        k=np.gradient(v,arc,axis=0)
        return v[i],k[i]
    line=np.column_stack([track['line']['x'],track['line']['z']]);n=len(line);ds=track['length']/n
    def line_d(i):
        v=line[(i+1)%n]-line[(i-1)%n];v/=np.linalg.norm(v)
        k=(line[(i+1)%n]-2*line[i]+line[(i-1)%n])/(ds*ds)
        return v,k
    va,ka=derivatives(path,lengths,a);vb,kb=derivatives(path,lengths,b);v0,k0=line_d(entry);v1,k1=line_d(exit)
    begin=quintic(line[entry],path[a],v0,va,k0,ka,a+1)
    end=quintic(path[b],line[exit],vb,v1,kb,k1,len(path)-b)
    path=np.vstack([begin[:-1],path[a:b],end]);s=np.r_[0,np.cumsum(np.linalg.norm(np.diff(path,axis=0),axis=1))]
    sample=np.linspace(0,s[-1],int(s[-1])+1)
    return np.column_stack([np.interp(sample,s,path[:,j]) for j in range(2)])
