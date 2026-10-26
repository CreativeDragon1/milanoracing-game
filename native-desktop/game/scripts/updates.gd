extends Node
var game:Node
var config:Dictionary
var cache:=""
var worker_pid:=-1
var last_cookie:=""
var button:Button
var permit:=false
var timer:Timer
var next_check:=0
func configure(main:Node) -> void:
	game=main
	button=game.ui.button("",restart);button.hide();button.custom_minimum_size.x=432;button.add_theme_font_size_override("font_size",13);game.ui.home.hero.add_child(button)
	if game.qa_mode or OS.get_name()!="Windows" or OS.has_feature("editor"):return
	config=JSON.parse_string(FileAccess.get_file_as_string("res://assets/update-config.json"))
	var folder:=OS.get_executable_path().get_base_dir()
	if OS.get_executable_path().get_file()!="Milano Apex.exe":return
	cache=folder.path_join(".milano-update")
	if DirAccess.make_dir_recursive_absolute(cache)!=OK:return
	var helper:=FileAccess.open(cache.path_join("update.ps1"),FileAccess.WRITE)
	if not helper:return
	helper.store_string(FileAccess.get_file_as_string("res://assets/update-worker.ps1"));helper.close()
	next_check=Time.get_ticks_msec()+12000
	# A timer owns small status reads; no network, hashing or extraction on the render thread.
	timer=Timer.new();timer.wait_time=2;timer.timeout.connect(tick);add_child(timer);timer.start()
	await get_tree().create_timer(12).timeout
	check()
func check() -> void:
	if cache.is_empty() or (worker_pid>0 and OS.is_process_running(worker_pid)):return
	next_check=Time.get_ticks_msec()+900000
	var cookie:String=game.network.cookie if game.network.origin=="https://game.milanoracing.team" else ""
	last_cookie=cookie
	var job:={"install":OS.get_executable_path().get_base_dir(),"feed":config.feed,"sequence":config.sequence,"cookie":cookie,"parent":OS.get_process_id()}
	var file:=FileAccess.open(cache.path_join("job.json"),FileAccess.WRITE);if not file:return
	file.store_string(JSON.stringify(job));file.close()
	worker_pid=OS.create_process("powershell.exe",PackedStringArray(["-NoProfile","-NonInteractive","-WindowStyle","Hidden","-ExecutionPolicy","Bypass","-File",cache.path_join("update.ps1"),"-JobPath",cache.path_join("job.json")]),false)
func tick() -> void:
	var allowed:bool=game.loaded and game.paused and game.ui.home.visible
	if allowed!=permit:
		permit=allowed
		var busy:=cache.path_join("busy")
		if allowed:DirAccess.remove_absolute(busy)
		else:
			var file:=FileAccess.open(busy,FileAccess.WRITE);if file:file.store_string("race")
	var cookie:String=game.network.cookie if game.network.origin=="https://game.milanoracing.team" else ""
	if allowed and (Time.get_ticks_msec()>=next_check or (cookie!=last_cookie and not cookie.is_empty())):check()
	var path:=cache.path_join("status.json")
	if not FileAccess.file_exists(path):return
	var status:Variant=JSON.parse_string(FileAccess.get_file_as_string(path).trim_prefix("\ufeff"))
	if not status is Dictionary:return
	button.visible=status.get("state","")=="ready";button.text="RESTART TO UPDATE"
func restart() -> void:
	if not game.paused:return
	var file:=FileAccess.open(cache.path_join("restart"),FileAccess.WRITE)
	if not file:return
	file.store_string("restart");file.close();game.ui.save_preferences();get_tree().quit()
