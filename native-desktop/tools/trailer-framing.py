"""Raise overly tight film cameras while retaining their validated road corridor."""
from pathlib import Path
import json,math,sys
import numpy as np
ROOT=Path(__file__).resolve().parents[2]

def framing(data,lift=0):
 rows=data['frames'][120:]
 camera=np.array([r['camera'] for r in rows]);camera[:,1]+=lift
 focus=np.array([r['focus'] for r in rows]);forward=focus-camera
 forward/=np.linalg.norm(forward,axis=1)[:,None]
 right=np.cross(forward,np.array([0,1,0]));right/=np.linalg.norm(right,axis=1)[:,None]
 up=np.cross(right,forward)
 basis=np.array([r['cars'][0]['basis'] for r in rows]).reshape(-1,3,3).transpose(0,2,1)
 pos=np.array([r['cars'][0]['position'] for r in rows])
 corners=np.array([[x,y,z] for x in [-2.85,2.85] for y in [0,1.8] for z in [-.95,.95]])
 points=np.einsum('fij,pj->fpi',basis,corners)+pos[:,None]-camera[:,None]
 depth=np.einsum('fpi,fi->fp',points,forward);assert depth.min()>.1
 x=np.abs(np.einsum('fpi,fi->fp',points,right));y=np.abs(np.einsum('fpi,fi->fp',points,up))
 return max(78,math.degrees(2*math.atan(float(np.maximum(y/(depth*.84),x/(depth*(9/16)*.84)).max()))))

reports=[]
for file in sorted((ROOT/'work/mixed-trailer/motion').glob('*.json')):
 data=json.loads(file.read_text());before=framing(data);lift=0.
 while framing(data,lift)>94:
  lift+=.25
  assert lift<=6,(file.name,before)
 after=framing(data,lift)
 if lift and '--apply' in sys.argv:
  backup=ROOT/'work/mixed-trailer/motion-before-framing'/file.name
  backup.parent.mkdir(exist_ok=True)
  if not backup.exists():backup.write_bytes(file.read_bytes())
  for row in data['frames']:row['camera'][1]+=lift
  data['report']['cameraHeightAdjustmentM']=lift
  data['report']['portraitRequiredFov']=after
  file.write_text(json.dumps(data,separators=(',',':')))
 reports.append({'circuit':file.stem,'beforeFov':before,'heightAdjustmentM':lift,'afterFov':after})
(ROOT/'native-desktop/qa/trailer-framing.json').write_text(json.dumps(reports,indent=2))
print(json.dumps(reports,indent=2))
