extends Control
var game: Node
var last_count:=-2
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE
	get_viewport().size_changed.connect(func():position.x=(get_viewport().get_visible_rect().size.x-1600)/2)
	position.x=(get_viewport().get_visible_rect().size.x-1600)/2
func _process(_dt: float) -> void:
	var count:=-1
	if game and game.loaded and not game.menu.visible and not game.ui.home.visible:
		if game.director and game.director.model.phase=="countdown":count=clampi(6-ceili(game.director.model.countdown),0,5)
		elif game.online_director and game.network.room.get("phase","")=="count":count=clampi(6-ceili((game.network.room.startAt-game.network.server_now())/1000),0,5)
	if count!=last_count:last_count=count;queue_redraw()
func _draw() -> void:
	if not game or not game.loaded or game.menu.visible or game.ui.home.visible: return
	var count:=0
	if game.director and game.director.model.phase=="countdown": count=clampi(6-ceili(game.director.model.countdown),0,5)
	elif game.online_director and game.network.room.get("phase","")=="count": count=clampi(6-ceili((game.network.room.startAt-game.network.server_now())/1000),0,5)
	else: count=-1
	if count>=0:
		draw_style_box(panel(),Rect2(630,55,340,80))
		for i in 5:
			draw_circle(Vector2(672+i*64,95),24,Color("ed3428") if i<count else Color("30191c"))
func panel() -> StyleBoxFlat:
	var style:=StyleBoxFlat.new(); style.bg_color=Color(.01,.015,.02,.9); style.corner_radius_top_left=8; style.corner_radius_top_right=8; style.corner_radius_bottom_left=8; style.corner_radius_bottom_right=8; return style
