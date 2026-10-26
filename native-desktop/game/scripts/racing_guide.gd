extends MultiMeshInstance3D
var track: Dictionary
var car: Node3D
var timer:=0.0
var prepared:=PackedFloat32Array()
var upload:=PackedFloat32Array()
var last_station:=-1
func configure(t: Dictionary,v: Node3D) -> void:
	track=t; car=v
	physics_interpolation_mode=Node.PHYSICS_INTERPOLATION_MODE_OFF
	var st:=SurfaceTool.new(); st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for p in [Vector3(-.38,0,-.65),Vector3(0,0,.6),Vector3(.38,0,-.65)]: st.add_vertex(p)
	st.generate_normals()
	var mesh:=st.commit()
	var mat:=StandardMaterial3D.new(); mat.vertex_color_use_as_albedo=true; mat.shading_mode=BaseMaterial3D.SHADING_MODE_UNSHADED; mat.cull_mode=BaseMaterial3D.CULL_DISABLED
	mesh.surface_set_material(0,mat)
	multimesh=MultiMesh.new(); multimesh.transform_format=MultiMesh.TRANSFORM_3D; multimesh.use_colors=true; multimesh.mesh=mesh; multimesh.instance_count=65
	cast_shadow=GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	prepared.resize(int(track.N)*16); upload.resize(65*16)
	for i in int(track.N):
		var j:int=(i+1)%int(track.N)
		var off:float=track.line.offset[i]
		var pos:=Vector3(track.line.x[i],track.elevation.height[i]-off*tan(track.bank[i])+.035,track.line.z[i])
		var heading:=atan2(track.line.z[j]-track.line.z[i],track.line.x[j]-track.line.x[i])
		var accel:float=(pow(track.line.speed[j],2)-pow(track.line.speed[i],2))/(2*maxf(.1,track.line.ds[i]))
		var color:=Color("ff433c") if accel < -2 else Color("ffae31") if accel < -.15 else Color("50dd86")
		preload("res://scripts/instance_buffers.gd").write(prepared,i*16,Transform3D(Basis.from_euler(Vector3(-track.bank[i],-heading+PI/2,atan(track.elevation.grade[i]))),pos),color,true)
func _process(dt: float) -> void:
	if not visible or not is_instance_valid(car): return
	timer+=dt
	if timer<.08: return
	timer=0
	if car.idx==last_station:return
	last_station=car.idx
	for k in 65:
		var i:=posmod(car.idx+k-4,int(track.N))
		for component in 16:upload[k*16+component]=prepared[i*16+component]
	multimesh.buffer=upload
