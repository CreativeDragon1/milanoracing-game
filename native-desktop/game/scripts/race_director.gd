extends Node3D
const Model = preload("res://scripts/race_model.gd")
var learning: RefCounted
var learn_rows:Array=[]
var learn_lap:=-1
var learn_clean:=true
var learn_clock:=0.0
var model: RefCounted
var vehicle: Node3D
var cars: Array[Node3D] = []
var paused := true
var message := ""
var message_until := 0.0
var next_tyre := "hard"
var previous_phase := ""
var player_was_in_pit := false
var pit_skipping := false
var qa_autopilot := false
var physics_ms := 0.0
var player_contact_time := 0.0
var spatial_audio: Array[AudioStreamPlayer3D] = []
var audio_clock:=0.0
var car_parts:Array[Array]=[]
var shadow_near:Array[bool]=[]
var wheels:Array[Array]=[]
var wheel_angles:Array[float]=[]
var pose_buffers:Array[Dictionary]=[]

func configure(car: Node3D,track: Dictionary,pit: Dictionary,options: Dictionary,mode: String) -> void:
	vehicle=car
	model=Model.new(); model.configure(track,pit,options)
	model.automatic_player=qa_autopilot
	for i in 4:
		var sound:=AudioStreamPlayer3D.new()
		var stream:AudioStreamWAV=load("res://assets/audio/high.wav").duplicate()
		stream.loop_mode=AudioStreamWAV.LOOP_FORWARD; stream.loop_end=stream.data.size()/2
		sound.stream=stream; sound.max_distance=120; sound.unit_size=8; sound.volume_db=-26
		sound.doppler_tracking=AudioStreamPlayer3D.DOPPLER_TRACKING_PHYSICS_STEP
		add_child(sound); sound.play(); spatial_audio.append(sound)
	for id in range(1,22):
		pose_buffers.append({})
		var root := Node3D.new()
		add_child(root)
		var visual: Node3D = vehicle.duplicate_race_visual()
		root.add_child(visual)
		var wheel_set:=[]
		for part in visual.get_children():
			for original in vehicle.wheel_parts:
				if part.name==original.name: wheel_set.append(part)
		wheels.append(wheel_set); wheel_angles.append(0.0)
		car_parts.append(visual.get_children()); shadow_near.append(true)
		for part in visual.get_children():
			if part is GeometryInstance3D:
				part.visibility_range_end=500
				part.visibility_range_end_margin=50
				part.visibility_range_fade_mode=GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
		# Small number plate distinguishes the field without replacing supplied livery.
		var plate := Label3D.new(); plate.font=load("res://assets/fonts/Michroma.ttf")
		plate.text="%02d" % (id+1); plate.font_size=80; plate.pixel_size=.0035
		plate.position=Vector3(-2.1,.95,0); plate.rotation.y=-PI/2
		plate.modulate=Color.from_hsv(float(id%6)/6,.7,1)
		root.add_child(plate)
		cars.append(root)
	if mode=="weekend": model.start_qualifying()
	else: model.start_race()
	sync_grid()

func sync_grid() -> void:
	var d: Dictionary = model.drivers[0]
	var pose: Dictionary = model.pose(d)
	vehicle.reset_at(floori(fposmod(d.progress,model.length)/model.length*model.count))
	apply_player_pose(pose,d.v,true)
	vehicle.lap=0; vehicle.lap_clock=0; vehicle.lap_distance=0; vehicle.best_lap=INF
	vehicle.pit_requested=false; vehicle.pit_active=false
	player_was_in_pit=not d.pit.is_empty()
	for id in range(1,22):
		place(cars[id-1],model.pose(model.drivers[id]))
		cars[id-1].reset_physics_interpolation()

func place(node: Node3D,pose: Dictionary) -> void:
	node.position=pose.position
	node.rotation=Vector3(-pose.bank,-pose.heading,atan(pose.grade))

func apply_player_pose(pose: Dictionary,speed: float,reset: bool = false) -> void:
	place(vehicle,pose)
	vehicle.heading=pose.heading; vehicle.speed=speed
	vehicle.idx=posmod(floori(fposmod(pose.progress,model.length)/model.length*model.count),model.count)
	vehicle.side_speed=0; vehicle.yaw_rate=0
	if reset: vehicle.reset_physics_interpolation()

func resume() -> void:
	if model.phase=="qualifying_result":
		if model.full_qualifying and model.stage<2: model.start_qualifying(model.stage+1)
		else: model.start_race()
		sync_grid()
	elif model.phase=="race_result":
		model.start_race(); sync_grid()
	paused=false

func request_pit() -> void:
	model.request_pit(0,next_tyre)
	message="BOX THIS LAP   ·   "+next_tyre.to_upper() if model.drivers[0].requested else "PIT REQUEST CANCELLED"
	message_until=model.clock+6

