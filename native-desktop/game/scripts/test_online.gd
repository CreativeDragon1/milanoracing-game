extends SceneTree
const Client=preload("res://scripts/online_client.gd")
var first: Node
var second: Node
var stage:=0
var elapsed:=0.0
var reconnect_at:=0.0
var original_id:=""
var checks:=0
var failures: Array[String]=[]
var configured_second:=false
func check(value: bool,text: String) -> void:
	checks+=1
	if not value: failures.append(text); push_error(text)
func _initialize() -> void: call_deferred("run")
func run() -> void:
	first=Client.new(); second=Client.new(); root.add_child(first); root.add_child(second)
	var url:=OS.get_environment("MILANO_QA_ORIGIN")
	check(first.set_host(url) and second.set_host(url),"local host accepted")
	check(not first.set_host("http://example.com"),"public plain HTTP rejected")
	for client in [first,second]:
		var car=load("res://scripts/vehicle.gd").new(); root.add_child(car); client.car=car
		client.message.connect(func(message):print("ONLINE_STATUS ",message))
	first.connected.connect(func():
		if stage==0: first.create_room("Native host","interlagos",3))
	second.connected.connect(func():
		if stage==1: second.join_room("Native guest",first.room.code))
	first.login(OS.get_environment("MILANO_QA_PASSWORD"))
	process_frame.connect(tick)
func tick() -> void:
	elapsed+=.016 # Actual timeout also enforced by the Python harness.
	if first.room.is_empty(): return
	if stage==0:
		check(first.room.players.size()==1 and first.me==first.room.host,"host creates authenticated room")
		original_id=first.me; stage=1
		second.login(OS.get_environment("MILANO_QA_PASSWORD"))
	elif stage==1 and not second.room.is_empty() and first.room.players.size()==2:
		check(first.room.code==second.room.code and first.me!=second.me,"two native clients share room")
		var tracks:Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://circuits/physics.json"))
		for client in [first,second]:
			for d in client.room.players:
				if d.id==client.me:
					client.car.position=Vector3(d.x,0,d.z); client.car.heading=d.h
		first.command("ready",{"ready":true}); second.command("ready",{"ready":true}); stage=2
	elif stage==2 and first.room.players.all(func(d):return d.ready):
		first.command("start"); stage=3
	elif stage==3 and first.room.phase=="race" and second.room.phase=="race":
		check(absf(first.server_now()-second.server_now())<250,"countdown clocks agree within 250 ms")
		first.socket.close(); reconnect_at=Time.get_ticks_msec(); stage=4
	elif stage==4 and Time.get_ticks_msec()-reconnect_at>2500 and first.socket.get_ready_state()==WebSocketPeer.STATE_OPEN:
		check(first.me==original_id and first.room.players.size()==2,"reconnection preserves driver and room")
		first.command("reset"); stage=5
	elif stage==5:
		for d in first.room.players:
			if d.id==first.me and d.penalty==5:
				check(d.warning=="RESET +5 SEC","server owns recovery penalty")
				finish(); return
func finish() -> void:
	process_frame.disconnect(tick)
	var report:={"passed":failures.is_empty(),"checks":checks,"failures":failures,"scope":"Two native WebSocket clients on a private-password loopback Python server: login, room, ready, countdown, snapshots, reconnect and server recovery penalty. No public deployment or WAN latency test."}
	var file:=FileAccess.open("res://../qa/online.json",FileAccess.WRITE); file.store_string(JSON.stringify(report,"\t")); file.close()
	first.disconnect_room(); second.disconnect_room()
	print("NATIVE_ONLINE_TEST ",JSON.stringify(report)); quit(0 if failures.is_empty() else 1)
