shader_type spatial;
render_mode cull_back;
uniform sampler2D detail_albedo : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D detail_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D satellite : source_color, filter_linear_mipmap, repeat_disable;
uniform sampler2D cover : source_color, filter_linear_mipmap, repeat_disable;
uniform vec4 geo_bounds;
uniform vec4 cover_bounds;
varying vec3 world_position;
void vertex(){world_position=(MODEL_MATRIX*vec4(VERTEX,1.0)).xyz;}
void fragment(){
 vec2 uv=world_position.xz/8.0;
 vec2 guv=(world_position.xz-geo_bounds.xy)/geo_bounds.zw;
 vec2 cuv=(world_position.xz-cover_bounds.xy)/cover_bounds.zw;
 vec3 macro=texture(satellite,guv).rgb;
 vec4 land=texture(cover,cuv);
 float mask=step(0.0,cuv.x)*step(cuv.x,1.0)*step(0.0,cuv.y)*step(cuv.y,1.0);
 macro=mix(macro,land.rgb,land.a*mask*.85);
 vec3 detail=texture(detail_albedo,uv).rgb;
 ALBEDO=clamp(macro*(.72+detail*.9),vec3(.025),vec3(.75));
 ROUGHNESS=.94;
 NORMAL_MAP=texture(detail_normal,uv).rgb;
 NORMAL_MAP_DEPTH=.32;
}
