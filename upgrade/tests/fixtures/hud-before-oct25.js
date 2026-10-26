// Historical source fragments for targeted extraction only.
const fmt=ms=>{if(!isFinite(ms))return'--:--.---';const m=Math.floor(ms/60000),s=(ms%60000)/1000;return m+':'+(s<10?'0':'')+s.toFixed(3)};

// function finish(){

function hud(){const R=race,v=c.vx*3.6; $('session-type').textContent=mode==='tt'?'TIME TRIAL':'PRACTICE'; document.querySelectorAll('#rev-lights i').forEach((el,i)=>el.classList.toggle('lit',i<Math.round(clamp((driveSound.state.rpm-4500)/13500,0,1)*12)));
 $('spd').textContent=Math.round(v);$('gr').textContent=v<1?'N':c.gear;$('rpm').textContent=Math.round(driveSound.state.rpm/10)*10+' RPM';
 $('bt').style.width=inp.t*100+'%';$('bb').style.width=inp.b*100+'%';$('bs').style.width=(50+inp.s*50)+'%';
 const lt=R.started?(R.t-R.lapStart)*1000:0;$('cur').textContent=fmt(lt);$('lap').textContent=R.started?'LAP '+R.lapNo+(mode==='tt'?' / 3':''):'OUT-LAP';
 const vl=$('val');vl.textContent=R.started?(R.valid?'VALID LAP':'INVALID LAP'):'CROSS THE LINE TO START TIMING';vl.className=R.valid?'':'bad';
 $('bst').textContent='BEST '+fmt(R.best)+(isFinite(R.pbOld)?' · PB '+fmt(Math.min(R.pbOld,R.best)):'');
 const rf=R.ref&&R.ref[c.idx>>3],dl=$('dl');if(R.started&&Number.isFinite(rf)){const d=(R.t-R.lapStart)-rf;dl.textContent='DELTA '+(d>=0?'+':'−')+Math.abs(d).toFixed(3);dl.style.color=d>0?'#ff6b75':'var(--ok)'}else{dl.textContent='DELTA --';dl.style.color='var(--tx2)'}
 $('sec').textContent=R.laps.length?'LAST '+fmt(R.last)+' · S '+R.laps[R.laps.length-1].sec.map(s=>(s/1000).toFixed(1)).join(' / '):'';
 drawCircuitMap();
 const g=$('gph').getContext('2d');g.clearRect(0,0,220,70);g.strokeStyle='#738bff';g.beginPath();gph.forEach((s,i)=>{const X=i*220/400,Y=68-s/320*64;i?g.lineTo(X,Y):g.moveTo(X,Y)});g.stroke()}

// Quality presets

function gpHud(force=false){const w=GP.weekend;if(!w)return;const now=performance.now();if(!force&&now-GP.lastHUD<130)return;GP.lastHUD=now;const p=w.player,qual=w.phase.startsWith('qualifying'),order=w.standings(),pos=order.findIndex(d=>d.id===0)+1;const remaining=Math.max(0,w.duration-w.clock),mins=Math.floor(remaining/60),secs=Math.floor(remaining%60);$('session-type').textContent=qual?(w.cfg.qualifying==='full'?'Q'+(w.stage+1):'QUALIFYING'):'RACE';$('lap').textContent=qual?(w.expired?'CHEQUERED FLAG':mins+':'+String(secs).padStart(2,'0')):'LAP '+Math.min(w.cfg.laps,Math.max(1,Math.floor(Math.max(0,p.progress)/LEN)+1))+' · '+w.cfg.laps;$('val').textContent=p.pit?(p.pit.hold?'TYRE SERVICE':'PIT LIMIT '+PIT.speedLimitKmh+' KM/H'):qual?(p.outlap?'OUT LAP':p.valid?'PUSH LAP':'LAP DELETED'):(p.penalty?'+'+p.penalty+' SEC PENALTY':'P'+pos+' OF 22');$('val').className=qual&&!p.valid?'bad':'';
 const first=order[0];const rows=order.slice(0,5);if(!rows.some(d=>d.id===0))rows.push(p);$('gp-timing').innerHTML='<div class="gp-table-head">'+(qual?'CLASSIFICATION':'RACE ORDER')+'</div>'+rows.map(d=>{const position=order.indexOf(d)+1,time=qual?(Number.isFinite(d.best)?fmt(d.best*1000):'NO TIME'):(d.finished?'FINISHED':d.pit?'PIT':position===1?'LEADER':'+'+Math.max(0,(first.progress-d.progress)/Math.max(20,first.v)).toFixed(1));return '<div class="gp-row '+(d.id===0?'you':'')+'"><b>'+position+'</b><span>'+d.name+'</span><em style="color:'+RaceWeekend.TYRES[d.tyre].colour+'">'+RaceWeekend.TYRES[d.tyre].letter+'</em><small>'+time+'</small></div>'}).join('');
 $('gp-tyre').textContent=RaceWeekend.TYRES[p.tyre].name+' · '+Math.round((1-p.wear)*100)+'%';$('gp-pit-call').textContent=p.pit?'PIT ASSIST':p.requested?'BOX THIS LAP':'P or RB · BOX';$('gp-next-tyre').textContent='T or LB · '+RaceWeekend.TYRES[GP.pitChoice].name;$('gp-strategy-status').textContent=qual?'FINISH YOUR LAP AFTER THE FLAG':w.cfg.twoCompounds?(p.used.size>=2?'COMPOUND RULE MET':'USE TWO COMPOUNDS'):'OPEN STRATEGY';$('gp-pit-call').classList.toggle('called',p.requested);}

// function gpResults(
