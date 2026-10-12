// Chapter study room. The video plays on the left; on the right a 3D "stage"
// (the chapter lab in ?stage mode) shows the concept the teacher is talking
// about right now, switching scenes as playback crosses note sections. One
// line under them says what is being taught; a timeline lists the segments.
// Chapters without a lab yet show the synced notes on the right instead.
// Progress uses the same task ids as the main site (chapter-core.js).
(function(){
  // /study/<subj>/<chapter, from 1>?v=<video>&t=<tab>
  const params = new URLSearchParams(location.search);
  const pathParts = location.pathname.split('/').filter(Boolean);
  const subject = SUBJECTS.find(function(s){ return s.id === pathParts[1]; }) || SUBJECTS[0];
  const chIndex = Math.max(0, Math.min(subject.chapters.length - 1, (Number(pathParts[2]) || 1) - 1));
  const chapter = subject.chapters[chIndex];
  const chKey = subject.id + '-' + stableTaskKey(chapter.t);
  // One list: every video of the chapter is required, in teaching order
  // (teacher by teacher, each in playlist order). Kept as a single "series"
  // so the player, next/prev and notes code stay unchanged.
  const display = chapterDisplayMaterials(chapter);
  const series = display.length ? [{name: '本章影片', options: display.map(function(m){
    return {label: m.text, url: m.url, dur: m.dur, note: m.note, topic: m.topic, teacher: m.series};
  })}] : [];
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
  $('backLink').href = '/subjects/' + subject.id + '/' + (chIndex + 1);
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
    $('side').classList.add('is-loading');
    setTimeout(function(){ $('side').classList.remove('is-loading'); }, 15000);
    $('stage').src = labUrl + '&stage=1';
    $('fullTab').hidden = false;
    $('labTab').hidden = false;
  } else {
    $('notesSide').hidden = false;
  }
  let stageScene = null, stageReady = false, pendingScene = null;
  // The stage is ready when lab-shell says so ('lab-ready', sent after its
  // message listener exists). The iframe 'load' event can fire before the
  // chapter module has finished loading, and a scene posted then was lost,
  // leaving the stage empty until the next section change.
  function stageIsReady(){
    if (stageReady) return;
    stageReady = true;
    $('side').classList.remove('is-loading');
    const p = pendingScene; pendingScene = null;
    if (p && p.idle) postIdle(p.idle);
    else if (p && sceneFor(p)) postScene(p);
    else if (p) { stageScene = null; showIdle(IDLE_CHAT); }
    tellStageVisible();
  }
  // Let the stage stop drawing while it's scrolled out of view or the tab
  // is in the background (saves battery and heat on phones).
  let stageOnScreen = true;
  function tellStageVisible(){
    if (!stageReady) return;
    $('stage').contentWindow.postMessage({type: 'visible', visible: stageOnScreen && !document.hidden}, location.origin);
  }
  if (hasStage && 'IntersectionObserver' in window) {
    new IntersectionObserver(function(entries){ stageOnScreen = entries[0].isIntersecting; tellStageVisible(); }).observe($('stage'));
  }
  document.addEventListener('visibilitychange', tellStageVisible);
  // A section's scene, with its step times (cues) and where the section ends,
  // so each step of the animation starts when the lecturer says it.
  function postScene(sec){
    $('stage').contentWindow.postMessage({type: 'scene', scene: sec.scene, params: sec.params || {},
      cues: sec.cues || null, end: sec._end == null ? null : sec._end}, location.origin);
  }
  function postIdle(text){ $('stage').contentWindow.postMessage({type: 'idle', text: text}, location.origin); }
  // Nothing to show (logistics, chat, or no animation for this video yet):
  // a quiet stage rather than an unrelated animation.
  const IDLE_CHAT = '老師在講課務或閒聊';
  const IDLE_NONE = '這支影片的動畫還在製作中';
  function showIdle(text){
    if (!hasStage) return;
    if (stageScene === 'idle:' + text) return;
    stageScene = 'idle:' + text;
    if (stageReady) postIdle(text); else pendingScene = {idle: text};
  }
  window.addEventListener('message', function(e){
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.type === 'lab-ready') { e.data.scenes.forEach(function(x){ stageScenes[x.id] = x; }); stageIsReady(); }
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
    if (!id) { showIdle(IDLE_CHAT); return; }
    const si = curNotes ? curNotes.sections.indexOf(sec) : -1;
    const nxt = si >= 0 ? curNotes.sections[si + 1] : null;
    sec = Object.assign({}, sec, {scene: id, _end: nxt && nxt.points.length ? nxt.points[0].t : null});
    // the section (not just the scene) is the key: two sections may share a
    // scene with different step times
    const key = si + ':' + sec.scene + JSON.stringify(sec.params || {});
    if (key === stageScene) return;
    stageScene = key;
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

  // ── Goals & tasks: concrete, countable, with what is left ──
  function secsLeft(list){ return list.reduce(function(a, m){ return a + durToSec(m.dur); }, 0); }
  function hm(sec){ const h = Math.floor(sec / 3600), m = Math.round(sec % 3600 / 60); return (h ? h + ' 小時 ' : '') + m + ' 分'; }
  // where each key point is taught: public/keymap.json (chapter → point → video parts)
  let keymap = null;
  fetch('/keymap.json', {cache: 'no-cache'}).then(function(r){ return r.ok ? r.json() : null; }).then(function(j){ keymap = j && j[subject.id + '-' + chIndex]; renderGoals(); }).catch(function(){});
  function renderGoals(){
    const vids = chapterDisplayMaterials(chapter);
    const left = vids.filter(function(m){ return !done.has(chapterMaterialTaskId(subject.id, chapter, m)); });
    let sTotal = 0, sLeftN = 0, sLeftSec = 0;
    subject.chapters.forEach(function(c){
      chapterDisplayMaterials(c).forEach(function(m){
        sTotal++;
        if (!done.has(chapterMaterialTaskId(subject.id, c, m))) { sLeftN++; sLeftSec += durToSec(m.dur); }
      });
    });
    const items = String(chapter.key || '').split(/[、；;]/).map(function(x){ return x.trim(); }).filter(Boolean);
    const check = function(id, text){
      const d = done.has(id);
      return '<li><button class="st-check' + (d ? ' done' : '') + '" data-task="' + id + '"><span class="st-box">' + (d ? '✓' : '') + '</span><span class="st-check-text">' + text + '</span></button></li>';
    };
    $('goals').innerHTML =
      '<li class="st-goal-left"><b>還剩多少</b>這章還有 <b>' + left.length + '</b> / ' + vids.length + ' 支影片，約 <b>' + hm(secsLeft(left)) + '</b>。'
      + esc(subject.name) + '整科還有 ' + sLeftN + ' / ' + sTotal + ' 支，約 ' + hm(sLeftSec) + '。</li>'
      + '<li class="st-goal-h">看完要會（點時間跳到影片講這個的地方）</li>'
      + items.map(function(t){
        const k = (keymap && keymap.points || []).find(function(p){ return p.point === t; });
        const where = k && k.where.length
          ? '<span class="st-where">' + k.where.map(function(w){ return '<button type="button" class="st-where-b" data-v="' + w.video + '" data-t="' + w.t + '">' + esc(w.who) + ' ' + fmt(w.t) + '・' + esc(w.sec) + '</button>'; }).join('') + '</span>'
          : '<span class="st-where none">這章的影片沒有找到專門講這一點的段落</span>';
        return check('kp-' + chKey + '-' + stableTaskKey(t), esc(t)) .replace('</li>', where + '</li>');
      }).join('')
      + '<li class="st-src">「看完要會」：自己覺得做到了再打勾。</li>';
    $('goals').querySelectorAll('.st-check').forEach(function(b){
      b.onclick = async function(){ await setTask(b.dataset.task, !done.has(b.dataset.task)); renderGoals(); };
    });
    $('goals').querySelectorAll('.st-where-b').forEach(function(b){
      b.onclick = function(){
        const vi = series[0] ? series[0].options.findIndex(function(o){ return youtubeId(o.url) === b.dataset.v; }) : -1;
        if (vi < 0) return;
        if (current && current.id === b.dataset.v) seek(Number(b.dataset.t)); else playVideo(0, vi, true, Number(b.dataset.t));
        window.scrollTo({top: 0, behavior: 'smooth'});
      };
    });
  }
  function renderTasks(){
    $('tasks').innerHTML = '';
    renderProgress();
  }
  function renderProgress(){
    const s = series[0];
    if (!s) { $('chProg').innerHTML = ''; return; }
    const w = s.options.filter(function(o){ return done.has(vidTask(youtubeId(o.url))); }).length;
    const leftSec = s.options.filter(function(o){ return !done.has(vidTask(youtubeId(o.url))); }).reduce(function(a, o){ return a + durToSec(o.dur); }, 0);
    $('chProg').innerHTML = '<span class="st-pill' + (w === s.options.length ? ' ok' : '') + '">影片 ' + w + '/' + s.options.length + (leftSec ? '・還剩 ' + hm(leftSec) : '') + '</span>';
  }

  // ── Video list ──
  function seriesNotesCount(s){ return s.options.filter(function(o){ return notesIndex[youtubeId(o.url)]; }).length; }
  function renderSeriesChips(){
    $('seriesHint').textContent = series[0] ? '全部 ' + series[0].options.length + ' 支都要看，照順序' : '';
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
  // How far this video's animation is: following the lecturer sentence by
  // sentence, the older section-by-section version, or not made yet.
  function syncState(id){ const n = notesIndex[id]; return !n ? 'none' : n.cued ? 'cued' : 'old'; }
  function syncBadge(id){
    const st = syncState(id);
    // a finished video needs no label; only the unfinished ones say so
    return st === 'cued' ? ''
      : st === 'old' ? '<span class="st-badge old">動畫未逐句</span>' : '<span class="st-badge none">動畫製作中</span>';
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
        + '<span class="st-v-title"><span class="st-v-name">' + esc(o.label) + '</span>' + (o.teacher ? '<small class="st-v-teacher">' + esc(o.teacher) + '</small>' : '') + '</span>'
        + '<span class="st-v-meta">' + esc(o.dur || '') + syncBadge(id) + '</span>'
        + (pct ? '<span class="st-progress"><span style="width:' + pct + '%"></span></span>' : '')
        + '</button>'
        + (videoPlaylistUrl(id) ? '<a class="st-v-pl" href="' + videoPlaylistUrl(id) + '" target="_blank" rel="noopener" title="在原本的 YouTube 播放清單中開啟">播放清單</a>' : '')
        + '</li>';
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
    const st = syncState(id);
    $('syncNote').innerHTML = st === 'cued' ? '' : st === 'old'
      ? '<span class="st-badge old">動畫未逐句</span> 這支影片的動畫還是舊版：一段一段播，不會跟著老師每一句話動（正在改）'
      : '<span class="st-badge none">動畫製作中</span> 這支影片還沒有動畫，可以先看影片和字幕';
    activeSeries = si;
    store.set('study-last-' + chKey, id);
    history.replaceState(null, '', roomUrl(id));
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
    loadSubs(id).then(function(){ showSub(start); });
    if (playerReady) {
      { const er = document.getElementById('ytErr'); if (er) er.hidden = true; }
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
    const wasDone = chapterVideosDone(subject.id, chapter, done);
    await setTask(vidTask(id), value);
    if (value && !wasDone && chapterVideosDone(subject.id, chapter, done)) {
      const p = subjectVideoProgress(subject, done);
      celebrate(chapter.t + ' 完成！', subject.name + ' 已看 ' + p.done + '/' + p.total + ' 支', subject.color);
    }
    // The week's queue task follows the per-video marks (all videos = done).
    if (chapter.wk) await syncFoundationWeekTasks(chapter.wk, Array.from(done));
    renderWatchBtn(); renderVideoList(); renderGoals();
  }

  window.onYouTubeIframeAPIReady = function(){
    player = new YT.Player('player', {
      host: 'https://www.youtube-nocookie.com',
      // YouTube's own captions stay off: the site shows its own (Traditional
      // Chinese, with English under English lectures), timed to the speech
      playerVars: {rel: 0, modestbranding: 1, playsinline: 1, cc_load_policy: 0, iv_load_policy: 3},
      events: {
        onReady: function(){
          playerReady = true;
          document.querySelector('.st-player-wrap').classList.remove('is-loading');
          ytCaptionsOff();
          if (current) player.cueVideoById({videoId: current.id, startSeconds: Number(store.get('yt-pos-' + current.id)) || 0});
        },
        // a video YouTube refuses to embed (owner setting, region, removed)
        // would otherwise leave a black box: say so and offer YouTube itself
        onError: function(e){
          lastYtError = e.data;
          const msg = e.data === 101 || e.data === 150 || e.data === 153 ? '這支影片的作者不允許在其他網站播放'
            : e.data === 100 ? '這支影片已被移除或設為私人' : '這支影片暫時無法播放（錯誤 ' + e.data + '）';
          showPlayerError(msg);
        },
        // the captions module loads late; turn it off the moment it appears
        onApiChange: function(){ ytCaptionsOff(); },
        onStateChange: function(e){
          if (e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.BUFFERING) ytCaptionsOff();
          if (e.data === YT.PlayerState.ENDED && current) {
            store.set('yt-pos-' + current.id, '0');
            markWatched(current.id, true);
            endCard();
          }
        }
      }
    });
  };
  // A viewer's YouTube setting (or the video itself) can turn captions on;
  // unloading the captions module turns them off again on every start.
  function ytCaptionsOff(){
    try { player.setOption('captions', 'track', {}); } catch (e) {}
    try { player.unloadModule('captions'); } catch (e) {}
    try { player.unloadModule('cc'); } catch (e) {}
  }
  // YouTube may switch a caption track back on (viewer setting, auto-translate):
  // check every couple of seconds and turn it off again
  setInterval(function(){
    if (!playerReady || !player.getOption) return;
    try {
      const tr = player.getOption('captions', 'track');
      if (tr && tr.languageCode) ytCaptionsOff();
    } catch (e) {}
  }, 1500);
  let lastYtError = null;
  function showPlayerError(msg){
    let el = document.getElementById('ytErr');
    if (!el) { el = document.createElement('div'); el.id = 'ytErr'; el.className = 'st-yterr'; document.querySelector('.st-player-wrap').appendChild(el); }
    el.innerHTML = '<b>' + esc(msg) + '</b>' + (current ? '<a href="https://www.youtube.com/watch?v=' + current.id + '" target="_blank" rel="noopener">到 YouTube 看這支 ↗</a>' : '');
    el.hidden = false;
  }
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
  // Subtitles follow the player more tightly than the notes (every 200 ms,
  // also while paused or seeking, so the line matches the frame on screen).
  setInterval(function(){
    if (!playerReady || !current || typeof player.getCurrentTime !== 'function') return;
    const t = player.getCurrentTime();
    showSub(t);
    showSkip(t);
    if (stageReady) $('stage').contentWindow.postMessage({type: 'time', t: t}, location.origin);
  }, 200);
  function seek(t){
    if (!playerReady) return;
    player.seekTo(t, true);
    player.playVideo();
    syncNotes(t, true);
    showSub(t);
  }

  // ── Subtitles: the video's timed transcript (captions, or speech-to-text
  // when the video has none), shown over the bottom of the player ──
  let subs = null, subsFor = null, subIdx = -1;
  let subsOn = store.get('study-subs') !== '0';
  async function loadSubs(id){
    subsFor = id; subs = null; subIdx = -1;
    let cues = null;
    try { const r = await fetch('/transcripts/' + id + '.json', {cache: 'no-cache'}); if (r.ok) cues = await r.json(); } catch (e) {}
    if (subsFor !== id) return;
    subs = cues && cues.length ? cues : null;
    $('subBtn').hidden = !subs;
    renderSubBtn();
  }
  function renderSubBtn(){
    $('subBtn').setAttribute('aria-pressed', String(subsOn));
    $('subBtn').textContent = subsOn ? '字幕 開' : '字幕 關';
  }
  $('subBtn').onclick = function(){
    subsOn = !subsOn; store.set('study-subs', subsOn ? '1' : '0'); renderSubBtn(); subIdx = -2;
    if (playerReady) showSub(player.getCurrentTime());
  };
  function showSub(t){
    const el = $('subLine');
    if (!subs || !subsOn) { el.hidden = true; subIdx = -1; return; }
    // binary search for the last cue starting at or before t
    let lo = 0, hi = subs.length - 1, k = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (subs[mid][0] <= t) { k = mid; lo = mid + 1; } else hi = mid - 1; }
    if (k >= 0 && t >= subs[k][1]) k = -1;
    if (k === subIdx) return;
    subIdx = k;
    el.hidden = k < 0;
    // English lectures carry a Chinese line too: Chinese on top, English below.
    if (k >= 0) addCardTerms(subs[k][2] + ' ' + (subs[k][3] || ''));
    if (k >= 0) el.innerHTML = subs[k][3]
      ? '<span class="st-sub-zh">' + esc(subs[k][3]) + '</span><span class="st-sub-en">' + esc(subs[k][2]) + '</span>'
      : '<span class="st-sub-zh">' + esc(subs[k][2]) + '</span>';
  }

  // ── Skip offer: segments checked by hand to be admin / chit-chat only
  // (public/skips.json). A button appears; it never skips by itself. ──
  let skips = {};
  fetch('/skips.json', {cache: 'no-cache'}).then(function(r){ return r.ok ? r.json() : {}; }).then(function(j){ skips = j || {}; }).catch(function(){});
  function showSkip(t){
    const b = $('skipBtn');
    const r = current && (skips[current.id] || []).find(function(x){ return t >= x[0] && t < x[1] - 3; });
    if (!r) { if (!b.hidden) b.hidden = true; return; }
    const key = current.id + r[0];
    if (b.dataset.k !== key) {
      b.dataset.k = key;
      b.innerHTML = '<span>這段是「' + esc(r[2]) + '」，跟考試內容無關</span><b>跳到 ' + fmt(r[1]) + ' ›</b>';
      b.onclick = function(){ seek(r[1]); b.hidden = true; };
    }
    b.hidden = false;
  }

  // ── 講解: the animation step being shown, explained from the basics ──
  // section.explain[k] belongs to step k (the k-th cue); [[term]] marks a
  // word that gets a card from glossary.json (what it is + an everyday picture).
  let glossary = {}, lastTeach = null;
  fetch('/glossary.json', {cache: 'no-cache'}).then(function(r){ return r.ok ? r.json() : {}; }).then(function(g){ glossary = g || {}; lastTeach = null; }).catch(function(){});
  function setTeach(on){
    $('teach').hidden = !on;
    document.querySelector('.st-main').classList.toggle('has-teach', !!on);
  }
  function showTeach(sec, t){
    if ($('teach').hidden) return;
    let k = -1, text, total = sec.cues ? sec.cues.length : 0;
    if (sec.explain && sec.cues) {
      sec.cues.forEach(function(c, i){ if (c <= t + 0.15) k = i; });
      text = sec.explain[Math.max(0, k)];
    } else {
      text = sec.explain_idle || (sec.points[0] && sec.points[0].text) || '';
    }
    const key = sec.title + '|' + k + '|' + Object.keys(glossary).length;
    if (key === lastTeach) return;
    lastTeach = key;
    renderTeach(total ? sec.title + '・第 ' + (Math.max(0, k) + 1) + ' / ' + total + ' 步' : sec.title, text);
  }
  // Term cards. Basic words (程式, 變數 …) are marked "basic" in the glossary
  // and get no card. English keys match whole words, any case, with a plural
  // or -ed/-ing ending. Cards come from the step's explanation and from every
  // subtitle line shown during the step (newest first), so a hard English word
  // the lecturer says gets explained when it appears.
  let termRe = null, termKey = {}, termsGlossLen = -1, cardTerms = [];
  function termMatcher(){
    const n = Object.keys(glossary).length;
    if (n === termsGlossLen) return termRe;
    termsGlossLen = n; termKey = {};
    const keys = Object.keys(glossary).filter(function(k){ return !glossary[k].basic; })
      .sort(function(x, y){ return y.length - x.length; });
    keys.forEach(function(k){ termKey[norm(k)] = k; });
    termRe = keys.length ? new RegExp(keys.map(function(k){
      const q = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // a space and a hyphen count as the same (depth-first / depth first search)
      return /^[\w .'-]+$/.test(k) ? '\\b' + q.replace(/[\s-]+/g, '[\\s-]+') + '(?:s|es|ed|ing)?\\b' : q;
    }).join('|'), 'gi') : null;
    return termRe;
  }
  function norm(w){ return w.toLowerCase().replace(/[\s-]+/g, ' '); }
  function keyFor(w){
    const lw = norm(w);
    return termKey[lw] || termKey[lw.replace(/(?:es|s|ed|ing)$/, '')] || termKey[lw.replace(/(?:s|ed|ing)$/, '')] || null;
  }
  function termsIn(text){
    const re = termMatcher(), out = [];
    if (!re || !text) return out;
    String(text).replace(re, function(w){ const k = keyFor(w); if (k && out.indexOf(k) < 0) out.push(k); return w; });
    return out;
  }
  function markTerms(html){
    const re = termMatcher();
    return re ? html.replace(re, function(w){ return keyFor(w) ? '<span class="st-term-w">' + w + '</span>' : w; }) : html;
  }
  function renderCards(){
    $('teachTerms').innerHTML = cardTerms.slice(0, 6).map(function(k){
      const g = glossary[k];
      const sub = g.zh && g.zh !== k ? g.zh : (g.en && g.en !== k ? g.en : '');
      return '<div class="st-tcard"><h4>' + esc(k) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</h4><p>' + esc(g.what) + '</p>'
        + (g.like ? '<p class="like">' + esc(g.like) + '</p>' : '') + '</div>';
    }).join('');
  }
  // a subtitle line just appeared: its hard words join the cards of this step
  function addCardTerms(text){
    if ($('teach').hidden) return;
    const add = termsIn(text).filter(function(k){ return cardTerms.indexOf(k) < 0; });
    if (!add.length) return;
    cardTerms = add.concat(cardTerms);
    renderCards();
  }
  function renderTeach(head, text){
    $('teachStep').textContent = head;
    const plain = String(text).replace(/\[\[(.+?)\]\]/g, '$1');
    const body = $('teachBody');
    body.innerHTML = markTerms(esc(plain));
    body.classList.remove('swap'); void body.offsetWidth; body.classList.add('swap');
    cardTerms = termsIn(plain);
    renderCards();
  }

  // ── 動畫講解: the cued animation as a walkthrough without the video ──
  // Every step is one sentence of the lecturer (a cue): the learner presses
  // 下一步, sees the step, its explanation and the lecturer's own words, and
  // can jump back into the video at that sentence. Idle (chat) sections are
  // left out. The stage runs the same scenes in manual mode.
  let walk = false, wSteps = [], wi = 0;
  function cuedNotes(){ return !!(curNotes && curNotes.sections.some(function(x){ return x.cues && x.explain; })); }
  function buildWalk(){
    wSteps = [];
    curNotes.sections.forEach(function(sec, si){
      if (!sec.cues || !sec.explain || !sceneFor(sec)) return;
      sec.cues.forEach(function(t, k){ wSteps.push({si: si, k: k + 1, t: t}); });
    });
  }
  function renderWalkBtn(){
    const ok = hasStage && cuedNotes();
    $('walkBtn').hidden = !ok;
    $('walkBtn').textContent = walk ? '回到影片' : '動畫講解';
    $('walkBtn').classList.toggle('on', walk);
    if (!ok && walk) exitWalk(null);
  }
  function enterWalk(){
    if (!cuedNotes()) return;
    buildWalk();
    if (!wSteps.length) return;
    if (playerReady && player.pauseVideo) player.pauseVideo();
    const t = playerReady ? player.getCurrentTime() : 0;
    const saved = Number(store.get('walk-' + current.id));
    wi = 0;
    wSteps.forEach(function(x, i){ if (x.t <= t + 0.5) wi = i; });
    if (t < 1 && saved > 0 && saved < wSteps.length) wi = saved;
    walk = true; stageScene = null;
    document.querySelector('.st-main').classList.add('walk');
    $('walkBar').hidden = false;
    renderWalkBtn(); renderWalk();
    window.scrollTo({top: 0, behavior: 'smooth'});
  }
  function exitWalk(t){
    walk = false; stageScene = null; lastTeach = null; lastSec = -1;
    document.querySelector('.st-main').classList.remove('walk');
    $('walkBar').hidden = true;
    renderWalkBtn();
    if (t != null) seek(t);
    else if (playerReady) syncNotes(player.getCurrentTime(), true);
  }
  function quoteAt(t0, t1){
    if (!subs) return '';
    const zh = [], en = [];
    subs.forEach(function(c){ if (c[0] < t1 - 0.3 && c[1] > t0 + 0.2) { zh.push(c[3] || c[2]); if (c[3]) en.push(c[2]); } });
    return {zh: zh.join(''), en: en.join(' ')};
  }
  function renderWalk(){
    const st = wSteps[wi], sec = curNotes.sections[st.si];
    const key = 'walk:' + st.si;
    if (stageReady) {
      if (stageScene !== key) {
        stageScene = key;
        $('stage').contentWindow.postMessage({type: 'scene', scene: sceneFor(sec), params: sec.params || {}, manual: true, step: st.k}, location.origin);
      } else $('stage').contentWindow.postMessage({type: 'goto', step: st.k}, location.origin);
    }
    store.set('walk-' + current.id, String(wi));
    renderTeach(sec.title + '・第 ' + st.k + ' / ' + sec.cues.length + ' 步（全片 ' + (wi + 1) + ' / ' + wSteps.length + '）', sec.explain[st.k - 1]);
    const next = wSteps[wi + 1];
    const end = next && next.si === st.si ? next.t : st.t + 12;
    const q = quoteAt(st.t, end);
    if (q) addCardTerms(q.zh + ' ' + q.en);
    $('walkQuote').innerHTML = q && q.zh ? '<b>老師這句（' + fmt(st.t) + '）</b><span class="zh">' + esc(q.zh) + '</span>' + (q.en ? '<span class="en">' + esc(q.en) + '</span>' : '') : '';
    $('walkHear').textContent = '▶ 聽老師講這句';
    $('walkHear').onclick = function(){ exitWalk(Math.max(0, st.t - 0.5)); };
    $('walkPrev').disabled = wi === 0;
    $('walkNext').textContent = wi < wSteps.length - 1 ? '下一步 ›' : '這支講完了';
    $('walkNext').disabled = wi >= wSteps.length - 1;
    $('nowSec').textContent = sec.title;
    $('timeline').querySelectorAll('.st-seg').forEach(function(b){
      const i = Number(b.dataset.sec);
      b.classList.toggle('active', i === st.si); b.classList.toggle('past', i < st.si);
    });
  }
  $('walkBtn').onclick = function(){ if (walk) exitWalk(wSteps[wi] ? Math.max(0, wSteps[wi].t - 0.5) : null); else enterWalk(); };
  $('walkNext').onclick = function(){ if (wi < wSteps.length - 1) { wi++; renderWalk(); } };
  $('walkPrev').onclick = function(){ if (wi > 0) { wi--; renderWalk(); } };
  document.addEventListener('keydown', function(e){
    if (!walk || e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); $('walkNext').click(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); $('walkPrev').click(); }
  });

  // ── Notes, timeline, and the "now" line ──
  async function renderNotes(){
    const el = notesEl();
    curNotes = current ? await loadNotes(current.id) : null;
    const n = curNotes;
    lastSec = -1; lastPt = null; lastTeach = null;
    if (walk) exitWalk(null);
    setTeach(n && n.sections.some(function(x){ return x.explain; }));
    renderWalkBtn();
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
      showIdle(IDLE_NONE);
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
    $('timeline').innerHTML = (n.timing === 'estimated' ? '<span class="st-seg-note" title="這支影片的重點時間是用字幕位置推算的，切換可能早或晚一兩分鐘；拿到帶時間的字幕後會校正">時間為估算</span>' : '') + n.sections.map(function(s, si){
      const t = s.points.length ? s.points[0].t : 0;
      return '<button class="st-seg" data-sec="' + si + '" data-t="' + t + '"><span class="st-seg-t">' + fmt(t) + '</span><span class="st-seg-name">' + esc(s.title) + '</span></button>';
    }).join('');
    $('timeline').querySelectorAll('.st-seg').forEach(function(b){ b.onclick = function(){
      if (walk) { const i = wSteps.findIndex(function(x){ return x.si === Number(b.dataset.sec); }); if (i >= 0) { wi = i; renderWalk(); } return; }
      seek(Number(b.dataset.t));
    }; });
    renderWalkBtn();
  }
  // the timeline has no visible scrollbar: a vertical wheel scrolls it sideways
  $('timeline').addEventListener('wheel', function(e){
    const tl = $('timeline');
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || tl.scrollWidth <= tl.clientWidth) return;
    e.preventDefault();
    tl.scrollLeft += e.deltaY;
  }, {passive: false});
  let lastPt = null, lastSec = -1;
  function syncNotes(t, force){
    if (!curNotes || walk) return;
    // which point / section is being taught at time t
    let secIdx = 0, pt = null;
    curNotes.sections.forEach(function(s, si){
      s.points.forEach(function(p){ if (p.t <= t + 1 && (!pt || p.t >= pt.t)) { pt = p; secIdx = si; } });
    });
    const sec = curNotes.sections[secIdx];
    $('nowSec').textContent = sec.title;
    showScene(sec);
    showTeach(sec, t);
    $('timeline').querySelectorAll('.st-seg').forEach(function(b){
      const i = Number(b.dataset.sec);
      b.classList.toggle('active', i === secIdx);
      b.classList.toggle('past', i < secIdx);
    });
    if (secIdx !== lastSec) {
      const a = $('timeline').querySelector('.st-seg.active');
      if (a) $('timeline').scrollTo({left: a.offsetLeft - $('timeline').clientWidth / 2 + a.offsetWidth / 2, behavior: 'smooth'});
      // Playing on from one section into the next (not a jump): quick
      // question on the section that just finished.
      if (!force && lastSec >= 0 && secIdx === lastSec + 1) sectionChallenge(lastSec);
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

  // ── 小挑戰: a quick question after a section, and at the end of a video ──
  // Questions come from the video's own notes quiz. Each is matched to the
  // section whose text shares the most terms with it, so it pops up right
  // after that part is taught; questions that match nothing well are kept
  // for the end-of-video card.
  function terms(text){
    const s = String(text || '').toLowerCase(), out = new Set();
    (s.match(/[a-z][a-z0-9+\-]{2,}/g) || []).forEach(function(w){ out.add(w); });
    const cjk = s.replace(/[^一-鿿]/g, ' ').split(/\s+/);
    cjk.forEach(function(run){ for (let i = 0; i + 1 < run.length; i++) out.add(run.slice(i, i + 2)); });
    return out;
  }
  function quizPlan(n){
    if (n._plan) return n._plan;
    const secTerms = n.sections.map(function(s){
      return terms(s.title + ' ' + s.points.map(function(p){ return p.text; }).join(' ') + ' ' + (s.trap || ''));
    });
    // A question goes after a section only when that section clearly wins:
    // at least 4 shared terms and 1.3× the runner-up (else it waits for the
    // end of the video, where order doesn't matter).
    const bySec = {};
    (n.quiz || []).forEach(function(q, qi){
      const qt = terms(q.q + ' ' + q.ans + ' ' + (q.why || ''));
      const scores = secTerms.map(function(st){ let c = 0; qt.forEach(function(w){ if (st.has(w)) c++; }); return c; });
      const order = scores.map(function(c, si){ return [c, si]; }).sort(function(a, b){ return b[0] - a[0]; });
      const best = order[0], second = order[1] ? order[1][0] : 0;
      if (best && best[0] >= 4 && best[0] >= 1.3 * second && bySec[best[1]] == null) bySec[best[1]] = qi;
    });
    n._plan = {bySec: bySec};
    return n._plan;
  }
  const askedKey = function(id){ return 'qz-asked-' + id; };
  function asked(id){ try { return JSON.parse(store.get(askedKey(id)) || '[]'); } catch (e) { return []; } }
  function markAsked(id, qi){ const a = asked(id); if (a.indexOf(qi) < 0) { a.push(qi); store.set(askedKey(id), JSON.stringify(a)); } }

  // Options in a fresh random order each time, so the answer isn't always first
  function shuffled(a){
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = r[i]; r[i] = r[j]; r[j] = t; }
    return r;
  }
  // One question card. `onDone` runs after the answer (or skip) has shown.
  function questionCard(host, q, onDone){
    q = Object.assign({}, q, {opts: shuffled(q.opts)});
    const card = document.createElement('div');
    card.className = 'st-qz';
    card.innerHTML = '<div class="st-qz-hd">小挑戰</div><div class="st-qz-q">' + esc(q.q) + '</div>'
      + '<div class="st-qz-opts">' + q.opts.map(function(o, i){ return '<button data-i="' + i + '">' + esc(o) + '</button>'; }).join('') + '</div>'
      + '<button class="st-qz-skip">略過</button>';
    host.appendChild(card);
    requestAnimationFrame(function(){ card.classList.add('in'); });
    let answered = false;
    function close(delay){ setTimeout(function(){ card.classList.remove('in'); setTimeout(function(){ card.remove(); if (onDone) onDone(); }, 260); }, delay); }
    card.querySelectorAll('.st-qz-opts button').forEach(function(b){
      b.onclick = function(){
        if (answered) return; answered = true;
        const ok = q.opts[Number(b.dataset.i)] === q.ans;
        card.querySelectorAll('.st-qz-opts button').forEach(function(x){
          if (q.opts[Number(x.dataset.i)] === q.ans) x.classList.add('ok');
        });
        if (!ok) b.classList.add('no');
        card.classList.add(ok ? 'right' : 'wrong');
        card.querySelector('.st-qz-skip').remove();
        const why = document.createElement('div');
        why.className = 'st-qz-why';
        why.textContent = (ok ? '答對！' : '答案是「' + q.ans + '」。') + (q.why ? ' ' + q.why : '');
        card.appendChild(why);
        if (ok) burst(b);
        close(ok ? 2600 : 6000);
      };
    });
    card.querySelector('.st-qz-skip').onclick = function(){ answered = true; close(0); };
    return card;
  }
  // a small spray of colour from the button that was answered right
  function burst(el){
    const r = el.getBoundingClientRect();
    for (let i = 0; i < 14; i++) {
      const p = document.createElement('i');
      p.className = 'st-qz-bit';
      const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 50;
      p.style.left = (r.left + r.width / 2) + 'px'; p.style.top = (r.top + r.height / 2) + 'px';
      p.style.setProperty('--dx', Math.cos(a) * d + 'px'); p.style.setProperty('--dy', Math.sin(a) * d - 20 + 'px');
      p.style.background = ['#2fc092', '#e2a33b', '#4b9ee2', '#d96a8a'][i % 4];
      document.body.appendChild(p);
      setTimeout(function(){ p.remove(); }, 900);
    }
  }
  function sectionChallenge(si){
    if (!curNotes || !current || document.querySelector('.st-qz')) return;
    const qi = quizPlan(curNotes).bySec[si];
    if (qi == null || asked(current.id).indexOf(qi) >= 0) return;
    markAsked(current.id, qi);
    questionCard(document.body, curNotes.quiz[qi]);
  }

  // End of a video: up to two questions not asked yet, then the next video
  // starts after a short countdown (cancel stays on this video).
  function endCard(){
    if (!current) return;
    const wrap = document.querySelector('.st-player-wrap');
    const old = wrap.querySelector('.st-end'); if (old) old.remove();
    const end = document.createElement('div');
    end.className = 'st-end';
    wrap.appendChild(end);
    const id = current.id, idx = current.idx, s = series[current.seriesIdx];
    const left = curNotes && curNotes.quiz ? curNotes.quiz.map(function(q, qi){ return qi; }).filter(function(qi){ return asked(id).indexOf(qi) < 0; }).slice(0, 2) : [];
    function ask(k){
      if (k >= left.length) return next();
      markAsked(id, left[k]);
      questionCard(end, curNotes.quiz[left[k]], function(){ ask(k + 1); });
    }
    function next(){
      const nxt = s && s.options[idx + 1];
      if (!nxt) {
        end.innerHTML = '<div class="st-end-box"><b>這章的影片看完了</b>'
          + (chIndex + 1 < subject.chapters.length ? '<a class="st-btn" href="' + studyRoomUrl(subject.id, chIndex + 1) + '">下一章：' + esc(subject.chapters[chIndex + 1].t) + ' ›</a>' : '')
          + '<button class="st-btn st-end-close">留在這裡</button></div>';
        end.querySelector('.st-end-close').onclick = function(){ end.remove(); };
        return;
      }
      let n = 8;
      end.innerHTML = '<div class="st-end-box"><span class="st-end-sub">下一支</span><b>' + esc(nxt.label) + '</b>'
        + '<div class="st-end-row"><button class="st-btn st-btn-watch st-end-go">現在播放（<span>' + n + '</span>）</button><button class="st-btn st-end-close">取消</button></div></div>';
      const tick = setInterval(function(){
        n--; const sp = end.querySelector('.st-end-go span'); if (sp) sp.textContent = n;
        if (n <= 0) go();
      }, 1000);
      function go(){ clearInterval(tick); end.remove(); playVideo(current.seriesIdx, idx + 1, true); }
      end.querySelector('.st-end-go').onclick = go;
      end.querySelector('.st-end-close').onclick = function(){ clearInterval(tick); end.remove(); };
    }
    ask(0);
  }
  // Development aid, like the lab's __labCheck: trigger the cards by hand.
  window.__studyCheck = {sectionChallenge: sectionChallenge, endCard: endCard, plan: function(){ return curNotes && quizPlan(curNotes); }, seek: function(t){ if (playerReady) player.seekTo(t, true); }, yt: function(){ return player && playerReady ? {cc: (function(){ try { return player.getOption('captions', 'track'); } catch (e) { return 'n/a'; } })(), state: player.getPlayerState(), data: player.getVideoData(), err: lastYtError} : {ready: playerReady}; }};

  // ── Tabs ──
  const TABS = ['videos', 'full', 'lab', 'quiz', 'goals'];
  // The address carries the open video (v) and the open tab (t), so a
  // refresh or a shared link reopens exactly this view.
  let currentTab = 'videos';
  function roomUrl(id){
    const u = videoRoomUrl(subject.id, chIndex, id || (current && current.id));
    return u + (currentTab !== 'videos' ? (u.indexOf('?') < 0 ? '?' : '&') + 't=' + currentTab : '');
  }
  function setTab(tab){
    currentTab = tab;
    history.replaceState(null, '', roomUrl());
    document.querySelectorAll('.st-tabs button').forEach(function(b){ b.setAttribute('aria-selected', String(b.dataset.tab === tab)); });
    TABS.forEach(function(t){ $('panel-' + t).hidden = t !== tab; });
    if (tab === 'lab') renderLab();
    if (tab === 'quiz') renderQuiz();
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
    el.classList.add('is-loading');
    el.innerHTML = '<iframe class="st-lab-frame" src="' + labUrl + '&embed=1" title="互動實驗室" loading="lazy" scrolling="no"></iframe>';
    // the frame is as tall as the lab's own content, so no blank space below it
    const fr = el.querySelector('iframe');
    fr.addEventListener('load', function(){
      fr.classList.add('ready'); el.classList.remove('is-loading');
      try {
        const doc = fr.contentDocument;
        // no scrollbars inside the lab (the frame grows to fit it anyway)
        const st = doc.createElement('style');
        st.textContent = '*{scrollbar-width:none}*::-webkit-scrollbar{display:none}html,body{overflow:hidden}';
        doc.head.appendChild(st);
        const fit = function(){ fr.style.height = Math.max(320, Math.ceil(doc.documentElement.getBoundingClientRect().height), doc.body.scrollHeight) + 'px'; };
        fit();
        const ro = new ResizeObserver(fit); ro.observe(doc.body); ro.observe(doc.documentElement);
        if (doc.body.firstElementChild) ro.observe(doc.body.firstElementChild);
        [300, 1000, 2500].forEach(function(t){ setTimeout(fit, t); });
      } catch (e) {}
    });
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
    const opts = shuffled(q.opts);
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
    else { $('player').outerHTML = '<div class="st-empty-player">這章沒有指定影片。</div>'; renderSeriesChips(); renderVideoList(); }
    $('followChk').onchange = function(e){ follow = e.target.checked; };
    const tab = new URLSearchParams(location.search).get('t') || store.get('study-tab');
    const usable = tab && $('panel-' + tab) && !((tab === 'lab' || tab === 'full') && !hasStage);
    setTab(usable ? tab : 'videos');
  })();
})();
