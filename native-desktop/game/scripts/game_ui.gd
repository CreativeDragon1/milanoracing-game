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
var guide: CheckButton
var reduced_motion: CheckButton
var volume: HSlider
var sensitivity: HSlider
var home:Control

func label(text: String,size: int=18) -> Label:
	var node:=Label.new(); node.text=text; node.add_theme_font_size_override("font_size",size); return node
func choice(items: Array) -> OptionButton:
	var node:=OptionButton.new(); node.custom_minimum_size.y=42
	for item in items: node.add_item(str(item))
	return node
func button(text: String,callback: Callable) -> Button:
	var node:=Button.new(); node.text=text; node.custom_minimum_size.y=44; node.pressed.connect(callback); return node
func row(parent: Node,title: String,control: Control) -> void:
	var box:=HBoxContainer.new(); box.add_theme_constant_override("separation",16)
	var text:=label(title,17); text.custom_minimum_size.x=120; text.size_flags_vertical=Control.SIZE_SHRINK_CENTER
	box.add_child(text); control.size_flags_horizontal=Control.SIZE_EXPAND_FILL; box.add_child(control); parent.add_child(box)
func panel() -> PanelContainer:
	var p:=PanelContainer.new()
	var style:=StyleBoxFlat.new(); style.bg_color=Color(.018,.024,.037,.96)
	style.content_margin_left=30; style.content_margin_right=30; style.content_margin_top=24; style.content_margin_bottom=24
	style.border_width_top=3; style.border_color=Color("ff7a00"); p.add_theme_stylebox_override("panel",style)
	var theme:=Theme.new(); theme.default_font=load("res://assets/fonts/Barlow-Bold.ttf"); theme.default_font_size=19
	var normal:=StyleBoxFlat.new(); normal.bg_color=Color(.065,.078,.105); normal.content_margin_left=12; normal.content_margin_right=12; normal.content_margin_top=8; normal.content_margin_bottom=8
	var hover:StyleBoxFlat=normal.duplicate(); hover.bg_color=Color(.13,.17,.25); hover.border_width_left=3; hover.border_color=Color("ff7a00")
	for type in ["Button","OptionButton"]:
		theme.set_stylebox("normal",type,normal); theme.set_stylebox("hover",type,hover); theme.set_stylebox("pressed",type,hover)
	p.theme=theme; return p

