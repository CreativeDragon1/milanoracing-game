"""Apply the banked-shot correction to the separate authoring project only."""
from pathlib import Path
import sys
p=Path(sys.argv[1])/'capture.gd';s=p.read_text()
s=s.replace('var game: Node','var film_min_clearance:=INF\nvar film_max_lift:=0.0\nvar film_surface_samples:=0\nvar game: Node')
s=s.replace('"frames":duration_frames,','"surfaceChecks":{"poses":film_surface_samples,"minimumClearance":film_min_clearance,"maximumLift":film_max_lift},"frames":duration_frames,')
s=s.replace('game.vehicle.rotation=Vector3(-pose.bank,-pose.heading,atan(pose.grade))','game.vehicle.rotation=Vector3(-pose.bank,-pose.heading,atan(pose.grade))\n\tif game.active_id in ["milano","riviera"]:\n\t\tfit_film_surface(game.vehicle,pose,station)\n\t\tpose.position=game.vehicle.position')
s=s.replace('rivals[i].rotation=Vector3(-p.bank,-p.heading,atan(p.grade))','rivals[i].rotation=Vector3(-p.bank,-p.heading,atan(p.grade))\n\t\tif game.active_id in ["milano","riviera"]:fit_film_surface(rivals[i],p,station)')
s+='''
func film_height(x:float,z:float,hint:int)->float:
	var p:Dictionary=game.vehicle.project(Vector3(x,0,z),hint)
	var station:float=p.i+p.fraction
	return Model.sample(game.circuit.elevation.height,station)-p.offset*tan(Model.sample(game.circuit.bank,station))

func fit_film_surface(node:Node3D,p:Dictionary,station:float)->void:
	var forward:=Vector3(cos(p.heading),0,sin(p.heading))
	var right:=Vector3(-forward.z,0,forward.x)
	var x:float=p.position.x;var z:float=p.position.z;var hint:=int(station)
	forward.y=(film_height(x+forward.x*1.6,z+forward.z*1.6,hint)-film_height(x-forward.x*1.6,z-forward.z*1.6,hint))/3.2
	right.y=(film_height(x+right.x*.65,z+right.z*.65,hint)-film_height(x-right.x*.65,z-right.z*.65,hint))/1.3
	forward=forward.normalized();var up:=right.cross(forward).normalized();right=forward.cross(up).normalized()
	node.basis=Basis(forward,up,right);node.position=Vector3(x,film_height(x,z,hint),z)
	var minimum:=INF
	for i in 9:
		for j in 5:
			var q:Vector3=node.transform*Vector3(-2.85+5.7*i/8.0,.025,-.806+1.612*j/4.0)
			minimum=minf(minimum,q.y-film_height(q.x,q.z,hint))
	var lift:=maxf(0,.02-minimum)
	node.position.y+=lift
	film_surface_samples+=1;film_min_clearance=minf(film_min_clearance,minimum+lift);film_max_lift=maxf(film_max_lift,lift)
'''
p.write_text(s)
