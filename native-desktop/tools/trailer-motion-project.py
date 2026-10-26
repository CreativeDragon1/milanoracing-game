"""Install shared film choreography into the separate native authoring project."""
from pathlib import Path
import sys
p=Path(sys.argv[1])/'capture.gd';s=p.read_text()
s=s.replace('var game: Node','var film:Dictionary\nvar film_tick:=0\nvar film_fov:=60.0\nvar rival_spin:Array[float]=[0.,0.,0.]\nvar game: Node')
s=s[:s.index('func update(dt: float)')]+'''
func vector(a:Array)->Vector3:
	return Vector3(a[0],a[1],a[2])

func film_transform(p:Dictionary)->Transform3D:
	var b:Array=p.basis
	return Transform3D(Basis(Vector3(b[0],b[1],b[2]),Vector3(b[3],b[4],b[5]),Vector3(b[6],b[7],b[8])),vector(p.position))

func prepare_film()->void:
	film=JSON.parse_string(FileAccess.get_file_as_string("res://motion.json"))
	var size:Vector2=game.get_viewport().get_visible_rect().size
	var aspect:float=size.x/size.y
	var fit:float=tan(deg_to_rad(57.0 if aspect>1 else 78.0)/2)
	for index in range(120,film.frames.size()):
		var row:Dictionary=film.frames[index]
		game.camera.position=vector(row.camera);game.camera.look_at(vector(row.focus))
		var inverse:Transform3D=game.camera.global_transform.affine_inverse()
		var car_transform:Transform3D=film_transform(row.cars[0])
		for x in [-2.85,2.85]:
			for y in [0.,1.8]:
				for z in [-.95,.95]:
					var q:Vector3=inverse*(car_transform*Vector3(x,y,z))
					assert(q.z<-.1,"Camera crossed hero car")
					fit=maxf(fit,maxf(absf(q.y)/(-q.z*.84),absf(q.x)/(-q.z*aspect*.84)))
	film_fov=rad_to_deg(2*atan(fit));assert(film_fov<100,"Excessively wide shot framing")
	game.camera.fov=film_fov

func update(dt:float)->void:
	if film.is_empty():prepare_film()
	var row:Dictionary=film.frames[mini(film_tick,film.frames.size()-1)]
	var hero:Dictionary=row.cars[0]
	game.vehicle.transform=film_transform(hero);game.vehicle.heading=hero.heading
	game.vehicle.speed=hero.speed;game.vehicle.idx=int(hero.station)
	game.vehicle.gear=clampi(ceili(hero.speed/18),1,6);game.vehicle.rpm=clampf(7000+fmod(hero.speed,18)*650,4500,18000);game.vehicle.throttle=.8
	game.vehicle.animate_wheels(dt,hero.steering)
	for i in rivals.size():
		var other:Dictionary=row.cars[i+1];rivals[i].transform=film_transform(other)
		rival_spin[i]=fposmod(rival_spin[i]-other.speed*dt/.373,TAU)
		for wheel in game.vehicle.wheel_parts:
			var duplicate_wheel:MeshInstance3D=rivals[i].get_child(0).get_child(wheel.get_index())
			duplicate_wheel.rotation=Vector3(0,-other.steering if wheel.position.x>0 else 0,rival_spin[i])
	game.camera.position=vector(row.camera);game.camera.look_at(vector(row.focus))
	var size:Vector2=game.get_viewport().get_visible_rect().size
	var subject_uv:Vector2=game.camera.unproject_position(game.vehicle.position+Vector3.UP*.65)/size
	lens.set_shader_parameter("subject",subject_uv)
	lens.set_shader_parameter("subject_radius",Vector2(.19 if size.x>size.y else .36,.24))
	for i in rivals.size():
		if game.camera.is_position_behind(rivals[i].position):
			lens.set_shader_parameter("rival"+str(i+1),Vector4(3,3,.01,.01));continue
		var lo:=Vector2(INF,INF);var hi:=Vector2(-INF,-INF)
		for x in [-2.85,2.85]:
			for y in [0.,1.5]:
				for z in [-.85,.85]:
					var q:Vector2=game.camera.unproject_position(rivals[i].transform*Vector3(x,y,z))/size
					lo=lo.min(q);hi=hi.max(q)
		var centre:Vector2=(lo+hi)*.5;var radius:Vector2=(hi-lo)*.65
		lens.set_shader_parameter("rival"+str(i+1),Vector4(centre.x,centre.y,maxf(.005,radius.x),maxf(.005,radius.y)))
	var inverse:Transform3D=game.camera.global_transform.affine_inverse()
	var current:Projection=game.camera.get_camera_projection()*Projection(inverse)
	if lens_first:previous_vp=current
	lens.set_shader_parameter("previous_vp",previous_vp);lens.set_shader_parameter("first",1.0 if lens_first else 0.0)
	lens_first=false;previous_vp=current
	for material in contact_materials:
		for i in 4:
			var car_pose:Dictionary=row.cars[i];var pos:Vector3=vector(car_pose.position)
			material.set_shader_parameter("contact"+str(i),Vector4(pos.x,pos.z,car_pose.heading,pos.y))
	game.update_near_shadows()
	if film_tick==120:
		start_frame=Engine.get_process_frames();print("CINEMATIC_BEGIN ",start_frame)
	if film_tick>=120:
		recorded+=1
		if recorded%30==0:
			capture_samples.append({"station":hero.station,"heading":hero.heading,"position":hero.position,"screen":[subject_uv.x,subject_uv.y],"behind":game.camera.is_position_behind(game.vehicle.position),"speed":hero.speed})
		if recorded>=duration_frames:
			var file:=FileAccess.open("res://../qa/capture-"+game.active_id+".json",FileAccess.WRITE)
			file.store_string(JSON.stringify({"circuit":game.active_id,"startFrame":start_frame,"frames":duration_frames,"fps":60,"samples":capture_samples,"cameraFov":film_fov,"motionReport":film.report,"surfaceChecks":{"minimumClearance":film.report.minimumSurfaceClearanceM,"maximumLift":film.report.maximumSurfaceLiftM},"source":"Native renderer with shared collision-checked staged race choreography"},"\\t"));file.close()
			game.get_tree().quit()
	film_tick+=1
'''
p.write_text(s)
