extends SceneTree
const Model=preload("res://scripts/race_model.gd")
var checks := 0
var failures: Array[String] = []
func check(value: bool,label: String) -> void:
	checks+=1
	if not value and not failures.has(label): failures.append(label); push_error(label)
func _initialize() -> void: call_deferred("run")
func run() -> void:
	var tracks: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://circuits/physics.json"))
	var pits: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://circuits/pits.json"))
	var reports := []
	for id in tracks:
		var m := Model.new(); m.configure(tracks[id],pits[id],{"laps":1,"difficulty":3,"two_compounds":false})
		m.automatic_player=true; m.start_race()
		var steps := 0
		while m.phase!="race_result" and steps<18000:
			m.update(1.0/30); steps+=1
			if steps%30==0:
				for d in m.drivers:
					var p: Dictionary = m.pose(d)
					check(p.position.is_finite() and is_finite(d.v),id+" finite race motion")
					check(d.v>=0 and d.v<=106,id+" speed envelope")
					if d.pit.is_empty():
						var f: float = fposmod(d.progress,m.length)/m.length*m.count
						var offset: float = d.offset+Model.sample(m.track.line.offset,f)
						check(offset>=-Model.sample(m.track.widthLeft,f)+.8 and offset<=Model.sample(m.track.widthRight,f)-.8,id+" AI stays inside variable width")
				m.events.clear()
		check(m.phase=="race_result",id+" complete 22 car race")
		check(m.standings().size()==22,id+" classification retains grid")
		check(m.drivers.all(func(d): return d.finished and not d.dsq),id+" drivers finish without false compound DSQ")
		reports.append({"circuit":id,"seconds":m.clock,"steps":steps})
		print("RACE_CHECK ",id," ",m.clock)
	var m := Model.new(); m.configure(tracks.interlagos,pits.interlagos,{"laps":5,"difficulty":2,"two_compounds":true,"full_qualifying":true})
	m.automatic_player=true
	for stage in 3:
		m.start_qualifying(stage)
		check(m.duration==[1080.0,900.0,780.0][stage],"full qualifying durations")
		m.duration=90 # Accelerate clock expiry; lap completion and elimination still simulated.
		for step in 15000:
			m.update(1.0/30)
			if m.phase=="qualifying_result": break
		check(m.phase=="qualifying_result","qualifying final flying laps complete")
		check(m.drivers.filter(func(d):return d.active).size()==[16,10,10][stage],"22 16 10 elimination")
	check(m.grid.size()==22 and m.grid.count(0)==1,"complete unique qualifying grid")
	m.start_race()
	for step in 45000:
		m.update(1.0/30)
		if m.phase=="race_result": break
	check(m.phase=="race_result","strategy race completes")
	check(m.drivers.all(func(d):return d.stops>=1 and d.used.size()>=2 and not d.dsq),"all drivers service and change compounds")
	# Invalid teleports must not advance the player; backward travel cannot award a lap.
	m=Model.new(); m.configure(tracks.monza,pits.monza); m.start_race(); m.update(7)
	var progress: float=m.drivers[0].progress
	m.update_player(600,10,0,1.0/120)
	check(m.drivers[0].progress==progress,"teleport rejected by race timing")
	var report := {"passed":failures.is_empty(),"checks":checks,"failures":failures,"races":reports,"scope":"Deterministic 22-car all-circuit races, qualifying progression, tyre strategy, and timing guards; not human driving or online latency validation."}
	var file := FileAccess.open("res://../qa/race.json",FileAccess.WRITE); file.store_string(JSON.stringify(report,"\t")); file.close()
	print("NATIVE_RACE_TEST ",JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
