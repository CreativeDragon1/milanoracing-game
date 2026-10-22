extends Node3D

const Vehicle = preload("res://scripts/vehicle.gd")
const Vegetation = preload("res://scripts/vegetation.gd")
const EngineAudio = preload("res://scripts/engine_audio.gd")
const GroundDetail = preload("res://scripts/ground_detail.gd")
const Floodlights = preload("res://scripts/floodlights.gd")
var tracks: Dictionary
var pits: Dictionary
var active_id := "interlagos"
var circuit: Dictionary
var world: Node3D
var vehicle: Node3D
var camera := Camera3D.new()
var environment := Environment.new()
var sun := DirectionalLight3D.new()
var menu: PanelContainer
var hud: Label
var status: Label
var circuit_select: OptionButton
var quality_select: OptionButton
var camera_mode := 0
var paused := true
var loaded := false
var frames: Array[float] = []
var qa_mode := false
var qa_clock := 0.0
var quality := 1
var viewport: Viewport
var camera_initialized := false
var load_path := ""
var previous_tick := 0
var engine_audio: Node
var lighting_select: OptionButton
var light_mode := 0
var native_lights: Array[SpotLight3D] = []
var floodlights: Node3D
var restored_instances := 0
var instance_errors := 0
var qa_output := "res://../qa"
var qa_drive := false
var qa_input_time := 0.0
var qa_peak_speed := 0.0

func _ready() -> void:
	tracks = JSON.parse_string(FileAccess.get_file_as_string("res://circuits/physics.json"))
	pits = JSON.parse_string(FileAccess.get_file_as_string("res://circuits/pits.json"))
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--circuit="): active_id = arg.trim_prefix("--circuit=")
		if arg=="--qa": qa_mode = true
		if arg.begins_with("--qa-output="): qa_output = arg.trim_prefix("--qa-output=")
		if arg=="--qa-drive": qa_drive = true
		if arg.begins_with("--qa-camera="): camera_mode = int(arg.trim_prefix("--qa-camera="))%3
	Engine.max_fps = 144
	viewport = get_viewport()
	build_environment()
	build_interface()
	engine_audio = EngineAudio.new()
	add_child(engine_audio)
	load_circuit(active_id)

func build_environment() -> void:
	var we := WorldEnvironment.new()
	we.environment = environment
	add_child(we)
	environment.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var material := PanoramaSkyMaterial.new()
	material.panorama = load("res://assets/sky.hdr")
	sky.sky_material = material
	sky.radiance_size = Sky.RADIANCE_SIZE_512
	environment.sky = sky
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	environment.ambient_light_energy = .35
	environment.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	environment.tonemap_mode = Environment.TONE_MAPPER_ACES
	environment.tonemap_exposure = .9
	environment.tonemap_white = 6.0
	environment.ssao_enabled = true
	environment.ssao_radius = 1.0
	environment.ssao_intensity = 1.3
	environment.ssil_enabled = true
	environment.ssil_radius = 4
	environment.ssil_intensity = .7
	environment.ssr_enabled = true
	environment.ssr_max_steps = 64
	environment.glow_enabled = true
	environment.glow_intensity = .35
	environment.glow_bloom = 0
	environment.fog_enabled = true
	environment.fog_density = .00016
	environment.fog_sky_affect = .12
	environment.fog_light_color = Color(.56,.65,.76)
	environment.fog_height = 0
	environment.fog_height_density = .003
	environment.volumetric_fog_enabled = true
	environment.volumetric_fog_density = .0004
	environment.volumetric_fog_length = 180
	environment.volumetric_fog_sky_affect = .12
	sun.light_color = Color(1,.91,.78)
	sun.light_energy = 1.6
	sun.shadow_enabled = true
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS
	sun.directional_shadow_max_distance = 360
	sun.directional_shadow_split_1 = .07
	sun.directional_shadow_split_2 = .20
	sun.directional_shadow_split_3 = .48
	sun.shadow_bias = .03
	sun.shadow_normal_bias = .5
	sun.light_angular_distance = .7
	add_child(sun)
	sun.rotation_degrees = Vector3(-32,-25,0)
	camera.fov = 65
	camera.near = .25
	camera.far = 7000
	camera.physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
	add_child(camera)
	camera.make_current()
	apply_quality(1)

