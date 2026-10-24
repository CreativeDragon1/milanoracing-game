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
varying vec3 world_position;
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
}
