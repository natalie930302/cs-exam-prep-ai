// Checks the 講義 (public/handouts/<subj>-<n>.md) and their 自我檢查卡
// (<subj>-<n>.cards.json) for things that render wrong or break the rules:
// unclosed code fences, tables whose rows have different column counts,
// callouts with an unknown label, #### headings (not rendered), HTML / links /
// LaTeX, unbalanced **, teacher names, duplicate ## headings, and cards that
// point at a section that does not exist.
// node tools/handout-lint.mjs [ds-2 alg-1 …]   (no arguments = every handout)
// Exits 1 when anything is found. Used by tools/check.mjs too.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'handouts');
const CALLOUTS = ['重點', '例題', '陷阱', '比喻', '觀念'];
const NAMES = /彭文志|洪逸|原始講解|林軒田|Abdul\s*Bari|江蕙如|周志遠|趙啟超|易志偉|黃婷婷|3Blue1Brown|3B1B|Strang|老師說|影片中|課堂上|這位老師/;

export function lintHandout(ch) {
  const out = [];
  const md = readFileSync(join(DIR, ch + '.md'), 'utf8').replace(/\r/g, '');
  const lines = md.split('\n');
  const at = (i, msg) => out.push(ch + '.md:' + (i + 1) + ' ' + msg);
  if (!/^# \S/.test(lines[0])) at(0, '第一行要是「# 章名」');
  let fence = -1;
  const heads = new Map();
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^```/.test(l)) { fence = fence < 0 ? i : -1; continue; }
    if (fence >= 0) continue;
    // an indented fence is fine inside a list item (rendered as part of it)
    if (/^\s+```/.test(l) && !(i > 0 && /^(\s*([-*]|\d+\.)\s|\s{2,}\S)/.test(lines[i - 1]))) at(i, '``` 前面有空白，不會被當成程式碼區塊');
    if (/^#{4,}\s/.test(l)) at(i, '#### 以下的標題不會顯示成標題');
    if (/^#\s/.test(l) && i > 0) at(i, '只能有一個 # 標題');
    const h = l.match(/^##\s+(.*)$/);
    if (h) { const t = h[1].trim(); if (heads.has(t)) at(i, '## 標題重複：「' + t + '」（第 ' + (heads.get(t) + 1) + ' 行）'); else heads.set(t, i); }
    // outside code: inline code removed before the remaining checks
    const text = l.replace(/`[^`]*`/g, '');
    // (matrix notation like [1 2; 3 4](x, y) and prices like $20 are fine)
    if (/<\/?(b|i|br|div|span|p|a|img|sub|sup|table|tr|td|code|pre)\b[^>]*>/i.test(text)) at(i, '有 HTML 標籤');
    if (/\]\((https?:|\/|#)/.test(text)) at(i, '有 Markdown 連結');
    if (/\\(frac|sum|le|ge|cdot|times|lfloor|log|sqrt|alpha|lambda)\b/.test(text)) at(i, '有 LaTeX');
    if (((text.match(/\*\*/g) || []).length) % 2) at(i, '** 沒有成對');
    if (NAMES.test(l)) at(i, '提到老師或課程：' + l.match(NAMES)[0]);
    const c = l.match(/^>\s*\*\*([^*]+)\*\*/);
    if (c && (i === 0 || !/^>/.test(lines[i - 1])) && !CALLOUTS.includes(c[1].replace(/（[^）]*）$/, ''))) at(i, '框框標籤「' + c[1] + '」不是 ' + CALLOUTS.join('／') + ' 之一');
    if (/^\|/.test(l) && (i === 0 || !/^\|/.test(lines[i - 1]))) {
      // a table: same column count in every row, separator second
      const rows = [];
      for (let j = i; j < lines.length && /^\|/.test(lines[j]); j++) rows.push(lines[j]);
      const cols = (r) => r.replace(/`[^`]*`/g, 'x').replace(/\\\|/g, 'x').replace(/^\||\|\s*$/g, '').split('|').length;
      if (rows.length > 1 && !/^\|[\s:|-]+\|?\s*$/.test(rows[1])) at(i, '表格第二行不是 |---| 分隔線');
      const n = cols(rows[0]);
      rows.forEach((r, k) => { if (cols(r) !== n) at(i + k, '表格這一行有 ' + cols(r) + ' 格，表頭有 ' + n + ' 格'); });
    }
  }
  if (fence >= 0) at(fence, '``` 沒有關上');
  const cf = join(DIR, ch + '.cards.json');
  if (existsSync(cf)) {
    let cards;
    try { cards = JSON.parse(readFileSync(cf, 'utf8')).cards; } catch (e) { out.push(ch + '.cards.json 不是正確的 JSON'); return out; }
    if (!Array.isArray(cards) || !cards.length) out.push(ch + '.cards.json 沒有卡片');
    const seen = new Set();
    (cards || []).forEach((k, i) => {
      const w = ch + '.cards.json 第 ' + (i + 1) + ' 張';
      if (!k || typeof k.q !== 'string' || !k.q.trim() || typeof k.a !== 'string' || !k.a.trim()) out.push(w + ' 題目或答案是空的');
      else {
        if (!heads.has(k.sec)) out.push(w + ' 的 sec「' + k.sec + '」不是講義裡的 ## 標題');
        if (seen.has(k.q)) out.push(w + ' 題目重複');
        seen.add(k.q);
        if (NAMES.test(k.q + k.a)) out.push(w + ' 提到老師或課程');
        for (const s of [k.q, k.a]) if (((s.replace(/`[^`]*`/g, '').match(/\*\*/g) || []).length) % 2) out.push(w + ' ** 沒有成對');
      }
    });
  }
  return out;
}

export function allHandouts() {
  return readdirSync(DIR).filter((f) => /^[a-z]+-\d+\.md$/.test(f)).map((f) => f.slice(0, -3));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const list = process.argv.slice(2).length ? process.argv.slice(2) : allHandouts();
  const found = list.flatMap(lintHandout);
  found.forEach((x) => console.log(x));
  console.log(found.length ? found.length + ' 個問題' : list.length + ' 份講義沒有問題');
  process.exit(found.length ? 1 : 0);
}
