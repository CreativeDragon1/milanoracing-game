"""Separate authoring project: cinematic effects never enter the player's renderer."""
from pathlib import Path
import subprocess,sys,shutil
N=Path(__file__).resolve().parents[1]
folder=Path(sys.argv[1]).resolve();width,height=map(int,sys.argv[2:4]);folder.mkdir(parents=True,exist_ok=True)
for name in ['assets','circuits','scripts','.godot']:
 link=folder/name;target=N/'game'/name
 if not link.exists():subprocess.run(['powershell','-NoProfile','-Command',f"New-Item -ItemType Junction -Path '{link}' -Target '{target}' | Out-Null"],check=True)
 assert link.resolve()==target.resolve()
qa=folder.parent/'qa'
if not qa.exists():subprocess.run(['powershell','-NoProfile','-Command',f"New-Item -ItemType Junction -Path '{qa}' -Target '{N/'qa'}' | Out-Null"],check=True)
config=(N/'game/project.godot').read_text()
for old,new in [('viewport_width=1600',f'viewport_width={width}'),('viewport_height=900',f'viewport_height={height}'),('window_width_override=1440',f'window_width_override={width}'),('window_height_override=810',f'window_height_override={height}')]:
 assert old in config;config=config.replace(old,new)
config=config.replace('directional_shadow/size=4096','directional_shadow/size=8192')
config+='\n[editor]\nmovie_writer/mjpeg_quality=0.95\n'
(folder/'project.godot').write_text(config)
(folder/'main.tscn').write_text((N/'game/main.tscn').read_text().replace('res://scripts/main.gd','res://main_capture.gd'))
(folder/'main_capture.gd').write_text((N/'game/scripts/main.gd').read_text().replace('res://scripts/cinematic_capture.gd','res://capture.gd'))
s=(N/'game/scripts/cinematic_capture.gd').read_text()
s=s.replace('var game: Node','var contact_materials:Array[ShaderMaterial]=[]\nvar lens: ShaderMaterial\nvar previous_vp: Projection\nvar lens_first:=true\nvar game: Node')
s=s.replace('game.camera.fov=58','''game.camera.fov=58
	# Preserve stable self-shadowing on the thin MR 26 body panels.
	game.sun.shadow_normal_bias=.5
	game.sun.shadow_bias=.03
	# Offline capture has native-resolution multisampling; temporal upscaling
	# is useful for gameplay, but adds shimmer to subpixel decals in a film.
	var capture_viewport:=game.get_viewport()
	capture_viewport.scaling_3d_mode=Viewport.SCALING_3D_MODE_BILINEAR
	capture_viewport.scaling_3d_scale=1.0
	capture_viewport.msaa_3d=Viewport.MSAA_4X
	capture_viewport.use_taa=false
	game.environment.ssao_intensity=1.15
	game.environment.ssil_intensity=.85
	game.environment.ssr_max_steps=128
	game.environment.glow_intensity=.27
	game.environment.adjustment_enabled=true
	game.environment.adjustment_contrast=1.045
	game.environment.adjustment_saturation=1.025
	var optics:=CameraAttributesPractical.new()
	optics.dof_blur_far_enabled=true
	optics.dof_blur_far_distance=48
	optics.dof_blur_far_transition=130
	optics.dof_blur_amount=.018
	game.camera.attributes=optics
	# Distant canopy photographs already contain lighting. A flat crossed-plane
	# normal otherwise turns the whole tree black from one camera direction.
	for node in game.world.find_children("*","MultiMeshInstance3D",true,false):
		var material:Material=node.multimesh.mesh.surface_get_material(0)
		if material is StandardMaterial3D and material.albedo_texture and material.albedo_texture.resource_path.ends_with("canopy-atlas.png"):
			var canopy:StandardMaterial3D=material.duplicate()
			canopy.shading_mode=BaseMaterial3D.SHADING_MODE_UNSHADED
			canopy.alpha_antialiasing_mode=BaseMaterial3D.ALPHA_ANTIALIASING_OFF
			node.material_override=canopy
			node.visibility_range_fade_mode=GeometryInstance3D.VISIBILITY_RANGE_FADE_DISABLED
	lens=ShaderMaterial.new();lens.shader=load("res://camera.gdshader")
	lens.render_priority=127
	var quad:=MeshInstance3D.new();var shape:=QuadMesh.new();shape.size=Vector2(2,2);shape.flip_faces=true
	quad.mesh=shape;quad.material_override=lens;quad.extra_cull_margin=16384;quad.cast_shadow=GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	game.camera.add_child(quad)
	for node in game.world.find_children("*","MeshInstance3D",true,false):
		var road:Material=node.material_override
		if road is ShaderMaterial and road.shader.resource_path.ends_with("road.gdshader"):
			var finish:ShaderMaterial=road.duplicate();var shader:=Shader.new()
			shader.code=FileAccess.get_file_as_string("res://road-contact.gdshader")
			finish.shader=shader;node.material_override=finish;contact_materials.append(finish)
''')
a=s.index('\tmatch shot:');b=s.index('\tgame.camera.position=location',a)
s=s[:a]+'''	match shot:
		0:
			location=pose.position-forward*lerpf(8.6,7.6,t)-right*lerpf(2.7,1.9,t)+Vector3.UP*lerpf(1.15,1.45,t)
			focus=pose.position+forward*2+Vector3.UP*.55
		1:
			location=pose.position+forward*lerpf(9,7.8,t)+right*lerpf(2.6,1.7,t)+Vector3.UP*lerpf(2.8,1.3,t)
			focus=pose.position-forward*.2+Vector3.UP*.55
		2:
			location=pose.position-forward*lerpf(11,9,t)-right*lerpf(3.8,2.8,t)+Vector3.UP*lerpf(8,3.5,t)
			focus=pose.position+forward*4+Vector3.UP*.55
		3:
			location=pose.position+forward*lerpf(6.8,4.8,t)-right*lerpf(5,4.4,t)+Vector3.UP*lerpf(1.35,1.85,t)
			focus=pose.position+Vector3.UP*.55
		4:
			location=pose.position-forward*lerpf(13,9,t)+right*2+Vector3.UP*lerpf(12,5,t)
			focus=pose.position+forward*3+Vector3.UP*.55
		_:
			location=pose.position-forward*8.3+right*lerpf(2.6,-2.6,t)+Vector3.UP*1.25
			focus=pose.position+forward*2+Vector3.UP*.55
''' +s[b:]
s=s.replace('\tgame.camera.position=location','''	# Keep low tracking cameras inside the road corridor, clear of street walls.
	var projected_road:Dictionary=game.vehicle.project(location,int(station))
	var camera_station:float=projected_road.i+projected_road.fraction
	var camera_edge:float=Model.sample(game.circuit.widthRight if projected_road.offset>=0 else game.circuit.widthLeft,camera_station)-.7
	if location.y-pose.position.y<4.0 and absf(projected_road.offset)>camera_edge:
		var correction:float=signf(projected_road.offset)*camera_edge-projected_road.offset
		location+=Vector3(-game.circuit.tz[projected_road.i],0,game.circuit.tx[projected_road.i])*correction
	var road_y:float=Model.sample(game.circuit.elevation.height,camera_station)-projected_road.offset*tan(Model.sample(game.circuit.bank,camera_station))
	location.y=maxf(location.y,road_y+1)
	game.camera.position=location''')
