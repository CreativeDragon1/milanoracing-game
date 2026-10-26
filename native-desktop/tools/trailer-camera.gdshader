// Offline cinematic camera finish, with reversed-Z depth reconstruction.
shader_type spatial;
render_mode unshaded, fog_disabled, depth_draw_never, depth_test_disabled, cull_disabled;
uniform sampler2D source : hint_screen_texture, filter_linear;
uniform sampler2D depth_map : hint_depth_texture, filter_nearest;
uniform mat4 previous_vp;
uniform vec2 subject = vec2(.5);
uniform vec2 subject_radius = vec2(.2,.25);
uniform vec4 rival1=vec4(3.,3.,.01,.01);
uniform vec4 rival2=vec4(3.,3.,.01,.01);
uniform vec4 rival3=vec4(3.,3.,.01,.01);
uniform float first = 1.;
void vertex(){POSITION=vec4(VERTEX.xy,1.,1.);}
void fragment(){
 vec2 uv=SCREEN_UV;float d=texture(depth_map,uv).r;
 vec4 view=INV_PROJECTION_MATRIX*vec4(uv*2.-1.,d,1.);view/=view.w;
 vec4 previous=previous_vp*INV_VIEW_MATRIX*view;
 // Camera3D's CPU projection is Y-up; Vulkan screen UVs are Y-down.
 vec2 old_uv=vec2(previous.x/previous.w*.5+.5,.5-previous.y/previous.w*.5);
 vec2 movement=(uv-old_uv)*.42;
 float mask=smoothstep(.75,1.2,length((uv-subject)/subject_radius));
 mask=min(mask,smoothstep(.75,1.2,length((uv-rival1.xy)/rival1.zw)));
 mask=min(mask,smoothstep(.75,1.2,length((uv-rival2.xy)/rival2.zw)));
 mask=min(mask,smoothstep(.75,1.2,length((uv-rival3.xy)/rival3.zw)));
 movement*=mask*(1.-first)*step(.00001,d);
 vec2 pixel=1./VIEWPORT_SIZE;float speed=length(movement/pixel);movement*=min(1.,12./max(speed,.001));
 vec3 colour=vec3(0.);float weight=0.;
 for(int i=0;i<9;i++){vec2 p=clamp(uv+movement*(float(i)/8.-.5),vec2(.001),vec2(.999));float other=texture(depth_map,p).r;float w=exp(-abs(other-d)*1500.);colour+=texture(source,p).rgb*w;weight+=w;}
 ALBEDO=colour/max(weight,.001);ALPHA=1.;
}
