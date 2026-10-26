extends Node
var players: Array[AudioStreamPlayer] = []
var base_rpm := [7275.0,8796.0,15165.0]
var vehicle: Node3D
var smooth_rpm := 4500.0
var active := false
func _ready() -> void:
	for name in ["idle","mid","high"]:
		var player := AudioStreamPlayer.new()
		var stream: AudioStreamWAV = load("res://assets/audio/"+name+".wav").duplicate()
		stream.loop_mode = AudioStreamWAV.LOOP_FORWARD
		stream.loop_begin = 0
		stream.loop_end = stream.data.size()/2
		player.stream = stream
		player.volume_db = -60
		add_child(player)
		player.play()
		players.append(player)
func _process(dt: float) -> void:
	if not is_instance_valid(vehicle): return
	var target: float = maxf(vehicle.rpm,4500+(vehicle.brake if vehicle.reverse else vehicle.throttle)*4500*(1-clampf(absf(vehicle.speed)/20,0,1)))
	smooth_rpm = lerpf(smooth_rpm,target,1-exp(-dt*11))
	var high := smoothstep(10500,15500,smooth_rpm)
	var mid := smoothstep(5000,9000,smooth_rpm)*(1-high)
	var weights := [1-mid-high,mid,high]
	for i in players.size():
		players[i].pitch_scale = clampf(smooth_rpm/base_rpm[i],.55,2.1)
		var volume: float = sqrt(maxf(0,weights[i]))*(.2+(vehicle.brake if vehicle.reverse else vehicle.throttle)*.8)*.3
		if not active: volume = 0
		players[i].volume_db = linear_to_db(maxf(.0001,volume))
