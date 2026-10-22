extends Node
# Same authenticated protocol as the browser game; no inbound ports on the client.
signal snapshot_received(data: Dictionary)
signal message(text: String)
signal connected
var origin := "https://game.milanoracing.team"
var cookie := ""
var token := ""
var room: Dictionary = {}
var me := ""
var socket: WebSocketPeer
var request_id := 0
var poll_clock := 0.0
var retry_clock := 0.0
var reconnect_attempt := 0
var server_offset := 0.0
var has_server_time := false
var last_state := WebSocketPeer.STATE_CLOSED
var active := false
var pending: Dictionary = {}
var last_request: Dictionary = {}
var car: Node3D
var http: HTTPRequest
var login_pending := false
var awaiting_snapshot := false

func _ready() -> void:
	http=HTTPRequest.new(); http.timeout=12; http.max_redirects=0
	add_child(http); http.request_completed.connect(login_result)

func set_host(url: String) -> bool:
	url=url.strip_edges().trim_suffix("/")
	var valid := RegEx.new()
	valid.compile("^https://[A-Za-z0-9.-]+(?::[0-9]{1,5})?$")
	var local := RegEx.new()
	local.compile("^http://(?:localhost|127\\.0\\.0\\.1|10\\.[0-9.]+|192\\.168\\.[0-9.]+|172\\.(?:1[6-9]|2[0-9]|3[01])\\.[0-9.]+)(?::[0-9]{1,5})?$")
	if not valid.search(url) and not local.search(url): message.emit("Use an HTTPS server address, or a local-network HTTP address."); return false
	if origin!=url: disconnect_room(); cookie=""
	origin=url
	return true

func login(password: String) -> void:
	if login_pending: return
	login_pending=true
	var error := http.request(origin+"/login",PackedStringArray(["Origin: "+origin,"Content-Type: application/x-www-form-urlencoded"]),HTTPClient.METHOD_POST,"password="+password.uri_encode())
	if error!=OK: login_pending=false; message.emit("Could not reach the private server.")

func login_result(result: int,code: int,headers: PackedStringArray,_body: PackedByteArray) -> void:
	login_pending=false
	# The access gate intentionally returns 303. Keep its cookie without downloading
	# the entire browser game; Godot reports a redirect limit when max_redirects is zero.
	if result not in [HTTPRequest.RESULT_SUCCESS,HTTPRequest.RESULT_REDIRECT_LIMIT_REACHED]: message.emit("Connection failed. Check the server address."); return
	if code not in [302,303]: message.emit("Access was not accepted. Check the password and server setup."); return
	for header in headers:
		if header.to_lower().begins_with("set-cookie: milano_access="): cookie=header.substr(12).strip_edges().split(";")[0]
	if cookie.is_empty(): message.emit("The server did not issue test access."); return
	message.emit("Private access accepted.")
	open_socket()

func open_socket() -> void:
	if socket and socket.get_ready_state()!=WebSocketPeer.STATE_CLOSED: socket.close()
	socket=WebSocketPeer.new()
	var headers := PackedStringArray(["Origin: "+origin])
	if cookie: headers.append("Cookie: "+cookie)
	socket.handshake_headers=headers
	active=true; last_state=WebSocketPeer.STATE_CONNECTING
	var error := socket.connect_to_url(origin.replace("https://","wss://").replace("http://","ws://")+"/api/ws")
	if error!=OK: message.emit("Unable to open a race connection."); active=false

func command(action: String,fields: Dictionary = {}) -> void:
	var data := fields.duplicate()
	data.action=action
	if token: data.token=token
	if not socket or socket.get_ready_state()!=WebSocketPeer.STATE_OPEN:
		last_request=data
		if not active: open_socket()
		return
	request_id+=1; data.rid=request_id
	pending[request_id]=Time.get_ticks_msec()
	socket.send_text(JSON.stringify(data))

func create_room(name: String,circuit: String,laps: int) -> void:
	command("create",{"name":name,"circuit":circuit,"laps":laps,"listed":false})

func join_room(name: String,code: String) -> void:
	command("join",{"name":name,"code":code.strip_edges().to_upper()})

func server_now() -> float:
	return Time.get_ticks_msec()+server_offset

func disconnect_room() -> void:
	if socket and socket.get_ready_state()==WebSocketPeer.STATE_OPEN:
		if token: command("leave")
		socket.close(1000,"Leaving room")
	active=false; token=""; room={}; me=""; pending.clear(); last_request={}; reconnect_attempt=0

func _process(dt: float) -> void:
	if not active or not socket: return
	socket.poll()
	var state := socket.get_ready_state()
	if state==WebSocketPeer.STATE_OPEN:
		if last_state!=state:
			reconnect_attempt=0; connected.emit(); message.emit("Connected")
			if token: command("resume")
			elif not last_request.is_empty():
				var data := last_request.duplicate(); last_request={}
				var action: String = data.action; data.erase("action"); command(action,data)
		while socket.get_available_packet_count():
			var parsed = JSON.parse_string(socket.get_packet().get_string_from_utf8())
			if not parsed is Dictionary: continue
			var response: Dictionary = parsed
			var sent: float = pending.get(int(response.get("rid",-1)),Time.get_ticks_msec())
			pending.erase(int(response.get("rid",-1)))
			if response.has("error"):
				message.emit(str(response.error))
				if str(response.error).contains("expired"): token=""; room={}
				continue
			var data: Dictionary = response.get("result",{})
			if data.has("token"): token=data.token
			if data.has("room"):
				var estimate: float = data.serverNow-(sent+Time.get_ticks_msec())*.5
				server_offset=lerpf(server_offset,estimate,.15) if has_server_time else estimate
				has_server_time=true; room=data.room; me=data.me
				snapshot_received.emit(data)
		poll_clock+=dt
		if token and poll_clock>=.0667 and pending.size()<3:
			poll_clock=0
			var fields := {}
			if car and room.get("phase","")=="race": fields.car={"x":car.position.x,"z":car.position.z,"h":car.heading,"v":clampf(car.speed,0,105)}
			command("poll",fields)
		# Do not accumulate requests forever on a stalled connection.
		for id in pending.keys():
			if Time.get_ticks_msec()-float(pending[id])>8000: socket.close(); break
	elif state==WebSocketPeer.STATE_CLOSED:
		if last_state!=state: message.emit("Connection lost. Retrying…")
		retry_clock+=dt
		if retry_clock>minf(8,pow(2,reconnect_attempt)):
			retry_clock=0; reconnect_attempt+=1; pending.clear(); open_socket()
			if reconnect_attempt>5 and token.is_empty(): active=false; message.emit("Server unavailable or private access required.")
	last_state=state
