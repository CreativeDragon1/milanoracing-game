"""Single-process asyncio host. TLS is terminated by the local Cloudflare connector."""
import asyncio, contextlib, json, logging, os, time
from pathlib import Path
from urllib.parse import urlsplit
from aiohttp import web, WSMsgType
import race_core as core
from private_access import gate

ROOT=Path(__file__).resolve().parent
PUBLIC=ROOT/'public'
ORIGIN=os.getenv('PUBLIC_ORIGIN','').rstrip('/')
if ORIGIN and (urlsplit(ORIGIN).scheme!='https' or urlsplit(ORIGIN).path or not urlsplit(ORIGIN).hostname):
 raise ValueError('PUBLIC_ORIGIN must be an HTTPS origin, for example https://racing.example.com')
BIND=os.getenv('BIND','127.0.0.1');PORT=int(os.getenv('PORT','8767'))
TRUST_PROXY=os.getenv('TRUST_CLOUDFLARE','0')=='1'
epoch=time.time()*1000;boot=time.monotonic()
core.now=lambda:epoch+(time.monotonic()-boot)*1000

class Limiter:
 def __init__(self):self.entries={}
 def allow(self,key,rate,burst):
  now=time.monotonic()
  if key not in self.entries and len(self.entries)>=8192:return False
  tokens,last=self.entries.get(key,(burst,now));tokens=min(burst,tokens+(now-last)*rate)
  ok=tokens>=1;self.entries[key]=(tokens-1 if ok else tokens,now)
  return ok
 def sweep(self):
  cutoff=time.monotonic()-120
  for key,(_,seen) in list(self.entries.items()):
   if seen<cutoff:del self.entries[key]
limiter=Limiter()

@web.middleware
async def headers(request,handler):
 try:response=await handler(request)
 except web.HTTPException as exc:
  if request.path.startswith('/api/'):
   message='Too many requests. Wait a moment and try again.' if exc.status==429 else exc.reason
   response=web.json_response({'error':message},status=exc.status)
   if 'Retry-After' in exc.headers:response.headers['Retry-After']=exc.headers['Retry-After']
  else:response=exc
 response.headers['X-Content-Type-Options']='nosniff'
 response.headers['Referrer-Policy']='same-origin'
 response.headers['Content-Security-Policy']="frame-ancestors 'self' https://milanoracing.team https://www.milanoracing.team"+(" http://127.0.0.1:5173 http://localhost:5173" if not ORIGIN else "")+"; object-src 'none'; base-uri 'self'"
 if not request.path.startswith('/assets/') and 'Cache-Control' not in response.headers:
  response.headers['Cache-Control']='no-store' if request.path.startswith('/api/') or request.path=='/healthz' else 'no-cache'
 return response

def peer(request):
 ip=request.remote or 'unknown'
 if TRUST_PROXY and ip in ('127.0.0.1','::1'):
  ip=request.headers.get('CF-Connecting-IP',ip)[:64]
 return ip

async def info(request):
 return web.json_response(dict(name='Milano LAN',version=4,maxPlayers=16,transport='websocket',reconnectGraceSeconds=30,circuits=list(core.TRACKS),addresses=[ORIGIN+'/'] if ORIGIN else [],https=bool(ORIGIN)))

async def race(request):
 origin=request.headers.get('Origin')
 expected=ORIGIN or str(request.url.origin())
 if origin and origin!=expected:return web.json_response({'error':'Open the game at this server address.'},status=403)
 ip=peer(request)
 if not limiter.allow(('ip',ip),240,480):raise web.HTTPTooManyRequests(headers={'Retry-After':'1'})
 try:
  if request.content_type!='application/json':raise ValueError('JSON required.')
  data=await request.json(loads=lambda s:json.loads(s,parse_constant=lambda v:(_ for _ in ()).throw(ValueError('Invalid number.'))))
  if not isinstance(data,dict):raise ValueError('Invalid request.')
  token=data.get('token','')
  if not isinstance(token,str) or len(token)>64:raise ValueError('Invalid session.')
  if data.get('action') in ('create','join'):
   if not limiter.allow(('join',ip),1,32):raise web.HTTPTooManyRequests(headers={'Retry-After':'2'})
  elif token in core.TOKENS:
   if not limiter.allow(('token',token),30,60):raise web.HTTPTooManyRequests(headers={'Retry-After':'1'})
  elif not limiter.allow(('invalid',ip),1,20):raise web.HTTPTooManyRequests(headers={'Retry-After':'2'})
  return web.json_response(core.action(data),dumps=lambda v:json.dumps(v,allow_nan=False,separators=(',',':')))
 except ValueError as exc:
  return web.json_response({'error':str(exc)[:180]},status=400)
 except (TypeError,KeyError,OverflowError):
  return web.json_response({'error':'Invalid request.'},status=400)

