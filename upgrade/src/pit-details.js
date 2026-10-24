// Pit facilities follow the service lane rather than a flat rectangle at its midpoint.
const pitFacilityAudit={apronSections:0,skippedApronSections:0,garages:0};
const apronVertices=[],apronUV=[],servicePaint=[],pitCentreS=PIT.s[PIT.box];
function pitServicePoint(i,offset){const p=pitSections[i].point(offset);p[1]=Math.max(p[1],groundHeight(p[0],p[2])+.028);return p;}
function clearRaceSurface(p,margin=1){const q=prog(p[0],p[2],-1);return Math.abs(q.d)>trackHalf(q.i,Math.sign(q.d))+margin;}

function pitSurfaceMesh(vertices,material,name,uv){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));if(uv)g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();const mesh=new T.Mesh(g,material);mesh.name=name;mesh.receiveShadow=true;mesh.userData.groundSurface=true;scene.add(mesh);return mesh;}


// Original venues get real recessed garage rooms, not solid boxes with painted doors.
if(!geography||!pitFascias.length){
 for(let bay=0;bay<12;bay++){
  const station=pitCentreS+(bay-5.5)*10;let i=0;while(i<PIT.s.length-2&&PIT.s[i]<station)i++;if(i<2||i>PIT.s.length-4)continue;
  const h=PIT.heading[i],offset=pitSide*(PIT.width/2+8.4),x=PIT.x[i]-Math.sin(h)*offset,z=PIT.z[i]+Math.cos(h)*offset;
  if(!clearRaceSurface([x,0,z],7)||geography&&buildingAt(x,z,7))continue;
  const g=new T.Group();g.name='Recessed Milano pit garage';g.position.set(x,PIT.y[i]-.245,z);g.rotation.y=-h+(pitSide<0?Math.PI:0);scene.add(g);
  instanceBoxes(g,venueWhite,[[0,.16,0,9.8,.32,10],[-4.65,3.7,0,.5,7.4,10],[4.65,3.7,0,.5,7.4,10],[0,3.7,4.8,9.8,7.4,.4],[0,7.45,0,10.2,.3,10.8],[0,4.25,0,9.8,.3,10]],true,false);
  instanceBoxes(g,venueGlass,[[0,5.8,-4.85,8.8,2.7,.15]],true,false);
  instanceBoxes(g,venueMetal,[[0,3.8,-4.8,8.6,.55,.2],[-4.2,2.0,-4.8,.18,3.6,.18],[4.2,2.0,-4.8,.18,3.6,.18],[0,1.7,3.9,8.6,3.2,.2]],true,false);
  instanceBoxes(g,pitOrange,[[0,.34,-4.7,8.8,.04,.24]],false,false);
  addGarageNumbers(g,[{x:0,y:4.3,z:-5.04,side:-1,number:bay+1}]);
  pitGarageFronts.push({group:g,L:9.8,D:10,side:-1,pitch:0,floor:.32,name:g.name});
  pitFascias.push({group:g,length:9,height:7.5,z:-5.06,side:-1,station:Math.round(PIT.entry)%N,name:'Milano service garage '+(bay+1)});pitFacilityAudit.garages++;
 }
}

// Overhead hose booms and tool trolleys stay outside the lane envelope.
const serviceEquipment=new T.Group();serviceEquipment.name='Pit service equipment';serviceEquipment.position.copy(pitBox.position);serviceEquipment.rotation.copy(pitBox.rotation);scene.add(serviceEquipment);
const edge=pitSide*(PIT.width/2+1.1),uprights=[],equipment=[];
for(const x of[-5.5,5.5]){uprights.push([[x,0,edge],[x,4.3,edge],.12],[[x,4.3,edge],[x,4.3,pitSide*1.7],.10]);equipment.push([x,.65,edge,.8,1.3,.8],[x,1.35,edge,.85,.12,.85]);}
beams(serviceEquipment,uprights,venueMetal);instanceBoxes(serviceEquipment,crewBlue,equipment,true,false);

