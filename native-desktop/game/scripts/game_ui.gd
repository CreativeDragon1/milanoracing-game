extends CanvasLayer
var game: Node
var menu: PanelContainer
var mode: OptionButton
var difficulty: OptionButton
var distance: OptionButton
var qualifying: OptionButton
var tyre: OptionButton
var weather: OptionButton
var drive: Button
var timing: Label
var online_panel: PanelContainer
var host: LineEdit
var password: LineEdit
var driver_name: LineEdit
var code: LineEdit
var online_status: Label
var page: VBoxContainer
var detail_page: VBoxContainer
var restart: Button
var adaptive: CheckButton
var guide: CheckButton
var reduced_motion: CheckButton
var volume: HSlider
var sensitivity: HSlider
var home:Control
var circuit_map:Control

const RaceTheme=preload("res://scripts/ui_theme.gd")
var section_title:Label
var driving_hud:Control
var navigation:Array[Button]=[]
var session_rows:Array[Control]=[]
var qualifying_row:Control
var logo:TextureRect
var screen_mode:OptionButton

func label(text:String,size:int=18) -> Label:
	var node:=Label.new();node.text=text;node.add_theme_font_size_override("font_size",size);return node
func choice(items:Array) -> OptionButton:
	var node:=OptionButton.new();node.custom_minimum_size=Vector2(240,52)
	for item in items:node.add_item(str(item))
	return node
func button(text:String,callback:Callable) -> Button:
	var node:=Button.new();node.text=text;node.custom_minimum_size.y=48;node.pressed.connect(callback);return node
func row(parent:Node,title:String,control:Control) -> Control:
	var box:=HBoxContainer.new();box.add_theme_constant_override("separation",20)
	var text:=label(title,16);text.add_theme_color_override("font_color",RaceTheme.MUTED);text.custom_minimum_size.x=132;text.size_flags_vertical=Control.SIZE_SHRINK_CENTER
	box.add_child(text);control.size_flags_horizontal=Control.SIZE_EXPAND_FILL;box.add_child(control);parent.add_child(box);return box
func panel() -> PanelContainer:
	var p:=PanelContainer.new();p.theme=RaceTheme.create();p.add_theme_stylebox_override("panel",RaceTheme.slab(Color(.025,.035,.05,.98),32));return p
func spacer(parent:Node,expand:bool=false,height:float=12) -> Control:
	var c:=Control.new();c.custom_minimum_size.y=height;if expand:c.size_flags_vertical=Control.SIZE_EXPAND_FILL
	parent.add_child(c);return c
func section(which:int) -> void:
	page.visible=which==0;detail_page.visible=which==1;online_panel.visible=which==2;section_title.text=["RACE SETUP","SETTINGS","ONLINE"][which]
	for i in navigation.size():navigation[i].add_theme_color_override("font_color",RaceTheme.ORANGE if i==which else Color("aeb8c6"))
	if which==2:online_panel.move_to_front()
