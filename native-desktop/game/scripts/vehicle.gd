extends Node3D
# Fixed-step assisted two-axle bicycle model, SI units. No path-following for player input.
var road_points:=PackedVector2Array()
var road_vectors:=PackedVector2Array()
var road_lengths:=PackedFloat64Array()
var circuit: Dictionary
var idx := 0
var lateral := 0.0
var speed := 0.0
var side_speed := 0.0
var yaw_rate := 0.0
var heading := 0.0
var steering := 0.0
var throttle := 0.0
var brake := 0.0
var distance := 0.0
var gear := 1
var rpm := 4500.0
var enabled := false
var visual: Node3D
var last_position := Vector3.ZERO
var lap := 0
var lap_clock := 0.0
var last_lap := 0.0
var best_lap := INF
var lap_distance := 0.0
var pit_active := false
var pit_requested := false
var pit_s := 0.0
var pit_service := 0.0
var pit: Dictionary
var wheel_parts: Array[MeshInstance3D] = []
var axle_hardware: MultiMeshInstance3D
var wheel_angle := 0.0
var pit_entry_pose := Vector3.ZERO
var pit_entry_heading := 0.0
var grip_multiplier := 1.0
var brake_assist := false
var assist_target := 105.0
var steering_strength := 1.0
var controller_device := -1
var reverse := false
var reverse_armed := true
var reverse_hold := 0.0

func configure(track: Dictionary, pit_data: Dictionary) -> void:
	circuit = track
	road_points.resize(track.N); road_vectors.resize(track.N); road_lengths.resize(track.N)
	for i in int(track.N): road_points[i]=Vector2(track.x[i],track.z[i])
	for i in int(track.N):
		road_vectors[i]=road_points[(i+1)%int(track.N)]-road_points[i]
		road_lengths[i]=road_vectors[i].length_squared()
	pit = pit_data
	visual = load("res://assets/mr26.scn").instantiate()
	add_child(visual)
	# Keep every original decal; only the neutral resin pixels receive the native finish.
	for part in visual.get_children():
		if part is MeshInstance3D:
			var base: Material = part.mesh.surface_get_material(0)
			if base is StandardMaterial3D and base.clearcoat_enabled and base.metallic>.2 and base.albedo_texture:
				var paint := ShaderMaterial.new()
				paint.shader = load("res://scripts/car_paint.gdshader")
				paint.set_shader_parameter("livery",base.albedo_texture)
				part.material_override = paint
			elif base is StandardMaterial3D and base.roughness>.8 and base.metallic<.03 and base.albedo_color.r<.4 and part.position.length()>1:
				var rubber: StandardMaterial3D = base.duplicate()
				rubber.albedo_color = Color(.08,.085,.09)
				rubber.metallic_specular = .2
				rubber.roughness = .95
				part.material_override = rubber
				wheel_parts.append(part)
	# Retained axle shafts and hubs never join the removable tyre list.
	axle_hardware=MultiMeshInstance3D.new();axle_hardware.name="RetainedAxlesAndHubs"
	var hardware:Array=JSON.parse_string(FileAccess.get_file_as_string("res://assets/car-hardware.json"))
	var cylinder:=CylinderMesh.new();cylinder.top_radius=1;cylinder.bottom_radius=1;cylinder.height=1;cylinder.radial_segments=16;cylinder.rings=1
	var steel:=StandardMaterial3D.new();steel.albedo_color=Color("73808b");steel.metallic=.78;steel.roughness=.32;cylinder.material=steel
	axle_hardware.multimesh=MultiMesh.new();axle_hardware.multimesh.transform_format=MultiMesh.TRANSFORM_3D;axle_hardware.multimesh.mesh=cylinder;axle_hardware.multimesh.instance_count=hardware.size()
	for i in hardware.size():
		var part:Dictionary=hardware[i]
		var basis:=Basis(Vector3.RIGHT,PI/2)*Basis.from_scale(Vector3(part.radius,part.length,part.radius))
		axle_hardware.multimesh.set_instance_transform(i,Transform3D(basis,Vector3(part.position[0],part.position[1],part.position[2])))
	visual.add_child(axle_hardware)
	reset_at(0)

func duplicate_race_visual() -> Node3D:
	var copy:Node3D=visual.duplicate()
	copy.position=Vector3.ZERO
	for original in wheel_parts:
		copy.get_node(NodePath(str(original.name))).visible=true
	return copy

