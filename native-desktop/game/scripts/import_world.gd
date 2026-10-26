extends SceneTree
# Offline conversion to native ArrayMesh, StandardMaterial3D and MultiMesh resources.
var bytes: PackedByteArray
var data: Dictionary
var materials: Dictionary = {}
var meshes: Dictionary = {}

func floats(desc: Dictionary) -> PackedFloat32Array:
	return bytes.slice(int(desc.offset), int(desc.offset + desc.bytes)).to_float32_array()

func vectors(desc: Dictionary) -> PackedVector3Array:
	var f := floats(desc)
	var result := PackedVector3Array()
	result.resize(f.size() / 3)
	for i in result.size(): result[i] = Vector3(f[i*3], f[i*3+1], f[i*3+2])
	return result

func transform_from(a: Array) -> Transform3D:
	return Transform3D(Basis(Vector3(a[0],a[1],a[2]),Vector3(a[4],a[5],a[6]),Vector3(a[8],a[9],a[10])),Vector3(a[12],a[13],a[14]))

func material_for(id: String) -> StandardMaterial3D:
	if materials.has(id): return materials[id]
	var d: Dictionary = data.materials[id]
	var m := StandardMaterial3D.new()
	m.resource_name = d.name if d.name else d.type
	m.albedo_color = Color(d.color[0],d.color[1],d.color[2],d.opacity).linear_to_srgb()
	m.roughness = maxf(.06,d.roughness)
	m.metallic = d.metalness
	# Three instanceColor is independent of its vertexColors flag. Godot gates both here.
	m.vertex_color_use_as_albedo = true
	m.cull_mode = BaseMaterial3D.CULL_DISABLED if int(d.side) == 2 else BaseMaterial3D.CULL_BACK
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	if d.map:
		m.albedo_texture = load(d.map.file)
		m.uv1_scale = Vector3(d.map.repeat[0],-d.map.repeat[1] if d.map.flipY else d.map.repeat[1],1)
		m.uv1_offset = Vector3(d.map.offset[0],1.0-d.map.offset[1] if d.map.flipY else d.map.offset[1],0)
	if d.normalMap:
		m.normal_enabled = true
		m.normal_texture = load(d.normalMap.file)
		m.normal_scale = clampf(d.normalScale,.2,1.0)
	if d.roughnessMap:
		m.roughness_texture = load(d.roughnessMap.file)
		m.roughness_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_GREEN
	if d.metalnessMap:
		m.metallic_texture = load(d.metalnessMap.file)
		m.metallic_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_BLUE
	if d.alphaTest > 0:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
		m.alpha_scissor_threshold = d.alphaTest
	elif d.transparent:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_DEPTH_PRE_PASS
	if d.clearcoat > 0:
		m.clearcoat_enabled = true
		m.clearcoat = d.clearcoat
		m.clearcoat_roughness = .18
	if d.emissiveIntensity > 0 and Vector3(d.emissive[0],d.emissive[1],d.emissive[2]).length() > .001:
		m.emission_enabled = true
		m.emission = Color(d.emissive[0],d.emissive[1],d.emissive[2]).linear_to_srgb()
		m.emission_energy_multiplier = d.emissiveIntensity
		if d.emissiveMap: m.emission_texture = load(d.emissiveMap.file)
	# Track signs still receive native light; only actual luminous displays emit.
	materials[id] = m
	return m

