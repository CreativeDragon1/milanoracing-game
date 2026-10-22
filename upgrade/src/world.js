// ---- renderer & world ----
let sceneAssetsLoaded=false;const sceneAssetErrors=[];
T.DefaultLoadingManager.onLoad=()=>{sceneAssetsLoaded=true};
T.DefaultLoadingManager.onProgress=(url,done,total)=>{const el=document.getElementById('load-progress');if(el)el.textContent='Preparing circuit '+Math.round(done/Math.max(1,total)*100)+'%'};
T.DefaultLoadingManager.onError=url=>{sceneAssetErrors.push(url.startsWith('data:')?'Embedded visual asset':url)};

let ren;try{ren=new T.WebGLRenderer({canvas:$('c'),antialias:true,powerPreference:'high-performance'})}catch(e){$('err').classList.add('on')}
const scene=new T.Scene(),cam=new T.PerspectiveCamera(58,1,.12,8000);
if(ren){ren.outputEncoding=T.sRGBEncoding;ren.toneMapping=T.ACESFilmicToneMapping;ren.toneMappingExposure=.95;ren.shadowMap.enabled=!S.q;ren.shadowMap.type=T.PCFSoftShadowMap}
const isNight=THEME==='city';scene.background=new T.Color(isNight?0x111c38:0xccaea0);scene.fog=new T.FogExp2(isNight?0x111c38:0xc4aca2,.00032);
scene.add(new T.HemisphereLight(0xabc8ed,0x70644e,isNight?.8:.48));
const sunDirection=new T.Vector3(.90,.18,.35).normalize();
const sun=new T.DirectionalLight(isNight?0xabc8ed:0xffb97d,isNight?.65:1.65);sun.position.copy(sunDirection).multiplyScalar(230);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-90,right:90,top:90,bottom:-90,near:1,far:480});sun.shadow.bias=-.00018;sun.shadow.normalBias=.025;sun.shadow.radius=2.5;scene.add(sun,sun.target);
const fill=new T.DirectionalLight(0x9bbcff,.24);fill.position.set(40,70,80);scene.add(fill);
const windTime={value:0};
const sky=new T.Mesh(new T.SphereGeometry(7000,40,24),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{sunDir:{value:sunDirection},nightMix:{value:isNight?1:0},photoSky:{value:null},photoReady:{value:0}},vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`
uniform sampler2D photoSky;uniform float photoReady;uniform vec3 sunDir;uniform float nightMix;varying vec3 vP;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float cloudNoise(vec2 p){float n=0.;float a=.55;for(int i=0;i<4;i++){n+=noise(p)*a;p=p*2.03+vec2(8.1,4.7);a*=.5;}return n;}

void main(){vec3 d=normalize(vP);float h=max(d.y,0.);float sunAmount=max(dot(d,sunDir),0.);
vec3 zenith=vec3(.045,.14,.30),horizon=vec3(.79,.40,.22);
float facing=pow(sunAmount,5.);
vec3 c=mix(mix(vec3(.34,.29,.36),horizon,facing),zenith,pow(h,.46));
c+=vec3(1.3,.43,.10)*pow(sunAmount,28.)+vec3(.35,.18,.09)*pow(sunAmount,3.)*exp(-h*7.);
vec2 uv=d.xz/(max(d.y,.025)+.17);
float clouds=cloudNoise(uv*vec2(1.8,4.0));
float layer=smoothstep(.40,.73,clouds)*smoothstep(.035,.12,h)*(1.-smoothstep(.50,.85,h));
float rim=smoothstep(.42,.53,clouds)*(1.-smoothstep(.53,.65,clouds));
vec3 cloudCol=mix(vec3(.15,.18,.25),vec3(.95,.46,.24),facing*.7)+vec3(.5,.26,.11)*rim*facing;
c=mix(c,cloudCol,layer*.72);
float wisps=smoothstep(.58,.78,cloudNoise(uv*vec2(3.,.65)+17.))*smoothstep(.2,.5,h);
c=mix(c,vec3(.50,.43,.46),wisps*.16);
float disc=smoothstep(.99980,.99994,sunAmount);
c+=vec3(14.,8.,3.6)*disc+vec3(.75,.32,.10)*pow(sunAmount,350.);
if(d.y<0.)c=mix(vec3(.49,.30,.22),vec3(.07,.085,.07),min(-d.y*8.,1.));c=mix(c,mix(vec3(.012,.025,.07),vec3(.035,.075,.16),1.-h),nightMix);if(photoReady>.5){vec2 eq=vec2(atan(d.z,d.x)*.15915494+.5,asin(clamp(d.y,-1.,1.))*.31830989+.5);c=texture2D(photoSky,eq).rgb*mix(vec3(1.08,.94,.84),vec3(.96,1.,1.04),smoothstep(0.,.7,d.y));}gl_FragColor=vec4(c,1.);
#include <tonemapping_fragment>
#include <encodings_fragment>
}` }));sky.material.fog=false;scene.add(sky);
const linear=c=>new T.Color(c).convertSRGBToLinear();
const M=(c,m=.15,r=.5)=>new T.MeshStandardMaterial({color:linear(c),metalness:m,roughness:r,envMapIntensity:.75});

