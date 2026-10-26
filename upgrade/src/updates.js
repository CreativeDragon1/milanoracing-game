// Hosted builds revalidate their shell. Never replace code during a session.
(() => {
 const download=document.getElementById('desktop-download');
 download.href=location.protocol==='file:'?'https://game.milanoracing.team/downloads/Milano-Apex-Windows.zip':'/downloads/Milano-Apex-Windows.zip';
 const online=document.getElementById('play-latest');online.hidden=location.protocol!=='file:';
 if(location.protocol==='file:')return;
 let current='',pending='',busy=false;
 function safe(){return window.MilanoReady&&state==='menu'&&document.getElementById('menu').classList.contains('on')&&!(typeof MP!=='undefined'&&MP.active)}
 function apply(){if(pending&&safe()){pending='';location.reload()}}
 async function check(){
  if(busy||document.hidden)return;busy=true;
  try{const response=await fetch('/api/build',{cache:'no-store',credentials:'same-origin'});if(!response.ok)return;const data=await response.json();if(!/^[a-f0-9]{64}$/.test(data.build||''))return;
   if(!current)current=window.MilanoBuildId||data.build;
   if(data.build!==current){pending=data.build;apply()}
  }catch{}finally{busy=false}
 }
 window.MilanoUpdates={check,apply,get pending(){return pending}};
 setTimeout(check,12000);setInterval(check,300000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});
 document.addEventListener('click',()=>{if(pending)setTimeout(apply,0)});
})();
