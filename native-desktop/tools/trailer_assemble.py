"""Bounded-memory film assembly with an explicit 60 Hz timeline.

Only the two sides of one dissolve are resident. Avoid nested framesync graphs
and their EOF stalls; each source is decoded once and the final is encoded once.
"""
from pathlib import Path
import math
import subprocess
from PIL import Image


def assemble(plan, folder, output, titles, width, height, preview=False):
    fps = 60
    total = round(plan['duration'] * fps)
    overlaps = [round(s['transition'] * fps) for s in plan['shots']]
    offsets = [round(t * fps) - n // 2 for t, n in zip(plan['cuts'], overlaps)]
    starts = [0] + offsets
    ends = [t + n for t, n in zip(offsets, overlaps)] + [total]
    corner = Image.open(folder / 'corner.png').convert('RGBA')
    corner_box = corner.getbbox()
    corner = corner.crop(corner_box)
    end_card = Image.open(folder / 'end.png').convert('RGB')
    black = Image.new('RGB', (width, height))
    temporary = output.with_name(output.stem + '.encoding.mp4')
    audio = (f'atrim=duration={total/fps},asetpts=PTS-STARTPTS,'
             f'afade=t=in:d=0.25,afade=t=out:st={total/fps-1.5}:d=1.5,'
             'volume=.85,alimiter=limit=.89:level=0')
    log = (folder / 'assembly.log').open('w', encoding='utf-8')
    command = ['ffmpeg', '-v', 'error', '-y', '-progress', str(folder/'encode-progress.txt'),
               '-stats_period', '2', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
               '-s', f'{width}x{height}', '-r', str(fps), '-i', 'pipe:0',
               '-ss', str(plan['musicStart']), '-i', plan['music'],
               '-map', '0:v', '-map', '1:a', '-frames:v', str(total), '-t', str(total/fps),
               '-c:v', 'libx264', '-threads', '4', '-crf', '16',
               '-preset', 'ultrafast' if preview else 'slow', '-pix_fmt', 'yuv420p',
               '-filter_threads', '1', '-af', audio, '-c:a', 'aac', '-b:a', '256k',
               '-movflags', '+faststart', str(temporary)]
    encoder = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=log)
    emitted = 0
    pending = []

    def emit(frame):
        nonlocal emitted
        strength = min(1., emitted / (fps * .18), (total-1-emitted) / (fps * .7))
        if strength < 1:
            frame = Image.blend(black, frame, max(0., strength))
        encoder.stdin.write(frame.tobytes())
        emitted += 1
        if emitted % 600 == 0:
            print(f'ASSEMBLING {folder.name}: {emitted}/{total} frames', flush=True)

    try:
        for index in range(15):
            count = ends[index] - starts[index]
            incoming = overlaps[index-1] if index else 0
            outgoing = overlaps[index] if index < 14 else 0
            tail = []
            decoder = None
            title = None
            if index < 14:
                shot = plan['shots'][index]
                spec = titles[index]
                title = Image.open(spec['file']).convert('RGBA')
                decoder = subprocess.Popen([
                    'ffmpeg', '-v', 'error', '-threads', '1', '-i', str(folder/(shot['id']+'.mp4')),
                    '-frames:v', str(count), '-vf', f'scale={width}:{height}:flags=lanczos',
                    '-threads', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'],
                    stdout=subprocess.PIPE, stderr=log)
            try:
                for local in range(count):
                    if decoder:
                        raw = decoder.stdout.read(width*height*3)
                        if len(raw) != width*height*3:
                            raise RuntimeError(f'Short capture {shot["id"]}: {local}/{count}')
                        frame = Image.frombytes('RGB', (width,height), raw)
                        frame.paste(corner, corner_box[:2], corner)
                        time = local / fps
                        opacity = min(1., max(0., (time-spec['enter'])/.22),
                                      max(0., (spec['exit']+.18-time)/.18))
                        if opacity > 0:
                            layer = title if opacity == 1 else title.copy()
                            if opacity != 1:
                                layer.putalpha(title.getchannel('A').point(lambda v: round(v*opacity)))
                            direction = -1 if spec['align']=='left' else 1
                            slide = direction*22*max(0., 1-(time-spec['enter'])/.34)**3
                            frame.paste(layer, (round(spec['position'][0]+slide),spec['position'][1]),layer)
                    else:
                        frame = end_card.copy()
                    if local < incoming:
                        # Both endpoints are exact; no one-frame cut at a dissolve boundary.
                        frame = Image.blend(pending[local], frame, local/max(1,incoming-1))
                    if local >= count-outgoing:
                        tail.append(frame)
                    else:
                        emit(frame)
            finally:
                if decoder:
                    decoder.stdout.close()
                    if decoder.wait(timeout=30) != 0:
                        raise RuntimeError(f'Decode failed: {shot["id"]}; see {folder/"assembly.log"}')
            pending = tail
        assert emitted == total, (emitted, total)
        encoder.stdin.close()
        if encoder.wait(timeout=180) != 0:
            raise RuntimeError(f'Encode failed; see {folder/"assembly.log"}')
        temporary.replace(output)
    except BaseException:
        encoder.kill()
        encoder.wait()
        raise
    finally:
        log.close()
