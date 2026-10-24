"""Apply the approved inner-sidepod decal removal without editing source artwork."""
import base64
import json
import struct
import hashlib
from pathlib import Path


def game_car(source):
    car = json.loads(source.read_text(encoding='utf-8'))
    body = next(part for part in car['parts'] if part['name'] == 'body')
    original = base64.b64decode(body['data'])
    edited = bytearray(original)
    assets=Path(__file__).resolve().parent/'assets/livery'
    manifest=json.loads((assets/'manifest.json').read_text(encoding='utf-8'))
    assert hashlib.sha256(original).hexdigest()==manifest['sourceBodySHA256']
    designer=(assets/'designer-uv.bin').read_bytes()
    assert len(designer)==body['count']*8
    for i in range(body['count']):edited[i*32+24:i*32+32]=designer[i*8:i*8+8]
    # The two inward-facing CAD panels have separate UV islands. Identify the same inward-facing panels using the original UV layout.
    # Their new UVs sample plain white from the supplied designer artwork.
    islands = [(1136, 533, 1156, 781), (950, 12, 970, 509)]
    neutral = manifest['innerNeutralUV']
    counts = [0, 0]
    for triangle in range(body['count'] // 3):
        start = triangle * 3 * 8 * 4
        vertices = [struct.unpack_from('<8f', original, start + i * 32) for i in range(3)]
        for island, (x0, y0, x1, y1) in enumerate(islands):
            if not all(x0 <= v[6] * 2048 <= x1 and y0 <= v[7] * 2048 <= y1 for v in vertices):
                continue
            assert all(v[2] * v[5] < 0 for v in vertices), 'Expected inward-facing sidepod panel'
            for i in range(3):
                struct.pack_into('<2f', edited, start + i * 32 + 24, *neutral)
            counts[island] += 1
    assert counts == [9, 15], f'Inner sidepod UV layout changed: {counts}'
    body['data'] = base64.b64encode(edited).decode('ascii')
    car['liveryRevision'] = manifest['revision']
    return json.dumps(car, separators=(',', ':'))