func apply_quality(value: int) -> void:
	quality = value
	viewport.scaling_3d_mode = Viewport.SCALING_3D_MODE_FSR2
	viewport.scaling_3d_scale = [.67,.83,1.0][value]
	viewport.msaa_3d = Viewport.MSAA_DISABLED
	environment.ssil_enabled = value>0
	environment.ssr_enabled = value>0
	environment.volumetric_fog_enabled = value>0
	sun.directional_shadow_max_distance = [200,360,500][value]
	environment.ssr_max_steps = [32,64,96][value]
	RenderingServer.directional_shadow_atlas_set_size(4096 if value<2 else 8192,true)

func build_interface() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var theme := Theme.new()
	theme.default_font = load("res://assets/fonts/Barlow-Bold.ttf")
	theme.default_font_size = 20
	var style := StyleBoxFlat.new()
	style.bg_color = Color(.025,.035,.055,.94)
	style.content_margin_left = 34
	style.content_margin_right = 34
	style.content_margin_top = 28
	style.content_margin_bottom = 28
	style.border_width_left = 4
	style.border_color = Color("ff7a00")
	menu = PanelContainer.new()
	menu.theme = theme
	menu.add_theme_stylebox_override("panel",style)
	menu.position = Vector2(55,90)
	menu.custom_minimum_size = Vector2(430,0)
	layer.add_child(menu)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation",18)
	menu.add_child(box)
	var brand := Label.new()
	brand.text = "MILANO RACING"
	brand.add_theme_font_override("font",load("res://assets/fonts/Michroma.ttf"))
	brand.add_theme_font_size_override("font_size",25)
	box.add_child(brand)
	var sub := Label.new()
	sub.text = "ALWAYS THE FASTEST"
	sub.add_theme_color_override("font_color",Color("ff7a00"))
	sub.add_theme_font_size_override("font_size",16)
	box.add_child(sub)
	circuit_select = OptionButton.new()
	for id in tracks:
		if FileAccess.file_exists("res://circuits/"+id+".scn"):
			circuit_select.add_item(str(tracks[id].name).to_upper())
			circuit_select.set_item_metadata(circuit_select.item_count-1,id)
			if id==active_id: circuit_select.select(circuit_select.item_count-1)
	circuit_select.item_selected.connect(func(i): load_circuit(circuit_select.get_item_metadata(i)))
	box.add_child(circuit_select)
	quality_select = OptionButton.new()
	for s in ["PERFORMANCE","HIGH","ULTRA"]: quality_select.add_item(s)
	quality_select.select(1)
	quality_select.item_selected.connect(apply_quality)
	box.add_child(quality_select)
	lighting_select = OptionButton.new()
	for s in ["CIRCUIT LIGHTING","DAYLIGHT","FLOODLIGHTS"]: lighting_select.add_item(s)
	lighting_select.item_selected.connect(func(i): light_mode=i; apply_lighting())
	box.add_child(lighting_select)
	var drive := Button.new()
	drive.text = "DRIVE"
	drive.custom_minimum_size.y = 58
	drive.pressed.connect(func(): if loaded: set_paused(false))
	box.add_child(drive)
	status = Label.new()
	status.text = "Loading circuit…"
	status.add_theme_font_size_override("font_size",16)
	box.add_child(status)
	var controls := Label.new()
	controls.text = "WASD or arrows    Drive\nC    Camera      P    Request pit stop\nR    Recover     Esc    Garage\nController: left stick and triggers"
	controls.add_theme_font_size_override("font_size",16)
	controls.add_theme_color_override("font_color",Color(.65,.7,.78))
	box.add_child(controls)
	var logo := TextureRect.new()
	logo.texture = load("res://assets/team-logo.png")
	logo.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	logo.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	logo.position = Vector2(get_viewport().get_visible_rect().size.x-250,28)
	logo.size = Vector2(220,95)
	layer.add_child(logo)
	hud = Label.new()
	hud.theme = theme
	hud.position = Vector2(55,740)
	hud.add_theme_font_override("font",load("res://assets/fonts/Barlow-ExtraBoldItalic.ttf"))
	hud.add_theme_font_size_override("font_size",25)
	hud.add_theme_color_override("font_shadow_color",Color.BLACK)
	hud.add_theme_constant_override("shadow_offset_x",1)
	hud.add_theme_constant_override("shadow_offset_y",1)
	layer.add_child(hud)

