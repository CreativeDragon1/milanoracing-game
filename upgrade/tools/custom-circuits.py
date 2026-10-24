"""Two original circuits using curvature-continuous Euler transitions.
FIA Appendix O 2026 sections 7/10 inform the dimensions. Not homologated venues.
"""
from pathlib import Path
import ast,json
import numpy as np
from scipy.interpolate import PchipInterpolator
from scipy.integrate import quad,cumulative_simpson
from scipy.signal import find_peaks
from scipy.ndimage import gaussian_filter1d
U=Path(__file__).resolve().parents[1];N=1200
tour=json.loads((U/'src/world-tour-data.json').read_text())
# Reuse the geometry functions without executing the existing Milano authoring pass.
tree=ast.parse((U/'tools/redesign-milano.py').read_text())
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ['geometry','finish']],type_ignores=[]),'geometry','exec'))

def build(ident,name,theme,vertices,radii,heights,turn_names):
    V=np.array(vertices,float);R=np.array(radii,float);curves=[]
    for i in range(len(V)):
        incoming=V[i]-V[i-1];incoming/=np.linalg.norm(incoming)
        outgoing=V[(i+1)%len(V)]-V[i];outgoing/=np.linalg.norm(outgoing)
        turn=np.arctan2(np.linalg.det(np.stack([incoming,outgoing])),incoming@outgoing)
        lt=R[i]*abs(turn)*.28;lc=R[i]*abs(turn)*.72;length=2*lt+lc;kap=np.sign(turn)/R[i]
        def theta(s):return np.where(s<lt,.5*kap/lt*s*s,np.where(s<lt+lc,kap*(s-.5*lt),turn-.5*kap/lt*(length-s)**2))
        dx=quad(lambda s:np.cos(theta(s)),0,length,points=[lt,lt+lc])[0];dz=quad(lambda s:np.sin(theta(s)),0,length,points=[lt,lt+lc])[0]
        trim=dz/np.sin(turn);ss=np.linspace(0,length,max(30,int(length/.3)))
        head=theta(ss);local=np.stack([cumulative_simpson(np.cos(head),x=ss,initial=0),cumulative_simpson(np.sin(head),x=ss,initial=0)],axis=1)
        rot=np.array([[incoming[0],-incoming[1]],[incoming[1],incoming[0]]]);start=V[i]-incoming*trim;end=V[i]+outgoing*trim
        pts=start+local@rot.T;error=np.linalg.norm(pts[-1]-end);pts[-1]=end
        curves.append(dict(start=start,end=end,points=pts,trim=trim,turn=turn,transition=lt,error=error))
    dense=[];marks=[];straights=[]
    for i,c in enumerate(curves):
        remain=np.linalg.norm(V[(i+1)%len(V)]-V[i])-c['trim']-curves[(i+1)%len(V)]['trim']
        assert remain>8,(ident,i,remain)
        marks.append(sum(map(len,dense))+len(c['points'])//2);dense.append(c['points'][:-1]);dense.append(np.linspace(c['end'],curves[(i+1)%len(V)]['start'],max(2,int(remain/.3)))[:-1]);straights.append(remain)
    dense=np.concatenate(dense);dense=np.vstack([dense,dense[0]]);s=np.r_[0,np.cumsum(np.linalg.norm(np.diff(dense,axis=0),axis=1))]
    origin=s[np.argmin(np.linalg.norm(dense,axis=1))];stations=(origin+np.arange(N)*s[-1]/N)%s[-1]
    q=np.column_stack([np.interp(stations,s,dense[:,j]) for j in range(2)])
    d=finish(ident,q,16,len(V),name,'Original Milano circuit',theme)
    d['original']=True;d['version']='original-euler-1';d['startName']=name.title()+' pit straight'
    d['turns']=sorted([dict(index=int(round(((s[m]-origin)%s[-1])/s[-1]*N))%N,station=float((s[m]-origin)%s[-1]),radius=float(R[i]),angleDeg=float(np.degrees(c['turn'])),transition=float(c['transition'])) for i,(m,c) in enumerate(zip(marks,curves))],key=lambda t:t['station'])
    for i,t in enumerate(d['turns']):t.update(number=i+1,name=turn_names[i])
    f=np.arange(N)/N;knots=np.linspace(.16,.90,len(heights))
    y=PchipInterpolator(np.r_[0,knots,1],np.r_[heights[0],heights,heights[0]])(f)
    y=heights[0]+(y-heights[0])*min(1,.085/max(abs(np.gradient(y,d['length']/N))))
    ds=d['length']/N;grade=(np.roll(y,-1)-np.roll(y,1))/(2*ds);vc=(np.roll(np.arctan(grade),-1)-np.roll(np.arctan(grade),1))/(2*ds*np.sqrt(1+grade*grade))
    d['elevation']=dict(height=y.tolist(),grade=grade.tolist(),verticalCurvature=vc.tolist(),rangeMetres=float(np.ptp(y)),source='Original engineered profile; flat grid, smooth grade transitions')
    d['bank']=(np.tanh(geometry(q)*150)*np.radians(3)).tolist()
    width=PchipInterpolator([0,.15,.3,.5,.7,.88,1],[17,17,14,15,14,17,17])(f)
    d['widthLeft']=(width/2).tolist();d['widthRight']=(width/2).tolist();d['widthSource']='Original 14–17 m circuit; FIA Appendix O design guidance'
    d['features']['pit']=dict(width=12,side=-1,start=1115,end=65)
    first=d['turns'][0];start_to_turn=first['station']-(abs(first['angleDeg'])*np.pi/180*first['radius']+first['transition'])/2
    grid_grade=max(abs(grade[np.r_[0:40,1175:1200]]))*100
    assert max(straights)<2000 and start_to_turn>250 and grid_grade<=2,(ident,start_to_turn,grid_grade)
    assert width.min()>=12 and d['length']<7000
    report=dict(id=ident,lengthMetres=d['length'],turns=len(V),minimumWidthMetres=float(width.min()),gridWidthMetres=float(width[0]),gridGradePercent=float(grid_grade),maxGradePercent=float(max(abs(grade))*100),longestStraightMetres=float(max(straights)),startToFirstTurnMetres=float(start_to_turn),closureErrorMetres=max(c['error'] for c in curves),reference='https://www.fia.com/system/files/documents/appendix_o_2026_published_23122025.pdf',scope='Fictional game circuit using published dimensional guidance; not FIA certification or a safety-engineered real venue')
    print(json.dumps(report),flush=True);return report

reports=[]
reports.append(build('riviera','MILANO RIVIERA','harbour',[[-450,0],[720,0],[900,330],[670,540],[940,820],[800,1120],[440,1040],[180,1250],[-160,1100],[-400,840],[-190,570],[-510,350]], [100,85,80,50,90,95,65,95,110,60,55,95], [3,18,43,50,20,6,3], ['Porto','Levante','Darsena','Scogliera','Cresta','Riva','Sirena','Belvedere','Vento','Scatto','Faro','Ritorno']))
reports.append(build('solara','MILANO SOLARA','desert',[[-500,0],[800,0],[980,400],[650,590],[1000,820],[950,1200],[500,1380],[190,1120],[-70,1330],[-450,1120],[-480,790],[-100,670],[-390,410],[-650,260]], [100,70,90,45,65,130,140,80,90,150,80,48,65,85], [7,7,28,65,48,22,7], ['Orizzonte','Miraggio','Falco','Lama','Oasi','Sole','Arco','Sabbia','Tempesta','Duna','Fulmine','Vortice','Aurora','Finale']))
(U/'src/world-tour-data.json').write_text(json.dumps(tour,separators=(',',':')))
(U/'qa/custom-circuits.json').write_text(json.dumps(reports,indent=2))
