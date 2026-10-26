extends Control
var game:Node
var id:=""
var points:=PackedVector2Array()
var circuit_name:Label
var distance:Label
func _ready() -> void:
	custom_minimum_size=Vector2(570,460);mouse_filter=Control.MOUSE_FILTER_IGNORE
	circuit_name=Label.new();circuit_name.position=Vector2(32,28);circuit_name.size=Vector2(500,66);circuit_name.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
	circuit_name.add_theme_font_override("font",load("res://assets/fonts/Michroma.ttf"));circuit_name.add_theme_font_size_override("font_size",23);add_child(circuit_name)
	distance=Label.new();distance.position=Vector2(32,406);distance.add_theme_font_size_override("font_size",18);distance.add_theme_color_override("font_color",Color("a7b3c3"));add_child(distance)
func _process(_dt:float) -> void:
	if not is_visible_in_tree() or game.active_id==id:return
	id=game.active_id;var data:Dictionary=game.tracks[id];points.clear()
	var lo:=Vector2(INF,INF);var hi:=Vector2(-INF,-INF)
	for i in int(data.N):var p:=Vector2(data.x[i],data.z[i]);lo=lo.min(p);hi=hi.max(p)
	var scale:=minf(470/maxf(1,hi.x-lo.x),260/maxf(1,hi.y-lo.y))
	for i in range(0,int(data.N),2):points.append((Vector2(data.x[i],data.z[i])-(lo+hi)*.5)*scale+Vector2(285,245))
	points.append(points[0]);circuit_name.text=str(data.name).to_upper();distance.text="%.3f KM" % (float(data.length)/1000);queue_redraw()
func _draw() -> void:
	var style:=preload("res://scripts/ui_theme.gd").slab(Color("0b1019"));draw_style_box(style,Rect2(Vector2.ZERO,size))
	if points.size()<3:return
	draw_polyline(points,Color("263247"),12,true);draw_polyline(points,Color("e2e8ee"),4,true)
	var sector:=points.slice(0,maxi(3,int(points.size()*.1)));draw_polyline(sector,Color("ff7a00"),5,true)
	draw_circle(points[0],7,Color("ff7a00"));draw_circle(points[0],3,Color("080b11"))
