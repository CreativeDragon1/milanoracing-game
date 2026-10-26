extends RefCounted
# Native deterministic sporting model. SI units; station progress uses centreline metres.
# FIA 2026 qualifying structure, with explicitly condensed game distances/tyre life.
const NAMES = ["YOU","ROSSI","TAN","MORGAN","VEGA","SATO","COSTA","KIM","WALKER","SILVA","HART","LEE","DUBOIS","KING","SANTOS","BAUER","CRUZ","MOREAU","KATO","REED","ALI","SCOTT"]
const PACE = [.72,.84,.94,1.0]
const TYRES = {"soft":{"grip":1.012,"life":.52},"medium":{"grip":1.0,"life":.76},"hard":{"grip":.985,"life":1.05}}
var track: Dictionary
var pit: Dictionary
var drivers: Array[Dictionary] = []
var grid: Array = []
var eliminated: Array = []
var phase := "idle"
var clock := 0.0
var countdown := 6.0
var stage := 0
var duration := 300.0
var full_qualifying := false
var laps := 3
var difficulty := 0
var two_compounds := false
var start_tyre := "medium"
var length := 1.0
var count := 1200
var leader_finished := false
var finish_clock := 0.0
var events: Array[Dictionary] = []
var automatic_player := false # Deterministic QA driver only; never enabled by the playing UI.
var learned_profile:Array=[]
var surface_grip := 1.0
var corridor=preload("res://scripts/corridor.gd").new()
var traffic_pool:Array[Dictionary]=[]
var traffic:Array[Dictionary]=[]

func configure(t: Dictionary,p: Dictionary,options: Dictionary = {}) -> void:
	track=t; pit=p; length=t.length; count=int(t.N)
	corridor.configure(t)
	learned_profile=options.get("learned_profile",[])
	laps=int(options.get("laps",3)); difficulty=int(options.get("difficulty",0))
	full_qualifying=options.get("full_qualifying",false)
	two_compounds=options.get("two_compounds",laps>=5)
	start_tyre=options.get("tyre","medium")
	for id in 22:
		traffic_pool.append({"id":id,"progress":0.0,"v":0.0,"offset":0.0,"push":false})
		drivers.append({"id":id,"name":NAMES[id],"active":true,"progress":0.0,"v":0.0,"best":INF,"best_set":INF,"laps":0,"lap_start":0.0,"outlap":true,"valid":true,"tyre":"soft","wear":0.0,"used":[],"stops":0,"penalty":0.0,"warnings":0,"offset":0.0,"lateral_v":0.0,"lane":0.0,"lane_until":0.0,"pass_target":-1,"q_mode":"outlap","finished":false,"retired":false,"dsq":false,"stage_done":false,"requested":false,"next_tyre":"hard","pit":{},"pace":PACE[difficulty]*(.958+float((id*17)%23)/23*.042),"finish_time":INF,"plan_lap":1,"limit_time":0.0,"outside":false,"speed_key":"","profile":[]})

static func sample(a: Array,f: float) -> float:
	var n := a.size()
	var v := fposmod(f,n)
	var i := int(v)
	return lerpf(a[i],a[(i+1)%n],v-i)

func emit(kind: String,data: Dictionary = {}) -> void:
	data["type"]=kind; data["time"]=clock; events.append(data)

func start_qualifying(next_stage: int = 0) -> void:
	phase="qualifying"; stage=next_stage; clock=0; events.clear()
	duration=[1080.0,900.0,780.0][stage] if full_qualifying else 300.0
	for d in drivers:
		d.erase("last_crossing")
		if d.active: d.best=INF; d.best_set=INF
		d.stage_done=not d.active; d.finished=false; d.retired=false; d.requested=false
		d.valid=true; d.outlap=true; d.v=0.0; d.lap_start=0.0; d.tyre="soft"; d.wear=0.0; d.offset=0.0; d.lateral_v=0.0; d.lane_until=0.0; d.pass_target=-1; d.q_mode="outlap"; d.laps=0
		if d.active:
			var release_s:=maxf(0,float(pit.s[int(pit.box)])-float(d.id)*7.0)
			d.pit={"s":release_s,"service":false,"release":d.id*6.5,"base":-length,"hold":0.0,"release_only":true}
			d.progress=pit_pose(d).progress
	emit("qualifying_start")

