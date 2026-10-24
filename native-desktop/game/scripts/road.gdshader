shader_type spatial;
render_mode cull_back;
uniform sampler2D color_map : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D normal_map : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D rough_map : filter_linear_mipmap_anisotropic, repeat_enable;
uniform float wetness : hint_range(0,1) = 0.0;
varying vec3 world;
void vertex(){world=(MODEL_MATRIX*vec4(VERTEX,1.0)).xyz;}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 a=floor(p),b=fract(p);b=b*b*(3.0-2.0*b);return mix(mix(hash(a),hash(a+vec2(1,0)),b.x),mix(hash(a+vec2(0,1)),hash(a+vec2(1,1)),b.x),b.y);}
void fragment(){
 vec2 uv=world.xz/2.08;
 vec3 asphalt=texture(color_map,uv).rgb;
 float macro=noise(world.xz*.045);
 float puddle=smoothstep(.42,.72,noise(world.xz*.18))*wetness;
 ALBEDO=asphalt*mix(.8,1.08,macro)*mix(1.0,.48,wetness);
 ROUGHNESS=mix(clamp(texture(rough_map,uv).r*.75+.18,.65,.96),mix(.26,.075,puddle),wetness);
 METALLIC=0.0; SPECULAR=.4;
 vec3 n=texture(normal_map,uv).rgb;
 NORMAL_MAP=mix(n,vec3(.5,.5,1.0),puddle*.82);
 NORMAL_MAP_DEPTH=mix(.7,.25,puddle);
 CLEARCOAT=wetness*.7; CLEARCOAT_ROUGHNESS=.12;
}
