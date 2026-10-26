"""Milano Racing local-network lobby and race coordinator. Python 3.10+.
The host owns countdown, checkpoints, timing and classification. Clients simulate cars.
"""
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit
import argparse,json,secrets,time,math,socket,ssl,threading,ipaddress,webbrowser,sys
from datetime import datetime,timedelta,timezone
import track_limits

ROOT=Path(__file__).resolve().parent
HTML=ROOT/'Milano Racing - Team Edition.html'
TRACKS=json.loads((ROOT/'Multiplayer Circuits.json').read_text(encoding='utf-8'))
ROOMS={};TOKENS={};LOCK=threading.RLock()
COLORS=['#ff883e','#56d9f3','#af89ff','#f4d44b','#7be9a6','#fa78bd','#efefef','#eb665d','#c4f45c','#fda5df','#77afff','#f9c792','#d0caee','#66d0ba','#d8e8fa','#ffb400']
def now():return time.time()*1000
def clean_name(value):
 value=str(value or '').strip()[:18]
 return ''.join(c for c in value if c.isprintable()) or 'Driver'
def project(track,x,z,hint):
 n=len(track['x']);best=(1e30,0,0)
 for d in range(-45,46):
  i=(hint+d)%n;j=(i+1)%n;a,b=track['x'][i],track['z'][i];dx,dz=track['x'][j]-a,track['z'][j]-b
  t=max(0,min(1,((x-a)*dx+(z-b)*dz)/max(1e-9,dx*dx+dz*dz)));dist=(x-a-t*dx)**2+(z-b-t*dz)**2
  if dist<best[0]:best=(dist,i,t)
 return (best[1]+best[2])%n,math.sqrt(best[0])
def make_player(name,slot,track):
 n=len(track['x']);i=(n-3-slot*3)%n
 return dict(id=secrets.token_hex(5),name=clean_name(name),slot=slot,color=COLORS[slot],ready=False,lastSeen=now(),sampleAt=now(),x=track['x'][i],z=track['z'][i],h=math.atan2(track['tz'][i],track['tx'][i]),v=0,index=float(i),lap=0,gate=1,armed=False,invalid=False,penalty=0,best=None,lastLapAt=0,finish=None,dnf=False,progress=0,warning='')
def reset_player(p,track):
 fresh=make_player(p['name'],p['slot'],track)
 for k in ['id','name','color','slot','lastSeen']:fresh[k]=p[k]
 p.clear();p.update(fresh)
def reap():
 t=now()
 for code,r in list(ROOMS.items()):
  for pid,p in list(r['players'].items()):
   if t-p['lastSeen']>30000 and r['phase'] in ['count','race']:p['dnf']=True;p['v']=0
   if t-p['lastSeen']>60000 and r['phase']=='lobby':del r['players'][pid]
  if not r['players'] or t-r['touched']>3600000:
   del ROOMS[code]
   for token,entry in list(TOKENS.items()):
    if entry[0]==code:del TOKENS[token]
   continue
  if r['host'] not in r['players'] or r['players'][r['host']]['dnf']:
   live=[p for p in r['players'].values() if not p['dnf']]
   if live:r['host']=live[0]['id']
  if r['phase']=='count' and t>=r['startAt']:r['phase']='race'
  if r['phase']=='race':
   finishers=[p['finish'] for p in r['players'].values() if p['finish'] is not None]
   # Everyone gets two minutes after the first finisher, then the race closes.
   deadline=r['startAt']+min(finishers)+120000 if finishers else r['startAt']+1800000
   if t>deadline:
    for p in r['players'].values():
     if p['finish'] is None:p['dnf']=True
   if all(p['finish'] is not None or p['dnf'] for p in r['players'].values()):r['phase']='results'
 # Remove credentials for departed/expired drivers even while their room remains active.
 for token,(code,pid) in list(TOKENS.items()):
  if code not in ROOMS or pid not in ROOMS[code]['players']:del TOKENS[token]
def snapshot(r,me):
 public=[]
 for p in r['players'].values():
  public.append({k:p[k] for k in ['id','name','slot','color','ready','x','z','h','v','lap','invalid','penalty','best','finish','dnf','progress','warning']})
 public.sort(key=lambda p:(p['dnf'],p['finish'] is None,(p['finish'] or 0)+p['penalty']*1000 if p['finish'] is not None else -p['progress']))
 return dict(serverNow=now(),me=me,room=dict(code=r['code'],host=r['host'],circuit=r['circuit'],laps=r['laps'],phase=r['phase'],startAt=r['startAt'],epoch=r['epoch'],players=public))
