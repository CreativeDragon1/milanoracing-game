shader_type spatial;
uniform vec4 water_color : source_color=vec4(.025,.14,.17,1);
varying vec3 world;
void vertex(){world=(MODEL_MATRIX*vec4(VERTEX,1)).xyz;}
void fragment(){
 vec2 p=world.xz;
 float a=sin(p.x*.8+p.y*.25+TIME*1.2)*.13+sin(p.y*2.1-p.x*.3+TIME*1.8)*.07;
 float b=cos(p.y*.9-p.x*.4+TIME*.8)*.14+sin(p.x*1.9+TIME*2.2)*.05;
 NORMAL_MAP=normalize(vec3(a,b,1))*.5+.5;
 NORMAL_MAP_DEPTH=.7; ALBEDO=water_color.rgb; METALLIC=.18; ROUGHNESS=.18; SPECULAR=.55;
}
