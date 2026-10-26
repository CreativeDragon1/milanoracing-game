// Original venue: the circuit climbs a ridge and returns through an arena.
// Structures are placed against this layout, with clearance checked on all sides.
const milanoCampusAudit=[];
if(CIRCUIT.id==='milano'){
 const amber=M(0xff7a00,.26,.47),blue=M(0x0019ff,.32,.40),dark=M(0x152029,.45,.52),limestone=M(0xa7a49a,.02,.96);
 for(const [turn,length,rows,title]of[[0,110,16,'FERRO'],[5,85,12,'VERTICE'],[7,110,14,'RIDGE'],[10,100,15,'FRENATA'],[12,95,16,'ARENA'],[13,90,14,'ARENA']]){
  const i=CIRCUIT.turns[turn].index,side=-(Math.sign(CIRCUIT.line.curvature[i])||1);let site=null;
  for(let extra=20;extra<=90;extra+=7){const p=venuePoint(i/N,side,extra),depth=rows*1.25;if([-length/2,0,length/2].every(s=>[0,depth].every(d=>clearSite(p.x+tx[i]*s+nx[i]*side*d,p.z+tz[i]*s+nz[i]*side*d,8)))){site=p;break}}
  if(!site)continue;const g=grandstand(site.x,site.z,site.a+(side<0?Math.PI:0),length,rows,title);g.name='Milano '+title+' grandstand';milanoCampusAudit.push({name:title,station:i,position:g.position.toArray(),kind:'spectator district'});
 }
 // A low race-control building and timing blade sit beside the paddock.
 const i=35,p=venuePoint(i/N,pitSide,65),g=new T.Group();g.name='Milano race control';g.position.set(p.x,groundHeight(p.x,p.z),p.z);g.rotation.y=p.a;scene.add(g);
 buildingFoundationSites.push({group:g,rings:[[[-17,-7.5],[17,-7.5],[17,7.5],[-17,7.5]]],floor:()=>0,name:g.name});
 instanceBoxes(g,dark,[[0,4,0,34,8,15],[9,14,0,7,28,7],[0,8.3,0,38,.6,18],[-4,12,0,19,9,1.8]]);
 instanceBoxes(g,venueGlass,[[0,5.7,-7.55,30,3.2,.15],[0,5.7,7.55,30,3.2,.15],[9,22,-3.55,5,7,.13],[9,22,3.55,5,7,.13]]);
 const fins=[];for(let x=-15;x<17;x+=3)fins.push([x,5.7,-7.8,.15,3.6,.45]);instanceBoxes(g,venueWhite,fins);
 instanceBoxes(g,blue,[[5.4,16,0,.25,24,7.3]]);instanceBoxes(g,amber,[[12.6,16,0,.25,24,7.3],[0,8.8,0,37,.18,17]]);
 const logo=new T.TextureLoader().load('__LOGO_DATA__');logo.encoding=T.sRGBEncoding;const logoMat=new T.MeshStandardMaterial({map:logo,transparent:true,depthWrite:false,roughness:.7});for(const side of[-1,1]){const sign=new T.Mesh(new T.PlaneGeometry(18,8.6),logoMat);sign.position.set(-4,12,side*1);sign.rotation.y=side<0?Math.PI:0;g.add(sign)}
 pitFascias.push({group:g,length:32,height:4.4,z:-7.65,side:-1,station:i,name:'Milano race control'});
 milanoCampusAudit.push({name:'Milano race control and timing blade',position:g.position.toArray(),kind:'paddock'});
 // Stone retaining structures remain outside the safety corridor and follow
 // its elevation. They give the ridge a constructed, physical edge.
 const cuts=[],rails=[];
 for(const [a,b]of[[.26,.34],[.38,.48],[.54,.59]])for(let k=Math.round(a*N);k<Math.round(b*N);k+=2){const side=-1,o=trackBarrier(k,side)-8,x=cx[k]+nx[k]*o,z=cz[k]+nz[k]*o;if(!clearSite(x,z,.2))continue;const next=(k+2)%N,xx=cx[next]+nx[next]*(trackBarrier(next,side)-8),zz=cz[next]+nz[next]*(trackBarrier(next,side)-8),len=Math.hypot(xx-x,zz-z),height=2+Math.max(0,groundHeight(x,z)-cy[k])*.15;cuts.push([x,height/2,z,len+.15,height,1.1,0,-Math.atan2(zz-z,xx-x)]);rails.push([x,height+.3,z,len+.15,.13,.18,0,-Math.atan2(zz-z,xx-x)]);}
 instanceBoxes(scene,limestone,cuts);instanceBoxes(scene,venueMetal,rails);
 // Dense wooded flanks on the far side of the ridge; open sight lines remain
 // at braking zones. The original fictional site has no geographic source.
 for(let j=0;j<2500;j++){const k=Math.floor(rand()*N),side=j%2?1:-1;if(k/N<.17||k/N>.88)continue;const o=trackBarrier(k,side)+side*(18+rand()*100),x=cx[k]+nx[k]*o,z=cz[k]+nz[k]*o;if(clearSite(x,z,7))treePositions.push([x,z,8+rand()*10]);}
 milanoCampusAudit.push({name:'Ridge cuttings',kind:'civil works',segments:cuts.length});
}