func reset_at(station: int) -> void:
	if is_instance_valid(visual):visual.position.y=0
	for wheel in wheel_parts:wheel.visible=true
	idx = posmod(station,int(circuit.N))
	position = Vector3(circuit.x[idx],circuit.elevation.height[idx]+.045,circuit.z[idx])
	heading = atan2(circuit.tz[idx],circuit.tx[idx])
	speed = 0
	side_speed = 0
	yaw_rate = 0
	steering = 0
	reverse = false
	reverse_armed = true
	reverse_hold = 0
	gear = 1
	pit_active = false
	pit_requested = false
	pit_service = 0
	update_pose()
	reset_physics_interpolation()

func project(point: Vector3, hint: int) -> Dictionary:
	var count := road_points.size()
	var best := INF
	var best_i:=hint; var fraction:=0.0; var offset:=0.0
	var p:=Vector2(point.x,point.z)
	# Coherent motion stays in a few road segments. Expand at the window edge;
	# this preserves the old recovery search without allocating 91 dictionaries.
	for radius in [8,45]:
		for k in range(-radius,radius+1):
			var i:=posmod(hint+k,count)
			var delta:=road_vectors[i]
			var relative:=p-road_points[i]
			var t:=clampf(relative.dot(delta)/road_lengths[i],0,1)
			var diff:=relative-delta*t
			if diff.length_squared()<best:
				best=diff.length_squared(); best_i=i; fraction=t
				offset=(diff.y*delta.x-diff.x*delta.y)/sqrt(road_lengths[i])
		var separation:=absi(best_i-hint)
		if mini(separation,count-separation)<radius-1 and best<900: break
	return {"i":best_i,"offset":offset,"fraction":fraction}

func update_pose() -> void:
	var q := project(position,idx)
	idx = q.i
	lateral = q.offset
	var j := (idx+1)%int(circuit.N)
	var bank := lerpf(circuit.bank[idx],circuit.bank[j],q.fraction)
	var ground := lerpf(circuit.elevation.height[idx],circuit.elevation.height[j],q.fraction)-lateral*tan(bank)
	position.y = ground+.045
	var along := cos(heading)*float(circuit.tx[idx])+sin(heading)*float(circuit.tz[idx])
	var grade := lerpf(circuit.elevation.grade[idx],circuit.elevation.grade[j],q.fraction)*along
	rotation = Vector3(-bank*along,-heading,atan(grade))

