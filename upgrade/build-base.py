from pathlib import Path
import re, base64, json, subprocess
from car_livery import game_car

ROOT = Path(__file__).resolve().parent.parent
SRC=ROOT/'upgrade/src'
V=ROOT/'upgrade/vendor'
src = (V/'original-game.html').read_text(encoding='utf-8-sig')
js = re.findall(r'<script>([\s\S]*?)</script>', src)[0]
def replace(a,b):
    global js
    if a not in js: raise ValueError('Missing replacement: '+a[:100])
    js=js.replace(a,b)
def section(start,end,filename):
    global js
    a=js.index(start); b=js.index(end,a)
    js=js[:a]+(SRC/filename).read_text(encoding='utf-8')+'\n'+js[b:]

replace("q:[0,1,0],cam:[0,1,0]", "q:[0,1,0],cam:[0,3,0],dz:[.04,.3,.12],vib:[0,1,1],line:[0,2,2]")
replace("mrs1:","mrs-team2:")
replace("mrs-team2:pb:milano01", "mrs-team2:pb:milano01:autodromo-math-1")
section('// ---- track:', '// ---- renderer & world ----', 'tour-track.js')
def lazy_records(filename, previews=False):
    data=json.loads((SRC/filename).read_text(encoding='utf-8'));payload={};meta={}
    for ident,record in data.items():
        if previews:
            meta[ident]={k:record[k] for k in ['id','name','theme','length','officialTurns','N','version','subtitle'] if k in record}
            meta[ident]['preview']=[[record['x'][i],record['z'][i]] for i in range(0,record['N'],6)]
        payload[ident]={'keys':list(record) if isinstance(record,dict) else [],'array':isinstance(record,list),'json':json.dumps(record,separators=(',',':'))}
    return 'lazyCircuitRecords(/*CIRCUIT_DATA:'+filename+'*/'+json.dumps(payload,separators=(',',':'))+'/*END_CIRCUIT_DATA*/,'+json.dumps(meta,separators=(',',':'))+')'
