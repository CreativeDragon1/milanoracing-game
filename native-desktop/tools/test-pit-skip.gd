extends SceneTree
const Model=preload("res://scripts/race_model.gd")
func _initialize() -> void:
	var tracks:Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://circuits/physics.json"))
	var pits:Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://circuits/pits.json"))
	var reports:=[]
	for id in tracks:
		for mode in ["race","qualifying"]:
			var m:=Model.new();m.configure(tracks[id],pits[id],{"laps":5,"difficulty":2})
			if mode=="qualifying":m.start_qualifying()
			else:
				m.start_race();m.countdown=0;m.update(.05)
				m.drivers[0].progress=float(pits[id].entry)/tracks[id].N*tracks[id].length
				m.enter_pit(m.drivers[0]);m.drivers[0].next_tyre="hard"
			var before_clock:float=m.clock;var rival_before:float=m.drivers[1].progress
			var steps:=0
			while not m.drivers[0].pit.is_empty() and steps<12000:
				m.update(.05);m.events.clear();steps+=1
			assert(steps<12000,id+" pit skip reaches exit")
			assert(absf(m.clock-before_clock-steps*.05)<.0001,id+" correct elapsed session time")
			assert(m.drivers[1].progress>rival_before,id+" opponents advance together")
			assert(m.drivers.all(func(d):return is_finite(d.progress) and is_finite(d.v)),id+" finite field")
			assert(m.drivers[0].v>0,id+" moving exit")
			if mode=="race":assert(m.drivers[0].stops==1 and m.drivers[0].tyre=="hard",id+" tyre service completes once")
			reports.append({"circuit":id,"mode":mode,"simulatedSeconds":steps*.05,"stops":m.drivers[0].stops})
	var file:=FileAccess.open("res://../qa/pit-skip.json",FileAccess.WRITE)
	file.store_string(JSON.stringify({"passed":true,"reports":reports,"scope":"Twenty Hz hidden simulation completes pit service and advances the full field on all 14 circuits. Not trajectory equivalence to a 120 Hz run."},"\t"));file.close()
	print("NATIVE_PIT_SKIP 28 routes passed");quit()