func recover() -> void:
	learn_clean=false
	if not model.phase in ["race","qualifying"]: return
	model.recover_player()
	var d: Dictionary = model.drivers[0]
	if not d.pit.is_empty(): return
	d.offset=0; d.v=0
	apply_player_pose(model.pose(d),0,true)
	message="RECOVERED   +5 SEC" if model.phase=="race" else "LAP INVALIDATED"
	message_until=model.clock+5

func _physics_process(dt: float) -> void:
	if pit_skipping:return
	advance_session(dt)

func advance_hidden_pit(dt:float) -> void:
	# The same session rules advance every competitor. Hidden render poses,
	# wheel transforms, collision visuals and learning samples are unnecessary.
	model.update(dt)
	model.events.clear()

func complete_pit_skip() -> void:
	var d:Dictionary=model.drivers[0]
	apply_player_pose(model.pit_pose(d) if not d.pit.is_empty() else d.get("last_pit_pose",model.pose(d)),d.v,true)
	vehicle.lap=d.laps;vehicle.lap_clock=model.clock-d.lap_start
	vehicle.gear=clampi(ceili(d.v/18),1,6);vehicle.rpm=clampf(4500+d.v*140,4500,18000)
	player_was_in_pit=not d.pit.is_empty()
	for id in range(1,22):
		place(cars[id-1],model.pose(model.drivers[id]));cars[id-1].reset_physics_interpolation()
	message="PIT EXIT   ·   WATCH TRAFFIC";message_until=model.clock+4

func advance_session(dt:float) -> void:
	if not model: return
	var d: Dictionary = model.drivers[0]
	vehicle.enabled=not paused and model.phase in ["race","qualifying"] and d.active and not d.finished and not d.stage_done and d.pit.is_empty() and not qa_autopilot
	if paused: return
	var started := Time.get_ticks_usec()
	if vehicle.enabled:
		var projection: Dictionary = vehicle.project(vehicle.position,vehicle.idx)
		model.update_player(projection.i+projection.fraction,vehicle.speed,vehicle.lateral,dt)
		vehicle.grip_multiplier=model.grip(d)
		vehicle.assist_target=model.speed_at(d,projection.i+projection.fraction)
		vehicle.brake_assist=model.difficulty==0
	# The physics model runs at 120 Hz; render interpolation never moves race state.
	model.update(dt)
	observe_learning(dt)
	var in_pit: bool = not d.pit.is_empty()
	if in_pit or player_was_in_pit or qa_autopilot or d.finished:
		vehicle.reverse=false;vehicle.reverse_armed=false;vehicle.reverse_hold=0
		var pose:Dictionary=d.last_pit_pose if player_was_in_pit and not in_pit and d.has("last_pit_pose") else model.pose(d)
		apply_player_pose(pose,d.v)
		var curve:float=pose.get("curvature",0.0)
		var angle:=atan(3.0*curve)
		var max_lat:=minf(60,2.0*(800*9.81+2.6*1.2*d.v*d.v)/800)
		var lock:=minf(.50,atan(max_lat*3.0/maxf(d.v*d.v,12.0)))*.92
		vehicle.steering=clampf(angle/maxf(.01,lock*vehicle.steering_strength),-1,1)
		vehicle.yaw_rate=curve*d.v
		vehicle.gear=clampi(ceili(d.v/18),1,6); vehicle.rpm=clampf(4500+d.v*140,4500,18000)
		vehicle.throttle=.35 if d.v>1 else 0
		vehicle.animate_wheels(dt,angle)
	player_was_in_pit=in_pit
	vehicle.lap=d.laps; vehicle.lap_clock=model.clock-d.lap_start
	for id in range(1,22):
		var opponent: Dictionary = model.drivers[id]
		var car := cars[id-1]
		car.visible=opponent.active and not opponent.stage_done
		place(car,model.pose(opponent,pose_buffers[id-1]))
		wheel_angles[id-1]=fposmod(wheel_angles[id-1]-opponent.v*dt/.373,TAU)
		var station:float=fposmod(opponent.progress,model.length)/model.length*model.count
		var steering_angle:=atan(float(model.pit_pose(opponent).curvature)*3) if not opponent.pit.is_empty() else atan(Model.sample(model.track.line.curvature,station)*3)
		if car.position.distance_squared_to(vehicle.position)<150*150:
			for wheel in wheels[id-1]: wheel.rotation=Vector3(0,-steering_angle if wheel.position.x>0 else 0,wheel_angles[id-1])
		# Contact resolves longitudinal velocity without teleporting either driver.
		if vehicle.enabled and car.visible and opponent.pit.is_empty() and not in_pit:
			var delta := car.position-vehicle.position
			var forward := Vector3(cos(vehicle.heading),0,sin(vehicle.heading))
			var along := delta.dot(forward)
			var sideways := delta.dot(Vector3(-forward.z,0,forward.x))
			if along>0 and along<5.6 and absf(sideways)<1.65 and absf(delta.y)<1.5:
				vehicle.speed=move_toward(vehicle.speed,minf(vehicle.speed,opponent.v),55*dt)
				vehicle.throttle=minf(vehicle.throttle,.15)
	for event in model.events:
		if event.get("id",-1)==0:
			match event.type:
				"pit_service": message="TYRES ON   ·   "+d.tyre.to_upper()
				"pit_exit": message="PIT EXIT   ·   WATCH TRAFFIC"
				"track_limits": message="TRACK LIMITS   +5 SEC" if d.warnings%4==0 else "TRACK LIMITS   WARNING %d" % (d.warnings%4)
				"lap": message="LAP   %s" % time_text(event.seconds)
				"finish": message="CHEQUERED FLAG"
			message_until=model.clock+6
	model.events.clear()
	physics_ms=(Time.get_ticks_usec()-started)/1000.0

