extends Node3D
var wetness := 0.0
var roads: Array[ShaderMaterial] = []
var rain: GPUParticles3D
var spray: GPUParticles3D
var target: Node3D
var road_count := 0
var facade_count := 0
var waters := 0
var rubber: MeshInstance3D

func configure(world: Node3D,track: Dictionary,vehicle: Node3D) -> void:
	target=vehicle
	var road := ShaderMaterial.new()
	road.shader=load("res://scripts/road.gdshader")
	road.set_shader_parameter("color_map",load("res://assets/surfaces/asphalt-color.jpg"))
	road.set_shader_parameter("normal_map",load("res://assets/surfaces/asphalt-normal.jpg"))
	road.set_shader_parameter("rough_map",load("res://assets/surfaces/asphalt-rough.jpg"))
	roads.append(road)
	var surface_cache := {}
	for node in world.get_children():
		if not node is GeometryInstance3D: continue
		var name_lower := str(node.get_meta("source_name",node.name)).to_lower()
		if name_lower.begins_with("main racing surface") or name_lower.begins_with("pit-lane asphalt") or name_lower.begins_with("mapped surrounding road") or name_lower.begins_with("mapped asphalt"):
			node.material_override=road; road_count+=1
		elif name_lower.begins_with("mapped water"):
			var water := ShaderMaterial.new(); water.shader=load("res://scripts/water.gdshader")
			node.material_override=water; waters+=1
		elif name_lower.begins_with("solid recessed facade") or name_lower.begins_with("mapped structural rooftop") or name_lower.begins_with("solid chamfered safety"):
			var mesh: Mesh = node.mesh if node is MeshInstance3D else node.multimesh.mesh if node is MultiMeshInstance3D else null
			if not mesh: continue
			var base: Material = mesh.surface_get_material(0)
			if not base is StandardMaterial3D or base.albedo_texture: continue
			if not surface_cache.has(base):
				var material := ShaderMaterial.new(); material.shader=load("res://scripts/architecture.gdshader")
				material.set_shader_parameter("detail",load("res://assets/surfaces/concrete-color.jpg"))
				material.set_shader_parameter("base_color",base.albedo_color)
				material.set_shader_parameter("base_roughness",maxf(.65,base.roughness))
				surface_cache[base]=material
			node.material_override=surface_cache[base]; facade_count+=1
		elif name_lower.begins_with("recessed architectural glass"):
			var mesh: Mesh = node.mesh if node is MeshInstance3D else node.multimesh.mesh if node is MultiMeshInstance3D else null
			if mesh:
				var base: Material = mesh.surface_get_material(0)
				if base is StandardMaterial3D:
					var glass: StandardMaterial3D=base.duplicate(); glass.roughness=.16; glass.metallic=.3; glass.metallic_specular=.65
					node.material_override=glass
	build_rubber(track)
	build_particles()

func build_rubber(track: Dictionary) -> void:
	# Thin accumulated rubber follows the existing optimized line and terrain bank.
	var st := SurfaceTool.new(); st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in int(track.N):
		var j := (i+1)%int(track.N)
		var points := []
		for k in [i,j]:
			var off: float = track.line.offset[k]
			var width := minf(1.5,minf(track.widthLeft[k]+off,track.widthRight[k]-off)-.2)
			for side in [-1.0,1.0]:
				var lateral: float=off+side*maxf(.1,width)
				points.append(Vector3(track.x[k]-track.tz[k]*lateral,track.elevation.height[k]-lateral*tan(track.bank[k])+.016,track.z[k]+track.tx[k]*lateral))
		for index in [0,2,1,1,2,3]:
			st.set_uv(Vector2(0 if index%2==0 else 1,float(i+(1 if index>1 else 0))*.35)); st.add_vertex(points[index])
	st.generate_normals()
	var shader := Shader.new()
	shader.code="shader_type spatial; render_mode blend_mix,depth_draw_never,cull_disabled; void fragment(){float edge=pow(sin(UV.x*3.14159),2.0);float streak=.6+.4*sin(UV.x*91.0+sin(UV.y*.2));ALBEDO=vec3(.012);ROUGHNESS=.9;ALPHA=edge*streak*.15;}"
	var material := ShaderMaterial.new(); material.shader=shader
	rubber=MeshInstance3D.new(); rubber.mesh=st.commit(); rubber.material_override=material
	rubber.cast_shadow=GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; add_child(rubber)