// Extend each paved service section to the actual garage threshold. A frontage
// intersection keeps the apron out of rear yards and unrelated neighbouring roads.
scene.updateMatrixWorld(true);
function pitApronEdge(i){const h=PIT.heading[i],ox=-Math.sin(h)*pitSide,oz=Math.cos(h)*pitSide,half=PIT.width/2;
 let best=null;for(const f of pitGarageFronts){const co=Math.cos(f.group.rotation.y),si=Math.sin(f.group.rotation.y),dx=PIT.x[i]-f.group.position.x,dz=PIT.z[i]-f.group.position.z,lx=co*dx-si*dz,lz=si*dx+co*dz,rx=co*ox-si*oz,rz=si*ox+co*oz;
 if(Math.abs(rz)<.2)continue;const t=(f.side*f.D/2-lz)/rz,x=lx+rx*t;if(t<half+.2||t>40||Math.abs(x)>f.L/2+.1)continue;
 if(!best||t<best.t)best={t,y:f.group.position.y+f.floor+f.pitch*x};}
 const t=best?.t||half+3.1,p=pitSections[i].point(pitSide*t);p[1]=best?best.y+.015:Math.max(p[1],groundHeight(p[0],p[2])+.028);return{p,front:!!best};
}
for(let i=1;i<PIT.x.length-2;i++){
 const a=pitApronEdge(i),b=pitApronEdge(i+1);if(!a.front&&!b.front&&Math.abs((PIT.s[i]+PIT.s[i+1])*.5-pitCentreS)>80)continue;
 const inner=pitSide*(PIT.width/2+.035),A=pitSections[i].point(inner),B=pitSections[i+1].point(inner);A[1]+=.015;B[1]+=.015;const corners=[A,a.p,b.p,B],samples=corners.concat(corners.map((p,k)=>p.map((v,j)=>(v+corners[(k+1)%4][j])/2)));
 if(!samples.every(p=>clearRaceSurface(p))){pitFacilityAudit.skippedApronSections++;continue;}
 for(const k of[0,1,2,0,2,3]){const p=corners[k];apronVertices.push(...p);apronUV.push(p[0]/5,p[2]/5)}pitFacilityAudit.apronSections++;
 const v=corners.map(p=>p.slice()),cross=(v[1][0]-v[0][0])*(v[2][2]-v[0][2])-(v[1][2]-v[0][2])*(v[2][0]-v[0][0]);if(cross<0)v.reverse();const cut={v,index:i};pitCutQuads.push(cut);
 for(let x=Math.floor(Math.min(...v.map(p=>p[0]))/24);x<=Math.floor(Math.max(...v.map(p=>p[0]))/24);x++)for(let z=Math.floor(Math.min(...v.map(p=>p[2]))/24);z<=Math.floor(Math.max(...v.map(p=>p[2]))/24);z++){const key=x+':'+z;if(!pitCutCells.has(key))pitCutCells.set(key,[]);pitCutCells.get(key).push(cut)}
 const laneOffset=pitSide*PIT.width*.22;for(const[k,delta]of[[i,-.045],[i,.045],[i+1,.045],[i,-.045],[i+1,.045],[i+1,-.045]]){const p=pitSections[k].point(laneOffset+delta);p[1]+=.012;servicePaint.push(...p)}
}
pitSurfaceMesh(apronVertices,new T.MeshStandardMaterial({map:asphalt,normalMap:asphaltNormal,normalScale:new T.Vector2(.15,.15),color:0xabb0b0,roughness:.94,side:T.DoubleSide}),'Pit service apron',apronUV);
pitSurfaceMesh(servicePaint,new T.MeshStandardMaterial({color:0xf1eee5,roughness:.86,side:T.DoubleSide}),'Pit working lane divider');

await trimPitGround();
