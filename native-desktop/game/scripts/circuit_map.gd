extends Control
# Cached circuit drawing: only the canvas transform moves each frame.
# No second camera, viewport, scene traversal or track projection is needed.
const ROAD_COLOR=Color("c8d2df")
const PIT_COLOR=Color("5f9dff")
var game:Node
var expanded:=false
var circuit_id:=""
var origin:=Vector2.ZERO
var angle:=0.0
var zoom:=.65
var initialized:=false
var road:=PackedVector2Array()
var pit_road:=PackedVector2Array()
var track_bounds:=Rect2()
var map_layer:Node2D
var ink:Node2D
var markers:Node2D
var clip:Control
var title:Label
var subtitle:Label
var caption:Label
var toggle:Button
var backdrop:Panel
var marker_clock:=0.0
var redraws:=0
var point_count:=0
var local_size:=Vector2(304,208)
var marker_data:Array=[]
var nearby:=""

class CircuitInk extends Node2D:
	var owner_map:Control
	func _draw() -> void:
		if owner_map.road.size()<2:return
		draw_polyline(owner_map.road,Color(.03,.055,.08,.8),18,true)
		draw_polyline(owner_map.road,ROAD_COLOR,8,true)
		if owner_map.pit_road.size()>1:
			draw_polyline(owner_map.pit_road,Color(.02,.04,.08),9,true)
			draw_polyline(owner_map.pit_road,PIT_COLOR,4,true)
		var start:Vector2=owner_map.road[0]
		var tangent:Vector2=(owner_map.road[1]-start).normalized()
		var normal:=Vector2(-tangent.y,tangent.x)*11
		draw_line(start-normal,start+normal,Color.WHITE,4,true)

class MapMarkers extends Node2D:
	var owner_map:Control
	func _draw() -> void:
		for marker in owner_map.marker_data:
			var p:Vector2=owner_map.project(marker.position)
			if not Rect2(Vector2(-12,-12),owner_map.clip.size+Vector2(24,24)).has_point(p):continue
			var color:Color=Color("7298ff") if not marker.pit else PIT_COLOR
			if marker.get("ahead",false):color=Color("f4f4f4")
			draw_circle(p,4.4,Color(.015,.025,.035,.95))
			draw_circle(p,2.7,color)
		if not is_instance_valid(owner_map.game.vehicle):return
		var car:Node3D=owner_map.game.vehicle
		var player:Vector2=owner_map.project(Vector2(car.position.x,car.position.z))
		var direction:float=car.heading+owner_map.angle+PI/2
		var triangle:=PackedVector2Array([Vector2(0,-9),Vector2(-6,6),Vector2(0,3),Vector2(6,6)])
		for i in triangle.size():triangle[i]=triangle[i].rotated(direction)+player
		draw_circle(player,11,Color(.015,.025,.04,.9))
		draw_colored_polygon(triangle,Color("ff7a00"))

func configure(main:Node) -> void:
	game=main;mouse_filter=Control.MOUSE_FILTER_IGNORE
	backdrop=Panel.new();backdrop.mouse_filter=Control.MOUSE_FILTER_IGNORE
	var style:=StyleBoxFlat.new();style.bg_color=Color(.016,.024,.038,.92)
	style.border_color=Color(.30,.40,.55,.35);style.set_border_width_all(1);style.set_corner_radius_all(8)
	backdrop.add_theme_stylebox_override("panel",style);add_child(backdrop)
	clip=Control.new();clip.clip_contents=true;clip.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(clip)
	map_layer=Node2D.new();clip.add_child(map_layer)
	ink=CircuitInk.new();ink.owner_map=self;map_layer.add_child(ink)
	markers=MapMarkers.new();markers.owner_map=self;clip.add_child(markers)
	title=make_label(15,Color.WHITE);subtitle=make_label(12,Color("9bafc3"));caption=make_label(12,Color("a6b8c9"))
	toggle=Button.new();toggle.text="M  EXPAND";toggle.add_theme_font_size_override("font_size",12)
	toggle.add_theme_font_override("font",load("res://assets/fonts/Barlow-Bold.ttf"))
	toggle.flat=true;toggle.pressed.connect(toggle_view);add_child(toggle)
	layout_map()

func make_label(font_size:int,color:Color) -> Label:
	var node:=Label.new();node.add_theme_font_override("font",load("res://assets/fonts/Barlow-Bold.ttf"))
	node.add_theme_font_size_override("font_size",font_size);node.add_theme_color_override("font_color",color)
	node.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(node);return node

func toggle_view() -> void:
	if not visible:return
	expanded=not expanded;initialized=false;layout_map()