func start_race() -> void:
	phase="countdown"; countdown=6; clock=0; leader_finished=false; events.clear()
	if grid.size()!=22:
		grid=range(1,22); grid.append(0)
	for pos in 22:
		var d: Dictionary = drivers[grid[pos]]
		d.erase("display_progress");d.erase("last_crossing")
		d.merge({"active":true,"stage_done":false,"progress":-6.0-pos*8,"v":0.0,"best":INF,"best_set":INF,"laps":0,"lap_start":0.0,"outlap":false,"valid":true,"tyre":"hard" if pos%3==0 else "medium","wear":0.0,"used":[],"stops":0,"penalty":0.0,"warnings":0,"finished":false,"retired":false,"dsq":false,"pit":{},"requested":false,"next_tyre":"hard","offset":(2.0 if pos%2 else -2.0)-sample(track.line.offset,(-6.0-pos*8)/length*count),"lateral_v":0.0,"lane_until":0.0,"pass_target":-1,"q_mode":"outlap","finish_time":INF,"limit_time":0.0,"outside":false},true)
		if d.id==0: d.tyre=start_tyre
		d.used.append(d.tyre)
		d.plan_lap=maxi(1,mini(laps-1,roundi(laps*(.40+(int(d.id)%5)*.035))))
	emit("grid")

func standings() -> Array[Dictionary]:
	var rows: Array[Dictionary] = []
	for d in drivers:
		if not phase.begins_with("qualifying") or d.active: rows.append(d)
	rows.sort_custom(func(a,b):
		if phase.begins_with("qualifying"):
			if a.best!=b.best: return a.best<b.best
			if a.best_set!=b.best_set: return a.best_set<b.best_set
			return a.id<b.id
		if a.dsq!=b.dsq: return not a.dsq
		if a.finished and b.finished:
			if a.laps!=b.laps: return a.laps>b.laps
			return a.finish_time+a.penalty<b.finish_time+b.penalty
		return a.progress>b.progress)
	return rows

func end_qualifying() -> void:
	var order := []
	for d in standings(): order.append(d.id)
	if full_qualifying and stage<2:
		var keep := 16 if stage==0 else 10
		eliminated=order.slice(keep)+eliminated
		for id in order.slice(keep): drivers[id].active=false
		grid=order.slice(0,keep)+eliminated
	else: grid=order+eliminated
	phase="qualifying_result"; emit("qualifying_end",{"grid":grid.duplicate()})

func grip(d: Dictionary) -> float:
	return float(TYRES[d.tyre].grip)*(1-.14*d.wear*d.wear)*surface_grip

func speed_at(d: Dictionary,f: float) -> float:
	var factor := floorf(sqrt(grip(d))*200)/200
	if d.get("profile_grip",-1.0)!=factor or d.get("profile_pace",-1.0)!=d.pace:
		var profile:Array=d.profile
		if profile.size()!=count:profile.resize(count)
		var base:Array=track.line.speed
		var ds:Array=track.line.ds
		var pace:float=d.pace
		var learned:bool=d.id>0 and learned_profile.size()==count
		for i in count:
			var v:float=base[i]*pace*factor*(learned_profile[i] if learned else 1.0)
			profile[i]=v*v
		# Identical v²(next) + 2 a ds constraint; no repeated roots or allocation.
		for pass_id in 3:
			var next:float=profile[0]
			for i in range(count-1,-1,-1):
				next=minf(profile[i],next+60*ds[i]);profile[i]=next
		for i in count:profile[i]=sqrt(profile[i])
		d.profile=profile;d.profile_grip=factor;d.profile_pace=pace
	return sample(d.profile,f)

func request_pit(id: int,tyre: String) -> void:
	var d := drivers[id]
	if d.finished or not d.pit.is_empty(): return
	d.next_tyre=tyre; d.requested=not d.requested
	emit("pit_request",{"id":id})