js=(SRC/'device.js').read_text(encoding='utf-8')+'\n'+(SRC/'lazy-circuit-data.js').read_text(encoding='utf-8')+'\n'+js
replace('__PIT_LANES__',lazy_records('pit-lanes.json'))
replace('__WORLD_TOUR_DATA__',lazy_records('world-tour-data.json',True))
replace('// Terrain is baked once;', (SRC/'geography.js').read_text(encoding='utf-8')+'\n// Terrain is baked once;')
replace('__GEOGRAPHIC_DATA__',lazy_records('geographic-data.json'))
replace("'mrs-team2:pb:milano01:autodromo-math-1'", "'mrs-team2:pb:'+CIRCUIT.id+':'+CIRCUIT.version")
vehicle=(SRC/'vehicle-model.js').read_text(encoding='utf-8').replace('__VEHICLE_DATA__',(SRC/'vehicle-model.json').read_text(encoding='utf-8'))
vehicle=(SRC/'track-limits.js').read_text(encoding='utf-8').replace('__TRACK_LIMIT_RULES__',(SRC/'track-limits.json').read_text())+'\n'+vehicle
replace('// ---- renderer & world ----',vehicle+'\n// ---- renderer & world ----')
replace('function placeCar(i,back){','function placeCar(i,back){c.limitState=TrackLimits.fresh();')
replace("steer:[.6,1.4,1]", "steer:[.6,1.2,.85]")
replace("function newSession(m){mode=m;", "function newSession(m){$('pause-note').textContent='';mode=m;")
section('// ---- renderer & world ----','// ---- state ----','world.js')
replace('// ---- state ----',(SRC/'pit-surface.js').read_text(encoding='utf-8')+'\n'+(SRC/'pit-world.js').read_text(encoding='utf-8')+'\n// ---- state ----')
helpers=(SRC/'circuit-scenery.js').read_text(encoding='utf-8').split('const mainGrandstand=')[0]
replace('// __CIRCUIT_SCENERY__', (SRC/'venue-map.js').read_text(encoding='utf-8')+'\n'+helpers+(SRC/'tour-scenery.js').read_text(encoding='utf-8')+'\n'+(SRC/'venue-details.js').read_text(encoding='utf-8')+'\n'+(SRC/'landmark-architecture.js').read_text(encoding='utf-8')+'\n'+(SRC/'venue-buildings.js').read_text(encoding='utf-8')+'\n'+(SRC/'geographic-world.js').read_text(encoding='utf-8')+'\n'+(SRC/'landmark-solids.js').read_text(encoding='utf-8')+'\n'+(SRC/'geographic-landmarks.js').read_text(encoding='utf-8')+'\nbuildLandmarkArchitecture();\n'+(SRC/'venue-context.js').read_text(encoding='utf-8')+'\n'+(SRC/'palm-geometry.js').read_text(encoding='utf-8')+'\n'+(SRC/'calendar-landscape.js').read_text(encoding='utf-8')+'\n'+(SRC/'milano-campus.js').read_text(encoding='utf-8')+'\n'+(SRC/'custom-scenery.js').read_text(encoding='utf-8')+'\n'+(SRC/'venue-life.js').read_text(encoding='utf-8')+'\n'+(SRC/'vegetation.js').read_text(encoding='utf-8'))
replace('// __SUNSET_LANDSCAPE__', '')
replace("inp.t=rp(inp.t,(k('KeyW')||k('ArrowUp'))?1:0,5,12);inp.b=rp(inp.b,(k('KeyS')||k('ArrowDown')||k('Space'))?1:0,6,14);", "inp.t=rp(inp.t,Math.max((k('KeyW')||k('ArrowUp'))?1:0,padInput.t),5,12);inp.b=rp(inp.b,Math.max((k('KeyS')||k('ArrowDown')||k('Space'))?1:0,padInput.b),6,14);")
replace("inp.s=rp(inp.s,((k('KeyD')||k('ArrowRight'))?1:0)-((k('KeyA')||k('ArrowLeft'))?1:0),3.5,6);", "const ks=((k('KeyD')||k('ArrowRight'))?1:0)-((k('KeyA')||k('ArrowLeft'))?1:0);inp.s=rp(inp.s,ks||padInput.s,4.5,7);")
replace("msg('BARRIER CONTACT',900)","msg('BARRIER CONTACT',900);rumble(.7,.9,180)")
replace("if(kerb)c.r+=", "if(kerb&&c.vx>8)rumble(.12,.28,70);if(kerb)c.r+=")
section('function step(dt){', 'function timing(pi){', 'handling.js')
replace("'Scales maximum steering angle.'", "'Adjusts steering response. Stability assist remains on.'")
replace("'More cornering grip, more drag, lower top speed.'", "'More cornering grip. Less speed on straights.'")
replace("'Peak braking force (tyre-limited).'", "'Adjusts braking force.'")
replace("'Master volume','Engine and effects.'", "'Engine volume','V10 engine sound.'")
replace("'Simplified game grip multiplier.'", "'Adjusts available tyre grip.'")
section('function finish(){', '// ---- UI ----', 'results.js')
replace("function show(id){document.querySelectorAll('.ov').forEach(o=>o.classList.toggle('on',o.id===id))}","function show(id){document.querySelectorAll('.ov').forEach(o=>o.classList.toggle('on',o.id===id));document.body.dataset.screen=id;const el=document.querySelector(id==='menu'?'#menu .home-drive':'#'+id+' button');if(el)el.focus({preventScroll:true})}")
replace("if(b.dataset.ov){if(b.dataset.ov==='menu'){state='menu';$('hud').hidden=true}show(b.dataset.ov)}", "if(b.dataset.ov){if(b.dataset.ov==='menu'){state='menu';$('hud').hidden=true}show(b.dataset.ov)}")
replace("$('tomenu').onclick=()=>{if(race&&race.laps.length&&!confirm('Leave session? Unsaved progress will be lost.'))return;state='menu';$('hud').hidden=true;show('menu')};", "$('tomenu').onclick=()=>{state='menu';$('hud').hidden=true;show('menu')};")
replace("function pause(){if(state!=='race')return;state='pause';keys.clear();show('pause')}","let pausedFrom='race';function pause(){if(state!=='race'&&state!=='count')return;pausedFrom=state;state='pause';keys.clear();inp.t=inp.b=inp.s=0;show('pause')}")
replace("function resume(){if(state!=='pause')return;state='race';show('none')}","function resume(){if(state!=='pause')return;state=pausedFrom;acc=0;show(state==='count'?'count':'none');audioInit()}")
replace("const GK=['KeyW'", (SRC/'controller.js').read_text(encoding='utf-8')+'\n'+(SRC/'touch-controls.js').read_text(encoding='utf-8')+"\nconst GK=['KeyW'")
replace("if(state==='race'){if(GK.includes(e.code))keys.add(e.code);if(e.code==='KeyC')camMode=S.cam=1-camMode,saveS(),snap=true;", "if(e.code==='KeyF'&&!e.repeat)toggleFullscreen();if(state==='race'){if(GK.includes(e.code))keys.add(e.code);if(e.code==='KeyC'&&!e.repeat)cycleCamera();")
replace("if(e.code==='KeyR'){placeCar(c.idx);invalid('RESET · LAP INVALID')}","if(e.code==='KeyR'&&!e.repeat)resetCar()")
replace("if(e.code==='Escape'){state==='race'?pause():state==='pause'&&resume();return}","if(e.code==='Escape'&&!e.repeat){(state==='race'||state==='count')?pause():state==='pause'&&resume();return}")
replace("function resize(){if(!ren)return;const w=innerWidth,h=innerHeight;ren.setPixelRatio(S.q?1:Math.min(devicePixelRatio||1,2));ren.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix()}", "function resize(){if(!ren)return;const w=innerWidth,h=innerHeight;ren.setPixelRatio(S.q?Math.min(devicePixelRatio||1,1):Math.min(devicePixelRatio||1,1.7));ren.setSize(w,h,false);ren.shadowMap.enabled=!S.q;sun.shadow.mapSize.set(S.q?1024:2048,S.q?1024:2048);cam.aspect=w/h;cam.updateProjectionMatrix()}")
section('// ---- loop ----','requestAnimationFrame(frame);\n</never>', 'loop.js') if False else None
js=js[:js.index('// ---- loop ----')]+(SRC/'postfx.js').read_text(encoding='utf-8')+'\n'+(SRC/'racing-line.js').read_text(encoding='utf-8')+'\n'+(SRC/'showroom.js').read_text(encoding='utf-8')+'\n'+(SRC/'loop.js').read_text(encoding='utf-8')
replace('__OPTIMIZED_LINE__','CIRCUIT.line')
replace("$('lowq').checked=!!S.q}", "$('lowq').checked=!!S.q;$('race-line').value=Math.round(S.line);if($('line-pause'))$('line-pause').textContent='Racing line: '+['Off','Corners','Full'][Math.round(S.line)]}")
section('// ---- audio (single context, lifetime-scoped) ----','// ---- minimap, HUD ----','audio-v10.js')
replace('// RB1 V10 samples:',(SRC/'audio-drive.js').read_text(encoding='utf-8')+'\n// RB1 V10 samples:')
replace('__V10_BANK_META__',(V/'work/audio-assets/v10-bank.json').read_text())
replace('__V10_AUDIO__','data:audio/wav;base64,'+base64.b64encode((V/'work/audio-assets/v10-bank.wav').read_bytes()).decode())
section("const mb=document.createElement('canvas');", 'function hud(){', 'minimap.js')
map_a=js.index(' mx.clearRect(0,0,170,170);')
map_b=js.index(" const g=$('gph')",map_a)
js=js[:map_a]+' drawCircuitMap();\n'+js[map_b:]
replace("function hud(){const R=race,v=c.vx*3.6,mx=$('map').getContext('2d');", "function hud(){const R=race,v=c.vx*3.6; $('session-type').textContent=mode==='tt'?'TIME TRIAL':'PRACTICE'; document.querySelectorAll('#rev-lights i').forEach((el,i)=>el.classList.toggle('lit',i<Math.round(clamp((driveSound.state.rpm-4500)/13500,0,1)*12)));")
replace("R.started&&rf!==undefined","R.started&&Number.isFinite(rf)")
replace("Math.round(c.rpm/10)*10+' RPM'", "Math.round(driveSound.state.rpm/10)*10+' RPM'")
replace("'#53D8C8'","'#738bff'")
replace('function timing(pi){',"function timing(pi){if(typeof MP!=='undefined'&&MP.active)return;")
replace("function newSession(m){", "function newSession(m){if(typeof MP!=='undefined'&&MP.active&&m!=='mp')return;")
js+='\n'+(SRC/'tour-ui.js').read_text(encoding='utf-8')+'\n'+(SRC/'multiplayer.js').read_text(encoding='utf-8')
js+='\n'+(SRC/'adaptive-pace.js').read_text(encoding='utf-8')+'\n'+(SRC/'race-weekend-core.js').read_text(encoding='utf-8')+'\n'+(SRC/'race-weekend.js').read_text(encoding='utf-8')+'\n'+(SRC/'adaptive-rivals.js').read_text(encoding='utf-8')
js+='\n'+(SRC/'venue-finishing.js').read_text(encoding='utf-8')+'\n'+(SRC/'pit-details.js').read_text(encoding='utf-8')+'\n'+(SRC/'grandstand-foundations.js').read_text(encoding='utf-8')+'\n'+(SRC/'sponsors.js').read_text(encoding='utf-8')+'\n'+(SRC/'render-batches.js').read_text(encoding='utf-8')+'\n'+(SRC/'grand-prix.js').read_text(encoding='utf-8')+'\n'+(SRC/'interface-v2.js').read_text(encoding='utf-8')
partners=json.loads((ROOT/'upgrade/assets/sponsors/manifest.json').read_text(encoding='utf-8'))
for partner in partners:
    path=ROOT/'upgrade/assets/sponsors'/partner['file']
    mime='image/webp' if path.suffix=='.webp' else 'image/png'
    partner['image']='data:'+mime+';base64,'+base64.b64encode(path.read_bytes()).decode()
