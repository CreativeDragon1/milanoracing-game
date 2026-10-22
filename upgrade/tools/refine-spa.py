from pathlib import Path
import json,numpy as np
from scipy.optimize import minimize
from scipy.interpolate import CubicSpline
R=Path.cwd();U=R/'upgrade'
code=(U/'tools/optimize-lines.py').read_text(encoding='utf-8');code=code[:code.index('for ident,d in tour.items():')].replace('cache=True','cache=False');exec(compile(code,str(U/'tools/optimize-lines.py'),'exec'))
d=tour['spa'];q=np.array([d['x'],d['z']]).T;normal=np.array([-np.array(d['tz']),d['tx']]).T;original=np.array(d['line']['offset']);y=np.array(d['elevation']['height']);bank=np.array(d['bank']);nodes=np.arange(22,67,2);active=np.arange(22,67);B=CubicSpline(nodes,np.eye(len(nodes)),axis=0,bc_type='clamped')(active)
bound=d['width']/2-1.55
base=original.copy();weights=np.zeros((len(q),len(nodes)));weights[active]=B
# End knots stay fixed and the apex is inside, leaving the optimizer free elsewhere.
start=original[nodes];start+=np.sin(np.linspace(0,np.pi,len(nodes)))**2*9.3;start=np.clip(start,-bound,bound)
def evaluation(c):
 off=base.copy();off[active]=B@c;pp=q+normal*off[:,None];k,ds=geometry(pp);lap,v=profile(k,ds,y-off*np.tan(bank),bank);return lap,v,pp,off,k,ds
def objective(c):
 lap,v,pp,off,k,ds=evaluation(c);return lap+.002*np.sum(np.diff(c,n=2)**2)+100*np.sum(np.maximum(abs(off)-bound,0)**2)
constraints=[{'type':'ineq','fun':lambda c:irow@c-3.7} for irow in [weights[42].copy()]]
res=minimize(objective,start,method='SLSQP',bounds=[(original[nodes[i]],original[nodes[i]]) if i in [0,len(nodes)-1] else (-bound,bound) for i in range(len(nodes))],constraints=constraints,options={'maxiter':90,'ftol':1e-7,'eps':.008})
lap,v,pp,off,k,ds=evaluation(res.x);assert off[42]>3.69 and abs(off).max()<bound+.025
d['line'].update(x=pp[:,0].tolist(),z=pp[:,1].tolist(),offset=off.tolist(),curvature=k.tolist(),speed=v.tolist(),ds=ds.tolist());d['line']['report'].update(optimizedTime=lap,apexRefinement={'corner':'La Source','insideOffset':float(off[42]),'converged':bool(res.success),'message':str(res.message),'lapSeconds':float(lap)})
(U/'src/world-tour-data.json').write_text(json.dumps(tour,separators=(',',':')));print(d['line']['report']['apexRefinement'])