func configure(main:Node) -> void:
	game=main
	home=load("res://scripts/home_screen.gd").new();add_child(home);home.configure(game,self)
	menu=panel();menu.position=Vector2(48,48);menu.size=Vector2(1504,804);add_child(menu)
	var box:=VBoxContainer.new();box.add_theme_constant_override("separation",22);menu.add_child(box)
	var header:=HBoxContainer.new();box.add_child(header)
	section_title=label("RACE SETUP",28);section_title.add_theme_font_override("font",load("res://assets/fonts/Michroma.ttf"));section_title.size_flags_horizontal=Control.SIZE_EXPAND_FILL;header.add_child(section_title)
	header.add_child(button("HOME",func():home.open_home()))
	var tabs:=HBoxContainer.new();tabs.add_theme_constant_override("separation",10);box.add_child(tabs)
	for i in 3:
		var b:=button(["SESSION","SETTINGS","ONLINE"][i],section.bind(i));b.custom_minimum_size.x=168;tabs.add_child(b);navigation.append(b)
	page=VBoxContainer.new();page.size_flags_vertical=Control.SIZE_EXPAND_FILL;box.add_child(page)
	var columns:=HBoxContainer.new();columns.add_theme_constant_override("separation",64);page.add_child(columns)
	var form:=VBoxContainer.new();form.add_theme_constant_override("separation",14);form.custom_minimum_size.x=720;columns.add_child(form)
	game.circuit_select=choice([])
	for id in game.tracks:
		if FileAccess.file_exists("res://circuits/"+id+".scn"):
			game.circuit_select.add_item(str(game.tracks[id].name).to_upper());game.circuit_select.set_item_metadata(game.circuit_select.item_count-1,id)
			if id==game.active_id:game.circuit_select.select(game.circuit_select.item_count-1)
	game.circuit_select.item_selected.connect(func(i):game.load_circuit(game.circuit_select.get_item_metadata(i)))
	row(form,"CIRCUIT",game.circuit_select)
	mode=choice(["PRACTICE","QUICK RACE","GRAND PRIX"]);row(form,"SESSION",mode)
	difficulty=choice(["ROOKIE","CLUB","PRO","ELITE"]);session_rows.append(row(form,"DIFFICULTY",difficulty))
	distance=choice(["3 LAPS","5 LAPS","10 LAPS","25% DISTANCE"]);session_rows.append(row(form,"DISTANCE",distance))
	qualifying=choice(["5 MINUTES","Q1 · Q2 · Q3"]);qualifying_row=row(form,"QUALIFYING",qualifying)
	tyre=choice(["MEDIUM","SOFT","HARD"]);session_rows.append(row(form,"START TYRE",tyre))
	mode.item_selected.connect(func(i):
		for r in session_rows:r.visible=i>0
		qualifying_row.visible=i==2;qualifying.disabled=i!=2)
	var preview:Control=load("res://scripts/circuit_preview.gd").new();preview.game=game;columns.add_child(preview)
	detail_page=VBoxContainer.new();detail_page.size_flags_vertical=Control.SIZE_EXPAND_FILL;detail_page.hide();box.add_child(detail_page)
	var settings:=HBoxContainer.new();settings.add_theme_constant_override("separation",64);detail_page.add_child(settings)
	var display:=VBoxContainer.new();display.custom_minimum_size.x=650;display.add_theme_constant_override("separation",18);settings.add_child(display)
	var controls:=VBoxContainer.new();controls.custom_minimum_size.x=650;controls.add_theme_constant_override("separation",18);settings.add_child(controls)
	display.add_child(label("DISPLAY",22));controls.add_child(label("DRIVING",22))
	screen_mode=choice(["WINDOWED","MAXIMIZED","FULLSCREEN"]);screen_mode.select(1);screen_mode.item_selected.connect(func(i):DisplayServer.window_set_mode([DisplayServer.WINDOW_MODE_WINDOWED,DisplayServer.WINDOW_MODE_MAXIMIZED,DisplayServer.WINDOW_MODE_FULLSCREEN][i]));row(display,"WINDOW",screen_mode)
	game.quality_select=choice(["PERFORMANCE","HIGH","ULTRA"]);game.quality_select.select(1);game.quality_select.item_selected.connect(game.apply_quality);row(display,"GRAPHICS",game.quality_select)
	game.lighting_select=choice(["CIRCUIT","DAYLIGHT","FLOODLIGHTS","GOLDEN HOUR"]);game.lighting_select.item_selected.connect(func(i):game.light_mode=i;game.apply_lighting());row(display,"LIGHTING",game.lighting_select)
	weather=choice(["DRY","RAIN"]);weather.item_selected.connect(game.apply_weather);row(display,"WEATHER",weather)
	reduced_motion=CheckButton.new();reduced_motion.text="REDUCED MOTION";display.add_child(reduced_motion)
	spacer(display);display.add_child(label("AUDIO",22))
	volume=HSlider.new();volume.min_value=0;volume.max_value=1;volume.step=.01;volume.value=.8;volume.custom_minimum_size.y=42
	volume.value_changed.connect(func(value):AudioServer.set_bus_volume_db(0,linear_to_db(maxf(.0001,value))));row(display,"VOLUME",volume)
	sensitivity=HSlider.new();sensitivity.min_value=.6;sensitivity.max_value=1.15;sensitivity.step=.05;sensitivity.value=1;sensitivity.custom_minimum_size.y=42
	sensitivity.value_changed.connect(func(value):if game.vehicle:game.vehicle.steering_strength=value)
	row(controls,"STEERING",sensitivity)
	guide=CheckButton.new();guide.text="RACING LINE";guide.button_pressed=true;controls.add_child(guide);guide.toggled.connect(func(value):if game.racing_guide:game.racing_guide.visible=value)
	adaptive=CheckButton.new();adaptive.text="ADAPTIVE RIVALS";adaptive.button_pressed=true;controls.add_child(adaptive)
	controls.add_child(button("RESET RIVAL LEARNING",func():game.learning.reset()))
	controls.add_child(button("CONTROLS",show_controls))
	var footer:=HBoxContainer.new();footer.add_theme_constant_override("separation",20);box.add_child(footer)
	game.status=label("Loading circuit…",16);game.status.add_theme_color_override("font_color",RaceTheme.MUTED);game.status.size_flags_horizontal=Control.SIZE_EXPAND_FILL;game.status.size_flags_vertical=Control.SIZE_SHRINK_CENTER;footer.add_child(game.status)
	restart=button("NEW SESSION",game.new_session);restart.hide();footer.add_child(restart)
	drive=button("DRIVE",game.start_or_resume);drive.custom_minimum_size=Vector2(300,60);RaceTheme.primary(drive);footer.add_child(drive)
	logo=TextureRect.new();logo.texture=load("res://assets/team-logo-fit.png");logo.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;logo.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;logo.position=Vector2(1324,30);logo.size=Vector2(224,86);logo.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(logo)
	game.hud=Label.new();game.hud.hide();add_child(game.hud)
	driving_hud=load("res://scripts/driving_hud.gd").new();add_child(driving_hud);driving_hud.configure(game)
	var overlay:Control=load("res://scripts/race_overlay.gd").new();overlay.game=game;add_child(overlay)
	circuit_map=load("res://scripts/circuit_map.gd").new();add_child(circuit_map);circuit_map.configure(game)
	build_online()
	get_viewport().size_changed.connect(fit_window);fit_window()
	if not game.qa_mode:load_preferences()
	AudioServer.set_bus_volume_db(0,linear_to_db(maxf(.0001,volume.value)))
	home.motion=not reduced_motion.button_pressed;reduced_motion.toggled.connect(func(value):home.motion=not value;home.video.paused=value)
	section(0);mode.item_selected.emit(0)
	if not game.qa_mode or game.qa_home:home.open_home()
	else:home.hide()
