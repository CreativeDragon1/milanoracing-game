function decodeBase64Bytes(encoded){if(Uint8Array.fromBase64)return Uint8Array.fromBase64(encoded);const text=atob(encoded),bytes=new Uint8Array(text.length);for(let i=0;i<text.length;i++)bytes[i]=text.charCodeAt(i);return bytes;}
// Mapped circuit coordinates are embedded for offline play.
const CIRCUITS=__WORLD_TOUR_DATA__;
let selectedCircuit='milano';
try{selectedCircuit=new URL(location.href).searchParams.get('circuit')||localStorage.getItem('mrs:tour:circuit')||'milano'}catch(e){}
if(!CIRCUITS[selectedCircuit])selectedCircuit='bahrain';
const CIRCUIT=CIRCUITS[selectedCircuit],THEME=CIRCUIT.theme;
const PIT_LANES=__PIT_LANES__,PIT=PIT_LANES[CIRCUIT.id];
const N=CIRCUIT.N,W=CIRCUIT.width/2,LEN=CIRCUIT.length;
const cx=CIRCUIT.x,cz=CIRCUIT.z,tx=CIRCUIT.tx,tz=CIRCUIT.tz,nx=tz.map(v=>-v),nz=tx.slice();
const cy=CIRCUIT.elevation?.height||cx.map(()=>0);
function sampleHeight(station){const f=(station%N+N)%N,i=Math.floor(f);return cy[i]+(cy[(i+1)%N]-cy[i])*(f-i)}
function bankAt(station){const f=(station%N+N)%N,i=Math.floor(f),b=CIRCUIT.bank||[];return (b[i]||0)+((b[(i+1)%N]||0)-(b[i]||0))*(f-i)}
function surfaceHeight(i,offset=0){return cy[(i%N+N)%N]-offset*Math.tan(bankAt(i))}
function roadHeightAt(x,z,hint=-1){const p=prog(x,z,hint),i=p.s*N/LEN;return sampleHeight(i)-p.d*Math.tan(bankAt(i))}
function roadPitchAt(x,z,heading,hint=-1){const dx=Math.cos(heading)*2,dz=Math.sin(heading)*2;return Math.atan2(roadHeightAt(x+dx,z+dz,hint)-roadHeightAt(x-dx,z-dz,hint),4)}
// Terrain is baked once; bucketed triangle interpolation also anchors scenery to it.
let terrainVertices=null,terrainCells=null;
function loadTerrain(){if(terrainCells)return;terrainCells=new Map();const data=CIRCUIT.elevation?.terrain;if(!data)return;const bytes=decodeBase64Bytes(data);const raw=new Float32Array(bytes.buffer),clean=[];for(let k=0;k<raw.length;k+=9){const a=(raw[k+3]-raw[k])*(raw[k+8]-raw[k+2])-(raw[k+5]-raw[k+2])*(raw[k+6]-raw[k]);if(Math.abs(a)<.00001)continue;for(let j=0;j<9;j++)clean.push(raw[k+j])}terrainVertices=new Float32Array(clean);const v=terrainVertices;for(let i=0;i<v.length;i+=9){const minX=Math.floor(Math.min(v[i],v[i+3],v[i+6])/60),maxX=Math.floor(Math.max(v[i],v[i+3],v[i+6])/60),minZ=Math.floor(Math.min(v[i+2],v[i+5],v[i+8])/60),maxZ=Math.floor(Math.max(v[i+2],v[i+5],v[i+8])/60);for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){const key=x+':'+z;if(!terrainCells.has(key))terrainCells.set(key,[]);terrainCells.get(key).push(i)}}}
function localTerrainHeight(x,z){loadTerrain();const list=terrainCells.get(Math.floor(x/60)+':'+Math.floor(z/60)),v=terrainVertices;if(list)for(const i of list){const ax=v[i],az=v[i+2],bx=v[i+3],bz=v[i+5],dx=v[i+6],dz=v[i+8],den=(bz-dz)*(ax-dx)+(dx-bx)*(az-dz);const a=((bz-dz)*(x-dx)+(dx-bx)*(z-dz))/den,b=((dz-az)*(x-dx)+(ax-dx)*(z-dz))/den;if(a>=-1e-5&&b>=-1e-5&&a+b<=1.00001)return a*v[i+1]+b*v[i+4]+(1-a-b)*v[i+7]}return null}
function groundHeight(x,z){return localTerrainHeight(x,z)??(geography?regionalGroundHeight(x,z):-.015)}
function trackHalf(i,side=1){const f=(i%N+N)%N,k=Math.floor(f),a=side>0?CIRCUIT.widthRight:CIRCUIT.widthLeft;return a?a[k]+(a[(k+1)%N]-a[k])*(f-k):W}
const trackBounds={x:Math.min(...cx),X:Math.max(...cx),z:Math.min(...cz),Z:Math.max(...cz)};
const circuitCentre={x:(trackBounds.x+trackBounds.X)/2,z:(trackBounds.z+trackBounds.Z)/2},circuitRadius=Math.hypot(trackBounds.X-trackBounds.x,trackBounds.Z-trackBounds.z)/2;
const pitGateCache=new Map();
function pitOpening(i,side){const key=i+':'+side;if(pitGateCache.has(key))return pitGateCache.get(key);const off=trackBarrier(i,side),x=cx[i]+nx[i]*off,z=cz[i]+nz[i]*off;let hit=false;for(let k=0;k<PIT.x.length;k+=2)if((PIT.x[k]-x)**2+(PIT.z[k]-z)**2<36){hit=true;break}pitGateCache.set(key,hit);return hit}
function trackBarrier(i,side){return side*(trackHalf(i,side)+(side>0?CIRCUIT.runoffRight[i]:CIRCUIT.runoffLeft[i]))}
function prog(px,pz,hint){let bi=0,bd=Infinity,bt=0,bx=0,bz=0;
 const test=i=>{const j=(i+1)%N,dx=cx[j]-cx[i],dz=cz[j]-cz[i],u=clamp(((px-cx[i])*dx+(pz-cz[i])*dz)/(dx*dx+dz*dz),0,1),qx=cx[i]+dx*u,qz=cz[i]+dz*u,dd=(px-qx)**2+(pz-qz)**2;if(dd<bd){bd=dd;bi=i;bt=u;bx=qx;bz=qz}};
 if(hint>=0){for(let k=-12;k<=12;k++)test((hint+k+N)%N);const separation=Math.abs(bi-hint);if(Math.min(separation,N-separation)>=11||bd>900)for(let k=-35;k<=35;k++)test((hint+k+N)%N);}if(hint<0||bd>2500){bd=Infinity;for(let i=0;i<N;i++)test(i)}
 const j=(bi+1)%N,dx=cx[j]-cx[bi],dz=cz[j]-cz[bi],dl=Math.hypot(dx,dz);
 return{i:bt>.5?j:bi,d:((pz-bz)*dx-(px-bx)*dz)/dl,s:(bi+bt)*LEN/N};
}
function chooseCircuit(id){if(!CIRCUITS[id]||id===CIRCUIT.id){show('menu');return}try{localStorage.setItem('mrs:tour:circuit',id)}catch(e){}const url=new URL(location.href);url.searchParams.set('circuit',id);location.href=url.href}
