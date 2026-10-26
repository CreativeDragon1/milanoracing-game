extends Node3D
var pit_skip_busy:=false

func can_skip_pit() -> bool:
	if not loaded or paused or online_mode or pit_skip_busy:return false
	return not director.model.drivers[0].pit.is_empty() if director else vehicle.pit_active

func skip_pit_drive() -> void:
	if not can_skip_pit():return
	pit_skip_busy=true
	var active_director=director
	var active_vehicle=vehicle
	if active_director:active_director.pit_skipping=true
	active_vehicle.enabled=false
	var layer:=CanvasLayer.new();layer.layer=100;add_child(layer)
	var cover:=ColorRect.new();cover.color=Color(0.02,0.025,0.04,0);cover.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT);layer.add_child(cover)
	await create_tween().tween_property(cover,"color:a",1.0,.22).finished
	var old_disable_3d:bool=viewport.disable_3d
	viewport.disable_3d=true
	var steps:=0
	while is_instance_valid(active_vehicle) and active_vehicle==vehicle and director==active_director and not paused:
		var in_pit:bool=not active_director.model.drivers[0].pit.is_empty() if active_director else active_vehicle.pit_active
		if not in_pit or steps>=72000:break
		var deadline:=Time.get_ticks_usec()+8000
		while in_pit and Time.get_ticks_usec()<deadline and steps<72000:
			if active_director:active_director.advance_hidden_pit(.05)
			else:active_vehicle.step_pit(.05)
			active_vehicle.enabled=false
			steps+=1
			in_pit=not active_director.model.drivers[0].pit.is_empty() if active_director else active_vehicle.pit_active
		await get_tree().process_frame
	if is_instance_valid(active_vehicle) and active_vehicle==vehicle:
		if is_instance_valid(active_director):active_director.complete_pit_skip()
		active_vehicle.reset_physics_interpolation();camera_initialized=false
		active_vehicle.throttle=0;active_vehicle.brake=0
	viewport.disable_3d=old_disable_3d if active_vehicle==vehicle else viewport.disable_3d
	await get_tree().process_frame
	await create_tween().tween_property(cover,"color:a",0.0,.3).finished
	layer.queue_free()
	if is_instance_valid(active_director):active_director.pit_skipping=false
	if is_instance_valid(active_vehicle) and active_vehicle==vehicle:active_vehicle.enabled=not paused and not active_director
	pit_skip_busy=false

const Vehicle = preload("res://scripts/vehicle.gd")
const Buffers = preload("res://scripts/instance_buffers.gd")
const EngineAudio = preload("res://scripts/engine_audio.gd")
const Floodlights = preload("res://scripts/floodlights.gd")
var tracks: Dictionary
var pits: Dictionary
var active_id := "interlagos"
var circuit: Dictionary
var world: Node3D
var working_crew:Node3D
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
var ui: CanvasLayer
var director: Node3D
var network: Node
var online_director: Node3D
var online_mode := false
var visual_upgrade: Node3D
var racing_guide: Node3D
var qa_race := false
var qa_rain := false
var shadow_clock := 0.0
var last_heading := 0.0
var garage_angle := 0.0
var race_physics_samples: Array[float] = []
var qa_menu := false
var qa_seconds := 12.0
var qa_quality := 1
var cinematic_mode:=false
var cinematic:Node
var qa_home:=false
var qa_complete_race:=false
var pending_new_session:=false
var learning=preload("res://scripts/adaptive_pace.gd").new()
var camera_focus:=Vector3.ZERO
var hud_clock:=0.0
var loading_started:=0
var loading_ms:=0.0
var loading_last_tick:=0
var assembling_circuit:=false
var queued_circuit:=""
var load_steps:Array=[]
var load_step_started:=0
var loading_frame_gaps:Array=[]
var qa_minimized_frames:=0
var shadow_lamps:Array=[]
var shadow_selection:Array=[]
var sky_cache:Dictionary={}
var loading_assets=preload("res://scripts/loading_assets.gd").new()
var geographic:Dictionary={}

