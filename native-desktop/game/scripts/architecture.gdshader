shader_type spatial;
uniform sampler2D detail : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform vec4 base_color : source_color = vec4(1);
uniform float base_roughness=.8;
varying vec3 world;
varying vec3 world_normal;
varying vec4 tint;
void vertex(){world=(MODEL_MATRIX*vec4(VERTEX,1.0)).xyz;world_normal=normalize(MODEL_NORMAL_MATRIX*NORMAL);tint=COLOR;}
void fragment(){
 vec3 weights=pow(abs(world_normal),vec3(6));weights/=max(dot(weights,vec3(1)),.001);
 vec3 grain=texture(detail,world.zy/4.0).rgb*weights.x+texture(detail,world.xz/4.0).rgb*weights.y+texture(detail,world.xy/4.0).rgb*weights.z;
 float variation=clamp(dot(grain,vec3(.333))*2.0,.55,1.2);
 ALBEDO=base_color.rgb*tint.rgb*variation;
 ROUGHNESS=base_roughness; SPECULAR=.22;
}
