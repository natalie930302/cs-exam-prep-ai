// Development aid: load on a lab page in stage mode (lab.html?ch=X&stage=1&scene=none)
// with `import('/lab/labcheck.js')`; plays every scene, enters every mode, renders
// every page, and collects errors into window.__res (poll __res.done).
await new Promise((r) => setTimeout(r, 1500));
const R = (window.__res = { errs: [], caps: {}, modes: {}, done: false });
addEventListener('error', (e) => R.errs.push(e.message));
addEventListener('unhandledrejection', (e) => R.errs.push(String(e.reason)));
const oe = console.error;
console.error = (...a) => { R.errs.push(a.map(String).join(' ')); oe(...a); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const C = window.__labCheck;
for (const id of C.def.sceneOrder) {
  C.playScene(id); await wait(2000); window.__lab.advance(0.5);
  R.caps[id] = document.getElementById('caption').textContent;
}
C.stop();
for (const m of C.def.modes) {
  try {
    m.enter(); await wait(300);
    for (const b of [...document.querySelectorAll('#controls button')].slice(0, 3)) { b.click(); await wait(700); }
    window.__lab.advance(1);
    R.modes[m.id] = document.getElementById('stateCard').innerText.split('\n')[0];
  } catch (e) { R.errs.push(m.id + ': ' + e); }
}
for (const p of C.def.pages || []) { try { p.render(document.getElementById('page')); } catch (e) { R.errs.push(p.id + ': ' + e); } }
R.done = true;