func configure(main: Node) -> void:
	game=main
	home=load("res://scripts/home_screen.gd").new(); add_child(home); home.configure(game,self)
	menu=panel(); menu.position=Vector2(48,52); menu.custom_minimum_size=Vector2(500,0); add_child(menu)
	var box:=VBoxContainer.new(); box.add_theme_constant_override("separation",14); menu.add_child(box)
	var brand:=label("MILANO RACING",25); brand.add_theme_font_override("font",load("res://assets/fonts/Michroma.ttf")); box.add_child(brand)
	var tagline:=label("ALWAYS THE FASTEST",14); tagline.add_theme_color_override("font_color",Color("ff7a00")); box.add_child(tagline)
	var tabs:=HBoxContainer.new(); box.add_child(tabs)
	tabs.add_child(button("DRIVE",func():page.show(); detail_page.hide()))
	tabs.add_child(button("SETUP",func():page.hide(); detail_page.show()))
	tabs.add_child(button("ONLINE",func():online_panel.visible=not online_panel.visible))
	tabs.add_child(button("HOME",func():home.open_home()))
	page=VBoxContainer.new(); page.add_theme_constant_override("separation",10); box.add_child(page)
	game.circuit_select=choice([])
	for id in game.tracks:
		if FileAccess.file_exists("res://circuits/"+id+".scn"):
			game.circuit_select.add_item(str(game.tracks[id].name).to_upper())
			game.circuit_select.set_item_metadata(game.circuit_select.item_count-1,id)
			if id==game.active_id: game.circuit_select.select(game.circuit_select.item_count-1)
	game.circuit_select.item_selected.connect(func(i):game.load_circuit(game.circuit_select.get_item_metadata(i)))
	row(page,"CIRCUIT",game.circuit_select)
	mode=choice(["PRACTICE","QUICK RACE","GRAND PRIX"]); row(page,"SESSION",mode)
	difficulty=choice(["ROOKIE","CLUB","PRO","ELITE"]); row(page,"RIVALS",difficulty)
	distance=choice(["3 LAPS","5 LAPS","10 LAPS","25% DISTANCE"]); row(page,"DISTANCE",distance)
	qualifying=choice(["5 MINUTES","Q1 · Q2 · Q3"]); row(page,"QUALIFYING",qualifying)
	tyre=choice(["MEDIUM","SOFT","HARD"]); row(page,"START TYRE",tyre)
	var description:=label("",16); description.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART; description.custom_minimum_size.y=38; page.add_child(description)
	mode.item_selected.connect(func(i):description.text=["Open track. Find your pace.","22 cars. Lights out. Take the win.","Earn your grid position. Race for the win."][i]; qualifying.disabled=i!=2)
	mode.item_selected.emit(0)
	detail_page=VBoxContainer.new(); detail_page.add_theme_constant_override("separation",10); detail_page.hide(); box.add_child(detail_page)
	game.quality_select=choice(["PERFORMANCE","HIGH","ULTRA"]); game.quality_select.select(1)
	game.quality_select.item_selected.connect(game.apply_quality); row(detail_page,"GRAPHICS",game.quality_select)
	game.lighting_select=choice(["CIRCUIT LIGHTING","DAYLIGHT","FLOODLIGHTS","GOLDEN HOUR"])
	game.lighting_select.item_selected.connect(func(i):game.light_mode=i; game.apply_lighting()); row(detail_page,"LIGHTING",game.lighting_select)
	weather=choice(["DRY","RAIN"]); weather.item_selected.connect(game.apply_weather); row(detail_page,"WEATHER",weather)
	guide=CheckButton.new(); guide.text="RACING LINE"; guide.button_pressed=true; detail_page.add_child(guide)
	guide.toggled.connect(func(value): if game.racing_guide: game.racing_guide.visible=value)
	reduced_motion=CheckButton.new(); reduced_motion.text="REDUCED CAMERA MOTION"; detail_page.add_child(reduced_motion)
	volume=HSlider.new(); volume.min_value=0; volume.max_value=1; volume.step=.01; volume.value=.8
	volume.value_changed.connect(func(value):AudioServer.set_bus_volume_db(0,linear_to_db(maxf(.0001,value))))
	row(detail_page,"VOLUME",volume)
	sensitivity=HSlider.new(); sensitivity.min_value=.6; sensitivity.max_value=1.15; sensitivity.step=.05; sensitivity.value=1
	sensitivity.value_changed.connect(func(value):if game.vehicle:game.vehicle.steering_strength=value)
	row(detail_page,"STEERING",sensitivity)
	var hint:=label("Rain changes grip and visibility.\nRookie includes braking assistance.\n5+ lap races require two tyre compounds.",16); detail_page.add_child(hint)
	drive=button("DRIVE",game.start_or_resume); drive.custom_minimum_size.y=56
	drive.add_theme_color_override("font_color",Color("ff9a40")); box.add_child(drive)
	restart=button("NEW SESSION",game.new_session); restart.hide(); box.add_child(restart)
	game.status=label("Loading circuit…",16); box.add_child(game.status)
	box.add_child(label("WASD  Drive     C  Camera     P  Pit request\nT  Next tyre     R  Recover     Esc  Garage\nController  Stick + triggers     X  Pit request",15))
	box.add_child(button("EXIT",func():save_preferences(); game.get_tree().quit()))
	var logo:=TextureRect.new(); logo.texture=load("res://assets/team-logo.png"); logo.expand_mode=TextureRect.EXPAND_IGNORE_SIZE; logo.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	logo.position=Vector2(1320,25); logo.size=Vector2(230,98); add_child(logo)
	game.hud=label("",28); game.hud.position=Vector2(48,785)
	game.hud.add_theme_font_override("font",load("res://assets/fonts/Barlow-ExtraBoldItalic.ttf")); game.hud.add_theme_color_override("font_shadow_color",Color.BLACK)
	game.hud.add_theme_constant_override("shadow_outline_size",4); add_child(game.hud)
	timing=label("",19); timing.position=Vector2(1160,150); timing.add_theme_font_override("font",load("res://assets/fonts/Barlow-Bold.ttf"))
	timing.add_theme_color_override("font_shadow_color",Color.BLACK); timing.add_theme_constant_override("shadow_outline_size",4); add_child(timing)
	var overlay:Control=load("res://scripts/race_overlay.gd").new(); overlay.game=game; add_child(overlay)
	build_online()
	if not game.qa_mode: load_preferences()
	AudioServer.set_bus_volume_db(0,linear_to_db(maxf(.0001,volume.value)))
	home.motion=not reduced_motion.button_pressed
	reduced_motion.toggled.connect(func(value):home.motion=not value; home.video.paused=value)
	if not game.qa_mode or game.qa_home: home.open_home()
	else: home.hide()