js=js.replace('__SPONSOR_DATA__',json.dumps(partners,separators=(',',':')))
js=js.replace('__TREE_MODEL__',(SRC/'tree-model.json').read_text(encoding='utf-8'))
for marker,name in [('__TREE_TRUNK_DIFF__','tree_small_02_diff_1k.jpg'),('__TREE_TRUNK_NORMAL__','tree_small_02_nor_gl_1k.jpg'),('__TREE_BRANCH_DIFF__','tree_small_02_branch_diff_1k.jpg'),('__TREE_BRANCH_NORMAL__','tree_small_02_branch_nor_gl_1k.jpg'),('__TREE_LEAF_DIFF__','tree_small_02_leaves_diff_1k.jpg'),('__TREE_LEAF_NORMAL__','tree_small_02_leaves_nor_gl_1k.jpg')]:
    js=js.replace(marker,'data:image/jpeg;base64,'+base64.b64encode((ROOT/'upgrade/assets/tree-small-02/textures'/name).read_bytes()).decode())
js=js.replace('__TREE_CANOPY_ATLAS__','data:image/png;base64,'+base64.b64encode((ROOT/'upgrade/assets/tree-small-02/canopy-atlas.png').read_bytes()).decode())
js=js.replace('__PIT_BUILDING_PLANS__',(SRC/'pit-building-plans.json').read_text(encoding='utf-8'))
js=js.replace('__EXTRA_LANDMARKS__',(SRC/'extra-landmarks.json').read_text(encoding='utf-8'))
js=js.replace('__CALENDAR_ENVIRONMENTS__',lazy_records('calendar-environments-data.json'))
js=js.replace('__VENUE_CONTEXT__',lazy_records('venue-context-data.json'))
js=js.replace('__GEO_LANDMARKS__',(SRC/'geographic-landmarks-data.json').read_text(encoding='utf-8'))
js=js.replace('__VENUE_MAP_DATA__',lazy_records('venue-map-data.json'))
js=js.replace('__STEM_CAR__',game_car(V/'work/stem-car.json'))
for marker,file,mime in [('__CAR_ATLAS__','../upgrade/assets/livery/Livery_FINAL.png','image/png'),('__TYRE_ATLAS__','model-sources/car-livery.png','image/png'),('__ASPHALT_COLOR__','../upgrade/assets/asphalt-fine-color.webp','image/jpeg'),('__ASPHALT_NORMAL__','../upgrade/assets/asphalt-fine-normal.webp','image/jpeg'),('__ASPHALT_ROUGH__','../upgrade/assets/asphalt-fine-rough.webp','image/jpeg'),('__SUNSET_HDR__','graphics-assets/kloppenheim_06_puresky_4k.hdr','application/octet-stream')]:
    mime='image/webp' if file.endswith('.webp') else mime
    js=js.replace(marker,'data:'+mime+';base64,'+base64.b64encode(((ROOT/file[3:]) if file.startswith('../') else (V/'work'/file)).read_bytes()).decode())
