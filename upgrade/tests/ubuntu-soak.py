"""Linux HTTP integration + bounded load/cleanup regression. Run in Ubuntu venv."""
import asyncio,sys,os,time,json,subprocess,re,statistics
from pathlib import Path
import aiohttp
ROOT=Path(__file__).resolve().parents[2]
DEPLOY=ROOT/'upgrade/server'
sys.path.insert(0,str(DEPLOY))
import race_core as core

async def main():
 port='8895';base='http://127.0.0.1:'+port;checks=[]
 env={**os.environ,'PORT':port,'PUBLIC_ORIGIN':'https://game.milanoracing.team','TRUST_CLOUDFLARE':'1','PRIVATE_SITE':'0'}
 proc=subprocess.Popen([sys.executable,str(DEPLOY/'milano_server.py')],env=env,stdout=subprocess.DEVNULL,stderr=open(ROOT/'upgrade/qa/ubuntu-soak.log','w'))
 try:
  async with aiohttp.ClientSession() as session:
   for i in range(80):
    try:
     async with session.get(base+'/healthz') as r:
      if r.status==200:break
    except aiohttp.ClientError:pass
    await asyncio.sleep(.1)
   else:raise AssertionError('Server did not start')
   async def post(data,**kwargs):
    async with session.post(base+'/api/race',json=data,**kwargs) as r:return r.status,await r.json()
   async with session.get(base+'/') as r:
    html=await r.text();assert r.status==200 and len(html)<60000 and r.headers['Cache-Control']=='no-cache';checks.append('Small hosted index and cache revalidation')
   asset=re.search(r'<script src="([^"]+)',html)[1]
   async with session.get(base+asset,headers={'Accept-Encoding':'gzip'}) as r:
    etag=r.headers['ETag'];assert r.headers['Content-Encoding']=='gzip' and 'immutable' in r.headers['Cache-Control'];await r.read();checks.append('Precompressed immutable hashed assets')
   async with session.get(base+asset,headers={'If-None-Match':etag,'Accept-Encoding':'gzip'}) as r:assert r.status==304;checks.append('Asset 304 revalidation')
   async with session.get(base+'/api/info') as r:
    d=await r.json();assert d['addresses']==['https://game.milanoracing.team/'] and r.headers['Cache-Control']=='no-store';checks.append('Public invite address and private API cache policy')
   status,d=await post({'action':'create','circuit':'bahrain','laps':1},headers={'Origin':'https://attacker.invalid'});assert status==403;checks.append('Foreign origin refused')
   for data in [[],{'action':'create','circuit':[]}, {'token':{}}, {'action':'create','circuit':'bahrain','laps':1,'name':'x'*5000}]:
    async with session.post(base+'/api/race',json=data) as r:assert r.status in (400,413)
   checks.append('Malformed and oversized requests rejected')
   status,d=await post({'action':'create','circuit':'bahrain','laps':1,'name':'Driver 1'});assert status==200
   tokens=[d['token']];code=d['room']['code'];cars={d['token']:{k:d['room']['players'][0][k] for k in ('x','z','h','v')}}
   for j in range(15):
    status,d=await post({'action':'join','code':code,'name':f'Driver {j+2}'});assert status==200;tokens.append(d['token']);p=next(p for p in d['room']['players'] if p['id']==d['me']);cars[d['token']]={k:p[k] for k in ('x','z','h','v')}
   for token in tokens:assert (await post({'action':'ready','token':token,'ready':True}))[0]==200
   assert (await post({'action':'start','token':tokens[0]}))[0]==200
   checks.append('Sixteen-player lobby, ready and countdown')
   rss=[];latencies=[];requests=0;start=time.monotonic();duration=int(os.getenv('SOAK_SECONDS','300'))
   def process_stats():
    stat=Path(f'/proc/{proc.pid}/stat').read_text().split();return (int(stat[13])+int(stat[14]))/os.sysconf('SC_CLK_TCK')
   cpu_start=process_stats()
   async def poll(token):
    nonlocal requests
    t=time.monotonic();status,d=await post({'action':'poll','token':token,'car':cars[token]});assert status==200;assert len(d['room']['players'])==16
    latencies.append((time.monotonic()-t)*1000);requests+=1
   while time.monotonic()-start<duration:
    tick=time.monotonic();await asyncio.gather(*(poll(token) for token in tokens))
    status=Path(f'/proc/{proc.pid}/status').read_text();rss.append(int(re.search(r'VmRSS:\s+(\d+)',status)[1]))
    await asyncio.sleep(max(0,.1-(time.monotonic()-tick)))
   elapsed=time.monotonic()-start;cpu=process_stats()-cpu_start
   checks.append('Sixteen clients at 10 updates per second each, bounded load run')
   codes=[]
   for i in range(60):
    async with session.post(base+'/api/race',json={'action':'create','circuit':'bahrain','laps':1},headers={'CF-Connecting-IP':'192.0.2.123'}) as r:codes.append(r.status);await r.read()
   assert 429 in codes;checks.append('Creation flood rate-limited')
   async with session.get(base+'/healthz') as r:assert r.status==200;checks.append('Healthy after rate limit')
  # Repeated expired guests in one live room used to leak session credentials.
  core.ROOMS.clear();core.TOKENS.clear();clock=[100000.];core.now=lambda:clock[0]
  host=core.action({'action':'create','circuit':'bahrain','laps':1})
  for j in range(2000):
   core.action({'action':'join','code':host['room']['code']});clock[0]+=61000
   room=core.ROOMS[host['room']['code']];room['players'][host['me']]['lastSeen']=clock[0];room['touched']=clock[0];core.reap()
   assert len(core.TOKENS)==1 and len(room['players'])==1
  checks.append('2,000 expired guest sessions removed without token growth')
  report=dict(platform=sys.platform,python=sys.version.split()[0],aiohttp=aiohttp.__version__,checks=checks,soakSeconds=elapsed,requests=requests,players=16,pollHzPerPlayer=10,latencyP50ms=statistics.median(latencies),latencyP95ms=sorted(latencies)[int(.95*len(latencies))],serverCPUPercentOneCore=100*cpu/elapsed,rssStartMiB=rss[0]/1024,rssEndMiB=rss[-1]/1024,rssMaxMiB=max(rss)/1024,limits='Local Ubuntu 24.04 WSL test, not a 24-hour soak, production server benchmark or real Cloudflare route test.')
  (ROOT/'upgrade/qa/ubuntu-soak.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
 finally:
  proc.terminate()
  try:proc.wait(timeout=15)
  except subprocess.TimeoutExpired:proc.kill();proc.wait()
asyncio.run(main())