func _ready() -> void:
	learning.load_store()
	tracks = JSON.parse_string(FileAccess.get_file_as_string("res://circuits/physics.json"))
	geographic = JSON.parse_string(FileAccess.get_file_as_string("res://circuits/geography.json"))
	pits = JSON.parse_string(FileAccess.get_file_as_string("res://circuits/pits.json"))
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--circuit="): active_id = arg.trim_prefix("--circuit=")
		if arg=="--qa": qa_mode = true
		if arg.begins_with("--qa-output="): qa_output = arg.trim_prefix("--qa-output=")
		if arg=="--qa-drive": qa_drive = true
		if arg=="--qa-race": qa_race = true
		if arg=="--qa-rain": qa_rain = true
		if arg=="--qa-menu": qa_menu = true
		if arg=="--qa-home": qa_home=true
		if arg=="--qa-complete-race": qa_complete_race=true; qa_race=true; qa_seconds=200
		if arg.begins_with("--qa-seconds="): qa_seconds=float(arg.trim_prefix("--qa-seconds="))
		if arg.begins_with("--qa-quality="): qa_quality=clampi(int(arg.trim_prefix("--qa-quality=")),0,2)
		if arg=="--capture": cinematic_mode=true; qa_mode=true
		if arg.begins_with("--qa-camera="): camera_mode = int(arg.trim_prefix("--qa-camera="))%3
	Engine.max_fps = 144
	viewport = get_viewport()
	build_environment()
	network=load("res://scripts/online_client.gd").new()
	add_child(network)
	network.snapshot_received.connect(receive_online)
	build_interface()
	if not qa_mode and not cinematic_mode:DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_MAXIMIZED)
	var updates=load("res://scripts/updates.gd").new();add_child(updates);updates.configure(self)
	if qa_mode: apply_quality(qa_quality); quality_select.select(qa_quality)
	engine_audio = EngineAudio.new()
	add_child(engine_audio)
	load_circuit(active_id)

func build_environment() -> void:
	var we := WorldEnvironment.new()
	we.environment = environment
	add_child(we)
	environment.background_mode = Environment.BG_SKY
	environment.sky = prepared_sky(active_id in ["singapore","bahrain","abu-dhabi"])
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
	environment.sdfgi_enabled=value==2
	environment.sdfgi_cascades=4
	environment.sdfgi_min_cell_size=.75
	environment.sdfgi_energy=.7
	environment.sdfgi_bounce_feedback=.35
	viewport.mesh_lod_threshold=[2.5,1.5,1.0][value]
	RenderingServer.directional_shadow_atlas_set_size(4096 if value<2 else 8192,true)

func build_interface() -> void:
	ui=load("res://scripts/game_ui.gd").new()
	add_child(ui)
	ui.configure(self)
	menu=ui.menu

func set_paused(value: bool) -> void:
	paused = value
	if value and not qa_mode: learning.flush()
	Engine.max_fps = 60 if value and not qa_mode else 144
	ui.show_garage(value)
	if director: director.paused=value
	if online_director: online_director.paused=value
	if vehicle: vehicle.enabled=not value and not director and not online_director
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if value else Input.MOUSE_MODE_HIDDEN

func _notification(what: int) -> void:
	if what==NOTIFICATION_APPLICATION_FOCUS_OUT and loaded and not qa_mode:
		set_paused(true)
		ui.home.video.paused=true
	if what==NOTIFICATION_APPLICATION_FOCUS_IN and is_instance_valid(ui) and not qa_mode:
		ui.home.video.paused=not ui.home.visible or not ui.home.motion

func load_circuit(id: String) -> void:
	if assembling_circuit or load_path!="":
		queued_circuit=id
		return
	if not FileAccess.file_exists("res://circuits/"+id+".scn"):
		status.text = "Circuit asset build required"
		return
	set_paused(true)
	if director: director.free(); director=null
	if online_director: online_director.free(); online_director=null
	if visual_upgrade: visual_upgrade.free(); visual_upgrade=null
	if racing_guide: racing_guide.free(); racing_guide=null
	loading_started=Time.get_ticks_usec()
	loading_last_tick=loading_started
	load_step_started=loading_started; load_steps.clear(); loading_frame_gaps.clear()
	loaded = false
	active_id = id
	load_path = "res://circuits/"+id+".scn"
	status.text = "Loading circuit…"
	ResourceLoader.load_threaded_request(load_path)
	var dry:=id in ["bahrain","abu-dhabi","zandvoort","solara"]
	var assets:Array[String]=["res://assets/pit-crew.res","res://assets/audio/gun.wav","res://assets/audio/jack.wav","res://assets/audio/tyre.wav","res://assets/mr26.scn","res://scripts/car_paint.gdshader","res://scripts/terrain.gdshader","res://scripts/road.gdshader","res://scripts/water.gdshader","res://scripts/architecture.gdshader"]
	for name in ["concrete-color.jpg","concrete-normal.jpg","asphalt-fine-color.webp","asphalt-fine-normal.webp","asphalt-fine-rough.webp","sand-fine-color.webp" if dry else "lawn-color.webp","sand-fine-normal.webp" if dry else "lawn-normal.webp"]:
		assets.append("res://assets/surfaces/"+name)
	if geographic.has(id):assets.append(geographic[id].cover)
	if id=="zandvoort":
		assets.append_array(["res://assets/surfaces/zandvoort-dune-cover.png","res://assets/surfaces/lawn-color.webp","res://assets/surfaces/lawn-normal.webp"])
	loading_assets.begin(assets)

