"""Numerical clearance review for scripted in-game trailer routes."""
import math

def sample(values, station):
    f=station%len(values);i=int(f);t=f-i
    return values[i]*(1-t)+values[(i+1)%len(values)]*t

def pose(track, station):
    offset=sample(track['line']['offset'],station)
    return (sample(track['x'],station)-sample(track['tz'],station)*offset,
            sample(track['z'],station)+sample(track['tx'],station)*offset)

def clearance(track,x,z,heading,station):
    n=track['N'];minimum=math.inf
    for forward in [-2.85,2.85]:
        for side in [-.85,.85]:
            px=x+math.cos(heading)*forward-math.sin(heading)*side
            pz=z+math.sin(heading)*forward+math.cos(heading)*side
            best=(math.inf,0,0)
            for k in range(int(station)-8,int(station)+9):
                i=k%n;j=(i+1)%n;dx=track['x'][j]-track['x'][i];dz=track['z'][j]-track['z'][i]
                t=max(0,min(1,((px-track['x'][i])*dx+(pz-track['z'][i])*dz)/(dx*dx+dz*dz)))
                qx=track['x'][i]+t*dx;qz=track['z'][i]+t*dz
                distance=math.hypot(px-qx,pz-qz)
                offset=(px-qx)*-track['tz'][i]+(pz-qz)*track['tx'][i]
                if distance<best[0]:best=(distance,i,offset)
            distance,i,offset=best
            minimum=min(minimum,track['widthRight' if offset>=0 else 'widthLeft'][i]-distance)
    return minimum

def preflight(track,fraction):
    n=track['N'];length=track['length'];progress=fraction*length;minimum=math.inf
    for tick in range(426):
        station=progress/length*n
        speed=sample(track['line']['speed'],station)*.97
        progress+=speed/60*(length/n)/max(.5,sample(track['line']['ds'],station))
        if tick<120 or tick%6:continue
        for gap in [0,20,38,56]:
            station=(progress+gap)/length*n;x,z=pose(track,station);ax,az=pose(track,station+1)
            minimum=min(minimum,clearance(track,x,z,math.atan2(az-z,ax-x),station))
    return minimum
