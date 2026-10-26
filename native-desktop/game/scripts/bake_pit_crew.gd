extends SceneTree
const Clip=preload("res://scripts/pit_crew_clip.gd")
func vecs(a:Array) -> PackedVector3Array:
	var out:=PackedVector3Array();out.resize(a.size()/3)
	for i in out.size():out[i]=Vector3(a[i*3],a[i*3+1],a[i*3+2])
	return out
func _initialize() -> void:
	var data:Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://assets/pit-crew-rig.json"))
	var clip:=Clip.new()
	for batch in data.batches:
		var g:Dictionary=data.geometry[batch.shape];var d:Dictionary=data.materials[batch.paint]
		var arrays:=[];arrays.resize(Mesh.ARRAY_MAX);arrays[Mesh.ARRAY_VERTEX]=vecs(g.position);arrays[Mesh.ARRAY_NORMAL]=vecs(g.normal)
		var indices:=PackedInt32Array(g.index)
		for i in range(0,indices.size(),3):var temp:=indices[i+1];indices[i+1]=indices[i+2];indices[i+2]=temp
		arrays[Mesh.ARRAY_INDEX]=indices
		var mesh:=ArrayMesh.new();mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays)
		var mat:=StandardMaterial3D.new();mat.albedo_color=Color(d.color[0],d.color[1],d.color[2]).linear_to_srgb();mat.roughness=d.roughness;mat.metallic=d.metalness
		mesh.surface_set_material(0,mat);clip.meshes.append(mesh);clip.counts.append(batch.count)
	for key in ["ready","service","release"]:
		for frame in data[key]:
			var buffer:=PackedFloat32Array()
			for batch in frame:
				for i in range(0,batch.size(),16):
					for j in [0,4,8,12,1,5,9,13,2,6,10,14]:buffer.append(batch[i+j])
			clip[key].append(buffer)
	clip.cues=data.cues
	assert(ResourceSaver.save(clip,"res://assets/pit-crew.res",ResourceSaver.FLAG_COMPRESS)==OK)
	print("PIT_CREW_BAKED actors=",data.actors," draws=",clip.meshes.size()," instances=",clip.ready[0].size()/12)
	quit()
