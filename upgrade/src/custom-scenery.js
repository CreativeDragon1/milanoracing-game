// Original architecture belongs to these fictional venues; all footprints are
// checked against the entire road, runoff and pit corridor before placement.
const originalSceneryAudit=[];
if(CIRCUIT.original){
 const white=M(0xe1ddd1,.08,.76),sandstone=M(0xa9754c,.02,.92),dark=M(0x273746,.5,.38),glass=new T.MeshPhysicalMaterial({color:linear(0x779ead),metalness:.45,roughness:.18,clearcoat:1});
 function site(f,side,distance,radius){const p=venuePoint(f,side,distance);if(!clearSite(p.x,p.z,radius))return null;const g=new T.Group();g.position.set(p.x,groundHeight(p.x,p.z),p.z);g.rotation.y=p.a;g.name=CIRCUIT.id+' original venue architecture';scene.add(g);return g}
 function block(g,w,h,d,x,y,z,material=white){return landmarkMesh(g,new T.BoxGeometry(w,h,d),material,x,y,z)}
 if(CIRCUIT.id==='riviera'){
  // Cascading balconies and recessed glazing give the headland hotel real depth.
  const hotel=site(.40,-1,100,42);
  if(hotel){for(let floor=0;floor<8;floor++){const w=66-floor*4,z=floor*1.3;block(hotel,w,3.8,23,0,2+floor*4.6,z);block(hotel,w+3,.35,28,0,4+floor*4.6,z);block(hotel,w-4,2.6,.2,0,2.5+floor*4.6,z-11.65,glass);for(let j=-2;j<=2;j++)block(hotel,.3,3.7,25,j*w/6,2+floor*4.6,z,dark)}originalSceneryAudit.push({type:'Terraced headland hotel',position:hotel.position.toArray()})}
  const beacon=site(.87,1,85,14);
  if(beacon){landmarkMesh(beacon,new T.CylinderGeometry(3.4,5.5,28,24),white,0,14,0);landmarkMesh(beacon,new T.CylinderGeometry(5.1,5.1,1.2,24),dark,0,27.5,0);landmarkMesh(beacon,new T.CylinderGeometry(2.5,2.5,3,16),glass,0,30,0);landmarkMesh(beacon,new T.ConeGeometry(4,3,24),dark,0,33,0);originalSceneryAudit.push({type:'Faro lighthouse',position:beacon.position.toArray()})}
  for(let n=0;n<18;n++){const g=site(.22+n*.031,n%2?1:-1,100+(n%4)*18,18);if(!g)continue;const material=M([0xd8c8aa,0xbc9b86,0xe4dac7,0xc5c1b0][n%4],0,.92);for(let j=0;j<3;j++){const h=8+((n+j)%4)*3;block(g,8,h,13,(j-1)*8.5,h/2,0,material);block(g,8.4,.5,13.5,(j-1)*8.5,h,0,dark);for(let floor=0;floor<Math.floor(h/3);floor++)for(let window=0;window<3;window++)block(g,1.4,1.7,.15,(j-1)*8.5+(window-1)*2.3,2+floor*3,-6.6,glass)}}
 }else{
  // Eroded layered mesas use solid, tapered geometry, never flat skyline cards.
  for(let n=0;n<15;n++){const g=site(.23+n*.043,n%3===0?1:-1,160+(n%3)*55,65);if(!g)continue;const h=22+(n%5)*9,r=32+(n%4)*8;for(let layer=0;layer<4;layer++){const ring=new T.CylinderGeometry(r*(1-layer*.12),r*(1.15-layer*.12),h/4,11);const material=M([0xab7454,0xbc8965,0x9c6749,0xc19670][layer],0,.97);const m=landmarkMesh(g,ring,material,0,h/8+layer*h/4,0);m.rotation.y=n*.41+layer*.06}originalSceneryAudit.push({type:'Layered sandstone mesa',position:g.position.toArray()})}
  const pavilion=site(.52,1,95,45);
  if(pavilion){block(pavilion,66,9,24,0,4.5,0,white);block(pavilion,62,6,.2,0,5,-12.1,glass);for(let j=-4;j<=4;j++){const roof=block(pavilion,8,.45,39,j*8,12+Math.abs(j)*.5,0,dark);roof.rotation.z=-Math.sign(j)*.14;landmarkMesh(pavilion,new T.CylinderGeometry(.3,.5,12,8),white,j*8,6,15)}originalSceneryAudit.push({type:'Solar canopy hospitality pavilion',position:pavilion.position.toArray()})}
  for(let n=0;n<10;n++){const g=site(.3+n*.045,-1,75,15);if(!g)continue;block(g,20,.35,14,0,5,0,dark).rotation.x=-.3;for(const x of[-8,8])block(g,.25,5,.25,x,2.5,0,white)}
 }
 // A designed paddock canopy ties both venues to Milano's orange/blue identity.
 const ribs=[],roof=[];for(let j=0;j<10;j++){const x=j*11-55;roof.push([x,10+(j%2)*.8,12,11.4,.4,26,0,0,(j%2?1:-1)*.07]);ribs.push([[x,0,23],[x,12,12],.22],[[x,12,12],[x,8,0],.22]);}instanceBoxes(pitGroup,white,roof,true,false);beams(pitGroup,ribs,dark);
}
