extends SceneTree
const Map=preload("res://scripts/circuit_map.gd")
class TestCar extends Node3D:
	var speed:=40.0
	var heading:=0.0
	var pit_active:=false
class TestGame extends Node:
	var loaded:=true
	var menu=Control.new()
	var ui:Dictionary={"home":Control.new()}
	var vehicle=TestCar.new()
	var active_id:=""
	var circuit:Dictionary
	var pits:Dictionary
	var director=null
	var online_director=null
	var cinematic_mode:=false
var failures:Array=[]
var checks:=0
func check(ok:bool,message:String) -> void:
	checks+=1
	if not ok:failures.append(message)
func _initialize() -> void:call_deferred("run")
func run() -> void:
	var game:=TestGame.new();root.add_child(game);game.menu.hide();game.ui.home.hide()
	game.add_child(game.vehicle);game.add_child(game.menu);game.add_child(game.ui.home)
	var map:=Map.new();game.add_child(map);map.configure(game);map.set_process(false)
	var tracks:Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://circuits/physics.json"))
	game.pits=JSON.parse_string(FileAccess.get_file_as_string("res://circuits/pits.json"))
	for id in tracks:
		game.active_id=id;game.circuit=tracks[id];map.expanded=false;map.layout_map();map.prepare(game.circuit,game.pits[id])
		var redraws:int=map.redraws
		for i in range(0,int(game.circuit.N),maxi(1,int(game.circuit.N)/19)):
			game.vehicle.position=Vector3(game.circuit.x[i],0,game.circuit.z[i]);game.vehicle.heading=atan2(game.circuit.tz[i],game.circuit.tx[i]);map._process(1.0/60)
			var p:=Vector2(game.vehicle.position.x,game.vehicle.position.z)
			check(map.project(p).distance_to(map.anchor())<.001,id+" player centring")
			check(map.map_layer.transform*p==map.project(p) or (map.map_layer.transform*p).distance_to(map.project(p))<.001,id+" projection/canvas parity")
			check(is_finite(map.zoom) and is_finite(map.angle),id+" finite map")
		check(redraws==map.redraws,id+" geometry remains cached during driving")
		check(map.road[0]==map.road[-1],id+" closed track")
		check(map.pit_road.size()>1,id+" pit road")
		map.toggle_view();map._process(.1)
		check(map.expanded and map.visible,id+" expanded overview")
		for p in map.road:check(Rect2(Vector2.ZERO,map.clip.size).has_point(map.project(p)),id+" complete overview bounds")
		map.toggle_view();map._process(.1)
		check(not map.expanded,id+" return to local map")
	check(Map.view_scale(90,false)<Map.view_scale(20,false),"speed extends view")
	check(Map.view_scale(90,true)>Map.view_scale(20,false),"pit lane zoom")
	# Rotation wraps over +/-pi continuously rather than spinning through a lap.
	map.angle=-PI+.01;game.vehicle.heading=-map.angle-PI/2+.03;map._process(1.0/60)
	check(absf(wrapf(map.angle+PI-.01,-PI,PI))<.02,"heading wrap")
	game.cinematic_mode=true;map._process(.1);check(not map.visible,"hidden for cinematic capture")
	game.cinematic_mode=false;game.menu.show();map._process(.1);check(not map.visible,"hidden in garage")
	var report:={"passed":failures.is_empty(),"checks":checks,"circuits":tracks.size(),"failures":failures}
	var out:=FileAccess.open("res://../qa/circuit-map.json",FileAccess.WRITE);out.store_string(JSON.stringify(report,"\t"));out.close()
	print("CIRCUIT_MAP_TEST ",JSON.stringify(report));game.free();quit(0 if failures.is_empty() else 1)