def action(data):
 with LOCK:
  reap();a=data.get('action');t=now()
  if a=='list':
   return {'rooms':[dict(code=r['code'],circuit=r['circuit'],laps=r['laps'],players=len(r['players']),maxPlayers=16) for r in ROOMS.values() if r.get('listed') and r['phase']=='lobby' and len(r['players'])<16][:32]}
  if a in ['create','join']:
   if a=='create':
    circuit=data.get('circuit');laps=data.get('laps',3)
    if circuit not in TRACKS or laps not in [1,3,5]:raise ValueError('Choose a circuit and race distance.')
    if len(ROOMS)>=32:raise ValueError('Server is full. Close an unused room first.')
    code=''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(6))
    while code in ROOMS:code=''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(6))
    r=dict(code=code,host=None,circuit=circuit,laps=laps,listed=bool(data.get('listed',False)),phase='lobby',startAt=0,epoch=0,players={},touched=t);ROOMS[code]=r
   else:
    r=ROOMS.get(str(data.get('code','')).strip().upper())
    if not r:raise ValueError('Room not found. Check the code and host address.')
    if r['phase']!='lobby':raise ValueError('This race has started. Join when the lobby reopens.')
   if len(r['players'])>=16:raise ValueError('This room already has sixteen drivers.')
   slots={p['slot'] for p in r['players'].values()};slot=next(i for i in range(16) if i not in slots)
   p=make_player(data.get('name'),slot,TRACKS[r['circuit']]);r['players'][p['id']]=p
   if r['host'] is None:r['host']=p['id']
   token=secrets.token_urlsafe(24);TOKENS[token]=(r['code'],p['id']);r['touched']=t
   return dict(**snapshot(r,p['id']),token=token)
  entry=TOKENS.get(str(data.get('token','')))
  if not entry:raise ValueError('Your session has expired. Join the room again.')
  code,pid=entry;r=ROOMS.get(code)
  if not r or pid not in r['players']:raise ValueError('The room has closed. Join a new room.')
  p=r['players'][pid];previous_seen=p['lastSeen'];p['lastSeen']=t;r['touched']=t;track=TRACKS[r['circuit']]
  if a=='leave':
   if r['phase']=='lobby':del r['players'][pid]
   else:p['dnf']=True
   del TOKENS[data['token']];reap();return {'left':True}
  if a=='ready':
   if r['phase']!='lobby':raise ValueError('Readiness can only change in the lobby.')
   p['ready']=bool(data.get('ready'))
  elif a=='start':
   if pid!=r['host']:raise ValueError('Only the host can start this race.')
   if r['phase']!='lobby':raise ValueError('A race is already running.')
   if len(r['players'])<2 or not all(q['ready'] for q in r['players'].values()):raise ValueError('At least two drivers must join, and everyone must be ready.')
   for q in r['players'].values():reset_player(q,track)
   r['epoch']+=1;r['phase']='count';r['startAt']=t+6000
  elif a=='rematch':
   if pid!=r['host'] or r['phase']!='results':raise ValueError('The host can return to the lobby when the race ends.')
   r['players']={i:q for i,q in r['players'].items() if t-q['lastSeen']<30000}
   for q in r['players'].values():reset_player(q,track)
   r['phase']='lobby';r['startAt']=0
  elif a=='reset':
   if r['phase']!='race' or p['finish'] is not None or p['dnf']:raise ValueError('Reset is unavailable.')
   p['invalid']=True;p['penalty']+=5;p['warning']='RESET +5 SEC';p['v']=0
   i=int(p['index'])%len(track['x']);p['x']=track['x'][i];p['z']=track['z'][i];p['h']=math.atan2(track['tz'][i],track['tx'][i])
  elif a not in ['poll','resume']:raise ValueError('Unknown action.')
  if a=='poll' and r['phase']=='race' and p['finish'] is None and not p['dnf'] and isinstance(data.get('car'),dict):
   q=data['car'];vals=[q.get(k) for k in ['x','z','h','v']]
   if not all(isinstance(v,(int,float)) and math.isfinite(v) for v in vals):raise ValueError('Invalid car update.')
   x,z,h,v=vals;dt=min(1.5,max(.01,(t-p['sampleAt'])/1000));n=len(track['x'])
   if not -8<=v<=105 or math.hypot(x-p['x'],z-p['z'])>105*dt+10:
    p['warning']='POSITION REJECTED';return snapshot(r,pid)
   index,off=project(track,x,z,int(p['index']));delta=(index-p['index']+n/2)%n-n/2
   if abs(delta)*track['length']/n>105*dt+15:
    p['warning']='CHECKPOINT REJECTED';return snapshot(r,pid)
   if p['warning'] in ['POSITION REJECTED','CHECKPOINT REJECTED']:p['warning']=''
   old_index=p['index'];p.update(x=x,z=z,h=h,v=v,index=index,sampleAt=t)
   idx=int(index)%n;side=(z-track['z'][idx])*track['tx'][idx]-(x-track['x'][idx])*track['tz'][idx];widths=track.get('widthRight' if side>=0 else 'widthLeft');half=widths[idx] if widths else track['width']/2
   p['limitState']=track_limits.update(p.get('limitState'),off,half,v,dt)
   if p['limitState']['triggered']:
    p['limitWarnings']=p.get('limitWarnings',0)+1;p['invalid']=True
    if p['limitWarnings']%track_limits.RULES['warningsPerPenalty']==0:
     p['penalty']+=track_limits.RULES['penaltySeconds'];p['warning']='TRACK LIMITS +5 SEC'
    else:p['warning']='TRACK LIMITS WARNING '+str(p['limitWarnings']%track_limits.RULES['warningsPerPenalty'])
   # Sequential checkpoint checks continue during an excursion; an invalid lap
   # must not strand a beginner with a missing checkpoint after rejoining.
   gate=int(index/n*16);oldgate=int(old_index/n*16)
   if delta>0 and oldgate==15 and gate==0:
    if not p['armed']:p['armed']=True;p['lastLapAt']=t;p['gate']=1
    elif p['gate']==16:
     lap=t-p['lastLapAt'];p['lap']+=1
     if not p['invalid']:p['best']=min(p['best'] or lap,lap)
     p['lastLapAt']=t;p['gate']=1;p['invalid']=p['limitState']['violation'];p['warning']=''
     if p['lap']>=r['laps']:p['finish']=t-r['startAt'];p['v']=0
   if p['armed'] and delta>0 and gate==p['gate']:p['gate']+=1
   p['progress']=p['lap']+(min(index/n,(p['gate'])/16) if p['armed'] else -.01)
  reap();return snapshot(r,pid)