func load_checkpoint(label:String) -> void:
	var now:=Time.get_ticks_usec()
	load_steps.append({"stage":str(status.text),"ms":float(now-load_step_started)/1000.0})
	status.text=label
	await get_tree().process_frame
	load_step_started=Time.get_ticks_usec()

func retire_world(old:Node) -> void:
	if not old:return
	if old is Node3D:old.visible=false
	var deadline:=Time.get_ticks_usec()+3000
	for child in old.get_children():
		child.free()
		if Time.get_ticks_usec()>deadline:
			await get_tree().process_frame
			deadline=Time.get_ticks_usec()+3000
	old.free()

func clear_runtime_owners(node:Node) -> void:
	# Ownership is editor serialization state. Detached runtime cells must not
	# retain an owner outside their temporary subtree.
	for child in node.get_children():clear_runtime_owners(child)
	node.owner=null

func finish_load() -> void:
	assembling_circuit=true
	await load_checkpoint("Preparing circuit…")
	var packed: PackedScene = ResourceLoader.load_threaded_get(load_path)
	while not loading_assets.complete():
		loading_assets.pump()
		if not loading_assets.failed.is_empty():
			status.text="Could not load circuit assets"; load_path=""; assembling_circuit=false
			push_error("Circuit asset failed: "+loading_assets.failed); return
		await get_tree().process_frame
	if world: await retire_world(world)
	if vehicle: vehicle.free()
	world = packed.instantiate()
	world.physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
	# Instantiate off-tree, then upload static cells within a small frame budget.
	# The prepared meshes, material quality and instance counts are unchanged.
	var staged_nodes:Array[Node]=world.get_children()
	for child in staged_nodes:
		clear_runtime_owners(child)
		world.remove_child(child)
	world.visible=false
	add_child(world)
	await load_checkpoint("Preparing scenery…")
	restored_instances=0
	var deadline:=Time.get_ticks_usec()+3000
	for child in staged_nodes:
		# Restore each cell independently, including children of vegetation groups.
		var cells:Array[Node]=[child]
		while not cells.is_empty():
			var cell:Node=cells.pop_back()
			if cell is MultiMeshInstance3D and cell.has_meta("gpu_buffer"):
				cell.multimesh.buffer=cell.get_meta("gpu_buffer")
				restored_instances+=cell.multimesh.instance_count
			cells.append_array(cell.get_children())
			if Time.get_ticks_usec()>deadline:
				await get_tree().process_frame
				deadline=Time.get_ticks_usec()+3000
		world.add_child(child)
		if Time.get_ticks_usec()>deadline:
			await get_tree().process_frame
			deadline=Time.get_ticks_usec()+3000
	await load_checkpoint("Preparing MR 26…")
	instance_errors = 0
	circuit = tracks[active_id]
	vehicle = Vehicle.new()
	add_child(vehicle)
	vehicle.configure(circuit,pits[active_id])
	working_crew=load("res://scripts/pit_crew.gd").new();world.add_child(working_crew);working_crew.configure(self,pits[active_id])
	vehicle.steering_strength=ui.sensitivity.value
	engine_audio.vehicle = vehicle
	network.car=vehicle
	await load_checkpoint("Preparing surfaces…")
	if geographic.has(active_id):
		var geo: Dictionary = geographic[active_id]
		var terrain := ShaderMaterial.new()
		terrain.shader = load("res://scripts/terrain.gdshader")
		var dry_ground: bool=active_id in ["bahrain","abu-dhabi","zandvoort","solara"]
		terrain.set_shader_parameter("detail_scale",1.8 if dry_ground else 1.4)
		terrain.set_shader_parameter("paving_albedo",load("res://assets/surfaces/concrete-color.jpg"))
		terrain.set_shader_parameter("paving_normal",load("res://assets/surfaces/concrete-normal.jpg"))
		terrain.set_shader_parameter("urban",0.0)
		terrain.set_shader_parameter("detail_albedo",load("res://assets/surfaces/sand-fine-color.webp" if dry_ground else "res://assets/surfaces/lawn-color.webp"))
		terrain.set_shader_parameter("detail_normal",load("res://assets/surfaces/sand-fine-normal.webp" if dry_ground else "res://assets/surfaces/lawn-normal.webp"))
		terrain.set_shader_parameter("cover",load(geo.cover))
		terrain.set_shader_parameter("geo_bounds",Vector4(geo.bounds[0][0],geo.bounds[0][1],geo.bounds[1][0]-geo.bounds[0][0],geo.bounds[1][1]-geo.bounds[0][1]))
		terrain.set_shader_parameter("cover_bounds",Vector4(geo.nearBounds[0][0],geo.nearBounds[0][1],geo.nearBounds[1][0]-geo.nearBounds[0][0],geo.nearBounds[1][1]-geo.nearBounds[0][1]))
		if active_id=="zandvoort":
			terrain.set_shader_parameter("coastal_dunes",true)
			terrain.set_shader_parameter("dune_cover",load("res://assets/surfaces/zandvoort-dune-cover.png"))
			terrain.set_shader_parameter("dune_grass",load("res://assets/surfaces/lawn-color.webp"))
			terrain.set_shader_parameter("dune_grass_normal",load("res://assets/surfaces/lawn-normal.webp"))
		for node in world.get_children():
			if node is MeshInstance3D and str(node.name) in ["Circuit terrain","Measured regional terrain","Grass verge"]: node.material_override = terrain
	var direction: Vector3 = world.get_meta("sun_direction").normalized()
	sun.look_at_from_position(direction*100,Vector3.ZERO)
	await load_checkpoint("Preparing lighting…")
	native_lights.clear()
	floodlights = Floodlights.new()
	world.add_child(floodlights)
	await floodlights.configure(circuit)
	# Realtime illumination is anchored to the existing modeled fixture geometry.
	deadline=Time.get_ticks_usec()+3000
	for node in world.get_children():
		if Time.get_ticks_usec()>deadline:
			await get_tree().process_frame
			deadline=Time.get_ticks_usec()+3000
		if node is MultiMeshInstance3D:
			var mat: Material = node.multimesh.mesh.surface_get_material(0)
			if mat is StandardMaterial3D and mat.emission_enabled and mat.emission_energy_multiplier>.5 and minf(mat.emission.r,minf(mat.emission.g,mat.emission.b))>.5 and not mat.emission_texture:
				var values: PackedFloat32Array = node.get_meta("instance_transforms",PackedFloat32Array())
				if values.is_empty(): continue
				for i in node.multimesh.instance_count:
					if Time.get_ticks_usec()>deadline:
						await get_tree().process_frame
						deadline=Time.get_ticks_usec()+3000
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
	shadow_lamps=native_lights.duplicate()
	shadow_lamps.append_array(floodlights.lamps)
	shadow_selection.clear()
	visual_upgrade=load("res://scripts/visual_upgrade.gd").new()
	add_child(visual_upgrade)
	await load_checkpoint("Preparing track finish…")
	await visual_upgrade.configure(world,circuit,vehicle)
	racing_guide=load("res://scripts/racing_guide.gd").new()
	add_child(racing_guide); racing_guide.configure(circuit,vehicle)
	racing_guide.visible=ui.guide.button_pressed
	apply_lighting()
	apply_weather(ui.weather.selected)
	await load_checkpoint("Finishing…")
	world.visible=true
	viewport.disable_3d=false
	vehicle.reset_at(0)
	camera.position=vehicle.position+Vector3(-8,4,0)
	camera.look_at(vehicle.position+Vector3(0,1,0))
	# Submit several real frames before enabling input. Pipeline uploads happen
	# behind the garage screen instead of hitching the first corner.
	var reflection_frames:=int(ProjectSettings.get_setting("rendering/reflections/sky_reflections/roughness_layers",8))+2
	for warm_frame in maxi(6,reflection_frames):await get_tree().process_frame
	load_steps.append({"stage":"First render","ms":float(Time.get_ticks_usec()-load_step_started)/1000.0})
	loading_ms=(Time.get_ticks_usec()-loading_started)/1000.0
	assembling_circuit=false
	loaded = true
	load_path = ""
	camera_initialized = false
	status.text = ""
	if queued_circuit!="":
		var next_id:=queued_circuit; queued_circuit=""
		if next_id!=active_id:load_circuit(next_id); return
	print("NATIVE_READY ",active_id," renderer=",RenderingServer.get_current_rendering_method())
	if online_mode and not network.room.is_empty(): setup_online_director()
	if cinematic_mode:
		cinematic=load("res://scripts/cinematic_capture.gd").new(); add_child(cinematic); cinematic.configure(self)
	if qa_mode:
		if qa_rain: apply_weather(1)
		vehicle.reset_at(int(circuit.N)*.21)
		if not qa_menu: menu.hide()
		if qa_race:
			ui.mode.select(1)
			create_session(true)
			set_paused(false)
		if qa_drive:
			vehicle.reset_at(0)
			set_paused(false)

