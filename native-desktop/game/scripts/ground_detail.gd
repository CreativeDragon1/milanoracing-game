extends Node3D
func configure(id: String) -> void:
	var file := "res://circuits/"+id+"-detail.dat"
	if not FileAccess.file_exists(file): return
	var f := FileAccess.get_file_as_bytes(file).to_float32_array()
	var tiles := {}
	for i in range(0,f.size(),7):
		var key := Vector3i(floori(f[i]/40),int(f[i+6]),floori(f[i+2]/40))
		if not tiles.has(key): tiles[key] = []
		tiles[key].append(i)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for blade in 3:
		var angle := blade*PI/3
		for p in [Vector3(-.12,0,0),Vector3(0,1,0),Vector3(.12,0,0)]:
			st.set_uv(Vector2((p.x+.12)/.24,p.y))
			st.add_vertex(Basis(Vector3.UP,angle)*p)
	st.generate_normals()
	var grass := st.commit()
	var m := ShaderMaterial.new()
	m.shader = load("res://scripts/grass.gdshader")
	grass.surface_set_material(0,m)
	var stone := SphereMesh.new()
	stone.height = 1
	stone.radius = .5
	stone.radial_segments = 6
	stone.rings = 3
	var rock := StandardMaterial3D.new()
	rock.albedo_color = Color(.55,.48,.36)
	rock.roughness = .95
	rock.vertex_color_use_as_albedo = true
	stone.material = rock
	for key in tiles:
		var list: Array = tiles[key]
		var center := Vector3(key.x*40+20,0,key.z*40+20)
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.use_colors = true
		mm.mesh = grass if key.y==0 else stone
		mm.instance_count = list.size()
		for j in list.size():
			var i: int = list[j]
			var scale := Vector3(f[i+3]*1.5,f[i+3],f[i+3]*1.5)
			mm.set_instance_transform(j,Transform3D(Basis(Vector3.UP,f[i+4]).scaled(scale),Vector3(f[i],f[i+1]+.006,f[i+2])-center))
			mm.set_instance_color(j,Color(f[i+5],f[i+5],f[i+5]))
		var node := MultiMeshInstance3D.new()
		node.multimesh = mm
		node.position = center
		node.visibility_range_end = 95 if key.y==0 else 55
		node.visibility_range_end_margin = 20
		node.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
		node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(node)
