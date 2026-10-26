// Telemetry is shared; timing belongs exclusively to the active session.
// Reuse nodes and leave unchanged text alone to avoid repeated HUD relayout.
const hudNodes=new Map();
function hudNode(id){if(!hudNodes.has(id))hudNodes.set(id,$(id));return hudNodes.get(id)}
function hudText(id,value){const node=hudNode(id),text=String(value);if(node.textContent!==text)node.textContent=text}
function hudStyle(id,key,value){const node=hudNode(id);if(node.style[key]!==value)node.style[key]=value}
function hudKicker(value){let node=hudNodes.get('current-kicker');if(!node){node=$('tc').querySelector('.hud-kicker');hudNodes.set('current-kicker',node)}if(node.textContent!==value)node.textContent=value}
let hudRevLights;
function hud(){const R=race,v=Math.abs(c.vx)*3.6;
 if(!hudRevLights)hudRevLights=document.querySelectorAll('#rev-lights i');
 const revs=Math.round(clamp((driveSound.state.rpm-4500)/13500,0,1)*12);
 hudRevLights.forEach((el,i)=>el.classList.toggle('lit',i<revs));
 hudText('spd',Math.round(v));hudText('gr',c.reverse?'R':v<1?'N':c.gear);hudText('rpm',Math.round(driveSound.state.rpm/10)*10+' RPM');
 hudStyle('bt','width',inp.t*100+'%');hudStyle('bb','width',inp.b*100+'%');hudStyle('bs','width',(50+inp.s*50)+'%');
 const managed=(typeof GP!=='undefined'&&GP.weekend)||(typeof MP!=='undefined'&&MP.active);
 if(!managed){
  hudKicker('CURRENT LAP');hudText('session-type',mode==='tt'?'TIME TRIAL':'PRACTICE');
  hudText('cur',fmt(R.started?Math.max(0,R.t-R.lapStart)*1000:0));
  hudText('lap',R.started?'LAP '+R.lapNo+(mode==='tt'?' · 3':''):'OUT LAP');
  hudText('val',R.started?(R.valid?'VALID LAP':'INVALID LAP'):'CROSS THE LINE TO START TIMING');
  const cls=R.valid?'':'bad';if(hudNode('val').className!==cls)hudNode('val').className=cls;
  hudText('bst','BEST '+fmt(R.best)+(isFinite(R.pbOld)?' · PB '+fmt(Math.min(R.pbOld,R.best)):''));
  const rf=R.ref&&R.ref[c.idx>>3];
  if(R.started&&Number.isFinite(rf)){const d=R.t-R.lapStart-rf;hudText('dl','DELTA '+(d>=0?'+':'−')+Math.abs(d).toFixed(3));hudStyle('dl','color',d>0?'#ff6b75':'var(--ok)')}
  else{hudText('dl','DELTA --');hudStyle('dl','color','var(--tx2)')}
  hudText('sec',R.laps.length?'LAST '+fmt(R.last)+' · S '+R.laps[R.laps.length-1].sec.map(s=>(s/1000).toFixed(1)).join(' · '):'');
 }
 drawCircuitMap();
 const g=hudNode('gph').getContext('2d');g.clearRect(0,0,220,70);g.strokeStyle='#738bff';g.beginPath();gph.forEach((s,i)=>{const X=i*220/400,Y=68-s/320*64;i?g.lineTo(X,Y):g.moveTo(X,Y)});g.stroke();
}
