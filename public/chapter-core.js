// Shared chapter/material helpers used by both the main site (app.js) and
// the chapter study room (study.js). Plain globals on purpose: both pages
// load this file with a classic <script> right after data.js.

// Stable task IDs are derived from content, never array position. This keeps
// completion records attached to the same chapter/material after future edits.
function stableTaskKey(value){
  const text = String(value || '').trim().toLowerCase();
  let hash = 2166136261;
  for(let i=0;i<text.length;i++){
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
function videoSeriesName(label){
  const text = String(label || '');
  const rules = [
    [/林軒田/,'台大 林軒田 DSA'],[/彭文志/,'交大OCW 彭文志'],[/江蕙如/,'交大OCW 江蕙如'],
    [/易志偉/,'交大OCW 易志偉'],[/周志遠/,'清大OCW 周志遠'],[/趙啟超/,'清大OCW 趙啟超'],
    [/黃婷婷/,'清大 黃婷婷'],[/韓永楷/,'清大 韓永楷'],[/Abdul Bari/i,'Abdul Bari'],
    [/3Blue1Brown/i,'3Blue1Brown'],[/MIT(?: OCW)? 6\.006/i,'MIT OCW 6.006'],
    [/MIT(?: OCW)? 18\.06/i,'MIT OCW 18.06']
  ];
  for(let i=0;i<rules.length;i++) if(rules[i][0].test(text)) return rules[i][1];
  return '';
}
// Sort key for a video inside one teacher's series. Playlist position first
// (video-order.js — the order the course is actually taught), then lecture
// numbers parsed from the title: 第12B講 → 12·10+2, Abdul Bari's 1.5.2 →
// 1·10000+5·100+2, Lec/Lecture/L n → n·10, Rec n → n·10+5. Unknown titles
// keep their original order after everything else.
function videoSequenceNumber(label, fallback, url){
  const id = youtubeId(url);
  if (typeof VIDEO_ORDER !== 'undefined' && id && VIDEO_ORDER[id]) return VIDEO_ORDER[id];
  return videoTitleNumber(label, fallback);
}
function videoTitleNumber(label, fallback){
  const text = String(label || '');
  let m = text.match(/第\s*0*(\d+)\s*([A-Za-z])?\s*講/);
  if (m) return Number(m[1]) * 10 + (m[2] ? m[2].toUpperCase().charCodeAt(0) - 64 : 0);
  m = text.match(/(?:^|[：:]\s*)(\d+(?:\.\d+)*)\.?\s/);
  if (m) { const p = m[1].split('.').map(Number); return p[0] * 10000 + (p[1] || 0) * 100 + (p[2] || 0); }
  m = text.match(/\bRec(?:itation)?\s*0*(\d+)/i);
  if (m) return Number(m[1]) * 10 + 5;
  m = text.match(/\b(?:Lec(?:ture)?|L)\s*0*(\d+)/i);
  if (m) return Number(m[1]) * 10;
  m = text.match(/\bCh(?:apter)?\s*0*(\d+)/i);
  if (m) return Number(m[1]) * 10;
  return 1000000 + fallback;
}
function groupVideoSeries(options){
  const groups = [];
  const map = {};
  options.forEach(function(option,index){
    const name = videoSeriesName(option.label);
    if(!map[name]){
      map[name] = {name:name,options:[],firstIndex:index};
      groups.push(map[name]);
    }
    map[name].options.push(Object.assign({},option,{sourceIndex:index,sequence:videoSequenceNumber(option.label,index,option.url)}));
  });
  groups.forEach(function(group){
    // Playlist positions and title numbers are different scales: only use
    // playlist order when every video of the series has one.
    const allInPlaylist = typeof VIDEO_ORDER !== 'undefined' && group.options.every(function(o){ return VIDEO_ORDER[youtubeId(o.url)]; });
    if (!allInPlaylist) group.options.forEach(function(o){ o.sequence = videoTitleNumber(o.label, o.sourceIndex); });
    group.options.sort(function(a,b){ return a.sequence-b.sequence || a.sourceIndex-b.sourceIndex; });
    group.topics = Array.from(new Set(group.options.map(function(o){ return o.topic; }).filter(Boolean)));
  });
  return groups.sort(function(a,b){ return a.firstIndex-b.firstIndex; });
}
// A chapter's materials are its videos and nothing else: every video of every
// teacher's series is required, each one its own task. Order is the teaching
// order — teachers in the order the chapter lists them, each teacher's videos
// in playlist order — and a video listed twice in a chapter appears once.
function chapterDisplayMaterials(c){
  const options = [];
  c.mats.forEach(function(m){
    if(m.type === 'vidgroup') m.options.forEach(function(o){ options.push(Object.assign({},o,{topic:m.text})); });
    else if(m.type === 'vid') options.push({label:m.text,url:m.url,dur:m.dur,note:m.note,topic:''});
  });
  const videos = [], seen = new Set();
  groupVideoSeries(options).forEach(function(series){
    series.options.forEach(function(o){
      const id = youtubeId(o.url);
      if(id && seen.has(id)) return;
      if(id) seen.add(id);
      videos.push({type:'vid',text:o.label,url:o.url,dur:o.dur,note:o.note,topic:o.topic,series:series.name,videoId:id,
        taskKey:id ? 'vid-'+id : 'vid-'+stableTaskKey(o.label)});
    });
  });
  return videos;
}
// The video opened inside its original YouTube course playlist, or '' when
// it isn't part of one of the tracked playlists (video-order.js).
function videoPlaylistUrl(videoId){
  const list = typeof VIDEO_PLAYLIST !== 'undefined' && VIDEO_PLAYLIST[videoId];
  return list ? 'https://www.youtube.com/watch?v='+videoId+'&list='+list : '';
}
// Video tasks are shared with the study room, which marks 'vid-<youtube id>'.
function chapterMaterialTaskId(subjectId, chapter, material){
  if(material.videoId) return 'vid-'+material.videoId;
  return 'mat-v2-'+subjectId+'-'+stableTaskKey(chapter.t)+'-'+material.taskKey;
}
function weekMaterialTasks(wk){
  const rows = [];
  SUBJECTS.forEach(function(s){
    s.chapters.forEach(function(c){
      if(c.wk !== wk) return;
      chapterDisplayMaterials(c).forEach(function(m){
        rows.push({id:chapterMaterialTaskId(s.id,c,m),type:m.type});
      });
    });
  });
  return rows;
}
// A foundation week's single queue task (w<N>-video) is done once every video
// of every chapter scheduled in that week is done.
async function syncFoundationWeekTasks(wk, doneIds){
  if(!wk) return;
  const rows = weekMaterialTasks(wk);
  if(!rows.length) return;
  const done = new Set(doneIds);
  await fetch('/api/tasks/w'+wk+'-video/set', {
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({done:rows.every(function(r){ return done.has(r.id); })})
  });
}

// Interactive 3D chapter labs (public/lab/). Keyed by subject id, then
// 0-based chapter index. The study room shows a 互動實驗室 tab only for
// chapters listed here.
// Chapters whose lab module exists in public/lab/chapters/<subject>-<n>.js
// (n = 1-based chapter number). Add an entry when a chapter's lab ships.
const CHAPTER_LABS = {
  ds:[1,2,3,4,5,6,7,8,9,10,11],
  alg:[1,2,3,4,5,6,7,8,9,10],
  os:[1,2,3,4,5,6,7,8,9,10,11],
  la:[1,2,3,4,5,6,7,8,9],
  dm:[1,2,3,4,5,6,7,8,9,10],
  ca:[1,2,3,4,5,6,7,8]
};
function chapterLabUrl(subjectId, idx){
  return (CHAPTER_LABS[subjectId]||[]).indexOf(idx+1) !== -1 ? '/lab/lab.html?ch='+subjectId+'-'+(idx+1) : '';
}
function studyRoomUrl(subjectId, idx, videoId){
  return videoRoomUrl(subjectId, idx, videoId);
}
function videoRoomUrl(subjectId, idx, videoId){
  return '/study/'+encodeURIComponent(subjectId)+'/'+(idx+1)+(videoId?'?v='+encodeURIComponent(videoId):'');
}
function youtubeId(url){
  const m = String(url || '').match(/(?:v=|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : '';
}

// Share of a subject's videos already watched: {done, total}.
function subjectVideoProgress(subject, doneSet){
  let done = 0, total = 0;
  subject.chapters.forEach(function(c){
    chapterDisplayMaterials(c).forEach(function(m){
      total++;
      if(doneSet.has(chapterMaterialTaskId(subject.id, c, m))) done++;
    });
  });
  return {done:done, total:total};
}
function chapterVideosDone(subjectId, chapter, doneSet){
  const videos = chapterDisplayMaterials(chapter);
  return videos.length > 0 && videos.every(function(m){ return doneSet.has(chapterMaterialTaskId(subjectId, chapter, m)); });
}

// A short, quiet celebration when a whole chapter is finished: a card that
// rises in the middle of the screen with a burst of confetti, gone in ~2.4 s.
// Self-contained (injects its own styles) so both pages can use it.
function celebrate(title, sub, color){
  if(!document.getElementById('celebrateCss')){
    const css = document.createElement('style'); css.id = 'celebrateCss';
    css.textContent = '.cel-wrap{position:fixed;inset:0;pointer-events:none;z-index:9999;display:grid;place-items:center}'
      +'.cel-card{background:var(--surf,#fff);color:var(--tx,#2e2418);border:1px solid var(--bd,#e6dccb);border-radius:18px;padding:18px 26px;text-align:center;'
      +'box-shadow:0 18px 50px rgba(60,40,10,.18);animation:celIn .5s cubic-bezier(.2,1.4,.4,1) both, celOut .4s ease-in 2s both}'
      +'.cel-card b{display:block;font-size:20px;margin-bottom:4px}.cel-card span{font-size:13px;color:var(--mt,#8a7a62)}'
      +'.cel-bit{position:absolute;left:50%;top:50%;width:8px;height:12px;border-radius:2px;animation:celBurst 1.5s cubic-bezier(.15,.7,.3,1) forwards}'
      +'@keyframes celIn{from{opacity:0;transform:translateY(18px) scale(.9)}to{opacity:1;transform:none}}'
      +'@keyframes celOut{to{opacity:0;transform:translateY(-10px)}}'
      +'@keyframes celBurst{0%{transform:translate(-50%,-50%) rotate(0);opacity:1}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) rotate(var(--r));opacity:0}}'
      +'@media (prefers-reduced-motion:reduce){.cel-bit{display:none}.cel-card{animation:celOut .4s ease-in 1.8s both}}';
    document.head.appendChild(css);
  }
  const wrap = document.createElement('div'); wrap.className = 'cel-wrap'; wrap.setAttribute('role', 'status');
  const palette = [color || '#2fc092', '#e2a33b', '#4b9ee2', '#d96a8a', '#8bc34a'];
  let bits = '';
  for(let i = 0; i < 28; i++){
    const a = i / 28 * Math.PI * 2, d = 120 + Math.random() * 120;
    bits += '<i class="cel-bit" style="background:'+palette[i % palette.length]+';--dx:'+Math.round(Math.cos(a)*d)+'px;--dy:'+Math.round(Math.sin(a)*d - 40)+'px;--r:'+Math.round(Math.random()*540)+'deg"></i>';
  }
  const esc = function(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };
  wrap.innerHTML = bits + '<div class="cel-card"><b>'+esc(title)+'</b>'+(sub ? '<span>'+esc(sub)+'</span>' : '')+'</div>';
  document.body.appendChild(wrap);
  setTimeout(function(){ wrap.remove(); }, 2600);
}