func build_particles() -> void:
	rain=GPUParticles3D.new(); rain.amount=3500; rain.lifetime=1.5; rain.emitting=false
	rain.visibility_aabb=AABB(Vector3(-35,-30,-35),Vector3(70,65,70))
	var process := ParticleProcessMaterial.new()
	process.emission_shape=ParticleProcessMaterial.EMISSION_SHAPE_BOX; process.emission_box_extents=Vector3(24,16,24)
	process.direction=Vector3(-.18,-1,.05); process.spread=4; process.initial_velocity_min=27; process.initial_velocity_max=35
	process.gravity=Vector3(0,-6,0); process.color=Color(.65,.75,.85,.24)
	rain.process_material=process
	var mesh := QuadMesh.new(); mesh.size=Vector2(.018,.7)
	var mat := StandardMaterial3D.new(); mat.transparency=BaseMaterial3D.TRANSPARENCY_ALPHA; mat.shading_mode=BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.vertex_color_use_as_albedo=true; mat.billboard_mode=BaseMaterial3D.BILLBOARD_ENABLED; mat.no_depth_test=false
	mesh.material=mat; rain.draw_pass_1=mesh; rain.cast_shadow=GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(rain)
	spray=GPUParticles3D.new(); spray.amount=240; spray.lifetime=.7; spray.emitting=false; spray.local_coords=false
	spray.visibility_aabb=AABB(Vector3(-20,-5,-20),Vector3(40,20,40))
	var puff := ParticleProcessMaterial.new(); puff.direction=Vector3(-1,.15,0); puff.spread=20
	puff.initial_velocity_min=4; puff.initial_velocity_max=11; puff.gravity=Vector3(0,-1,0)
	puff.emission_shape=ParticleProcessMaterial.EMISSION_SHAPE_BOX; puff.emission_box_extents=Vector3(.15,.05,.7)
	puff.color=Color(.7,.8,.9,.08); puff.scale_min=.2; puff.scale_max=1.2
	spray.process_material=puff
	var quad := QuadMesh.new(); quad.size=Vector2(.6,.6)
	var fade := Shader.new(); fade.code="shader_type spatial; render_mode unshaded,blend_mix,depth_draw_never,cull_disabled; void vertex(){MODELVIEW_MATRIX=VIEW_MATRIX*mat4(vec4(INV_VIEW_MATRIX[0].xyz,0),vec4(INV_VIEW_MATRIX[1].xyz,0),vec4(INV_VIEW_MATRIX[2].xyz,0),MODEL_MATRIX[3]);} void fragment(){ALBEDO=COLOR.rgb;ALPHA=COLOR.a*(1.0-smoothstep(.1,.5,length(UV-.5)));}"
	var cloud := ShaderMaterial.new(); cloud.shader=fade; quad.material=cloud
	spray.draw_pass_1=quad; spray.cast_shadow=GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(spray)

func set_weather(value: float) -> void:
	wetness=value
	for road in roads: road.set_shader_parameter("wetness",value)
	if rain: rain.emitting=value>.5
	if rubber: rubber.visible=value<.5

func _process(_dt: float) -> void:
	if not is_instance_valid(target): return
	rain.position=target.position+Vector3.UP*9
	var forward := Vector3(cos(target.heading),0,sin(target.heading))
	spray.position=target.position-forward*2.2+Vector3.UP*.25
	spray.rotation.y=-target.heading
	spray.emitting=wetness>.5 and target.speed>15 and target.enabled