func prepared_sky(night:bool) -> Sky:
	if sky_cache.has(night):return sky_cache[night]
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
	# Identical importance sampling and resolution, distributed over loading frames.
	sky.process_mode = Sky.PROCESS_MODE_INCREMENTAL
	sky_cache[night]=sky
	return sky

func apply_lighting() -> void:
	var night := light_mode==2 or (light_mode==0 and active_id in ["singapore","bahrain","abu-dhabi"])
	environment.sky = prepared_sky(night)
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR if night else Environment.AMBIENT_SOURCE_SKY
	environment.ambient_light_color = Color(.17,.21,.29)
	environment.ambient_light_energy = .45 if night else .22
	environment.fog_light_color = Color(.035,.05,.085) if night else Color(.56,.65,.76)
	sun.light_energy = .04 if night else 1.8
	sun.shadow_enabled = not night
	sun.light_color = Color(.55,.68,1) if night else Color(1,.95,.87)
	if light_mode==3:
		sun.rotation_degrees=Vector3(-14,-45,0)
		sun.light_color=Color(1,.69,.39)
		environment.ambient_light_energy=.28
		environment.fog_light_color=Color(.56,.43,.35)
	elif loaded:
		var direction: Vector3=world.get_meta("sun_direction").normalized()
		sun.look_at_from_position(direction*100,Vector3.ZERO)
	for light in native_lights: light.visible = night
	if is_instance_valid(floodlights): floodlights.visible = night