func layout_map() -> void:
	local_size=Vector2(660,500) if expanded else Vector2(304,208)
	position=Vector2(470,190) if expanded else Vector2(48,510)
	size=local_size+Vector2(0,62);backdrop.size=size
	clip.position=Vector2(10,33);clip.size=local_size-Vector2(20,8)
	title.position=Vector2(14,8);subtitle.position=Vector2(14,size.y-23)
	caption.position=Vector2(14,33);caption.visible=expanded
	toggle.position=Vector2(size.x-94,4);toggle.size=Vector2(86,26);toggle.text="M  CLOSE" if expanded else "M  EXPAND"

func prepare(track:Dictionary,pit:Dictionary) -> void:
	circuit_id=str(track.id);road.clear();pit_road.clear();initialized=false
	# Preserve bends using angle and distance, cap at source density (typically 5 m).
	var previous:=Vector2(float(track.x[0]),float(track.z[0]));road.append(previous)
	track_bounds=Rect2(previous,Vector2.ZERO)
	for i in range(1,int(track.N)):
		var point:=Vector2(float(track.x[i]),float(track.z[i]));track_bounds=track_bounds.expand(point)
		if point.distance_to(previous)>=5.0:road.append(point);previous=point
	road.append(road[0])
	for i in pit.x.size():
		var point:=Vector2(float(pit.x[i]),float(pit.z[i]))
		if pit_road.is_empty() or point.distance_to(pit_road[-1])>=4.0 or i==pit.x.size()-1:pit_road.append(point)
	point_count=road.size()+pit_road.size();ink.queue_redraw();redraws+=1
	title.text=str(track.name).to_upper();title.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS;title.size.x=size.x-122
	caption.text=""
	marker_data.clear()

func project(world:Vector2) -> Vector2:
	return (world-origin).rotated(angle)*zoom+anchor()

func anchor() -> Vector2:
	return clip.size*Vector2(.5,.52 if expanded else .70)

static func view_scale(speed:float,in_pit:bool) -> float:
	# Show farther ahead as speed grows; close up in the service lane.
	return .90 if in_pit else lerpf(.88,.35,smoothstep(10,95,absf(speed)))

func _process(dt:float) -> void:
	if not game:return
	visible=game.loaded and not game.menu.visible and not game.ui.home.visible and not game.cinematic_mode
	if not visible or not is_instance_valid(game.vehicle):return
	if circuit_id!=game.active_id:prepare(game.circuit,game.pits[game.active_id])
	var car:Node3D=game.vehicle
	var car_position:=Vector2(car.position.x,car.position.z)
	var in_pit:bool=car.pit_active
	if game.director:in_pit=not game.director.model.drivers[0].pit.is_empty()
	var target_angle:float=0 if expanded else -car.heading-PI/2
	var target_zoom:float=minf((clip.size.x-66)/maxf(1,track_bounds.size.x),(clip.size.y-75)/maxf(1,track_bounds.size.y)) if expanded else view_scale(car.speed,in_pit)
	var target_origin:Vector2=track_bounds.get_center() if expanded else car_position
	if not initialized:
		angle=target_angle;zoom=target_zoom;origin=target_origin;initialized=true
	else:
		angle=lerp_angle(angle,target_angle,1-exp(-dt*6))
		zoom=lerpf(zoom,target_zoom,1-exp(-dt*3))
		# Exact player centring avoids jitter and preserves heading lag on sharp turns.
		origin=target_origin
	map_layer.rotation=angle;map_layer.scale=Vector2.ONE*zoom
	map_layer.position=anchor()-origin.rotated(angle)*zoom
	marker_clock+=dt
	if marker_clock>=.10:
		marker_clock=fmod(marker_clock,.10);collect_markers()
		var scale_m:int=int(round(80/zoom/25)*25)
		subtitle.text=("PIT LANE   " if in_pit else "")+"%d m" % scale_m
	markers.queue_redraw()

func collect_markers() -> void:
	marker_data.clear()
	if game.director:
		var model:RefCounted=game.director.model
		var player:Dictionary=model.drivers[0]
		for i in range(1,model.drivers.size()):
			var d:Dictionary=model.drivers[i]
			if d.get("retired",false) or d.get("dq",false):continue
			if i-1>=game.director.cars.size():continue
			var p:Vector3=game.director.cars[i-1].position
			var gap:float=fposmod(d.progress-player.progress,model.length)
			marker_data.append({"position":Vector2(p.x,p.z),"pit":not d.pit.is_empty(),"ahead":gap<180})
	elif game.online_director:
		for ghost in game.online_director.ghosts.values():
			if not is_instance_valid(ghost.node) or not ghost.node.visible:continue
			var p:Vector3=ghost.node.position
			marker_data.append({"position":Vector2(p.x,p.z),"pit":false,"ahead":false})

func diagnostic() -> Dictionary:
	return {"circuit":circuit_id,"expanded":expanded,"zoom":zoom,"angle":angle,"origin":[origin.x,origin.y],"cachedPoints":point_count,"geometryRedraws":redraws,"rivals":marker_data.size(),"playerAnchor":[anchor().x,anchor().y]}