async def websocket(request):
 expected=ORIGIN or str(request.url.origin())
 if request.headers.get('Origin')!=expected:raise web.HTTPForbidden()
 ip=peer(request)
 if not limiter.allow(('ws-open',ip),.5,24):raise web.HTTPTooManyRequests()
 if len(request.app['sockets'])>=512:raise web.HTTPServiceUnavailable()
 ws=web.WebSocketResponse(heartbeat=15,receive_timeout=50,max_msg_size=4096,compress=False)
 await ws.prepare(request);request.app['sockets'].add(ws)
 bound=None
 try:
  async for msg in ws:
   if msg.type!=WSMsgType.TEXT:continue
   rid=None
   try:
    d=json.loads(msg.data,parse_constant=lambda _:(_ for _ in ()).throw(ValueError('Invalid number.')))
    if not isinstance(d,dict):raise ValueError('Invalid message.')
    rid=d.pop('rid',None)
    if not isinstance(rid,int) or not 0<=rid<2**53:raise ValueError('Invalid request ID.')
    if not limiter.allow(('ws',id(ws)),30,60):raise ValueError('Updates are too frequent.')
    token=d.get('token','')
    if not isinstance(token,str) or len(token)>64:raise ValueError('Invalid session.')
    if bound and token!=bound:raise ValueError('Session does not match this connection.')
    if d.get('action') in ('create','join','list') and not limiter.allow(('join',ip),2,32):raise ValueError('Wait before trying again.')
    result=core.action(d)
    if result.get('token'):bound=result['token']
    elif token in core.TOKENS:bound=token
    if d.get('action')=='leave':bound=None
    await ws.send_str(json.dumps({'rid':rid,'result':result},allow_nan=False,separators=(',',':')))
   except (ValueError,TypeError,KeyError,OverflowError) as exc:
    await ws.send_json({'rid':rid,'error':str(exc)[:180]})
 finally:
  request.app['sockets'].discard(ws);limiter.entries.pop(('ws',id(ws)),None)
 return ws

async def close_sockets(app):
 await asyncio.gather(*(ws.close(code=1001,message=b'Server restarting. Reconnecting...') for ws in list(app['sockets'])),return_exceptions=True)

async def pwa(request):
 name=request.match_info['name']
 if name not in ('sw.js','manifest.webmanifest','icon-192.png','icon-512.png'):raise web.HTTPNotFound()
 return web.FileResponse(PUBLIC/name,headers={'Cache-Control':'no-cache'})

async def download(request):
 name=request.match_info['name']
 if name not in ('Milano-Racing-Native-Windows.zip','Milano-Racing-Windows.zip','Milano-Racing-Portable.zip'):raise web.HTTPNotFound()
 path=ROOT/'downloads'/name
 if not path.is_file():raise web.HTTPNotFound(text='This download has not been uploaded to this server yet.')
 return web.FileResponse(path,headers={'Content-Disposition':'attachment; filename="'+name+'"','Cache-Control':'private, max-age=3600'})

async def health(request):return web.json_response({'status':'ok'})
async def favicon(request):return web.Response(status=204)
async def index(request):return web.FileResponse(PUBLIC/'index.html')
async def asset(request):
 name=request.match_info['name']
 if '/' in name or '\\' in name or name.startswith('.') or name.endswith('.gz'):raise web.HTTPNotFound()
 path=PUBLIC/'assets'/name
 if not path.is_file():raise web.HTTPNotFound()
 return web.FileResponse(path,headers={'Cache-Control':'public, max-age=31536000, immutable'})

async def maintenance(app):
 async def sweep():
  while True:
   await asyncio.sleep(5);core.reap();limiter.sweep()
 task=asyncio.create_task(sweep())
 yield
 task.cancel()
 with contextlib.suppress(asyncio.CancelledError):await task

def create_app():
 app=web.Application(middlewares=[headers,gate(ORIGIN,limiter,peer)],client_max_size=4096,handler_args={'keepalive_timeout':30,'max_line_size':4096,'max_field_size':4096})
 app['sockets']=set();app.on_shutdown.append(close_sockets)
 app.cleanup_ctx.append(maintenance)
 app.router.add_get('/',index)
 app.router.add_get('/Milano Racing - Team Edition.html',index)
 app.router.add_get('/api/ws',websocket);app.router.add_get('/api/info',info);app.router.add_post('/api/race',race)
 app.router.add_get('/downloads/{name}',download);app.router.add_get('/healthz',health);app.router.add_get('/assets/{name}',asset)
 app.router.add_get('/favicon.ico',favicon);app.router.add_get(r'/{name:sw\.js|manifest\.webmanifest|icon-192\.png|icon-512\.png}',pwa)
 # The gate intercepts these routes before their placeholder handler runs.
 app.router.add_get('/login',index);app.router.add_post('/login',index)
 return app
if __name__=='__main__':
 logging.basicConfig(level=logging.WARNING)
 web.run_app(create_app(),host=BIND,port=PORT,access_log=None,shutdown_timeout=10,print=None)