func _process(dt: float) -> void:
	if load_path:
		# Let the loading UI and initial sky pipeline present first. Submitting
		# the car's textures in that same first frame compounds the upload spike.
		if loading_frame_gaps.size()>2:loading_assets.pump()
		var loading_now:=Time.get_ticks_usec()
		loading_frame_gaps.append(float(loading_now-loading_last_tick)/1000.0)
		loading_last_tick=loading_now
		if assembling_circuit:return
		var progress := []
		var state := ResourceLoader.load_threaded_get_status(load_path,progress)
		if state==ResourceLoader.THREAD_LOAD_LOADED: finish_load()
		elif state==ResourceLoader.THREAD_LOAD_FAILED:
			status.text = "Could not load circuit"
			load_path = ""
		return
	if not loaded: return
	if cinematic:
		cinematic.update(dt)
		return
	engine_audio.active=not paused
	var visual_heading: float=-vehicle.get_global_transform_interpolated().basis.get_euler().y
	last_heading=lerp_angle(last_heading,visual_heading,1-exp(-12*dt)) if camera_initialized else visual_heading
	var forward := Vector3(cos(last_heading),0,sin(last_heading))
	var target: Vector3 = vehicle.get_global_transform_interpolated().origin
	var camera_target := target-forward*8.5+Vector3.UP*3.1
	var focus := target+forward*9+Vector3.UP*.75
	if camera_mode==1:
		camera_target = target+forward*.25+Vector3.UP*1.4
		focus = target+forward*30+Vector3.UP*1.3
	elif camera_mode==2:
		camera_target = target-forward*4.8+Vector3.UP*1.25+Vector3(-forward.z,0,forward.x)*2.2
		focus = target+forward*6+Vector3.UP*.65
	if paused and not qa_mode and not ui.reduced_motion.button_pressed:
		garage_angle+=dt*.08
		camera_target=target+Vector3(cos(garage_angle)*7,2.3,sin(garage_angle)*7)
		focus=target+Vector3.UP*.6
	camera.global_position = camera_target if not camera_initialized else camera.global_position.lerp(camera_target,1-exp(-10*dt))
	camera_focus=focus if not camera_initialized else camera_focus.lerp(focus,1-exp(-12*dt))
	camera.look_at(camera_focus)
	shadow_clock+=dt
	if shadow_clock>.5:
		shadow_clock=0
		update_near_shadows()
	camera_initialized = true
	camera.fov = lerpf(camera.fov,65+clampf(vehicle.speed/100,0,1)*7,1-exp(-3*dt))
	hud_clock+=dt
	if hud_clock>=.1:
		hud_clock=0
		hud.visible=false
		ui.timing.text=director.timing_text() if director else online_director.timing_text() if online_director else ""
	if director:
		if qa_mode: race_physics_samples.append(director.physics_ms)
		if director.model.phase.ends_with("result") and not paused and not qa_mode: set_paused(true)
		if director.model.phase=="qualifying" and not director.model.drivers[0].active:
			# Eliminated player can advance the remaining AI qualifying without waiting in real time.
			for step in 12: director.model.update(1.0/30)
	if qa_mode:
		if DisplayServer.window_get_mode()==DisplayServer.WINDOW_MODE_MINIMIZED:qa_minimized_frames+=1
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
		if qa_clock>qa_seconds or qa_complete_race and director and director.model.phase=="race_result":
			qa_mode = false
			RenderingServer.force_draw()
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
			report["race"]={"enabled":qa_race,"phase":director.model.phase if director else "practice","drivers":director.model.drivers.size() if director else 1,"physicsMeanMs":0.0 if race_physics_samples.is_empty() else race_physics_samples.reduce(func(a,b):return a+b,0.0)/race_physics_samples.size(),"elapsedSeconds":qa_clock,"finiteDrivers":director.model.drivers.all(func(d):return director.model.pose(d).position.is_finite()) if director else true}
			report["loadingMs"]=loading_ms
			report["loadingStages"]=load_steps
			report["loadingFrameGapsMs"]=loading_frame_gaps
			report["minimizedFrames"]=qa_minimized_frames
			report["p99Ms"]=frames[int(frames.size()*.99)]
			report["over33Ms"]=frames.filter(func(t):return t>33.33).size()
			report["over50Ms"]=frames.filter(func(t):return t>50).size()
			report["visuals"]={"roadMaterials":visual_upgrade.road_count,"facades":visual_upgrade.facade_count,"water":visual_upgrade.waters,"wet":visual_upgrade.wetness}
			report["restoredInstances"] = restored_instances
			report["home"]={"enabled":qa_home,"playing":ui.home.video.is_playing(),"position":ui.home.video.stream_position,"render3DDisabled":viewport.disable_3d}
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
			KEY_R: recover_vehicle()
			KEY_P: request_pit()
			KEY_K: skip_pit_drive()
			KEY_T: cycle_tyre()
			KEY_M: ui.circuit_map.toggle_view()
			KEY_F11: DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN if DisplayServer.window_get_mode()!=DisplayServer.WINDOW_MODE_FULLSCREEN else DisplayServer.WINDOW_MODE_MAXIMIZED)
	if event is InputEventJoypadButton and event.pressed:
		if event.button_index==JOY_BUTTON_START: set_paused(not paused)
		if event.button_index==JOY_BUTTON_Y: camera_mode = (camera_mode+1)%3
		if event.button_index==JOY_BUTTON_BACK: recover_vehicle()
		if event.button_index==JOY_BUTTON_X: request_pit()
		if event.button_index==JOY_BUTTON_RIGHT_SHOULDER: cycle_tyre()
		if event.button_index==JOY_BUTTON_DPAD_UP: ui.circuit_map.toggle_view()
		if event.button_index==JOY_BUTTON_DPAD_RIGHT: skip_pit_drive()

