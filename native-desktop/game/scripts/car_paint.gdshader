shader_type spatial;
render_mode cull_back;
uniform sampler2D livery : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
varying vec3 local_position;
void vertex(){local_position=VERTEX;}
void fragment(){
 vec3 ink=texture(livery,vec2(UV.x,1.0-UV.y)).rgb;
 float chroma=max(ink.r,max(ink.g,ink.b))-min(ink.r,min(ink.g,ink.b));
 float carbon=(1.0-smoothstep(.006,.03,chroma))*(1.0-smoothstep(.09,.19,ink.r));
 float weave=mod(floor(UV.x*1800.0)+floor(UV.y*1800.0),2.0);
 vec3 resin=vec3(.009,.015,.028)*(1.0+weave*.12);
 ALBEDO=mix(ink,resin,carbon*.95);
 float axle=min(abs(local_position.x-1.538),abs(local_position.x+1.685));
 float rubber=(1.0-smoothstep(.36,.42,length(vec2(axle,local_position.y-.373))))*smoothstep(.43,.49,abs(local_position.z))*carbon;
 ALBEDO=mix(ALBEDO,vec3(.008,.009,.010),rubber);
 METALLIC=.02;
 SPECULAR=mix(.18,.1,rubber);
 ROUGHNESS=mix(.45,.94,rubber);
 CLEARCOAT=.16*(1.0-rubber);
 CLEARCOAT_ROUGHNESS=.4;
}
