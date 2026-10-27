// Pointer capture keeps steering and pedals independent during multi-touch.
// Cancellation, rotation, backgrounding and menus always release every control.
const touchUI=document.createElement('div');touchUI.id='touch-controls';touchUI.hidden=!device.mobile;
touchUI.innerHTML='<div class="touch-actions"><button id="touch-camera" aria-label="Change camera">CAM</button><button id="touch-reset" aria-label="Reset car">RESET</button><button id="touch-pause" aria-label="Pause race">Ⅱ</button></div><div id="touch-steering" role="slider" aria-label="Steering" aria-valuemin="-100" aria-valuemax="100" aria-valuenow="0"><span aria-hidden="true">‹</span><i></i><span aria-hidden="true">›</span></div><div class="touch-pedals"><button id="touch-brake" aria-label="Brake">BRAKE</button><button id="touch-throttle" aria-label="Accelerate">GO</button></div>';
document.body.append(touchUI);
const touchPointers=new Map(),touchCaptures=new Map();let touchPedalRects=null;
function releaseTouch(){touchPointers.clear();Object.assign(touchInput,{s:0,t:0,b:0});for(const [id,el] of touchCaptures)if(el.hasPointerCapture(id))el.releasePointerCapture(id);touchCaptures.clear();touchUI.querySelectorAll('.pressed').forEach(e=>e.classList.remove('pressed'));$('touch-steering').style.setProperty('--steer','0px');$('touch-steering').setAttribute('aria-valuenow','0');}
function touchSteeringValue(x,rect){const range=Math.min(device.touchLayout==='tablet'?66:52,rect.width*.34),raw=clamp((x-rect.left-rect.width/2)/range,-1,1);return{value:Math.sign(raw)*Math.max(0,(Math.abs(raw)-.035)/.965),travel:raw*range};}
function setTouchSteering(e,el){const r=el.getBoundingClientRect(),v=touchSteeringValue(device.rotated?e.clientY:e.clientX,device.rotated?{left:r.top,width:r.height}:r);touchInput.s=v.value;el.style.setProperty('--steer',v.travel+'px');el.setAttribute('aria-valuenow',String(Math.round(v.value*100)));}
function syncTouchPedals(){for(const [id,key]of[['touch-throttle','t'],['touch-brake','b']]){touchInput[key]=[...touchPointers.values()].includes(key)?1:0;$(id).classList.toggle('pressed',!!touchInput[key]);}}
function touchActive(){return !document.hidden&&(state==='race'||state==='count')&&document.body.dataset.screen==='none'||!document.hidden&&state==='count';}
function touchAudio(){audioInit();if(typeof AC!=='undefined'&&AC?.state!=='running')AC?.resume().catch(()=>{});}
for(const [id,key]of[['touch-throttle','t'],['touch-brake','b'],['touch-steering','s']]){
 const el=$(id);
 el.addEventListener('pointerdown',e=>{if(!touchActive()||e.button>0||[...touchPointers.values()].includes(key))return;e.preventDefault();touchAudio();el.setPointerCapture(e.pointerId);touchCaptures.set(e.pointerId,el);touchPointers.set(e.pointerId,key);el.classList.add('pressed');if(key==='s')setTouchSteering(e,el);else{touchPedalRects=[['t',$('touch-throttle').getBoundingClientRect()],['b',$('touch-brake').getBoundingClientRect()]];syncTouchPedals();}});
 el.addEventListener('pointermove',e=>{const held=touchPointers.get(e.pointerId);if(!held)return;e.preventDefault();if(held==='s')setTouchSteering(e,el);else{for(const [pedal,r] of touchPedalRects||[])if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom)touchPointers.set(e.pointerId,pedal);syncTouchPedals();}});
 const up=e=>{const held=touchPointers.get(e.pointerId);if(!held)return;touchPointers.delete(e.pointerId);touchCaptures.delete(e.pointerId);if(held==='s'){touchInput.s=0;el.classList.remove('pressed');el.style.setProperty('--steer','0px');el.setAttribute('aria-valuenow','0');}else syncTouchPedals();};
 for(const event of['pointerup','pointercancel','lostpointercapture'])el.addEventListener(event,up);
}
for(const [id,action]of[['touch-pause',()=>{releaseTouch();pause()}],['touch-camera',()=>cycleCamera()],['touch-reset',()=>{releaseTouch();resetCar()}]]){const el=$(id);el.addEventListener('pointerup',e=>{if(e.button>0)return;e.preventDefault();action()});el.onclick=e=>{if(e.detail===0)action()};}
const touchObserver=new MutationObserver(()=>{const active=touchActive();touchUI.hidden=!device.mobile||!active;if(!active)releaseTouch();});touchObserver.observe(document.body,{attributes:true,attributeFilter:['data-screen']});
let touchViewportWidth=viewportSize().w;
addEventListener('resize',()=>{const width=viewportSize().w;if(width!==touchViewportWidth)releaseTouch();touchViewportWidth=width;if(touchPointers.size)touchPedalRects=[['t',$('touch-throttle').getBoundingClientRect()],['b',$('touch-brake').getBoundingClientRect()]];});
addEventListener('blur',releaseTouch);addEventListener('pagehide',releaseTouch);addEventListener('orientationchange',()=>{releaseTouch();if(state==='race'||state==='count')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){releaseTouch();if(state==='race'||state==='count')pause();}});
document.addEventListener('pointerdown',()=>{if(device.mobile)touchAudio();},{passive:true});
let renderContextLost=false;
if(ren){ren.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();renderContextLost=true;releaseTouch();if(state==='race'||state==='count')pause();$('pause-note').textContent='Graphics interrupted. Restoring…';});ren.domElement.addEventListener('webglcontextrestored',()=>{renderContextLost=false;showroom.dirty=true;resize(true);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}ren.shadowMap.needsUpdate=true;$('pause-note').textContent='Ready to resume.';});}