func create_session(autopilot: bool = false) -> void:
	if director: director.free(); director=null
	if ui.mode.selected==0: return
	director=load("res://scripts/race_director.gd").new()
	director.qa_autopilot=autopilot
	add_child(director)
	var options:Dictionary=ui.options()
	if autopilot: options.difficulty=3; options.laps=1; options.two_compounds=false
	if not autopilot and ui.adaptive.button_pressed:
		learning.flush(); options["learned_profile"]=learning.profile(circuit); director.learning=learning
	director.configure(vehicle,circuit,pits[active_id],options,"weekend" if ui.mode.selected==2 else "race")
	director.model.surface_grip=.74 if ui.weather.selected==1 else 1.0
	camera_initialized=false

func start_or_resume() -> void:
	if not loaded: return
	if pending_new_session: new_session(); return
	if not online_mode:
		if not director: create_session()
		if director: director.resume()
	set_paused(false)

func new_session() -> void:
	if not loaded: return
	pending_new_session=false
	leave_online()
	if director: director.free(); director=null
	vehicle.reset_at(0); vehicle.lap=0; vehicle.lap_clock=0; vehicle.lap_distance=0; vehicle.best_lap=INF
	create_session()
	if director: director.resume()
	set_paused(false)

func recover_vehicle() -> void:
	if not loaded: return
	if director: director.recover()
	elif online_mode:
		if network.room.get("phase","")=="race": network.command("reset"); vehicle.reset_at(vehicle.idx)
	else: vehicle.reset_at(vehicle.idx)

