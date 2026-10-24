extends SceneTree
func _initialize() -> void:
	var car=load("res://assets/mr26.scn").instantiate()
	for part in car.get_children():
		if not part is MeshInstance3D or part.mesh.get_meta("prepared_lods",false): continue
		var mesh:Mesh=part.mesh
		if mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX].size()<1000: continue
		var importer:=ImporterMesh.new()
		for surface in mesh.get_surface_count(): importer.add_surface(Mesh.PRIMITIVE_TRIANGLES,mesh.surface_get_arrays(surface),[],{},mesh.surface_get_material(surface))
		importer.generate_lods(60,25,[])
		part.mesh=importer.get_mesh(); part.mesh.set_meta("prepared_lods",true)
	var packed:=PackedScene.new(); assert(packed.pack(car)==OK)
	assert(ResourceSaver.save(packed,"res://assets/mr26.scn",ResourceSaver.FLAG_COMPRESS)==OK)
	car.free(); print("Prepared distance LODs for MR 26; original close geometry and UVs retained."); quit()