func set_paused(value: bool) -> void:
	paused = value
	Engine.max_fps = 45 if value and not qa_mode else 144
	menu.visible = value
	if vehicle: vehicle.enabled = not value
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if value else Input.MOUSE_MODE_HIDDEN

func _notification(what: int) -> void:
	if what==NOTIFICATION_APPLICATION_FOCUS_OUT and loaded and not qa_mode:
		set_paused(true)

func load_circuit(id: String) -> void:
	if not FileAccess.file_exists("res://circuits/"+id+".scn"):
		status.text = "Circuit asset build required"
		return
	set_paused(true)
	loaded = false
	active_id = id
	load_path = "res://circuits/"+id+".scn"
	status.text = "Loading circuit…"
	ResourceLoader.load_threaded_request(load_path)

func finish_load() -> void:
	var packed: PackedScene = ResourceLoader.load_threaded_get(load_path)
	if world: world.free()
	if vehicle: vehicle.free()
	world = packed.instantiate()
	world.physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
	add_child(world)
	restored_instances = 0
	instance_errors = 0
	for node in world.get_children():
		if node is MultiMeshInstance3D and node.has_meta("instance_transforms"):
			var values: PackedFloat32Array = node.get_meta("instance_transforms")
			var colors: PackedFloat32Array = node.get_meta("instance_colors",PackedFloat32Array())
			for i in node.multimesh.instance_count:
				var j: int = i*16
				node.multimesh.set_instance_transform(i,Transform3D(Basis(Vector3(values[j],values[j+1],values[j+2]),Vector3(values[j+4],values[j+5],values[j+6]),Vector3(values[j+8],values[j+9],values[j+10])),Vector3(values[j+12],values[j+13],values[j+14])))
				if colors.size(): node.multimesh.set_instance_color(i,Color(colors[i*3],colors[i*3+1],colors[i*3+2]))
				restored_instances += 1
	circuit = tracks[active_id]
	vehicle = Vehicle.new()
	add_child(vehicle)
	vehicle.configure(circuit,pits[active_id])
	engine_audio.vehicle = vehicle
	var source: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://circuits/"+active_id+".json"))
	var geographic: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://circuits/geography.json"))
	if geographic.has(active_id):
		var geo: Dictionary = geographic[active_id]
		var terrain := ShaderMaterial.new()
		terrain.shader = load("res://scripts/terrain.gdshader")
		terrain.set_shader_parameter("detail_albedo",load("res://assets/surfaces/grass-color.jpg"))
		terrain.set_shader_parameter("detail_normal",load("res://assets/surfaces/grass-normal.jpg"))
		terrain.set_shader_parameter("satellite",load(geo.satellite))
		terrain.set_shader_parameter("cover",load(geo.cover))
		terrain.set_shader_parameter("geo_bounds",Vector4(geo.bounds[0][0],geo.bounds[0][1],geo.bounds[1][0]-geo.bounds[0][0],geo.bounds[1][1]-geo.bounds[0][1]))
		terrain.set_shader_parameter("cover_bounds",Vector4(geo.nearBounds[0][0],geo.nearBounds[0][1],geo.nearBounds[1][0]-geo.nearBounds[0][0],geo.nearBounds[1][1]-geo.nearBounds[0][1]))
		for node in world.get_children():
			if node is MeshInstance3D and str(node.name) in ["Circuit terrain","Measured regional terrain"]: node.material_override = terrain
	var direction := Vector3(source.sun[0],source.sun[1],source.sun[2]).normalized()
	sun.look_at_from_position(direction*100,Vector3.ZERO)
	var vegetation := Vegetation.new()
	world.add_child(vegetation)
	vegetation.configure(source.trees)
	var detail := GroundDetail.new()
	world.add_child(detail)
	detail.configure(active_id)
	native_lights.clear()
	floodlights = Floodlights.new()
	world.add_child(floodlights)
	floodlights.configure(circuit)
	# Realtime illumination is anchored to the existing modeled fixture geometry.
	for node in world.get_children():
		if node is MultiMeshInstance3D:
			var mat: Material = node.multimesh.mesh.surface_get_material(0)
			if mat is StandardMaterial3D and mat.emission_enabled and mat.emission_energy_multiplier>.5 and minf(mat.emission.r,minf(mat.emission.g,mat.emission.b))>.5 and not mat.emission_texture:
				for i in node.multimesh.instance_count:
					var values: PackedFloat32Array = node.get_meta("instance_transforms",PackedFloat32Array())
					if values.is_empty(): continue
					var j: int = i*16
					var transform: Transform3D = node.global_transform*Transform3D(Basis(Vector3(values[j],values[j+1],values[j+2]),Vector3(values[j+4],values[j+5],values[j+6]),Vector3(values[j+8],values[j+9],values[j+10])),Vector3(values[j+12],values[j+13],values[j+14]))
					var size := transform.basis.get_scale().abs()
					if size.y>.6 or size.x<1: continue
					var light := SpotLight3D.new()
					light.position = transform.origin-Vector3.UP*.2
					light.rotation_degrees.x = -90
					light.light_color = Color(.88,.94,1)
					light.light_energy = 55
					light.spot_range = 60
					light.spot_angle = 65
					light.spot_attenuation = .65
					light.distance_fade_enabled = true
					light.distance_fade_begin = 180
					light.distance_fade_length = 60
					world.add_child(light)
					native_lights.append(light)
	apply_lighting()
	loaded = true
	load_path = ""
	camera_initialized = false
	status.text = "MR 26   •   %.3f KM" % (float(circuit.length)/1000)
	print("NATIVE_READY ",active_id," renderer=",RenderingServer.get_current_rendering_method())
	if qa_mode:
		vehicle.reset_at(int(circuit.N)*.21)
		menu.hide()
		if qa_drive:
			vehicle.reset_at(0)
			set_paused(false)

