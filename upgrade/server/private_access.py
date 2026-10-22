"""Private-by-default gate for a single-origin staging game."""
import asyncio,base64,hashlib,hmac,os,secrets,time,html
from aiohttp import web

COOKIE='milano_access'
def make_hash(password):
 salt=secrets.token_hex(16);digest=hashlib.pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(salt),600000).hex()
 return 'pbkdf2_sha256$600000$'+salt+'$'+digest
def verify(password,stored):
 try:
  algorithm,rounds,salt,expected=stored.split('$')
  if algorithm!='pbkdf2_sha256' or int(rounds)!=600000:return False
  digest=hashlib.pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(salt),int(rounds)).hex()
  return hmac.compare_digest(digest,expected)
 except (ValueError,TypeError):return False

PAGE='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Milano Racing — Private testing</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b101a;color:#f1f3f8;font:16px/1.6 system-ui}main{width:min(380px,80vw);border-top:3px solid #ff873f;padding:28px;background:#151d2a}small{letter-spacing:3px;color:#ff9b60;font-weight:700}h1{font-size:35px;line-height:1.1}p{color:#b7c3d4}label{display:block;margin-top:25px}input,button{box-sizing:border-box;width:100%;padding:14px;margin-top:10px;border:1px solid #465166;border-radius:3px;font:inherit}input{background:#0b101a;color:white}button{background:#ff873f;color:#111821;font-weight:700;cursor:pointer}.error{color:#ffb59c}</style><main><small>MILANO RACING</small><h1>Private testing.</h1><p>The grid is closed while we work on the next build.</p>__FORM__</main></html>'''
FORM='''<form method="post" action="/login"><label for="password">Test access password</label><input id="password" name="password" type="password" autocomplete="current-password" maxlength="256" required><button type="submit">Enter the garage</button></form>'''

def gate(origin,limiter,peer):
 private=os.getenv('PRIVATE_SITE','1')!='0'
 stored=os.getenv('SITE_PASSWORD_HASH','');secret=os.getenv('SESSION_SECRET','')
 configured=bool(stored and len(secret)>=32)
 key=(secret+stored).encode();semaphore=asyncio.Semaphore(2)
 def signature(value):return hmac.new(key,value.encode(),hashlib.sha256).hexdigest()
 def valid(request):
  if not configured:return False
  value=request.cookies.get(COOKIE,'')
  if len(value)>200:return False
  try:
   payload,mac=value.rsplit('.',1);expiry,nonce=payload.split('.')
   return time.time()<int(expiry)<=time.time()+43260 and hmac.compare_digest(signature(payload),mac)
  except (ValueError,TypeError):return False
 def page(error='',status=200,return_to='/'):
  form=FORM.replace('</form>','<input type="hidden" name="next" value="'+html.escape(return_to,quote=True)+'"></form>') if configured else '<p>Test access is not configured yet. Please check back with the team.</p>'
  if error:form='<p class="error">'+error+'</p>'+form
  return web.Response(text=PAGE.replace('__FORM__',form),content_type='text/html',status=status,headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive'})
 @web.middleware
 async def access(request,handler):
  if not private:return await handler(request)
  if request.path=='/healthz':return await handler(request)
  if request.path=='/login':
   if request.method=='GET':return page()
   if request.method!='POST':raise web.HTTPMethodNotAllowed(request.method,['GET','POST'])
   if not configured:return page(status=503)
   if request.headers.get('Origin')!=(origin or str(request.url.origin())):raise web.HTTPForbidden()
   if not limiter.allow(('login',peer(request)),.05,5) or not limiter.allow(('login-global','all'),.5,10) or semaphore.locked():
    return page('Too many attempts. Please wait a minute.',429)
   async with semaphore:
    try:
     data=await request.post();password=data.get('password','')
     if not isinstance(password,str) or len(password)>256:raise ValueError()
     accepted=await asyncio.to_thread(verify,password,stored)
    except (ValueError,TypeError):accepted=False
   if not accepted:return page('That password did not match.',401)
   payload=str(int(time.time())+43200)+'.'+secrets.token_hex(12)
   target=data.get('next','/');target=target if isinstance(target,str) and (target=='/' or target.startswith('/?')) and len(target)<1024 else '/';response=web.HTTPSeeOther(target);response.set_cookie(COOKIE,payload+'.'+signature(payload),max_age=43200,httponly=True,secure=bool(origin),samesite='Strict',path='/');response.headers['Cache-Control']='no-store';return response
  if not valid(request):
   if request.path in ('/','/Milano Racing - Team Edition.html') and request.method=='GET':return page(return_to=str(request.rel_url))
   if request.path.startswith('/api/'):return web.json_response({'error':'Private test access expired. Reload and enter the password.'},status=401,headers={'Cache-Control':'no-store'})
   raise web.HTTPUnauthorized(headers={'Cache-Control':'no-store'})
  response=await handler(request)
  response.headers['Cache-Control']='private, max-age=31536000, immutable' if request.path.startswith('/assets/') else 'no-store'
  response.headers['X-Robots-Tag']='noindex, nofollow, noarchive'
  return response
 return access