func lap(d: Dictionary) -> void:
	var time: float = clock-d.lap_start
	if phase=="qualifying":
		if not d.pit.is_empty() and d.pit.release_only: d.lap_start=clock; return
		if not d.outlap and d.q_mode!="cooldown" and d.valid and time>.1 and d.lap_start<duration and time<d.best:
			d.best=time; d.best_set=clock; emit("lap",{"id":d.id,"seconds":time})
		d.q_mode="cooldown" if d.id>0 and d.q_mode=="push" else "push"
		d.outlap=false; d.lap_start=clock; d.valid=true
		if clock>=duration: d.stage_done=true; d.v=0.0
	else:
		d.laps=maxi(0,floori((d.progress+.001)/length))
		if d.laps>0 and d.valid and time>.1: d.best=minf(d.best,time)
		d.valid=true; d.lap_start=clock
		if d.laps>=laps or leader_finished:
			d.finished=true; d.finish_time=clock; d.v=0.0
			d.display_progress=d.progress
			d.dsq=two_compounds and d.used.size()<2
			if not leader_finished: leader_finished=true; finish_clock=clock
			emit("finish",{"id":d.id})

func advance(d: Dictionary,delta: float) -> void:
	if not is_finite(delta) or absf(delta)>length*.1: d.valid=false; return
	var before: float = d.progress
	d.progress+=delta
	var line_before:=floori(before/length);var line_after:=floori(d.progress/length)
	if line_after<line_before:d.valid=false
	if line_after>line_before and line_after>int(d.get("last_crossing",line_before)):
		d.last_crossing=line_after;lap(d)
	if delta>0: d.wear=clampf(d.wear+delta/maxf(length*2,laps*length*TYRES[d.tyre].life),0,1)

func enter_pit(d: Dictionary) -> void:
	var entry: float = float(pit.entry)/count*length
	d.pit={"s":0.0,"hold":0.0,"service":false,"release":0.0,"base":roundf((d.progress-entry)/length)*length,"release_only":false,"entry_pose":pose(d)}
	d.requested=false; d.v=minf(d.v,pit.speedLimitKmh/3.6)
	emit("pit_entry",{"id":d.id})

func pit_pose(d: Dictionary) -> Dictionary:
	var a: Dictionary = d.pit
	var i := 0
	while i<pit.s.size()-2 and pit.s[i+1]<a.s: i+=1
	var t := clampf((a.s-pit.s[i])/(pit.s[i+1]-pit.s[i]),0,1)
	var pos := Vector3(lerpf(pit.x[i],pit.x[i+1],t),lerpf(pit.y[i],pit.y[i+1],t)+.045,lerpf(pit.z[i],pit.z[i+1],t))
	var h := lerp_angle(pit.heading[i],pit.heading[i+1],t)
	if a.has("entry_pose") and a.s<18:
		var blend := smoothstep(0,18,a.s)
		pos+=(a.entry_pose.position-Vector3(pit.x[0],pit.y[0]+.045,pit.z[0]))*(1-blend); h+=angle_difference(pit.heading[0],a.entry_pose.heading)*(1-blend)
	return {"position":pos,"heading":h,"bank":0.0,"grade":lerpf(pit.grade[i],pit.grade[i+1],t),"curvature":lerpf(pit.curvature[i],pit.curvature[i+1],t) if pit.has("curvature") else 0.0,"progress":a.base+lerpf(pit.station[i],pit.station[i+1],t)/count*length}