func apply_lighting() -> void:
	var night := light_mode==2 or (light_mode==0 and active_id in ["singapore","bahrain","abu-dhabi"])
	var sky := Sky.new()
	if night:
		var material := ProceduralSkyMaterial.new()
		material.sky_top_color = Color(.004,.008,.025)
		material.sky_horizon_color = Color(.045,.055,.09)
		material.ground_horizon_color = Color(.035,.04,.065)
		material.ground_bottom_color = Color(.005,.006,.01)
		sky.sky_material = material
	else:
		var material := PanoramaSkyMaterial.new()
		material.panorama = load("res://assets/sky.hdr")
		sky.sky_material = material
	sky.radiance_size = Sky.RADIANCE_SIZE_512
	environment.sky = sky
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR if night else Environment.AMBIENT_SOURCE_SKY
	environment.ambient_light_color = Color(.17,.21,.29)
	environment.ambient_light_energy = .6 if night else .35
	environment.fog_light_color = Color(.035,.05,.085) if night else Color(.56,.65,.76)
	sun.light_energy = .04 if night else 1.2
	sun.shadow_enabled = not night
	sun.light_color = Color(.55,.68,1) if night else Color(1,.91,.78)
	for light in native_lights: light.visible = night
	if is_instance_valid(floodlights): floodlights.visible = night