for marker,name in [('__PALM_BARK_COLOR__','palm-bark-color.webp'),('__PALM_BARK_NORMAL__','palm-bark-normal.webp'),('__PALM_BARK_ROUGH__','palm-bark-rough.webp'),('__GRAVEL_COLOR__','gravel-color.jpg'),('__GRAVEL_NORMAL__','gravel-normal.jpg'),('__GRAVEL_ROUGH__','gravel-rough.jpg'),('__CONCRETE_COLOR__','concrete-color.jpg'),('__CONCRETE_NORMAL__','concrete-normal.jpg'),('__GRASS_COLOR__','lawn-color.webp'),('__GRASS_NORMAL__','lawn-normal.webp'),('__SAND_COLOR__','sand-fine-color.webp'),('__SAND_NORMAL__','sand-fine-normal.webp')]:
    js=js.replace(marker,'data:'+('image/webp' if name.endswith('.webp') else 'image/jpeg')+';base64,'+base64.b64encode((ROOT/'upgrade/assets'/name).read_bytes()).decode())
logo='data:image/png;base64,'+base64.b64encode((V/'team-logo.png').read_bytes()).decode()
js=js.replace('__LOGO_DATA__',logo)
skin='\n'.join((SRC/name).read_text(encoding='utf-8') for name in ['interface.css','tour.css','home.css','interface-v2.css','mobile.css'])
for marker,name in [('__FONT_HUD__','Oxanium[wght].ttf'),('__FONT_DM__','DM-Sans.ttf'),('__FONT_MICHROMA__','Michroma.ttf'),('__FONT_BARLOW__','Barlow-Bold.ttf'),('__FONT_BARLOW_ITALIC__','Barlow-ExtraBoldItalic.ttf')]:
    skin=skin.replace(marker,'data:font/ttf;base64,'+base64.b64encode((ROOT/'upgrade/assets/fonts'/name).read_bytes()).decode())
