extends SceneTree
const Buffers=preload("res://scripts/instance_buffers.gd")
const Trees=preload("res://scripts/vegetation.gd")
const Detail=preload("res://scripts/ground_detail.gd")

func own(node: Node, world: Node) -> void:
	for child in node.get_children():
		child.owner=world
		own(child,world)

func _initialize() -> void:
	var tracks: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://circuits/physics.json"))
	var legacy:Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://assets/pit-crew-legacy.json"))
	var ids=OS.get_cmdline_user_args()
	if ids.is_empty(): ids=tracks.keys()
	for id in ids:
		var legacy_ids:=PackedInt32Array(legacy.get(id,[]))
		var packed: PackedScene=load("res://circuits/"+id+".scn")
		var world=packed.instantiate()
		var source: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://circuits/"+id+".json"))
		source.objects=source.objects.filter(func(object):return int(source.geometry[object.geometry].attributes.position.bytes)>0)
		var expected:int=source.objects.filter(func(object):return not object.car).size()
		if world.get_child_count()<expected:
			push_error("Scene/source mismatch for "+id+". Import the circuit before baking.")
			world.free(); quit(1); return
		var index:=0
		for object in source.objects:
			if object.car: continue
			var node=world.get_child(index)
			node.set_meta("source_name",object.name)
			index+=1
			if legacy_ids.has(index-1):node.visible=false;node.set_meta("retired_pit_crew",true)
			if not node is MultiMeshInstance3D: continue
			var f: PackedFloat32Array=node.get_meta("instance_transforms")
			var colors: PackedFloat32Array=node.get_meta("instance_colors",PackedFloat32Array())
			var stride:=16 if node.multimesh.use_colors else 12
			var buffer:=PackedFloat32Array(); buffer.resize(node.multimesh.instance_count*stride)
			for i in node.multimesh.instance_count:
				var j: int=i*16
				var t:=Transform3D(Basis(Vector3(f[j],f[j+1],f[j+2]),Vector3(f[j+4],f[j+5],f[j+6]),Vector3(f[j+8],f[j+9],f[j+10])),Vector3(f[j+12],f[j+13],f[j+14]))
				var c:=Color(colors[i*3],colors[i*3+1],colors[i*3+2]) if colors.size() else Color.WHITE
				Buffers.write(buffer,i*stride,t,c,node.multimesh.use_colors)
			node.set_meta("gpu_buffer",buffer)
		world.set_meta("sun_direction",Vector3(source.sun[0],source.sun[1],source.sun[2]))
		for child in world.get_children():
			if child.name in ["PreparedVegetation","PreparedGroundDetail"]: child.free()
		var trees=Trees.new(); trees.name="PreparedVegetation"; world.add_child(trees); trees.configure(source.trees)
		var detail=Detail.new(); detail.name="PreparedGroundDetail"; world.add_child(detail); detail.configure(id)
		# Prepared scenes retain resources and buffers, not construction scripts.
		trees.set_script(null); detail.set_script(null)
		Buffers.prepare_bounds(world)
		own(world,world)
		var result:=PackedScene.new(); assert(result.pack(world)==OK)
		assert(ResourceSaver.save(result,"res://circuits/"+id+".scn",ResourceSaver.FLAG_COMPRESS)==OK)
		print("PREPARED_RUNTIME ",id," nodes=",world.get_child_count())
		world.free()
	quit()
