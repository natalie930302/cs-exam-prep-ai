// Full-text search over notes and subtitles, shared by the site's /api/search
// and the Claude connector (mcp.js).
const path = require('node:path');
const fs = require('node:fs');

const PUBLIC_DIR = path.join(__dirname, 'public');
// Built once (lazily) from public/notes and public/transcripts; each hit is
// a video id + second, so the page can open the study room right there.
let SEARCH_INDEX = null;
let KEYMAP = null;
function buildSearchIndex() {
  const rows = [];
  const read = (dir) => { try { return fs.readdirSync(path.join(PUBLIC_DIR, dir)).filter((f) => /^[\w-]{11}\.json$/.test(f)); } catch (e) { return []; } };
  for (const f of read('notes')) {
    try {
      const n = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'notes', f), 'utf8'));
      const vid = f.slice(0, -5);
      for (const sec of n.sections || []) {
        const t0 = (sec.points && sec.points[0] && sec.points[0].t) || (sec.cues && sec.cues[0]) || 0;
        rows.push({ vid, t: Math.floor(t0), text: sec.title || '', src: 'note', sec: sec.title || '', title: true });
        for (const p of sec.points || []) rows.push({ vid, t: Math.floor(p.t || t0), text: p.text || '', src: 'note', sec: sec.title || '' });
      }
    } catch (e) { /* skip a broken file */ }
  }
  for (const f of read('transcripts')) {
    try {
      const cues = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'transcripts', f), 'utf8'));
      const vid = f.slice(0, -5);
      for (const c of cues) rows.push({ vid, t: Math.floor(c[0]), text: (c[3] ? c[3] + ' ' : '') + (c[2] || ''), src: 'sub' });
    } catch (e) { /* skip */ }
  }
  for (const r of rows) r.low = r.text.toLowerCase();
  return rows;
}
// Chinese ↔ English names of the same thing, from the glossary cards (and a
// few common ones it lacks), so 「前綴樹」 finds trie and 「銀行家」 finds Banker's.
let SYNONYMS = null;
function synonyms() {
  if (SYNONYMS) return SYNONYMS;
  const map = new Map();
  const link = (a, b) => {
    a = a.trim().toLowerCase(); b = b.trim().toLowerCase();
    if (!a || !b || a === b) return;
    if (!map.has(a)) map.set(a, new Set()); if (!map.has(b)) map.set(b, new Set());
    map.get(a).add(b); map.get(b).add(a);
  };
  try {
    const g = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'glossary.json'), 'utf8'));
    for (const [k, v] of Object.entries(g)) for (const en of String(v.en || '').split(/\s*[\/／]\s*/)) link(k, en.replace(/[（(].*?[)）]/g, ''));
  } catch (e) { /* no glossary: plain search */ }
  [['前綴樹', 'trie'], ['字首樹', 'trie'], ['銀行家', "banker"], ['鴿籠', 'pigeonhole'], ['死結', 'deadlock'], ['分頁', 'paging'],
   ['快取', 'cache'], ['雜湊', 'hash'], ['堆疊', 'stack'], ['佇列', 'queue'], ['鏈結串列', 'linked list'], ['二元樹', 'binary tree'],
   ['動態規劃', 'dynamic programming'], ['貪婪', 'greedy'], ['特徵值', 'eigenvalue'], ['行列式', 'determinant'], ['生成樹', 'spanning tree'],
   ['最短路徑', 'shortest path'], ['排程', 'scheduling'], ['號誌', 'semaphore'], ['補數', "complement"], ['管線', 'pipeline'],
   ['分解', 'factorization'], ['分解', 'decomposition'], ['主定理', 'master theorem']]
    .forEach(([a, b]) => link(a, b));
  return (SYNONYMS = map);
}
const isAscii = (w) => /^[\x00-\x7f]+$/.test(w);
function termTest(w) {
  // English words match whole words only (trie ≠ retrieve); Chinese matches anywhere
  if (isAscii(w)) {
    const re = new RegExp('(^|[^a-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(s|es)?($|[^a-z0-9])');
    return (low) => re.test(low);
  }
  return (low) => low.includes(w);
}
function search(query, limit = 50) {
  const q = String(query || '').trim().toLowerCase().slice(0, 60);
  if (q.length < 2) return [];
  if (!SEARCH_INDEX) SEARCH_INDEX = buildSearchIndex();
  const syn = synonyms();
  // the whole query may itself be a known term with a translation
  const whole = syn.get(q);
  // 「lu分解」 is two words: English and Chinese written together are split
  const words = q.split(/\s+/).filter(Boolean).flatMap((w) => w.match(/[\x00-\x7f]+|[^\x00-\x7f]+/g) || []);
  const groups = (whole ? [q] : words).map((w) =>
    [w].concat(Array.from(syn.get(w) || [])).map(termTest));
  const hits = [], perVid = new Map();
  for (const r of SEARCH_INDEX) {
    if (!groups.every((g) => g.some((test) => test(r.low)))) continue;
    hits.push({ r, score: 0 });
    perVid.set(r.vid, (perVid.get(r.vid) || 0) + 1);
  }
  // section titles first, then key points, then subtitles; exact phrase
  // bonus; and a lecture that keeps coming back to the term (the one that
  // teaches it) before one that mentions it in passing
  // a chapter goal that names the term (public/keymap.json) points at the
  // video parts that teach it: those come first
  const goalHit = new Map();
  try {
    if (!KEYMAP) KEYMAP = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'keymap.json'), 'utf8'));
    const tests = groups.map((g) => (low) => g.some((test) => test(low)));
    for (const ch of Object.values(KEYMAP)) for (const p of ch.points || []) {
      if (!tests.every((t) => t(String(p.point).toLowerCase()))) continue;
      for (const w of p.where || []) goalHit.set(w.video, Math.min(goalHit.get(w.video) || Infinity, w.t));
    }
  } catch (e) { /* no keymap: no goal boost */ }
  for (const h of hits) {
    const r = h.r;
    h.score = (r.title ? 3 : r.src === 'note' ? 2 : 1) + (r.low.includes(q) ? 0.5 : 0) + Math.min(2, Math.log2(1 + perVid.get(r.vid)) / 2)
      + (goalHit.has(r.vid) ? 2 : 0);
  }
  hits.sort((a, b) => b.score - a.score);
  const out = [], perVideo = new Map();
  for (const { r } of hits) {
    const k = r.vid + r.src;
    const n = perVideo.get(k) || 0;
    if (n >= (r.src === 'note' ? 3 : 2)) continue; // a few hits per video, so one video can't fill the list
    perVideo.set(k, n + 1);
    out.push({ vid: r.vid, t: r.t, text: r.text.slice(0, 140), src: r.src, sec: r.sec });
    if (out.length >= limit) break;
  }
  return out;
}

module.exports = { search };
