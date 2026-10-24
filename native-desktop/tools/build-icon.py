"""Fit the supplied Milano mark into transparent, borderless app icons."""
from pathlib import Path
from PIL import Image
import json

N = Path(__file__).resolve().parents[1]
source = Image.open(N / 'game/assets/team-logo.png').convert('RGBA')
source = source.crop(source.getchannel('A').getbbox())
source.save(N / 'game/assets/team-logo-fit.png')
icon = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
mark = source.copy()
mark.thumbnail((476, 476), Image.Resampling.LANCZOS)
icon.alpha_composite(mark, ((512 - mark.width) // 2, (512 - mark.height) // 2))
icon.save(N / 'game/assets/app-icon.png')
sizes = [(s, s) for s in [16, 24, 32, 48, 64, 128, 256]]
icon.save(N / 'game/assets/app-icon.ico', sizes=sizes)
ico = Image.open(N / 'game/assets/app-icon.ico')
assert ico.ico.sizes() == set(sizes)
assert icon.getpixel((0, 0))[3] == 0
assert icon.getchannel('A').getbbox()[0] >= 16
(N / 'qa/icon.json').write_text(json.dumps({'border': False, 'background': 'transparent', 'source': 'Original supplied Milano logo', 'sizes': sizes, 'bounds': icon.getchannel('A').getbbox()}, indent=2))
print('Borderless original logo fitted; all seven Windows icon sizes verified.')
