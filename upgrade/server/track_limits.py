"""Same forgiving excursion rule as the browser, evaluated by the race host."""
import json
from pathlib import Path
RULES=json.loads((Path(__file__).parent/'track-limits.json').read_text())
def fresh():
 return dict(outside=0,distance=0,deep=0,deepDistance=0,recovery=0,violation=False,triggered=False)
def update(state,offset,half_width,speed,dt):
 state=state if state is not None else fresh();state['triggered']=False;dt=max(0,min(dt,.25))
 excess=abs(offset)-half_width;allowance=RULES['kerbAllowance']+RULES['halfTyreTrack']+RULES['edgeTolerance']
 if excess<=RULES['recoveryMargin']:
  state['recovery']+=dt
  if state['recovery']>=RULES['recoverySeconds']:state.update(fresh())
  return state
 state['recovery']=0
 if excess<=allowance:return state
 state['outside']+=dt;state['distance']+=max(0,speed)*dt
 if excess>allowance+RULES['deepExtra']:
  state['deep']+=dt;state['deepDistance']+=max(0,speed)*dt
 if not state['violation'] and (state['outside']>=RULES['graceSeconds'] or state['distance']>=RULES['graceMetres'] or state['deep']>=RULES['deepSeconds'] or state['deepDistance']>=RULES['deepMetres']):
  state['violation']=True;state['triggered']=True
 return state
