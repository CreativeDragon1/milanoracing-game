"""Milano Racing local-network lobby and race coordinator. Python 3.10+.
The host owns countdown, checkpoints, timing and classification. Clients simulate cars.
"""
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit
import argparse,json,secrets,time,math,socket,ssl,threading,ipaddress,webbrowser,sys
from datetime import datetime,timedelta,timezone

ROOT=Path(__file__).resolve().parent
HTML=ROOT/'Milano Racing - Team Edition.html'
TRACKS=json.loads((ROOT/'Multiplayer Circuits.json').read_text(encoding='utf-8'))
ROOMS={};TOKENS={};LOCK=threading.RLock()
COLORS=['#ff883e','#56d9f3','#af89ff','#f4d44b','#7be9a6','#fa78bd','#efefef','#eb665d']
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
   if t-p['lastSeen']>8000 and r['phase'] in ['count','race']:p['dnf']=True;p['v']=0
   if t-p['lastSeen']>25000 and r['phase']=='lobby':del r['players'][pid]
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
def snapshot(r,me):
 public=[]
 for p in r['players'].values():
  public.append({k:p[k] for k in ['id','name','slot','color','ready','x','z','h','v','lap','invalid','penalty','best','finish','dnf','progress','warning']})
 public.sort(key=lambda p:(p['dnf'],p['finish'] is None,(p['finish'] or 0)+p['penalty']*1000 if p['finish'] is not None else -p['progress']))
 return dict(serverNow=now(),me=me,room=dict(code=r['code'],host=r['host'],circuit=r['circuit'],laps=r['laps'],phase=r['phase'],startAt=r['startAt'],epoch=r['epoch'],players=public))
def action(data):
 with LOCK:
  reap();a=data.get('action');t=now()
  if a in ['create','join']:
   if a=='create':
    circuit=data.get('circuit');laps=data.get('laps',3)
    if circuit not in TRACKS or laps not in [1,3,5]:raise ValueError('Choose a circuit and race distance.')
    if len(ROOMS)>=32:raise ValueError('Server is full. Close an unused room first.')
    code=''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(6))
    while code in ROOMS:code=''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(6))
    r=dict(code=code,host=None,circuit=circuit,laps=laps,phase='lobby',startAt=0,epoch=0,players={},touched=t);ROOMS[code]=r
   else:
    r=ROOMS.get(str(data.get('code','')).strip().upper())
    if not r:raise ValueError('Room not found. Check the code and host address.')
    if r['phase']!='lobby':raise ValueError('This race has started. Join when the lobby reopens.')
   if len(r['players'])>=8:raise ValueError('This room already has eight drivers.')
   slots={p['slot'] for p in r['players'].values()};slot=next(i for i in range(8) if i not in slots)
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
   r['players']={i:q for i,q in r['players'].items() if t-q['lastSeen']<8000}
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
   if not 0<=v<=90 or math.hypot(x-p['x'],z-p['z'])>90*dt+10:
    p['warning']='POSITION REJECTED';return snapshot(r,pid)
   index,off=project(track,x,z,int(p['index']));delta=(index-p['index']+n/2)%n-n/2
   if abs(delta)*track['length']/n>90*dt+15:
    p['warning']='CHECKPOINT REJECTED';return snapshot(r,pid)
   if p['warning'] in ['POSITION REJECTED','CHECKPOINT REJECTED']:p['warning']=''
   old_index=p['index'];p.update(x=x,z=z,h=h,v=v,index=index,sampleAt=t)
   if off>track['width']/2+1.5:
    if not p['invalid']:p['penalty']+=5
    p['invalid']=True;p['warning']='TRACK LIMITS +5 SEC'
   else:
    gate=int(index/n*16);oldgate=int(old_index/n*16)
    if delta>0 and oldgate==15 and gate==0:
     if not p['armed']:p['armed']=True;p['lastLapAt']=t;p['gate']=1
     elif p['gate']==16:
      lap=t-p['lastLapAt'];p['lap']+=1
      if not p['invalid']:p['best']=min(p['best'] or lap,lap)
      p['lastLapAt']=t;p['gate']=1;p['invalid']=False;p['warning']=''
      if p['lap']>=r['laps']:p['finish']=t-r['startAt'];p['v']=0
    if p['armed'] and delta>0 and gate==p['gate']:p['gate']+=1
   p['progress']=p['lap']+(min(index/n,(p['gate'])/16) if p['armed'] else -.01)
  reap();return snapshot(r,pid)

