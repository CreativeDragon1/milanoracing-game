extends SceneTree
var checks := 0
var failures: Array[String] = []
func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		push_error(message)
		failures.append(message)
func key(code: Key, pressed: bool) -> void:
	var event := InputEventKey.new()
	event.physical_keycode = code
	event.keycode = code
	event.pressed = pressed
	Input.parse_input_event(event)
	Input.flush_buffered_events()
func _initialize() -> void:
	call_deferred("run")
func axis(which:JoyAxis,value:float) -> void:
	var event:=InputEventJoypadMotion.new(); event.device=15; event.axis=which; event.axis_value=value
	Input.parse_input_event(event); Input.flush_buffered_events()
func run() -> void:
	var tracks: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://circuits/physics.json"))
	var pits: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://circuits/pits.json"))
	var reports := []
	for id in tracks:
		var car = load("res://scripts/vehicle.gd").new()
		root.add_child(car)
		car.configure(tracks[id],pits[id])
		car.set_physics_process(false)
		check(car.wheel_parts.size()==4,id+" four rotating wheels")
		car.enabled = true
		key(KEY_W,true)
		for i in 240: car._physics_process(1.0/120)
		key(KEY_W,false)
		check(car.speed>15,id+" accelerates on physical keyboard input")
		var speed: float = car.speed
		key(KEY_SPACE,true)
		for i in 240: car._physics_process(1.0/120)
		key(KEY_SPACE,false)
		check(car.speed<speed*.3,id+" brake reduces speed")
		check(car.speed>=0 and not car.reverse,id+" braking to stop never silently engages reverse")
		for i in 30: car._physics_process(1.0/120)
		key(KEY_S,true)
		for i in 180: car._physics_process(1.0/120)
		check(car.reverse and car.gear==-1 and car.speed< -2 and car.speed>=-8,id+" deliberate brake press selects bounded reverse")
		key(KEY_S,false);key(KEY_W,true)
		for i in 240: car._physics_process(1.0/120)
		key(KEY_W,false)
		check(not car.reverse and car.speed>0,id+" forward throttle brakes reverse then drives forward")
		car.reset_at(0);car.speed=8;key(KEY_D,true)
		for i in 30:car._physics_process(1.0/120)
		key(KEY_D,false)
		check(car.steering>.85 and car.yaw_rate>1,id+" low-speed keyboard turn-in responds within a quarter second")
		car.reset_at(0)
		car.speed = 70
		key(KEY_D,true)
		car._physics_process(1.0/120)
		check(absf(car.steering)<.06,id+" progressive keyboard steering")
		for i in 30: car._physics_process(1.0/120)
		key(KEY_D,false)
		for i in 90: car._physics_process(1.0/120)
		check(absf(car.steering)<.001,id+" steering returns to centre")
		car.pit_active = true
		car.pit_s = 0
		car.pit_service = 0
		car.pit_entry_pose = Vector3(pits[id].x[0],pits[id].y[0],pits[id].z[0])
		car.pit_entry_heading = pits[id].heading[0]
		car.speed = 20
		var count := 0
		var stopped := false
		while car.pit_active and count<36000:
			car.step_pit(1.0/120)
			count += 1
			check(is_finite(car.position.x+car.position.y+car.position.z+car.heading),id+" finite pit pose")
			if car.pit_service>0: stopped = true
		check(stopped and not car.pit_active,id+" service and pit exit complete")
		check(car.position.distance_to(Vector3(pits[id].x[-1],pits[id].y[-1]+.045,pits[id].z[-1]))<.1,id+" continuous pit rejoin")
		reports.append({"id":id,"pitSeconds":count/120.0})
		car.free()
	var pad_car=load("res://scripts/vehicle.gd").new(); root.add_child(pad_car)
	pad_car.configure(tracks.monza,pits.monza); pad_car.set_physics_process(false); pad_car.enabled=true; pad_car.controller_device=15
	axis(JOY_AXIS_LEFT_X,.1); pad_car._physics_process(1.0/120)
	check(absf(pad_car.steering)<.001,"controller deadzone rejects drift")
	axis(JOY_AXIS_TRIGGER_RIGHT,1)
	for step in 240: pad_car._physics_process(1.0/120)
	check(pad_car.speed>15,"controller trigger accelerates")
	axis(JOY_AXIS_LEFT_X,.5)
	for step in 20: pad_car._physics_process(1.0/120)
	check(pad_car.steering>.1 and pad_car.steering<.5,"controller curved progressive steering")
	axis(JOY_AXIS_LEFT_X,0); axis(JOY_AXIS_TRIGGER_RIGHT,0); axis(JOY_AXIS_TRIGGER_LEFT,1)
	for step in 240: pad_car._physics_process(1.0/120)
	check(pad_car.speed<1,"controller trigger brakes")
	check(not pad_car.reverse,"controller braking stays forward until released")
	axis(JOY_AXIS_TRIGGER_LEFT,0)
	for step in 30:pad_car._physics_process(1.0/120)
	axis(JOY_AXIS_TRIGGER_LEFT,1);axis(JOY_AXIS_LEFT_X,.7)
	for step in 180:pad_car._physics_process(1.0/120)
	check(pad_car.reverse and pad_car.speed< -2 and pad_car.yaw_rate<0,"controller reverse and correct opposite yaw")
	axis(JOY_AXIS_TRIGGER_LEFT,0);axis(JOY_AXIS_TRIGGER_RIGHT,1);axis(JOY_AXIS_LEFT_X,0)
	for step in 240:pad_car._physics_process(1.0/120)
	check(not pad_car.reverse and pad_car.speed>0,"controller trigger returns to forward drive")
	axis(JOY_AXIS_TRIGGER_RIGHT,0)
	pad_car.free()
	var report := {"checks":checks,"circuits":reports,"passed":failures.is_empty(),"failures":failures,"scope":"Software-injected keyboard and gamepad inputs and complete assisted pit traversals; not physical-controller or real-car validation"}
	var file := FileAccess.open("res://../qa/vehicle.json",FileAccess.WRITE)
	file.store_string(JSON.stringify(report,"\t"))
	print("NATIVE_PHYSICS ",JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
