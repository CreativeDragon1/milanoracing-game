import bpy,json
from pathlib import Path
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(Path('upgrade/assets/tree-small-02/tree.gltf').resolve()))
for o in bpy.context.scene.objects:
 if o.type=='MESH':
  m=o.data
  print('TREE',len(m.vertices),len(m.polygons),[(i,x.name) for i,x in enumerate(m.materials)],flush=True)
  from collections import Counter
  print('POLYS',Counter(p.material_index for p in m.polygons),flush=True)
