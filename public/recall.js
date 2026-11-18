// 自我檢查卡 and 間隔複習 (spaced review).
//
// Every 講義 has cards (public/handouts/<ch>.cards.json: {cards:[{sec,q,a}]}):
// a question to answer from memory, then the answer, then the reader grades
// themself 記得／模糊／忘了. Each graded card is scheduled (Leitner boxes): a card
// remembered moves up a box and waits longer before it comes back, a forgotten
// one goes back to box 0 and returns tomorrow. The schedule is the `srs`
// localStorage key (mirrored to the server by sync.js):
//   { "<ch>:<hash of q>": { b: box 0–6, d: due day number, g: last grade, ts } }
// Only cards the reader has answered once are scheduled; unseen cards are met
// in the handout first.
var SRS_DAYS = [1, 2, 4, 8, 16, 32, 64];          // box → days until the card is due again
var SRS_GRADES = {bad: '忘了', meh: '模糊', good: '記得'};

function srsDay(t){ const d = t ? new Date(t) : new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 864e5); }
function srsDate(day){ const d = new Date(day * 864e5); return (d.getUTCMonth() + 1) + '/' + d.getUTCDate(); }
function srsLoad(){ try { const s = JSON.parse(localStorage.getItem('srs') || '{}'); return s && typeof s === 'object' && !Array.isArray(s) ? s : {}; } catch (e) { return {}; } }
function srsSave(s){ try { localStorage.setItem('srs', JSON.stringify(s)); } catch (e) {} }
// a card's id stays the same when its answer is corrected (only the question is hashed)
function cardId(ch, q){
  let h = 0x811c9dc5;
  for (let i = 0; i < q.length; i++) { h ^= q.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return ch + ':' + h.toString(36);
}
function srsGrade(id, g){
  const s = srsLoad(), e = s[id] && s[id].d ? s[id] : null, today = srsDay();
  // remembering a card again before it is due proves nothing new: it keeps
  // its box and date (practising a chapter twice in a day does not push its
  // cards 64 days away)
  if (g === 'good' && e && e.d > today) { e.g = g; e.ts = Date.now(); srsSave(s); return e; }
  let b;
  if (g === 'good') b = e ? Math.min(e.b + 1, SRS_DAYS.length - 1) : 2;   // known on first sight: skip the 1-day box
  else if (g === 'meh') b = e ? Math.max(1, e.b - 1) : 1;               // a step back, at least 2 days
  else b = 0;
  s[id] = {b: b, d: today + SRS_DAYS[b], g: g, ts: Date.now()};
  srsSave(s);
  return s[id];
}
function srsDue(s){
  s = s || srsLoad();
  const today = srsDay();
  // (an entry without a date is a removed card, see review.html)
  return Object.keys(s).filter(function(id){ return s[id] && s[id].d && s[id].d <= today; });
}

// the chapter's cards, with ids; cached per page
var CARDS_CACHE = {};
function loadCards(ch){
  if (!CARDS_CACHE[ch]) {
    CARDS_CACHE[ch] = fetch('/handouts/' + ch + '.cards.json', {cache: 'no-cache'})
      .then(function(r){ return r.ok ? r.json() : {cards: []}; })
      .then(function(j){ return (j.cards || []).filter(function(k){ return k && k.q && k.a; }).map(function(k){ return {id: cardId(ch, k.q), ch: ch, sec: k.sec, q: k.q, a: k.a}; }); })
      .catch(function(){ delete CARDS_CACHE[ch]; return []; });
  }
  return CARDS_CACHE[ch];
}
function cardHtml(text){ return mdInline(String(text)).replace(/\n/g, '<br>'); }
function chapterLabel(ch){
  const p = ch.split('-'), s = (typeof SUBJECTS !== 'undefined' ? SUBJECTS : []).find(function(x){ return x.id === p[0]; });
  return s ? s.name + '・第 ' + p[1] + ' 章' : ch;
}
function srsStatus(e){
  if (!e) return '';
  return SRS_GRADES[e.g] + '・' + (e.d <= srsDay() ? '今天該複習' : srsDate(e.d) + ' 再複習');
}

// One card, answered in place: question → 看答案 → grade. Used under each
// handout section. onGraded(card, entry) runs after the grade is saved.
function recallCard(card, onGraded){
  const el = document.createElement('div');
  el.className = 'rc-card';
  const e0 = srsLoad()[card.id], e = e0 && e0.d ? e0 : null;
  el.innerHTML = '<div class="rc-q">' + cardHtml(card.q) + '</div>'
    + '<div class="rc-row"><button type="button" class="rc-show">想好了，看答案</button><span class="rc-state">' + srsStatus(e) + '</span></div>'
    + '<div class="rc-a" hidden>' + cardHtml(card.a) + '</div>'
    + '<div class="rc-grade" hidden><span>你答得：</span><button type="button" data-g="bad">忘了</button><button type="button" data-g="meh">模糊</button><button type="button" data-g="good">記得</button></div>';
  const show = el.querySelector('.rc-show');
  show.onclick = function(){
    show.hidden = true;
    el.querySelector('.rc-a').hidden = false;
    el.querySelector('.rc-grade').hidden = false;
  };
  el.querySelector('.rc-grade').onclick = function(ev){
    const b = ev.target.closest('button[data-g]'); if (!b) return;
    const entry = srsGrade(card.id, b.dataset.g);
    // folded again; the button lets the reader try it once more later
    el.querySelector('.rc-grade').hidden = true;
    el.querySelector('.rc-a').hidden = true;
    const st = el.querySelector('.rc-state');
    st.textContent = srsStatus(entry);
    st.dataset.g = entry.g;
    show.hidden = false; show.textContent = '再答一次';
    if (onGraded) onGraded(card, entry);
  };
  if (e) el.querySelector('.rc-state').dataset.g = e.g;
  return el;
}

// A review session: one card at a time, in `host`. Items are cards
// ({id, ch, sec, q, a}) or wrong quiz answers ({mcq: record}). A forgotten
// card comes back once at the end of the session. opts.onEnd(summary) runs at
// the end; opts.onMcq(record, pick, ok) records a quiz answer.
function recallSession(host, items, opts){
  opts = opts || {};
  const queue = items.slice(), tally = {good: 0, meh: 0, bad: 0, right: 0, wrong: 0}, again = new Set(), given = {};
  if (opts.onStart) opts.onStart();
  const total = queue.length;
  let n = 0, keyFn = null;
  host.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'rc-session';
  host.appendChild(box);
  function done(){
    document.removeEventListener('keydown', onKey);
    // the cards forgotten in this round (by their last grade here)
    const forgot = items.filter(function(x){ return !x.mcq && given[x.id] === 'bad'; });
    box.innerHTML = '<div class="rc-sum"><div class="rc-sum-hd">這輪練完了</div>'
      + '<div class="rc-sum-row">'
      + (tally.good + tally.meh + tally.bad ? '<span data-g="good">記得 ' + tally.good + '</span><span data-g="meh">模糊 ' + tally.meh + '</span><span data-g="bad">忘了 ' + tally.bad + '</span>' : '')
      + (tally.right + tally.wrong ? '<span data-g="good">選擇題答對 ' + tally.right + '</span><span data-g="bad">答錯 ' + tally.wrong + '</span>' : '')
      + '</div><div class="rc-sum-note">記得的卡片會隔幾天再出現，越熟隔越久；忘了的明天再來。</div>'
      + '<div class="rc-sum-btns">' + (forgot.length ? '<button type="button" class="rc-again">再練忘了的 ' + forgot.length + ' 張</button>' : '')
      + (opts.endButtons || '') + '</div></div>';
    const a = box.querySelector('.rc-again');
    if (a) a.onclick = function(){ recallSession(host, forgot, opts); };
    if (opts.onEnd) opts.onEnd(tally, box);
  }
  function onKey(ev){
    if (!box.isConnected) { document.removeEventListener('keydown', onKey); return; }
    if (!keyFn || ev.ctrlKey || ev.metaKey || ev.altKey || !box.offsetParent) return;
    // a focused button or link (結束, 回影片) handles its own Enter / Space
    if (/^(BUTTON|A)$/.test((document.activeElement || {}).tagName || '') && (ev.key === 'Enter' || ev.key === ' ')) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) return;
    keyFn(ev);
  }
  document.addEventListener('keydown', onKey);
  function next(){
    const it = queue.shift();
    if (!it) { keyFn = null; done(); return; }
    n++;
    const where = it.mcq ? chapterLabel(it.mcq.subj + '-' + (it.mcq.ch + 1)) + '・影片小測驗答錯的題' : chapterLabel(it.ch) + (it.sec ? '・' + it.sec : '');
    box.innerHTML = '<div class="rc-top"><span class="rc-count">' + Math.min(n, total) + ' / ' + total + '</span><span class="rc-src">' + mdEsc(where) + '</span>'
      + '<button type="button" class="rc-quit">結束</button></div>'
      + '<div class="rc-bar"><i style="width:' + Math.round((n - 1) / Math.max(1, total + again.size) * 100) + '%"></i></div>';
    box.querySelector('.rc-quit').onclick = function(){ queue.length = 0; keyFn = null; done(); };
    const card = document.createElement('div');
    card.className = 'rc-card rc-big';
    box.appendChild(card);
    if (it.mcq) {
      // options in a fresh random order each time (the data often lists the answer first)
      const r = Object.assign({}, it.mcq, {opts: it.mcq.opts.slice()});
      for (let i = r.opts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = r.opts[i]; r.opts[i] = r.opts[j]; r.opts[j] = t; }
      card.innerHTML = '<div class="rc-q">' + mdEsc(r.q) + '</div><div class="rc-opts">'
        + r.opts.map(function(o, i){ return '<button type="button" data-i="' + i + '"><b>' + 'ABCDEFGH'[i] + '</b><span>' + mdEsc(o) + '</span></button>'; }).join('') + '</div>';
      const pick = function(i){
        const o = r.opts[i]; if (o == null || card.dataset.done) return;
        card.dataset.done = '1';
        const ok = o === r.ans;
        tally[ok ? 'right' : 'wrong']++;
        card.querySelectorAll('.rc-opts button').forEach(function(b){
          const v = r.opts[Number(b.dataset.i)];
          b.disabled = true;
          if (v === r.ans) b.dataset.g = 'good'; else if (Number(b.dataset.i) === i) b.dataset.g = 'bad';
        });
        if (opts.onMcq) opts.onMcq(r, o, ok);
        const src = typeof videoRoomUrl === 'function' && r.vid ? videoRoomUrl(r.subj, r.ch, r.vid) + '&at=' + Math.max(0, Math.floor(r.at || 0)) : '';
        card.insertAdjacentHTML('beforeend', (r.why ? '<div class="rc-a">' + mdEsc(r.why) + '</div>' : '')
          + '<div class="rc-row"><button type="button" class="rc-next">下一張 →</button>'
          + (src ? '<a class="rc-src-link" href="' + mdEsc(src) + '" target="_blank" rel="noopener">回影片看這段' + (r.label ? '（' + mdEsc(r.label) + '）' : '') + '</a>' : '') + '</div>');
        card.querySelector('.rc-next').onclick = next;
        keyFn = function(ev){ if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); next(); } };
      };
      card.querySelector('.rc-opts').onclick = function(ev){ const b = ev.target.closest('button[data-i]'); if (b) pick(Number(b.dataset.i)); };
      // keys A–D (or 1–4) pick an option
      keyFn = function(ev){ let k = 'abcdefgh'.indexOf(String(ev.key).toLowerCase()); if (k < 0 || ev.key.length !== 1) k = Number(ev.key) - 1; if (k >= 0 && k < r.opts.length) { ev.preventDefault(); pick(k); } };
      return;
    }
    card.innerHTML = '<div class="rc-q">' + cardHtml(it.q) + '</div>'
      + '<textarea class="rc-try" rows="2" aria-label="你的答案（不會存）" placeholder="先寫下（或說出）你的答案，再看答案。這裡寫的不會存。"></textarea>'
      + '<div class="rc-row"><button type="button" class="rc-show">看答案<kbd>空白鍵</kbd></button></div>'
      + '<div class="rc-a" hidden>' + cardHtml(it.a) + '</div>'
      + '<div class="rc-grade" hidden><span>你答得：</span><button type="button" data-g="bad">忘了<kbd>1</kbd></button><button type="button" data-g="meh">模糊<kbd>2</kbd></button><button type="button" data-g="good">記得<kbd>3</kbd></button></div>';
    const show = function(){
      if (!card.querySelector('.rc-a').hidden) return;
      card.querySelector('.rc-row').hidden = true;
      card.querySelector('.rc-a').hidden = false;
      card.querySelector('.rc-grade').hidden = false;
      keyFn = function(ev){ const g = {'1': 'bad', '2': 'meh', '3': 'good'}[ev.key]; if (g) { ev.preventDefault(); grade(g); } };
    };
    const grade = function(g){
      // a card forgotten for the first time this session is asked once more at the end
      if (!again.has(it.id)) tally[g]++;
      given[it.id] = g;
      srsGrade(it.id, g);
      if (g === 'bad' && !again.has(it.id)) { again.add(it.id); queue.push(it); }
      next();
    };
    card.querySelector('.rc-show').onclick = show;
    card.querySelector('.rc-grade').onclick = function(ev){ const b = ev.target.closest('button[data-g]'); if (b) grade(b.dataset.g); };
    // Ctrl+Enter in the answer box also shows the answer
    card.querySelector('.rc-try').onkeydown = function(ev){ if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); this.blur(); show(); } };
    keyFn = function(ev){ if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); show(); } };
  }
  next();
}

// Quiz answers from the videos that are still wrong (the last answer to that
// question was wrong) and were missed before today: they join the daily review.
// Questions that lean on the video ("承上", "老師的例子") make no sense on their
// own and stay in the chapter's quiz tab instead.
var CONTEXT_Q = /承上|上一題|上題|前一題|剛剛那|老師的例子|老師舉|老師的圖|這位老師|影片中的例子/;
function wrongQuizDue(){
  let h;
  try { h = JSON.parse(localStorage.getItem('qz-history') || '[]'); } catch (e) { h = []; }
  const last = {};
  h.forEach(function(r){ if (r && r.q && Array.isArray(r.opts) && r.opts.length > 1) last[r.vid + '|' + r.q] = r; });
  const today = srsDay();
  return Object.keys(last).map(function(k){ return last[k]; }).filter(function(r){ return !r.ok && srsDay(r.ts) < today && r.opts.indexOf(r.ans) >= 0 && !CONTEXT_Q.test(r.q); });
}