func _physics_process(dt: float) -> void:
	if not enabled: return
	if pit_active:
		step_pit(dt)
		return
	var old_idx := idx
	var pad := Input.get_connected_joypads()
	var steer_target := float(Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT))-float(Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT))
	var gas_target := float(Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_UP))
	var brake_target := float(Input.is_physical_key_pressed(KEY_S) or Input.is_physical_key_pressed(KEY_DOWN) or Input.is_physical_key_pressed(KEY_SPACE))
	var keyboard := true
	if pad.size() or controller_device>=0:
		var device:int=controller_device if controller_device>=0 else pad[0]
		var axis := Input.get_joy_axis(device,JOY_AXIS_LEFT_X)
		if absf(axis)>.12 and steer_target==0:
			steer_target = signf(axis)*pow((absf(axis)-.12)/.88,lerpf(1.15,1.6,clampf((absf(speed)-12)/38,0,1)))
			keyboard = false
		gas_target = maxf(gas_target,Input.get_joy_axis(device,JOY_AXIS_TRIGGER_RIGHT))
		brake_target = maxf(brake_target,Input.get_joy_axis(device,JOY_AXIS_TRIGGER_LEFT))
	select_drive_direction(gas_target,brake_target,dt)
	if not reverse and brake_assist and speed>assist_target+2:
		brake_target=maxf(brake_target,clampf((speed-assist_target-2)/12,0,.75))
		gas_target=minf(gas_target,1-brake_target)
	throttle = move_toward(throttle,gas_target,dt*(5 if gas_target>throttle else 12))
	brake = move_toward(brake,brake_target,dt*14)
	var releasing:=absf(steer_target)<.015
	var fast:=clampf((absf(speed)-12)/38,0,1)
	var rate := (18.0 if releasing else lerpf(12,4.2,fast)) if keyboard else (17.0 if releasing else 16.0-clampf(absf(speed)/75,0,1)*2)
	steering = move_toward(steering,lerpf(steering,steer_target,1-exp(-rate*dt)),dt*(7.0 if releasing else lerpf(5.8,2.7,fast) if keyboard else 8.0))
	var edge: float = circuit.widthRight[idx] if lateral>=0 else circuit.widthLeft[idx]
	var off := clampf((absf(lateral)-edge-1.1)/1.8,0,1)
	var mass := 800.0
	var mu := 2.0*(1-off*.27)*grip_multiplier
	var downforce := 2.6*1.2*speed*speed
	var load := mass*9.81+downforce
	var max_lat := minf(60,mu*load/mass)
	# Full low-speed steering, progressively limited at speed by the tyre envelope.
	var lock := minf(.64/(1+pow(speed/40,2)),atan(max_lat*3.0/(speed*speed+9)))
	var gentle := clampf((1.25-steering_strength)/.65,0,1)
	var centre_response := lerpf(.88 if keyboard else .96,.42 if keyboard else .78,fast)-.12*gentle
	var steer_command := signf(steering)*(absf(steering)*centre_response+(1-centre_response)*pow(absf(steering),3))
	var angle := steer_command*lock
	if reverse:
		var target_speed:=0.0 if throttle>.05 else -8.0*brake
		var acceleration:=10.0 if throttle>.05 else 3.8 if brake>.05 else 2.5
		speed=move_toward(speed,target_speed,acceleration*dt)
		side_speed=0
		yaw_rate=lerpf(yaw_rate,speed/3*tan(angle),1-exp(-14*dt))
	else:
		advance_forward_dynamics(dt,angle,mu,load,max_lat,mass,off)
	heading += yaw_rate*dt
	last_position = position
	position.x += (speed*cos(heading)-side_speed*sin(heading))*dt
	position.z += (speed*sin(heading)+side_speed*cos(heading))*dt
	update_pose()
	var runoff: float = circuit.runoffRight[idx] if lateral>=0 else circuit.runoffLeft[idx]
	edge = circuit.widthRight[idx] if lateral>=0 else circuit.widthLeft[idx]
	var barrier := edge+runoff-.75
	if absf(lateral)>barrier:
		var penetration := (absf(lateral)-barrier)*signf(lateral)
		position.x += float(circuit.tz[idx])*penetration
		position.z -= float(circuit.tx[idx])*penetration
		speed *= .65
		side_speed = 0
		yaw_rate *= .3
	distance += speed*dt
	lap_distance += speed*dt
	lap_clock += dt
	if old_idx>int(circuit.N)*.9 and idx<int(circuit.N)*.1 and lap_distance>float(circuit.length)*.8:
		last_lap = lap_clock
		best_lap = minf(best_lap,last_lap)
		lap += 1
		lap_clock = 0
		lap_distance = 0
	var tops := [30.0,45.0,60.0,72.0,85.0,100.0]
	gear=maxi(1,gear)
	while gear<6 and speed>tops[gear-1]: gear += 1
	while gear>1 and speed<tops[gear-2]*.87: gear -= 1
	rpm = clampf(18000*absf(speed)/(12.0 if reverse else tops[gear-1]),4500,18000)
	if reverse:gear=-1
	animate_wheels(dt,angle)
	if pit_requested and not reverse and absi(idx-int(pit.entry))<3:
		pit_active = true
		pit_s = 0
		pit_service = 0
		pit_entry_pose = position
		pit_entry_heading = heading
	if not is_finite(position.x+position.z+speed+heading): reset_at(idx)

func select_drive_direction(gas:float,braking:float,dt:float) -> void:
	if not reverse:
		if speed>.35:reverse_armed=false;reverse_hold=0
		elif braking<.1:reverse_armed=true;reverse_hold=0
		elif reverse_armed and gas<.1:
			reverse_hold+=dt
			if reverse_hold>=.25:reverse=true;speed=0
	elif gas>.1 and speed>=-.08:
		reverse=false;speed=0;reverse_armed=false;reverse_hold=0

