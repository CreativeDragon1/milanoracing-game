extends SceneTree
const Model=preload("res://scripts/race_model.gd")
const Timing=preload("res://scripts/race_time.gd")
func _initialize() -> void:call_deferred("run")
func reference(m:RefCounted,d:Dictionary) -> Array:
	var factor:=floorf(sqrt(m.grip(d))*200)/200
	var speed:Array=m.track.line.speed.duplicate()
	for i in m.count:speed[i]*=d.pace*factor*(m.learned_profile[i] if d.id>0 and m.learned_profile.size()==m.count else 1.0)
	for pass_id in 3:
		for i in range(m.count-1,-1,-1):speed[i]=minf(speed[i],sqrt(speed[(i+1)%m.count]*speed[(i+1)%m.count]+60*m.track.line.ds[i]))
	return speed
func run() -> void:
	assert(Timing.lap(59.999999999)=="1:00.000")
	assert(Timing.lap(-.0001)=="0:00.000")
	assert(Timing.countdown(59.999)=="01:00")
	assert(Timing.countdown(-.2)=="00:00")
	var tracks:Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://circuits/physics.json"))
	var pits:Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://circuits/pits.json"))
	var maximum:=0.0
	var before_us:=0
	var after_us:=0
	var profiles:=0
	for id in tracks:
		for difficulty in 4:
			var m:=Model.new();m.configure(tracks[id],pits[id],{"difficulty":difficulty})
			for i in m.count:m.learned_profile.append(.93+(i%17)*.004)
			for d in m.drivers:
				for pair in [["soft",0.0],["medium",.45],["hard",.95]]:
					d.tyre=pair[0];d.wear=pair[1];m.surface_grip=.74 if int(d.id)%2 else 1.0
					var now:=Time.get_ticks_usec();var expected:=reference(m,d);before_us+=Time.get_ticks_usec()-now
					now=Time.get_ticks_usec();m.speed_at(d,12.5);after_us+=Time.get_ticks_usec()-now
					for i in m.count:
						maximum=maxf(maximum,absf(expected[i]-float(d.profile[i])))
					assert(maximum<1e-10,"Braking profile changed")
					profiles+=1
	var report:Dictionary={"passed":true,"profiles":profiles,"maximumErrorMetresPerSecond":maximum,"beforeCalculationMs":before_us/1000.0,"afterCalculationMs":after_us/1000.0,"scope":"All circuits and difficulties, all 22 drivers, tyre wear, wet grip, learned pace; numerical equivalence, not GPU FPS. Timer rollover and countdown checks included."}
	FileAccess.open("res://../qa/speed-profile.json",FileAccess.WRITE).store_string(JSON.stringify(report,"\t"))
	print("SPEED_PROFILE ",JSON.stringify(report));quit()
