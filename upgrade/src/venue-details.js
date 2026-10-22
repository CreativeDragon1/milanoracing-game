// Venue landmarks and furnishings, arranged by circuit sector from the research map index.
const venuePlans={
 milano:{stands:[[.16,-1,105,14,'PRIMA'],[.42,-1,120,12,'BELVEDERE'],[.70,1,80,10,'PICCO']],bridge:.76,climate:'alpine'},
 bahrain:{stands:[[.12,-1,90,12,'TURN ONE'],[.33,1,100,10,'OASIS'],[.91,-1,70,9,'VICTORY']],bridge:.56,climate:'desert'},
 singapore:{stands:[[.10,-1,100,12,'TURN 1'],[.40,1,110,12,'PADANG'],[.85,-1,80,10,'BAY']],bridge:.64,climate:'urban'},
 monza:{stands:[[.10,-1,95,12,'RETTIFILO'],[.57,-1,85,10,'ASCARI'],[.91,-1,95,12,'PARABOLICA']],bridge:.70,climate:'forest'},
 monaco:{stands:[[.05,1,65,9,'SAINTE DEVOTE'],[.76,-1,80,9,'TABAC'],[.88,-1,75,8,'PISCINE']],bridge:.78,climate:'harbour'},
 austria:{stands:[[.11,-1,100,12,'TURN ONE'],[.30,-1,90,10,'TURN THREE'],[.82,-1,100,11,'RED BULL RING']],bridge:.54,climate:'alpine'},
 silverstone:{stands:[[.35,-1,100,12,'LUFFIELD'],[.60,-1,110,12,'BECKETTS'],[.84,-1,90,12,'STOWE']],bridge:.76,climate:'airfield'},
 'abu-dhabi':{stands:[[.24,-1,120,12,'NORTH'],[.52,-1,100,13,'WEST'],[.81,-1,90,12,'MARINA']],bridge:.59,climate:'marina'},
 spa:{stands:[[.14,-1,120,17,'RAIDILLON'],[.34,-1,80,10,'LES COMBES'],[.93,-1,85,11,'CHICANE']],bridge:.42,climate:'forest'},
 suzuka:{stands:[[.10,-1,100,12,'FIRST CURVE'],[.52,-1,90,11,'HAIRPIN'],[.91,-1,110,12,'CHICANE']],bridge:.38,climate:'park'},
 interlagos:{stands:[[.10,-1,110,12,'S DO SENNA'],[.47,1,80,11,'FERRADURA'],[.94,-1,130,14,'ARQUIBANCADA']],bridge:.28,climate:'metropolis'},
 zandvoort:{stands:[[.08,-1,100,12,'TARZAN'],[.20,-1,90,10,'HUGENHOLTZ'],[.88,-1,80,10,'ARENA']],bridge:.52,climate:'dunes'}
};
const venuePlan=venuePlans[CIRCUIT.id],venueObjects=[];
function venuePoint(f,side,distance){const i=Math.round(f*N)%N,o=trackBarrier(i,side)+side*distance;return {i,x:cx[i]+nx[i]*o,z:cz[i]+nz[i]*o,a:-Math.atan2(tz[i],tx[i]),side,o}}
for(const [f,side,len,rows,label] of (geography?[]:venuePlan.stands)){const p=venuePoint(f,side,20);if([[-len/2,0],[len/2,0],[-len/2,rows*1.25],[len/2,rows*1.25]].every(([a,b])=>clearSite(p.x+tx[p.i]*a+nx[p.i]*side*b,p.z+tz[p.i]*a+nz[p.i]*side*b,10))){const g=grandstand(p.x,p.z,p.a+(side>0?Math.PI:0),len,rows,label);venueObjects.push({kind:'grandstand',name:label,station:p.i,side});}}
// Texture terrain at metre scale, with fine normal detail and macro colour variation.
const photoGrass=pbrTexture('__GRASS_COLOR__',true),photoGrassNormal=pbrTexture('__GRASS_NORMAL__'),photoSand=pbrTexture('__SAND_COLOR__',true),photoSandNormal=pbrTexture('__SAND_NORMAL__');
for(const texture of[photoGrass,photoGrassNormal,photoSand,photoSandNormal])texture.repeat.set(750,750);
grassMaterial.map=arid||THEME==='dunes'?photoSand:photoGrass;grassMaterial.normalMap=arid||THEME==='dunes'?photoSandNormal:photoGrassNormal;grassMaterial.color.setHex(arid?0xffffff:0x879f78);grassMaterial.normalScale=new T.Vector2(.42,.42);grassMaterial.needsUpdate=true;
const venueMetal=M(0x52606a,.65,.35),venueWhite=M(0xd9dbd5,.25,.47),venueGlass=new T.MeshPhysicalMaterial({color:linear(0x7098a8),metalness:.75,roughness:.13,envMapIntensity:1.2});
// Sculpted pit canopies, service lanes, garage aprons and pit-wall facilities.
const pitIndex=PIT.box,pitH=Math.atan2(PIT.z[pitIndex+1]-PIT.z[pitIndex-1],PIT.x[pitIndex+1]-PIT.x[pitIndex-1]),pitAngle=-pitH+(pitSide<0?Math.PI:0);
const pitP={x:PIT.x[pitIndex]-Math.sin(pitH)*pitSide*6,z:PIT.z[pitIndex]+Math.cos(pitH)*pitSide*6},pitGroup=new T.Group();pitGroup.position.set(pitP.x,PIT.y[pitIndex],pitP.z);pitGroup.rotation.y=pitAngle;scene.add(pitGroup);
const pitApron=new T.Mesh(new T.PlaneGeometry(225,22),new T.MeshStandardMaterial({map:asphalt,color:0x898c8d,normalMap:asphaltNormal,roughness:.92}));pitApron.rotation.x=-Math.PI/2;pitApron.position.y=.03;pitGroup.add(pitApron);
for(let j=0;j<10&&!geography;j++){const g=new T.Mesh(new T.BoxGeometry(10,.35,18),venueWhite);g.position.set(j*11-55,8.4,12);g.rotation.x=-.08;pitGroup.add(g);const panel=new T.Mesh(new T.PlaneGeometry(9,2),venueGlass);panel.position.set(j*11-55,6.3,3);pitGroup.add(panel)}
if(CIRCUIT.id==='milano'){
 const roofs=[],frames=[];for(let k=0;k<9;k++){const x=k*14-56;roofs.push([x,10.5+(k%3)*1.2,12,15,.32,24,0,0,(k%3-1)*.14]);frames.push([[x,8,2],[x+7,13,12],.15],[[x+7,13,12],[x,8,24],.15]);}instanceBoxes(pitGroup,venueWhite,roofs,true,false);beams(pitGroup,frames,venueMetal);venueObjects.push({kind:'pit-architecture',name:CIRCUIT.id==='silverstone'?'Wing-inspired folded roof':'Milano folded-roof paddock'});
}
// Rescue access, orange marshal stations and FIA-style light panels behind protection.
const marshalBoxes=[],lights=[];for(let i=55;i<N;i+=95){const p=venuePoint(i/N,-1,4);if(!clearSite(p.x,p.z,2))continue;marshalBoxes.push([p.x,1.5,p.z,3,3,3,0,p.a]);lights.push([p.x+nx[i]*2,3.6,p.z+nz[i]*2,1.1,.65,.12,0,p.a]);}
instanceBoxes(scene,M(0xd5d7d3,.1,.82),marshalBoxes);instanceBoxes(scene,new T.MeshStandardMaterial({color:0x09110c,emissive:0x25845c,emissiveIntensity:.15}),lights,false);
// Underpasses are open structures: no foundation curtain across Suzuka's lower road.
if(CIRCUIT.features?.overpass){const a=CIRCUIT.features.overpass.stations;const i=cy[a[0]]>cy[a[1]]?a[0]:a[1],angle=-Math.atan2(tz[i],tx[i]);const deck=new T.Mesh(new T.BoxGeometry(30,.75,W*2+3),venueMetal);deck.position.set(cx[i],cy[i]-.65,cz[i]);deck.rotation.y=angle;scene.add(deck);venueObjects.push({kind:'overpass',station:i,clearance:CIRCUIT.features.overpass.clearance});}
// Suzuka's Ferris wheel sits beside the pit/last-corner spectator area.
if(CIRCUIT.id==='suzuka'&&!geography){
 const p=venuePoint(.975,1,110),g=new T.Group();g.position.set(p.x,groundHeight(p.x,p.z),p.z);scene.add(g);const ring=new T.Mesh(new T.TorusGeometry(35,.55,8,80),venueWhite);ring.position.y=42;g.add(ring);const rods=[];for(let i=0;i<24;i++){const a=i/24*Math.PI*2,x=Math.cos(a)*35,y=42+Math.sin(a)*35;rods.push([[0,42,0],[x,y,0],.15]);const pod=new T.Mesh(new T.BoxGeometry(3,3.5,2.8),M([0xf06b25,0x137fae,0xd9d09b][i%3],.3,.4));pod.position.set(x,y,0);g.add(pod)}rods.push([[-14,0,-8],[0,42,0],.8],[[14,0,8],[0,42,0],.8]);beams(g,rods);venueObjects.push({kind:'landmark',name:'Suzuka Ferris wheel'});
}
// Monza's retained oval banking, separated from the contemporary racing surface.
if(CIRCUIT.id==='monza'&&!geography){
 const p=venuePoint(.49,1,170),arc=new T.Mesh(new T.TorusGeometry(190,5,5,100,Math.PI*.65),M(0xa0a295,0,.95));arc.rotation.x=Math.PI/2;arc.rotation.z=.2;arc.position.set(p.x,groundHeight(p.x,p.z)+3,p.z);scene.add(arc);venueObjects.push({kind:'heritage',name:'Old banking silhouette'});
}
// PBR glints, rim lighting and layered atmosphere give material shape at race speed.
scene.traverse(o=>{if(o.isHemisphereLight)o.intensity=isNight?.38:.26;});sun.intensity=isNight?.5:1.65;sun.color.setHex(isNight?0xa4caff:0xffdfbf);fill.intensity=.22;
scene.fog.density=isNight?.0007:THEME==='forest'?.00052:.00033;
const rim=new T.DirectionalLight(isNight?0xff9966:0xc4dbff,isNight?.6:.16);rim.position.set(-60,20,30);scene.add(rim);
// Fern/grass clumps beside verges are instanced, deterministic and excluded from the road.
if(!urban&&!arid){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([-.2,0,0,.2,0,0,0,1.1,.08,0,0,-.2,0,0,.2,.08,.8,0],3));g.computeVertexNormals();const m=new T.MeshStandardMaterial({color:THEME==='dunes'?0xaaa078:0x667342,roughness:1,side:T.DoubleSide});const items=[];for(let j=0;j<4200;j++){const i=Math.floor(rand()*N),side=rand()>.5?1:-1,o=trackBarrier(i,side)+side*(2+rand()*24),x=cx[i]+nx[i]*o,z=cz[i]+nz[i]*o;if(clearSite(x,z,.5))items.push([x,z,.35+rand()*.7])}const mesh=new T.InstancedMesh(g,m,items.length),obj=new T.Object3D();items.forEach(([x,z,size],i)=>{obj.position.set(x,groundHeight(x,z),z);obj.scale.setScalar(size);obj.rotation.y=rand()*6.28;obj.updateMatrix();mesh.setMatrixAt(i,obj.matrix)});mesh.receiveShadow=true;scene.add(mesh);}
