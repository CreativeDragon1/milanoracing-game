// Pointer capture keeps steering and pedals independent during multi-touch.
// Cancellation, rotation, backgrounding and menus always release every control.
const touchUI=document.createElement('div');touchUI.id='touch-controls';touchUI.hidden=!device.mobile;
touchUI.innerHTML='<div class="touch-actions"><button id="touch-camera" aria-label="Change camera">CAM</button><button id="touch-reset" aria-label="Reset car">RESET</button><button id="touch-pause" aria-label="Pause race">Ⅱ</button></div><div id="touch-steering" role="slider" aria-label="Steering" aria-valuemin="-100" aria-valuemax="100" aria-valuenow="0"><span aria-hidden="true">‹</span><i></i><span aria-hidden="true">›</span></div><div class="touch-pedals"><button id="touch-brake" aria-label="Brake">BRAKE</button><button id="touch-throttle" aria-label="Accelerate">GO</button></div>';
document.body.append(touchUI);
const touchPointers=new Map();let steeringOrigin=0;
function releaseTouch(){touchPointers.clear();Object.assign(touchInput,{s:0,t:0,b:0});touchUI.querySelectorAll('.pressed').forEach(e=>e.classList.remove('pressed'));$('touch-steering').style.setProperty('--steer','0px');$('touch-steering').setAttribute('aria-valuenow','0');}
function touchActive(){return !document.hidden&&(state==='race'||state==='count')&&document.body.dataset.screen==='none'||!document.hidden&&state==='count';}
function touchAudio(){audioInit();if(typeof AC!=='undefined'&&AC?.state!=='running')AC?.resume().catch(()=>{});}
for(const [id,key]of[['touch-throttle','t'],['touch-brake','b'],['touch-steering','s']]){
 const el=$(id);
 el.addEventListener('pointerdown',e=>{if(!touchActive()||[...touchPointers.values()].includes(key))return;e.preventDefault();touchAudio();el.setPointerCapture(e.pointerId);touchPointers.set(e.pointerId,key);el.classList.add('pressed');if(key==='s')steeringOrigin=e.clientX;else touchInput[key]=1;});
 el.addEventListener('pointermove',e=>{if(touchPointers.get(e.pointerId)!==key||key!=='s')return;e.preventDefault();const range=Math.min(76,el.clientWidth*.37),v=clamp((e.clientX-steeringOrigin)/range,-1,1);touchInput.s=Math.sign(v)*Math.pow(Math.max(0,(Math.abs(v)-.025)/.975),1.35);el.style.setProperty('--steer',(v*range)+'px');el.setAttribute('aria-valuenow',String(Math.round(touchInput.s*100)));});
 const up=e=>{if(touchPointers.get(e.pointerId)!==key)return;touchPointers.delete(e.pointerId);touchInput[key]=0;el.classList.remove('pressed');if(key==='s'){el.style.setProperty('--steer','0px');el.setAttribute('aria-valuenow','0');}};
 for(const event of['pointerup','pointercancel','lostpointercapture'])el.addEventListener(event,up);
}
$('touch-pause').onclick=()=>{releaseTouch();pause();};$('touch-camera').onclick=()=>cycleCamera();$('touch-reset').onclick=()=>{releaseTouch();resetCar();};
const touchObserver=new MutationObserver(()=>{const active=touchActive();touchUI.hidden=!device.mobile||!active;if(!active)releaseTouch();});touchObserver.observe(document.body,{attributes:true,attributeFilter:['data-screen']});
addEventListener('blur',releaseTouch);addEventListener('pagehide',releaseTouch);addEventListener('orientationchange',()=>{releaseTouch();if(state==='race'||state==='count')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){releaseTouch();if(state==='race'||state==='count')pause();}});
document.addEventListener('pointerdown',()=>{if(device.mobile)touchAudio();},{passive:true});
let renderContextLost=false;
if(ren){ren.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();renderContextLost=true;releaseTouch();if(state==='race'||state==='count')pause();$('pause-note').textContent='Graphics interrupted. Restoring…';});ren.domElement.addEventListener('webglcontextrestored',()=>{renderContextLost=false;showroom.dirty=true;resize(true);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}ren.shadowMap.needsUpdate=true;$('pause-note').textContent='Ready to resume.';});}
