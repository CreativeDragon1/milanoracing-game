shader_type spatial;
render_mode cull_disabled;
varying float tip;
void vertex(){
 tip=UV.y;
 vec3 p=(MODEL_MATRIX*vec4(VERTEX,1.0)).xyz;
 VERTEX.x+=sin(TIME*1.8+p.x*.35+p.z*.22)*UV.y*UV.y*.07;
}
void fragment(){
 ALBEDO=mix(vec3(.045,.075,.022),vec3(.19,.25,.075),tip)*COLOR.rgb;
 ROUGHNESS=.92;
 BACKLIGHT=vec3(.08,.12,.035);
}
