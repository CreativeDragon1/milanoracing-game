extends SceneTree
func _initialize() -> void:call_deferred("run")
func run() -> void:
	var shots:Array=JSON.parse_string(FileAccess.get_file_as_string("res://assets/landmark-qa.json"))
	for shot in shots:
		var game=load("res://main.tscn").instantiate();game.qa_mode=true;game.qa_seconds=600;game.active_id=shot.id;root.add_child(game)
		while not game.loaded:await process_frame
		game.set_process(false);game.ui.hide();game.viewport.disable_3d=false;game.racing_guide.hide();game.vehicle.hide()
		game.light_mode=1;game.apply_lighting()
		game.camera.position=Vector3(shot.from[0],shot.from[1],shot.from[2]);game.camera.look_at(Vector3(shot.to[0],shot.to[1],shot.to[2]));game.camera.fov=shot.fov
		await create_timer(3).timeout;RenderingServer.force_draw()
		root.get_texture().get_image().save_png("res://../qa/landmark-"+shot.name+".png")
		print("NATIVE_LANDMARK_VIEW ",shot.name);game.queue_free();await process_frame
	quit()
