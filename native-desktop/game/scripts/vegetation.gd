extends Node3D
# Native 3D vegetation near the road. Bounded spatial batches allow CPU/GPU culling.
const Buffers=preload("res://scripts/instance_buffers.gd")
static var model_cache: Dictionary = {}
var source: Dictionary
var height_min := INF
var height_max := -INF

func v3(encoded: String) -> PackedVector3Array:
	var f := Marshalls.base64_to_raw(encoded).to_float32_array()
	var p := PackedVector3Array()
	p.resize(f.size()/3)
	for i in p.size(): p[i] = Vector3(f[i*3],f[i*3+1],f[i*3+2])
	return p

func tree_mesh(part: Dictionary) -> ArrayMesh:
	var key: String=str(part.material)+str(part.positions.length())
	if model_cache.has(key): return model_cache[key]
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = v3(part.positions)
	arrays[Mesh.ARRAY_NORMAL] = v3(part.normals)
	var f := Marshalls.base64_to_raw(part.uv).to_float32_array()
	var uv := PackedVector2Array()
	uv.resize(f.size()/2)
	for i in uv.size(): uv[i] = Vector2(f[i*2],1-f[i*2+1])
	arrays[Mesh.ARRAY_TEX_UV] = uv
	var index := PackedInt32Array()
	index.resize(arrays[Mesh.ARRAY_VERTEX].size())
	for i in range(0,index.size(),3):
		index[i] = i
		index[i+1] = i+2
		index[i+2] = i+1
	arrays[Mesh.ARRAY_INDEX] = index
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays)
	# Photographed bark/leaf normals need a valid tangent frame.
	var st:=SurfaceTool.new();st.create_from(mesh,0);st.generate_tangents();mesh=st.commit()
	var kind := "leaves" if "leaves" in part.material else "branch" if "branches" in part.material else ""
	var prefix := "res://assets/vegetation/tree_small_02_"+(kind+"_" if kind else "")
	var m := StandardMaterial3D.new()
	m.albedo_texture = load(prefix+"diff_1k.jpg")
	m.normal_enabled = true
	m.normal_texture = load(prefix+"nor_gl_1k.jpg")
	m.normal_scale = .45
	m.roughness = .82
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	if kind=="leaves":
		m.cull_mode = BaseMaterial3D.CULL_DISABLED
		m.backlight_enabled = true
		m.backlight = Color(.28,.34,.15)
	mesh.surface_set_material(0,m)
	var lod := ImporterMesh.new()
	lod.add_surface(Mesh.PRIMITIVE_TRIANGLES,mesh.surface_get_arrays(0),[],{},m)
	lod.generate_lods(60,25,[])
	model_cache[key]=lod.get_mesh()
	return model_cache[key]

func configure(trees: Array) -> void:
	source = JSON.parse_string(FileAccess.get_file_as_string("res://assets/vegetation/model.json"))
	for part in source.near:
		for p in v3(part.positions):
			height_min = minf(height_min,p.y)
			height_max = maxf(height_max,p.y)
	var tiles := {}
	for t in trees:
		var key := Vector2i(floori(t[0]/50),floori(t[2]/50))
		if not tiles.has(key): tiles[key] = []
		tiles[key].append(t)
	var models := {}
	for level in ["near","middle"]:
		models[level] = []
		for part in source[level]: models[level].append(tree_mesh(part))
	var st:=SurfaceTool.new();st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for view in 2:
		var angle:=PI/2+view*PI/2
		for uv in [Vector2(0,0),Vector2(1,1),Vector2(1,0),Vector2(0,0),Vector2(0,1),Vector2(1,1)]:
			st.set_uv(Vector2((view+uv.x)/2,1-uv.y))
			st.add_vertex(Vector3(cos(angle)*(uv.x-.5),uv.y-.5,-sin(angle)*(uv.x-.5)))
	st.generate_normals()
	var plane:=st.commit()
	var foliage := StandardMaterial3D.new()
	foliage.albedo_texture = load("res://assets/vegetation/canopy-atlas.png")
	foliage.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
	foliage.alpha_scissor_threshold = .28
	foliage.alpha_antialiasing_mode=BaseMaterial3D.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE
	foliage.cull_mode = BaseMaterial3D.CULL_DISABLED
	foliage.roughness = .9
	foliage.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	plane.surface_set_material(0,foliage)
	for key in tiles:
		var list: Array = tiles[key]
		var ground_mean:=0.0
		for tree in list:ground_mean+=float(tree[1])/list.size()
		# LOD distance is measured at the trees' elevation, not the zero datum.
		var center := Vector3(key.x*50+25,ground_mean,key.y*50+25)
		for level in ["near","middle","far"]:
			var choices: Array = [plane] if level=="far" else models[level]
			for mesh in choices:
				var mm := MultiMesh.new()
				mm.transform_format = MultiMesh.TRANSFORM_3D
				mm.mesh = mesh
				mm.instance_count = list.size()
				var buffer:=PackedFloat32Array(); buffer.resize(mm.instance_count*12)
				for i in list.size():
					var t: Array = list[i]
					var scale: float = t[3]/(height_max-height_min)
					if level=="far":
						var c:Array=source.get("canopyCenter",[0,(height_min+height_max)/2,0])
						var offset:=Basis(Vector3.UP,t[4])*Vector3(c[0]*scale,(c[1]-height_min)*scale,c[2]*scale)
						Buffers.write(buffer,i*12,Transform3D(Basis(Vector3.UP,t[4]).scaled(Vector3.ONE*t[3]*float(source.canopyScale)),Vector3(t[0],t[1],t[2])+offset-center))
					else: Buffers.write(buffer,i*12,Transform3D(Basis(Vector3.UP,t[4]).scaled(Vector3.ONE*scale),Vector3(t[0],t[1]-height_min*scale,t[2])-center))
				var node := MultiMeshInstance3D.new()
				node.multimesh = mm
				node.set_meta("gpu_buffer",buffer)
				node.position = center
				node.visibility_range_begin = 0 if level=="near" else 60 if level=="middle" else 280
				node.visibility_range_end = 60 if level=="near" else 280 if level=="middle" else 3500
				node.visibility_range_begin_margin = 15
				node.visibility_range_end_margin = 15
				node.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
				node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if level=="near" else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
				add_child(node)