func _process(dt: float) -> void:
	if load_path:
		var progress := []
		var state := ResourceLoader.load_threaded_get_status(load_path,progress)
		if state==ResourceLoader.THREAD_LOAD_LOADED: finish_load()
		elif state==ResourceLoader.THREAD_LOAD_FAILED:
			status.text = "Could not load circuit"
			load_path = ""
		return
	if not loaded: return
	var forward := Vector3(cos(vehicle.heading),0,sin(vehicle.heading))
	var target: Vector3 = vehicle.get_global_transform_interpolated().origin
	var camera_target := target-forward*8.5+Vector3.UP*3.1
	var focus := target+forward*9+Vector3.UP*.75
	if camera_mode==1:
		camera_target = target+forward*.25+Vector3.UP*1.4
		focus = target+forward*30+Vector3.UP*1.3
	elif camera_mode==2:
		camera_target = target-forward*4.8+Vector3.UP*1.25+Vector3(-forward.z,0,forward.x)*2.2
		focus = target+forward*6+Vector3.UP*.65
	camera.global_position = camera_target if not camera_initialized else camera.global_position.lerp(camera_target,1-exp(-10*dt))
	camera.look_at(focus)
	camera_initialized = true
	camera.fov = lerpf(camera.fov,65+clampf(vehicle.speed/100,0,1)*7,1-exp(-3*dt))
	hud.text = "%03d  KM/H     %d\n%s    LAP %d    %02d:%05.2f" % [vehicle.speed*3.6,vehicle.gear,str(circuit.name).to_upper(),vehicle.lap+1,int(vehicle.lap_clock/60),fmod(vehicle.lap_clock,60)]
	if vehicle.pit_active: hud.text += "    PIT LANE"
	elif vehicle.pit_requested: hud.text += "    BOX THIS LAP"
	if qa_mode:
		qa_clock += dt
		if qa_drive:
			qa_input_time += dt
			var event := InputEventKey.new()
			event.keycode = KEY_W
			event.physical_keycode = KEY_W
			event.pressed = qa_input_time<5
			Input.parse_input_event(event)
			Input.flush_buffered_events()
			qa_peak_speed = maxf(qa_peak_speed,vehicle.speed)
		var tick := Time.get_ticks_usec()
		if qa_clock>3 and previous_tick>0: frames.append((tick-previous_tick)/1000.0)
		previous_tick = tick
		if qa_clock>12:
			qa_mode = false
			await RenderingServer.frame_post_draw
			for node in world.get_children():
				if node is MultiMeshInstance3D and node.has_meta("instance_transforms"):
					var values: PackedFloat32Array = node.get_meta("instance_transforms")
					for i in node.multimesh.instance_count:
						var j: int = i*16
						if not node.multimesh.get_instance_transform(i).origin.is_equal_approx(Vector3(values[j+12],values[j+13],values[j+14])): instance_errors += 1
			var image := get_viewport().get_texture().get_image()
			qa_output = ProjectSettings.globalize_path(qa_output)
			DirAccess.make_dir_recursive_absolute(qa_output)
			image.save_png(qa_output+"/native-"+active_id+".png")
			frames.sort()
			var report := {"circuit":active_id,"renderer":RenderingServer.get_current_rendering_method(),"device":RenderingServer.get_video_adapter_name(),"frames":frames.size(),"medianMs":frames[frames.size()/2],"p95Ms":frames[int(frames.size()*.95)],"drawCalls":Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),"primitives":Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME)}
			report["restoredInstances"] = restored_instances
			report["instanceErrors"] = instance_errors
			report["inputSmoke"] = {"enabled":qa_drive,"peakKmh":qa_peak_speed*3.6,"finitePosition":vehicle.position.is_finite()}
			var file := FileAccess.open(qa_output+"/native-"+active_id+".json",FileAccess.WRITE)
			file.store_string(JSON.stringify(report,"\t"))
			print("NATIVE_QA ",JSON.stringify(report))
			get_tree().quit()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		match event.physical_keycode:
			KEY_ESCAPE: set_paused(not paused)
			KEY_C: camera_mode = (camera_mode+1)%3
			KEY_R: if vehicle: vehicle.reset_at(vehicle.idx)
			KEY_P: if vehicle: vehicle.pit_requested = not vehicle.pit_requested
			KEY_F11: DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN if DisplayServer.window_get_mode()!=DisplayServer.WINDOW_MODE_FULLSCREEN else DisplayServer.WINDOW_MODE_WINDOWED)
	if event is InputEventJoypadButton and event.pressed:
		if event.button_index==JOY_BUTTON_START: set_paused(not paused)
		if event.button_index==JOY_BUTTON_Y: camera_mode = (camera_mode+1)%3
		if event.button_index==JOY_BUTTON_BACK and vehicle: vehicle.reset_at(vehicle.idx)
