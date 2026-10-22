extends Node3D
# Supplemental event-lighting layout. These reconstructed fixtures are not surveyed assets.
var lamps: Array[SpotLight3D] = []
func configure(track: Dictionary) -> void:
	var cylinder := CylinderMesh.new()
	cylinder.top_radius = .11
	cylinder.bottom_radius = .22
	cylinder.height = 14
	cylinder.radial_segments = 12
	var metal := StandardMaterial3D.new()
	metal.albedo_color = Color(.28,.3,.32)
	metal.metallic = .65
	metal.roughness = .48
	cylinder.material = metal
	var fixture := BoxMesh.new()
	fixture.size = Vector3(2.4,.18,1.1)
	var glow := StandardMaterial3D.new()
	glow.albedo_color = Color(.9,.94,1)
	glow.emission_enabled = true
	glow.emission = Color(.8,.89,1)
	glow.emission_energy_multiplier = 3
	fixture.material = glow
	var poles: Array[Transform3D] = []
	var heads: Array[Transform3D] = []
	var stride := maxi(1,roundi(42.0/(float(track.length)/float(track.N))))
	for i in range(0,int(track.N),stride):
		var side := 1.0 if (i/stride)%2==0 else -1.0
		var half: float = track.widthRight[i] if side>0 else track.widthLeft[i]
		var runoff: float = track.runoffRight[i] if side>0 else track.runoffLeft[i]
		var offset := side*(half+runoff+2.5)
		var h := float(track.elevation.height[i])-offset*tan(float(track.bank[i]))
		var pos := Vector3(float(track.x[i])-float(track.tz[i])*offset,h,float(track.z[i])+float(track.tx[i])*offset)
		poles.append(Transform3D(Basis.IDENTITY,pos+Vector3.UP*7))
		var top := pos+Vector3.UP*14
		heads.append(Transform3D(Basis(Vector3.UP,-atan2(track.tz[i],track.tx[i])),top))
		var light := SpotLight3D.new()
		light.position = top-Vector3.UP*.15
		light.light_color = Color(.90,.95,1)
		light.light_energy = 55
		light.spot_range = 115
		light.spot_angle = 72
		light.spot_attenuation = 1.0
		light.distance_fade_enabled = true
		light.distance_fade_begin = 180
		light.distance_fade_length = 60
		add_child(light)
		light.look_at(Vector3(track.x[i],track.elevation.height[i],track.z[i]),Vector3.FORWARD)
		lamps.append(light)
	for pair in [[cylinder,poles],[fixture,heads]]:
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = pair[0]
		mm.instance_count = pair[1].size()
		for i in pair[1].size(): mm.set_instance_transform(i,pair[1][i])
		var node := MultiMeshInstance3D.new()
		node.multimesh = mm
		node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(node)
