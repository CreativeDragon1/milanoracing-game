extends RefCounted

static func lap(seconds:float) -> String:
	if not is_finite(seconds):return "—"
	var ms:=maxi(0,roundi(seconds*1000))
	return "%d:%02d.%03d" % [int(ms/60000),int(ms/1000)%60,ms%1000]

static func countdown(seconds:float) -> String:
	var whole:=maxi(0,ceili(seconds))
	return "%02d:%02d" % [int(whole/60),whole%60]
