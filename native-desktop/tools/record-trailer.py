"""Capture every venue from the native renderer and assemble the requested clean reel."""
from pathlib import Path
import subprocess, json, hashlib, shutil, sys, math
from PIL import Image, ImageDraw, ImageFont
from trailer_geometry import preflight, clearance

N = Path(__file__).resolve().parents[1]
R = N.parent
C = N / 'capture/trailer'
C.mkdir(parents=True, exist_ok=True)
E = N / 'tools/Godot_v4.7.2-stable_win64_console.exe'
# MovieWriter uses project window overrides rather than the CLI window request.
# A separate authoring project shares the immutable game assets/import cache.
# The tested game project and packaged executable keep their normal dimensions.
portrait=C/'project';portrait.mkdir(exist_ok=True)
for folder in ['assets','circuits','scripts','.godot']:
    link=portrait/folder;target=N/'game'/folder
    if not link.exists():
        subprocess.run(['powershell','-NoProfile','-Command',
                        f"New-Item -ItemType Junction -Path '{str(link).replace(chr(39),chr(39)*2)}' -Target '{str(target).replace(chr(39),chr(39)*2)}' | Out-Null"],check=True)
    assert link.resolve()==target.resolve()
qa_link=C/'qa'
if not qa_link.exists():
    subprocess.run(['powershell','-NoProfile','-Command',
                    f"New-Item -ItemType Junction -Path '{str(qa_link).replace(chr(39),chr(39)*2)}' -Target '{str(N/'qa').replace(chr(39),chr(39)*2)}' | Out-Null"],check=True)
assert qa_link.resolve()==(N/'qa').resolve()
config=(N/'game/project.godot').read_text()
for old,new in [('viewport_width=1600','viewport_width=1080'),('viewport_height=900','viewport_height=1920'),('window_width_override=1440','window_width_override=1080'),('window_height_override=810','window_height_override=1920')]:
    assert old in config;config=config.replace(old,new)
(portrait/'project.godot').write_text(config)
(portrait/'main.tscn').write_text((N/'game/main.tscn').read_text().replace('res://scripts/main.gd','res://main_portrait.gd'))
(portrait/'main_portrait.gd').write_text((N/'game/scripts/main.gd').read_text().replace('res://scripts/cinematic_capture.gd','res://cinematic_portrait.gd'))
capture=(N/'game/scripts/cinematic_capture.gd').read_text()
capture=capture.replace('game.camera.fov=(66 if trailer else 58)+4*t','''game.camera.fov=76+4*t
	# Portrait camera framing keeps the complete MR 26 inside a safe margin.
	var required_tangent:=0.0
	var inverse:Transform3D=game.camera.global_transform.affine_inverse()
	var aspect:float=1080.0/1920.0
	for longitudinal in [-2.85,2.85]:
		for lateral in [-.9,.9]:
			for height in [0.0,2.0]:
				var point:Vector3=inverse*(pose.position+forward*longitudinal+right*lateral+Vector3.UP*height)
				if point.z<-.1:
					required_tangent=maxf(required_tangent,maxf(absf(point.y)/(-point.z*.88),absf(point.x)/(-point.z*aspect*.88)))
	game.camera.fov=maxf(game.camera.fov,rad_to_deg(2*atan(required_tangent))+1)''')
assert 'required_tangent' in capture
(portrait/'cinematic_portrait.gd').write_text(capture)
capture_profile='portrait-full-car-v2'
music = Path.home() / 'Downloads/F1 - Symphonic Version.mp3'
assert music.is_file()
shots = [('milano', .35, 3), ('singapore', .68, 1), ('monaco', .72, 0),
         ('monza', .64, 5), ('bahrain', .28, 2), ('spa', .045, 4),
         ('austria', .42, 3), ('silverstone', .58, 0), ('abu-dhabi', .82, 1),
         ('suzuka', .10, 4), ('interlagos', .04, 2), ('zandvoort', .82, 5),
         ('riviera', .62, 3), ('solara', .45, 0)]