let seed=84731;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
function canvasTex(w,h,fn){const el=document.createElement('canvas');el.width=w;el.height=h;fn(el.getContext('2d'),w,h);const t=new T.CanvasTexture(el);t.encoding=T.sRGBEncoding;if(ren)t.anisotropy=Math.min(8,ren.capabilities.getMaxAnisotropy());return t}
// Prefilter the actual sky once: paint and glass reflect the same sunset as the view.
let sunsetEnvironment;
if(ren){const environmentScene=new T.Scene();environmentScene.add(sky.clone());const pmrem=new T.PMREMGenerator(ren);sunsetEnvironment=pmrem.fromScene(environmentScene,.035,.1,5000);scene.environment=sunsetEnvironment.texture;pmrem.dispose()}
function pbrTexture(url,color=false){const t=new T.TextureLoader().load(url);t.encoding=color?T.sRGBEncoding:T.LinearEncoding;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=ren?Math.min(16,ren.capabilities.getMaxAnisotropy()):1;return t}
const asphalt=pbrTexture('__ASPHALT_COLOR__',true),asphaltNormal=pbrTexture('__ASPHALT_NORMAL__'),asphaltRough=pbrTexture('__ASPHALT_ROUGH__');
let hdrReady=false;
if(ren&&!isNight)new T.RGBELoader().setDataType(T.HalfFloatType).load('__SUNSET_HDR__',hdr=>{const half=new Float32Array(32768);for(let j=0;j<32768;j++){const e=j>>10,f=j&1023;half[j]=e?Math.pow(2,e-15)*(1+f/1024):f*Math.pow(2,-24)}const data=hdr.image.data,ww=hdr.image.width,hh=hdr.image.height;let peak=-1,px=0,py=0;for(let y=0;y<hh/2;y+=2)for(let x=0;x<ww;x+=2){const i=(y*ww+x)*4,l=half[data[i]]*.2126+half[data[i+1]]*.7152+half[data[i+2]]*.0722;if(l>peak){peak=l;px=x;py=y}}const theta=(px/ww-.5)*Math.PI*2,elevation=(.5-py/hh)*Math.PI;sunDirection.set(Math.cos(theta)*Math.cos(elevation),Math.sin(elevation),Math.sin(theta)*Math.cos(elevation));const pm=new T.PMREMGenerator(ren),env=pm.fromEquirectangular(hdr);if(sunsetEnvironment)sunsetEnvironment.dispose();sunsetEnvironment=env;scene.environment=env.texture;pm.dispose();sky.material.uniforms.photoSky.value=hdr;sky.material.uniforms.photoReady.value=1;hdrReady=true});
const grass=canvasTex(256,256,x=>{x.fillStyle=(THEME==='desert'||THEME==='marina')?'#b59c76':(THEME==='city'||THEME==='harbour')?'#636d77':'#58624a';x.fillRect(0,0,256,256);for(let i=0;i<9000;i++){x.fillStyle=(THEME==='desert'||THEME==='marina')?(rand()>.5?'#cab68d':'#a38b69'):(THEME==='city'||THEME==='harbour')?'#777c85':(rand()>.5?'#75805d':'#414e3b');x.globalAlpha=.3;x.fillRect(rand()*256,rand()*256,2,3)}});grass.wrapS=grass.wrapT=T.RepeatWrapping;grass.repeat.set(190,190);
const grassMaterial=new T.MeshStandardMaterial({map:grass,roughness:1,envMapIntensity:.35});
grassMaterial.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 landscapePos;').replace('#include <begin_vertex>','#include <begin_vertex>\nlandscapePos=(modelMatrix*vec4(position,1.)).xyz;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 landscapePos;').replace('#include <map_fragment>','#include <map_fragment>\nfloat landVariation=sin(landscapePos.x*.027+sin(landscapePos.z*.013)*2.)*sin(landscapePos.z*.036);float mow=smoothstep(-.1,.1,sin(landscapePos.x*.24));diffuseColor.rgb*=.85+landVariation*.17+mow*.10;');};
const gnd=new T.Mesh(new T.PlaneGeometry(Math.max(6000,circuitRadius*3),Math.max(6000,circuitRadius*3)),grassMaterial);gnd.rotation.x=-Math.PI/2;gnd.position.set(circuitCentre.x,-.015,circuitCentre.z);gnd.receiveShadow=true;if(!geography)scene.add(gnd);
loadTerrain();if(terrainVertices){const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(terrainVertices,3));const uv=new Float32Array(terrainVertices.length/3*2);for(let i=0,j=0;i<terrainVertices.length;i+=3){uv[j++]=terrainVertices[i]/6000+.5;uv[j++]=-terrainVertices[i+2]/6000+.5}geometry.setAttribute('uv',new T.BufferAttribute(uv,2));geometry.computeVertexNormals();{const norms=geometry.getAttribute('normal'),pos=geometry.getAttribute('position'),shared=new Map(),keys=[];for(let i=0;i<pos.count;i++){const k=Math.round(pos.getX(i)*100)+':'+Math.round(pos.getY(i)*100)+':'+Math.round(pos.getZ(i)*100);keys.push(k);const a=shared.get(k)||new T.Vector3();a.add(new T.Vector3(norms.getX(i),norms.getY(i),norms.getZ(i)));shared.set(k,a)}shared.forEach(v=>v.normalize());for(let i=0;i<pos.count;i++){const a=shared.get(keys[i]);norms.setXYZ(i,a.x,a.y,a.z)}}const land=new T.Mesh(geometry,grassMaterial);land.name="Circuit terrain";land.receiveShadow=true;scene.add(land)}
const col=h=>linear(h).toArray();
// Shared small maps: detailed surfaces without per-stone geometry or extra lights.
const gravel=canvasTex(512,512,(x,w,h)=>{x.fillStyle='#938676';x.fillRect(0,0,w,h);for(let i=0;i<36000;i++){const v=Math.floor(95+rand()*80);x.fillStyle=`rgb(${v+12},${v+5},${v})`;x.fillRect(rand()*w,rand()*h,1+rand()*3,1+rand()*2)}});gravel.wrapS=gravel.wrapT=T.RepeatWrapping;
const roadProfile=canvasTex(N,1,x=>{for(let i=0;i<N;i++){const v=Math.round((CIRCUIT.line.offset[i]/(2*W)+.5)*255);x.fillStyle=`rgb(${v},${v},${v})`;x.fillRect(i,0,1,1)}});roadProfile.encoding=T.LinearEncoding;roadProfile.wrapS=T.RepeatWrapping;roadProfile.minFilter=roadProfile.magFilter=T.LinearFilter;roadProfile.generateMipmaps=false;
function ribbon(a,b,y,cf,surface=false){const P=[],C=[],U=[],D=[],NM=[];for(let i=0;i<N;i++){const j=(i+1)%N,c0=cf(i),off=(value,k)=>Array.isArray(value)?value[k]:value;for(const[k,edge,station]of[[i,a,i],[i,b,i],[j,b,i+1],[i,a,i],[j,b,i+1],[j,a,i+1]]){const o=off(edge,k);P.push(cx[k]+nx[k]*o,y+surfaceHeight(k,o),cz[k]+nz[k]*o);C.push(...c0);U.push(o/5,station*LEN/N/5);D.push(o,station/N);const a=(k+N-1)%N,b=(k+1)%N,curv=(tx[k]*(tz[b]-tz[a])-tz[k]*(tx[b]-tx[a]))/(2*LEN/N),grade=(CIRCUIT.elevation?.grade[k]||0)/Math.max(.25,1-curv*o),q=1/Math.hypot(grade,1);const bk=Math.tan(bankAt(k)),nn=new T.Vector3(-grade*tx[k]+bk*nx[k],1,-grade*tz[k]+bk*nz[k]).normalize();NM.push(nn.x,nn.y,nn.z)}}
const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('color',new T.Float32BufferAttribute(C,3));g.setAttribute('uv',new T.Float32BufferAttribute(U,2));g.setAttribute('roadData',new T.Float32BufferAttribute(D,2));g.setAttribute('normal',new T.Float32BufferAttribute(NM,3));const paved=surface===true||surface==='paved';
const material=new T.MeshStandardMaterial({vertexColors:true,map:paved?asphalt:surface==='gravel'?gravel:null,roughness:.87,normalMap:paved?asphaltNormal:null,normalScale:new T.Vector2(.34,.34),roughnessMap:paved?asphaltRough:null,envMapIntensity:.52,side:T.DoubleSide});
if(surface===true){material.onBeforeCompile=shader=>{shader.uniforms.roadProfile={value:roadProfile};shader.uniforms.roadHalfWidth={value:W};shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 roadData;varying vec2 roadCoord;').replace('#include <begin_vertex>','#include <begin_vertex>\nroadCoord=roadData;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D roadProfile;uniform float roadHalfWidth;varying vec2 roadCoord;').replace('#include <map_fragment>',`#include <map_fragment>
float guide=(texture2D(roadProfile,vec2(fract(roadCoord.y),.5)).r-.5)*2.*roadHalfWidth;
float groove=exp(-pow((roadCoord.x-guide)/2.1,2.));
float grain=fract(sin(dot(floor(vUv*750.),vec2(12.9898,78.233)))*43758.5453);
float marbles=smoothstep(.935,.98,grain)*smoothstep(2.5,5.,abs(roadCoord.x-guide));
diffuseColor.rgb*=mix(.96,.70,groove)*( .96+grain*.08)*(1.-marbles*.30);
`)};}
if(CIRCUIT.bank?.some(v=>Math.abs(v)>.001))g.computeVertexNormals();const mesh=new T.Mesh(g,material);mesh.receiveShadow=true;scene.add(mesh);return mesh}
const barrierColor=pbrTexture('__CONCRETE_COLOR__',true),barrierNormal=pbrTexture('__CONCRETE_NORMAL__');
function wall(o,hh,c){const P=[],UV=[],profile=[[0,0],[0,hh-.13],[.08,hh],[.42,hh],[.55,hh*.67],[.55,0]];for(let i=0;i<N;i++){const j=(i+1)%N,off=k=>Array.isArray(o)?o[k]:o,side=Math.sign(off(i));if(pitOpening(i,side))continue;const point=(k,p)=>{const a=off(k)+side*p[0];return [cx[k]+nx[k]*a,surfaceHeight(k,a)+p[1],cz[k]+nz[k]*a]};for(let p=0;p<profile.length;p++){const q=(p+1)%profile.length;for(const [k,kp,u,v]of[[i,p,i*LEN/N,0],[j,p,(i+1)*LEN/N,0],[j,q,(i+1)*LEN/N,1],[i,p,i*LEN/N,0],[j,q,(i+1)*LEN/N,1],[i,q,i*LEN/N,1]]){P.push(...point(k,profile[kp]));UV.push(u/3,v/3)}}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('uv',new T.Float32BufferAttribute(UV,2));g.computeVertexNormals();const m=new T.Mesh(g,new T.MeshStandardMaterial({map:barrierColor,normalMap:barrierNormal,normalScale:new T.Vector2(.32,.32),color:0xc8c9c5,roughness:.91,side:T.DoubleSide}));m.name='Solid chamfered safety barrier';m.castShadow=true;m.receiveShadow=true;scene.add(m)}
function physicalKerb(side){const P=[],C=[],profile=[[0,.027],[.28,.075],[1.15,.09],[1.5,.035]];for(let i=0;i<N;i++){const j=(i+1)%N,color=Math.floor(i*LEN/N/2.8)%2?KR:WL;for(let k=0;k<profile.length-1;k++)for(const [station,a]of[[i,k],[i,k+1],[j,k+1],[i,k],[j,k+1],[j,k]]){const [x,y]=profile[a],o=side*(trackHalf(station,side)+x);P.push(cx[station]+nx[station]*o,surfaceHeight(station,o)+y,cz[station]+nz[station]*o);C.push(...color)}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('color',new T.Float32BufferAttribute(C,3));g.computeVertexNormals();const m=new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:true,roughness:.72,side:T.DoubleSide}));m.name='Profiled raised kerb';m.receiveShadow=true;m.castShadow=true;scene.add(m)}
// Close exposed earth beneath raised runoff edges at tight uphill hairpins.
// The two faces share one material; buried portions cost no extra scene objects.
const foundationMaterial=new T.MeshStandardMaterial({color:linear(THEME==='desert'||THEME==='marina'?0x81715c:0x606356),map:gravel,roughness:1,side:T.DoubleSide,envMapIntensity:.3});
function trackFoundation(offset){if(!terrainVertices)return;const P=[],U=[];for(let i=0;i<N;i++){if(CIRCUIT.features?.overpass&&CIRCUIT.features.overpass.stations.some(a=>Math.abs(i-a)<14))continue;const j=(i+1)%N;for(const [k,top,station]of[[i,0,i],[i,1,i],[j,1,i+1],[i,0,i],[j,1,i+1],[j,0,i+1]]){const xx=cx[k]+nx[k]*offset[k],zz=cz[k]+nz[k]*offset[k],y=top?surfaceHeight(k,offset[k])-.006:Math.min(surfaceHeight(k,offset[k])-1,groundHeight(xx,zz)-1);P.push(cx[k]+nx[k]*offset[k],y,cz[k]+nz[k]*offset[k]);U.push(station*LEN/N/5,y/5)}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('uv',new T.Float32BufferAttribute(U,2));g.computeVertexNormals();const m=new T.Mesh(g,foundationMaterial);m.receiveShadow=true;scene.add(m)}
const RO=col(0x827365),WL=col(0xece6d8),KR=col(CIRCUIT.id==='milano'?0xff7a00:0xc92329),KB=col(CIRCUIT.id==='milano'?0x0019ff:THEME==='marina'?0x27a6b0:0x328c65);
const barrierLeft=cx.map((_,i)=>trackBarrier(i,-1)),barrierRight=cx.map((_,i)=>trackBarrier(i,1));
const pavedRunoff=['desert','marina','city','harbour'].includes(THEME);
const runoffColor=col(pavedRunoff?0x747577:0xc3b6a0);
ribbon(cx.map((_,i)=>trackHalf(i,1)+1.5),barrierRight,.003,()=>runoffColor,pavedRunoff?'paved':'gravel');ribbon(barrierLeft,cx.map((_,i)=>-trackHalf(i,-1)-1.5),.003,()=>runoffColor,pavedRunoff?'paved':'gravel');
const roadSurface=ribbon(cx.map((_,i)=>-trackHalf(i,-1)),cx.map((_,i)=>trackHalf(i,1)),.025,()=>col(0xbfc2c7),true);
// Painted paved-runoff bands follow available space and never extend through walls.
if(pavedRunoff){for(const side of[-1,1]){const bounds=side>0?barrierRight:barrierLeft,inner=cx.map((_,i)=>side*(trackHalf(i,side)+Math.min(4,Math.abs(bounds[i])-trackHalf(i,side)))),outer=cx.map((_,i)=>side*(trackHalf(i,side)+Math.max(1.5,(Math.abs(bounds[i])-trackHalf(i,side))*.85)));ribbon(inner,outer,.009,i=>col(THEME==='marina'?((i>>2)&1?0x289d9e:0x70b4b1):THEME==='desert'?((i>>2)&1?0x8e4140:0xc9c5b8):0x345b65))}}
physicalKerb(1);physicalKerb(-1);
ribbon(cx.map((_,i)=>trackHalf(i,1)-.4),cx.map((_,i)=>trackHalf(i,1)-.18),.041,()=>WL);ribbon(cx.map((_,i)=>-trackHalf(i,-1)+.18),cx.map((_,i)=>-trackHalf(i,-1)+.4),.041,()=>WL);
ribbon(cx.map((_,i)=>trackHalf(i,1)+1.1),barrierRight.map((v,i)=>Math.min(v,trackHalf(i,1)+2.4)),.018,()=>KB);ribbon(barrierLeft.map((v,i)=>Math.max(v,-trackHalf(i,-1)-2.4)),cx.map((_,i)=>-trackHalf(i,-1)-1.1),.018,()=>KB);
wall(barrierRight,1.2,0x363e4a);wall(barrierLeft,1.2,0x363e4a);trackFoundation(barrierRight);trackFoundation(barrierLeft);
const box=(w,h,d,c,x,y,z,r=0)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),M(c,.15,.65));m.position.set(x,y+groundHeight(x,z),z);m.rotation.y=r;m.receiveShadow=true;m.castShadow=true;scene.add(m);return m};
const h0=-Math.atan2(tz[0],tx[0]);
const grid=canvasTex(128,512,(x,w,h)=>{for(let a=0;a<4;a++)for(let b=0;b<16;b++){x.fillStyle=(a+b)%2?'#161a24':'#f4eee3';x.fillRect(a*32,b*32,32,32)}});
const finishLine=new T.Mesh(new T.PlaneGeometry(1.6,W*2),new T.MeshStandardMaterial({map:grid,roughness:.8}));finishLine.rotation.set(-Math.PI/2,0,-h0);finishLine.position.set(cx[0],cy[0]+.047,cz[0]);finishLine.quaternion.setFromEuler(new T.Euler(0,h0,Math.atan(CIRCUIT.elevation?.grade[0]||0),'YXZ')).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2));scene.add(finishLine);
for(let k=1;k<=20;k++){const i=(N-Math.round(k*8/(LEN/N)))%N,side=k%2?2.4:-2.4;box(.12,.01,2.1,0xcccac2,cx[i]+nx[i]*side,.043,cz[i]+nz[i]*side,-Math.atan2(tz[i],tx[i]));}
function textTexture(text,bg='#111929',fg='#f2ede4',sub='MILANO RACING'){return canvasTex(1024,256,(x,w,h)=>{x.fillStyle=bg;x.fillRect(0,0,w,h);x.fillStyle='#ff8138';x.fillRect(0,0,12,h);x.fillStyle=fg;x.textAlign='center';x.font='bold 95px Bahnschrift,Arial';x.fillText(text,w/2,130);x.fillStyle='#9caac8';x.font='25px Arial';x.fillText(sub,w/2,198)})}
function board(text,x,y,z,rot,w=18,h=3,sub='MILANO RACING'){const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:textTexture(text,undefined,undefined,sub),side:T.DoubleSide}));m.position.set(x,y+groundHeight(x,z),z);m.rotation.y=rot;scene.add(m);return m}
for(const s of[-1,1])box(.65,8,.65,0x30394c,cx[0]+nx[0]*s*(W+1.5),4,cz[0]+nz[0]*s*(W+1.5),h0);
box(.85,1.8,W*2+4,0x172139,cx[0],7.7,cz[0],h0);
board('MILANO RACING',cx[0]-.45,7.7,cz[0],-Math.PI/2+h0,17,1.8,'TEAM EDITION  /  START · FINISH');
for(let j=0;j<5;j++){const o=(j-2)*1.1;const l=new T.Mesh(new T.SphereGeometry(.2,12,8),new T.MeshStandardMaterial({color:0x50c695,emissive:0x1d6041,emissiveIntensity:.5}));l.position.set(cx[0]-.5,cy[0]+6.6,cz[0]+o);scene.add(l)}
// __CIRCUIT_SCENERY__
// __SUNSET_LANDSCAPE__
// Distance boards are measured along the alignment to each corner entry.
for(const turn of CIRCUIT.turns){const entry=turn.station-(Math.abs(turn.angleDeg)*Math.PI/180*turn.radius+turn.transition)/2,side=turn.angleDeg>0?-1:1;for(const distance of [150,100,50]){const i=Math.round(((entry-distance+LEN)%LEN)/LEN*N)%N,o=side*(trackHalf(i,side)+2.5);board(String(distance),cx[i]+nx[i]*o,1.2,cz[i]+nz[i]*o,-Math.atan2(tz[i],tx[i])-Math.PI/2,1.8,1.6,'BRAKING')}}
// Actual Fusion STEM Racing mesh, scaled uniformly for the full-size circuit.
const stemAsset=__STEM_CAR__;
const car=new T.Group(),wheels=[];let stemBody;
const atlas=new T.TextureLoader().load('__CAR_ATLAS__');atlas.encoding=T.sRGBEncoding;atlas.anisotropy=ren?Math.min(16,ren.capabilities.getMaxAnisotropy()):1;
const bodyPaint=new T.MeshPhysicalMaterial({map:atlas,metalness:.28,roughness:.29,clearcoat:1,clearcoatRoughness:.14,envMapIntensity:.85});
bodyPaint.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat chroma=max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b))-min(diffuseColor.r,min(diffuseColor.g,diffuseColor.b));float paintMask=(1.-smoothstep(.002,.01,chroma))*(1.-smoothstep(.08,.18,diffuseColor.r));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.009,.015,.027),paintMask*.65);')};
const tyrePaint=new T.MeshStandardMaterial({map:atlas,color:linear(0x3e4143),metalness:.02,roughness:.86,envMapIntensity:.32});
tyrePaint.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat wear=fract(sin(dot(floor(vUv*1700.),vec2(12.9898,78.233)))*43758.5453);diffuseColor.rgb*=.78+wear*.22;')};
for(const part of stemAsset.parts){
 const bytes=Uint8Array.from(atob(part.data),c=>c.charCodeAt(0)),values=new Float32Array(bytes.buffer),buffer=new T.InterleavedBuffer(values,8),geo=new T.BufferGeometry();
 geo.setAttribute('position',new T.InterleavedBufferAttribute(buffer,3,0));geo.setAttribute('normal',new T.InterleavedBufferAttribute(buffer,3,3));geo.setAttribute('uv',new T.InterleavedBufferAttribute(buffer,2,6));geo.computeBoundingSphere();
 const mesh=new T.Mesh(geo,part.name==='body'?bodyPaint:tyrePaint);mesh.castShadow=true;mesh.receiveShadow=true;
 if(part.name==='body'){stemBody=mesh;car.add(mesh);}else{const pv=new T.Group(),sp=new T.Group();pv.position.set(...part.center);sp.userData.wheelSpin=true;sp.add(mesh);pv.add(sp);car.add(pv);wheels.push({pv,sp,front:part.center[0]>0})}
}
const logoTexture=new T.TextureLoader().load('__LOGO_DATA__');logoTexture.encoding=T.sRGBEncoding;logoTexture.anisotropy=8;
const logoMat=new T.MeshPhysicalMaterial({map:logoTexture,color:0xffffff,transparent:true,alphaTest:.05,metalness:.08,roughness:.4,clearcoat:.7,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2});
// Project each mark onto the real body mesh, preserving the original artwork.
const teamDecals=[];
function teamDecal(origin,direction,width,height,rotation){stemBody.updateMatrixWorld(true);const ray=new T.Raycaster(new T.Vector3(...origin),new T.Vector3(...direction)),hit=ray.intersectObject(stemBody)[0];if(!hit)return;const size=new T.Vector3(width,height,.22),orientation=new T.Euler(...rotation);for(const logo of[false,true]){const material=logo?logoMat:new T.MeshPhysicalMaterial({color:0xe8e5db,roughness:.42,clearcoat:.4,polygonOffset:true,polygonOffsetFactor:-2});if(logo)material.polygonOffsetFactor=-4;const geometry=new T.DecalGeometry(stemBody,hit.point,orientation,logo?size.clone().multiplyScalar(.94):size),mesh=new T.Mesh(geometry,material);mesh.receiveShadow=true;mesh.renderOrder=logo?2:1;car.add(mesh);teamDecals.push(mesh)}}
teamDecal([1.55,3,0],[0,-1,0],.84,.28,[-Math.PI/2,0,0]);
for(const side of[-1,1])teamDecal([-1.1,.90,side*3],[0,0,-side],.85,.29,[0,side>0?0:Math.PI,0]);
const rainLight=new T.Mesh(new T.BoxGeometry(.025,.085,.16),new T.MeshStandardMaterial({color:0xff3018,emissive:0xff1800,emissiveIntensity:1}));rainLight.position.set(-2.55,.38,0);car.add(rainLight);scene.add(car);
const shadowMap=canvasTex(128,128,(x,w,h)=>{const g=x.createRadialGradient(64,64,8,64,64,64);g.addColorStop(0,'rgba(0,0,0,.6)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,w,h)});
const contactShadow=new T.Mesh(new T.PlaneGeometry(6.8,2.8),new T.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false}));contactShadow.rotation.x=-Math.PI/2;scene.add(contactShadow);
