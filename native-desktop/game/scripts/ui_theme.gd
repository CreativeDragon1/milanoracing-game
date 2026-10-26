extends RefCounted
const ORANGE=Color("ff7a00")
const BLUE=Color("0019ff")
const MUTED=Color("99a4b4")
static func slab(color:Color,padding:float=16) -> StyleBoxFlat:
	var s:=StyleBoxFlat.new();s.bg_color=color;s.set_content_margin_all(padding);s.set_corner_radius_all(2);return s
static func create() -> Theme:
	var t:=Theme.new();t.default_font=load("res://assets/fonts/Michroma.ttf");t.default_font_size=16
	var normal:=slab(Color("151a23"));var hover:=slab(Color("252e3b"));var focus:=StyleBoxFlat.new()
	focus.bg_color=Color.TRANSPARENT;focus.border_color=ORANGE;focus.set_border_width_all(2);focus.set_corner_radius_all(2)
	for type in ["Button","OptionButton"]:
		t.set_stylebox("normal",type,normal);t.set_stylebox("hover",type,hover);t.set_stylebox("pressed",type,hover);t.set_stylebox("focus",type,focus)
		t.set_stylebox("disabled",type,slab(Color("10141c")));t.set_color("font_color",type,Color("f4f6fa"));t.set_color("font_disabled_color",type,Color("6d7888"))
	t.set_stylebox("normal","LineEdit",normal);t.set_stylebox("focus","LineEdit",focus)
	t.set_stylebox("panel","PopupMenu",slab(Color("10151e")));t.set_stylebox("hover","PopupMenu",hover)
	t.set_constant("v_separation","PopupMenu",16);t.set_font_size("font_size","PopupMenu",16)
	t.set_color("font_color","Label",Color("f4f6fa"));t.set_color("font_color","CheckButton",Color("d4dce7"))
	t.set_stylebox("slider","HSlider",slab(Color("303849"),3));t.set_stylebox("grabber_area","HSlider",slab(ORANGE,3));t.set_stylebox("grabber_area_highlight","HSlider",slab(ORANGE,3))
	return t
static func primary(button:Button) -> void:
	button.add_theme_stylebox_override("normal",slab(ORANGE));button.add_theme_stylebox_override("hover",slab(Color("ff983d")))
	button.add_theme_stylebox_override("pressed",slab(Color("de6600")));button.add_theme_color_override("font_color",Color("090c11"));button.add_theme_color_override("font_hover_color",Color("090c11"));button.add_theme_font_size_override("font_size",18)
