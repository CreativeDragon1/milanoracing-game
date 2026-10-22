"""Original Euler-spiral circuit and mapped expansions. No venue-certification claim."""
from pathlib import Path
import json,sys
import numpy as np
from scipy.interpolate import CubicSpline,PchipInterpolator
from scipy.ndimage import gaussian_filter1d
from scipy.signal import find_peaks
from scipy.integrate import quad,cumulative_simpson
ROOT=Path(__file__).resolve().parents[2];U=ROOT/'upgrade';tour=json.loads((U/'src/world-tour-data.json').read_text());N=1200
original={k:json.dumps(v,sort_keys=True) for k,v in tour.items() if k!='milano'}
backup=U/'research/milano-before-ridge.json'
if not backup.exists():backup.write_text(json.dumps(tour['milano']))
def geometry(q):
 u=q-np.roll(q,1,axis=0);v=np.roll(q,-1,axis=0)-q
 return 2*(u[:,0]*v[:,1]-u[:,1]*v[:,0])/(np.linalg.norm(u,axis=1)*np.linalg.norm(v,axis=1)*np.linalg.norm(u+v,axis=1))
def finish(ident,q,width,turns,name,subtitle,theme):
 q=q-q[0];dvec=np.roll(q,-1,axis=0)-np.roll(q,1,axis=0);dvec/=np.linalg.norm(dvec,axis=1)[:,None];length=np.linalg.norm(np.roll(q,-1,axis=0)-q,axis=1).sum();k=geometry(q)
 dist=np.linalg.norm(q[:,None]-q[None,:],axis=2);sep=abs(np.arange(N)[:,None]-np.arange(N)[None,:]);dist[np.minimum(sep,N-sep)<60]=1e9
 clear=np.maximum(2,dist.min(axis=1)*.45-width/2-2);base=np.minimum(clear,14+55*np.minimum(1,abs(k)*100))
 # Offset ribbons are clipped on the inside of tight bends to avoid folding.
 radius=1/np.maximum(abs(k),1e-7);left=np.where(k<0,np.minimum(base,np.maximum(2,radius*.72-width/2)),base);right=np.where(k>0,np.minimum(base,np.maximum(2,radius*.72-width/2)),base)
 peaks,_=find_peaks(abs(gaussian_filter1d(k,2,mode='wrap')),distance=25,prominence=.001)
 d=dict(id=ident,name=name,subtitle=subtitle,theme=theme,officialTurns=turns,version='grand-prix-1',width=width,N=N,length=float(length),x=q[:,0].round(6).tolist(),z=q[:,1].round(6).tolist(),tx=dvec[:,0].round(10).tolist(),tz=dvec[:,1].round(10).tolist(),runoffLeft=left.round(4).tolist(),runoffRight=right.round(4).tolist(),turns=[dict(index=int(i),station=float(i*length/N),radius=float(radius[i]),angleDeg=float(np.sign(k[i])*50),transition=16,number=j+1) for j,i in enumerate(peaks)],features={},line=dict(x=q[:,0].tolist(),z=q[:,1].tolist(),offset=[0]*N,curvature=k.tolist(),speed=[50]*N,report={}))
 tour[ident]=d;return d
# A sculpted 15-turn original: long pit straight, uphill sweeps, crossover esses,
# downhill braking and a late-apex final turn. Euler transitions ensure continuous curvature.
V=np.array([[-420,0],[780,0],[730,320],[1020,620],[930,980],[1150,1220],[900,1450],[450,1450],[170,1700],[-220,1520],[-460,1200],[400,930],[250,760],[-40,850],[-300,620],[-560,610],[-760,300]],float)
R=np.array([170,48,90,150,135,80,170,170,150,210,48,48,80,75,145,100,100],float)
V*=.91;R*=.91
curves=[]
for i in range(len(V)):
 incoming=V[i]-V[i-1];incoming/=np.linalg.norm(incoming);outgoing=V[(i+1)%len(V)]-V[i];outgoing/=np.linalg.norm(outgoing)
 turn=np.arctan2(np.linalg.det(np.stack([incoming,outgoing])),incoming@outgoing);lt=R[i]*abs(turn)*.28;lc=R[i]*abs(turn)*.72;length=2*lt+lc;kap=np.sign(turn)/R[i]
 def theta(s):return np.where(s<lt,.5*kap/lt*s*s,np.where(s<lt+lc,kap*(s-.5*lt),turn-.5*kap/lt*(length-s)**2))
 dx=quad(lambda s:np.cos(theta(s)),0,length,points=[lt,lt+lc])[0];dz=quad(lambda s:np.sin(theta(s)),0,length,points=[lt,lt+lc])[0];trim=dz/np.sin(turn)
 ss=np.linspace(0,length,max(30,int(length/.3)));head=theta(ss);local=np.stack([cumulative_simpson(np.cos(head),x=ss,initial=0),cumulative_simpson(np.sin(head),x=ss,initial=0)],axis=1);rot=np.array([[incoming[0],-incoming[1]],[incoming[1],incoming[0]]]);start=V[i]-incoming*trim;end=V[i]+outgoing*trim;pts=start+local@rot.T;error=np.linalg.norm(pts[-1]-end);pts[-1]=end
 curves.append(dict(start=start,end=end,points=pts,trim=trim,turn=turn,transition=lt,error=error))
