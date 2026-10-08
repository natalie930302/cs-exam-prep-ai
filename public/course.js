// Chapter course: the chapter taught concept by concept, from zero, in the
// order of public/course/<subject>-<n>.json. Each lesson has three phases:
//   ① 先搞懂 — the chapter lab's scene in manual mode: the learner presses
//     下一步 and each step comes with a plain explanation (+ term cards);
//   ② 看老師講 — only the clearest segments of the lecture videos for this
//     concept (clips: video, from, to), with subtitles and the skip offer;
//   ③ 小檢查 — two or three questions, then the lesson is done.
// Lessons are tasks les-<chKey>-<id>; a lecture video counts as watched once
// every lesson that uses it is done (videos no lesson uses: when all are).
(function(){
  const params = new URLSearchParams(location.search);
  const subject = SUBJECTS.find(function(s){ return s.id === params.get('s'); }) || SUBJECTS[0];
  const chIndex = Math.max(0, Math.min(subject.chapters.length - 1, Number(params.get('c')) || 0));
  const chapter = subject.chapters[chIndex];
  const chKey = subject.id + '-' + stableTaskKey(chapter.t);
  const labUrl = chapterLabUrl(subject.id, chIndex);
  const $ = function(id){ return document.getElementById(id); };
  const esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };
  const fmt = function(t){ t = Math.max(0, Math.floor(t)); const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };
  const store = {
    get: function(k){ try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function(k, v){ try { localStorage.setItem(k, v); } catch (e) {} }
  };
  document.body.style.setProperty('--subj', 'var(--' + subject.id + ')');

  let course = null, done = new Set(), glossary = {}, skips = {};
  let li = 0, phase = 1, stepK = 1, clipI = 0;
  const lessonTask = function(l){ return 'les-' + chKey + '-' + l.id; };

  // ── data ──
  async function load(){
    const get = function(u){ return fetch(u).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; }); };
    const r = await Promise.all([get('/course/' + subject.id + '-' + (chIndex + 1) + '.json'), get('/api/tasks/done'), get('/glossary.json'), get('/skips.json')]);
    course = r[0]; done = new Set((r[1] && r[1].done) || []); glossary = r[2] || {}; skips = r[3] || {};
  }
  async function setTask(id, value){
    await fetch('/api/tasks/' + encodeURIComponent(id) + '/set', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({done: value})});
    if (value) done.add(id); else done.delete(id);
  }

  // ── lesson list and progress ──
  function renderLessons(){
    $('lessons').innerHTML = course.lessons.map(function(l, i){
      const d = done.has(lessonTask(l));
      return '<li class="' + (i === li ? 'cur ' : '') + (d ? 'done' : '') + '"><button type="button" data-i="' + i + '">'
        + '<span class="co-ln">' + (d ? '✓' : i + 1) + '</span><span class="co-lt">' + esc(l.title) + '</span>'
        + (l.clips && l.clips.length ? '' : '<span class="co-tag">網站自教</span>') + '</button></li>';
    }).join('');
    $('lessons').querySelectorAll('button').forEach(function(b){ b.onclick = function(){ openLesson(Number(b.dataset.i), 1); }; });
    const n = course.lessons.filter(function(l){ return done.has(lessonTask(l)); }).length;
    $('coProg').innerHTML = '<span class="st-pill' + (n === course.lessons.length ? ' ok' : '') + '">課 ' + n + '/' + course.lessons.length + '</span>';
  }

  // ── terms: every glossary word in a text is marked and gets a card ──
  function marked(text, seen){
    const keys = Object.keys(glossary).sort(function(x, y){ return y.length - x.length; });
    const re = keys.length ? new RegExp(keys.map(function(k){
      const q = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return /^[\w ]+$/.test(k) ? '\\b' + q + '\\b' : q;
    }).join('|'), 'g') : null;
    let html = esc(String(text || '').replace(/\[\[(.+?)\]\]/g, '$1'));
    if (re) html = html.replace(re, function(w){ if (seen.indexOf(w) < 0) seen.push(w); return '<span class="st-term-w">' + w + '</span>'; });
    return html;
  }
  function cards(seen){
    return seen.filter(function(w){ return glossary[w]; }).map(function(w){
      const g = glossary[w];
      return '<div class="st-tcard"><h4>' + esc(w) + (g.en && g.en !== w ? '<small>' + esc(g.en) + '</small>' : '') + '</h4><p>' + esc(g.what) + '</p>'
        + (g.like ? '<p class="like">' + esc(g.like) + '</p>' : '') + '</div>';
    }).join('');
  }

  // ── phases ──
  function lesson(){ return course.lessons[li]; }
  function hasClips(){ return !!(lesson().clips && lesson().clips.length); }
  function openLesson(i, p){
    li = Math.max(0, Math.min(course.lessons.length - 1, i));
    store.set('course-' + chKey, String(li));
    const l = lesson();
    $('lNum').textContent = '第 ' + (li + 1) + ' / ' + course.lessons.length + ' 課';
    $('lTitle').textContent = l.title;
    $('lWhy').textContent = l.why || '';
    $('phases').querySelector('[data-p="2"]').hidden = !hasClips();
    renderLessons();
    stepK = 1; clipI = 0;
    showPhase(p || 1);
    window.scrollTo({top: 0, behavior: 'smooth'});
  }
  function showPhase(p){
    if (p === 2 && !hasClips()) p = 3;
    phase = p;
    [1, 2, 3].forEach(function(k){ $('p' + k).hidden = k !== p; });
    $('phases').querySelectorAll('li').forEach(function(x){ const k = Number(x.dataset.p); x.classList.toggle('cur', k === p); x.classList.toggle('past', k < p); });
    if (p !== 2 && playerReady) player.pauseVideo();
    if (p === 1) startScene();
    if (p === 2) startClip(clipI);
    if (p === 3) renderCheck();
  }
  $('phases').querySelectorAll('li').forEach(function(x){ x.querySelector('button').onclick = function(){ showPhase(Number(x.dataset.p)); }; });

  // ① stage + explanation, one step per 下一步
  let stageReady = false, pending = null;
  function post(msg){ if (stageReady) $('stage').contentWindow.postMessage(msg, location.origin); else pending = msg; }
  window.addEventListener('message', function(e){
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.type === 'lab-ready') { stageReady = true; if (pending) { const m = pending; pending = null; post(m); } }
  });
  function startScene(){
    const l = lesson();
    if (l.scene) post({type: 'scene', scene: l.scene, params: l.params || {}, manual: true, step: stepK});
    else post({type: 'idle', text: ''});
    renderStep();
  }
  function renderStep(){
    const l = lesson(), n = (l.explain || []).length;
    const seen = [];
    $('teachStep').textContent = n ? '第 ' + stepK + ' / ' + n + ' 步' : '';
    const body = $('teachBody');
    body.innerHTML = marked((l.explain || [])[stepK - 1], seen);
    body.classList.remove('swap'); void body.offsetWidth; body.classList.add('swap');
    $('teachTerms').innerHTML = cards(seen);
    $('prevStep').disabled = stepK <= 1;
    $('nextStep').textContent = stepK < n ? '下一步 ›' : (hasClips() ? '懂了，看老師講 ›' : '懂了，做小檢查 ›');
  }
  $('nextStep').onclick = function(){
    const n = (lesson().explain || []).length;
    if (stepK < n) { stepK++; post({type: 'goto', step: stepK}); renderStep(); }
    else showPhase(2);
  };
  $('prevStep').onclick = function(){
    if (stepK > 1) { stepK--; post({type: 'goto', step: stepK}); renderStep(); }
  };
  document.addEventListener('keydown', function(e){
    if (phase !== 1 || e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowRight') $('nextStep').click();
    if (e.key === 'ArrowLeft') $('prevStep').click();
  });

  // ② clips
  let player = null, playerReady = false, clipVideo = null, subs = null, subsFor = null, subIdx = -1;
  let subsOn = store.get('study-subs') !== '0';
  function clipLabel(c){
    const v = findVideo(c.video);
    return (v ? v.series || v.text : c.video) + '・' + fmt(c.from) + '–' + fmt(c.to);
  }
  function findVideo(id){
    let out = null;
    chapterDisplayMaterials(chapter).forEach(function(m){ if (m.videoId === id) out = m; });
    return out;
  }
  function renderClips(){
    const cs = lesson().clips;
    $('clips').innerHTML = cs.map(function(c, i){
      return '<button type="button" class="co-clip' + (i === clipI ? ' cur' : '') + '" data-i="' + i + '"><span class="co-clip-n">片段 ' + (i + 1) + '/' + cs.length + '</span>'
        + '<span class="co-clip-what">' + esc(c.what || '') + '</span><span class="co-clip-src">' + esc(clipLabel(c)) + '</span></button>';
    }).join('');
    $('clips').querySelectorAll('button').forEach(function(b){ b.onclick = function(){ startClip(Number(b.dataset.i)); }; });
  }
  function startClip(i){
    const cs = lesson().clips;
    clipI = Math.max(0, Math.min(cs.length - 1, i));
    const c = cs[clipI];
    renderClips();
    $('clipDone').hidden = true;
    $('clipNext').textContent = clipI < cs.length - 1 ? '這段看完了，下一段 ›' : '看完了，做小檢查 ›';
    if (!playerReady) return;
    if (clipVideo !== c.video) { clipVideo = c.video; loadSubs(c.video); }
    player.loadVideoById({videoId: c.video, startSeconds: c.from, endSeconds: c.to});
  }
  $('clipNext').onclick = function(){
    const cs = lesson().clips;
    if (clipI < cs.length - 1) startClip(clipI + 1); else showPhase(3);
  };
  window.onYouTubeIframeAPIReady = function(){
    player = new YT.Player('player', {
      playerVars: {rel: 0, modestbranding: 1, playsinline: 1, cc_load_policy: 0},
      events: {
        onReady: function(){ playerReady = true; if (phase === 2) startClip(clipI); },
        onStateChange: function(e){
          if (e.data === YT.PlayerState.ENDED && phase === 2) {
            $('clipDone').hidden = false;
            $('clipDone').innerHTML = '<b>這段看完了</b><button class="st-btn co-primary" type="button">' + esc($('clipNext').textContent) + '</button>';
            $('clipDone').querySelector('button').onclick = function(){ $('clipNext').click(); };
          }
        }
      }
    });
  };
  const yt = document.createElement('script'); yt.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(yt);
  async function loadSubs(id){
    subsFor = id; subs = null; subIdx = -1;
    let cues = null;
    try { const r = await fetch('/transcripts/' + id + '.json'); if (r.ok) cues = await r.json(); } catch (e) {}
    if (subsFor === id) subs = cues && cues.length ? cues : null;
  }
  function renderSubBtn(){ $('subBtn').setAttribute('aria-pressed', String(subsOn)); $('subBtn').textContent = subsOn ? '字幕 開' : '字幕 關'; }
  $('subBtn').onclick = function(){ subsOn = !subsOn; store.set('study-subs', subsOn ? '1' : '0'); renderSubBtn(); subIdx = -2; };
  renderSubBtn();
  function showSub(t){
    const el = $('subLine');
    if (!subs || !subsOn) { el.hidden = true; subIdx = -1; return; }
    let lo = 0, hi = subs.length - 1, k = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (subs[mid][0] <= t) { k = mid; lo = mid + 1; } else hi = mid - 1; }
    if (k >= 0 && t >= subs[k][1]) k = -1;
    if (k === subIdx) return;
    subIdx = k; el.hidden = k < 0;
    if (k >= 0) el.innerHTML = subs[k][3]
      ? '<span class="st-sub-zh">' + esc(subs[k][3]) + '</span><span class="st-sub-en">' + esc(subs[k][2]) + '</span>'
      : '<span class="st-sub-zh">' + esc(subs[k][2]) + '</span>';
  }
  function showSkip(t){
    const b = $('skipBtn');
    const r = clipVideo && (skips[clipVideo] || []).find(function(x){ return t >= x[0] && t < x[1] - 3; });
    if (!r) { b.hidden = true; return; }
    b.innerHTML = '<span>這段是「' + esc(r[2]) + '」，跟考試內容無關</span><b>跳到 ' + fmt(r[1]) + ' ›</b>';
    b.onclick = function(){ player.seekTo(r[1], true); b.hidden = true; };
    b.hidden = false;
  }
  setInterval(function(){
    if (phase !== 2 || !playerReady || typeof player.getCurrentTime !== 'function') return;
    const t = player.getCurrentTime(), c = lesson().clips[clipI];
    showSub(t); showSkip(t);
    if (c) $('clipTime').textContent = fmt(Math.max(0, t - c.from)) + ' / ' + fmt(c.to - c.from);
  }, 200);

  // ③ check
  function renderCheck(){
    const l = lesson(), qs = l.check || [];
    let right = 0, answered = 0;
    const el = $('check');
    el.innerHTML = (qs.length ? '<p class="co-check-hint">答完這 ' + qs.length + ' 題就完成這一課。答錯沒關係，看完解釋再往下。</p>' : '')
      + qs.map(function(q, qi){
        const opts = q.opts.slice().sort(function(){ return Math.random() - 0.5; });
        return '<div class="st-quiz co-q" data-q="' + qi + '"><div class="st-quiz-q">' + (qi + 1) + '. ' + esc(q.q) + '</div><div class="st-quiz-opts">'
          + opts.map(function(o){ return '<button type="button" data-o="' + encodeURIComponent(o) + '">' + esc(o) + '</button>'; }).join('') + '</div><div class="co-why"></div></div>';
      }).join('')
      + '<div class="co-finish" id="finish"' + (qs.length ? ' hidden' : '') + '><button class="st-btn co-primary" type="button" id="finishBtn">完成這一課 ›</button></div>';
    el.querySelectorAll('.co-q').forEach(function(box){
      const q = qs[Number(box.dataset.q)];
      box.querySelectorAll('button').forEach(function(b){
        b.onclick = function(){
          if (box.classList.contains('answered')) return;
          box.classList.add('answered'); answered++;
          const pick = decodeURIComponent(b.dataset.o);
          if (pick === q.ans) right++;
          box.querySelectorAll('button').forEach(function(x){
            const o = decodeURIComponent(x.dataset.o);
            if (o === q.ans) x.classList.add('right'); else if (x === b) x.classList.add('wrong');
          });
          const seen = [];
          box.querySelector('.co-why').innerHTML = '<div class="st-quiz-why"><b>' + (pick === q.ans ? '答對了。' : '答錯了。') + '</b>' + marked(q.why, seen) + '</div>';
          if (answered === qs.length) { $('finish').hidden = false; $('finishBtn').textContent = '答對 ' + right + ' / ' + qs.length + '・完成這一課 ›'; }
        };
      });
    });
    $('finishBtn').onclick = finishLesson;
  }
  async function finishLesson(){
    const l = lesson();
    await setTask(lessonTask(l), true);
    // a lecture video is watched once every lesson that uses it is done
    const all = course.lessons;
    const allDone = all.every(function(x){ return done.has(lessonTask(x)); });
    for (const m of chapterDisplayMaterials(chapter)) {
      const users = all.filter(function(x){ return (x.clips || []).some(function(c){ return c.video === m.videoId; }); });
      const ok = users.length ? users.every(function(x){ return done.has(lessonTask(x)); }) : allDone;
      const id = chapterMaterialTaskId(subject.id, chapter, m);
      if (ok && !done.has(id)) await setTask(id, true);
    }
    renderLessons();
    if (allDone) { if (typeof celebrate === 'function') celebrate(chapter.t + ' 完成！', '這章 ' + all.length + ' 課都上完了', 'var(--' + subject.id + ')'); return; }
    const next = all.findIndex(function(x, i){ return i > li && !done.has(lessonTask(x)); });
    openLesson(next >= 0 ? next : all.findIndex(function(x){ return !done.has(lessonTask(x)); }), 1);
  }

  // ── start ──
  (async function(){
    await load();
    $('kicker').textContent = subject.name + '・第 ' + (chIndex + 1) + ' 章・概念課程';
    $('chTitle').textContent = chapter.t;
    document.title = chapter.t + '｜課程';
    $('videosLink').href = videoRoomUrl(subject.id, chIndex);
    if (!course) { $('lesson').innerHTML = '<div class="st-nonotes">這章的課程還在製作中。<a href="' + videoRoomUrl(subject.id, chIndex) + '">先用影片學 ›</a></div>'; return; }
    if (labUrl) $('stage').src = labUrl + '&stage=1';
    else $('stage').hidden = true;
    const sv = store.get('course-' + chKey), saved = sv === null ? -1 : Number(sv);
    const firstUndone = course.lessons.findIndex(function(x){ return !done.has(lessonTask(x)); });
    const want = params.get('l') ? course.lessons.findIndex(function(x){ return x.id === params.get('l'); }) : -1;
    openLesson(want >= 0 ? want : (saved >= 0 && saved < course.lessons.length ? saved : Math.max(0, firstUndone)), 1);
  })();
})();
