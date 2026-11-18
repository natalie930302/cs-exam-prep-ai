// Writes public/handouts/links.json: for each 講義 section (## heading), the
// place in the chapter's scheduled videos (the subject's main teacher,
// MAIN_TEACHERS) that teaches it, so the handout can offer 「看這段影片」.
// Matching is by shared words: the section's heading and first lines against
// each note section's title and points (public/notes/<video>.json).
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const site = {};
vm.createContext(site);
for (const f of ['video-order.js', 'data.js', 'chapter-core.js']) {
  vm.runInContext(readFileSync(join(ROOT, f), 'utf8').replace(/^const (\w+)\s*=/mg, 'var $1 ='), site);
}

// English words and Chinese character pairs; very common ones carry no signal
const STOP = new Set(['the', 'of', 'and', 'to', 'is', 'in', 'a', 'an', 'on', 'for', 'it', 'be', 'as', 'or',
  '一個', '這個', '就是', '我們', '可以', '什麼', '怎麼', '如果', '所以', '因為', '還是', '時候', '不是', '的是']);
function words(text) {
  const out = new Set();
  const t = String(text).toLowerCase();
  for (const w of t.match(/[a-z][a-z0-9+\-']{1,}/g) || []) if (!STOP.has(w)) out.add(w);
  for (const run of t.match(/[一-鿿]+/g) || []) {
    for (let i = 0; i + 1 < run.length; i++) { const b = run.slice(i, i + 2); if (!STOP.has(b)) out.add(b); }
  }
  return out;
}
function score(a, b) {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n / Math.sqrt(a.size * b.size || 1);
}
const SKIP = /^(學完這章要會|重點整理|名詞對照)/;

const out = {};
const dir = join(ROOT, 'handouts');
for (const f of readdirSync(dir).filter((x) => /^[a-z]+-\d+\.md$/.test(x))) {
  const ch = f.slice(0, -3);
  const [subj, n] = [ch.split('-')[0], Number(ch.split('-')[1])];
  const subject = site.SUBJECTS.find((s) => s.id === subj);
  const chapter = subject && subject.chapters[n - 1];
  if (!chapter) continue;
  // the note sections of the scheduled videos, in teaching order
  const targets = [];
  for (const m of site.scheduledMaterials(subj, chapter)) {
    const p = join(ROOT, 'notes', m.videoId + '.json');
    if (!m.videoId || !existsSync(p)) continue;
    const note = JSON.parse(readFileSync(p, 'utf8'));
    for (const sec of note.sections || []) {
      const t = sec.points && sec.points.length ? sec.points[0].t : sec.t;
      if (t == null) continue;
      targets.push({ v: m.videoId, t: Math.max(0, Math.floor(t)), label: m.text, title: sec.title,
        w: words(sec.title + ' ' + sec.title + ' ' + (sec.points || []).map((x) => x.text).join(' ')) });
    }
  }
  if (!targets.length) continue;
  const md = readFileSync(join(dir, f), 'utf8').replace(/\r/g, '');
  const parts = md.split(/^## /m).slice(1);
  const links = {};
  for (const part of parts) {
    const head = part.split('\n')[0].trim();
    if (SKIP.test(head)) continue;
    const body = part.split('\n').slice(1).join(' ').replace(/```[\s\S]*?```/g, ' ').slice(0, 600);
    const w = words(head + ' ' + head + ' ' + head + ' ' + body);
    let best = null;
    for (const tg of targets) {
      const s = score(w, tg.w);
      if (!best || s > best.s) best = { s, tg };
    }
    if (best && best.s >= 0.12) links[head] = { v: best.tg.v, t: best.tg.t, label: best.tg.label, sec: best.tg.title };
  }
  out[ch] = links;
}
writeFileSync(join(dir, 'links.json'), JSON.stringify(out) + '\n');
const total = Object.values(out).reduce((a, l) => a + Object.keys(l).length, 0);
console.log(Object.keys(out).length + ' 章、' + total + ' 個小節有對應影片');
