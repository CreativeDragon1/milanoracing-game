// An isolated, lit car scene costs much less than rendering a whole circuit under
// the menu. Geometry and livery are shared with the race car, never resampled.
const showroom={scene:new T.Scene(),camera:new T.PerspectiveCamera(38,1,.05,60),car:car.clone(true),dirty:true};
showroom.scene.background=new T.Color(0x080d15);showroom.scene.fog=new T.Fog(0x080d15,12,36);showroom.scene.add(showroom.car);showroom.car.position.set(0,0,0);showroom.car.rotation.set(0,0,0);showroom.car.visible=true;
// Keep the white paint and sponsor ink below the glare of the studio panels.
// This material copy is confined to the menu; the race car keeps its own finish.
showroom.car.traverse(o=>{if(o.isMesh&&o.material===bodyPaint){o.material=bodyPaint.clone();o.material.clearcoat=.48;o.material.clearcoatRoughness=.22;o.material.roughness=.38;o.material.envMapIntensity=.4;}});
showroom.scene.add(new T.HemisphereLight(0xf0f4ff,0x18202c,.35));
const heroKey=new T.DirectionalLight(0xfff2de,1.25);heroKey.position.set(3.5,7,-4);heroKey.castShadow=true;heroKey.shadow.mapSize.set(2048,2048);Object.assign(heroKey.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.1,far:18});heroKey.shadow.bias=-.0002;heroKey.shadow.normalBias=.015;showroom.scene.add(heroKey);
const heroRim=new T.DirectionalLight(0x839fff,.85);heroRim.position.set(-4,3,4);showroom.scene.add(heroRim);const heroFill=new T.DirectionalLight(0xffa65e,.3);heroFill.position.set(-1,2,-5);showroom.scene.add(heroFill);
const heroFloor=new T.Mesh(new T.PlaneGeometry(80,80),new T.MeshStandardMaterial({color:0x05070b,roughness:.92,metalness:0,envMapIntensity:.04,normalMap:barrierNormal,normalScale:new T.Vector2(.035,.035)}));heroFloor.rotation.x=-Math.PI/2;heroFloor.position.y=-.025;heroFloor.receiveShadow=true;showroom.scene.add(heroFloor);
const garageMetal=new T.MeshStandardMaterial({color:0x0b1018,metalness:.35,roughness:.68,envMapIntensity:.12}),garageTrim=new T.MeshStandardMaterial({color:0x151d28,metalness:.5,roughness:.5,envMapIntensity:.15});
const garagePanels=[],garageFrames=[];for(let x=-12;x<12;x+=2.4){garagePanels.push([x,3.2,7,2.32,6.4,.25]);garageFrames.push([x,3.2,6.8,.045,6.4,.08]);}garagePanels.push([-8,3,0,.3,6,14]);for(const z of[-5,0,5])garageFrames.push([-7.8,3,z,.20,6,.22],[-.5,5.9,z,14.6,.25,.22]);
for(const [mat,parts]of[[garageMetal,garagePanels],[garageTrim,garageFrames]]){const mesh=instanceBoxes(showroom.scene,mat,parts,false);mesh.frustumCulled=false;}
const garageBlue=new T.MeshBasicMaterial({color:0x0019ff}),garageOrange=new T.MeshBasicMaterial({color:0xff7a00}),garageWhite=new T.MeshBasicMaterial({color:0xb6c8d9});
for(const [mat,parts]of[[garageBlue,[[-4.4,2.8,6.65,.075,5.4,.04],[-4.4,.035,1.2,.045,.015,10.8]]],[garageOrange,[[3.5,2.8,6.65,.075,5.4,.04],[3.5,.035,1.2,.045,.015,10.8]]],[garageWhite,[[0,5.72,-2,9,.035,.08],[0,5.72,3,9,.035,.08]]]]){const mesh=instanceBoxes(showroom.scene,mat,parts,false);mesh.frustumCulled=false;}
const garageLogo=new T.Mesh(new T.PlaneGeometry(4.6,2.0),new T.MeshBasicMaterial({map:logoTexture,transparent:true,alphaTest:.02,side:T.DoubleSide,depthWrite:false}));garageLogo.position.set(-.3,3.1,6.7);garageLogo.rotation.y=Math.PI;showroom.scene.add(garageLogo);
const garageSeams=[];for(let x=-8;x<=10;x+=2.4)garageSeams.push([x,-.014,0,.012,.006,25]);for(let z=-8;z<=12;z+=2.4)garageSeams.push([0,-.014,z,22,.006,.012]);const floorSeams=instanceBoxes(showroom.scene,new T.MeshBasicMaterial({color:0x141b24}),garageSeams,false);floorSeams.frustumCulled=false;
if(ren){const studio=new T.Scene();studio.background=new T.Color(0x182333);const panelGeo=new T.PlaneGeometry(1,1);for(const p of[[0,6,0,9,3,4],[-5,3,2,3,5,2],[4,2,-4,2,5,2.5]]){const panel=new T.Mesh(panelGeo,new T.MeshBasicMaterial({color:new T.Color(p[5],p[5],p[5]),side:T.DoubleSide}));panel.position.set(...p.slice(0,3));panel.scale.set(p[3],p[4],1);panel.lookAt(0,.4,0);studio.add(panel);}const generator=new T.PMREMGenerator(ren);showroom.environment=generator.fromScene(studio,.04,.1,30);showroom.scene.environment=showroom.environment.texture;generator.dispose();panelGeo.dispose();studio.traverse(o=>{if(o.material)o.material.dispose()});}
function drawShowroom(now){
 const {w,h}=viewportSize(),portrait=h>w,orbit=reducedMotion?0:Math.sin(now*.00009)*.28,camera=showroom.camera;
 camera.aspect=w/h;camera.fov=portrait?44:38;const distance=portrait?1.55:1;
 camera.position.set((5.4+orbit)*distance,1.65*distance,(-5.6+orbit)*distance);camera.lookAt(.2,.48,0);camera.setViewOffset(w,h,portrait?-w*.09:-w*.20,portrait?-h*.03:0,w,h);camera.updateProjectionMatrix();
 const exposure=ren.toneMappingExposure,shadows=ren.shadowMap.enabled;ren.toneMappingExposure=1.02;ren.shadowMap.enabled=true;ren.shadowMap.needsUpdate=showroom.dirty;ren.render(showroom.scene,camera);ren.toneMappingExposure=exposure;ren.shadowMap.enabled=shadows;showroom.dirty=false;
}
