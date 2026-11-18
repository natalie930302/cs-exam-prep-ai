// Writes public/handouts/index.json: the chapters that have a 講義
// (public/handouts/<subj>-<n>.md) with an estimated reading time, so the study
// room only asks for those and the calendar can schedule the reading.
// Reading speed for a dense technical handout: ~300 Chinese characters a
// minute, other characters (formulas, code, English) ~1200 a minute.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'handouts');
const have = readdirSync(dir).filter((f) => /^[a-z]+-\d+\.md$/.test(f)).map((f) => f.slice(0, -3)).sort();
const index = {};
for (const ch of have) {
  const md = readFileSync(join(dir, ch + '.md'), 'utf8');
  const cjk = (md.match(/[一-鿿]/g) || []).length;
  const other = md.replace(/\s/g, '').length - cjk;
  index[ch] = { min: Math.max(10, Math.round(cjk / 300 + other / 1200)) };
}
writeFileSync(join(dir, 'index.json'), JSON.stringify(index) + '\n');
console.log(have.length + ' 份講義：' + have.join(' '));