func _process(dt: float) -> void:
	if not model: return
	audio_clock+=dt
	if audio_clock<.15: return
	audio_clock=0
	for i in cars.size():
		var near:bool=cars[i].position.distance_squared_to(vehicle.position)<125*125
		if near!=shadow_near[i]:
			shadow_near[i]=near
			for part in car_parts[i]:
				if part is GeometryInstance3D: part.cast_shadow=GeometryInstance3D.SHADOW_CASTING_SETTING_ON if near else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var nearest:=cars.duplicate()
	nearest.sort_custom(func(a,b):return a.position.distance_squared_to(vehicle.position)<b.position.distance_squared_to(vehicle.position))
	for i in spatial_audio.size():
		var sound:=spatial_audio[i]
		var car:Node3D=nearest[i]
		var d:Dictionary=model.drivers[cars.find(car)+1]
		sound.position=car.position
		sound.volume_db=-26 if not paused and car.visible and d.v>2 else -80
		var gear:=clampi(ceili(d.v/18),1,6)
		sound.pitch_scale=clampf((6000+fmod(d.v,18)*650)/15165,.45,1.25)

static func time_text(t: float) -> String:
	return preload("res://scripts/race_time.gd").lap(t)

func title() -> String:
	match model.phase:
		"countdown": return "LIGHTS OUT IN  %d" % ceili(model.countdown)
		"qualifying": return "Q%d   %s" % [model.stage+1,preload("res://scripts/race_time.gd").countdown(model.duration-model.clock)]
		"qualifying_result": return "QUALIFYING COMPLETE"
		"race_result": return "RACE RESULTS"
	return "RACE   LAP %d / %d" % [mini(model.drivers[0].laps+1,model.laps),model.laps]

func timing_text() -> String:
	var text := title()+"\n"
	var rows: Array = model.standings()
	var me := rows.find(model.drivers[0])
	var selection := []
	for i in rows.size():
		if i<3 or abs(i-me)<=1 or model.phase.ends_with("result"): selection.append(i)
	for i in selection:
		var d: Dictionary = rows[i]
		var value := time_text(d.best) if model.phase.begins_with("qualifying") else ("DSQ" if d.dsq else "DNF" if d.retired else time_text(d.finish_time+d.penalty) if d.finished else "%s   %d" % [str(d.tyre).left(1).to_upper(),d.stops])
		text+="%02d  %-9s  %s%s\n" % [i+1,d.name,value,"  ◀" if d.id==0 else ""]
	var d: Dictionary = model.drivers[0]
	text+="\n%s   %d%%   PIT %s" % [d.tyre.to_upper(),roundi((1-d.wear)*100),next_tyre.to_upper()]
	if d.requested: text+="\nBOX THIS LAP"
	if not d.pit.is_empty(): text+="\nPIT LANE   %d KM/H" % model.pit.speedLimitKmh
	if message_until>model.clock: text+="\n"+message
	if model.phase.ends_with("result"): text+="\nESC   CONTINUE"
	return text

func observe_learning(dt:float) -> void:
	if not learning or qa_autopilot: return
	var d:Dictionary=model.drivers[0]
	var lap_number:=floori(d.progress/model.length)
	if lap_number!=learn_lap:
		if learn_lap>=0 and learn_clean and learn_rows.size()>=60:
			learning.pending.append(learn_rows)
			if learning.pending.size()>4: learning.pending.pop_front()
		learn_rows=[]; learn_lap=lap_number; learn_clean=true
	var i:int=vehicle.idx
	var edge:float=model.track.widthRight[i] if vehicle.lateral>=0 else model.track.widthLeft[i]
	if not d.pit.is_empty() or d.finished or absf(vehicle.lateral)>edge+.5 or not d.valid: learn_clean=false
	learn_clock+=dt
	if learn_clock<.5: return
	learn_clock=0
	if lap_number<0 or not vehicle.enabled or vehicle.speed<10 or learn_rows.size()>=300: return
	var track:Dictionary=model.track
	learn_rows.append({"x":learning.features(track.line.curvature[i],track.line.speed[i],track.elevation.grade[i],track.widthLeft[i]+track.widthRight[i]),"y":clampf(vehicle.speed/track.line.speed[i],.4,1.05)})