func update_pit(d: Dictionary,dt: float) -> void:
	var a: Dictionary = d.pit
	if clock<a.release: d.v=0; return
	var box_s: float = pit.s[int(pit.box)]
	if not a.release_only and not a.service and a.s>=box_s-.02:
		d.v=0.0; a.hold+=dt
		if a.hold>=2.8+(int(d.id)%5)*.11:
			d.tyre=d.next_tyre; d.wear=0.0; d.stops+=1; a.service=true
			if not d.used.has(d.tyre): d.used.append(d.tyre)
			emit("pit_service",{"id":d.id})
		return
	var remaining := maxf(0,box_s-a.s) if not a.release_only and not a.service else 1e6
	var i := 0
	while i<pit.s.size()-2 and pit.s[i+1]<a.s: i+=1
	var target := minf(minf(pit.speedLimitKmh/3.6,pit.cornerSpeed[i]),sqrt(24*remaining))
	var space:=INF
	for other in drivers:
		if other.id==d.id or other.pit.is_empty(): continue
		var gap:float=other.pit.s-a.s
		if gap>0 and gap<space:
			space=gap
			target=minf(target,sqrt(maxf(0,other.v*other.v+24*maxf(0,gap-7))))
	d.v=maxf(0,minf(target,d.v+7*dt))
	var delta:=minf(d.v*dt,maxf(0,space-6.5))
	a.s=minf(pit.length,a.s+delta)
	if remaining<.03 or (not a.release_only and not a.service and a.s>=box_s-.02): a.s=box_s
	var p := pit_pose(d)
	d.last_pit_pose=p
	advance(d,p.progress-d.progress)
	if a.s>=pit.length-.001:
		d.pit={}
		var f: float = fposmod(d.progress,length)/length*count
		var center := Vector2(sample(track.x,f),sample(track.z,f))
		var diff := Vector2(p.position.x,p.position.z)-center
		d.offset=diff.y*sample(track.tx,f)-diff.x*sample(track.tz,f)-sample(track.line.offset,f)
		d.lateral_v=0.0; d.lane_until=0.0
		emit("pit_exit",{"id":d.id})

func pose(d: Dictionary,out: Dictionary = {}) -> Dictionary:
	if not d.pit.is_empty(): return pit_pose(d)
	var f: float = fposmod(d.get("display_progress",d.progress),length)/length*count
	var i:=int(f); var j:=(i+1)%count; var k:=(i+2)%count; var u:=f-i
	var tx:=lerpf(track.tx[i],track.tx[j],u)
	var tz:=lerpf(track.tz[i],track.tz[j],u)
	var off:float=lerpf(track.line.offset[i],track.line.offset[j],u)+d.offset
	var bank:=lerpf(track.bank[i],track.bank[j],u)
	var pos:=Vector3(lerpf(track.x[i],track.x[j],u)-tz*off,lerpf(track.elevation.height[i],track.elevation.height[j],u)-off*tan(bank)+.045,lerpf(track.z[i],track.z[j],u)+tx*off)
	var ahead_offset:float=lerpf(track.line.offset[j],track.line.offset[k],u)+d.offset
	var ax:float=lerpf(track.x[j],track.x[k],u)-lerpf(track.tz[j],track.tz[k],u)*ahead_offset
	var az:float=lerpf(track.z[j],track.z[k],u)+lerpf(track.tx[j],track.tx[k],u)*ahead_offset
	out.position=pos; out.heading=atan2(az-pos.z,ax-pos.x)+atan2(d.lateral_v,maxf(5,d.v))
	out.bank=bank; out.grade=lerpf(track.elevation.grade[i],track.elevation.grade[j],u); out.progress=d.progress
	return out

func update_player(station: float,speed: float,offset: float,dt: float) -> void:
	var d := drivers[0]
	if d.finished or d.stage_done or not d.pit.is_empty() or not phase in ["race","qualifying"]: return
	var where := fposmod(station,count)/count*length
	var delta := fposmod(where-fposmod(d.progress,length)+length/2,length)-length/2
	if absf(delta)>maxf(8,absf(speed)*dt*2.5+2): d.valid=false; return
	d.v=speed; d.offset=offset-sample(track.line.offset,station)
	var edge := sample(track.widthRight if offset>=0 else track.widthLeft,station)
	# Full car must leave the kerb margin for a sustained excursion; beginner tolerance.
	var outside := absf(offset)>edge+2.0 and speed>7
	d.limit_time=d.limit_time+dt if outside else maxf(0,d.limit_time-dt*2)
	if d.limit_time>1.25 and not d.outside:
		d.outside=true; d.valid=false; d.warnings+=1
		if phase=="race" and d.warnings%4==0: d.penalty+=5
		emit("track_limits",{"id":0,"penalty":d.penalty})
	if d.limit_time==0: d.outside=false
	advance(d,delta)

func recover_player() -> void:
	var d := drivers[0]
	d.valid=false
	if phase=="race": d.penalty+=5
	emit("recovery",{"id":0})

