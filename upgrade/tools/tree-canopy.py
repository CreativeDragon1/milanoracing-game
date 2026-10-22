"""Render CC0 tree LOD textures and retain the original canopy distribution.
No supplied branding is touched. Far cards are renders of the source 3D tree.
"""
import bpy, math, json, random, array, base64
from pathlib import Path
from mathutils import Vector
U=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(U/'assets/tree-small-02/tree.gltf'))
obj=next(o for o in bpy.context.scene.objects if o.type=='MESH');mesh=obj.data;mesh.calc_loop_triangles()
leaf_index=next(i for i,m in enumerate(mesh.materials) if 'leaves' in m.name)
leaf_faces=[p for p in mesh.polygons if p.material_index==leaf_index]
data=json.loads((U/'src/tree-model.json').read_text(encoding='utf-8'))
rng=random.Random(926)
chosen=rng.sample(leaf_faces,8000)
for level,count,size in [('near',8000,.12),('middle',1800,.23)]:
 positions=array.array('f');normals=array.array('f');uvs=array.array('f')
 for face in chosen[:count]:
  centre=sum((mesh.vertices[i].co for i in face.vertices),Vector())/len(face.vertices)
  normal=face.normal.normalized();axis=normal.cross(Vector((0,0,1)))
  if axis.length<.1:axis=normal.cross(Vector((0,1,0)))
  axis.normalize();vertical=normal.cross(axis).normalized();scale=size*(.75+rng.random()*.65)
  # A complete, six-sided leaf avoids the collapse-decimator's needle fragments.
  shape=[(-1,0),(-.5,-.48),(.55,-.4),(1,0),(.55,.45),(-.5,.5)]
  for tri in [(0,1,2),(0,2,3),(0,3,4),(0,4,5)]:
   for i in tri:
    x,y=shape[i];v=obj.matrix_world@(centre+axis*x*scale+vertical*y*scale)
    n=obj.matrix_world.to_3x3()@normal;n.normalize()
    positions.extend((v.x,v.z,-v.y));normals.extend((n.x,n.z,-n.y))
    # One real photographed leaf from the original CC0 leaf atlas.
    uvs.extend((.523+(x+1)*.0918,1-(.476+(y+.5)*.104)))
 part={'material':'tree_small_02_leaves','positions':base64.b64encode(positions.tobytes()).decode(),'normals':base64.b64encode(normals.tobytes()).decode(),'uv':base64.b64encode(uvs.tobytes()).decode(),'triangles':len(positions)//9}
 data[level]=[p for p in data[level] if 'leaves' not in p['material']]+[part]
 print(level,part['triangles'],flush=True)
(U/'src/tree-model.json').write_text(json.dumps(data,separators=(',',':')),encoding='utf-8')
# Full source tree becomes transparent distant LOD, rather than cones/spheres.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True
scene.render.resolution_x=768;scene.render.resolution_y=768;scene.render.resolution_percentage=100;scene.render.film_transparent=True
scene.world=bpy.data.worlds.new('Soft daylight');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.76,1,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
bpy.ops.object.light_add(type='AREA',location=(4,-6,12));bpy.context.object.data.energy=900;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=10
bounds=[obj.matrix_world@Vector(c) for c in obj.bound_box];lo=Vector(tuple(min(v[i] for v in bounds) for i in range(3)));hi=Vector(tuple(max(v[i] for v in bounds) for i in range(3)));centre=(lo+hi)/2
bpy.ops.object.camera_add();camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=max(hi-lo)*1.08;data['canopyScale']=camera.data.ortho_scale/(hi.z-lo.z);(U/'src/tree-model.json').write_text(json.dumps(data,separators=(',',':')),encoding='utf-8');scene.camera=camera
scene.view_settings.view_transform='AgX'
out=U/'assets/tree-small-02';out.mkdir(exist_ok=True)
for i in range(2):
 angle=i*math.pi/2;camera.location=centre+Vector((math.cos(angle)*20,math.sin(angle)*20,0));camera.rotation_euler=(centre-camera.location).to_track_quat('-Z','Y').to_euler()
 scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.filepath=str(out/f'canopy-{i}.png');bpy.ops.render.render(write_still=True)
 print('Rendered',scene.render.filepath,flush=True)
