// Writes public/handouts/index.json: the chapters that have a 講義
// (public/handouts/<subj>-<n>.md), so the study room only asks for those.
import { readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'handouts');
const have = readdirSync(dir).filter((f) => /^[a-z]+-\d+\.md$/.test(f)).map((f) => f.slice(0, -3)).sort();
writeFileSync(join(dir, 'index.json'), JSON.stringify(have) + '\n');
console.log(have.length + ' 份講義：' + have.join(' '));