class Handler(BaseHTTPRequestHandler):
 protocol_version='HTTP/1.1'
 def log_message(self,*args):pass
 def respond(self,status,value,kind='application/json'):
  body=json.dumps(value,allow_nan=False).encode() if kind=='application/json' else value
  self.send_response(status);self.send_header('Content-Type',kind);self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.end_headers()
  try:self.wfile.write(body)
  except (ConnectionError,TimeoutError):pass
 def do_GET(self):
  path=urlsplit(self.path).path
  if path=='/api/info':self.respond(200,{'name':'Milano LAN','version':1,'maxPlayers':8,'circuits':list(TRACKS),'https':isinstance(self.connection,ssl.SSLSocket),'addresses':[(('https' if isinstance(self.connection,ssl.SSLSocket) else 'http')+'://'+ip+':'+str(self.server.server_port)+'/') for ip in addresses() if ip!='127.0.0.1']})
  elif path in ['/','/Milano%20Racing%20-%20Team%20Edition.html']:self.respond(200,HTML.read_bytes(),'text/html; charset=utf-8')
  elif path=='/favicon.ico':self.respond(204,b'','image/x-icon')
  else:self.respond(404,{'error':'Not found'})
 def do_POST(self):
  if urlsplit(self.path).path!='/api/race':return self.respond(404,{'error':'Not found'})
  origin=self.headers.get('Origin')
  if origin and urlsplit(origin).netloc!=self.headers.get('Host'):return self.respond(403,{'error':'Open the game at this server address.'})
  try:
   size=int(self.headers.get('Content-Length','0'))
   if not 0<size<=4096:raise ValueError('Invalid request size.')
   data=json.loads(self.rfile.read(size))
   if not isinstance(data,dict):raise ValueError('Invalid request.')
   self.respond(200,action(data))
  except (ValueError,TypeError,KeyError) as exc:self.respond(400,{'error':str(exc)})
 def handle(self):
  try:super().handle()
  except ConnectionError:pass
 def setup(self):super().setup();self.connection.settimeout(20)

def addresses():
 values={'127.0.0.1'}
 try:values.update(socket.gethostbyname_ex(socket.gethostname())[2])
 except OSError:pass
 return sorted(v for v in values if ipaddress.ip_address(v).is_private and not v.startswith('169.254.'))
def certificate(ips,directory=None):
 from cryptography import x509
 from cryptography.x509.oid import NameOID
 from cryptography.hazmat.primitives import hashes,serialization
 from cryptography.hazmat.primitives.asymmetric import rsa
 import os
 folder=Path(directory) if directory else Path(os.environ.get('LOCALAPPDATA',str(Path.home())))/'Milano Racing'/'LAN Certificate';folder.mkdir(parents=True,exist_ok=True)
 keyfile,certfile=folder/'private-key.pem',folder/'certificate.pem'
 # Fresh per-host keys. No shared private key is distributed in the game package.
 key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
 subject=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'Milano Racing Local Server')])
 cert=(x509.CertificateBuilder().subject_name(subject).issuer_name(subject).public_key(key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(datetime.now(timezone.utc)-timedelta(minutes=5)).not_valid_after(datetime.now(timezone.utc)+timedelta(days=30)).add_extension(x509.SubjectAlternativeName([x509.DNSName('localhost')]+[x509.IPAddress(ipaddress.ip_address(ip)) for ip in ips]),critical=False).sign(key,hashes.SHA256()))
 keyfile.write_bytes(key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()));certfile.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
 return certfile,keyfile
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--cert-dir');parser.add_argument('--port',type=int,default=8767);parser.add_argument('--bind',default='0.0.0.0');parser.add_argument('--http',action='store_true',help='HTTP for local tests; remote controllers need HTTPS');parser.add_argument('--no-browser',action='store_true');args=parser.parse_args()
 server=ThreadingHTTPServer((args.bind,args.port),Handler);server.daemon_threads=True
 ips=addresses();scheme='http' if args.http else 'https'
 if not args.http:
  try:cert,key=certificate(ips,args.cert_dir)
  except ImportError:
   print('Hosting requires the cryptography package. Run: py -m pip install cryptography');return 1
  context=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);context.minimum_version=ssl.TLSVersion.TLSv1_2;context.load_cert_chain(str(cert),str(key));server.socket=context.wrap_socket(server.socket,server_side=True)
 print('\nMILANO RACING - MULTIPLAYER\nKeep this window open while racing.\n')
 print('Host: '+scheme+'://localhost:'+str(args.port)+'/?multiplayer=1')
 for ip in ips:
  if ip!='127.0.0.1':print('Share on your local network: '+scheme+'://'+ip+':'+str(args.port)+'/?multiplayer=1')
 if not args.http:print('\nYour browser will show a local certificate warning. Continue only at your host address.\nNo certificate is installed into your trust store.')
 print('\nIf Windows asks, allow Python on PRIVATE networks. No router forwarding is needed.\nCtrl+C stops the server.\n',flush=True)
 if not args.no_browser:webbrowser.open(scheme+'://localhost:'+str(args.port)+'/?multiplayer=1')
 try:server.serve_forever(poll_interval=.25)
 except KeyboardInterrupt:pass
 finally:server.server_close()
 return 0
if __name__=='__main__':sys.exit(main())
