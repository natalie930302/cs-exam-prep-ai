// Generic chapter-lab shell. lab.html?ch=<subject>-<chapterNumber> loads
// ./chapters/<ch>.js, which default-exports a factory `(ctx) => def`:
//
//   def = {
//     kicker, title,                       // header text
//     modes:  [{ id, name, enter() }],     // interactive 3D modes (tabs)
//     pages:  [{ id, name, render(el) }],  // optional text pages (tabs)
//     scenes: { id: { title, play: async (tok) => {} } },  // auto demos
//     sceneOrder: [ids],                   // guided-tour order
//     stop() {}                            // optional: clear timers on switch
//   }
//
// ctx gives every chapter the same toolkit (see makeCtx below), so all labs
// look and behave alike. ?stage=1 is the study-room mode: no chrome, one
// caption + one formula line, scenes driven by postMessage from study.html
// ({type:'scene', scene, params} or {type:'tour'}).
import { THREE, createLab, colorFor } from './lab-engine.js?v=27';

const q = new URLSearchParams(location.search);
const CH = (q.get('ch') || 'ds-2').replace(/[^\w-]/g, '');
const STAGE = q.has('stage');
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const lab = createLab($('canvas'));
window.__lab = lab;

let demoToken = 0;
// The cued scene now playing: its step times, how many steps have started,
// and the video time last reported by the study room.
// manual: a lesson page drives the steps itself (下一步): target = how many steps may show.
const cue = { tok: 0, list: null, k: 0, shown: 0, t: 0, end: Infinity, id: null, params: null, manual: false, target: 0 };
// the video is ahead of the scene: its next step is already due
function behind(tok) {
  if (cue.manual && tok === cue.tok) return cue.k < cue.target;
  if (!cue.list || tok !== cue.tok) return false;
  return cue.t > cue.end || (cue.k < cue.list.length && cue.t >= cue.list[cue.k] + 0.3);
}
function makeCtx() {
  const logEl = $('log');
  return {
    THREE, lab, colorFor, sleep, stage: STAGE,
    // true while the video is ahead of the scene: animations may jump to their end
    behind,
    $: $,
    log(text, warn = false) {
      const li = document.createElement('li');
      li.textContent = text;
      if (warn) li.className = 'warn';
      logEl.appendChild(li);
      logEl.scrollTop = logEl.scrollHeight;
    },
    clearLog() { logEl.innerHTML = ''; },
    setState(title, rows, formula = '') {
      $('stateCard').innerHTML = '<div class="lab-card-hd">' + title + '</div>'
        + rows.map(([k, v]) => '<div class="lab-state-row"><span>' + k + '</span><b>' + v + '</b></div>').join('')
        + (formula ? '<div class="lab-formula">' + formula + '</div>' : '');
    },
    controls(html) { $('controls').innerHTML = html; },
    on(id, fn) { const el = $(id); if (el) el.onclick = fn; },
    // stage caption (one short line) + formula line (may contain <span class="ok|no">)
    say(text, formula) {
      const cap = $('caption');
      if (text && text !== cap.textContent && cap.classList.contains('on')) {
        // a new step: replay a short settle-in so the eye notices the change
        cap.classList.remove('swap'); void cap.offsetWidth; cap.classList.add('swap');
      }
      cap.textContent = text || '';
      cap.classList.toggle('on', !!text);
      if (formula !== undefined) { $('formulaOv').innerHTML = formula || ''; $('formulaOv').classList.toggle('on', !!formula); }
    },
    // inside a scene: wait (animation timing only), and abort if the study
    // room switched scenes. When the video is already past the next step (a
    // jump ahead, or the section is over) the remaining motion runs quickly.
    async beat(tok, ms) {
      await sleep(behind(tok) ? Math.min(ms, 30) : ms);
      if (tok !== demoToken) throw new Error('scene changed');
    },
    // a cued scene's next step: wait until the lecturer reaches cues[k], the
    // moment that step is spoken, so every step lines up with its sentence;
    // a paused video holds the step. Outside the study room (no cues) steps
    // just follow each other with a short pause.
    async step(tok) {
      if (cue.manual && tok === cue.tok) {
        while (tok === demoToken && cue.k >= cue.target) await sleep(60);
        cue.k++; cue.shown = cue.k;
      } else if (cue.list && tok === cue.tok) {
        if (cue.k < cue.list.length) {
          const at = cue.list[cue.k++];
          while (tok === demoToken && cue.t < at) await sleep(60);
          cue.shown = cue.k;
        }
      } else {
        await sleep(1600);
      }
      if (tok !== demoToken) throw new Error('scene changed');
    },
    // a value block with its label, the common building piece
    block(v, size, color) {
      const m = lab.box(color || colorFor(v), size);
      m.add(lab.label(String(v), 'val'));
      return m;
    },
    tile(pos, w = 1.7, d = 1.7, color = '#e9dcc4') {
      const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
      t.position.copy(pos);
      t.receiveShadow = true;
      lab.world.add(t);
      return t;
    },
  };
}

