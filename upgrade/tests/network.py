import asyncio,json,sys,os,time,statistics,secrets
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'server'))
os.environ['PRIVATE_SITE']='0';os.environ['PUBLIC_ORIGIN']='';os.environ['BIND']='127.0.0.1'
from aiohttp import web,ClientSession,ClientWSTimeout,WSServerHandshakeError,CookieJar
import milano_server as server
from private_access import make_hash
checks=[]
def check(ok,name):
 assert ok,name
 checks.append(name)
async def host():
 runner=web.AppRunner(server.create_app(),access_log=None);await runner.setup();site=web.TCPSite(runner,'127.0.0.1',0);await site.start();return runner,'http://127.0.0.1:'+str(site._server.sockets[0].getsockname()[1])
async def main():
 runner,base=await host();sockets=[];tokens=[];rids={};times=[]
 async with ClientSession() as client:
  async def openws():
   w=await client.ws_connect(base+'/api/ws',origin=base,timeout=ClientWSTimeout(ws_receive=6));sockets.append(w);rids[id(w)]=0;return w
  async def req(w,action,**data):
   rids[id(w)]+=1;rid=rids[id(w)];t=time.perf_counter();await w.send_json({'rid':rid,'action':action,**data});r=await w.receive_json();times.append((time.perf_counter()-t)*1000);check(r.get('rid')==rid,'request correlation') if len(times)==1 else None;return r
  try:
   await client.ws_connect(base+'/api/ws',origin='https://evil.example')
   raise AssertionError('bad origin allowed')
  except WSServerHandshakeError as e:check(e.status==403,'cross-origin WebSocket rejected')
  a=await openws();data=await req(a,'create',circuit='milano',laps=1,name='Host',listed=True);code=data['result']['room']['code'];tokens.append(data['result']['token'])
  for i in range(1,16):
   w=await openws();r=await req(w,'join',code=code,name='Driver '+str(i));tokens.append(r['result']['token'])
  check(len(r['result']['room']['players'])==16,'sixteen clients share one room')
  extra=await openws();full=await req(extra,'join',code=code,name='Overflow');check('sixteen' in full.get('error',''),'seventeenth player rejected')
  private=await req(extra,'create',circuit='monza',laps=1,name='Private');private_token=private['result']['token'];private_code=private['result']['room']['code']
  listing=await req(extra,'list',token=private_token);check(all(r['code']!=private_code for r in listing['result']['rooms']),'unlisted room absent from browser')
  owner=await req(sockets[1],'start',token=tokens[1]);check('host' in owner.get('error',''),'non-host cannot start')
  notready=await req(a,'start',token=tokens[0]);check('ready' in notready.get('error',''),'unready grid cannot start')
  for w,token in zip(sockets[:16],tokens):await req(w,'ready',token=token,ready=True)
  start=await req(a,'start',token=tokens[0]);check(start['result']['room']['phase']=='count','synchronized server countdown')
  bad=await req(a,'poll',token=tokens[1]);check('match' in bad.get('error',''),'WebSocket identity binding')
  await a.send_str('{broken');bad=await a.receive_json();check('error' in bad,'malformed JSON handled')
  await a.send_str('{"rid":9999,"action":"poll","token":"'+tokens[0]+'","car":{"x":NaN}}');bad=await a.receive_json();check('number' in bad.get('error',''),'nonfinite JSON rejected')
  await asyncio.sleep(6.1)
  race=await req(a,'poll',token=tokens[0]);check(race['result']['room']['phase']=='race','countdown enters race')
  reject=await req(a,'poll',token=tokens[0],car={'x':1e7,'z':1e7,'h':0,'v':100});check(next(p for p in reject['result']['room']['players'] if p['id']==reject['result']['me'])['warning']=='POSITION REJECTED','teleport protection')
  me=next(p for p in race['result']['room']['players'] if p['id']==race['result']['me'])
  reverse=await req(a,'poll',token=tokens[0],car={'x':me['x'],'z':me['z'],'h':me['h'],'v':-4})
  me=next(p for p in reverse['result']['room']['players'] if p['id']==reverse['result']['me']);check(me['v']==-4 and me['warning']!='POSITION REJECTED','bounded reverse accepted online')
  reverse=await req(a,'poll',token=tokens[0],car={'x':me['x'],'z':me['z'],'h':me['h'],'v':-9})
  me=next(p for p in reverse['result']['room']['players'] if p['id']==reverse['result']['me']);check(me['v']==-4 and me['warning']=='POSITION REJECTED','excessive reverse speed rejected')
  await sockets[2].close();replacement=await openws();sockets[2]=replacement
  resumed=await req(replacement,'resume',token=tokens[2]);check(len(resumed['result']['room']['players'])==16,'connection resumes existing driver')
  started=time.perf_counter();count=0
  while time.perf_counter()-started<20:
   results=await asyncio.gather(*(req(w,'poll',token=token) for w,token in zip(sockets[:16],tokens)));assert all('result' in r for r in results);count+=16;await asyncio.sleep(.05)
  check(count>=3000,'sustained sixteen-driver 20 Hz traffic')
  response=await client.post(base+'/api/race',json={'action':'poll','token':tokens[0]},headers={'Origin':base});check(response.status==200,'REST fallback')
  response=await client.post(base+'/api/race',json={'action':'list'},headers={'Origin':'https://evil.example'});check(response.status==403,'cross-origin REST rejected')
  response=await client.get(base+'/downloads/unknown.zip');check(response.status==404,'download allowlist')
  response=await client.get(base+'/sw.js');check(response.status==200 and 'javascript' in response.headers.get('Content-Type',''),'service worker delivered')
  await asyncio.gather(*(w.close() for w in sockets));await runner.cleanup()
  check(not server.create_app()['sockets'],'new server has no retained sockets')
 # Private-by-default routes, cookies and preservation of invitations.
 server.limiter.entries.clear();os.environ['PRIVATE_SITE']='1';os.environ['SITE_PASSWORD_HASH']=make_hash('temporary-test-password');os.environ['SESSION_SECRET']=secrets.token_hex(32)
 private,base=await host()
 async with ClientSession(cookie_jar=CookieJar(unsafe=True)) as client:
  r=await client.get(base+'/?room=ABC123&multiplayer=1');html=await r.text();check('Private testing.' in html and 'room=ABC123' in html,'private login preserves invitation')
  for path in ['/api/info','/api/ws','/assets/example.js','/downloads/Milano-Racing-Windows.zip','/downloads/Milano-Racing-Native-Windows.zip','/sw.js']:
   r=await client.get(base+path);check(r.status==401,'private protection '+path)
  r=await client.post(base+'/login',data={'password':'wrong'},headers={'Origin':base});check(r.status==401,'wrong password denied')
  r=await client.post(base+'/login',data={'password':'temporary-test-password','next':'/?room=ABC123&multiplayer=1'},headers={'Origin':base},allow_redirects=False);check(r.status==303 and r.headers['Location']=='/?room=ABC123&multiplayer=1','successful login retains room')
  cookie=r.cookies['milano_access'];check(cookie['httponly'] and cookie['samesite']=='Strict','session cookie flags')
  r=await client.get(base+'/');check(r.status==200 and 'no-store' in r.headers['Cache-Control'],'authenticated game is not publicly cached')
  r=await client.ws_connect(base+'/api/ws',origin=base);await r.close();checks.append('authenticated WebSocket opens')
 await private.cleanup()
 report={'checks':checks,'updates':count,'durationSeconds':20,'medianResponseMs':statistics.median(times),'p95ResponseMs':sorted(times)[int(len(times)*.95)],'platform':sys.platform,'python':sys.version.split()[0]}
 target=ROOT/'qa'/('network-'+sys.platform+'.json');target.write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report,indent=2))
asyncio.run(main())
