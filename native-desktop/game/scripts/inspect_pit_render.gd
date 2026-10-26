extends SceneTree
func _initialize() -> void:
	var world=load("res://circuits/interlagos.scn").instantiate()
	var retired:Array=world.get_children().filter(func(c):return c.get_meta("retired_pit_crew",false))
	print("RETIRED_CREW ",retired.size()," visible ",retired.filter(func(c):return c.visible).size())
	var car=load("res://assets/mr26.scn").instantiate()
	for part in car.get_children():
		if part is MeshInstance3D:
			var m:Material=part.mesh.surface_get_material(0)
			if m is StandardMaterial3D and m.roughness>.8 and m.metallic<.03 and m.albedo_color.r<.4 and part.position.length()>1:
				print("WHEEL ",part.position," rotation ",part.rotation," scale ",part.scale," bounds ",part.mesh.get_aabb())
	world.free();car.free();quit()
