// The course as the pages see it (subjects → chapters → videos), computed with
// the pages' own code (data.js, video-order.js, chapter-core.js) so the
// connector lists exactly what the calendar and 六科 show.
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');

const PUBLIC_DIR = path.join(__dirname, 'public');
const site = vm.createContext({});
for (const f of ['data.js', 'video-order.js', 'chapter-core.js']) {
  vm.runInContext(fs.readFileSync(path.join(PUBLIC_DIR, f), 'utf8').replace(/^const (SUBJECTS|VIDEO_ORDER|VIDEO_PLAYLIST)\b/m, 'var $1'), site, { filename: f });
}

// "1:25:14" / "43:39" → seconds
function seconds(dur) {
  const p = String(dur || '').split(':').map(Number);
  if (!p.length || p.some(Number.isNaN)) return 0;
  return p.reduce((s, x) => s * 60 + x, 0);
}

const subjects = site.SUBJECTS.map((s) => ({
  id: s.id,
  name: s.name,
  chapters: s.chapters.map((c, i) => ({
    n: i + 1,
    title: c.t,
    topics: c.sub || '',
    priority: c.pri || '',
    week: c.wk || 0,
    videos: site.chapterDisplayMaterials(c).filter((m) => m.videoId).map((m) => ({
      id: m.videoId, title: m.text, teacher: m.series || '', duration: m.dur || '', seconds: seconds(m.dur),
    })),
  })),
}));

// video id → where it is taught first (a few videos are listed in two chapters)
const videos = new Map();
for (const s of subjects) for (const c of s.chapters) for (const v of c.videos) {
  if (!videos.has(v.id)) videos.set(v.id, { ...v, subject: s.id, subjectName: s.name, chapter: c.n, chapterTitle: c.title });
}

module.exports = { subjects, videos, seconds };
