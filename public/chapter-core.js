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
  return '精選單篇';
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
function chapterDisplayMaterials(c){
  const firstVideoIndex = c.mats.findIndex(function(m){ return m.type === 'vid' || m.type === 'vidgroup'; });
  const videoOptions = [];
  c.mats.forEach(function(m){
    if(m.type === 'vidgroup') m.options.forEach(function(o){ videoOptions.push(Object.assign({},o,{topic:m.text})); });
    else if(m.type === 'vid') videoOptions.push({label:m.text,url:m.url,dur:m.dur,note:m.note,topic:''});
  });
  const display = [];
  c.mats.forEach(function(m, sourceIndex){
    if(sourceIndex === firstVideoIndex && videoOptions.length){
      display.push({type:'vidgroup',text:'本章影片',options:videoOptions,series:groupVideoSeries(videoOptions),taskKey:'video'});
    }
    if(m.type !== 'vid' && m.type !== 'vidgroup'){
      const copy = Object.assign({},m);
      copy.taskKey = m.type+'-'+stableTaskKey(m.text || String(sourceIndex));
      display.push(copy);
    }
  });
  return display;
}
function chapterMaterialTaskId(subjectId, chapter, material){
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
// Mirror a foundation week's per-type queue tasks (w<N>-video/book/…) from
// the chapter material checkboxes of every chapter scheduled in that week.
async function syncFoundationWeekTasks(wk, doneIds){
  if(!wk) return;
  const rows = weekMaterialTasks(wk);
  if(!rows.length) return;
  const done = new Set(doneIds);
  const groups = {
    video:rows.filter(function(r){ return r.type === 'vidgroup'; }),
    book:rows.filter(function(r){ return r.type === 'book'; }),
    practice:rows.filter(function(r){ return r.type === 'ex'; }),
    notes:rows.filter(function(r){ return r.type === 'rec'; })
  };
  const allDone = rows.every(function(r){ return done.has(r.id); });
  const targets = {
    video:groups.video.length > 0 && groups.video.every(function(r){ return done.has(r.id); }),
    book:groups.book.length > 0 && groups.book.every(function(r){ return done.has(r.id); }),
    practice:groups.practice.length > 0 && groups.practice.every(function(r){ return done.has(r.id); }),
    notes:groups.notes.length ? groups.notes.every(function(r){ return done.has(r.id); }) : allDone,
    review:allDone
  };
  await Promise.all(Object.keys(targets).map(function(type){
    return fetch('/api/tasks/w'+wk+'-'+type+'/set', {
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({done:targets[type]})
    });
  }));
}

// Interactive 3D chapter labs (public/lab/). Keyed by subject id, then
// 0-based chapter index. The study room shows a 互動實驗室 tab only for
// chapters listed here.
// Chapters whose lab module exists in public/lab/chapters/<subject>-<n>.js
// (n = 1-based chapter number). Add an entry when a chapter's lab ships.
const CHAPTER_LABS = {
  ds:[1,2,3,4,5,6,7,8,9,10,11,12],
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
  return '/study.html?s='+encodeURIComponent(subjectId)+'&c='+idx+(videoId?'&v='+encodeURIComponent(videoId):'');
}
function youtubeId(url){
  const m = String(url || '').match(/(?:v=|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : '';
}
