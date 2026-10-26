extends SceneTree
var failures:Array[String]=[]
var checks:=0
func check(value:bool,message:String) -> void:
	checks+=1
	if not value: failures.append(message); push_error(message)
func _initialize() -> void: call_deferred("run")
func capture(name:String) -> void:
	await create_timer(.3).timeout
	await process_frame
	await process_frame
	RenderingServer.force_draw()
	root.get_texture().get_image().save_png("res://../qa/ui-"+name+".png")
func visible_bounds(node:Node) -> void:
	if node is BaseButton and node.is_visible_in_tree():
		var rect:Rect2=node.get_global_rect()
		check(Rect2(-1,-1,1602,902).encloses(rect),"visible button on screen: "+node.text)
	for child in node.get_children():visible_bounds(child)
func run() -> void:
	var game=load("res://main.tscn").instantiate()
	game.qa_mode=true; game.qa_home=true; game.qa_seconds=180
	root.add_child(game)
	while not game.loaded: await process_frame
	await create_timer(3).timeout
	check(game.ui.home.video.is_playing(),"home movie plays")
	var retired:Array=game.world.get_children().filter(func(c):return c.get_meta("retired_pit_crew",false))
	check(retired.size()==114 and retired.all(func(c):return not c.visible),"legacy static crew is completely replaced")
	check(game.viewport.disable_3d,"home pauses 3D rendering")
	check(not game.ui.home.caption.visible,"home has no decorative track caption")
	await capture("home")
	var idle_updates:int=game.working_crew.pose_updates
	await create_timer(.3).timeout
	check(game.working_crew.pose_updates==idle_updates,"stationary crew avoids identical pose uploads")
	game.ui.home.choose(1)
	check(game.menu.visible and not game.ui.home.hero.visible,"race opens setup")
	await capture("race-setup");visible_bounds(game.ui)
	game.ui.section(1);await capture("settings");visible_bounds(game.ui)
	check(game.ui.detail_page.visible and not game.ui.page.visible,"settings has its own page")
	game.ui.section(2);await capture("online");visible_bounds(game.ui)
	check(game.ui.online_panel.visible and not game.ui.detail_page.visible,"online has its own page")
	game.ui.section(0);game.ui.home.choose(2);await capture("grand-prix")
	check(game.ui.qualifying_row.visible,"qualifying only shown for Grand Prix")
	game.ui.home.choose(0);check(not game.ui.qualifying_row.visible and game.ui.session_rows.all(func(r):return not r.visible),"practice hides irrelevant race settings")
	game.ui.home.choose(1);game.ui.drive.grab_focus()
	for i in 8:
		var next:=InputEventAction.new();next.action="ui_focus_next";next.pressed=true;Input.parse_input_event(next);await process_frame
		check(root.gui_get_focus_owner()!=null and root.gui_get_focus_owner().is_visible_in_tree(),"keyboard navigation retains visible focus")
	game.ui.drive.pressed.emit()
	await process_frame
	check(not game.paused and game.director.model.phase=="countdown","drive starts race countdown")
	check(not game.viewport.disable_3d and not game.ui.home.visible,"starting race restores 3D and hides home")
	await create_timer(6.2).timeout
	check(game.director.model.phase=="race" and game.vehicle.enabled,"lights release player input")
	await capture("driving-hud")
	check(game.ui.driving_hud.visible and not game.hud.visible,"structured HUD replaces legacy text block")
	game.ui.circuit_map.toggle_view();await capture("map");game.ui.circuit_map.toggle_view()
	game.request_pit(); check(game.director.model.drivers[0].requested,"pit button requests service")
	game.cycle_tyre(); check(game.director.next_tyre=="medium","pit compound can be selected")
	var d:Dictionary=game.director.model.drivers[0]
	game.director.model.enter_pit(d);d.pit.s=game.director.model.pit.s[game.director.model.pit.box]
	d.v=0;game.director.apply_player_pose(game.director.model.pit_pose(d),0,true)
	while d.pit.hold<1.1:await process_frame
	check(game.vehicle.wheel_parts.all(func(w):return not w.visible),"actual wheels removed during tyre exchange")
	var copied_car:Node3D=game.vehicle.duplicate_race_visual()
	check(copied_car.position==Vector3.ZERO and game.vehicle.wheel_parts.all(func(w):return copied_car.get_node(NodePath(str(w.name))).visible),"new opponents cannot inherit a pit lift or removed wheels")
	copied_car.free()
	check(game.vehicle.axle_hardware.visible and game.vehicle.axle_hardware.multimesh.instance_count==10 and game.vehicle.axle_hardware.get_parent()==game.vehicle.visual,"axles and hubs remain attached during wheel removal")
	check(game.working_crew.played_cues>=4,"wheel guns and jack cues play with service")
	await capture("pit-service")
	while not d.pit.service:await process_frame
	await process_frame
	check(game.vehicle.wheel_parts.all(func(w):return w.visible),"wheels fitted before release")
	check(game.working_crew.batches.size()==13,"crew uses shared instanced batches")
	game.set_paused(true)
	await physics_frame
	check(game.menu.visible and not game.vehicle.enabled,"garage pauses local race")
	game.ui.home.open_home(); game.ui.home.choose(2); game.ui.drive.pressed.emit()
	await process_frame
	check(game.director.model.phase=="qualifying","new Grand Prix starts qualifying")
	var pit_clock:float=game.director.model.clock
	var rival_progress:float=game.director.model.drivers[1].progress
	await capture("pit-controls")
	check(game.ui.driving_hud.skip_pit.visible,"pit skip control visible during qualifying exit")
	var skip_started:=Time.get_ticks_msec()
	await game.skip_pit_drive()
	var skip_elapsed:=Time.get_ticks_msec()-skip_started
	print("PIT_SKIP_WALL_MS ",skip_elapsed)
	check(skip_elapsed<12000,"pit skip is faster than watching the automated exit")
	await physics_frame
	check(game.director.model.drivers[0].pit.is_empty(),"pit skip reaches actual lane exit")
	check(game.director.model.clock>pit_clock+5 and game.director.model.drivers[1].progress>rival_progress,"pit skip advances race clock and other cars")
	check(not game.pit_skip_busy and not game.director.pit_skipping,"skip always restores normal simulation")
	check(game.vehicle.speed>0 and game.vehicle.position.is_finite(),"moving pit handover remains finite")
	await capture("pit-handover")
	game.director.model.end_qualifying(); game.set_paused(true); game.ui.drive.pressed.emit()
	check(game.director.model.phase=="countdown","qualifying results advance to race")
	game.set_paused(true); game.ui.home.open_home()
	await create_timer(.2).timeout
	check(game.ui.home.visible and not game.menu.visible,"home remains accessible from garage")
	game.ui.mode.select(0); game.ui.restart.pressed.emit()
	await process_frame
	check(game.director==null and game.vehicle.enabled,"new practice clears race state")
	game.load_circuit("singapore")
	while not game.loaded: await process_frame
	check(game.active_id=="singapore" and is_instance_valid(game.vehicle),"circuit reload replaces race assets")
	game.set_paused(true); game.ui.home.open_home()
	await create_timer(1).timeout
	RenderingServer.force_draw()
	root.get_texture().get_image().save_png("res://../qa/home-ui.png")
	var report:={"passed":failures.is_empty(),"checks":checks,"failures":failures,"scope":"Native Vulkan UI button-signal integration: cinematic playback, render suspension, race launch, lights, pit request, garage, new qualifying, grid progression, return home, practice and circuit reload."}
	var file:=FileAccess.open("res://../qa/ui.json",FileAccess.WRITE); file.store_string(JSON.stringify(report,"\t")); file.close()
	print("NATIVE_UI_TEST ",JSON.stringify(report)); quit(0 if failures.is_empty() else 1)