const ctx = makeCtx();
const mod = await import('./chapters/' + CH + '.js?v=18');
const def = mod.default(ctx);
const modes = def.modes || [];
// the lab is for trying things by hand; quizzes live in the study room
const pages = (def.pages || []).filter((p) => p.id !== 'quiz' && !/小測驗|測驗|quiz/i.test(p.name || ''));
const scenes = def.scenes || {};
const order = def.sceneOrder || Object.keys(scenes);
// for automated checks: play every scene / mode from the console
window.__labCheck = { def, playScene: (id) => playScene(id, {}, false), stop: () => stopAll() };

$('kicker').textContent = def.kicker || '';
$('title').textContent = def.title || '';
document.title = (def.title || '互動實驗室') + '｜實驗室';
if (def.color) document.body.style.setProperty('--subj', def.color);

// ── tabs (normal / embed mode) ──
$('tabs').innerHTML = modes.map((m) => '<button role="tab" data-mode="' + m.id + '">' + m.name + '</button>').join('')
  + pages.map((p) => '<button role="tab" data-page="' + p.id + '">' + p.name + '</button>').join('');
const KEY = 'lab-mode-' + CH;
function stopAll() { demoToken++; if (def.stop) def.stop(); ctx.say('', ''); }
function setTab(id) {
  stopAll();
  document.querySelectorAll('#tabs button').forEach((b) => b.setAttribute('aria-selected', String((b.dataset.mode || b.dataset.page) === id)));
  const page = pages.find((p) => p.id === id);
  document.querySelector('.lab-main').classList.toggle('page-mode', !!page);
  $('page').hidden = !page;
  if (page) { page.render($('page')); }
  else { ctx.clearLog(); (modes.find((m) => m.id === id) || modes[0]).enter(); }
  try { localStorage.setItem(KEY, id); } catch (e) {}
}
document.querySelectorAll('#tabs button').forEach((b) => (b.onclick = () => setTab(b.dataset.mode || b.dataset.page)));

// ── stage mode: scenes, guided tour, hands-on ──
async function playScene(id, params, loop = true, cues = null, end = Infinity, manual = 0) {
  const tok = ++demoToken;
  if (def.stop) def.stop();
  document.body.classList.remove('hands-on', 'idle');
  const sc = scenes[id] || scenes[order[0]];
  if (!sc) return;
  ctx.params = params || {};
  Object.assign(cue, { tok, list: cues && cues.length ? cues.slice() : null, k: 0, shown: 0, end, id, params, manual: !!manual, target: manual || 0 });
  // In the study room a scene plays once and holds its last step: the
  // lecture moves on by itself, so replaying would only distract.
  if (STAGE && parent !== window) loop = false;
  do {
    try { ctx.clearLog(); await sc.play(tok); } catch (e) { if (tok !== demoToken) return; console.error(e); return; }
  } while (loop && tok === demoToken);
}
// The lecturer is not teaching (logistics, chat): a calm empty stage.
function idle(text) {
  stopAll();
  lab.clear();
  document.body.classList.add('idle');
  ctx.say(text || '', '');
}
// Guided tour: every scene once, in order, then start over — used while the
// current video has no notes yet, so the stage is never idle.
async function tour(startId) {
  const tok = ++demoToken;
  if (def.stop) def.stop();
  let i = Math.max(0, order.indexOf(startId));
  while (tok === demoToken && order.length) {
    const id = order[i];
    if (parent !== window) parent.postMessage({ type: 'tour-scene', id }, location.origin);
    try { ctx.clearLog(); ctx.params = {}; await scenes[id].play(tok); } catch (e) { return; }
    if (tok !== demoToken) return;
    await sleep(600);
    i = (i + 1) % order.length;
  }
}
if (STAGE) {
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.type === 'scene') playScene(e.data.scene, e.data.params, true, e.data.cues, e.data.end, e.data.manual ? Math.max(1, e.data.step || 1) : 0);
    // lesson pages: show up to step k (1-based); going back replays quickly to it
    if (e.data.type === 'goto' && cue.manual && cue.tok === demoToken) {
      const k = Math.max(1, e.data.step | 0);
      if (k < cue.shown) playScene(cue.id, cue.params, false, null, Infinity, k);
      else cue.target = k;
    }
    if (e.data.type === 'idle') idle(e.data.text);
    if (e.data.type === 'time') {
      cue.t = e.data.t;
      // jumped back before a step that is already showing: replay up to here
      if (cue.list && cue.tok === demoToken && cue.shown > 0 && cue.t < cue.list[cue.shown - 1] - 0.5) {
        playScene(cue.id, cue.params, true, cue.list, cue.end);
      }
    }
    if (e.data.type === 'tour') tour(e.data.from);
    if (e.data.type === 'visible') lab.setVisible(e.data.visible);
  });
  if ($('handsOn')) $('handsOn').onclick = () => {
    stopAll();
    document.body.classList.add('hands-on');
    const first = modes[0];
    if (first) { ctx.clearLog(); first.enter(); }
  };
  // tell the study room which scenes exist (titles for the "now" line)
  if (parent !== window) parent.postMessage({ type: 'lab-ready', scenes: order.map((id) => ({ id, title: scenes[id].title })) }, location.origin);
  if (q.get('scene')) playScene(q.get('scene'));
  else if (parent === window) tour();
} else {
  let start = modes[0] && modes[0].id;
  try { start = localStorage.getItem(KEY) || start; } catch (e) {}
  setTab([...modes, ...pages].some((x) => x.id === start) ? start : modes[0].id);
}