func request_pit() -> void:
	if not loaded or paused: return
	if director: director.request_pit()
	elif not online_mode: vehicle.pit_requested=not vehicle.pit_requested

func cycle_tyre() -> void:
	if director:
		var types: Array=["hard","medium","soft"]
		director.next_tyre=types[(types.find(director.next_tyre)+1)%3]

func apply_weather(value: int) -> void:
	if online_mode: value=0
	if visual_upgrade: visual_upgrade.set_weather(float(value))
	if vehicle: vehicle.grip_multiplier=.74 if value==1 else 1.0
	if director: director.model.surface_grip=.74 if value==1 else 1.0
	environment.fog_density=.0006 if value==1 else .00016
	environment.volumetric_fog_density=.0015 if value==1 else .0004

func update_near_shadows() -> void:
	if not floodlights or not floodlights.visible: return
	# Select exactly the same nearest lamps without sorting/rewriting every lamp.
	# Reapplying shadow flags to hundreds of unchanged lights disturbed frame pacing.
	var nearest:Array=[]
	var distances:Array[float]=[]
	var count:int=[1,2,4][quality]
	for light in shadow_lamps:
		var distance:float=light.position.distance_squared_to(vehicle.position)
		var at:=0
		while at<distances.size() and distances[at]<=distance: at+=1
		if at>=count:continue
		nearest.insert(at,light); distances.insert(at,distance)
		if nearest.size()>count:nearest.pop_back(); distances.pop_back()
	for light in shadow_selection:
		if is_instance_valid(light) and not nearest.has(light):light.shadow_enabled=false
	for light in nearest:
		if not shadow_selection.has(light):light.shadow_bias=.025; light.shadow_enabled=true
	shadow_selection=nearest

func join_online() -> void:
	if director: director.free(); director=null
	online_mode=true
	ui.weather.select(0); ui.weather.disabled=true
	apply_weather(0)
	circuit_select.disabled=true

func leave_online() -> void:
	network.disconnect_room()
	online_mode=false
	if online_director: online_director.free(); online_director=null
	circuit_select.disabled=false; ui.weather.disabled=false

func receive_online(data: Dictionary) -> void:
	if not online_mode: return
	var room: Dictionary=data.room
	ui.code.text=room.code
	if room.circuit!=active_id:
		for i in circuit_select.item_count:
			if circuit_select.get_item_metadata(i)==room.circuit: circuit_select.select(i)
		load_circuit(room.circuit)
	elif loaded and not online_director: setup_online_director()
	if room.phase in ["count","race"] and loaded and paused: set_paused(false)
	if room.phase=="results" and loaded and not paused: set_paused(true)

func setup_online_director() -> void:
	if online_director: online_director.free()
	online_director=load("res://scripts/online_director.gd").new()
	add_child(online_director)
	online_director.configure(network,vehicle,circuit)
