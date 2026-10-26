extends Control
const RaceTheme=preload("res://scripts/ui_theme.gd")
var game:Node
var speed:Label
var gear:Label
var lap:Label
var clock_label:Label
var pit:Label
var timing_panel:PanelContainer
var skip_pit:Button
var revs:Array[ColorRect]=[]
var update_clock:=0.0
var dash:Panel
var pit_plate:Panel
func text(value:String,at:Vector2,font_size:int,parent:Node=self) -> Label:
	var l:=Label.new();l.text=value;l.position=at;l.add_theme_font_size_override("font_size",font_size);parent.add_child(l);return l
func plate(rect:Rect2) -> Panel:
	var p:=Panel.new();p.position=rect.position;p.size=rect.size;p.mouse_filter=Control.MOUSE_FILTER_IGNORE;p.add_theme_stylebox_override("panel",RaceTheme.slab(Color(.025,.035,.05,.91),0));add_child(p);return p
func configure(main:Node) -> void:
	game=main;theme=RaceTheme.create();mouse_filter=Control.MOUSE_FILTER_IGNORE
	var left:=plate(Rect2(48,40,300,94));lap=text("LAP 1",Vector2(18,10),13,left);clock_label=text("0:00.000",Vector2(18,34),26,left)
	dash=plate(Rect2(1242,706,310,146));speed=text("000",Vector2(18,30),48,dash);speed.add_theme_font_override("font",load("res://assets/fonts/Michroma.ttf"))
	var unit:=text("KM/H",Vector2(23,108),14,dash);unit.add_theme_color_override("font_color",RaceTheme.MUTED)
	gear=text("1",Vector2(224,36),46,dash);gear.add_theme_color_override("font_color",RaceTheme.ORANGE)
	text("GEAR",Vector2(226,108),14,dash).add_theme_color_override("font_color",RaceTheme.MUTED)
	for i in 15:
		var r:=ColorRect.new();r.position=Vector2(18+i*18,17);r.size=Vector2(13,5);dash.add_child(r);revs.append(r)
	pit_plate=plate(Rect2(612,794,376,50));pit=text("",Vector2(0,8),22,pit_plate);pit.size.x=376;pit.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;pit.add_theme_color_override("font_color",RaceTheme.ORANGE)
	timing_panel=PanelContainer.new();timing_panel.position=Vector2(1222,136);timing_panel.custom_minimum_size=Vector2(330,0);timing_panel.add_theme_stylebox_override("panel",RaceTheme.slab(Color(.025,.035,.05,.91),18));add_child(timing_panel)
	game.ui.timing=Label.new();game.ui.timing.add_theme_font_size_override("font_size",13);timing_panel.add_child(game.ui.timing)
	game.ui.timing.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;game.ui.timing.custom_minimum_size.x=294
	skip_pit=Button.new();skip_pit.text="SKIP PIT DRIVE   K · D-PAD →";skip_pit.position=Vector2(558,730);skip_pit.size=Vector2(484,48);skip_pit.add_theme_font_size_override("font_size",13);add_child(skip_pit);skip_pit.pressed.connect(game.skip_pit_drive)
	get_viewport().size_changed.connect(fit_window);fit_window()
func fit_window() -> void:
	var area:=get_viewport().get_visible_rect().size
	dash.position=area-Vector2(358,194)
	timing_panel.position=Vector2(area.x-378,136)
	pit_plate.position=Vector2((area.x-376)/2,area.y-106)
	skip_pit.position=Vector2((area.x-484)/2,area.y-170)
func _process(dt:float) -> void:
	visible=game.loaded and not game.menu.visible and not game.ui.home.visible and not game.cinematic_mode
	if not visible:return
	update_clock+=dt;if update_clock<.1:return
	update_clock=0;var v:Node=game.vehicle
	speed.text="%03d" % roundi(absf(v.speed)*3.6);gear.text="R" if v.reverse else str(v.gear)
	lap.text="LAP %d" % (v.lap+1)
	var elapsed:float=v.lap_clock
	var outlap:=false
	if game.director:
		lap.text=game.director.title()
		var model:RefCounted=game.director.model
		var player:Dictionary=model.drivers[0]
		elapsed=model.clock-player.lap_start
		outlap=model.phase.begins_with("qualifying") and player.outlap
	clock_label.text="OUT LAP" if outlap else preload("res://scripts/race_time.gd").lap(elapsed)
	var in_pit:bool=not game.director.model.drivers[0].pit.is_empty() if game.director else v.pit_active
	var requested:bool=game.director.model.drivers[0].requested if game.director else v.pit_requested
	pit.text="PIT LANE" if in_pit else "BOX THIS LAP" if requested else "";pit.get_parent().visible=not pit.text.is_empty()
	skip_pit.visible=in_pit and not game.online_mode;skip_pit.disabled=game.pit_skip_busy
	timing_panel.visible=not game.ui.timing.text.is_empty()
	for i in 15:revs[i].color=(RaceTheme.ORANGE if i<8 else RaceTheme.BLUE if i<12 else Color.WHITE) if v.rpm>=5000+i*850 else Color("303948")