dense=[];marks=[];straights=[]
for i,c in enumerate(curves):
 remain=np.linalg.norm(V[(i+1)%len(V)]-V[i])-c['trim']-curves[(i+1)%len(V)]['trim'];assert remain>8,(i,remain)
 marks.append(sum(map(len,dense))+len(c['points'])//2);dense.append(c['points'][:-1]);dense.append(np.linspace(c['end'],curves[(i+1)%len(V)]['start'],max(2,int(remain/.3)))[:-1]);straights.append(remain)
dense=np.concatenate(dense);dense=np.vstack([dense,dense[0]]);ss=np.r_[0,np.cumsum(np.linalg.norm(np.diff(dense,axis=0),axis=1))];origin=ss[np.argmin(np.linalg.norm(dense,axis=1))];samples=(origin+np.arange(N)*ss[-1]/N)%ss[-1];q=np.column_stack([np.interp(samples,ss,dense[:,j]) for j in range(2)]);d=finish('milano',q,16,17,'MILANO AUTODROMO','Signature Grand Prix Circuit','alpine')
d['turns']=sorted([dict(index=int(round(((ss[m]-origin)%ss[-1])/ss[-1]*N))%N,station=float((ss[m]-origin)%ss[-1]),radius=float(R[i]),angleDeg=float(np.degrees(curves[i]['turn'])),transition=float(curves[i]['transition'])) for i,m in enumerate(marks)],key=lambda v:v['station'])
for j,t in enumerate(d['turns']):t.update(number=j+1,name=['Ferro','Scatto','Rasoio','Belvedere','Alta','Vertice','Cresta','Lama','Vallone','Tornante','Frenata','Scambio','Arena Uno','Arena Due','Ritorno','Curva Blu','Milano'][j])
f=np.arange(N)/N;knots=[0,.125,.24,.34,.43,.49,.64,.72,.83,.94,1];y=PchipInterpolator(knots,[4,4,32,56,82,78,10,10,27,4,4])(f);y=4+(y-4)*min(1,.095/max(abs(np.gradient(y,d['length']/N))));d['elevation']={'height':y.tolist(),'source':'Original engineered profile with level grid and smooth grade transitions'};d['construction']='Straights / Euler spirals / circular arcs; PCHIP elevation; variable banking';d['bank']= (np.tanh(geometry(q)*170)*np.radians(4.5)).tolist();d['features']['pit']={'width':12,'side':-1,'start':1120,'end':100}
report={'lengthMetres':d['length'],'widthMetres':16,'corners':17,'longestStraightMetres':float(max(straights)),'startToFirstCornerMetres':float(d['turns'][0]['station']-(abs(d['turns'][0]['angleDeg'])*np.pi/180*d['turns'][0]['radius']+d['turns'][0]['transition'])/2),'integrationClosureErrorMetres':float(max(c['error'] for c in curves)),'reference':'FIA Appendix O 2026 sections 7 and 10; design guidance for a fictional game circuit, not FIA homologation.'}
print('GEOMETRY',d['length'],report,flush=True)
assert d['length']<7000 and report['longestStraightMetres']<2000 and report['startToFirstCornerMetres']>250
for ident,d in tour.items():
 if ident!='milano':continue
 y=np.array(d['elevation']['height']);ds=d['length']/N;grade=(np.roll(y,-1)-np.roll(y,1))/(2*ds);vert=(np.roll(np.arctan(grade),-1)-np.roll(np.arctan(grade),1))/(2*ds*np.sqrt(1+grade*grade));d['elevation'].update(grade=grade.round(9).tolist(),verticalCurvature=vert.round(11).tolist(),rangeMetres=float(np.ptp(y)));d.setdefault('bank',[0.]*N);d['version']='milano-ridge-2'
d=tour['milano'];width=PchipInterpolator([0,.15,.23,.37,.50,.58,.65,.73,.85,.94,1],[18,18,15,14,14,16,18,14,15,18,18])(f);d['widthLeft']=(width/2).round(5).tolist();d['widthRight']=(width/2).round(5).tolist();d['widthSource']='Original variable-width design, 14-18 m; FIA Appendix O 7.3 design guidance';d['subtitle']='The Ridge Circuit';d['startName']='Milano pit straight'
assert all(json.dumps(tour[k],sort_keys=True)==v for k,v in original.items())
report['minWidthMetres']=float(min(width));report['maxWidthMetres']=float(max(width));report['maxWidthChangePer20m']=float(max(abs(np.gradient(width,d['length']/N)))*20)
report['elevationRangeMetres']=tour['milano']['elevation']['rangeMetres'];report['maxGradePercent']=float(max(abs(np.array(tour['milano']['elevation']['grade'])))*100);report['gridGradePercent']=float(max(abs(np.array(tour['milano']['elevation']['grade'])[np.r_[0:50,1170:1200]]))*100);assert report['gridGradePercent']<=2
(U/'qa/circuit-design.json').write_text(json.dumps(report,indent=2));(U/'src/world-tour-data.json').write_text(json.dumps(tour,separators=(',',':')));print(json.dumps(report),flush=True)
import matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
fig,ax=plt.subplots(figsize=(13,9),facecolor='#080c16');ax.set_facecolor('#080c16');d=tour['milano'];ax.plot(d['x'],d['z'],color='#fff',lw=8);ax.plot(d['x'],d['z'],color='#ff7a00',lw=3)
for t in d['turns']:i=t['index'];ax.text(d['x'][i]+25,d['z'][i],str(t['number'])+' '+t['name'],color='white',fontsize=8)
ax.scatter([0],[0],c='#0019ff',s=100);ax.set_aspect('equal');ax.invert_yaxis();ax.axis('off');ax.set_title('MILANO AUTODROMO   '+str(round(d['length']/1000,3))+' KM',color='white');fig.tight_layout();fig.savefig(U/'qa/milano-design.png',dpi=150)