s=s.replace('game.camera.fov=(66 if trailer else 58)+4*t',f'''game.camera.fov={55 if width>height else 76}+4*t
	var fit:=0.0
	var inverse:Transform3D=game.camera.global_transform.affine_inverse()
	var aspect:float={width/height}
	for x in [-2.85,2.85]:
		for z in [-.95,.95]:
			for y in [0.,1.8]:
				var point:Vector3=inverse*(pose.position+forward*x+right*z+Vector3.UP*y)
				if point.z<-.1:fit=maxf(fit,maxf(absf(point.y)/(-point.z*.86),absf(point.x)/(-point.z*aspect*.86)))
	game.camera.fov=maxf(game.camera.fov,rad_to_deg(2*atan(fit)))
	var projected:Vector2=game.camera.unproject_position(pose.position+Vector3.UP*.65)/Vector2({width},{height})
	lens.set_shader_parameter("subject",projected)
	lens.set_shader_parameter("subject_radius",Vector2({.19 if width>height else .36},.24))
	var current:Projection=game.camera.get_camera_projection()*Projection(inverse)
	if lens_first:previous_vp=current
	lens.set_shader_parameter("previous_vp",previous_vp)
	lens.set_shader_parameter("first",1.0 if lens_first else 0.0)
	lens_first=false;previous_vp=current''')
s=s.replace('game.update_near_shadows()', "for material in contact_materials:\n\t\tmaterial.set_shader_parameter(\"contact0\",Vector4(pose.position.x,pose.position.z,pose.heading,pose.position.y))\n\t\tfor index in rivals.size():material.set_shader_parameter(\"contact\"+str(index+1),Vector4(rivals[index].position.x,rivals[index].position.z,-rivals[index].rotation.y,rivals[index].position.y))\n\tgame.update_near_shadows()")

# Avoid shadowing an existing local in the telemetry block.
s=s.replace('var projected:Vector2=game.camera.unproject_position(pose.position+Vector3.UP*.65)', 'var subject_uv:Vector2=game.camera.unproject_position(pose.position+Vector3.UP*.65)').replace('"subject",projected)', '"subject",subject_uv)')
(folder/'capture.gd').write_text(s)
shutil.copy2(N/'tools/trailer-camera.gdshader',folder/'camera.gdshader')
print('Cinematic authoring project',folder,width,height)

road=(N/'game/scripts/road.gdshader').read_text()
road=road.replace('varying vec3 world;', 'uniform vec4 contact0; uniform vec4 contact1; uniform vec4 contact2; uniform vec4 contact3;\nvarying vec3 world;\nfloat contact_shadow(vec4 car){vec2 q=world.xz-car.xy;float c=cos(car.z),s=sin(car.z);vec2 p=vec2(c*q.x+s*q.y,-s*q.x+c*q.y)/vec2(2.6,.8);return exp(-dot(p,p)*1.6)*.6*(1.-smoothstep(.7,1.7,abs(world.y-car.w)));}')
road=road.replace('ROUGHNESS=mix(', 'ALBEDO*=1.-max(max(contact_shadow(contact0),contact_shadow(contact1)),max(contact_shadow(contact2),contact_shadow(contact3)));\n ROUGHNESS=mix(')
(folder/'road-contact.gdshader').write_text(road)
