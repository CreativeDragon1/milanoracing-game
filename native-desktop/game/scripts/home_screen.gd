extends Control
var game:Node
var ui:Node
var video:VideoStreamPlayer
var title:Label
var caption:Label
var hero:VBoxContainer
var shade:ColorRect
var playback_ready:=false
var motion:=true
var warm_time:=0.0
var resume_button:Button
func configure(main:Node,interface:Node) -> void:
	game=main; ui=interface
	theme=Theme.new(); theme.default_font=load("res://assets/fonts/Barlow-Bold.ttf"); theme.default_font_size=18
	mouse_filter=Control.MOUSE_FILTER_IGNORE
	size=Vector2(1600,900)
	video=VideoStreamPlayer.new(); video.expand=true; video.loop=true; video.volume_db=-19; video.mouse_filter=Control.MOUSE_FILTER_IGNORE
	video.size=size; add_child(video)
	if (not game.qa_mode or game.qa_home) and ResourceLoader.exists("res://assets/home-reel.ogv"):
		video.stream=load("res://assets/home-reel.ogv"); video.play()
	shade=ColorRect.new(); shade.size=size; shade.mouse_filter=Control.MOUSE_FILTER_IGNORE; add_child(shade)
	var shader:=Shader.new()
	shader.code="shader_type canvas_item;void fragment(){float side=1.0-smoothstep(.0,.85,UV.x);float edge=pow(abs(UV.y-.5)*2.0,3.0);COLOR=vec4(.012,.017,.027,clamp(side*.86+edge*.25,.12,.94));}"
	var mat:=ShaderMaterial.new(); mat.shader=shader; shade.material=mat
	hero=VBoxContainer.new(); hero.position=Vector2(66,190); hero.add_theme_constant_override("separation",24); add_child(hero)
	var brand:=Label.new(); brand.text="MILANO RACING"; brand.add_theme_font_override("font",load("res://assets/fonts/Michroma.ttf")); brand.add_theme_font_size_override("font_size",25); hero.add_child(brand)
	title=Label.new(); title.text="ALWAYS\nTHE FASTEST"; title.add_theme_font_override("font",load("res://assets/fonts/Barlow-ExtraBoldItalic.ttf")); title.add_theme_font_size_override("font_size",83); title.add_theme_constant_override("line_spacing",-12); hero.add_child(title)
	var choices:=VBoxContainer.new(); choices.add_theme_constant_override("separation",10); hero.add_child(choices)
	resume_button=ui.button("RESUME",func():game.pending_new_session=false; game.start_or_resume()); resume_button.hide(); choices.add_child(resume_button)
	for choice in [["RACE",1],["GRAND PRIX",2],["FREE PRACTICE",0]]:
		var button:Button=ui.button(choice[0],choose.bind(choice[1]))
		button.custom_minimum_size=Vector2(390,54); button.alignment=HORIZONTAL_ALIGNMENT_LEFT
		var normal:=StyleBoxFlat.new(); normal.bg_color=Color(.04,.055,.08,.8); normal.content_margin_left=20
		var hover:StyleBoxFlat=normal.duplicate(); hover.bg_color=Color("ff7a00"); hover.border_width_left=4; hover.border_color=Color.WHITE
		button.add_theme_stylebox_override("normal",normal); button.add_theme_stylebox_override("hover",hover); button.add_theme_stylebox_override("focus",hover)
		button.add_theme_font_override("font",load("res://assets/fonts/Barlow-Bold.ttf")); button.add_theme_font_size_override("font_size",23)
		choices.add_child(button)
	var row:=HBoxContainer.new(); row.add_theme_constant_override("separation",20); hero.add_child(row)
	row.add_child(ui.button("ONLINE",func():hero.hide(); ui.menu.show(); ui.online_panel.show()))
	row.add_child(ui.button("SETUP",func():hero.hide(); ui.menu.show(); ui.page.hide(); ui.detail_page.show()))
	row.add_child(ui.button("EXIT",func():ui.save_preferences(); get_tree().quit()))
	caption=Label.new(); caption.position=Vector2(1050,810); caption.size=Vector2(480,35); caption.horizontal_alignment=HORIZONTAL_ALIGNMENT_RIGHT
	caption.add_theme_font_override("font",load("res://assets/fonts/Barlow-Bold.ttf")); caption.add_theme_font_size_override("font_size",22); add_child(caption)
	var line:=ColorRect.new(); line.position=Vector2(66,155); line.size=Vector2(70,4); line.color=Color("ff7a00"); add_child(line)

func choose(mode:int) -> void:
	hero.hide(); ui.menu.show(); ui.page.show(); ui.detail_page.hide()
	ui.mode.select(mode); ui.mode.item_selected.emit(mode)
	game.pending_new_session=true; ui.drive.text="START SESSION"
	ui.drive.grab_focus()

func open_home() -> void:
	show(); hero.show(); ui.menu.hide(); ui.online_panel.hide()
	resume_button.visible=is_instance_valid(game.director) or game.online_mode
	video.paused=not motion
	if video.stream and not video.is_playing(): video.play()
	if motion:
		hero.modulate.a=0; var tween:=create_tween(); tween.tween_property(hero,"modulate:a",1,.5)

func close_home() -> void:
	hide(); video.paused=true; game.get_viewport().disable_3d=false

func _process(dt:float) -> void:
	if not visible: return
	if video.stream:
		playback_ready=video.stream_position>.05
		if game.loaded: warm_time+=dt
		if playback_ready and warm_time>2 and game.paused and not game.qa_race and not game.cinematic_mode: game.get_viewport().disable_3d=true
		var t:=fposmod(video.stream_position,17.4)
		caption.text=["MONZA","MARINA BAY","SPA-FRANCORCHAMPS","MILANO AUTODROMO"][mini(3,int((t+.65)/4.35))]
	else: caption.text=""
