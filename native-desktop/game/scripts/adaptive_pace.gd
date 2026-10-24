extends RefCounted
# Five-weight local model; frozen inference profiles preserve sporting difficulty.
var weights: Array=[.85,0.0,0.0,0.0,0.0]
var samples:=0
var laps:=0
var pending:Array=[]
static func features(k:float,speed:float,grade:float,width:float) -> Array:
	return [1.0,clampf(absf(k)*70,0,1),clampf(speed/100,0,1),clampf(grade*6,-1,1),clampf(width/20,0,1)]
func predict(x:Array) -> float:
	var value:=0.0
	for j in 5: value+=x[j]*weights[j]
	return clampf(value,.4,1.05)
func fit(rows:Array) -> bool:
	var valid:=[]
	for row in rows:
		if row.x.size()==5 and row.x.all(func(v):return is_finite(v)) and is_finite(row.y) and row.y>=.4 and row.y<=1.05: valid.append(row)
	if valid.size()<60: return false
	for epoch in 4:
		for row in valid:
			var error:=predict(row.x)-float(row.y)
			for j in 5: weights[j]=clampf(weights[j]-.025*(error*row.x[j]+(weights[j]*.002 if j else 0.0)),-2,2)
	samples=mini(1000000,samples+valid.size()); laps+=1
	return true
func multiplier(x:Array) -> float:
	return 1+clampf(samples/600.0,0,1)*(clampf(.94+(predict(x)-.55)*.15,.94,1)-1)
func profile(track:Dictionary) -> Array:
	var result:=[]
	for i in int(track.N): result.append(multiplier(features(track.line.curvature[i],track.line.speed[i],track.elevation.grade[i],track.widthLeft[i]+track.widthRight[i])))
	return result
func reset() -> void:
	weights=[.85,0.0,0.0,0.0,0.0]; samples=0; laps=0; pending.clear(); save_store()
func load_store() -> void:
	if not FileAccess.file_exists("user://learned-pace.json"): return
	var saved=JSON.parse_string(FileAccess.get_file_as_string("user://learned-pace.json"))
	if not saved is Dictionary or saved.get("version",0)!=1: return
	var values=saved.get("weights",[])
	if not values is Array or values.size()!=5 or not values.all(func(v):return (v is float or v is int) and is_finite(v) and absf(v)<=2): return
	weights=values; samples=clampi(int(saved.get("samples",0)),0,1000000); laps=clampi(int(saved.get("laps",0)),0,100000)
func save_store() -> void:
	var file:=FileAccess.open("user://learned-pace.json",FileAccess.WRITE)
	if file: file.store_string(JSON.stringify({"version":1,"weights":weights,"samples":samples,"laps":laps}))
func flush() -> void:
	if pending.is_empty(): return
	for rows in pending: fit(rows)
	pending.clear(); save_store()
