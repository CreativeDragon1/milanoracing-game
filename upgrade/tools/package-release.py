"""Package verified local builds; never deploys or edits the original game/reel."""
from pathlib import Path
import zipfile,shutil,hashlib,json,subprocess,datetime
U=Path(__file__).resolve().parents[1];root=U.parent;out=U/'release/packages';out.mkdir(parents=True,exist_ok=True)
downloads=Path.home()/'Downloads'
def files(folder):return sorted(p for p in folder.rglob('*') if p.is_file())
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for block in iter(lambda:f.read(4*1024*1024),b''):h.update(block)
 return h.hexdigest()
def archive(name,entries):
 target=out/name
 with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as z:
  for p,arc in entries:z.write(p,arc)
 with zipfile.ZipFile(target) as z:
  bad=z.testzip()
  if bad:raise RuntimeError('ZIP CRC failed: '+bad)
 print(name,round(target.stat().st_size/1024**2,2),'MiB; ZIP CRC passed',flush=True)
 return target
def extras(prefix):
 return [(p,str(Path(prefix)/folder/p.relative_to(U/folder))) for folder in ['docs','licenses'] for p in files(U/folder)]
app=U/'release/Milano Racing-win32-x64'
assert (app/'Milano Racing.exe').is_file()
entries=[(p,str(Path('Milano Racing')/p.relative_to(app))) for p in files(app) if 'licenses' not in p.relative_to(app).parts]
entries+=extras('Milano Racing')
windows=archive('Milano-Racing-Windows.zip',entries)
entries=[(p,str(Path('Milano-Racing-Server')/p.relative_to(U/'server'))) for p in files(U/'server') if not any(x in p.parts for x in ['__pycache__','downloads','.venv']) and p.suffix!='.pyc' and p.name!='milano.env']
server=archive('Milano-Racing-Server.zip',entries+extras('Milano-Racing-Server'))
entries=[]
include=['src','assets','vendor','tools','tests','research','integration','docs','licenses']
for folder in include:
 for p in files(U/folder):
  rel=p.relative_to(U);parts=rel.parts
  if any(x in parts for x in ['__pycache__','node_modules','deps','experiments','references','steering-before']):continue
  if p.suffix in ['.pyc','.bin','.gltf','.blend','.blend1']:continue
  entries.append((p,str(Path('Milano-Racing-Source/upgrade')/rel)))
for p in [U/'build-base.py',U/'build-web.py',U/'package.json',U/'package-lock.json',U/'PROGRESS.txt']:
 entries.append((p,str(Path('Milano-Racing-Source/upgrade')/p.relative_to(U))))
for folder in ['server','desktop']:
 for p in files(U/folder):
  rel=p.relative_to(U);parts=rel.parts
  if any(x in parts for x in ['node_modules','__pycache__','public','downloads','.venv','licenses']):continue
  if p.suffix=='.pyc' or p.name=='milano.env':continue
  entries.append((p,str(Path('Milano-Racing-Source/upgrade')/rel)))
for p in files(U/'qa'):
 if p.name=='release.json':continue # A bundle cannot contain its own hash manifest.
 if p.suffix=='.json' or p.name in ['final-menu.png','final-menu-compact.png','monaco-camera-final-0.png','spa-circuit.png','milano-design.png','windows-app.png']:
  entries.append((p,str(Path('Milano-Racing-Source/upgrade/qa')/p.name)))
source=archive('Milano-Racing-Source.zip',entries)
# Prove the extracted source no longer depends on the original workspace.
verify=U/'release'/('source-verification-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
verify.mkdir()
with zipfile.ZipFile(source) as z:z.extractall(verify)
vroot=verify/'Milano-Racing-Source'
subprocess.run(['python','upgrade/build-base.py'],cwd=vroot,check=True)
subprocess.run(['node','--check','upgrade/qa/game.js'],cwd=vroot,check=True)
subprocess.run(['python','upgrade/build-web.py'],cwd=vroot,check=True)
a=sha(U/'qa/standalone.html');b=sha(vroot/'upgrade/qa/standalone.html')
assert a==b,'Extracted source build differs from release HTML'
assert sha(U/'server/public/index.html')==sha(vroot/'upgrade/server/public/index.html')
print('Extracted source build matches both release outputs byte-for-byte.',flush=True)
standalone=out/'Milano Racing - Grand Prix.html';shutil.copy2(U/'qa/standalone.html',standalone)
manifest={'build':'Milano Racing Grand Prix 2.0','date':datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).date().isoformat(),'privateDeploymentDefault':True,'published':False,'sourceRebuild':'Extracted ZIP produces byte-identical standalone HTML and hosted index','files':[]}
for p in [windows,server,source,standalone]:
 dest=downloads/p.name
 if dest.exists() and sha(dest)!=sha(p):
  backup=downloads/(p.stem+' - previous '+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+p.suffix);shutil.copy2(dest,backup)
 shutil.copy2(p,dest);digest=sha(p);assert sha(dest)==digest
 manifest['files'].append({'name':p.name,'bytes':p.stat().st_size,'sha256':digest,'downloadsPath':str(dest)})
 print('Saved to Downloads:',p.name,flush=True)
guides=downloads/'Milano-Racing-Guides'
for folder in ['docs','licenses']:shutil.copytree(U/folder,guides/folder,dirs_exist_ok=True)
(U/'qa/release.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
(out/'SHA256SUMS.txt').write_text(''.join(f["sha256"]+'  '+f['name']+'\n' for f in manifest['files']),encoding='utf-8')
shutil.copy2(out/'SHA256SUMS.txt',downloads/'Milano-Racing-SHA256SUMS.txt')
print(json.dumps(manifest,indent=2),flush=True)
