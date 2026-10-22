// Local-network ghost races. Server owns countdown, checkpoints and results.
const MP={active:false,available:false,inviteBase:location.origin,token:'',me:'',room:null,epoch:-1,startAt:0,clockOffset:0,latency:0,busy:false,nextPoll:0,lastGood:0,lastStamp:0,ghosts:new Map(),finished:false};
function mpError(text){$('network-error').textContent=text;$('lobby-note').textContent=text;$('network-results-note').textContent=text}
function mpRemember(){try{sessionStorage.setItem('mrs:lan',JSON.stringify({token:MP.token,circuit:MP.room?.circuit}))}catch(e){}}
// Persistent encrypted connection; REST fallback for proxies that block upgrades.
const mpPending=new Map();let mpRequestId=0,mpConnecting=null,mpNextConnect=0;
async function mpConnect(){
 if(MP.socket?.readyState===1)return MP.socket;if(mpConnecting)return mpConnecting;if(Date.now()<mpNextConnect)return null;
 mpConnecting=new Promise(resolve=>{const ws=new WebSocket(location.origin.replace(/^http/,'ws')+'/api/ws');let done=false;
 const finish=value=>{if(done)return;done=true;clearTimeout(timeout);mpConnecting=null;resolve(value)};
 const timeout=setTimeout(()=>{ws.close();mpNextConnect=Date.now()+5000;finish(null)},4000);
 ws.onopen=()=>{MP.socket=ws;finish(ws)};
 ws.onmessage=e=>{try{const d=JSON.parse(e.data),p=mpPending.get(d.rid);if(!p)return;mpPending.delete(d.rid);clearTimeout(p.timer);d.error?p.reject(Error(d.error)):p.resolve(d.result)}catch(e){}};
 ws.onerror=()=>{mpNextConnect=Date.now()+3000;finish(null)};
 ws.onclose=()=>{if(MP.socket===ws)MP.socket=null;mpNextConnect=Date.now()+1500;finish(null);for(const [id,p]of mpPending){clearTimeout(p.timer);p.reject(Error('Reconnecting to the grid...'));mpPending.delete(id)}};
 });return mpConnecting;
}
async function mpRequest(action,extra={}){
 const start=Date.now(),payload={action,token:MP.token,...extra};let result;
 const ws=await mpConnect();
 if(ws){const rid=++mpRequestId;result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{mpPending.delete(rid);reject(Error('Connection timed out. Reconnecting...'));ws.close()},5000);mpPending.set(rid,{resolve,reject,timer});ws.send(JSON.stringify({rid,...payload}))})}
 else{const response=await fetch('/api/race',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(7000)});result=await response.json();if(!response.ok)throw Error(result.error||'Server request failed.')}
 if(result.serverNow){const rtt=Date.now()-start;MP.latency=rtt;const offset=result.serverNow-(start+Date.now())/2;MP.clockOffset=MP.lastGood?MP.clockOffset*.85+offset*.15:offset;MP.lastGood=Date.now()}
 return result;
}
function mpApply(data){
 if(!data.room||data.serverNow<MP.lastStamp)return;MP.lastStamp=data.serverNow;
 MP.room=data.room;MP.me=data.me;if(data.token)MP.token=data.token;MP.active=true;MP.startAt=data.room.startAt;if(data.token)mpRemember();
 if(data.room.circuit!==CIRCUIT.id){chooseCircuit(data.room.circuit);return}
 const me=data.room.players.find(p=>p.id===MP.me);if(!me){mpLeave(false);return}
 if(data.room.phase==='lobby'){
  MP.finished=false;if(state!=='menu'||document.body.dataset.screen!=='lobby'){state='menu';$('hud').hidden=true;show('lobby')}
  mpLobby();
 }else if(data.room.epoch!==MP.epoch){
  MP.epoch=data.room.epoch;MP.finished=false;
  for(const k of ['df','brake','grip'])S[k]=1;S.steer=.85;refreshGuideSpeeds();
  newSession('mp');placeCar((N-3-me.slot*3+N)%N);c.x=me.x;c.z=me.z;c.h=me.h;race.cd=(MP.startAt-(Date.now()+MP.clockOffset))/1000;race.started=true;race.lapNo=1;
 }
 if(me.warning==='POSITION REJECTED'||me.warning==='CHECKPOINT REJECTED'){c.x=me.x;c.z=me.z;c.h=me.h;c.vx=me.v;c.vy=c.r=0;snap=true}
 if(data.room.phase==='results'||me.finish!==null||me.dnf){MP.finished=true;c.vx=c.vy=c.r=0;state='network-results';keys.clear();show('network-results');mpResults();}
 mpOpponents();mpStandings();
}
let lobbySignature="",standingsSignature="";
function mpLobby(){
 const signature=JSON.stringify([MP.room.code,MP.room.host,MP.room.players.map(p=>[p.id,p.name,p.ready])]);if(signature===lobbySignature)return;lobbySignature=signature;
 const r=MP.room,me=r.players.find(p=>p.id===MP.me),host=r.host===MP.me;
 $('lobby-code').textContent=r.code;$('lobby-track').textContent=CIRCUITS[r.circuit].name+' · '+r.laps+(r.laps===1?' LAP':' LAPS')+' · GHOST RACE';
 $('lobby-title').textContent='Grid '+r.players.length+' / 16';$('lobby-players').replaceChildren();
 for(const p of r.players){const row=document.createElement('div');row.className='driver-row';const dot=document.createElement('i');dot.style.background=p.color;const name=document.createElement('b');name.textContent=p.name+(p.id===r.host?' · HOST':'')+(p.id===MP.me?' · YOU':'');const status=document.createElement('span');status.textContent=p.ready?'READY':'NOT READY';row.append(dot,name,status);$('lobby-players').append(row)}
 $('ready-room').textContent=me.ready?'Not ready':'Ready';$('start-room').hidden=!host;$('start-room').disabled=r.players.length<2||r.players.some(p=>!p.ready);
 $('lobby-note').textContent=host?'Start when every driver is ready.':'Waiting for the host to start.';
}
function mpStandings(){
 if(!MP.room)return;const signature=JSON.stringify(MP.room.players.map(p=>[p.id,p.name,p.lap,p.finish,p.dnf]));$('network-ping').textContent=Math.round(MP.latency)+' MS';if(signature===standingsSignature)return;standingsSignature=signature;$('network-order').replaceChildren();
 MP.room.players.forEach((p,i)=>{const row=document.createElement('div');row.className='position-row'+(p.id===MP.me?' me':'');const n=document.createElement('span');n.textContent=i+1;const name=document.createElement('b');name.textContent=p.name;const status=document.createElement('small');status.textContent=p.dnf?'DNF':p.finish!==null?'FIN':p.lap+'/'+MP.room.laps;row.append(n,name,status);$('network-order').append(row)});
 $('network-ping').textContent=Math.round(MP.latency)+' MS';
}
function mpResults(){
 const r=MP.room;$('network-results-track').textContent=CIRCUIT.name+' · '+r.laps+' LAP'+(r.laps>1?'S':'');$('network-result-list').replaceChildren();
 r.players.forEach((p,i)=>{const row=document.createElement('div');row.className='driver-row';const pos=document.createElement('b');pos.textContent=i+1;const name=document.createElement('b');name.textContent=p.name+(p.id===MP.me?' · YOU':'');const time=document.createElement('span');time.textContent=p.dnf?'DNF':p.finish===null?'RACING · LAP '+(p.lap+1):fmt(p.finish+p.penalty*1000)+(p.penalty?' (+'+p.penalty+'s)':'');row.append(pos,name,time);$('network-result-list').append(row)});
 $('network-rematch').hidden=r.host!==MP.me;$('network-rematch').disabled=r.phase!=='results';$('network-results-note').textContent=r.phase==='results'?(r.host===MP.me?'Return everyone to the lobby for another race.':'Waiting for the host to reopen the lobby.'):'Waiting for the remaining drivers. Results include track-limit penalties.';
}
function mpOpponents(){
 const ids=new Set();for(const p of MP.room.players){if(p.id===MP.me)continue;ids.add(p.id);let g=MP.ghosts.get(p.id);
  if(!g){const group=car.clone(true);group.traverse(o=>{if(o.isMesh)o.castShadow=false});const marker=new T.Mesh(new T.BoxGeometry(.5,.10,1.3),new T.MeshBasicMaterial({color:p.color}));marker.position.set(-1,1.65,0);group.add(marker);
   const texture=canvasTex(512,96,(x,w,h)=>{x.fillStyle='#0b1428d9';x.fillRect(0,0,w,h);x.fillStyle=p.color;x.fillRect(0,0,8,h);x.fillStyle='white';x.font='bold 39px Arial';x.textAlign='center';x.fillText(p.name.slice(0,18),w/2,62)}),label=new T.Sprite(new T.SpriteMaterial({map:texture,depthTest:true,transparent:true}));label.position.set(0,2.35,0);label.scale.set(3.6,.675,1);group.add(label);scene.add(group);g={group,target:p,label,texture,marker,samples:[],lastX:p.x,lastZ:p.z,wheelAngle:0};MP.ghosts.set(p.id,g);group.position.set(p.x,roadHeightAt(p.x,p.z),p.z)}
  if(!g.samples.length||MP.lastStamp>g.samples.at(-1).time){if(g.samples.length&&Math.hypot(p.x-g.samples.at(-1).x,p.z-g.samples.at(-1).z)>45)g.samples=[];g.samples.push({...p,time:MP.lastStamp});if(g.samples.length>12)g.samples.shift()}g.target=p;g.group.visible=!p.dnf&&MP.room.phase!=='lobby';
 }
 for(const[id,g]of MP.ghosts)if(!ids.has(id)){scene.remove(g.group);g.texture.dispose();g.label.material.dispose();g.marker.geometry.dispose();g.marker.material.dispose();MP.ghosts.delete(id)}
}
async function mpJoin(kind){
 if(MP.busy)return;mpError('');MP.busy=true;
 try{const name=$('driver-name').value.trim()||'Driver';try{localStorage.setItem('mrs:driver-name',name)}catch(e){}const data=await mpRequest(kind,{name,circuit:CIRCUIT.id,laps:+$('network-laps').value,code:$('room-code').value.trim().toUpperCase(),listed:!!$('listed-room')?.checked});mpApply(data)}catch(e){mpError(e.message)}finally{MP.busy=false}
}
async function mpAction(action,extra={}){const token=MP.token;try{const data=await mpRequest(action,extra);if(MP.active&&MP.token===token)mpApply(data)}catch(e){mpError(e.message)}}
async function mpLeave(notify=true){
 const token=MP.token;MP.socket?.close();MP.socket=null;mpNextConnect=0;MP.active=false;MP.token='';MP.room=null;MP.epoch=-1;MP.lastStamp=0;MP.finished=false;lobbySignature=standingsSignature='';
 try{sessionStorage.removeItem('mrs:lan')}catch(e){}
 for(const g of MP.ghosts.values()){scene.remove(g.group);g.texture.dispose();g.label.material.dispose();g.marker.geometry.dispose();g.marker.material.dispose()}MP.ghosts.clear();
 $('tc').querySelector('.hud-kicker').textContent='LAP TIME';$('network-standings').hidden=true;state='menu';$('hud').hidden=true;keys.clear();padInput.t=padInput.b=padInput.s=0;c.vx=0;show('menu');
 if(notify&&token)fetch('/api/race',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'leave',token}),keepalive:true}).catch(()=>{});
 const restored=loadS();Object.assign(S,restored);buildSL();refreshGuideSpeeds();
}
// A small snapshot buffer absorbs network arrival jitter. Prediction is bounded
// to 60 ms; a stale peer stops rather than drifting indefinitely through barriers.
function sampleGhost(samples,time){if(!samples.length)return null;let a=samples[0];if(time<=a.time)return a;for(let i=1;i<samples.length;i++){const b=samples[i];if(time<=b.time){const t=clamp((time-a.time)/(b.time-a.time),0,1);return{x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,h:a.h+Math.atan2(Math.sin(b.h-a.h),Math.cos(b.h-a.h))*t,v:a.v+(b.v-a.v)*t}}a=b;}const dt=clamp((time-a.time)/1000,0,.06);return{...a,x:a.x+Math.cos(a.h)*a.v*dt,z:a.z+Math.sin(a.h)*a.v*dt}}
const ghostPosition=new T.Vector3();
function mpFrame(now,dt){
 if(!MP.active)return;
 for(const g of MP.ghosts.values()){const p=sampleGhost(g.samples,Date.now()+MP.clockOffset-120)||g.target;g.group.position.set(p.x,roadHeightAt(p.x,p.z),p.z);g.group.rotation.order='YXZ';g.group.rotation.y=-p.h;g.group.rotation.x=-bankAt(prog(p.x,p.z,-1).i);g.group.rotation.z=roadPitchAt(p.x,p.z,p.h);g.wheelAngle-=Math.hypot(p.x-g.lastX,p.z-g.lastZ)/.37;g.lastX=p.x;g.lastZ=p.z;if(!g.spins){g.spins=[];g.group.traverse(o=>{if(o.userData.wheelSpin)g.spins.push(o)})}for(const spin of g.spins)spin.rotation.z=g.wheelAngle;}

 if(!MP.busy&&now>=MP.nextPoll){MP.busy=true;MP.nextPoll=now+(MP.socket?.readyState===1?50:100);const token=MP.token;const payload=state==='race'?{car:{x:c.x,z:c.z,h:c.h,v:c.vx}}:{};
  mpRequest('poll',payload).then(data=>{if(MP.active&&MP.token===token)mpApply(data)}).catch(e=>{if(!MP.active||MP.token!==token)return;mpError(e.message);if(Date.now()-MP.lastGood>15000){c.vx=0;if(state==='race'||state==='count')pause();$('pause-note').textContent='Connection lost. The race clock continues. Reconnecting automatically. Your place is held for 30 seconds.'}if(/expired|closed/.test(e.message)){mpLeave(false);show('network');mpError(e.message)}}).finally(()=>{MP.busy=false});
 }
}
function mpHud(){
 $('network-standings').hidden=!MP.active||!['race','count','pause'].includes(state);
 if(!MP.active||!MP.room||!race)return;const me=MP.room.players.find(p=>p.id===MP.me);if(!me)return;
 $('session-type').textContent='ONLINE RACE';$('lap').textContent='LAP '+Math.min(MP.room.laps,me.lap+1)+' / '+MP.room.laps;
 $('val').textContent=me.warning||'GHOST RACE · '+MP.room.players.length+' DRIVERS';$('val').className=me.invalid?'bad':'';
 $('cur').textContent=fmt(Math.max(0,Date.now()+MP.clockOffset-MP.startAt));$('tc').querySelector('.hud-kicker').textContent='RACE TIME';$('bst').textContent='BEST LAP '+fmt(me.best??Infinity);$('dl').textContent='POSITION '+(MP.room.players.findIndex(p=>p.id===MP.me)+1)+' / '+MP.room.players.length;$('sec').textContent=me.penalty?'PENALTIES +'+me.penalty+' SEC':'';
}
const soloPause=pause,soloReset=resetCar;
pause=function(){soloPause();if(MP.active){c.vx=c.vy=c.r=0;$('pause-note').textContent='Your car is stopped. The network race clock continues.';$('restart').hidden=true;$('endS').hidden=true;$('tomenu').textContent='Leave network race'}else{$('restart').hidden=false;$('endS').hidden=false;$('tomenu').textContent='Main menu'}};
resetCar=function(){if(MP.active){if(state!=='race')return;mpRequest('reset').then(data=>{const me=data.room.players.find(p=>p.id===MP.me);placeCar(c.idx);c.x=me.x;c.z=me.z;c.h=me.h;mpApply(data)}).catch(e=>msg(e.message));}else soloReset()};
$('tomenu').onclick=()=>{if(MP.active)mpLeave();else{state='menu';$('hud').hidden=true;show('menu')}};
$('create-room').onclick=()=>mpJoin('create');$('join-room').onclick=()=>mpJoin('join');$('ready-room').onclick=()=>mpAction('ready',{ready:!MP.room.players.find(p=>p.id===MP.me)?.ready});$('start-room').onclick=()=>mpAction('start');$('leave-room').onclick=()=>mpLeave();$('network-exit').onclick=()=>mpLeave();$('network-rematch').onclick=()=>mpAction('rematch');
$('copy-room').onclick=async()=>{const u=new URL(MP.inviteBase);u.search='?multiplayer=1&room='+MP.room.code;try{await navigator.clipboard.writeText(u.href);$('lobby-note').textContent='Invite copied. Send it to the other drivers.'}catch(e){$('lobby-note').textContent='Share this page address and room code '+MP.room.code}};
try{$('driver-name').value=localStorage.getItem('mrs:driver-name')||''}catch(e){}
(async()=>{
 if(location.protocol==='http:'||location.protocol==='https:')try{const r=await fetch('/api/info',{signal:AbortSignal.timeout(15000)}),info=await r.json();MP.available=info.name==='Milano LAN';if(info.addresses?.length&&(location.hostname==='localhost'||location.hostname==='127.0.0.1'))MP.inviteBase=info.addresses[0]}catch(e){}
 $('network-online').hidden=!MP.available;$('network-offline').hidden=MP.available;
 const query=new URL(location.href).searchParams;if(query.has('multiplayer'))show('network');if(query.has('room'))$('room-code').value=query.get('room').slice(0,6);
 if(MP.available)try{const saved=JSON.parse(sessionStorage.getItem('mrs:lan'));if(saved?.token){MP.token=saved.token;mpApply(await mpRequest('resume'))}}catch(e){sessionStorage.removeItem('mrs:lan');MP.token='';mpError(e.message)}
})();

// Keep a paused background tab connected while the driver returns to the race.
setInterval(()=>{if(MP.active&&document.hidden)mpFrame(performance.now(),0)},1000);

const listedLabel=document.createElement('label');listedLabel.innerHTML='<input id="listed-room" type="checkbox"> Show this room on the grid';$('create-room').before(listedLabel);
async function browseGrid(){if(!MP.available||MP.active||document.body.dataset.screen!=='network')return;try{const data=await mpRequest('list'),box=$('network-browse');box.replaceChildren();for(const r of data.rooms){const b=document.createElement('button');b.textContent=CIRCUITS[r.circuit].name+' / '+r.players+' drivers / '+r.laps+' laps';b.onclick=()=>{$('room-code').value=r.code;mpJoin('join')};box.append(b)}}catch(e){}}
setInterval(browseGrid,5000);