func mesh_for(o: Dictionary) -> ArrayMesh:
	var key: String = o.geometry + str(o.materials)
	if meshes.has(key): return meshes[key]
	var g: Dictionary = data.geometry[o.geometry]
	var a := []
	a.resize(Mesh.ARRAY_MAX)
	a[Mesh.ARRAY_VERTEX] = vectors(g.attributes.position)
	if g.attributes.has("normal"): a[Mesh.ARRAY_NORMAL] = vectors(g.attributes.normal)
	if g.attributes.has("uv"):
		var f := floats(g.attributes.uv)
		var uv := PackedVector2Array()
		uv.resize(f.size()/2)
		for i in uv.size(): uv[i] = Vector2(f[i*2],f[i*2+1])
		a[Mesh.ARRAY_TEX_UV] = uv
	if g.attributes.has("color"):
		var f := floats(g.attributes.color)
		var colors := PackedColorArray()
		var stride := int(g.attributes.color.size)
		colors.resize(f.size()/stride)
		for i in colors.size(): colors[i] = Color(f[i*stride],f[i*stride+1],f[i*stride+2],f[i*stride+3] if stride == 4 else 1)
		a[Mesh.ARRAY_COLOR] = colors
	var indices := PackedInt32Array()
	if g.has("index"): indices = bytes.slice(int(g.index.offset),int(g.index.offset+g.index.bytes)).to_int32_array()
	else:
		indices.resize(int(g.count))
		for i in indices.size(): indices[i] = i
	# Godot front faces use clockwise winding; source geometry uses counterclockwise.
	for i in range(0,indices.size(),3):
		var temp := indices[i+1]
		indices[i+1] = indices[i+2]
		indices[i+2] = temp
	var groups: Array = g.groups if g.groups.size() and o.materials.size()>1 else [{"start":0,"count":indices.size(),"materialIndex":0}]
	var result := ArrayMesh.new()
	for group in groups:
		a[Mesh.ARRAY_INDEX] = indices.slice(int(group.start),int(group.start+group.count))
		result.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,a)
		result.surface_set_material(result.get_surface_count()-1,material_for(o.materials[mini(group.materialIndex,o.materials.size()-1)]))
	# Native tangent frames give the PBR normal maps a valid surface basis.
	var detailed := ArrayMesh.new()
	for surface in result.get_surface_count():
		var st := SurfaceTool.new()
		st.create_from(result,surface)
		if g.attributes.has("uv") and g.attributes.has("normal"): st.generate_tangents()
		st.commit(detailed)
		detailed.surface_set_material(surface,result.surface_get_material(surface))
	result = detailed
	if not o.car and int(g.count)>1200 and not o.ground:
		var lod := ImporterMesh.new()
		for surface in result.get_surface_count(): lod.add_surface(Mesh.PRIMITIVE_TRIANGLES,result.surface_get_arrays(surface),[],{},result.surface_get_material(surface))
		lod.generate_lods(60,25,[])
		result = lod.get_mesh()
	meshes[key] = result
	return result

func _initialize() -> void:
	var ids := OS.get_cmdline_user_args()
	if ids.is_empty(): ids=JSON.parse_string(FileAccess.get_file_as_string("res://circuits/physics.json")).keys()
	for id in ids:
		data = JSON.parse_string(FileAccess.get_file_as_string("res://circuits/"+id+".json"))
		bytes = FileAccess.get_file_as_bytes("res://circuits/"+id+".bin")
		materials.clear()
		meshes.clear()
		var world := Node3D.new()
		world.name = "Circuit"
		var car := Node3D.new()
		car.name = "MR26"
		for o in data.objects:
			if int(data.geometry[o.geometry].attributes.position.bytes)==0:continue
			var node: GeometryInstance3D
			if o.has("instances"):
				var mm := MultiMesh.new()
				mm.transform_format = MultiMesh.TRANSFORM_3D
				mm.use_colors = o.has("colors")
				mm.mesh = mesh_for(o)
				mm.instance_count = o.count
				var f := floats(o.instances)
				var colors := floats(o.colors) if o.has("colors") else PackedFloat32Array()
				for i in int(o.count):
					mm.set_instance_transform(i,transform_from(Array(f.slice(i*16,(i+1)*16))))
					if colors.size(): mm.set_instance_color(i,Color(colors[i*3],colors[i*3+1],colors[i*3+2]))
				node = MultiMeshInstance3D.new()
				node.multimesh = mm
				# Headless import uses a dummy RenderingServer. Preserve canonical CPU
				# transforms explicitly; upload them when the native GPU scene is attached.
				node.set_meta("instance_transforms",f)
				if colors.size(): node.set_meta("instance_colors",colors)
			else:
				node = MeshInstance3D.new()
				node.mesh = mesh_for(o)
			node.name = o.name.validate_node_name()
			node.transform = transform_from(o.matrix)
			node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if o.castShadow else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			node.visibility_range_end = 4500 if not o.car else 0
			var parent := car if o.car else world
			parent.add_child(node)
			node.owner = parent
			if o.ground: node.set_meta("ground",true)
			if o.road: node.set_meta("road",true)
		var packed := PackedScene.new()
		packed.pack(world)
		var err := ResourceSaver.save(packed,"res://circuits/"+id+".scn",ResourceSaver.FLAG_COMPRESS)
		assert(err == OK)
		packed = PackedScene.new()
		packed.pack(car)
		ResourceSaver.save(packed,"res://assets/mr26.scn",ResourceSaver.FLAG_COMPRESS)
		print("NATIVE IMPORT ",id," nodes=",world.get_child_count()," meshes=",meshes.size()," materials=",materials.size())
		world.free()
		car.free()
	quit()