ui=(SRC/'ui.html').read_text(encoding='utf-8').replace('__LOGO_DATA__',logo).replace('/* __UI_SKIN__ */',skin)
ui=ui.replace('<!-- GAME -->',(SRC/'tour-ui.html').read_text(encoding='utf-8')+'\n'+(SRC/'weekend-ui.html').read_text(encoding='utf-8')+'\n<!-- GAME -->')
ui=ui.replace('<strong>MILANO AUTODROMO</strong>','<strong id="current-circuit">BAHRAIN</strong>')
ui=ui.replace('<div class="select-label">SELECT SESSION</div>','<div class="button-row tour-actions"><button data-ov="circuits" id="circuit-menu">Change circuit</button><button data-ov="network" id="multiplayer-menu">Multiplayer</button></div><div class="select-label">SOLO SESSION</div>')
ui=ui.replace('Single player. Personal bests are saved in this browser.','Solo sessions and online multiplayer. Personal bests are saved separately for each circuit.').replace('MR 26 · Milano Autodromo','MR 26 · World Tour')
ui=ui.replace('<div class="eyebrow">GAME INFO</div>', '<div class="eyebrow">GAME INFO</div><p class="small">V10 recording: <a href="https://commons.wikimedia.org/wiki/File:Red_Bull-Cosworth_RB1_(2005).ogg" target="_blank" rel="noopener">Edvvc / Ed Pond</a>. Edited and looped under <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a>.</p>')

asset_credits=(ROOT/'upgrade/licenses/Surface-refresh-credits.txt').read_text(encoding='utf-8')+'\n'+(V/'CREDITS.txt').read_text(encoding='utf-8')+'\n'+(V/'work/circuit-sources/LICENSE.md').read_text(encoding='utf-8')
ui=ui.replace('<!-- GAME -->','<!-- Asset credits and circuit data license\n'+asset_credits.replace('--','—')+'\n-->\n<!-- GAME -->')
font_license='\n'.join((ROOT/'upgrade/assets/fonts'/name).read_text(encoding='utf-8') for name in ['oxanium-OFL.txt','dmsans-OFL.txt','michroma-OFL.txt','barlow-OFL.txt']).replace('--','—')
ui=ui.replace('<!-- GAME -->','<!-- Interface font licenses\n'+font_license+'\n-->\n<!-- GAME -->')
three=(V/'work'/'three.min.js').read_text(encoding='utf-8')
license_text=(V/'work'/'THREE-LICENSE.txt').read_text(encoding='utf-8')
three='/* Three.js r128 — '+license_text.replace('*/','* /')+' */\n'+three
for addon in ['RGBELoader','DecalGeometry','Pass','CopyShader','ShaderPass','EffectComposer','SimplexNoise','SSAOShader','SSAOPass','FXAAShader']:
    three+='\n'+(V/('work/graphics-assets/'+addon+'.js')).read_text(encoding='utf-8')
(ROOT/'upgrade/qa/game.js').write_text(js,encoding='utf-8')
subprocess.run(['node',str(ROOT/'upgrade/tools/stage-startup.cjs'),str(ROOT/'upgrade/qa/game.js')],check=True)
js=(ROOT/'upgrade/qa/game.js').read_text(encoding='utf-8')
out=ui.replace('<!-- GAME -->','<script>'+three+'</script>\n<script>'+js+'</script>')
(ROOT/'upgrade/qa/standalone.tmp').write_text(out,encoding='utf-8')
(ROOT/'upgrade/qa/standalone.tmp').replace(ROOT/'upgrade/qa/standalone.html')
(ROOT/'upgrade/qa/game.js').write_text(js,encoding='utf-8')
print('Built standalone game:',len(out),'characters')
