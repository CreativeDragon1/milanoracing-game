extends SceneTree
const Model=preload("res://scripts/adaptive_pace.gd")
const Corridor=preload("res://scripts/corridor.gd")
func error(model:RefCounted,rows:Array) -> float:
	var value:=0.0
	for row in rows: value+=pow(model.predict(row.x)-row.y,2)
	return value/rows.size()
func _initialize() -> void:
	var model:=Model.new(); var train:=[]; var test:=[]
	for i in 400:
		var x:=Model.features(float(i%17)/1700,45+i%55,float(i%11-5)/100,14+i%4)
		var row:={"x":x,"y":.91-.12*x[1]+.04*x[2]-.03*x[3]}
		if i%4: train.append(row)
		else: test.append(row)
	var before:=error(model,test)
	for lap in 8: assert(model.fit(train))
	var after:=error(model,test); assert(after<before*.25)
	var tracks:Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://circuits/physics.json"))
	var checks:=0
	for track in tracks.values():
		var corridor:=Corridor.new(); corridor.configure(track)
		for n in 80:
			var f:=fposmod(n*31.713,track.N); var distance:=5+n*1.37
			var range_value:=corridor.query(f,distance)
			var lo:=-INF; var hi:=INF
			var stations:=[f,f+distance]
			for i in range(ceili(f),floori(f+distance)+1): stations.append(float(i))
			for s in stations:
				var j:=int(s)%int(track.N); var k:=(j+1)%int(track.N); var u:float=s-floorf(s)
				var off:=lerpf(track.line.offset[j],track.line.offset[k],u)
				lo=maxf(lo,-lerpf(track.widthLeft[j],track.widthLeft[k],u)+1.2-off)
				hi=minf(hi,lerpf(track.widthRight[j],track.widthRight[k],u)-1.2-off)
			assert(absf(lo-range_value.x)<.00001 and absf(hi-range_value.y)<.00001)
			checks+=1
		for v in model.profile(track): assert(v>=.94 and v<=1); checks+=1
	var report:={"passed":true,"failures":[],"checks":checks,"beforeMSE":before,"afterMSE":after,"samples":model.samples,"scope":"Synthetic held-out regression and all-circuit pace/corridor bounds; not human-trained driving validation"}
	FileAccess.open("res://../qa/learning.json",FileAccess.WRITE).store_string(JSON.stringify(report,"\t")); print("LEARNING_TEST ",JSON.stringify(report)); quit()
