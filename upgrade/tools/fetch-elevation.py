from pathlib import Path
import json,urllib.parse,datetime,subprocess,time
root=Path(__file__).resolve().parents[1]/'research';root.mkdir(exist_ok=True)
def get(url,path):
 if path.exists(): return json.loads(path.read_text())
 for i in range(3):
  a=subprocess.run(['curl.exe','-fsSL','--max-time','35',url,'-o',str(path)],capture_output=True)
  if a.returncode==0:
   try:return json.loads(path.read_text())
   except ValueError:pass
  time.sleep(1)
 raise RuntimeError('Unable to retrieve '+url)
for ident,country in [('spa','Belgium'),('suzuka','Japan'),('interlagos','Brazil'),('zandvoort','Netherlands')]:
 try:
  sessions=get('https://api.openf1.org/v1/sessions?year=2024&session_name=Qualifying&country_name='+country,root/(ident+'-sessions.json'))
  key=sessions[-1]['session_key'];laps=get(f'https://api.openf1.org/v1/laps?session_key={key}&driver_number=1',root/(ident+'-laps.json'))
  laps=sorted([l for l in laps if l.get('lap_duration') and l.get('date_start') and not l.get('is_pit_out_lap') and 40<l['lap_duration']<200],key=lambda l:l['lap_duration'])[:3]
  for j,l in enumerate(laps):
   start=datetime.datetime.fromisoformat(l['date_start']);end=start+datetime.timedelta(seconds=l['lap_duration'])
   url='https://api.openf1.org/v1/location?'+urllib.parse.urlencode({'session_key':key,'driver_number':1,'date>':start.isoformat(),'date<':end.isoformat()})
   data=get(url,root/f'{ident}-position-{j}.json');(root/f'{ident}-source-{j}.json').write_text(json.dumps({'url':url,'lap':l}));print(ident,j,len(data),flush=True)
 except Exception as e:print(ident,str(e),flush=True)
