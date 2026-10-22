// Mapped footprints with solid foundations, recessed glazing and structural roof/facade detail.
const mappedVenueAudit={buildings:0,water:0,forest:mappedForest.length,heightFromMap:0,recessedWindows:0,balconies:0,roofStructures:0,grandstands:0};
const architectureSolids=[],architectureMetal=[],architectureGlass=[];
if(mappedBuildings.length){
 const make=()=>({p:[],uv:[],c:[]}),walls=make(),farWalls=make(),roofs=make(),glazing=make(),roofMetal=make();
 function vertex(out,p,u,v,color){out.p.push(...p);out.uv.push(u,v);out.c.push(color.r,color.g,color.b)}
 function quad(out,a,b,c,d,color){for(const [p,u,v]of[[a,0,0],[b,1,0],[c,1,1],[a,0,0],[c,1,1],[d,0,1]])vertex(out,p,u,v,color)}
 function structuralBeam(list,a,b,width,depth=width,color=0xc7c9c7){const dx=b[0]-a[0],dz=b[2]-a[2];list.push([(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,Math.hypot(dx,dz),width,depth,0,-Math.atan2(dz,dx),0,color])}
 for(const f of mappedBuildings){
  if(authoredIds.has(f.id))continue;
  const pts=f.footprint,n=pts.length,centre=pts.reduce((a,p)=>[a[0]+p[0]/n,a[1]+p[1]/n],[0,0]),grounds=pts.map(p=>groundHeight(...p));
  const h=f.height,base=Math.max(groundHeight(...centre),Math.max(...grounds)-h*.35),top=base+h,q=prog(...centre,-1),distance=Math.hypot(centre[0]-cx[q.i],centre[1]-cz[q.i]);
  const mx=Math.max(...pts.map(p=>p[0]))-Math.min(...pts.map(p=>p[0])),mz=Math.max(...pts.map(p=>p[1]))-Math.min(...pts.map(p=>p[1]));
  const stand=f.facade==='grandstand'||/grandstand|tribun|tribun|stowe |club b|^vale$/i.test(f.name||'');
  if(stand){const g=mappedGrandstand(f);g.name='Mapped grandstand '+f.id;mappedVenueAudit.grandstands++;mappedVenueAudit.buildings++;continue}
  const palette=THEME==='harbour'?[0xd2c5b0,0xcab5a4,0xd1b6a5,0xb8bdbe,0xbca58f]:THEME==='desert'||THEME==='marina'?[0xc9bda6,0xd7cbbb,0xb8b9b7]:[0xb9bdbb,0xb6b4ac,0x8f9c9f,0xc6c4b8];const color=linear(palette[f.id%palette.length]);
  const detailed=distance<280&&h>5&&h<120&&f.facade!=='concrete'&&f.facade!=='canopy'&&mappedVenueAudit.recessedWindows<30000;
  const sign=T.ShapeUtils.area(pts.map(p=>new T.Vector2(...p)))>0?1:-1;
  for(let i=0;i<n;i++){
   const a=pts[i],b=pts[(i+1)%n],len=Math.hypot(a[0]-b[0],a[1]-b[1]);if(len<.15)continue;const ux=(b[0]-a[0])/len,uz=(b[1]-a[1])/len,ox=uz*sign,oz=-ux*sign;
   const at=(x,y,recess=0)=>[a[0]+ux*x+ox*recess,y,a[1]+uz*x+oz*recess];
   if(f.facade==='canopy'){if(len>8)for(let x=1;x<len;x+=8){const pos=at(x,0);architectureMetal.push([pos[0],base+h/2,pos[2],.22,h,.22]);}continue}
   // Foundations meet the actual terrain at every perimeter vertex; no hovering lower corners.
   quad(walls,[a[0],grounds[i]-.65,a[1]],[b[0],grounds[(i+1)%n]-.65,b[1]],at(len,base+.2),at(0,base+.2),color.clone().multiplyScalar(.80));
   if(detailed&&len>4){
    const columns=Math.max(1,Math.floor(len/3.1)),cw=len/columns,floors=Math.max(1,Math.floor(h/3.3)),fh=h/floors;
    for(let floor=0;floor<floors;floor++)for(let col=0;col<columns;col++){
     const x0=col*cw,x1=(col+1)*cw,y0=base+floor*fh,y1=y0+fh,wx0=x0+cw*.24,wx1=x1-cw*.24,wy0=y0+.83,wy1=y1-.48;
     quad(walls,at(x0,y0),at(x1,y0),at(x1,wy0),at(x0,wy0),color);quad(walls,at(x0,wy1),at(x1,wy1),at(x1,y1),at(x0,y1),color);quad(walls,at(x0,wy0),at(wx0,wy0),at(wx0,wy1),at(x0,wy1),color);quad(walls,at(wx1,wy0),at(x1,wy0),at(x1,wy1),at(wx1,wy1),color);
     const reveal=color.clone().multiplyScalar(.58);quad(walls,at(wx0,wy0),at(wx0,wy0,-.25),at(wx0,wy1,-.25),at(wx0,wy1),reveal);quad(walls,at(wx1,wy0,-.25),at(wx1,wy0),at(wx1,wy1),at(wx1,wy1,-.25),reveal);quad(walls,at(wx0,wy0),at(wx1,wy0),at(wx1,wy0,-.25),at(wx0,wy0,-.25),reveal);quad(walls,at(wx0,wy1,-.25),at(wx1,wy1,-.25),at(wx1,wy1),at(wx0,wy1),reveal);
     const lit=isNight&&(f.id+floor*13+col*3)%7<2;quad(glazing,at(wx0,wy0,-.23),at(wx1,wy0,-.23),at(wx1,wy1,-.23),at(wx0,wy1,-.23),linear(lit?0xe4bd74:0x314752));
     structuralBeam(architectureMetal,at(wx0,wy0,.025),at(wx1,wy0,.025),.10,.18,0x777f80);
     const middle=at((wx0+wx1)/2,(wy0+wy1)/2,-.17);architectureMetal.push([middle[0],middle[1],middle[2],.055,wy1-wy0,.08,0,-Math.atan2(uz,ux),0,0x737b7b]);
     if(THEME==='harbour'&&f.building==='apartments'&&floor>0&&floor<12&&col%2===0&&distance<200){const p=at((wx0+wx1)/2,y0+.65,.65),width=cw*.85;architectureSolids.push([p[0],p[1],p[2],width,.16,1.4,0,-Math.atan2(uz,ux)]);structuralBeam(architectureMetal,at(x0+cw*.08,y0+1.65,1.28),at(x1-cw*.08,y0+1.65,1.28),.055,.055);for(const x of[x0+cw*.08,x1-cw*.08]){const p=at(x,y0+1.15,1.28);architectureMetal.push([p[0],p[1],p[2],.055,1,.055]);}mappedVenueAudit.balconies++;}
     mappedVenueAudit.recessedWindows++;
    }
   }else{for(const [p,u,v]of[[a,0,0],[b,len,0],[b,len,h],[a,0,0],[b,len,h],[a,0,h]])vertex(farWalls,[p[0],base+v,p[1]],f.facade==='concrete'?0:u/32,f.facade==='concrete'?0:v/48,color)}
   if(distance<500&&len>2){structuralBeam(architectureSolids,at(0,top+.25,.03),at(len,top+.25,.03),.55,.28,0xb0b4b1);if(detailed)structuralBeam(architectureSolids,at(0,base+3.35,.12),at(len,base+3.35,.12),.22,.35,0xc0bbb2);mappedVenueAudit.roofStructures++;}
  }
  const triangles=T.ShapeUtils.triangulateShape(pts.map(p=>new T.Vector2(...p)),[]),roofColor=linear(THEME==='harbour'?0x93816f:0x7c8585);
  const ferrari=CIRCUIT.id==='abu-dhabi'&&f.id===139010069;
  for(const t of triangles)for(const i of t){const p=pts[i];vertex(roofs,[p[0],top,p[1]],p[0]/8,p[1]/8,ferrari?linear(0xb51525):roofColor)}
  if(n<=7&&mx>5&&mz>5&&mx<42&&mz<35&&h<20&&(f.roof!=='flat'||['house','detached'].includes(f.building))){const ridge=base+h+Math.min(mx,mz)*.24,axis=mx>mz?0:1,ends=[centre.slice(),centre.slice()];ends[0][axis]-=(axis===0?mx:mz)*.32;ends[1][axis]+=(axis===0?mx:mz)*.32;for(let i=0;i<n;i++){const a=pts[i],b=pts[(i+1)%n],r=ends[((a[axis]+b[axis])/2)>centre[axis]?1:0];for(const p of[[a[0],top,a[1]],[b[0],top,b[1]],[r[0],ridge,r[1]]])vertex(roofs,p,p[0]/4,p[2]/4,linear(THEME==='harbour'?0x995a42:0x62656a));}mappedVenueAudit.roofStructures++;}
  if(distance<250&&mx>14&&mz>14&&h>6&&f.facade!=='canopy'&&!ferrari){architectureSolids.push([centre[0],top+.7,centre[1],Math.min(6,mx*.2),1.4,Math.min(4,mz*.2)]);architectureMetal.push([centre[0],top+1.45,centre[1],Math.min(6,mx*.2)+.2,.12,Math.min(4,mz*.2)+.2]);}
  mappedVenueAudit.buildings++;if(f.heightFromMap)mappedVenueAudit.heightFromMap++;
 }
 function batch(data,material,name){
  const tiles=new Map();for(let t=0;t<data.p.length;t+=9){const x=(data.p[t]+data.p[t+3]+data.p[t+6])/3,z=(data.p[t+2]+data.p[t+5]+data.p[t+8])/3,key=Math.floor(x/220)+','+Math.floor(z/220);if(!tiles.has(key))tiles.set(key,{p:[],uv:[],c:[]});const out=tiles.get(key);out.p.push(...data.p.slice(t,t+9));out.c.push(...data.c.slice(t,t+9));out.uv.push(...data.uv.slice(t/3*2,t/3*2+6))}
  for(const data of tiles.values()){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(data.p,3));g.setAttribute('uv',new T.Float32BufferAttribute(data.uv,2));g.setAttribute('color',new T.Float32BufferAttribute(data.c,3));g.computeVertexNormals();g.computeBoundingSphere();const m=new T.Mesh(g,material);m.name=name;m.castShadow=true;m.receiveShadow=true;scene.add(m)}
 }

 const facade=windowTexture.clone();facade.wrapS=facade.wrapT=T.RepeatWrapping;facade.needsUpdate=true;
 batch(farWalls,new T.MeshStandardMaterial({map:facade,vertexColors:true,roughness:.68,metalness:.12,side:T.DoubleSide,emissiveMap:facade,emissive:isNight?0xffe2a5:0x000000,emissiveIntensity:.24}),'Mapped distant facades');
 batch(walls,new T.MeshStandardMaterial({vertexColors:true,normalMap:barrierNormal,normalScale:new T.Vector2(.10,.10),roughness:.84,side:T.DoubleSide}),'Solid recessed facades and foundations');
 batch(glazing,new T.MeshPhysicalMaterial({vertexColors:true,roughness:.16,metalness:.6,clearcoat:1,envMapIntensity:1.1,side:T.DoubleSide,emissive:isNight?0x77654a:0x000000,emissiveIntensity:isNight?.24:0}),'Recessed architectural glass');
 batch(roofs,new T.MeshStandardMaterial({map:barrierColor,normalMap:barrierNormal,normalScale:new T.Vector2(.18,.18),vertexColors:true,roughness:.87,side:T.DoubleSide}),'Mapped structural rooftops');
 instanceBoxes(scene,M(0xbfc0b7,.08,.8),architectureSolids,true,false).name='Balconies parapets and plant rooms';instanceBoxes(scene,M(0xffffff,.6,.35),architectureMetal,true,false).name='Window frames and balcony railings';
}
