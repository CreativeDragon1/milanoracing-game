extends RefCounted
# CPU copy is retained because the headless asset builder has no GPU storage.
static func write(buffer: PackedFloat32Array, at: int, t: Transform3D, color: Color = Color.WHITE, colors: bool = false) -> void:
	var values := [t.basis.x.x,t.basis.y.x,t.basis.z.x,t.origin.x,t.basis.x.y,t.basis.y.y,t.basis.z.y,t.origin.y,t.basis.x.z,t.basis.y.z,t.basis.z.z,t.origin.z]
	for i in 12: buffer[at+i]=values[i]
	if colors:
		buffer[at+12]=color.r; buffer[at+13]=color.g; buffer[at+14]=color.b; buffer[at+15]=color.a

static func restore(node: Node) -> int:
	var count := 0
	if node is MultiMeshInstance3D and node.has_meta("gpu_buffer"):
		node.multimesh.buffer=node.get_meta("gpu_buffer")
		count=node.multimesh.instance_count
	for child in node.get_children(): count+=restore(child)
	return count

# Static visibility bounds are computed offline, avoiding runtime rescans after
# buffer upload. A small margin retains the complete foliage silhouette.
static func prepare_bounds(node:Node) -> void:
	if node is MultiMeshInstance3D and node.has_meta("gpu_buffer"):
		var f:PackedFloat32Array=node.get_meta("gpu_buffer")
		var stride:=16 if node.multimesh.use_colors else 12
		var base:AABB=node.multimesh.mesh.get_aabb()
		var bounds:=AABB()
		for i in node.multimesh.instance_count:
			var j:int=i*stride
			var t:=Transform3D(Basis(Vector3(f[j],f[j+4],f[j+8]),Vector3(f[j+1],f[j+5],f[j+9]),Vector3(f[j+2],f[j+6],f[j+10])),Vector3(f[j+3],f[j+7],f[j+11]))
			var box:AABB=t*base
			bounds=box if i==0 else bounds.merge(box)
		node.multimesh.custom_aabb=bounds.grow(.25)
	for child in node.get_children(): prepare_bounds(child)
