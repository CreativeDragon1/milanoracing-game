import importlib.util,math,json,sys
from pathlib import Path
sys.path.insert(0,str(Path('upgrade/server').resolve()))
spec=importlib.util.spec_from_file_location('lan',Path('upgrade/server/race_core.py'));lan=importlib.util.module_from_spec(spec);spec.loader.exec_module(lan)
clock=[1000000.];lan.now=lambda:clock[0];checks=[]
def check(name,condition):
 assert condition,name
 checks.append(name)
def fail(data,text):
 try:lan.action(data)
 except ValueError as e:check(text,text in str(e));return
 raise AssertionError('Expected rejection: '+text)
for circuit in lan.TRACKS:
 lan.ROOMS.clear();lan.TOKENS.clear()
 a=lan.action(dict(action='create',name='Host',circuit=circuit,laps=1));code=a['room']['code'];ta=a['token']
 fail(dict(action='start',token=ta),'At least two drivers')
 b=lan.action(dict(action='join',code=code,name='<b>Guest</b>'));tb=b['token']
 fail(dict(action='start',token=tb),'Only the host')
 for token in [ta,tb]:lan.action(dict(action='ready',token=token,ready=True))
 race=lan.action(dict(action='start',token=ta));clock[0]=race['room']['startAt'];lan.action(dict(action='poll',token=tb))
 fail(dict(action='join',code=code,name='Late'),'This race has started')
 track=lan.TRACKS[circuit];n=len(track['x']);prev=n-3
 for step in range(n+4):
  i=(n-2+step)%n;clock[0]+=max(20,math.hypot(track['x'][i]-track['x'][prev],track['z'][i]-track['z'][prev])/20*1000);prev=i
  lan.action(dict(action='poll',token=tb))
  data=lan.action(dict(action='poll',token=ta,car=dict(x=track['x'][i],z=track['z'][i],h=math.atan2(track['tz'][i],track['tx'][i]),v=20)))
 p=next(p for p in data['room']['players'] if p['id']==a['me'])
 check(circuit+' full lap counted with all checkpoints',p['lap']==1 and p['finish'] is not None and p['penalty']==0)
 check(circuit+' other driver still racing',data['room']['phase']=='race')
 clock[0]+=30100;data=lan.action(dict(action='poll',token=ta));check(circuit+' disconnect closes race',data['room']['phase']=='results')
 data=lan.action(dict(action='rematch',token=ta));check(circuit+' rematch clears timing',data['room']['phase']=='lobby' and all(p['lap']==0 and p['finish'] is None for p in data['room']['players']))
lan.ROOMS.clear();lan.TOKENS.clear()
a=lan.action(dict(action='create',name='Host',circuit='monaco',laps=3));ta=a['token'];b=lan.action(dict(action='join',code=a['room']['code'],name='Guest'));tb=b['token']
for token in [ta,tb]:lan.action(dict(action='ready',token=token,ready=True))
r=lan.action(dict(action='start',token=ta));clock[0]=r['room']['startAt']+100
data=lan.action(dict(action='poll',token=ta,car=dict(x=1e6,z=1e6,h=0,v=85)));p=next(p for p in data['room']['players'] if p['id']==a['me']);check('teleport rejected without lap gain',p['warning']=='POSITION REJECTED' and p['lap']==0)
fail(dict(action='poll',token=ta,car=dict(x=float('nan'),z=0,h=0,v=0)),'Invalid car update')
data=lan.action(dict(action='reset',token=ta));p=next(p for p in data['room']['players'] if p['id']==a['me']);check('reset penalty',p['penalty']==5)
lan.action(dict(action='leave',token=ta));data=lan.action(dict(action='poll',token=tb));check('host leaves, authority transfers',data['room']['host']==b['me'])
check('tokens not disclosed in player snapshots',all('token' not in p for p in data['room']['players']))
lan.ROOMS.clear();lan.TOKENS.clear()
a=lan.action(dict(action='create',name='Host',circuit='monaco',laps=1));tokens=[a['token']]
for i in range(15):tokens.append(lan.action(dict(action='join',code=a['room']['code'],name='Driver '+str(i)))['token'])
fail(dict(action='join',code=a['room']['code'],name='Seventeenth'),'sixteen drivers')
data=lan.action(dict(action='poll',token=tokens[0]));players=data['room']['players'];check('Sixteen-driver lobby capacity',len(players)==16)
check('Starting cars have at least 6 m separation',all(math.hypot(p['x']-q['x'],p['z']-q['z'])>6 for i,p in enumerate(players) for q in players[i+1:]))
for token in tokens:lan.action(dict(action='ready',token=token,ready=True))
check('Sixteen-driver start',lan.action(dict(action='start',token=tokens[0]))['room']['phase']=='count')
Path('upgrade/qa/multiplayer-core.json').write_text(json.dumps({'checks':checks,'passed':len(checks)},indent=2));print('PASS',len(checks),'server checks')

lan.ROOMS.clear();lan.TOKENS.clear()
a=lan.action(dict(action='create',name='Host',circuit='milano',laps=1));ta=a['token'];code=a['room']['code']
for j in range(2000):
 lan.action(dict(action='join',code=code,name='Expired guest'));clock[0]+=61000
 room=lan.ROOMS[code];room['players'][a['me']]['lastSeen']=clock[0];room['touched']=clock[0];lan.reap()
 assert len(lan.TOKENS)==1 and len(room['players'])==1
checks.append('2000 expired guests removed without credential accumulation')
Path('upgrade/qa/multiplayer-core.json').write_text(json.dumps({'checks':checks,'passed':len(checks)},indent=2));print('PASS',len(checks),'checks including expiration')

# Server policy integration: kerbs are valid; only sustained separate excursions
# progress the warning count. Holding one excursion must not stack penalties.
for circuit in lan.TRACKS:
 lan.ROOMS.clear();lan.TOKENS.clear()
 a=lan.action(dict(action='create',name='Host',circuit=circuit,laps=3));ta=a['token']
 b=lan.action(dict(action='join',code=a['room']['code'],name='Guest'));tb=b['token']
 for token in [ta,tb]:lan.action(dict(action='ready',token=token,ready=True))
 r=lan.action(dict(action='start',token=ta));clock[0]=r['room']['startAt']+100
 track=lan.TRACKS[circuit];i=len(track['x'])-3;half=track['widthRight'][i]
 def hold(excess,steps):
  for tick in range(steps):
   clock[0]+=100;offset=half+excess if excess is not None else 0
   lan.action(dict(action='poll',token=tb))
   lan.action(dict(action='poll',token=ta,car=dict(x=track['x'][i]-track['tz'][i]*offset,z=track['z'][i]+track['tx'][i]*offset,h=0,v=0)))
  return lan.ROOMS[a['room']['code']]['players'][a['me']]
 p=hold(2,20);check(circuit+' kerbs have no online penalty',p['penalty']==0 and not p.get('limitWarnings'))
 for excursion in range(4):
  hold(None,10);p=hold(3.2,20)
  check(circuit+' one warning for excursion '+str(excursion+1),p.get('limitWarnings')==excursion+1 and p['penalty']==(5 if excursion==3 else 0))
Path('upgrade/qa/multiplayer-core.json').write_text(json.dumps({'checks':checks,'passed':len(checks)},indent=2));print('PASS',len(checks),'checks including event track limits')
