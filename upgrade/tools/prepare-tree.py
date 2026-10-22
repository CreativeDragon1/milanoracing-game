import bpy,json,base64,array
from pathlib import Path
from mathutils import Vector
U=Path(__file__).resolve().parents[1];bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(U/'assets/tree-small-02/tree.gltf'))
obj=bpy.context.selected_objects[0];bpy.context.view_layer.objects.active=obj;bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='MATERIAL');bpy.ops.object.mode_set(mode='OBJECT')
objects=[o for o in bpy.context.scene.objects if o.type=='MESH'];out={}
for level in ['near','middle']:
 pieces=[]
 for source in objects:
  obj=source.copy();obj.data=source.data.copy();bpy.context.collection.objects.link(obj);mat=obj.data.materials[0].name;ratio=(.008 if 'leaves' in mat else .05) if level=='near' else (.0018 if 'leaves' in mat else .018)
  mod=obj.modifiers.new('Realtime geometry','DECIMATE');mod.ratio=ratio;mod.use_collapse_triangulate=True
  dg=bpy.context.evaluated_depsgraph_get();evaluated=obj.evaluated_get(dg);mesh=evaluated.to_mesh();mesh.calc_loop_triangles();positions=array.array('f');normals=array.array('f');uvs=array.array('f');uv=mesh.uv_layers.active.data if mesh.uv_layers.active else None;matrix=obj.matrix_world;normalMatrix=matrix.to_3x3().inverted().transposed()
  for tri in mesh.loop_triangles:
   for li in tri.loops:
    loop=mesh.loops[li];v=matrix@mesh.vertices[loop.vertex_index].co;normal=normalMatrix@mesh.corner_normals[li].vector;normal.normalize();positions.extend([v.x,v.z,-v.y]);normals.extend([normal.x,normal.z,-normal.y]);tex=uv[li].uv if uv else (0,0);uvs.extend(tex)
  pieces.append({'material':mat,'positions':base64.b64encode(positions.tobytes()).decode(),'normals':base64.b64encode(normals.tobytes()).decode(),'uv':base64.b64encode(uvs.tobytes()).decode(),'triangles':len(positions)//9});print(level,mat,len(positions)//9,flush=True);evaluated.to_mesh_clear();bpy.data.objects.remove(obj,do_unlink=True)
 out[level]=pieces
(U/'src/tree-model.json').write_text(json.dumps(out,separators=(',',':')),encoding='utf-8')
