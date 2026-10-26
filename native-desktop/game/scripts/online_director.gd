extends Node3D
var client: Node
var vehicle: Node3D
var track: Dictionary
var ghosts: Dictionary = {}
var epoch := -1
var phase := ""
var joining := true
var paused := false
var status := "Waiting for the room"
var messages: Dictionary = {}

func configure(network: Node,car: Node3D,circuit: Dictionary) -> void:
	client=network; vehicle=car; track=circuit
	physics_interpolation_mode=Node.PHYSICS_INTERPOLATION_MODE_OFF
	client.snapshot_received.connect(receive)
	if not client.room.is_empty(): receive({"room":client.room,"me":client.me,"serverNow":client.server_now()})

func height_at(x: float,z: float,hint: int) -> Dictionary:
	var projection: Dictionary=vehicle.project(Vector3(x,0,z),hint)
	var i: int=projection.i
	var j: int=(i+1)%int(track.N)
	var bank:=lerpf(track.bank[i],track.bank[j],projection.fraction)
	return {"idx":i,"height":lerpf(track.elevation.height[i],track.elevation.height[j],projection.fraction)-projection.offset*tan(bank)+.045,"bank":bank,"grade":track.elevation.grade[i]}

func receive(data: Dictionary) -> void:
	var room: Dictionary=data.room
	if room.circuit!=track.id: return
	var must_place: bool=joining or int(room.epoch)!=epoch
	epoch=int(room.epoch); phase=room.phase
	var seen := []
	for driver in room.players:
		seen.append(driver.id)
		if driver.id==client.me:
			if must_place:
				var station:=posmod(int(track.N)-3-int(driver.slot)*3,int(track.N))
				vehicle.reset_at(station)
				vehicle.position.x=driver.x; vehicle.position.z=driver.z; vehicle.heading=driver.h; vehicle.update_pose(); vehicle.reset_physics_interpolation()
			vehicle.lap=int(driver.lap)
			messages=driver
			continue
		if not ghosts.has(driver.id):
			var node:=Node3D.new(); node.add_child(vehicle.visual.duplicate()); add_child(node)
			var label:=Label3D.new(); label.font=load("res://assets/fonts/Michroma.ttf"); label.text=driver.name; label.position.y=2.3; label.font_size=32; label.pixel_size=.012
			label.billboard=BaseMaterial3D.BILLBOARD_ENABLED; label.modulate=Color(driver.color); node.add_child(label)
			ghosts[driver.id]={"node":node,"samples":[],"hint":posmod(int(track.N)-3-int(driver.slot)*3,int(track.N))}
		var ghost: Dictionary=ghosts[driver.id]
		if must_place: ghost.samples.clear()
		ghost.samples.append({"time":float(data.serverNow),"x":float(driver.x),"z":float(driver.z),"h":float(driver.h),"v":float(driver.v)})
		while ghost.samples.size()>12: ghost.samples.pop_front()
		ghost.node.visible=not driver.dnf
	for id in ghosts.keys():
		if not seen.has(id): ghosts[id].node.queue_free(); ghosts.erase(id)
	joining=false

func _process(_dt: float) -> void:
	if not is_instance_valid(vehicle): return
	var running: bool=phase=="race" or phase=="count" and client.server_now()>=float(client.room.get("startAt",INF))
	vehicle.enabled=running and not paused and not messages.get("dnf",false) and messages.get("finish")==null
	vehicle.brake_assist=false
	var at: float=client.server_now()-120
	for ghost in ghosts.values():
		var samples: Array=ghost.samples
		if samples.is_empty(): continue
		while samples.size()>2 and samples[1].time<at: samples.pop_front()
		var a: Dictionary=samples[0]
		var b: Dictionary=samples[1] if samples.size()>1 else a
		var u:=clampf((at-a.time)/maxf(1,b.time-a.time),0,1)
		var x:=lerpf(a.x,b.x,u)
		var z:=lerpf(a.z,b.z,u)
		var h:=lerp_angle(a.h,b.h,u)
		if at>b.time:
			var ahead:=minf(.15,(at-b.time)/1000)
			x+=cos(h)*b.v*ahead; z+=sin(h)*b.v*ahead
		var ground:=height_at(x,z,ghost.hint); ghost.hint=ground.idx
		ghost.node.position=Vector3(x,ground.height,z); ghost.node.rotation=Vector3(-ground.bank,-h,atan(ground.grade))

func timing_text() -> String:
	var room: Dictionary=client.room
	if room.is_empty(): return "CONNECTION LOST"
	var text: String="ROOM "+room.code+"\n"
	if phase=="count": text+="LIGHTS OUT IN  %d\n" % maxi(0,ceili((room.startAt-client.server_now())/1000))
	else: text+=phase.to_upper()+"\n"
	var position:=0
	for d in room.players:
		position+=1
		text+="%02d  %-12s  %s\n" % [position,d.name,"READY" if phase=="lobby" and d.ready else "WAIT" if phase=="lobby" else "DNF" if d.dnf else "FIN" if d.finish!=null else "L%d" % (int(d.lap)+1)]
	if messages.get("warning",""): text+="\n"+str(messages.warning)
	return text