period = 131 / 30
fade = .6
duration = 66.9666666667
music_start = 393.6 - duration
tracks=json.loads((N/'game/circuits/physics.json').read_text())
route_reports=[{'circuit':ident,'minBodyRoadClearance':preflight(tracks[ident],station)} for ident,station,_ in shots]
assert all(r['minBodyRoadClearance']>=0 for r in route_reports), route_reports
(N/'qa/trailer-routes.json').write_text(json.dumps({'passed':True,'footprintMetres':[5.7,1.7],'stepSeconds':.1,'carsPerShot':4,'reports':route_reports},indent=2))

def run(args, **kw):
    subprocess.run(args, check=True, **kw)

pack_hash = hashlib.sha256((N / 'build/Milano Apex.pck').read_bytes()).hexdigest()
for ident, station, angle in shots:
    clip = C / (ident + '.mp4')
    proof = C / (ident + '.json')
    if '--reuse' in sys.argv and clip.exists() and proof.exists():
        previous=json.loads(proof.read_text())
        if previous.get('packSHA256')==pack_hash and previous.get('station')==station and previous.get('angle')==angle and previous.get('captureResolution')==[1080,1920] and previous.get('captureProfile')==capture_profile:
            continue
    avi = C / (ident + '.avi')
    log = C / (ident + '.log')
    with log.open('w', encoding='utf-8') as out:
        run([str(E), '--path', str(portrait), '--position', '-4000,-4000',
             '--resolution', '1080x1920', '--rendering-method', 'forward_plus',
             '--fixed-fps', '60', '--write-movie', str(avi), '--', '--capture', '--trailer',
             '--circuit=' + ident, '--qa-quality=2', '--capture-seconds=5.1',
             '--capture-station=' + str(station), '--capture-angle=' + str(angle)],
            stdout=out, stderr=subprocess.STDOUT, timeout=600)
    text = log.read_text(encoding='utf-8')
    assert 'CINEMATIC_BEGIN' in text and 'SCRIPT ERROR' not in text and '\nERROR:' not in text, text[-3000:]
    info = json.loads((N / 'qa' / ('capture-' + ident + '.json')).read_text())
    assert info['frames'] == 306 and len(info['samples']) == 10
    assert all(not s['behind'] and 0 <= s['screen'][0] <= 1080 and 0 <= s['screen'][1] <= 1920 for s in info['samples']), info
    info['minBodyRoadClearance']=min(clearance(tracks[ident],s['position'][0],s['position'][2],s['heading'],s['station']) for s in info['samples'])
    assert info['minBodyRoadClearance']>=0, info
    run(['ffmpeg', '-v', 'error', '-y', '-i', str(avi), '-ss', str(info['startFrame'] / 60),
         '-t', '5.1', '-vf', 'fps=30', '-an', '-c:v', 'libx264', '-crf', '16',
         '-preset', 'fast', '-pix_fmt', 'yuv420p', str(clip)])
    clip_probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','json',str(clip)],text=True))['streams'][0]
    assert [clip_probe['width'],clip_probe['height']]==[1080,1920],clip_probe
    info.update(packSHA256=pack_hash, station=station, angle=angle,captureResolution=[1080,1920],captureProfile=capture_profile)
    proof.write_text(json.dumps(info, indent=2))
    # Only this script's intermediate movie, never source footage.
    assert avi.parent.resolve() == C.resolve()
    avi.unlink()
    print('Native trailer shot:', ident, flush=True)

# The supplied logo is only proportionally resized. There is no drawn border.
mark = Image.open(N / 'game/assets/team-logo-fit.png').convert('RGBA')
# The executable needs square padding; video placement uses the artwork bounds
# so the requested 330/930 pixel widths describe the visible logo itself.
mark = mark.crop(mark.getbbox())
overlay = Image.new('RGBA', (1080, 1920))
corner = mark.copy(); corner.thumbnail((330, 170), Image.Resampling.LANCZOS)
overlay.alpha_composite(corner, (1080 - corner.width - 65, 115))
overlay.save(C / 'corner.png')
end = Image.new('RGB', (1080, 1920))
draw = ImageDraw.Draw(end)
for y in range(1920):
    light = math.exp(-((y - 840) / 420) ** 2)
    draw.line((0, y, 1080, y), fill=tuple(int(a + b * light) for a, b in [(7, 114), (13, 124), (23, 137)]))
