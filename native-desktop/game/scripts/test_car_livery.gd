extends SceneTree

func _initialize() -> void:
	var car:Node3D=load("res://assets/mr26.scn").instantiate()
	var neutral:=Vector2(2800.5/4096.0,1.0-900.5/4096.0)
	var inside:={"left":0,"right":0}
	var samples:Array=JSON.parse_string(FileAccess.get_file_as_string("res://assets/livery-checks.json"))
	var matched:Dictionary={}
	var manifest:Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://assets/livery-manifest.json"))
	var artwork_found:=false
	for part in car.get_children():
		if not part is MeshInstance3D:continue
		for surface in part.mesh.get_surface_count():
			var material:Material=part.mesh.surface_get_material(surface)
			if material is StandardMaterial3D and material.clearcoat_enabled and material.metallic>.2:
				assert(material.albedo_texture!=null,"Body artwork must be present")
				assert(FileAccess.get_sha256(material.albedo_texture.resource_path)==manifest.artworkSHA256,"Body must use the latest supplied texture, not a cached previous livery")
				artwork_found=true
			var arrays:Array=part.mesh.surface_get_arrays(surface)
			var points:PackedVector3Array=arrays[Mesh.ARRAY_VERTEX]
			var normals:PackedVector3Array=arrays[Mesh.ARRAY_NORMAL]
			var uv:PackedVector2Array=arrays[Mesh.ARRAY_TEX_UV]
			var indices:PackedInt32Array=arrays[Mesh.ARRAY_INDEX]
			for i in range(0,indices.size(),3):
				var selected:=true
				for j in 3:selected=selected and uv[indices[i+j]].distance_to(neutral)<.000001
				if selected:
					for j in 3:assert(points[indices[i+j]].z*normals[indices[i+j]].z<0,"Only inward-facing body panels may use the unbranded resin")
					inside["left" if points[indices[i]].z<0 else "right"]+=1
			for index in points.size():
				for sample_id in samples.size():
					var point:Array=samples[sample_id].position
					var tex:Array=samples[sample_id].uv
					if points[index].distance_to(Vector3(point[0],point[1],point[2]))<.00001 and uv[index].distance_to(Vector2(tex[0],tex[1]))<.00001:matched[sample_id]=true

	assert(inside.left==15 and inside.right==9,"Both inner sidepod decals must be removed")
	assert(matched.size()==samples.size(),"Designer artwork must match the supplied body UV layout")
	assert(artwork_found,"No MR 26 body material found")
	var report:={"passed":true,"revision":manifest.revision,"artworkSHA256":manifest.artworkSHA256,"innerPanelTriangles":inside,"designerUVAnchors":matched.size(),"scope":"Prepared native MR 26 mesh: active artwork verified, inner panels unbranded, supplied designer UV layout preserved"}
	var file:=FileAccess.open("res://../qa/car-livery.json",FileAccess.WRITE);file.store_string(JSON.stringify(report,"\t"));file.close()
	car.free();print("NATIVE_CAR_LIVERY ",JSON.stringify(report));quit()
