const device={touch:navigator.maxTouchPoints>0&&matchMedia('(any-pointer: coarse)').matches,apple:/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)};
const touchInput={t:0,b:0,s:0};
device.mobile=device.touch||device.apple;
if(device.mobile)document.documentElement.classList.add('touch-device');
function viewportSize(){return{w:Math.max(1,Math.round(document.documentElement.clientWidth||innerWidth)),h:Math.max(1,Math.round(window.visualViewport?.height||innerHeight))};}
function renderPixelRatio(size=viewportSize()){const {w,h}=size,hero=typeof state!=='undefined'&&state==='menu',pixels=hero?3200000:1800000,cap=device.mobile||hero?Math.sqrt(pixels/(w*h)):1.75;return Math.min(devicePixelRatio||1,hero?2:S.q?1:graphicsPreset==='ultra'&&!device.mobile?1.75:1.5,cap);}
