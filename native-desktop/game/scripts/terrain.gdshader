shader_type spatial;
render_mode cull_back;
uniform sampler2D detail_albedo : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D detail_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D paving_albedo : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D paving_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform float urban=0.0;
uniform sampler2D cover : source_color, filter_linear_mipmap, repeat_disable;
uniform vec4 geo_bounds;
uniform vec4 cover_bounds;
uniform float detail_scale=1.4;
uniform bool coastal_dunes=false;
uniform sampler2D dune_cover : filter_linear_mipmap, repeat_disable;
uniform sampler2D dune_grass : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D dune_grass_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
varying vec3 world_position;
float dune_hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float dune_noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(dune_hash(i),dune_hash(i+vec2(1,0)),f.x),mix(dune_hash(i+vec2(0,1)),dune_hash(i+vec2(1,1)),f.x),f.y);}
void vertex(){world_position=(MODEL_MATRIX*vec4(VERTEX,1.0)).xyz;}
void fragment(){
 vec2 uv=world_position.xz/detail_scale;
 vec2 guv=(world_position.xz-geo_bounds.xy)/geo_bounds.zw;
 vec2 cuv=(world_position.xz-cover_bounds.xy)/cover_bounds.zw;
 vec4 land=texture(cover,cuv);
 float mask=step(0.0,cuv.x)*step(cuv.x,1.0)*step(0.0,cuv.y)*step(cuv.y,1.0);
 // Cover is stored with source_color; classify in display space as in Three.js.
 vec3 code=pow(max(land.rgb,vec3(0.0)),vec3(1.0/2.2));
 float semantic=land.a*mask,vegetated=smoothstep(.025,.065,code.g-code.r);
 float grey=1.0-smoothstep(.025,.085,max(max(code.r,code.g),code.b)-min(min(code.r,code.g),code.b));
 float paved=mix(urban,grey,semantic)*(1.0-vegetated*semantic);
 vec3 detail=texture(detail_albedo,uv).rgb;
 vec3 paving=texture(paving_albedo,world_position.xz/3.0).rgb*.68;
 vec2 tile=abs(fract(world_position.xz/2.4)-.5);paving*=1.0-smoothstep(.488,.496,max(tile.x,tile.y))*.12;
 float forest=semantic*vegetated*(1.0-smoothstep(.25,.4,code.r));
 ALBEDO=mix(detail*(1.0-forest*.12),paving,paved);
 ROUGHNESS=.94;
 NORMAL_MAP=mix(texture(detail_normal,uv).rgb,texture(paving_normal,world_position.xz/3.0).rgb,paved);
 NORMAL_MAP_DEPTH=.32;
 if(coastal_dunes){
  vec2 dune_uv=vec2(world_position.x,-world_position.z);
  float small_dunes=dune_noise(world_position.xz*.24),large_dunes=dune_noise(world_position.xz*.021);
  float growth=texture(dune_cover,cuv).r;
  growth=smoothstep(.16,.82,growth+(small_dunes-.5)*.34+(large_dunes-.5)*.12);
  vec3 sand=texture(detail_albedo,dune_uv/1.8).rgb;
  vec3 grass=texture(dune_grass,dune_uv/1.4).rgb*vec3(.92,.91,.70);
  ALBEDO=mix(sand,grass,growth)*(.86+large_dunes*.20+small_dunes*.08);
  NORMAL_MAP=mix(texture(detail_normal,dune_uv/1.8).rgb,texture(dune_grass_normal,dune_uv/1.4).rgb,growth);
 }
}
