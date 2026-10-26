extends SceneTree
var failures:Array[String]=[]
var checks:=0
var samples:Array=[]
func check(value:bool,message:String) -> void:
	checks+=1
	if not value:failures.append(message);push_error(message)
func _initialize() -> void:call_deferred("run")
func bounds(node:Node,area:Rect2) -> void:
	if node is BaseButton and node.is_visible_in_tree():check(area.grow(1).encloses(node.get_global_rect()),"Button fits: "+node.text)
	for child in node.get_children():bounds(child,area)
func capture(name:String) -> void:
	await create_timer(.2).timeout
	RenderingServer.force_draw()
	root.get_texture().get_image().save_png("res://../qa/screen-"+name+".png")
func run() -> void:
	var game=load("res://main.tscn").instantiate()
	game.qa_mode=true;game.qa_home=true;game.qa_seconds=300
	root.add_child(game)
	while not game.loaded:await process_frame
	await create_timer(3).timeout
	for requested in [Vector2i(1024,768),Vector2i(1280,800),Vector2i(1440,810),Vector2i(1280,540)]:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
		DisplayServer.window_set_size(requested)
		await create_timer(.5).timeout
		var area:=root.get_visible_rect()
		var actual:=DisplayServer.window_get_size()
		check(absf(area.size.aspect()-Vector2(actual).aspect())<.002,"Viewport fills physical window without bars")
		game.set_paused(true);game.ui.home.open_home()
		# Include the largest home state: resume and an available update.
		game.ui.home.resume_button.show()
		var update_button:Button=game.ui.home.hero.get_child(-1)
		update_button.text="RESTART TO UPDATE";update_button.show()
		await process_frame;await process_frame
		check(game.ui.home.video.get_global_rect().encloses(area),"Home video covers entire viewport")
		check(absf(game.ui.home.video.size.aspect()-1600.0/900)<.001,"Home video retains original aspect ratio")
		check(game.ui.home.shade.size==area.size,"Home shading fills viewport")
		bounds(game.ui,area)
		var name:="%dx%d"%[actual.x,actual.y]
		await capture(name+"-home")
		game.ui.home.choose(1);game.ui.section(1)
		await process_frame;await process_frame
		bounds(game.ui,area)
		check(area.encloses(game.ui.menu.get_global_rect()),"Settings panel fits")
		await capture(name+"-settings")
		game.ui.section(2);await process_frame;await process_frame;bounds(game.ui,area)
		check(area.encloses(game.ui.online_panel.get_global_rect()),"Online panel fits")
		game.ui.home.close_home();game.ui.menu.hide();game.ui.online_panel.hide()
		await process_frame
		check(area.encloses(game.ui.driving_hud.dash.get_global_rect()),"Speedometer fits")
		check(absf(game.ui.driving_hud.dash.get_global_rect().end.x-(area.end.x-48))<1,"HUD anchored to right edge")
		check(absf(game.ui.driving_hud.dash.get_global_rect().end.y-(area.end.y-48))<1,"HUD anchored to bottom edge")
		game.ui.circuit_map.toggle_view();await process_frame
		check(area.encloses(game.ui.circuit_map.get_global_rect()),"Expanded map fits")
		await capture(name+"-driving")
		game.ui.circuit_map.toggle_view()
		samples.append({"requested":str(requested),"window":str(actual),"viewport":str(area.size)})
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)
	await create_timer(.5).timeout
	check(DisplayServer.window_get_mode()==DisplayServer.WINDOW_MODE_FULLSCREEN,"Fullscreen enabled")
	check(absf(root.get_visible_rect().size.aspect()-Vector2(DisplayServer.window_get_size()).aspect())<.002,"Fullscreen has no letterboxing")
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_MAXIMIZED)
	await create_timer(.5).timeout
	check(DisplayServer.window_get_mode()==DisplayServer.WINDOW_MODE_MAXIMIZED,"Exit fullscreen maximizes")
	var report:={"passed":failures.is_empty(),"checks":checks,"samples":samples,"failures":failures,"scope":"Actual Vulkan window resizing, home/settings/online controls, edge-anchored HUD, map and fullscreen. Graphics settings unchanged."}
	var file:=FileAccess.open("res://../qa/screen-fit.json",FileAccess.WRITE);file.store_string(JSON.stringify(report,"\t"));file.close()
	print("SCREEN_FIT ",JSON.stringify(report));quit(0 if failures.is_empty() else 1)
