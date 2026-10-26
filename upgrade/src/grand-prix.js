// Grand Prix edition shell. URL invites, quality presets, install and fullscreen stay keyboard-accessible.
const gpTools=document.createElement('div');gpTools.className='gp-tools';gpTools.innerHTML='<label for="graphics-quality">GRAPHICS</label><select id="graphics-quality"><option value="ultra">Ultra</option><option value="high">High</option><option value="performance">Performance</option></select><button id="install-game" hidden>Install game</button><a href="https://game.milanoracing.team/?multiplayer=1" target="_blank" rel="noopener">Online grid ↗</a>';
$('graphics-settings').append(gpTools);$('graphics-quality').value=graphicsPreset;$('graphics-quality').onchange=e=>applyGraphics(e.target.value);
if(location.protocol==='http:'||location.protocol==='https:')gpTools.querySelector('a').href=location.pathname+'?multiplayer=1&embed=1';
applyGraphics(graphicsPreset);
const title=document.querySelector('#menu h1');if(title)title.innerHTML='MILANO<b>RACING</b>';

document.title='Milano Racing';
const style=document.createElement('style');style.textContent='.gp-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:22px;padding-top:15px;border-top:1px solid #ffffff22}.gp-tools label{font:700 10px Arial;letter-spacing:.15em;color:#97a5b8}.gp-tools select{max-width:150px;background:#101828;color:#fff;padding:9px;border:1px solid #414c60}.gp-tools a{font-size:12px;color:#ff9c40}.circuit-card.selected{border-color:#ff7a00}#circuit-grid{max-height:55vh;overflow-y:auto}.status-error:empty{display:none}#network-browse{display:grid;gap:8px;margin-top:14px}#network-browse button{display:flex;justify-content:space-between;gap:16px}#network-ping{font-size:11px}';document.head.append(style);
let installPrompt;addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('install-game').hidden=false});$('install-game').onclick=async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;$('install-game').hidden=true}};
if('serviceWorker' in navigator&&location.protocol!=='file:'&&location.pathname==='/'&&!new URLSearchParams(location.search).has('embed'))navigator.serviceWorker.register('/sw.js').catch(()=>{});
// A strict-origin message API allows the parent Milano site to pause and select a venue.
const milanoHostOrigins=new Set(['https://milanoracing.team','https://www.milanoracing.team',location.origin]);
window.MilanoHostVisible=true;
function notifyMilanoHost(origin){if(parent!==window&&window.MilanoReady&&milanoHostOrigins.has(origin))parent.postMessage({type:'milano:ready',circuit:CIRCUIT.id,circuits:Object.keys(CIRCUITS)},origin)}
addEventListener('message',e=>{if(!milanoHostOrigins.has(e.origin)||e.source!==parent)return;const m=e.data;if(m?.type==='milano:hello')notifyMilanoHost(e.origin);if(m?.type==='milano:pause')pause();if(m?.type==='milano:visibility'&&typeof m.visible==='boolean'){window.MilanoHostVisible=m.visible;if(!m.visible)pause()}if(m?.type==='milano:circuit'&&CIRCUITS[m.id]&&!MP.active)chooseCircuit(m.id)});
const milanoHostReady=setInterval(()=>{if(!window.MilanoReady)return;clearInterval(milanoHostReady);try{notifyMilanoHost(new URL(document.referrer).origin)}catch{}},250);
addEventListener('pagehide',()=>clearInterval(milanoHostReady),{once:true});
window.MilanoBuild={version:'performance-3',circuits:Object.keys(CIRCUITS).length,rendering:graphics,getDiagnostics:()=>({circuit:CIRCUIT.id,webgl2:ren.capabilities.isWebGL2,drawCalls:ren.info.render.calls,triangles:ren.info.render.triangles,textures:ren.info.memory.textures,quality:graphicsPreset,guide:racingGuide.report?.time})};

// Keep incomplete terrain textures out of the first playable frame.
window.MilanoReady=false;
async function prepareCircuitGraphics(){
 if(!ren)return;
 const yieldFrame=()=>new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0))),gl=ren.getContext(),ext=gl.getExtension('KHR_parallel_shader_compile');
 $('load-progress').textContent='Preparing lighting';await yieldFrame();
 makeRaceModels();
 // Submit every scene variant before asking the driver for any compile result.
 ren.compilePending(scene,cam);await yieldFrame();ren.compilePending(showroom.scene,showroom.camera);
 const pending=ren.info.programs.slice(),started=performance.now();let polls=0;
 while(pending.length){
  if(gl.isContextLost())throw new Error('Graphics context lost during preparation');
  if(performance.now()-started>120000)throw new Error('Shader preparation timed out');
  for(let i=pending.length-1;i>=0;i--){
   const program=pending[i].program;
   if(ext&&!gl.getProgramParameter(program,ext.COMPLETION_STATUS_KHR))continue;
   if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Circuit shader failed: '+gl.getProgramInfoLog(program));
   pending.splice(i,1);if(!ext)break;
  }
  polls++;if(pending.length)await yieldFrame();
 }
 // Upload shared images in short batches, retaining their existing resolution.
 $('load-progress').textContent='Preparing surfaces';const textures=new Set();
 const uploadable=t=>t?.isTexture&&!t.isCubeTexture&&!t.isDepthTexture&&(t.isDataTexture||t.isCompressedTexture||t.image instanceof HTMLImageElement||t.image instanceof HTMLCanvasElement||typeof ImageBitmap!=='undefined'&&t.image instanceof ImageBitmap);
 for(const root of [scene,showroom.scene])root.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material]){if(!m)continue;for(const v of Object.values(m))if(uploadable(v))textures.add(v);for(const u of Object.values(m.uniforms||{}))if(uploadable(u.value))textures.add(u.value)}});
 let deadline=performance.now()+4;for(const texture of textures){ren.initTexture(texture);if(performance.now()>deadline){await yieldFrame();deadline=performance.now()+4}}
 window.MilanoShaderPreparation={parallel:!!ext,programs:ren.info.programs.length,polls,textures:textures.size};
}
(async()=>{await document.fonts.ready;await window.sponsorReady;const start=performance.now();while((!sceneAssetsLoaded||!MilanoBoot.constructed)&&performance.now()-start<45000)await new Promise(r=>setTimeout(r,30));if(sceneAssetErrors.length||!sceneAssetsLoaded||!MilanoBoot.constructed){$('load-progress').textContent='A circuit asset did not finish loading.';$('load-retry').hidden=false;return}await prepareCircuitGraphics();window.MilanoReady=true;last=performance.now();$('scene-loading').hidden=true})().catch(error=>{$('load-progress').textContent='The circuit could not finish loading.';$('load-retry').hidden=false;console.error(error)});
