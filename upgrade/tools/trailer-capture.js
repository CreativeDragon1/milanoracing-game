// Authoring only. The normal game never loads these offline camera/shader costs.
window.captureTrailer=async function(options){
 frame=()=>{};await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 state='pause';show('none');document.querySelectorAll('body>*:not(canvas):not(script):not(style)').forEach(el=>el.style.display='none');
 applyGraphics('ultra');ren.setPixelRatio(1);ren.setSize(options.width,options.height,false);cam.aspect=options.width/options.height;resizeFX();
 guideArrows.visible=guideOutline.visible=false;contactShadow.visible=true;clearWeekend();
 const rivals=[];for(let i=0;i<3;i++){const m=car.clone(true);scene.add(m);rivals.push(m)}
 const previousVP=new T.Matrix4(),currentVP=new T.Matrix4(),projected=new T.Vector3();
 const lens=new T.ShaderPass({uniforms:{tDiffuse:{value:null},depthMap:{value:ambientPass.normalRenderTarget.depthTexture},inverseProjection:{value:cam.projectionMatrixInverse},cameraWorld:{value:cam.matrixWorld},previousVP:{value:previousVP},pixel:{value:new T.Vector2(1/options.width,1/options.height)},subject:{value:new T.Vector2(.5,.5)},subjectRadius:{value:new T.Vector2(.16,.2)},rival1:{value:new T.Vector4(3,3,.01,.01)},rival2:{value:new T.Vector4(3,3,.01,.01)},rival3:{value:new T.Vector4(3,3,.01,.01)},first:{value:1}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`
 varying vec2 vUv;uniform sampler2D tDiffuse,depthMap;uniform mat4 inverseProjection,cameraWorld,previousVP;uniform vec2 pixel,subject,subjectRadius;uniform vec4 rival1,rival2,rival3;uniform float first;
 void main(){float depth=texture2D(depthMap,vUv).r;vec4 view=inverseProjection*vec4(vUv*2.-1.,depth*2.-1.,1.);view/=view.w;vec4 old=previousVP*cameraWorld*view;vec2 motion=(vUv-(old.xy/old.w*.5+.5))*.42;float mask=smoothstep(.75,1.2,length((vUv-subject)/subjectRadius));mask=min(mask,smoothstep(.75,1.2,length((vUv-rival1.xy)/rival1.zw)));mask=min(mask,smoothstep(.75,1.2,length((vUv-rival2.xy)/rival2.zw)));mask=min(mask,smoothstep(.75,1.2,length((vUv-rival3.xy)/rival3.zw)));motion*=mask*(1.-first)*step(depth,.99998);float pixels=length(motion/pixel);motion*=min(1.,12./max(pixels,.001));
 vec3 colour=vec3(0.);float weight=0.;for(int i=0;i<9;i++){float f=float(i)/8.-.5;vec2 uv=clamp(vUv+motion*f,vec2(.001),vec2(.999));float other=texture2D(depthMap,uv).r;float w=exp(-abs(other-depth)*1500.);colour+=texture2D(tDiffuse,uv).rgb*w;weight+=w;}colour/=max(weight,.001);
 // A modest lens falloff keeps the car and immediate road legible.
 float coc=smoothstep(35.,180.,-view.z)*mask;vec3 soft=vec3(0.);for(int i=0;i<8;i++){float a=float(i)*.785398;soft+=texture2D(tDiffuse,vUv+vec2(cos(a),sin(a))*pixel*coc*1.5).rgb*.125;}colour=mix(colour,soft,coc*.24);
 float l=dot(colour,vec3(.2126,.7152,.0722));colour=mix(colour,smoothstep(vec3(0.),vec3(1.),colour),.09);colour+=vec3(-.003,.001,.005)*(1.-smoothstep(.04,.3,l));gl_FragColor=vec4(colour,1.);}`});composer.addPass(lens);
 const cameraPlan=filmPrepareCamera(options.motion,cam.aspect);cam.fov=cameraPlan.fov;cam.updateProjectionMatrix();
 const fps=60,total=Math.round(options.seconds*fps),samples=[];let progress=options.station*LEN,encoderError;
 const codec={codec:'avc1.640033',width:options.width,height:options.height,bitrate:48000000,framerate:fps,avc:{format:'annexb'},latencyMode:'quality'};
 const support=await VideoEncoder.isConfigSupported(codec);if(!support.supported)throw Error('H.264 capture encoder unavailable');
 const encoder=new VideoEncoder({output:chunk=>{const bytes=new Uint8Array(chunk.byteLength);chunk.copyTo(bytes);let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));window.saveTrailerChunk(btoa(text))},error:e=>encoderError=e});encoder.configure(codec);
 for(let frameIndex=-120;frameIndex<total;frameIndex++){
  const row=options.motion.frames[frameIndex+120],hero=row.cars[0],speed=hero.speed;
  filmApplyPose(car,hero);rivals.forEach((m,i)=>filmApplyPose(m,row.cars[i+1]));
  const p={x:car.position.x,y:car.position.y,z:car.position.z,h:hero.heading,f:hero.station};
  for(const w of wheels){w.sp.rotation.z-=speed/fps/.37;if(w.sp.parent.position.x>0)w.sp.parent.rotation.y=-hero.steering;}
  rivals.forEach((m,i)=>m.traverse(part=>{if(part.userData.wheelSpin){part.rotation.z-=row.cars[i+1].speed/fps/.37;if(part.parent.position.x>0)part.parent.rotation.y=-row.cars[i+1].steering;}}));
  cam.position.fromArray(row.camera);cam.lookAt(new T.Vector3(...row.focus));cam.updateMatrixWorld();
  rivals.forEach((m,i)=>{m.updateMatrixWorld(true);lens.uniforms['rival'+(i+1)].value.copy(filmScreenBox(m,cam));});
  projected.copy(car.position).add(new T.Vector3(0,.65,0)).project(cam);lens.uniforms.subject.value.set(projected.x*.5+.5,projected.y*.5+.5);lens.uniforms.subjectRadius.value.set(options.width>options.height?.19:.36,.24);currentVP.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse);if(frameIndex===-120)previousVP.copy(currentVP);
  contactShadow.position.set(p.x,p.y+.049,p.z);contactShadow.quaternion.copy(car.quaternion).multiply(shadowGroundRotation);nightLight.position.set(p.x,p.y+14,p.z);sun.position.copy(car.position).addScaledVector(sunDirection,230);sun.target.position.copy(car.position);sun.target.updateMatrixWorld();sky.position.copy(cam.position);windTime.value=(frameIndex+120)/fps;updateVegetation((frameIndex+120)*1000/fps);waterNormals.offset.set(windTime.value*.004,windTime.value*.002);renderGame();lens.uniforms.first.value=0;previousVP.copy(currentVP);
  if(frameIndex>=0){const video=new VideoFrame(ren.domElement,{timestamp:Math.round(frameIndex*1e6/fps),duration:Math.round(1e6/fps)});encoder.encode(video,{keyFrame:frameIndex%60===0});video.close();if(frameIndex%30===0)samples.push({frame:frameIndex,station:p.f,heading:p.h,position:[p.x,p.y,p.z],screen:[projected.x,projected.y],speed});}
  if(encoder.encodeQueueSize>6)await new Promise(r=>encoder.addEventListener('dequeue',r,{once:true}));if(encoderError)throw encoderError;
 }
 await encoder.flush();encoder.close();await window.captureTrailerDone();return{source:'Browser WebGL renderer; deterministic offline camera; depth-aware cinematic shader',fps,frames:total,width:options.width,height:options.height,samples,cameraPlan,motionReport:options.motion.report,errors:sceneAssetErrors};
};