func load_preferences() -> void:
	var config:=ConfigFile.new()
	if config.load("user://preferences.cfg")!=OK: return
	game.quality_select.select(clampi(int(config.get_value("display","quality",1)),0,2)); game.apply_quality(game.quality_select.selected)
	volume.value=clampf(float(config.get_value("audio","volume",.8)),0,1)
	sensitivity.value=clampf(float(config.get_value("controls","steering",1)),.6,1.15)
	reduced_motion.button_pressed=bool(config.get_value("display","reduced_motion",false))
	guide.button_pressed=bool(config.get_value("display","guide",true))

func save_preferences() -> void:
	var config:=ConfigFile.new()
	config.set_value("display","quality",game.quality_select.selected)
	config.set_value("display","reduced_motion",reduced_motion.button_pressed)
	config.set_value("display","guide",guide.button_pressed)
	config.set_value("audio","volume",volume.value)
	config.set_value("controls","steering",sensitivity.value)
	config.save("user://preferences.cfg")

func build_online() -> void:
	online_panel=panel(); online_panel.position=Vector2(600,150); online_panel.custom_minimum_size=Vector2(540,0); online_panel.hide(); add_child(online_panel)
	var box:=VBoxContainer.new(); box.add_theme_constant_override("separation",12); online_panel.add_child(box)
	box.add_child(label("ONLINE GRID",27))
	host=LineEdit.new(); host.text="https://game.milanoracing.team"; row(box,"SERVER",host)
	driver_name=LineEdit.new(); driver_name.text="Driver"; driver_name.max_length=18; row(box,"NAME",driver_name)
	password=LineEdit.new(); password.secret=true; password.placeholder_text="Private test password"; row(box,"ACCESS",password)
	box.add_child(button("CONNECT",func():
		if not game.network.set_host(host.text): return
		if password.text: game.network.login(password.text); password.clear()
		else: game.network.open_socket()))
	code=LineEdit.new(); code.placeholder_text="Six-letter room code"; code.max_length=6; row(box,"ROOM",code)
	var actions:=HBoxContainer.new(); box.add_child(actions)
	actions.add_child(button("CREATE",func():game.join_online(); game.network.create_room(driver_name.text,game.active_id,3 if distance.selected==0 else 5)))
	actions.add_child(button("JOIN",func():game.join_online(); game.network.join_room(driver_name.text,code.text)))
	actions.add_child(button("READY",func():game.network.command("ready",{"ready":true})))
	box.add_child(button("START RACE",func():game.network.command("start")))
	box.add_child(button("RETURN TO LOBBY",func():game.network.command("rematch")))
	box.add_child(button("LEAVE",func():game.leave_online(); online_panel.hide()))
	online_status=label("Up to 16 drivers. Private room codes.\nOnline races use ghost cars.",16); online_status.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART; online_status.custom_minimum_size.y=55; box.add_child(online_status)
	game.network.message.connect(func(text):online_status.text=text)

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
