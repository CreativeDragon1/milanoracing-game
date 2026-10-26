"""Capture alternating real browser/native footage, separately framed for both formats."""
from pathlib import Path
import subprocess,json,hashlib,sys,math,shutil
from PIL import Image,ImageDraw,ImageFont
from trailer_titles import create as create_titles
N=Path(__file__).resolve().parents[1];R=N.parent;C=R/'work/mixed-trailer';plan=json.loads((C/'plan.json' if (C/'plan.json').exists() else N/'tools/trailer-plan.json').read_text());E=N/'tools/Godot_v4.7.2-stable_win64_console.exe'
def run(args,**kw):subprocess.run(list(map(str,args)),check=True,**kw)
def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
formats={'reel':(1440,2560,1080,1920),'landscape':(2560,1440,1920,1080)}
run([sys.executable,N/'tools/trailer-framing.py','--apply'])
selected=[x for x in sys.argv[1:] if x in formats] or list(formats)
requested_shot=next((x.split('=',1)[1] for x in sys.argv if x.startswith('--shot=')),None)
if requested_shot:assert '--preview' in sys.argv,'A selected shot must use --preview.'
for fmt in selected:
 w,h,ow,oh=formats[fmt];out=C/fmt;out.mkdir(exist_ok=True)
 titles_only='--titles-only' in sys.argv
 prior=json.loads((N/'qa'/('mixed-trailer-'+fmt+'.json')).read_text()) if titles_only else None
 if titles_only:
  assert '--assemble' in sys.argv and '--preview' not in sys.argv
  assert prior['decodePassed'] and prior['shots']==plan['shots'],'Typography edits must retain the verified shot plan'
 assembly_check='--assembly-check' in sys.argv
 if assembly_check:ow,oh=(270,480) if fmt=='reel' else (480,270)
 run([sys.executable,N/'tools/trailer-project.py',C/('native-'+fmt),w,h])
 run([sys.executable,N/'tools/trailer-motion-project.py',C/('native-'+fmt)])
 fingerprint=digest(R/'upgrade/qa/standalone.html')+digest(N/'build/Milano Apex.pck')+digest(N/'game/scripts/cinematic_capture.gd')+digest(N/'tools/trailer-project.py')+digest(N/'tools/trailer-camera.gdshader')+digest(R/'upgrade/tools/trailer-capture.js')+digest(R/'upgrade/tools/trailer-motion.js')+digest(N/'tools/trailer_motion.py')+digest(N/'tools/trailer-motion-project.py')
 for shot in plan['shots']:
  if requested_shot and shot['id']!=requested_shot:continue
  ident=shot['id'];motion=C/'motion'/(ident+'.json');assert motion.is_file(),'Bake trailer_motion.py first';shutil.copy2(motion,C/('native-'+fmt)/'motion.json');clip=out/(ident+'.mp4');proof=out/(ident+'.json')
  if titles_only:
   info=json.loads(proof.read_text());assert clip.is_file() and info['circuit']==ident and info['source']==shot['source']
   continue
  alignment=(digest(N/'tools/trailer-motion-project.py')+digest(R/'upgrade/tools/trailer-banked-surface.js')) if shot.get('surfaceAlignment') else ''
  key=hashlib.sha256((fingerprint+json.dumps(shot)+fmt+alignment+digest(motion)).encode()).hexdigest()
  if '--reuse' in sys.argv and clip.exists() and proof.exists() and json.loads(proof.read_text()).get('captureKey')==key:continue
  if '--assemble' in sys.argv:raise RuntimeError('Missing current clip: '+str(clip))
  raw=out/(ident+'-raw.mp4')
  if shot['source']=='browser':
   run(['node',R/'upgrade/tools/record-browser-trailer.cjs',R/'upgrade/qa/standalone.html',raw,ident,shot['station'],shot['angle'],w,h,shot['seconds']],timeout=1200)
   info=json.loads(Path(str(raw)+'.json').read_text());start=0
  else:
   avi=out/(ident+'.avi');log=out/(ident+'.log')
   with log.open('w',encoding='utf-8') as f:
    run([E,'--path',C/('native-'+fmt),'--position','-4000,-4000','--rendering-method','forward_plus','--fixed-fps','60','--write-movie',avi,'--','--capture','--trailer','--circuit='+ident,'--qa-quality=2','--capture-seconds='+str(shot['seconds']),'--capture-station='+str(shot['station']),'--capture-angle='+str(shot['angle'])],stdout=f,stderr=subprocess.STDOUT,timeout=1200)
   text=log.read_text();assert 'CINEMATIC_BEGIN' in text and 'SCRIPT ERROR' not in text and '\nERROR:' not in text,text[-3000:]
   info=json.loads((N/'qa'/('capture-'+ident+'.json')).read_text());raw=avi;start=info['startFrame']/60
  assert all(not sample.get('behind',False) for sample in info['samples']),info
  if shot.get('surfaceAlignment'):assert info['surfaceChecks']['minimumClearance']>=.0199 and info['surfaceChecks']['maximumLift']<.5,info['surfaceChecks']
  run(['ffmpeg','-v','error','-y','-i',raw,'-ss',start,'-t',shot['seconds'],'-vf',f'scale={ow}:{oh}:flags=lanczos,setsar=1,format=yuv420p','-an','-c:v','libx264','-threads','4','-crf','15','-preset','medium','-movflags','+faststart',clip])
  info.update(captureKey=key,circuit=ident,source=shot['source'],captureResolution=[w,h],outputResolution=[ow,oh],shaderFinish=True,seconds=shot['seconds']);proof.write_text(json.dumps(info,indent=2));print('FINISHED',fmt,ident,shot['source'],flush=True)
  assert raw.parent.resolve()==out.resolve();raw.unlink()
  if '--preview' in sys.argv:break
 if '--preview' in sys.argv:continue
 # Original unoutlined mark, with its own soft light behind it on the end card.
 mark=Image.open(N/'game/assets/team-logo.png').convert('RGBA');mark=mark.crop(mark.getchannel('A').getbbox())
 overlay=Image.new('RGBA',(ow,oh));corner=mark.copy();corner.thumbnail((round(ow*(.31 if fmt=='reel' else .18)),round(oh*.12)),Image.Resampling.LANCZOS);overlay.alpha_composite(corner,(ow-corner.width-round(ow*.045),round(oh*.055)));overlay.save(out/'corner.png')
 import numpy as np
 yy,xx=np.mgrid[0:oh,0:ow];halo=np.exp(-(((xx/ow-.5)/.43)**2+((yy/oh-.46)/.23)**2));base=np.stack([9+97*halo,14+111*halo,25+129*halo],2).astype('uint8');end=Image.fromarray(base)
 hero=mark.copy();hero.thumbnail((round(ow*.79),round(oh*.3)),Image.Resampling.LANCZOS);end.paste(hero,((ow-hero.width)//2,round(oh*.43)-hero.height//2),hero)
 draw=ImageDraw.Draw(end);brand=ImageFont.truetype(str(N/'game/assets/fonts/Michroma.ttf'),round(ow*(.044 if fmt=='reel' else .035)));tag=ImageFont.truetype(str(N/'game/assets/fonts/Michroma.ttf'),round(ow*(.041 if fmt=='reel' else .030)))
 draw.text((ow*.5,oh*.60),'MILANO RACING',font=brand,fill='white',anchor='mm');draw.text((ow*.5,oh*.68),'ALWAYS THE FASTEST',font=tag,fill='#ff7a00',anchor='mm')
 availability=ImageFont.truetype(str(N/'game/assets/fonts/Michroma.ttf'),round(ow*(.020 if fmt=='reel' else .014)))
 draw.text((ow*.5,oh*.77),'PLAY IN BROWSER  ·  DOWNLOAD FOR WINDOWS',font=availability,fill='#dae4f4',anchor='mm');end.save(out/'end.png')
 run(['ffmpeg','-v','error','-y','-loop','1','-i',out/'end.png','-t','7','-vf','fps=60,format=yuv420p','-an','-c:v','libx264','-threads','4','-crf','15',out/'end.mp4'])
 titles=create_titles(fmt,plan['shots'],out,ow,oh)
 output=R/'outputs'/('Milano Racing - Cinematic '+('Reel' if fmt=='reel' else 'Landscape')+'.mp4')
 if assembly_check:output=out/'assembly-check.mp4'
 from trailer_assemble import assemble
 assemble(plan,out,output,titles,ow,oh,assembly_check)
 run(['ffmpeg','-v','error','-xerror','-i',output,'-f','null','-'])
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_streams','-show_format','-of','json',str(output)],text=True));video=next(s for s in probe['streams'] if s['codec_type']=='video');assert(video['width'],video['height'],video['r_frame_rate'])==(ow,oh,'60/1');assert abs(float(probe['format']['duration'])-plan['duration'])<.1
 assert int(video['nb_read_frames'])==round(plan['duration']*60),video
 assert len([s for s in probe['streams'] if s['codec_type']=='audio'])==1,probe['streams']
 if assembly_check:print('ASSEMBLY CHECK PASSED',fmt,video['nb_read_frames'],flush=True);continue
 sheet=Image.new('RGB',(1500,1600 if fmt=='reel' else 510),'#0b1020')
 for i in range(15):
  at=(0 if i==0 else plan['cuts'][i-1])+1.8;frame=out/f'review-{i:02d}.jpg';run(['ffmpeg','-v','error','-y','-ss',at,'-i',output,'-frames:v','1',frame]);sheet.paste(Image.open(frame).resize((300,533 if fmt=='reel' else 169)),((i%5)*300,(i//5)*(533 if fmt=='reel' else 169)))
 sheet.save(out/'contact.jpg')
 report={'file':str(output),'format':fmt,'seconds':plan['duration'],'resolution':[ow,oh],'fps':60,'shots':plan['shots'],'music':plan['music'],'musicStart':plan['musicStart'],'engineAudio':False,'decodePassed':True,'cornerLogo':True,'cornerLogoOnEndCard':False,'drivingCaptions':True,'titles':titles,'captureResolution':[w,h],'browserSHA256':digest(R/'upgrade/qa/standalone.html'),'desktopPackSHA256':digest(N/'build/Milano Apex.pck'),'sha256':digest(output)}
 if titles_only:
  report.update(browserSHA256=prior['browserSHA256'],desktopPackSHA256=prior['desktopPackSHA256'],typographyOnly=True,previousEditSHA256=prior['sha256'],font='Michroma',sourceClips={s['id']:digest(out/(s['id']+'.mp4')) for s in plan['shots']})
 (N/'qa'/('mixed-trailer-'+fmt+'.json')).write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
