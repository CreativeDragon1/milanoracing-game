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
	var report := {"checks":checks,"circuits":reports,"passed":failures.is_empty(),"failures":failures,"scope":"Software-injected native keyboard input and complete assisted pit traversals; not hardware-controller or real-car validation"}
	var file := FileAccess.open("res://../qa/vehicle.json",FileAccess.WRITE)
	file.store_string(JSON.stringify(report,"\t"))
	print("NATIVE_PHYSICS ",JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
