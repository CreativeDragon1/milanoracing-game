$('current-circuit').textContent=CIRCUIT.name;
$('host-circuit').textContent=CIRCUIT.name+' · '+(LEN/1000).toFixed(3)+' km';
const themes={desert:'DESERT / SUNSET',city:'CITY / NIGHT',park:'PARKLAND',harbour:'STREET / HARBOUR',alpine:'ALPINE',airfield:'GRAND PRIX',marina:'MARINA / SUNSET',forest:'ARDENNES / FOREST',metropolis:'CITY / HILLS',dunes:'DUNES / BANKING'};
for(const track of Object.values(CIRCUITS)){
 const button=document.createElement('button');button.className='circuit-card'+(track.id===CIRCUIT.id?' selected':'');button.dataset.circuit=track.id;button.setAttribute('aria-label',track.name+', '+(track.length/1000).toFixed(3)+' kilometres');button.setAttribute('aria-pressed',String(track.id===CIRCUIT.id));
 const canvas=document.createElement('canvas');canvas.width=400;canvas.height=220;const context=canvas.getContext('2d'),minX=Math.min(...track.x),maxX=Math.max(...track.x),minZ=Math.min(...track.z),maxZ=Math.max(...track.z),fit=Math.min(350/(maxX-minX),170/(maxZ-minZ));
 const map=(x,z)=>[200+(x-(minX+maxX)/2)*fit,110+(z-(minZ+maxZ)/2)*fit];context.lineJoin='round';context.lineWidth=5;context.strokeStyle=track.id===CIRCUIT.id?'#ffab6f':'#adcaee';context.beginPath();for(let i=0;i<track.N;i+=2){const p=map(track.x[i],track.z[i]);if(i===0)context.moveTo(...p);else context.lineTo(...p)}context.closePath();context.stroke();context.fillStyle='#fff';context.beginPath();context.arc(...map(track.x[0],track.z[0]),5,0,7);context.fill();button.append(canvas);
 const title=document.createElement('strong');title.textContent=track.name;button.append(title);const setting=document.createElement('small');setting.textContent=themes[track.theme];button.append(setting);
 const detail=document.createElement('small');detail.className='circuit-detail';detail.textContent=(track.length/1000).toFixed(3)+' KM  /  '+track.officialTurns+' TURNS';button.append(detail);button.onclick=()=>chooseCircuit(track.id);$('circuit-grid').append(button);
}
