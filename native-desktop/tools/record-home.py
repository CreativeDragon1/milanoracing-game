"""Record native game footage, then assemble a seamless cinematic menu loop."""
from pathlib import Path
import subprocess,json,shutil,sys,hashlib
N=Path(__file__).resolve().parents[1];C=N/'capture';C.mkdir(exist_ok=True)
engine=N/'tools/Godot_v4.7.2-stable_win64_console.exe'
ffmpeg=shutil.which('ffmpeg');assert ffmpeg
ids=['monza','singapore','spa','milano']
for ident in ids:
    avi=C/(ident+'.avi');metadata=N/'qa'/('capture-'+ident+'.json')
    if '--reuse' not in sys.argv or not avi.exists() or not metadata.exists():
        with (C/(ident+'.log')).open('w',encoding='utf-8') as log:
            r=subprocess.run([str(engine),'--path',str(N/'game'),'--position','-4000,-4000','--rendering-method','forward_plus','--fixed-fps','60','--write-movie',str(avi),'--','--capture','--circuit='+ident,'--qa-quality=2'],stdout=log,stderr=subprocess.STDOUT,timeout=300)
        text=(C/(ident+'.log')).read_text(encoding='utf-8');assert r.returncode==0 and 'CINEMATIC_BEGIN' in text and 'SCRIPT ERROR' not in text and '\nERROR:' not in text,text[-2500:]
    info=json.loads(metadata.read_text());start=info['startFrame']/60
    clip=C/(ident+'.mp4')
    subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-i',str(avi),'-ss',str(start),'-t','5','-c:v','libx264','-crf','16','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k',str(clip)],check=True)
    subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-ss','2.5','-i',str(clip),'-frames:v','1',str(C/(ident+'.png'))],check=True)
    print('Recorded and trimmed',ident,flush=True)
inputs=[]
for ident in ids:inputs+=['-i',str(C/(ident+'.mp4'))]
filters=[]
for i in range(4):filters.append(f'[{i}:v]settb=AVTB,setpts=PTS-STARTPTS[v{i}]');filters.append(f'[{i}:a]asetpts=PTS-STARTPTS[a{i}]')
prev='v0';audio='a0'
for i in range(1,4):
    filters.append(f'[{prev}][v{i}]xfade=transition=fade:duration=0.65:offset={4.35*i}[mix{i}]')
    filters.append(f'[{audio}][a{i}]acrossfade=d=0.65:c1=tri:c2=tri[amix{i}]')
    prev=f'mix{i}';audio=f'amix{i}'
# Blend the last .65 seconds into the opening .65 seconds, then trim that opening
# overlap: the last frame joins the next loop's first frame with continuous motion.
filters += [f'[{prev}]split[whole][head]', '[head]trim=duration=0.65,setpts=PTS-STARTPTS[opening]', '[whole][opening]xfade=transition=fade:duration=0.65:offset=17.4,trim=start=0.65,setpts=PTS-STARTPTS,format=yuv420p[outv]',f'[{audio}]asplit[awhole][ahead]','[ahead]atrim=duration=0.65,asetpts=PTS-STARTPTS[aopening]','[awhole][aopening]acrossfade=d=0.65:c1=tri:c2=tri,atrim=start=0.65,asetpts=PTS-STARTPTS,alimiter=limit=0.85[outa]']
preview=C/'Milano Home Reel.mp4'
subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y',*inputs,'-filter_complex',';'.join(filters),'-map','[outv]','-map','[outa]','-c:v','libx264','-crf','17','-preset','slow','-c:a','aac','-b:a','192k','-movflags','+faststart',str(preview)],check=True)
asset=N/'game/assets/home-reel.ogv'
subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-i',str(preview),'-vf','fps=30,scale=1280:720:flags=lanczos','-c:v','libtheora','-q:v','7','-c:a','libvorbis','-q:a','5',str(asset)],check=True)
for file in [preview,asset]:
    result=subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-threads','1','-i',str(file),'-f','null','-'],capture_output=True,text=True)
    assert result.returncode==0 and not result.stderr.strip(),result.stderr
report={'source':'Recorded from the native Vulkan game at 60 FPS, scripted race-line cameras, original MR 26 model and V10 layers','circuits':ids,'seconds':17.4,'fps':30,'resolution':[1280,720],'transitions':'0.65 second cross dissolves, matching audio fades, seamless cyclic overlap','bytes':asset.stat().st_size,'sha256':hashlib.sha256(asset.read_bytes()).hexdigest(),'decodePassed':True}
(N/'qa/home-reel.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2),flush=True)
