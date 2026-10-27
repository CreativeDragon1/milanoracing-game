// ---- standard Gamepad API: USB and OS-paired Bluetooth controllers ----
const padInput={t:0,b:0,s:0};let activePad=null,padPrevious=[],padWasConnected=false,padSignature='',padError='',controllerReturn='menu',lastRumble=0,navHeld=0,navNext=0;
function gamepads(){try{if(!navigator.getGamepads){padError='This browser does not expose the Gamepad API. Try Edge or Chrome.';return []}return Array.from(navigator.getGamepads()).filter(p=>p&&p.connected)}catch(e){padError='Controller access is blocked here. Open the game directly in Edge or Chrome, or on localhost.';return []}}
const padButton=(p,i)=>p.buttons[i]?clamp(p.buttons[i].value||Number(p.buttons[i].pressed),0,1):0;
function readPad(p,dz,speed=0){if(!p||p.mapping!=='standard')return {t:0,b:0,s:0};const raw=clamp(p.axes[0]||0,-1,1),v=Math.abs(raw)<=dz?0:Math.sign(raw)*(Math.abs(raw)-dz)/(1-dz);return {t:padButton(p,7),b:padButton(p,6),s:Math.sign(v)*Math.pow(Math.abs(v),1.15+.45*clamp((Math.abs(speed)-12)/38,0,1))}}
function cycleCamera(){camMode=(camMode+1)%4;S.cam=camMode;saveS();snap=true;msg(['CHASE','NOSE','WIDE CHASE','AERIAL'][camMode],900)}
function resetCar(){if(typeof GP!=='undefined'&&GP.weekend){if(GP.weekend.player.pit)return;GP.weekend.resetPenalty()}placeCar(c.idx);invalid('RESET · LAP INVALID');rumble(.2,.45,120)}
function toggleFullscreen(){if(document.fullscreenElement){document.exitFullscreen?.().catch(()=>{})}else document.documentElement.requestFullscreen?.().catch(()=>{})}
function openControllers(){if(state==='race'||state==='count')pause();controllerReturn=document.querySelector('.ov.on')?.id||'menu';show('controllers')}
function closeControllers(){show(controllerReturn==='controllers'?'menu':controllerReturn)}
$('connection').onclick=openControllers;$('connect-menu').onclick=openControllers;$('pause-controller').onclick=openControllers;$('controller-back').onclick=closeControllers;$('fullscreen-menu').onclick=toggleFullscreen;
$('bluetooth-help').onclick=()=>{$('pairing').hidden=!$('pairing').hidden;$('bluetooth-help').textContent=$('pairing').hidden?'Bluetooth pairing':'Close pairing guide'};
$('deadzone').value=S.dz;$('dz-value').textContent=Math.round(S.dz*100)+'%';$('deadzone').oninput=e=>{S.dz=+e.target.value;$('dz-value').textContent=Math.round(S.dz*100)+'%';saveS()};
$('vibration').checked=!!S.vib;$('vibration').onchange=e=>{S.vib=e.target.checked?1:0;saveS()};
$('padselect').onchange=e=>{activePad=+e.target.value;const p=gamepads().find(q=>q.index===activePad);padPrevious=p?p.buttons.map(b=>b.value>.5||b.pressed):[]};
function rumble(weak=.2,strong=.35,duration=90,force=false){const now=performance.now();if(!S.vib||(!force&&now-lastRumble<110))return false;const p=gamepads().find(p=>p.index===activePad),a=p&&p.vibrationActuator;if(!a||!a.playEffect)return false;lastRumble=now;try{const result=a.playEffect('dual-rumble',{startDelay:0,duration,weakMagnitude:weak,strongMagnitude:strong});if(result&&result.catch)result.catch(()=>{});return true}catch(e){return false}}
$('rumble-test').onclick=()=>{$('paddetail').textContent=rumble(.55,.75,260,true)?'Vibration requested. Support depends on the controller and browser.':S.vib?'Vibration is not exposed by this controller or browser.':'Enable vibration first.'};
function navMenu(direction){const ov=document.querySelector('.ov.on');if(!ov)return;const controls=Array.from(ov.querySelectorAll('button,input,select')).filter(el=>!el.disabled&&el.getClientRects().length);if(!controls.length)return;const i=controls.indexOf(document.activeElement);const next=controls[(i+direction+controls.length)%controls.length];next.focus();next.scrollIntoView({block:'nearest'})}
function padActionMenu(rising,p,now){const ov=document.querySelector('.ov.on');if(!ov)return;const vert=padButton(p,13)>.5?1:padButton(p,12)>.5?-1:0;if(vert&&(vert!==navHeld||now>=navNext)){navMenu(vert);navNext=now+(vert===navHeld?150:380)}navHeld=vert;
 const el=document.activeElement;if(el&&ov.contains(el)&&el.matches('input[type=range]')){const dir=rising(15)?1:rising(14)?-1:0;if(dir){el.value=clamp(+el.value+dir*(+el.step||.01),+el.min,+el.max);el.dispatchEvent(new Event('input',{bubbles:true}))}}
 if(rising(0)){audioInit();if(el&&ov.contains(el)){if(el.matches('button,input[type=checkbox]'))el.click();else if(el.matches('select')){el.selectedIndex=(el.selectedIndex+1)%el.options.length;el.dispatchEvent(new Event('change'))}}else navMenu(1)}
 if(rising(1)){if(ov.id==='controllers')closeControllers();else if(ov.id==='pause')resume();else{state='menu';$('hud').hidden=true;show('menu')}}
}
function pollController(now){const pads=gamepads();let p=pads.find(q=>q.index===activePad);if(!p&&padWasConnected){padWasConnected=false;activePad=null;padPrevious=[];Object.assign(padInput,{t:0,b:0,s:0});if(state==='race'||state==='count'){pause();$('pause-note').textContent='Controller disconnected. Reconnect it or use the keyboard, then resume.'}msg('CONTROLLER DISCONNECTED · SESSION PAUSED',2500)}
 if(!p){p=pads.find(q=>q.mapping==='standard')||pads[0];if(p){activePad=p.index;padPrevious=p.buttons.map(b=>b.pressed);padWasConnected=true}}else padWasConnected=true;
 const signature=pads.map(q=>q.index+':'+q.id+':'+q.mapping).join('|')+'@'+activePad;
 if(signature!==padSignature||padError){padSignature=signature;$('padselect').replaceChildren(...pads.map(q=>{const o=document.createElement('option');o.value=q.index;o.textContent=q.id;o.selected=q.index===activePad;return o}));$('padselect').hidden=pads.length<2;
 $('connection').classList.toggle('connected',!!p&&p.mapping==='standard');$('padbadge').textContent=p?(p.mapping==='standard'?'Controller connected':'Controller needs mapping'):'Controller setup';$('padname').textContent=p?p.id:'Waiting for a controller…';$('paddetail').textContent=padError||(p?(p.mapping==='standard'?'Connected. Move the stick or press a trigger to test.':'Unrecognized layout. Try USB or a browser that provides standard mapping. Keyboard controls remain available.'):'Pair in Bluetooth settings or connect USB, then press a button.');}
 const input=readPad(p,S.dz,c.vx);Object.assign(padInput,document.hasFocus()&&!document.hidden?input:{t:0,b:0,s:0});
 $('test-brake').style.width=input.b*100+'%';$('test-throttle').style.width=input.t*100+'%';$('test-steer').style.left=(50+input.s*49)+'%';
 if(!p||p.mapping!=='standard'){padPrevious=[];return}const rising=i=>padButton(p,i)>.5&&!padPrevious[i];
 if(document.hasFocus()&&!document.hidden){const oldState=state;if(rising(9)){audioInit();if(state==='race'||state==='count')pause();else if(state==='pause'){resume()} }
 if(oldState===state){if(state==='race'){if(rising(3))cycleCamera();if(rising(2))resetCar();if(typeof GP!=='undefined'&&GP.weekend){if(rising(5))gpPitRequest();if(rising(4))gpCycleTyre();if(rising(15))gpSkipPit()}}else if(state!=='count')padActionMenu(rising,p,now)}}
 padPrevious=p.buttons.map(b=>b.value>.5||b.pressed);
}
addEventListener('gamepadconnected',()=>{padSignature=''});addEventListener('gamepaddisconnected',()=>{padSignature=''});
document.addEventListener('pointerdown',()=>audioInit(),{once:true});