func fit_window() -> void:
	var area:=get_viewport().get_visible_rect().size
	var current_mode:=DisplayServer.window_get_mode()
	screen_mode.select(2 if current_mode in [DisplayServer.WINDOW_MODE_FULLSCREEN,DisplayServer.WINDOW_MODE_EXCLUSIVE_FULLSCREEN] else 1 if current_mode==DisplayServer.WINDOW_MODE_MAXIMIZED else 0)
	menu.position=(area-Vector2(1504,804))/2
	online_panel.position=(area-Vector2(1440,510))/2
	logo.position=Vector2(area.x-276,30)
func show_controls() -> void:
	var dialog:=AcceptDialog.new();dialog.title="CONTROLS";dialog.dialog_text="WASD   Drive\nC   Camera\nP   Pit request\nT   Next tyre\nM   Map\nR   Recover\nEsc   Garage\n\nController\nLeft stick   Steer\nTriggers   Throttle and brake\nX   Pit request\nD-pad up   Map\nK or D-pad right   Skip pit drive\n\nReverse: stop, release brake, then press again.";dialog.theme=RaceTheme.create();add_child(dialog);dialog.popup_centered(Vector2i(470,520));dialog.confirmed.connect(dialog.queue_free)
func _process(_dt:float) -> void:
	logo.visible=not menu.visible and not home.visible and not game.cinematic_mode
	game.hud.visible=false

