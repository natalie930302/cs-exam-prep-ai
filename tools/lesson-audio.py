# Read a chapter's 自製課 aloud ahead of time: one mp3 per part (the whole
# part in one go, so the sentences flow), plus where each line starts.
#   python tools/lesson-audio.py ds-1 [--voice zh-TW-HsiaoChenNeural] [--rate +8%] [--force]
# Writes public/lessons/audio/<ch>/<part>.mp3 and times.json
# ({voice, parts: [{file, dur, starts: [sec per line]}]}). Like the subtitles,
# the audio is not in git: it is deployed from this machine.
import asyncio, json, re, sys, hashlib, subprocess
from pathlib import Path
import edge_tts

ROOT = Path(__file__).resolve().parent.parent
args = sys.argv[1:]
ch = args[0]
opt = lambda k, d: args[args.index(k) + 1] if k in args else d
VOICE, RATE, FORCE = opt('--voice', 'zh-TW-HsiaoChenNeural'), opt('--rate', '+8%'), '--force' in args

lesson = json.loads((ROOT / 'public/lessons' / (ch + '.json')).read_text(encoding='utf-8'))
out = ROOT / 'public/lessons/audio' / ch
out.mkdir(parents=True, exist_ok=True)
old = {}
if (out / 'times.json').exists():
    old = {p['hash']: p for p in json.loads((out / 'times.json').read_text(encoding='utf-8'))['parts'] if 'hash' in p}

def spoken(line):
    t = (line.get('read') or line['say']).replace('[[', '').replace(']]', '').strip()
    # every line ends a sentence, so each one gets its own start time
    return t if re.search(r'[。！？!?…]$', t) else t.rstrip('，,、；;：:') + '。'

# speech needs far less than the voice's 48 kbit/s: 32 kbit/s keeps it clear
# at two thirds of the size (needs pip install imageio-ffmpeg; skipped without it)
def shrink(f):
    try: import imageio_ffmpeg
    except ImportError: return
    tmp = f.with_suffix('.tmp.mp3')
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-loglevel', 'error', '-i', str(f), '-ac', '1', '-ar', '24000', '-b:a', '32k', str(tmp)], check=True)
    tmp.replace(f)

norm = lambda s: re.sub(r'[\s，。！？、；：「」『』（）()…,.!?;:"\'—-]', '', s)

async def part(i, p):
    texts = [spoken(l) for l in p['lines']]
    h = hashlib.sha1(('|'.join(texts) + VOICE + RATE).encode()).hexdigest()[:12]
    name = '%02d.mp3' % (i + 1)
    if not FORCE and h in old and (out / name).exists():
        return dict(old[h], file=name)
    audio = bytearray(); bounds = []
    async for c in edge_tts.Communicate(''.join(texts), VOICE, rate=RATE, boundary='SentenceBoundary').stream():
        if c['type'] == 'audio': audio += c['data']
        elif c['type'] == 'SentenceBoundary': bounds.append((c['offset'] / 1e7, norm(c['text'])))
    (out / name).write_bytes(audio)
    shrink(out / name)
    # which line each sentence begins in: walk the lines' text in order
    flat = ''.join(norm(t) for t in texts)
    edges, at = [], 0
    for t in texts: edges.append(at); at += len(norm(t))
    starts = [None] * len(texts); cur = 0
    for off, t in bounds:
        k = flat.find(t[:12], cur) if t else -1
        if k < 0: continue
        cur = k + 1
        li = max(j for j, e in enumerate(edges) if e <= k)
        if starts[li] is None: starts[li] = round(off, 2)
    # a line with no sentence of its own starts where the one before it did
    for j in range(len(starts)):
        if starts[j] is None: starts[j] = starts[j - 1] if j else 0
    dur = len(audio) / 6000  # 48 kbit/s mono mp3
    print('%s  %d lines  %.0fs' % (name, len(texts), dur), flush=True)
    return {'file': name, 'dur': round(dur, 2), 'starts': starts, 'hash': h}

async def main():
    parts = []
    for i, p in enumerate(lesson['parts']):
        for attempt in range(3):
            try: parts.append(await part(i, p)); break
            except Exception as e:
                print('retry', i + 1, e, flush=True)
                if attempt == 2: raise
                await asyncio.sleep(3)
    keep = {p['file'] for p in parts}
    for f in out.glob('*.mp3'):
        if f.name not in keep: f.unlink()
    (out / 'times.json').write_text(json.dumps({'voice': VOICE, 'rate': RATE, 'parts': parts}, ensure_ascii=False, indent=1), encoding='utf-8')
    # the study room looks for the audio only where the index says it exists
    ix_path = ROOT / 'public/lessons/index.json'
    ix = json.loads(ix_path.read_text(encoding='utf-8')) if ix_path.exists() else {}
    ix[ch] = dict(ix.get(ch) or {}, audio=True)
    ix_path.write_text(json.dumps(ix, ensure_ascii=False) + '\n', encoding='utf-8')
    print('total %.1f min' % (sum(p['dur'] for p in parts) / 60))

asyncio.run(main())