func advance_forward_dynamics(dt:float,angle:float,mu:float,load:float,max_lat:float,mass:float,off:float) -> void:
	var front_load := load*.46
	var rear_load := load-front_load
	var fy_front := -mu*front_load*tanh((atan2(side_speed+1.6*yaw_rate,maxf(speed,4))-angle)*14)
	var fy_rear := -mu*rear_load*tanh(atan2(side_speed-1.4*yaw_rate,maxf(speed,4))*14.16)
	var brake_force := brake*minf(47000,speed*mass/dt)
	var drive := minf(19000,720000/maxf(speed,12))*clampf((105-speed)/5,0,1)
	var fx_front := -brake_force*.58
	var fx_rear := throttle*drive-brake_force*.42
	# Combined slip preserves braking authority at steering lock while keeping
	# each axle inside its friction circle.
	var front_scale := minf(1,mu*front_load/maxf(1,Vector2(fx_front,fy_front).length()))
	var rear_scale := minf(1,mu*rear_load/maxf(1,Vector2(fx_rear,fy_rear).length()))
	fx_front*=front_scale; fy_front*=front_scale
	if brake_force>0:fx_rear*=rear_scale; fy_rear*=rear_scale
	else:fx_rear=minf(throttle*drive,sqrt(maxf(0,pow(mu*rear_load,2)-fy_rear*fy_rear)))
	var drag := minf(.6*1.7*speed*speed+mass*9.81*.015+off*(600+50*speed),speed*mass/dt)
	var slope := float(circuit.elevation.grade[idx])*(cos(heading)*float(circuit.tx[idx])+sin(heading)*float(circuit.tz[idx]))
	speed = maxf(0,speed+((fx_front*cos(angle)-fy_front*sin(angle)+fx_rear-drag)/mass-9.81*sin(atan(slope))+yaw_rate*side_speed)*dt)
	side_speed += ((fy_front*cos(angle)+fx_front*sin(angle)+fy_rear)/mass-yaw_rate*speed)*dt
	yaw_rate += (1.6*(fy_front*cos(angle)+fx_front*sin(angle))-1.4*fy_rear)/1100*dt
	var target_yaw := clampf(speed/3*tan(angle),-max_lat/maxf(speed,4),max_lat/maxf(speed,4))
	var low_speed:=1-clampf((speed-12)/16,0,1)
	yaw_rate = lerpf(yaw_rate,target_yaw,maxf(low_speed*low_speed*(3-2*low_speed),1-exp(-6*dt)))
	yaw_rate = clampf(yaw_rate,-absf(target_yaw)-.1,absf(target_yaw)+.1)
	side_speed *= exp(-5.8*dt)
	side_speed = clampf(side_speed,-.35-speed*.1,.35+speed*.1)
	if speed<.15:
		side_speed = 0
		yaw_rate = 0
func animate_wheels(dt: float,angle: float) -> void:
	wheel_angle=fposmod(wheel_angle-speed*dt/.373,TAU)
	for wheel in wheel_parts:
		wheel.rotation=Vector3(0,-angle if wheel.position.x>0 else 0,wheel_angle)

func step_pit(dt: float) -> void:
	var old_idx := idx
	var k := 0
	while k<pit.s.size()-2 and float(pit.s[k+1])<pit_s: k += 1
	var target := minf(float(pit.speedLimitKmh)/3.6,float(pit.cornerSpeed[k]))
	var box_s := float(pit.s[int(pit.box)])
	if pit_s<box_s and pit_service==0: target = minf(target,sqrt(maxf(0,2*8*(box_s-pit_s))))
	if absf(pit_s-box_s)<.4 and pit_service<2.8:
		pit_s = box_s
		speed = 0
		pit_service += dt
	else:
		speed = move_toward(speed,target,dt*8)
		pit_s = minf(float(pit.length),pit_s+speed*dt)
	while k<pit.s.size()-2 and float(pit.s[k+1])<pit_s: k += 1
	var t := clampf((pit_s-float(pit.s[k]))/maxf(.01,float(pit.s[k+1])-float(pit.s[k])),0,1)
	position = Vector3(lerpf(pit.x[k],pit.x[k+1],t),lerpf(pit.y[k],pit.y[k+1],t)+.045,lerpf(pit.z[k],pit.z[k+1],t))
	heading = lerp_angle(pit.heading[k],pit.heading[k+1],t)
	if pit_s<18:
		var blend := smoothstep(0,18,pit_s)
		position += (pit_entry_pose-Vector3(pit.x[0],pit.y[0]+.045,pit.z[0]))*(1-blend)
		heading += angle_difference(pit.heading[0],pit_entry_heading)*(1-blend)
	rotation = Vector3(0,-heading,atan(lerpf(pit.grade[k],pit.grade[k+1],t)))
	idx = posmod(roundi(lerpf(pit.station[k],pit.station[k+1],t)),int(circuit.N))
	lap_clock += dt
	var curve:float=lerpf(pit.curvature[k],pit.curvature[k+1],t) if pit.has("curvature") else 0.0
	var angle:=atan(3.0*curve)
	var max_lat:=minf(60,2.0*(800*9.81+2.6*1.2*speed*speed)/800)
	var lock:=minf(.50,atan(max_lat*3.0/maxf(speed*speed,12.0)))*.92
	steering=clampf(angle/maxf(.01,lock*steering_strength),-1,1)
	yaw_rate=curve*speed
	side_speed=0
	animate_wheels(dt,angle)
	lap_distance += speed*dt
	distance += speed*dt
	if old_idx>int(circuit.N)*.9 and idx<int(circuit.N)*.1 and lap_distance>float(circuit.length)*.8:
		last_lap = lap_clock
		best_lap = minf(best_lap,last_lap)
		lap += 1
		lap_clock = 0
		lap_distance = 0
	if pit_s>=float(pit.length):
		pit_active = false
		pit_requested = false
