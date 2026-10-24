// Quality presets share the same scene and physics. Ultra adds screen-space reflection and shafts.
let composer,ambientPass,aaPass,cinemaPass;
let graphicsPreset=device.mobile?'high':'ultra';try{graphicsPreset=localStorage.getItem(device.mobile?'mrs:mobile:graphics':'mrs:graphics')||graphicsPreset}catch(e){}
const graphics={scale:1,frames:0,elapsed:0,quality:graphicsPreset};
if(ren){ren.info.autoReset=false;ren.shadowMap.autoUpdate=false;}
if(ren&&ren.capabilities.isWebGL2){
 composer=new T.EffectComposer(ren);ambientPass=new T.SSAOPass(scene,cam,innerWidth,innerHeight);ambientPass.kernelRadius=1.35;ambientPass.minDistance=.0004;ambientPass.maxDistance=.025;ambientPass.needsSwap=true;ambientPass.beautyRenderTarget.texture.encoding=T.sRGBEncoding;
 // AO is a low-frequency effect. Calculate it at half resolution while
 // retaining full-resolution normals/depth for reflections and edge rejection.
 const originalAOSize=ambientPass.setSize.bind(ambientPass);
 ambientPass.setSize=(w,h)=>{originalAOSize(w,h);const aw=Math.max(1,Math.ceil(w/2)),ah=Math.max(1,Math.ceil(h/2));ambientPass.ssaoRenderTarget.setSize(aw,ah);ambientPass.blurRenderTarget.setSize(aw,ah);ambientPass.ssaoMaterial.uniforms.resolution.value.set(aw,ah);ambientPass.blurMaterial.uniforms.resolution.value.set(aw,ah)};
 ambientPass.copyMaterial.uniforms.edgeAware={value:0};ambientPass.copyMaterial.uniforms.tDepth={value:ambientPass.normalRenderTarget.depthTexture};ambientPass.copyMaterial.uniforms.aoSize={value:new T.Vector2()};
 ambientPass.copyMaterial.fragmentShader=`uniform sampler2D tDiffuse,tDepth;uniform float opacity,edgeAware;uniform vec2 aoSize;varying vec2 vUv;
 void main(){if(edgeAware<.5){gl_FragColor=opacity*texture2D(tDiffuse,vUv);return;}float center=texture2D(tDepth,vUv).x;vec2 pixel=vUv*aoSize-.5,base=floor(pixel),f=fract(pixel);float value=0.,weight=0.;for(int y=0;y<2;y++)for(int x=0;x<2;x++){vec2 o=vec2(float(x),float(y)),uv=(base+o+.5)/aoSize;float spatial=(x==0?1.-f.x:f.x)*(y==0?1.-f.y:f.y),depth=texture2D(tDepth,uv).x,w=spatial*exp(-abs(depth-center)*25000.);value+=texture2D(tDiffuse,uv).r*w;weight+=w;}float ao=weight>.00001?value/weight:texture2D(tDiffuse,vUv).r;gl_FragColor=vec4(vec3(ao),1.);}`;
 const originalAORender=ambientPass.renderPass.bind(ambientPass);
 ambientPass.renderPass=(renderer,material,...args)=>{if(material===ambientPass.copyMaterial){material.uniforms.edgeAware.value=material.uniforms.tDiffuse.value===ambientPass.blurRenderTarget.texture?1:0;material.uniforms.aoSize.value.set(ambientPass.blurRenderTarget.width,ambientPass.blurRenderTarget.height)}return originalAORender(renderer,material,...args)};
 ambientPass.normalRenderTarget.dispose();ambientPass.normalRenderTarget.depthTexture.type=T.UnsignedIntType;
 const baseVisibility=ambientPass.overrideVisibility.bind(ambientPass);ambientPass.overrideVisibility=()=>{baseVisibility();scene.traverse(o=>{if(o===sky||o.isMesh&&(o.material?.transparent||o.material?.alphaTest>0))o.visible=false})};
 composer.addPass(ambientPass);
 cinemaPass=new T.ShaderPass({uniforms:{tDiffuse:{value:null},tDepth:{value:ambientPass.normalRenderTarget.depthTexture},tNormal:{value:ambientPass.normalRenderTarget.texture},projection:{value:cam.projectionMatrix},inverseProjection:{value:cam.projectionMatrixInverse},cameraWorld:{value:cam.matrixWorld},near:{value:cam.near},far:{value:cam.far},resolution:{value:new T.Vector2()},sunUV:{value:new T.Vector2(-1,-1)},sunVisible:{value:0},night:{value:isNight?1:0},ultra:{value:1},focus:{value:8},menu:{value:1}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`
 varying vec2 vUv;uniform sampler2D tDiffuse,tDepth,tNormal;uniform mat4 projection,inverseProjection,cameraWorld;uniform vec2 resolution,sunUV;uniform float near,far,sunVisible,night,ultra,focus,menu;
 float viewDepth(float d){return near*far/(far-d*(far-near));}
 vec3 viewPosition(vec2 uv,float d){vec4 v=inverseProjection*vec4(uv*2.-1.,d*2.-1.,1.);return v.xyz/v.w;}
 void main(){vec3 original=texture2D(tDiffuse,vUv).rgb,c=original;float depth=texture2D(tDepth,vUv).r;float z=viewDepth(depth);vec2 px=1./resolution;
 // Small highlight bloom, wide enough for lamps without veiling the road.
 vec3 glow=vec3(0.);for(int i=0;i<12;i++){float a=float(i)*.523599;vec2 direction=vec2(cos(a),sin(a));vec3 light=texture2D(tDiffuse,vUv+direction*px*7.).rgb;glow+=max(light-.76,0.)*.065;light=texture2D(tDiffuse,vUv+direction*px*19.).rgb;glow+=max(light-.86,0.)*.04;}c+=glow;
 // Contact reflections are restricted to grazing, upward-facing surfaces.
 if(ultra>.5&&depth<.99999){vec3 normal=normalize(texture2D(tNormal,vUv).rgb*2.-1.);vec3 worldNormal=(cameraWorld*vec4(normal,0.)).xyz;vec3 pos=viewPosition(vUv,depth);float fresnel=pow(1.-abs(dot(normalize(-pos),normal)),4.);
 if(worldNormal.y>.92&&z>5.&&z<160.&&fresnel>.15){vec3 ray=reflect(normalize(pos),normal),hit=pos+normal*.25;float strength=0.;vec2 uv=vUv;
 for(int i=0;i<18;i++){hit+=ray*(.9+float(i)*.3);vec4 projected=projection*vec4(hit,1.);uv=projected.xy/projected.w*.5+.5;if(uv.x<.02||uv.x>.98||uv.y<.02||uv.y>.98)break;float other=viewDepth(texture2D(tDepth,uv).r),gap=-hit.z-other;if(gap>0.&&gap<1.4){strength=(1.-float(i)/18.)*.11*fresnel;break;}}
 c=mix(c,texture2D(tDiffuse,uv).rgb,strength*smoothstep(0.,.12,min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y))));}}
 // Depth-occluded sun shafts; never painted through solid objects.
 if(ultra>.5&&sunVisible>.5&&night<.5){vec2 delta=(sunUV-vUv)/24.;vec2 u=vUv;float rays=0.,weight=1.;for(int i=0;i<24;i++){u+=delta;float d=texture2D(tDepth,u).r;float halo=exp(-length(u-sunUV)*24.);rays+=step(.99999,d)*halo*weight;weight*=.96;}c+=vec3(1.,.68,.36)*rays*.0045;}
 // The showroom gets restrained focus falloff; racing stays sharp.
 if(menu>.5){float coc=clamp(abs(z-focus)/max(z,1.)-.2,0.,1.);vec3 blur=vec3(0.);for(int i=0;i<8;i++){float a=float(i)*.7854;blur+=texture2D(tDiffuse,vUv+vec2(cos(a),sin(a))*px*coc*2.).rgb/8.;}c=mix(c,blur,coc*.55);}
 float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,1.025);c=mix(c,smoothstep(vec3(0.),vec3(1.),c),.14);c+=vec3(-.006,.002,.012)*(1.-smoothstep(.04,.4,l));c*=1.-.12*smoothstep(.22,.75,length(vUv-.5));gl_FragColor=vec4(c,1.);
 }`});composer.addPass(cinemaPass);aaPass=new T.ShaderPass(T.FXAAShader);composer.addPass(aaPass);
}
function resizeFX(){if(!composer)return;const pr=ren.getPixelRatio(),{w,h}=viewportSize();composer.setPixelRatio(pr);composer.setSize(w,h);aaPass.uniforms.resolution.value.set(1/(w*pr),1/(h*pr));cinemaPass.uniforms.resolution.value.set(w*pr,h*pr);}
function applyGraphics(preset){graphicsPreset=preset;graphics.quality=preset;S.q=preset==='performance'?1:0;try{localStorage.setItem(device.mobile?'mrs:mobile:graphics':'mrs:graphics',preset)}catch(e){};sun.shadow.mapSize.set(preset==='ultra'&&!device.mobile?4096:2048,preset==='ultra'&&!device.mobile?4096:2048);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}sun.shadow.camera.left=-55;sun.shadow.camera.right=55;sun.shadow.camera.top=55;sun.shadow.camera.bottom=-55;sun.shadow.camera.updateProjectionMatrix();resize();}
const sunScreen=new T.Vector3();let previousRender=performance.now();
function renderGame(){if(!ren)return;ren.info.reset();if(state==='menu'){drawShowroom(performance.now());return;}const now=performance.now(),dt=now-previousRender;previousRender=now;ren.shadowMap.needsUpdate=true;
 if(composer&&!S.q){for(const m of[ambientPass.ssaoMaterial,ambientPass.depthRenderMaterial]){m.uniforms.cameraNear.value=cam.near;m.uniforms.cameraFar.value=cam.far;}ambientPass.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(cam.projectionMatrix);ambientPass.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(cam.projectionMatrixInverse);sunScreen.copy(cam.position).addScaledVector(sunDirection,5000).project(cam);cinemaPass.uniforms.sunUV.value.set(sunScreen.x*.5+.5,sunScreen.y*.5+.5);cinemaPass.uniforms.sunVisible.value=sunScreen.z<1&&sunScreen.x>-1.2&&sunScreen.x<1.2&&sunScreen.y>-1.2&&sunScreen.y<1.2?1:0;cinemaPass.uniforms.ultra.value=graphicsPreset==='ultra'?1:0;cinemaPass.uniforms.menu.value=0;composer.render()}else ren.render(scene,cam);
 graphics.frames++;if(dt<200)graphics.elapsed+=dt;
}
