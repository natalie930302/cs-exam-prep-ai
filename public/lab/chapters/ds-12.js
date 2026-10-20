// 資料結構 第12章：綜合刷題。
// No videos for this chapter — it is exam drilling. Questions come from the
// quiz generators of chapters 1–11 (each chapter's 小測驗 page), mixed at
// random under a per-question timer, with a 3D map of results per chapter.
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
export default function (ctx) {
  const { THREE, lab, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  const CHAPTERS = [
    [1, '複雜度'], [2, 'Stack/Queue'], [3, '樹'], [4, 'BST/AVL/RB'], [5, 'Heap'], [6, 'Hash'],
    [7, '圖'], [8, '排序'], [9, 'B-Tree/Trie'], [10, '圖演算法'], [11, '字串'],
  ];
  const TOPIC_WEIGHT = { 3: 2, 4: 2, 8: 2, 10: 2 }; // 重點：樹、排序、圖演算法（考古題比重高）
  const KEY = 'ds12-drill-stats';
  let stats = {};
  try { stats = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(stats)); } catch (e) {} };
  const mods = {};
  async function chapterQuiz(n) {
    if (!mods[n]) {
      const m = await import('./ds-' + n + '.js' + new URL(import.meta.url).search);
      mods[n] = m.default(ctx);
    }
    return (mods[n].pages || []).find((p) => /測驗|quiz/i.test(p.id + p.name));
  }
  function pickChapter() {
    const pool = [];
    CHAPTERS.forEach(([n]) => { for (let i = 0; i < (TOPIC_WEIGHT[n] || 1); i++) pool.push(n); });
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ── 3D：每章一根柱子，高度 = 作答數，綠色比例 = 答對率 ──
  function enterMap() {
    lab.clear();
    lab.frameCamera([0, 7, 15], [0, 2, 0]);
    CHAPTERS.forEach(([n, name], i) => {
      const s = stats[n] || { ok: 0, all: 0 };
      const x = (i - 5) * 1.15;
      const h = Math.max(0.15, Math.min(6, s.all * 0.4));
      const okH = s.all ? h * s.ok / s.all : 0;
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.85, h, 0.85), new THREE.MeshStandardMaterial({ color: '#e6d8be' }));
      base.position.set(x, h / 2, 0); base.castShadow = true; lab.world.add(base);
      if (okH > 0) {
        const ok = new THREE.Mesh(new THREE.BoxGeometry(0.9, okH, 0.9), new THREE.MeshStandardMaterial({ color: '#2fc092' }));
        ok.position.set(x, okH / 2, 0); lab.world.add(ok);
      }
      const l = lab.label(name, 'idx'); l.position.set(x, -0.3, 0.9); lab.world.add(l);
      const v = lab.label(s.all ? Math.round(100 * s.ok / s.all) + '%' : '—', s.all && s.ok / s.all < 0.6 ? 'ptr alt' : 'ptr');
      v.position.set(x, h + 0.5, 0); lab.world.add(v);
    });
    controls('<button id="mReset">清除紀錄</button><span class="hint">到「混合刷題」作答，柱子會長高；綠色 = 答對比例</span>');
    on('mReset', () => { stats = {}; save(); enterMap(); });
    const weak = CHAPTERS.filter(([n]) => stats[n] && stats[n].all >= 3).sort((a, b) => stats[a[0]].ok / stats[a[0]].all - stats[b[0]].ok / stats[b[0]].all).slice(0, 3);
    const total = Object.values(stats).reduce((a, s) => a + s.all, 0);
    const okAll = Object.values(stats).reduce((a, s) => a + s.ok, 0);
    setState('刷題地圖', [['總作答', String(total)], ['答對率', total ? Math.round(100 * okAll / total) + '%' : '—'], ['最弱的章', weak.length ? weak.map((w) => w[1]).join('、') : '各章至少答 3 題後顯示']],
      '樹、BST/AVL、排序、圖演算法出題機率加倍（歷屆考題比重）');
    clearLog();
    log('混合刷題會從第 1–11 章的題庫隨機出題，每題限時 90 秒。');
  }

  // ── 混合刷題頁 ──
  let timer = null, left = 0, cur = null;
  function stopTimer() { clearInterval(timer); timer = null; }
  async function renderDrill(el) {
    stopTimer();
    const n = pickChapter();
    cur = n;
    const name = CHAPTERS.find((c) => c[0] === n)[1];
    el.innerHTML = '<h2>混合刷題</h2><div class="lab-quiz-score">第 ' + n + ' 章・' + name + '　<b id="dTimer">90</b> 秒</div><div id="dBody"></div>';
    const quiz = await chapterQuiz(n);
    const body = el.querySelector('#dBody');
    if (!quiz) { body.innerHTML = '<p>這章沒有題庫。</p><button class="lab-next" id="dNext">下一題</button>'; el.querySelector('#dNext').onclick = () => renderDrill(el); return; }
    quiz.render(body);
    // the chapter page draws its own heading; keep only the question part
    body.querySelectorAll('h2, .lab-quiz-score').forEach((x) => x.remove());
    let answered = false;
    body.addEventListener('click', (e) => {
      const b = e.target.closest('.lab-quiz-opts button');
      if (!b || answered) return;
      setTimeout(() => {
        if (answered || !body.querySelector('.right')) return;
        answered = true; stopTimer();
        const right = b.classList.contains('right');
        stats[n] = stats[n] || { ok: 0, all: 0 };
        stats[n].all++; if (right) stats[n].ok++;
        save();
        // replace the chapter's own "next" button with the drill's
        body.querySelectorAll('.lab-next').forEach((x) => x.remove());
        const next = document.createElement('button');
        next.className = 'lab-next'; next.textContent = '下一題（隨機章節）';
        next.onclick = () => renderDrill(el);
        body.appendChild(next);
      }, 0);
    });
    left = 90;
    timer = setInterval(() => {
      left--;
      const t = el.querySelector('#dTimer');
      if (!t) { stopTimer(); return; }
      t.textContent = left;
      if (left <= 0) {
        stopTimer();
        if (!answered) {
          answered = true;
          stats[n] = stats[n] || { ok: 0, all: 0 }; stats[n].all++; save();
          body.insertAdjacentHTML('beforeend', '<div class="lab-quiz-explain">時間到，算答錯。考場上每題平均只有 1～2 分鐘。</div>');
          const next = document.createElement('button');
          next.className = 'lab-next'; next.textContent = '下一題（隨機章節）';
          next.onclick = () => renderDrill(el);
          body.appendChild(next);
        }
      }
    }, 1000);
  }

  const scenes = {
    'drill-map': { title: '綜合刷題：各章答對率', play: async (tok) => {
      enterMap();
      say('每根柱子是一章，綠色是答對的部分', '樹、排序、圖演算法是歷屆考題重點');
      await beat(tok, 6000);
    } },
  };

  return {
    kicker: '資料結構・第 12 章',
    title: '綜合刷題',
    color: 'var(--ds)',
    modes: [{ id: 'map', name: '刷題地圖', enter: enterMap }],
    quiz: async () => { const n = pickChapter(); await chapterQuiz(n); return mods[n].quiz(); },
    pages: [{ id: 'drill', name: '混合刷題', render: renderDrill }],
    scenes,
    sceneOrder: ['drill-map'],
    stop() { stopTimer(); },
  };
}
