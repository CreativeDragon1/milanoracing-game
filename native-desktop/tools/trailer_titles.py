"""Editable shot titles, individually laid out for the two trailer formats."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import json

N=Path(__file__).resolve().parents[1]
COPY={
 'milano':('MILANO AUTODROMO','DOWNLOAD FOR WINDOWS','THE DESKTOP GAME'),
 'singapore':('SINGAPORE','PLAY IN YOUR BROWSER','NO INSTALL REQUIRED'),
 'monaco':('MONACO','RACE 14 CIRCUITS','REAL VENUES & ORIGINAL TRACKS'),
 'monza':('MONZA','RACE A 22-CAR GRID','21 AI RIVALS'),
 'bahrain':('BAHRAIN','CHOOSE YOUR PIT STRATEGY','TYRE CHOICE & PIT STOPS'),
 'spa':('SPA-FRANCORCHAMPS','',''),
 'austria':('AUSTRIA','QUALIFY FOR THE GRID','Q1 · Q2 · Q3'),
 'silverstone':('SILVERSTONE','KEYBOARD OR CONTROLLER','PLAYSTATION & XBOX SUPPORT'),
 'abu-dhabi':('YAS MARINA','RACE YOUR FRIENDS','PRIVATE ONLINE ROOMS'),
 'suzuka':('SUZUKA','',''),
 'interlagos':('INTERLAGOS','CHOOSE YOUR DIFFICULTY','ROOKIE · CLUB · PRO · ELITE'),
 'zandvoort':('ZANDVOORT','',''),
 'riviera':('MILANO RIVIERA','RACE OUR ORIGINAL TRACKS','MILANO AUTODROMO · RIVIERA · SOLARA'),
 'solara':('MILANO SOLARA','',''),
}
# Each shot has its own anchor and alignment. Y is the top edge; X is the
# alignment edge. Both remain inside platform-safe margins.
LAYOUT={
 'landscape':[(.065,.19,'left'),(.935,.69,'right'),(.07,.73,'left'),(.92,.21,'right'),(.085,.18,'left'),(.91,.75,'right'),(.06,.68,'left'),(.10,.19,'left'),(.93,.70,'right'),(.08,.74,'left'),(.915,.20,'right'),(.92,.76,'right'),(.07,.21,'left'),(.11,.72,'left')],
 'reel':[(.09,.19,'left'),(.88,.715,'right'),(.12,.235,'left'),(.87,.205,'right'),(.09,.69,'left'),(.88,.235,'right'),(.13,.185,'left'),(.865,.745,'right'),(.10,.70,'left'),(.085,.225,'left'),(.88,.18,'right'),(.86,.755,'right'),(.10,.215,'left'),(.11,.24,'left')]
}

def create(fmt,shots,out,width,height):
 rows=[]
 for index,shot in enumerate(shots):
  ident=shot['id'];track,headline,detail=COPY[ident];ax,ay,align=LAYOUT[fmt][index]
  size=round(width*(.058 if fmt=='reel' else .029));small=round(size*(.49 if fmt=='reel' else .46))
  font=lambda name,s:ImageFont.truetype(str(N/'game/assets/fonts'/name),s)
  bold=font('Michroma.ttf',size);label=font('Michroma.ttf',small)
  max_width=width*(.77 if fmt=='reel' else .42)
  while headline and bold.getlength(headline)>max_width:size-=1;bold=font('Michroma.ttf',size)
  while max(label.getlength(track),label.getlength(detail))>max_width:small-=1;label=font('Michroma.ttf',small)
  lines=[(track,label,(215,224,236,255))]
  if headline:lines.extend([(headline,bold,(255,255,255,255)),(detail,label,(255,122,0,255))])
  else:
   face=font('Michroma.ttf',round(size*.85))
   while face.getlength(track)>max_width:size-=1;face=font('Michroma.ttf',round(size*.85))
   lines=[(track,face,(255,255,255,255))]
  pad=round(width*.013);gap=round(height*.006)
  tw=round(max(f.getlength(t) for t,f,c in lines))+pad*2
  heights=[f.getbbox(t)[3]-f.getbbox(t)[1] for t,f,c in lines];th=sum(heights)+gap*(len(lines)-1)+pad*2+8
  image=Image.new('RGBA',(tw,th));shadow=Image.new('RGBA',(tw,th));sd=ImageDraw.Draw(shadow)
  # Follow the letterforms with the shadow instead of putting footage in a box.
  y=pad+10;x=pad if align=='left' else tw-pad
  for (text,face,color),h in zip(lines,heights):
   box=face.getbbox(text);tx=x if align=='left' else x-face.getlength(text)
   sd.text((tx+1,y-box[1]),text,font=face,fill=(0,3,10,245),stroke_width=2,stroke_fill=(0,3,10,210));y+=h+gap
  image.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(3)))
  draw=ImageDraw.Draw(image);y=pad+8
  x=pad if align=='left' else tw-pad
  for (text,face,color),h in zip(lines,heights):
   box=face.getbbox(text);tx=x if align=='left' else x-face.getlength(text)
   draw.text((tx,y-box[1]),text,font=face,fill=color);y+=h+gap
  path=out/(ident+'-title.png');image.save(path)
  px=round(width*ax)-(tw if align=='right' else 0);py=round(height*ay)
  assert 0<=px and px+tw<width and py+th<height*.88,(ident,px,py,tw,th)
  rows.append({'circuit':ident,'file':str(path),'font':'Michroma','text':[v[0] for v in lines],'position':[px,py],'size':[tw,th],'align':align,'enter':.32,'exit':shot['seconds']-.65})
 (out/'titles.json').write_text(json.dumps(rows,indent=2))
 return rows