func update(dt: float) -> void:
	if phase=="countdown":
		countdown-=dt
		if countdown<=0: phase="race"; clock=0; emit("lights_out")
		return
	if not phase in ["race","qualifying"]: return
	clock+=dt
	traffic.clear()
	for d in drivers:
		if d.active and not d.finished and not d.stage_done and d.pit.is_empty():
			var row:Dictionary=traffic_pool[d.id]
			row.progress=d.progress; row.v=d.v; row.offset=d.offset
			row.push=not d.outlap and d.valid and d.q_mode!="cooldown"
			traffic.append(row)
	var step := length/count
	for d in drivers:
		if d.finished:
			var where:float=fposmod(d.get("display_progress",d.progress),length)/length*count
			d.v=sample(track.line.speed,where)*.8
			d.display_progress=d.get("display_progress",d.progress)+d.v*dt*step/maxf(.5,sample(track.line.ds,where))
			continue
		if not d.active or d.stage_done: continue
		if not d.pit.is_empty(): update_pit(d,dt); continue
		var f: float = fposmod(d.progress,length)/step
		if phase=="race" and (d.id>0 or automatic_player) and two_compounds and d.stops==0 and floori(maxf(0,d.progress)/length)>=d.plan_lap:
			d.requested=true; d.next_tyre="medium" if d.tyre=="hard" else "hard"
		var to_entry := fposmod(float(pit.entry)-f,count)*step
		if d.requested and to_entry<maxf(.8,d.v*dt*1.25): enter_pit(d); continue
		if d.id==0 and not automatic_player: continue
		var target := speed_at(d,f+d.v*.10/step)
		var push_lap:bool=not d.outlap and d.valid and d.q_mode!="cooldown"
		if phase=="qualifying" and not push_lap: target*=.72 if d.q_mode=="cooldown" else .80
		var line := sample(track.line.offset,f)
		var min_offset := -sample(track.widthLeft,f)+1.05-line
		var max_offset := sample(track.widthRight,f)-1.05-line
		var bounds: Vector2=corridor.query(f,(35+d.v*3.5)/step)
		var future_min := maxf(min_offset,bounds.x)
		var future_max := minf(max_offset,bounds.y)
		if future_min>future_max: future_min=minf(0,future_min); future_max=maxf(0,future_max)
		var desired: float = d.lane if d.lane_until>clock else 0.0
		var passing_room := future_max-future_min>5.4
		var front: Dictionary = {}
		var front_gap := INF
		for o in traffic:
			if o.id==d.id: continue
			var gap: float = fposmod(o.progress-d.progress,length)
			var side_gap: float = absf(o.offset-d.offset)
			if absf(fposmod(o.progress-d.progress+length/2,length)-length/2)<8 and absf(o.offset-desired)<2.4: desired=d.offset
			if gap>0 and gap<front_gap and (not passing_room or side_gap<2.3 or absf(o.offset-desired)<2.3): front=o; front_gap=gap
		if not traffic.any(func(o):return o.id==d.pass_target):d.pass_target=-1
		for o in traffic:
			if o.id!=d.pass_target: continue
			var signed_gap:float=fposmod(o.progress-d.progress+length/2,length)-length/2
			if signed_gap>-14 and signed_gap<180 and d.lane>=future_min and d.lane<=future_max:
				desired=d.lane; d.lane_until=clock+1
			else: d.pass_target=-1
		if phase=="qualifying" and not push_lap and passing_room:
			var approaching:Dictionary={}
			var nearest_behind:float=INF
			for o in traffic:
				var behind:float=fposmod(d.progress-o.progress,length)
				if o.id!=d.id and o.push and behind>0 and behind<minf(nearest_behind,maxf(180,o.v*4)): approaching=o; nearest_behind=behind
			if not approaching.is_empty():
				var choices:Array=[future_min+.2,future_max-.2]
				choices.sort_custom(func(a,b):return absf(a)>absf(b))
				for lane in choices:
					if absf(lane-approaching.offset)<=2.7: continue
					var clear:=true
					for o in traffic:
						if o.id!=d.id and absf(fposmod(o.progress-d.progress+length/2,length)-length/2)<16 and absf(lane-o.offset)<=2.2: clear=false
					if clear: desired=lane; d.lane=lane; d.lane_until=clock+3; d.pass_target=-1; target*=.82; break
		if (phase=="race" or push_lap) and passing_room and not front.is_empty() and front_gap<maxf(70,d.v*1.5) and front.v<target+1 and d.pass_target<0 and d.lane_until<=clock:
			var choices:Array=[front.offset-2.8,front.offset+2.8]
			choices.sort_custom(func(a,b):return absf(a-d.offset)<absf(b-d.offset))
			for lane in choices:
				if lane<future_min or lane>future_max: continue
				var free := true
				for o in traffic:
					var gap:float=fposmod(o.progress-d.progress+length/2,length)-length/2
					if o.id!=d.id and gap<=28 and gap>=-maxf(18,(o.v-d.v)*2+10) and absf(o.offset-lane)<=2.2: free=false
				if free: desired=lane; d.lane=lane; d.lane_until=clock+2.5; d.pass_target=front.id; emit("overtake_attempt",{"id":d.id,"target":front.id}); break
		desired=clampf(desired,future_min,future_max)
		for o in traffic:
			if o.id==d.id: continue
			var gap := fposmod(float(o.progress-d.progress),length)
			if gap<18 and absf(o.offset-desired)<2.3 and absf(o.offset-d.offset)>2.1: target=minf(target,maxf(0,o.v-12)); desired=d.offset
		var desired_v := clampf((desired-d.offset)*1.6,-1.6,1.6)
		d.lateral_v=move_toward(d.lateral_v,desired_v,2.8*dt)
		var next_offset := clampf(d.offset+d.lateral_v*dt,min_offset,max_offset)
		for o in traffic:
			if o.id!=d.id and absf(fposmod(o.progress-d.progress+length/2,length)-length/2)<8 and absf(next_offset-o.offset)<2.15 and absf(next_offset-o.offset)<absf(d.offset-o.offset): next_offset=d.offset; d.lateral_v=0.0
		d.offset=next_offset
		front={}; front_gap=INF
		for o in traffic:
			if o.id==d.id: continue
			var gap:float=fposmod(o.progress-d.progress,length)
			if gap>0 and gap<front_gap and (not passing_room or absf(o.offset-d.offset)<2.3 or absf(o.offset-desired)<2.3): front=o; front_gap=gap
		var own_ds := sample(track.line.ds,f)
		if not front.is_empty():
			var front_ds := sample(track.line.ds,fposmod(front.progress,length)/step)
			var front_rate: float = front.v*step/maxf(.5,front_ds)
			var front_speed := front_rate*own_ds/step
			var space := maxf(0,(front_gap-8.5)*own_ds/step)
			var safe := maxf(0,sqrt(pow(35*.12,2)+front_speed*front_speed*35/38+70*space)-35*.12)
			target=minf(target,minf(safe,maxf(0,(front_rate+(front_gap-9)*.8)*own_ds/step)))
		if d.requested and to_entry<180: target=minf(target,sqrt(pow(pit.speedLimitKmh/3.6,2)+36*maxf(0,to_entry-6)))
		var accel := 38.0 if d.v>target else minf(13,900/maxf(15,d.v))
		d.v=move_toward(d.v,target,accel*dt)
		var delta: float = d.v*dt*step/maxf(.5,own_ds)
		if not front.is_empty() and front_gap<14 and absf(front.offset-d.offset)<2.1:
			var available := maxf(0,front_gap-6.5+front.v*dt*step/maxf(.5,sample(track.line.ds,fposmod(front.progress,length)/step)))
			if delta>available: delta=available; d.v=minf(d.v,delta/dt*own_ds/step)
		advance(d,delta)
	if phase=="qualifying" and clock>=duration:
		var all_done := true
		for d in drivers:
			if d.active and not d.stage_done: all_done=false
		if all_done or clock>duration+300: end_qualifying()
	if phase=="race" and leader_finished:
		var all_done := true
		for d in drivers:
			if not d.finished: all_done=false
		if all_done or clock-finish_clock>180:
			for d in drivers:
				if not d.finished: d.retired=true; d.finished=true; d.finish_time=clock; d.dsq=two_compounds and d.used.size()<2
			phase="race_result"; emit("race_end")
