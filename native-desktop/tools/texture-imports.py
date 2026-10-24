"""Explicit 3D mipmapped imports; headless import cannot infer material usage."""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]/'game/assets'
changed=0
for p in root.rglob('*.import'):
 text=p.read_text();original=text
 if p.name.endswith(('.png.import','.jpg.import','.webp.import','.hdr.import')):
  text=re.sub(r'mipmaps/generate=false','mipmaps/generate=true',text)
  # VRAM compression avoids huge decoded texture allocations on 6 GB GPUs.
  if not p.name.endswith('.hdr.import'):text=re.sub(r'compress/mode=\d+','compress/mode=2',text)
  if 'normal' in p.name or 'nor_gl' in p.name:text=re.sub(r'compress/normal_map=\d+','compress/normal_map=2',text)
 if text!=original:p.write_text(text);changed+=1
print('Updated',changed,'native texture import settings')
