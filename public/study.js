// Chapter study room. The video plays on the left; on the right a 3D "stage"
// (the chapter lab in ?stage mode) shows the concept the teacher is talking
// about right now, switching scenes as playback crosses note sections. One
// line under them says what is being taught; a timeline lists the segments.
// Chapters without a lab yet show the synced notes on the right instead.
// Progress uses the same task ids as the main site (chapter-core.js).
(function(){
  const params = new URLSearchParams(location.search);
  const subject = SUBJECTS.find(function(s){ return s.id === params.get('s'); }) || SUBJECTS[0];
  const chIndex = Math.max(0, Math.min(subject.chapters.length - 1, Number(params.get('c')) || 0));
  const chapter = subject.chapters[chIndex];
  const chKey = subject.id + '-' + stableTaskKey(chapter.t);
  const display = chapterDisplayMaterials(chapter);
  const videoMat = display.find(function(m){ return m.type === 'vidgroup'; });
  const series = videoMat ? videoMat.series : [];
  const labUrl = chapterLabUrl(subject.id, chIndex);
  const hasStage = !!labUrl;

  let done = new Set();
  let notesIndex = {};
  const notesCache = {};
  let player = null, playerReady = false;
  let current = null;      // {seriesIdx, idx, opt, id}
  let curNotes = null;     // notes JSON of the current video
  let activeSeries = 0;
  let follow = true;

  const $ = function(id){ return document.getElementById(id); };
  const esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };
  const fmt = function(t){ t = Math.max(0, Math.floor(t)); const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };
  const store = {
    get: function(k){ try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function(k, v){ try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const vidTask = function(id){ return 'vid-' + id; };
  const notesEl = function(){ return hasStage ? $('notesFull') : $('notesList'); };

  // ── Header ──
  document.documentElement.style.setProperty('--subj', subject.color || 'var(--ac)');
  document.title = chapter.t + '｜學習空間';
  $('kicker').textContent = subject.name + '・第 ' + (chIndex + 1) + ' 章' + (chapter.hrs ? '・預估 ' + chapter.hrs : '');
  $('chTitle').textContent = chapter.t;
  $('backLink').href = '/#subjects';
  function chLink(el, i){
    if (i < 0 || i >= subject.chapters.length) { el.setAttribute('aria-disabled', 'true'); return; }
    el.href = studyRoomUrl(subject.id, i);
    el.title = (i < chIndex ? '上一章：' : '下一章：') + subject.chapters[i].t;
  }
  chLink($('prevCh'), chIndex - 1);
  chLink($('nextCh'), chIndex + 1);
  if (chapter.peerNote) { $('peerCard').hidden = false; $('peerNote').textContent = chapter.peerNote; }

  // ── Stage or notes on the right ──
  if (hasStage) {
    $('stage').hidden = false;
    $('stage').src = labUrl + '&stage=1';
    $('fullTab').hidden = false;
    $('labTab').hidden = false;
  } else {
    $('notesSide').hidden = false;
  }
  let stageScene = null, stageReady = false, pendingScene = null;
  $('stage').addEventListener('load', function(){
    stageReady = true;
    if (pendingScene && pendingScene.tour) $('stage').contentWindow.postMessage({type: 'tour'}, location.origin);
    else if (pendingScene) postScene(pendingScene);
  });
  function postScene(sec){
    $('stage').contentWindow.postMessage({type: 'scene', scene: sec.scene, params: sec.params || {}}, location.origin);
  }
  // No notes for this video yet: let the stage walk through every concept of
  // the chapter, and show which one is playing in the "now" line.
  let touring = false;
  function startTour(){
    if (!hasStage) return;
    stageScene = 'tour'; touring = true;
    const go = function(){ $('stage').contentWindow.postMessage({type: 'tour'}, location.origin); };
    if (stageReady) go(); else pendingScene = {tour: true};
  }
  window.addEventListener('message', function(e){
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.type === 'tour-scene' && touring && !curNotes) {
      const t = (stageScenes[e.data.id] || {}).title || '';
      $('nowSec').textContent = '這章的概念導覽';
      $('nowPoint').textContent = t;
    }
    if (e.data.type === 'lab-ready') e.data.scenes.forEach(function(x){ stageScenes[x.id] = x; });
  });
  const stageScenes = {};
  // A video can belong to several chapters; a section may name a different
  // scene per chapter ("sceneBy": {"ds-10": "…"}). Unknown scenes fall back
  // to the chapter tour rather than playing an unrelated animation.
  const chId = subject.id + '-' + (chIndex + 1);
  function sceneFor(sec){
    const id = sec.sceneBy && chId in sec.sceneBy ? sec.sceneBy[chId] : sec.scene;
    if (!id) return null;
    if (Object.keys(stageScenes).length && !stageScenes[id]) return null;
    return id;
  }
  function showScene(sec){
    if (!hasStage || !sec) return;
    const id = sceneFor(sec);
    if (!id) { if (stageScene !== 'tour') startTour(); return; }
    sec = Object.assign({}, sec, {scene: id});
    const key = sec.scene + JSON.stringify(sec.params || {});
    if (key === stageScene) return;
    stageScene = key; touring = false;
    if (stageReady) postScene(sec); else pendingScene = sec;
  }

  // ── Data ──
  async function loadDone(){
    try { const r = await fetch('/api/tasks/done'); done = new Set((await r.json()).done || []); } catch (e) {}
  }
  async function loadNotesIndex(){
    try { const r = await fetch('/notes/index.json'); notesIndex = await r.json(); } catch (e) { notesIndex = {}; }
  }
  async function loadNotes(id){
    if (!notesIndex[id]) return null;
    if (!notesCache[id]) {
      try { const r = await fetch('/notes/' + id + '.json'); notesCache[id] = await r.json(); } catch (e) { notesCache[id] = null; }
    }
    return notesCache[id];
  }
  async function setTask(id, value){
    await fetch('/api/tasks/' + encodeURIComponent(id) + '/set', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({done: value})
    });
    if (value) done.add(id); else done.delete(id);
  }

  // ── Goals & tasks ──
  function renderGoals(){
    const items = String(chapter.key || '').split(/[、；;]/).map(function(x){ return x.trim(); }).filter(Boolean);
    $('goals').innerHTML = items.map(function(t){
      const id = 'kp-' + chKey + '-' + stableTaskKey(t);
      const d = done.has(id);
      return '<li><button class="st-check' + (d ? ' done' : '') + '" data-task="' + id + '"><span class="st-box">' + (d ? '✓' : '') + '</span><span class="st-check-text">' + esc(t) + '</span></button></li>';
    }).join('') + '<li class="st-src">看完、做完實驗後，自己覺得「會了」再打勾。</li>';
    $('goals').querySelectorAll('.st-check').forEach(function(b){
      b.onclick = async function(){ await setTask(b.dataset.task, !done.has(b.dataset.task)); renderGoals(); };
    });
  }
  function renderTasks(){
    $('tasks').innerHTML = display.map(function(m){
      const id = chapterMaterialTaskId(subject.id, chapter, m);
      const d = done.has(id);
      const label = m.type === 'vidgroup' ? '本章影片（看完任一套系列）' : m.text;
      const tag = m.type === 'vidgroup' ? '影片' : m.type === 'book' ? '讀本' : m.type === 'ex' ? '練習' : '建議';
      return '<button class="st-check' + (d ? ' done' : '') + '" data-task="' + id + '"><span class="st-box">' + (d ? '✓' : '') + '</span><span class="st-check-text"><b>' + tag + '</b>　' + esc(label) + '</span></button>';
    }).join('');
    $('tasks').querySelectorAll('.st-check').forEach(function(b){
      b.onclick = async function(){
        await setTask(b.dataset.task, !done.has(b.dataset.task));
        if (chapter.wk) await syncFoundationWeekTasks(chapter.wk, Array.from(done));
        renderTasks();
      };
    });
    renderProgress();
  }
  function renderProgress(){
    const s = series[activeSeries];
    const pills = [];
    if (s) {
      const w = s.options.filter(function(o){ return done.has(vidTask(youtubeId(o.url))); }).length;
      pills.push('<span class="st-pill' + (w === s.options.length ? ' ok' : '') + '">影片 ' + w + '/' + s.options.length + '</span>');
    }
    display.forEach(function(m){
      if (m.type === 'vidgroup') return;
      const d = done.has(chapterMaterialTaskId(subject.id, chapter, m));
      const tag = m.type === 'book' ? '讀本' : m.type === 'ex' ? '練習' : '建議';
      pills.push('<span class="st-pill' + (d ? ' ok' : '') + '">' + tag + (d ? ' ✓' : '') + '</span>');
    });
    $('chProg').innerHTML = pills.join('');
  }

  // ── Video list ──
  function seriesNotesCount(s){ return s.options.filter(function(o){ return notesIndex[youtubeId(o.url)]; }).length; }
  function renderSeriesChips(){
    $('seriesHint').textContent = series.length > 1 ? series.length + ' 位老師，任選一套看完即可' : '';
    $('seriesChips').innerHTML = series.length > 1 ? series.map(function(s, i){
      const n = seriesNotesCount(s);
      return '<button aria-pressed="' + (i === activeSeries) + '" data-i="' + i + '">' + esc(s.name) + '（' + s.options.length + '）' + (n ? ' · 有重點 ' + n : '') + '</button>';
    }).join('') : '';
    $('seriesChips').querySelectorAll('button').forEach(function(b){
      b.onclick = function(){ activeSeries = Number(b.dataset.i); store.set('study-series-' + chKey, activeSeries); renderSeriesChips(); renderVideoList(); };
    });
  }
  function durToSec(d){
    const p = String(d || '').split(':').map(Number);
    if (!p.length || p.some(isNaN)) return 0;
    return p.reduce(function(a, x){ return a * 60 + x; }, 0);
  }
  function renderVideoList(){
    renderProgress();
    const s = series[activeSeries];
    if (!s) { $('vlist').innerHTML = '<li class="st-src">這章沒有影片。</li>'; return; }
    $('vlist').innerHTML = s.options.map(function(o, i){
      const id = youtubeId(o.url);
      const w = done.has(vidTask(id));
      const isCur = current && current.id === id;
      const pos = Number(store.get('yt-pos-' + id)) || 0;
      const durS = durToSec(o.dur);
      const pct = !w && durS && pos > 30 ? Math.min(100, Math.round(pos / durS * 100)) : 0;
      return '<li><button class="st-v' + (isCur ? ' current' : '') + (w ? ' watched' : '') + '" data-i="' + i + '">'
        + '<span class="st-v-n">' + (w ? '✓' : String(i + 1).padStart(2, '0')) + '</span>'
        + '<span class="st-v-title">' + esc(o.label) + '</span>'
        + '<span class="st-v-meta">' + esc(o.dur || '') + (notesIndex[id] ? '<span class="st-badge">有重點</span>' : '') + '</span>'
        + (pct ? '<span class="st-progress"><span style="width:' + pct + '%"></span></span>' : '')
        + '</button></li>';
    }).join('');
    $('vlist').querySelectorAll('.st-v').forEach(function(b){
      b.onclick = function(){ playVideo(activeSeries, Number(b.dataset.i), true); window.scrollTo({top: 0, behavior: 'smooth'}); };
    });
  }

  // ── Player ──
  function playVideo(si, i, autoplay, startAt){
    const s = series[si]; if (!s || !s.options[i]) return;
    const opt = s.options[i]; const id = youtubeId(opt.url);
    current = {seriesIdx: si, idx: i, opt: opt, id: id};
    activeSeries = si;
    store.set('study-last-' + chKey, id);
    history.replaceState(null, '', studyRoomUrl(subject.id, chIndex, id));
    $('nowSeries').textContent = s.name + '・第 ' + (i + 1) + ' / ' + s.options.length + ' 支' + (opt.dur ? '・' + opt.dur : '');
    $('nowTitle').textContent = opt.label;
    $('prevVid').disabled = i === 0;
    $('nextVid').disabled = i === s.options.length - 1;
    $('prevVid').title = i > 0 ? '上一支：' + s.options[i - 1].label : '';
    $('nextVid').title = i < s.options.length - 1 ? '下一支：' + s.options[i + 1].label : '';
    renderWatchBtn();
    renderSeriesChips();
    renderVideoList();
    const start = startAt != null ? startAt : (Number(store.get('yt-pos-' + id)) || 0);
    renderNotes().then(function(){ syncNotes(start, false); });
    if (playerReady) {
      if (autoplay) player.loadVideoById({videoId: id, startSeconds: start});
      else player.cueVideoById({videoId: id, startSeconds: start});
    }
  }
  function renderWatchBtn(){
    const w = current && done.has(vidTask(current.id));
    $('watchBtn').textContent = w ? '✓ 已看完' : '標記看完';
    $('watchBtn').classList.toggle('done', !!w);
  }
  $('watchBtn').onclick = async function(){ if (current) await markWatched(current.id, !done.has(vidTask(current.id))); };
  $('prevVid').onclick = function(){ if (current) playVideo(current.seriesIdx, current.idx - 1, true); };
  $('nextVid').onclick = function(){ if (current) playVideo(current.seriesIdx, current.idx + 1, true); };

  async function markWatched(id, value){
    await setTask(vidTask(id), value);
    // Finishing every video of one teacher's series completes the chapter's video task.
    const s = series[activeSeries];
    if (value && s && videoMat && s.options.every(function(o){ return done.has(vidTask(youtubeId(o.url))); })) {
      await setTask(chapterMaterialTaskId(subject.id, chapter, videoMat), true);
      if (chapter.wk) await syncFoundationWeekTasks(chapter.wk, Array.from(done));
      renderTasks();
    }
    renderWatchBtn(); renderVideoList();
  }

  window.onYouTubeIframeAPIReady = function(){
    player = new YT.Player('player', {
      host: 'https://www.youtube-nocookie.com',
      playerVars: {rel: 0, modestbranding: 1, playsinline: 1},
      events: {
        onReady: function(){
          playerReady = true;
          if (current) player.cueVideoById({videoId: current.id, startSeconds: Number(store.get('yt-pos-' + current.id)) || 0});
        },
        onStateChange: function(e){
          if (e.data === YT.PlayerState.ENDED && current) {
            store.set('yt-pos-' + current.id, '0');
            markWatched(current.id, true);
          }
        }
      }
    });
  };
  const yt = document.createElement('script');
  yt.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(yt);

  let lastSave = 0;
  setInterval(function(){
    if (!playerReady || !current || typeof player.getCurrentTime !== 'function') return;
    if (player.getPlayerState && player.getPlayerState() !== YT.PlayerState.PLAYING) return;
    const t = player.getCurrentTime();
    if (Date.now() - lastSave > 4000) { store.set('yt-pos-' + current.id, String(Math.floor(t))); lastSave = Date.now(); }
    syncNotes(t, false);
  }, 500);
  function seek(t){
    if (!playerReady) return;
    player.seekTo(t, true);
    player.playVideo();
    syncNotes(t, true);
  }

  // ── Notes, timeline, and the "now" line ──
  async function renderNotes(){
    const el = notesEl();
    curNotes = current ? await loadNotes(current.id) : null;
    const n = curNotes;
    lastSec = -1; lastPt = null;
    updateCounts();
    if (!n) {
      const others = [];
      series.forEach(function(s, si){ s.options.forEach(function(o, i){ const id = youtubeId(o.url); if (notesIndex[id]) others.push({si: si, i: i, o: o}); }); });
      el.innerHTML = '<div class="st-nonotes"><b>這支影片的重點還在整理中。</b><br>影片正在背景轉成文字，整理好之後重點和對應的動畫會自動出現。'
        + (others.length ? '<br><br>這章已經整理好的影片：<br>' + others.map(function(x){ return '・<a data-si="' + x.si + '" data-i="' + x.i + '">' + esc(x.o.label) + '</a>'; }).join('<br>') : '')
        + '</div>';
      el.querySelectorAll('a[data-si]').forEach(function(a){ a.onclick = function(){ playVideo(Number(a.dataset.si), Number(a.dataset.i), true); }; });
      $('timeline').innerHTML = '';
      $('nowSec').textContent = current ? current.opt.label : '';
      $('nowPoint').textContent = hasStage ? '這支影片的重點整理中，右邊先導覽這章的概念' : '這支影片的重點整理中';
      startTour();
      return;
    }
    el.innerHTML = n.sections.map(function(s, si){
      return '<div class="st-sec"><h3>' + esc(s.title) + '</h3>'
        + s.points.map(function(p){ return '<button class="st-pt" data-t="' + p.t + '" data-sec="' + si + '"><span class="st-pt-t">' + fmt(p.t) + '</span><span class="st-pt-text">' + esc(p.text) + '</span></button>'; }).join('')
        + (s.trap ? '<div class="st-trap"><b>易錯</b>　' + esc(s.trap) + '</div>' : '')
        + '</div>';
    }).join('')
      + '<p class="st-src">重點由影片語音轉文字後整理；「易錯」有些是整理時補充的考試提醒，不一定是老師原話。</p>';
    el.querySelectorAll('.st-pt').forEach(function(b){ b.onclick = function(){ seek(Number(b.dataset.t)); }; });
    $('timeline').innerHTML = n.sections.map(function(s, si){
      const t = s.points.length ? s.points[0].t : 0;
      return '<button class="st-seg" data-sec="' + si + '" data-t="' + t + '"><span class="st-seg-t">' + fmt(t) + '</span><span class="st-seg-name">' + esc(s.title) + '</span></button>';
    }).join('');
    $('timeline').querySelectorAll('.st-seg').forEach(function(b){ b.onclick = function(){ seek(Number(b.dataset.t)); }; });
  }
  let lastPt = null, lastSec = -1;
  function syncNotes(t, force){
    if (!curNotes) return;
    // which point / section is being taught at time t
    let secIdx = 0, pt = null;
    curNotes.sections.forEach(function(s, si){
      s.points.forEach(function(p){ if (p.t <= t + 1 && (!pt || p.t >= pt.t)) { pt = p; secIdx = si; } });
    });
    const sec = curNotes.sections[secIdx];
    $('nowSec').textContent = sec.title;
    $('nowPoint').textContent = pt ? pt.text : sec.points[0].text;
    showScene(sec);
    $('timeline').querySelectorAll('.st-seg').forEach(function(b){
      const i = Number(b.dataset.sec);
      b.classList.toggle('active', i === secIdx);
      b.classList.toggle('past', i < secIdx);
    });
    if (secIdx !== lastSec) {
      const a = $('timeline').querySelector('.st-seg.active');
      if (a) $('timeline').scrollTo({left: a.offsetLeft - $('timeline').clientWidth / 2 + a.offsetWidth / 2, behavior: 'smooth'});
      lastSec = secIdx;
    }
    const pts = Array.from(notesEl().querySelectorAll('.st-pt'));
    let active = null;
    pts.forEach(function(b){ const bt = Number(b.dataset.t); if (bt <= t + 1 && (!active || bt >= Number(active.dataset.t))) active = b; });
    pts.forEach(function(b){ b.classList.toggle('past', Number(b.dataset.t) < t && b !== active); b.classList.toggle('active', b === active); });
    if (active && active !== lastPt && (follow || force)) {
      const panel = notesEl();
      if (panel.offsetParent && panel.scrollHeight > panel.clientHeight + 4) {
        const pr = panel.getBoundingClientRect(), ar = active.getBoundingClientRect();
        panel.scrollTo({top: panel.scrollTop + (ar.top - pr.top) - pr.height / 2 + ar.height / 2, behavior: 'smooth'});
      }
    }
    lastPt = active;
  }

  // ── Tabs ──
  const TABS = ['videos', 'full', 'lab', 'res', 'quiz', 'mine', 'goals'];
  function setTab(tab){
    document.querySelectorAll('.st-tabs button').forEach(function(b){ b.setAttribute('aria-selected', String(b.dataset.tab === tab)); });
    TABS.forEach(function(t){ $('panel-' + t).hidden = t !== tab; });
    if (tab === 'lab') renderLab();
    if (tab === 'quiz') renderQuiz();
    if (tab === 'res') renderResources();
    store.set('study-tab', tab);
  }
  document.querySelectorAll('.st-tabs button').forEach(function(b){ b.onclick = function(){ setTab(b.dataset.tab); }; });
  function allVideoIds(){
    const out = [];
    series.forEach(function(s){ s.options.forEach(function(o){ out.push(youtubeId(o.url)); }); });
    return out;
  }
  function updateCounts(){
    const ids = allVideoIds().filter(function(id){ return notesIndex[id]; });
    const q = ids.reduce(function(a, id){ return a + (notesIndex[id].quiz || 0); }, 0);
    document.querySelector('[data-tab=quiz]').innerHTML = '小測驗' + (q ? '<span class="count">' + q + '</span>' : '');
    const cur = current && notesIndex[current.id];
    $('notesCount').textContent = cur ? cur.points + ' 個重點' : '';
    $('fullTab').innerHTML = '重點全文' + (cur ? '<span class="count">' + cur.points + '</span>' : '');
  }

  function renderLab(){
    const el = $('panel-lab');
    if (el.dataset.loaded) return;
    el.dataset.loaded = '1';
    el.innerHTML = '<iframe class="st-lab-frame" src="' + labUrl + '&embed=1" title="互動實驗室" loading="lazy"></iframe>'
      + '<a class="st-lab-open" href="' + labUrl + '" target="_blank" rel="noopener">在新分頁全螢幕開啟實驗室 ↗</a>';
  }

  // ── Extra resources (public/resources.json): visual tools first ──
  let resources = null;
  async function loadResources(){
    try { const r = await fetch('/resources.json'); resources = await r.json(); } catch (e) { resources = null; }
    const n = resources ? ((resources.chapters[subject.id] || {})[chIndex] || []).length : 0;
    $('resTab').innerHTML = '延伸資源' + (n ? '<span class="count">' + n + '</span>' : '');
  }
  const KIND = {visual: '動手看', read: '讀', course: '課程', practice: '練習'};
  function resCard(r){
    return '<a class="st-res st-res-' + esc(r.kind) + '" href="' + esc(r.url) + '" target="_blank" rel="noopener">'
      + '<span class="st-res-kind">' + (KIND[r.kind] || r.kind) + (r.lang ? '・' + esc(r.lang) : '') + '</span>'
      + '<span class="st-res-name">' + esc(r.name) + ' ↗</span>'
      + (r.note ? '<span class="st-res-note">' + esc(r.note) + '</span>' : '') + '</a>';
  }
  function renderResources(){
    const el = $('panel-res');
    if (!resources) { el.innerHTML = '<div class="st-nonotes">延伸資源整理中。</div>'; return; }
    const list = (resources.chapters[subject.id] || {})[chIndex] || [];
    const visual = list.filter(function(r){ return r.kind === 'visual'; });
    const rest = list.filter(function(r){ return r.kind !== 'visual'; });
    const subj = resources.subjects[subject.id] || [];
    el.innerHTML = (visual.length ? '<h3 class="st-res-h">動手看：這章的視覺化工具</h3><div class="st-res-grid st-res-grid-big">' + visual.map(resCard).join('') + '</div>' : '')
      + (rest.length ? '<h3 class="st-res-h">閱讀與練習</h3><div class="st-res-grid">' + rest.map(resCard).join('') + '</div>' : '')
      + (subj.length ? '<h3 class="st-res-h">' + esc(subject.name) + '：其他完整課程</h3><div class="st-res-grid">' + subj.map(resCard).join('') + '</div>' : '')
      + (!list.length && !subj.length ? '<div class="st-nonotes">這章還沒有延伸資源。</div>' : '')
      + '<p class="st-src">所有連結都實際開過確認；外部網站會在新分頁開啟。</p>';
  }

  // ── Quiz ──
  let quizPool = [], quizPos = 0, score = 0, answered = 0;
  async function renderQuiz(){
    if (!quizPool.length) {
      const ids = allVideoIds().filter(function(id){ return notesIndex[id]; });
      for (const id of ids) {
        const n = await loadNotes(id);
        if (n) n.quiz.forEach(function(q){ quizPool.push(Object.assign({src: n.label}, q)); });
      }
      quizPool.sort(function(){ return Math.random() - 0.5; });
    }
    const el = $('panel-quiz');
    if (!quizPool.length) { el.innerHTML = '<div class="st-nonotes">這章影片的重點整理好之後，題目會出現在這裡。</div>'; return; }
    const q = quizPool[quizPos % quizPool.length];
    const opts = q.opts.slice().sort(function(){ return Math.random() - 0.5; });
    el.innerHTML = '<div class="st-quiz"><div class="st-quiz-top"><span>第 ' + (quizPos % quizPool.length + 1) + ' / ' + quizPool.length + ' 題・出自 ' + esc(q.src) + '</span><span>答對 ' + score + ' / ' + answered + '</span></div>'
      + '<div class="st-quiz-q">' + esc(q.q) + '</div><div class="st-quiz-opts">'
      + opts.map(function(o){ return '<button data-o="' + encodeURIComponent(o) + '">' + esc(o) + '</button>'; }).join('') + '</div><div id="quizWhy"></div></div>';
    el.querySelectorAll('.st-quiz-opts button').forEach(function(b){
      b.onclick = function(){
        if (el.querySelector('.right')) return;
        const pick = decodeURIComponent(b.dataset.o);
        answered++; if (pick === q.ans) score++;
        el.querySelectorAll('.st-quiz-opts button').forEach(function(x){
          const o = decodeURIComponent(x.dataset.o);
          if (o === q.ans) x.classList.add('right'); else if (x === b) x.classList.add('wrong');
        });
        $('quizWhy').innerHTML = '<div class="st-quiz-why"><b>' + (pick === q.ans ? '答對了。' : '答錯了。') + '</b>' + esc(q.why) + '</div><button class="st-quiz-next" id="quizNext">下一題</button>';
        $('quizNext').onclick = function(){ quizPos++; renderQuiz(); };
      };
    });
  }

  // ── My notes ──
  let saveTimer = null;
  async function loadMine(){
    try { const r = await fetch('/api/chapter-notes/' + encodeURIComponent(chKey)); const j = await r.json(); $('mineText').value = j.content || ''; renderStamps(); } catch (e) {}
  }
  $('mineText').addEventListener('input', function(){
    $('mineStatus').textContent = '編輯中…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveMine, 800);
    renderStamps();
  });
  async function saveMine(){
    try {
      await fetch('/api/chapter-notes/' + encodeURIComponent(chKey), {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({content: $('mineText').value})});
      $('mineStatus').textContent = '已儲存';
    } catch (e) { $('mineStatus').textContent = '儲存失敗，稍後會再試'; }
  }
  $('stampBtn').onclick = function(){
    if (!current) return;
    const t = playerReady ? player.getCurrentTime() : 0;
    const stamp = '▶ ' + fmt(t) + '〔' + current.id + '〕 ';
    const ta = $('mineText');
    const pos = ta.selectionStart || ta.value.length;
    const before = ta.value.slice(0, pos);
    ta.value = before + (before && !before.endsWith('\n') ? '\n' : '') + stamp + ta.value.slice(pos);
    ta.focus();
    ta.dispatchEvent(new Event('input'));
  };
  function renderStamps(){
    const re = /▶ ([\d:]+)〔([\w-]{11})〕/g; const out = []; let m;
    while ((m = re.exec($('mineText').value))) out.push({t: m[1], id: m[2]});
    $('stamps').innerHTML = out.map(function(x){ return '<button data-id="' + x.id + '" data-t="' + x.t + '">▶ ' + x.t + '</button>'; }).join('');
    $('stamps').querySelectorAll('button').forEach(function(b){
      b.onclick = function(){
        const sec = b.dataset.t.split(':').map(Number).reduce(function(a, x){ return a * 60 + x; }, 0);
        if (current && current.id === b.dataset.id) { seek(sec); return; }
        series.forEach(function(s, si){ s.options.forEach(function(o, i){ if (youtubeId(o.url) === b.dataset.id) playVideo(si, i, true, sec); }); });
      };
    });
  }

  // ── Start ──
  (async function(){
    await Promise.all([loadDone(), loadNotesIndex()]);
    // Starting video: ?v=, else the last one watched here, else the first
    // unwatched video of the remembered (or best-documented) series.
    const want = params.get('v') || store.get('study-last-' + chKey);
    const savedSeries = store.get('study-series-' + chKey);
    let si = Number(savedSeries);
    if (savedSeries === null || !(si >= 0 && si < series.length)) {
      si = 0; let best = -1;
      series.forEach(function(s, i){ const n = seriesNotesCount(s); if (n > best) { best = n; si = i; } });
    }
    let start = null;
    if (want) series.forEach(function(s, a){ s.options.forEach(function(o, b){ if (!start && youtubeId(o.url) === want) start = [a, b]; }); });
    if (!start && series[si]) {
      const firstUnwatched = series[si].options.findIndex(function(o){ return !done.has(vidTask(youtubeId(o.url))); });
      start = [si, Math.max(0, firstUnwatched)];
    }
    renderGoals();
    renderTasks();
    if (start) playVideo(start[0], start[1], false);
    else { $('player').outerHTML = '<div class="st-empty-player">這章沒有指定影片，請直接讀課本與練習題。</div>'; renderSeriesChips(); renderVideoList(); }
    loadMine();
    loadResources();
    $('followChk').onchange = function(e){ follow = e.target.checked; };
    const tab = store.get('study-tab');
    const usable = tab && $('panel-' + tab) && !((tab === 'lab' || tab === 'full') && !hasStage);
    setTab(usable ? tab : 'videos');
  })();
})();
