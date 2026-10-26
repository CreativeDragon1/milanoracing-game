extends Node3D
var game:Node
var clip:Resource
var batches:Array[MultiMeshInstance3D]=[]
var buffer:=PackedFloat32Array()
var ready_amount:=0.0
var last_phase:=-1.0
var last_active:=false
var sounds:Dictionary={}
var voices:Array[AudioStreamPlayer3D]=[]
var pose_clock:=0.0
var played_cues:=0
var pose_updates:=0
var pose_amount:=-1.0
var pose_phase:=-1.0
var pose_service:=false
var pose_releasing:=false
func configure(main:Node,pit:Dictionary) -> void:
	game=main;clip=load("res://assets/pit-crew.res")
	var k:int=pit.box
	position=Vector3(pit.x[k],pit.y[k]+.075,pit.z[k])
	rotation.y=-atan2(pit.z[k+1]-pit.z[k-1],pit.x[k+1]-pit.x[k-1])
	buffer.resize(clip.ready[0].size())
	for i in clip.meshes.size():
		var batch:=MultiMeshInstance3D.new();batch.multimesh=MultiMesh.new();batch.multimesh.transform_format=MultiMesh.TRANSFORM_3D;batch.multimesh.mesh=clip.meshes[i];batch.multimesh.instance_count=clip.counts[i];batch.custom_aabb=AABB(Vector3(-6,-1,-5),Vector3(12,4,10));add_child(batch);batches.append(batch)
	for key in ["gun","jack","tyre"]:sounds[key]=load("res://assets/audio/"+key+".wav")
	for i in 8:
		var voice:=AudioStreamPlayer3D.new();voice.unit_size=10;voice.max_distance=60;voice.volume_db=-16;add_child(voice);voices.append(voice)
	apply_pose(0,0,false)
func apply_pose(amount:float,phase:float,service:bool,releasing:bool=false) -> void:
	pose_updates+=1
	pose_amount=amount;pose_phase=phase;pose_service=service;pose_releasing=releasing
	var frames:Array=clip.release if releasing else clip.service if service else clip.ready
	var f:float=clampf(phase if service else amount,0,1)*(frames.size()-1)
	var i:=int(f);var j:=mini(i+1,frames.size()-1);var weight:=f-i
	var a:PackedFloat32Array=frames[i];var b:PackedFloat32Array=frames[j]
	for k in buffer.size():buffer[k]=lerpf(a[k],b[k],weight)
	var offset:=0
	for k in batches.size():
		var count:int=clip.counts[k]*12;batches[k].multimesh.buffer=buffer.slice(offset,offset+count);offset+=count
func _process(dt:float) -> void:
	if not game.loaded or not is_instance_valid(game.vehicle):return
	var pit:Dictionary={};var penalty:=0.0
	if game.director:
		pit=game.director.model.drivers[0].pit
	elif game.vehicle.pit_active:
		pit={"s":game.vehicle.pit_s,"hold":game.vehicle.pit_service,"service":game.vehicle.pit_service>=2.8,"release_only":false}
	var near:bool=not pit.is_empty() and not pit.release_only and absf(pit.s-game.pits[game.active_id].s[game.pits[game.active_id].box])<14
	var service:bool=near and pit.hold>0
	var phase:float=clampf((pit.hold-penalty)/2.8,0,1) if service else 0.0
	ready_amount=lerpf(ready_amount,1.0 if near and not pit.service else 0.0,1-exp(-dt*6))
	var ready_target:=1.0 if near and not pit.service else 0.0
	if absf(ready_amount-ready_target)<.0001:ready_amount=ready_target
	visible=global_position.distance_squared_to(game.vehicle.position)<12100
	pose_clock+=dt
	if visible and pose_clock>=1.0/60:
		var servicing:bool=service and not pit.service
		var releasing:bool=near and pit.service
		if pose_amount!=ready_amount or pose_phase!=phase or pose_service!=servicing or pose_releasing!=releasing:apply_pose(ready_amount,phase,servicing,releasing)
		pose_clock=0
	game.vehicle.visual.position.y=.075*smoothstep(0,.12,phase)*(1-smoothstep(.86,1,phase)) if service else 0.0
	for wheel in game.vehicle.wheel_parts:wheel.visible=not(service and phase>.30 and phase<.67)
	var silent:bool=game.paused or game.pit_skip_busy or not visible
	if silent or not service:
		for voice in voices:voice.stop()
	elif not last_active or phase<last_phase:last_phase=-1
	if not silent and service:
		for cue in clip.cues:
			if cue[0]<=last_phase or cue[0]>phase:continue
			for voice in voices:
				if voice.playing:continue
				voice.stream=sounds[cue[1]];voice.position.z=cue[2]*1.5;voice.pitch_scale=1+cue[2]*.035;voice.play();played_cues+=1;break
	last_phase=phase if service else -1.0;last_active=service