func load_preferences() -> void:
	var config:=ConfigFile.new()
	if config.load("user://preferences.cfg")!=OK: return
	game.quality_select.select(clampi(int(config.get_value("display","quality",1)),0,2)); game.apply_quality(game.quality_select.selected)
	volume.value=clampf(float(config.get_value("audio","volume",.8)),0,1)
	sensitivity.value=clampf(float(config.get_value("controls","steering",1)),.6,1.15)
	reduced_motion.button_pressed=bool(config.get_value("display","reduced_motion",false))
	adaptive.button_pressed=bool(config.get_value("controls","adaptive",true))
	guide.button_pressed=bool(config.get_value("display","guide",true))

func save_preferences() -> void:
	var config:=ConfigFile.new()
	config.set_value("display","quality",game.quality_select.selected)
	config.set_value("display","reduced_motion",reduced_motion.button_pressed)
	config.set_value("display","guide",guide.button_pressed)
	config.set_value("audio","volume",volume.value)
	config.set_value("controls","adaptive",adaptive.button_pressed)
	config.set_value("controls","steering",sensitivity.value)
	config.save("user://preferences.cfg")

func build_online() -> void:
	online_panel=panel();online_panel.position=Vector2(80,230);online_panel.size=Vector2(1440,510);online_panel.hide();add_child(online_panel)
	var outer:=VBoxContainer.new();outer.add_theme_constant_override("separation",22);online_panel.add_child(outer)
	var columns:=HBoxContainer.new();columns.add_theme_constant_override("separation",64);outer.add_child(columns)
	var connect:=VBoxContainer.new();connect.custom_minimum_size.x=630;connect.add_theme_constant_override("separation",14);columns.add_child(connect)
	var room:=VBoxContainer.new();room.custom_minimum_size.x=630;room.add_theme_constant_override("separation",14);columns.add_child(room)
	host=LineEdit.new();host.text="https://game.milanoracing.team";row(connect,"SERVER",host)
	driver_name=LineEdit.new();driver_name.text="Driver";driver_name.max_length=18;row(connect,"NAME",driver_name)
	password=LineEdit.new();password.secret=true;password.placeholder_text="Password";row(connect,"ACCESS",password)
	connect.add_child(button("CONNECT",func():
		if not game.network.set_host(host.text):return
		if password.text:game.network.login(password.text);password.clear()
		else:game.network.open_socket()))
	code=LineEdit.new();code.placeholder_text="Room code";code.max_length=6;row(room,"ROOM",code)
	var actions:=HBoxContainer.new();actions.add_theme_constant_override("separation",12);room.add_child(actions)
	actions.add_child(button("CREATE",func():game.join_online();game.network.create_room(driver_name.text,game.active_id,3 if distance.selected==0 else 5)))
	actions.add_child(button("JOIN",func():game.join_online();game.network.join_room(driver_name.text,code.text)))
	actions.add_child(button("READY",func():game.network.command("ready",{"ready":true})))
	room.add_child(button("START RACE",func():game.network.command("start")))
	room.add_child(button("RETURN TO LOBBY",func():game.network.command("rematch")))
	room.add_child(button("LEAVE",func():game.leave_online();section(0)))
	online_status=label("OFFLINE",18);online_status.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;outer.add_child(online_status);game.network.message.connect(func(text):online_status.text=text)

func options() -> Dictionary:
	var laps: int=[3,5,10,ceili(305000/float(game.circuit.length)*.25)][distance.selected]
	return {"laps":laps,"difficulty":difficulty.selected,"full_qualifying":qualifying.selected==1,"two_compounds":laps>=5,"tyre":["medium","soft","hard"][tyre.selected]}

func show_garage(value: bool) -> void:
	menu.visible=value
	if not value: home.close_home()
	elif home.visible and home.hero.visible: menu.hide()
	if not game.qa_mode: save_preferences()
	if not value: online_panel.hide()
	if value and not reduced_motion.button_pressed:
		menu.modulate.a=0; var tween:=create_tween(); tween.tween_property(menu,"modulate:a",1,.22)
	restart.visible=is_instance_valid(game.director)
	drive.text="CONTINUE" if is_instance_valid(game.director) and game.director.model.phase.ends_with("result") else "RESUME" if is_instance_valid(game.director) else "DRIVE"
