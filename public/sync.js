// Study-room state that the pages keep in localStorage — quiz answer history
// (qz-history), which quizzes a video already asked (qz-asked-<id>) and where
// each video was left off (yt-pos-<id>) — is mirrored to the server, so it
// survives clearing the browser and is the same on phone and computer.
//
// On load (before the page scripts run) the server copy is merged in; after
// that every write to one of these keys is sent to the server as well.
(function () {
  const KEY = /^(qz-history|qz-asked-[\w-]+|yt-pos-[\w-]+)$/;
  const ls = window.localStorage;
  if (!ls) return;
  const rawSet = Storage.prototype.setItem, rawRemove = Storage.prototype.removeItem;
  const parse = function (v, d) { try { return JSON.parse(v); } catch (e) { return d; } };

  function put(key, value) {
    try {
      fetch('/api/state/' + encodeURIComponent(key), {
        method: 'PUT', headers: {'Content-Type': 'application/json', 'X-Sync-Reset': ls.getItem('sync-reset') || ''},
        body: JSON.stringify({value: value}), keepalive: true,
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
      } else if (/^qz-asked-/.test(k)) {
        merged = JSON.stringify(Array.from(new Set(parse(s, []).concat(parse(l, [])))));
      } else {
        // resume position: whichever is further along
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
    if (/^yt-pos-/.test(k)) {
      clearTimeout(timers[k]);
      timers[k] = setTimeout(function () { put(k, ls.getItem(k)); }, 5000);
    } else put(k, String(v));
  };
  Storage.prototype.removeItem = function (k) {
    rawRemove.call(this, k);
    if (this === ls && KEY.test(k)) put(k, null);
  };
  window.addEventListener('pagehide', function () {
    Object.keys(timers).forEach(function (k) { clearTimeout(timers[k]); put(k, ls.getItem(k)); });
  });
})();
