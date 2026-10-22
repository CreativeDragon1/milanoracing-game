extends Node
# Offline movie capture of the real native circuit, shaders and MR 26 model.
const Model=preload("res://scripts/race_model.gd")
var game: Node
var model: RefCounted
var clock:=0.0
var recorded:=0
var start_frame:=-1
var rivals: Array[Node3D]=[]
var shot:=0
var duration_frames:=300
func configure(main: Node) -> void:
	game=main
	model=Model.new(); model.configure(game.circuit,game.pits[game.active_id],{"difficulty":3})
	var stations:={"monza":.20,"singapore":.72,"spa":.06,"milano":.36}
	shot=["monza","singapore","spa","milano"].find(game.active_id)
	model.drivers[0].progress=stations.get(game.active_id,.2)*model.length
	for i in 3:
		var node:=Node3D.new(); node.add_child(game.vehicle.visual.duplicate()); game.world.add_child(node); rivals.append(node)
	game.ui.hide(); game.racing_guide.hide(); game.vehicle.enabled=false
	game.camera.fov=58
	game.engine_audio.active=true
	if game.active_id=="singapore": game.apply_weather(1)
	if game.active_id=="milano": game.light_mode=3; game.apply_lighting()

func update(dt: float) -> void:
	clock+=dt
	var d:Dictionary=model.drivers[0]
	var station:float=fposmod(d.progress,model.length)/model.length*model.count
	d.v=Model.sample(model.track.line.speed,station)*.97
	d.progress+=d.v*dt*(model.length/model.count)/maxf(.5,Model.sample(model.track.line.ds,station))
	var pose:Dictionary=model.pose(d)
	game.vehicle.position=pose.position; game.vehicle.heading=pose.heading
	game.vehicle.rotation=Vector3(-pose.bank,-pose.heading,atan(pose.grade))
	game.vehicle.speed=d.v; game.vehicle.gear=clampi(ceili(d.v/18),1,6); game.vehicle.rpm=clampf(7000+fmod(d.v,18)*650,4500,18000); game.vehicle.throttle=.8
	game.vehicle.animate_wheels(dt,0)
	game.vehicle.idx=int(station)
	for i in rivals.size():
		var other:Dictionary=model.drivers[i+1]; other.progress=d.progress+20+i*18; other.v=d.v; other.offset=0
		var p:Dictionary=model.pose(other); rivals[i].position=p.position; rivals[i].rotation=Vector3(-p.bank,-p.heading,atan(p.grade))
	var forward:=Vector3(cos(pose.heading),0,sin(pose.heading))
	var right:=Vector3(-forward.z,0,forward.x)
	var t:=clampf((clock-2)/5,0,1)
	var location:Vector3
	var focus:Vector3
	match shot:
		0:
			location=pose.position-forward*8.2-right*lerpf(1.9,2.5,t)+Vector3.UP*1.65
			focus=pose.position+forward*3+Vector3.UP*.75
		1:
			location=pose.position+forward*8+right*lerpf(1.8,2.7,t)+Vector3.UP*2.0
			focus=pose.position-forward*2+Vector3.UP*.65
		2:
			location=pose.position-forward*lerpf(10,8,t)-right*2.8+Vector3.UP*lerpf(5.8,3.2,t)
			focus=pose.position+forward*6+Vector3.UP*1
		_:
			location=pose.position-forward*7.5-right*2.2+Vector3.UP*1.5
			focus=pose.position+forward*3+Vector3.UP*.6
	game.camera.position=location
	game.camera.look_at(focus)
	game.camera.fov=58+4*t
	game.update_near_shadows()
	if clock>=2 and start_frame<0:
		start_frame=Engine.get_process_frames()
		print("CINEMATIC_BEGIN ",start_frame)
	if start_frame>=0:
		recorded+=1
		if recorded>=duration_frames:
			var file:=FileAccess.open("res://../qa/capture-"+game.active_id+".json",FileAccess.WRITE)
			file.store_string(JSON.stringify({"circuit":game.active_id,"startFrame":start_frame,"frames":duration_frames,"fps":60,"source":"Native in-engine movie capture; scripted camera and racing-line-driven cars"},"\t")); file.close()
			game.get_tree().quit()
