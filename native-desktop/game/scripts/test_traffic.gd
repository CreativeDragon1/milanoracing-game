extends SceneTree
const Model=preload("res://scripts/race_model.gd")
func values(value:float)->Array:
	var a:Array=[];a.resize(256);a.fill(value);return a
func _initialize()->void:
	var reports:Array=[]
	for difficulty in 4:
		for phase in ["race","qualifying"]:
			for width in [8.0,2.5]:
				var track:Dictionary={"N":256,"length":4000.0,"widthLeft":values(width),"widthRight":values(width),"line":{"offset":values(0),"speed":values(75),"ds":values(4000.0/256)}}
				var model=Model.new();model.configure(track,{"entry":240,"speedLimitKmh":80},{"difficulty":difficulty,"laps":10,"two_compounds":false})
				model.phase=phase
				for d in model.drivers:d.active=d.id==1 or d.id==2
				var leader:Dictionary=model.drivers[1];var chaser:Dictionary=model.drivers[2]
				leader.merge({"progress":550.0,"v":32.0,"offset":0.0,"pace":.5,"q_mode":"cooldown" if phase=="qualifying" else "push","outlap":false},true)
				chaser.merge({"progress":450.0,"v":50.0,"offset":0.0,"pace":Model.PACE[difficulty],"q_mode":"push","outlap":false},true)
				var max_offset:=0.0;var min_gap:=INF;var passed:=false;var yielded:=false
				for tick in 2640:
					model.update(1.0/120)
					max_offset=maxf(max_offset,absf(chaser.offset))
					if phase=="qualifying" and absf(leader.offset)>2.5:yielded=true
					var gap:float=fposmod(leader.progress-chaser.progress+2000,4000)-2000
					if absf(leader.offset-chaser.offset)<1.8:min_gap=minf(min_gap,absf(gap))
					if gap< -14:passed=true
				assert(min_gap>5.7,"Traffic overlap")
				if width==8:
					assert(passed,"Available passing opportunity not completed")
					assert(yielded if phase=="qualifying" else max_offset>2.3,"Traffic must use space off the line")
				else:assert(not passed,"Forced pass without sufficient width")
				reports.append({"difficulty":difficulty,"phase":phase,"width":width,"passedOpponent":passed,"yielded":yielded,"minimumSeparation":min_gap})
	var file:=FileAccess.open("res://../qa/traffic.json",FileAccess.WRITE);file.store_string(JSON.stringify({"passed":true,"reports":reports},"\t"));file.close()
	print("NATIVE_TRAFFIC_PASS ",reports.size());quit()
