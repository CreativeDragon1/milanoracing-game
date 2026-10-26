extends RefCounted
# Keep a bounded background queue. Only completed resources are collected on
# the main thread; never wait inside load_threaded_get for unfinished disk work.
var waiting:Array[String]=[]
var active:Array[String]=[]
var resources:Dictionary={}
var failed:=""

func begin(paths:Array[String]) -> void:
	waiting=paths.duplicate(); active.clear(); resources.clear(); failed=""

func pump() -> void:
	for path in active.duplicate():
		var state:=ResourceLoader.load_threaded_get_status(path)
		if state==ResourceLoader.THREAD_LOAD_LOADED:
			resources[path]=ResourceLoader.load_threaded_get(path)
			active.erase(path)
		elif state in [ResourceLoader.THREAD_LOAD_FAILED,ResourceLoader.THREAD_LOAD_INVALID_RESOURCE]:
			failed=path; active.erase(path)
	while active.size()<2 and not waiting.is_empty() and failed.is_empty():
		var path:String=waiting.pop_front()
		var error:=ResourceLoader.load_threaded_request(path)
		if error!=OK:failed=path;break
		active.append(path)

func complete() -> bool:
	return waiting.is_empty() and active.is_empty() and failed.is_empty()
