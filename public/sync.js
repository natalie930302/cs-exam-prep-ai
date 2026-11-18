// Study-room state that the pages keep in localStorage — quiz answer history
// (qz-history), which quizzes a video already asked (qz-asked-<id>), where
// each video was left off (yt-pos-<id>), how far each 講義 was read
// (ho-pos-<ch>, ho-read-min-<ch>) and the 自我檢查卡 review schedule (srs,
// recall.js) — is mirrored to the server, so it survives clearing the browser
// and is the same on phone and computer.
//
// On load (before the page scripts run) the server copy is merged in; after
// that every write to one of these keys is sent to the server as well.
(function () {
  const KEY = /^(qz-history|qz-asked-[\w-]+|yt-pos-[\w-]+|ho-pos-[\w-]+|ho-read-min-[\w-]+|srs)$/;
  const ls = window.localStorage;
  if (!ls) return;
  const rawSet = Storage.prototype.setItem, rawRemove = Storage.prototype.removeItem;
  const parse = function (v, d) { try { return JSON.parse(v); } catch (e) { return d; } };

  // `leaving`: the page is closing. Only then is keepalive used (it lets the
  // request outlive the page), and only for small bodies: browsers refuse a
  // keepalive request over 64 KB, and the answer history and the review
  // schedule grow past that.
  function put(key, value, leaving) {
    try {
      const body = JSON.stringify({value: value});
      fetch('/api/state/' + encodeURIComponent(key), {
        method: 'PUT', headers: {'Content-Type': 'application/json', 'X-Sync-Reset': ls.getItem('sync-reset') || ''},
        body: body, keepalive: !!leaving && body.length < 60000,
      }).catch(function () {});
    } catch (e) {}
  }

  // 1. merge the server copy in (synchronous: the page scripts read these
  //    keys as soon as they start; it is a small local request)
  let server = {};
  try {
    const x = new XMLHttpRequest();
    x.open('GET', '/api/state', false);
    x.send();
    if (x.status === 200) server = JSON.parse(x.responseText) || {};
  } catch (e) { server = {}; }
  // progress was cleared since this browser last synced: drop its own copy
  // first, so the old answers and positions are not merged back
  try {
    const reset = server.__reset;
    delete server.__reset;
    if (reset && ls.getItem('sync-reset') !== reset) {
      const old = [];
      for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (KEY.test(k)) old.push(k); }
      old.forEach(function (k) { rawRemove.call(ls, k); });
      rawSet.call(ls, 'sync-reset', reset);
    }
  } catch (e) {}
  const toPush = [];
  try {
    const local = {};
    for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (KEY.test(k)) local[k] = ls.getItem(k); }
    const keys = new Set(Object.keys(server).concat(Object.keys(local)));
    keys.forEach(function (k) {
      const s = server[k], l = local[k];
      let merged;
      if (k === 'qz-history') {
        // every answer from both sides, once, in time order
        const seen = new Set(), all = [];
        parse(s, []).concat(parse(l, [])).forEach(function (r) {
          const id = r.ts + '|' + r.vid + '|' + r.q;
          if (!seen.has(id)) { seen.add(id); all.push(r); }
        });
        all.sort(function (a, b) { return a.ts - b.ts; });
        merged = JSON.stringify(all.slice(-3000));
      } else if (k === 'srs') {
        // per card, the most recent grade wins
        const a = parse(s, {}) || {}, b = parse(l, {}) || {}, m = {};
        [a, b].forEach(function (x) { Object.keys(x).forEach(function (id) { if (x[id] && (!m[id] || (x[id].ts || 0) > (m[id].ts || 0))) m[id] = x[id]; }); });
        merged = JSON.stringify(m);
      } else if (/^qz-asked-/.test(k)) {
        merged = JSON.stringify(Array.from(new Set(parse(s, []).concat(parse(l, [])))));
      } else {
        // resume position / reading position: whichever is further along
        merged = String(Math.max(Number(s) || 0, Number(l) || 0));
      }
      if (merged !== l) rawSet.call(ls, k, merged);
      if (merged !== s) toPush.push([k, merged]);
    });
  } catch (e) {}
  toPush.forEach(function (kv) { put(kv[0], kv[1]); });

  // 2. from now on, writes go to the server too (resume positions, written
  //    every few seconds while a video plays, are sent at most every 5 s)
  const timers = {};
  Storage.prototype.setItem = function (k, v) {
    rawSet.call(this, k, v);
    if (this !== ls || !KEY.test(k)) return;
    if (/^(yt-pos-|ho-|srs$)/.test(k)) {
      // frequent writes (a playing video, scrolling, grading one card after
      // another) go out together after a pause
      clearTimeout(timers[k]);
      timers[k] = setTimeout(function () { delete timers[k]; put(k, ls.getItem(k)); }, /^yt-pos-/.test(k) ? 5000 : 1500);
    } else put(k, String(v));
  };
  Storage.prototype.removeItem = function (k) {
    rawRemove.call(this, k);
    if (this === ls && KEY.test(k)) put(k, null);
  };
  // waiting writes go out as soon as the page is hidden (switching apps on a
  // phone often never fires pagehide), and again on pagehide
  function flush(leaving) {
    Object.keys(timers).forEach(function (k) { clearTimeout(timers[k]); delete timers[k]; put(k, ls.getItem(k), leaving); });
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(false); });
  window.addEventListener('pagehide', function () { flush(true); });
})();