hero = mark.copy(); hero.thumbnail((930, 440), Image.Resampling.LANCZOS)
end.paste(hero, ((1080 - hero.width) // 2, 740), hero)
draw = ImageDraw.Draw(end)
brand = ImageFont.truetype(str(N / 'game/assets/fonts/Michroma.ttf'), 49)
tag = ImageFont.truetype(str(N / 'game/assets/fonts/Barlow-ExtraBoldItalic.ttf'), 51)
draw.text((540, 1110), 'MILANO RACING', font=brand, fill='white', anchor='mm')
draw.text((540, 1220), 'ALWAYS THE FASTEST', font=tag, fill='#ff7a00', anchor='mm')
end.save(C / 'end.png')
run(['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-i', str(C / 'end.png'), '-t', '7',
     '-vf', 'fps=30,format=yuv420p', '-an', '-c:v', 'libx264', '-crf', '16', str(C / 'end.mp4')])
inputs = []; filters = []
for i, filename in enumerate([C / (s[0] + '.mp4') for s in shots] + [C / 'end.mp4']):
    inputs += ['-threads', '1', '-i', str(filename)]
    length = period + fade / 2 if i == 0 else period + fade
    if i == 14: length = duration - 14 * period + fade / 2
    filters.append(f'[{i}:v]trim=duration={length},settb=AVTB,setpts=PTS-STARTPTS,format=yuv420p[v{i}]')
prev = 'v0'
for i in range(1, 15):
    filters.append(f'[{prev}][v{i}]xfade=transition=fade:duration={fade}:offset={i*period-fade/2}[x{i}]')
    prev = 'x' + str(i)
inputs += ['-loop', '1', '-i', str(C / 'corner.png'), '-i', str(music)]
filters += [f'[15:v]format=rgba,fade=t=out:st={14*period-fade/2}:d={fade}:alpha=1[logo]',
            f'[{prev}][logo]overlay=shortest=1,format=yuv420p[v]',
            f'[16:a]atrim=start={music_start}:duration={duration},asetpts=PTS-STARTPTS,afade=t=in:d=0.35,afade=t=out:st={duration-2}:d=2,volume=0.85,alimiter=limit=0.95[a]']
output = R / 'outputs/Milano Racing - Native Cinematic Reel.mp4'
run(['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex_threads', '2', '-filter_complex', ';'.join(filters),
     '-map', '[v]', '-map', '[a]', '-t', str(duration), '-c:v', 'libx264', '-threads', '6',
     '-crf', '17', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', str(output)])
run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(output), '-f', 'null', '-'])
probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', str(output)], text=True))
video = next(s for s in probe['streams'] if s['codec_type'] == 'video')
assert (video['width'], video['height'], video['r_frame_rate']) == (1080, 1920, '30/1')
assert abs(float(probe['format']['duration']) - duration) < .1
sheet = Image.new('RGB', (1500, 1600), '#10131b')
for i in range(15):
    t = min(duration - 2, i * period + 2)
    frame = C / f'review-{i:02d}.jpg'
    run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t), '-i', str(output), '-frames:v', '1', str(frame)])
    sheet.paste(Image.open(frame).resize((300, 533)), ((i % 5) * 300, (i // 5) * 533))
sheet.save(C / 'contact.jpg')
report = {'file': str(output), 'seconds': duration, 'resolution': [1080, 1920], 'fps': 30,
          'circuits': [s[0] for s in shots], 'packSHA256': pack_hash,
          'music': str(music), 'musicStart': music_start, 'engineAudio': False, 'decodePassed': True,
          'drivingText': False, 'cornerLogo': True, 'cornerLogoOnEndCard': False,
          'sha256': hashlib.sha256(output.read_bytes()).hexdigest()}
(N / 'qa/trailer.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2), flush=True)
