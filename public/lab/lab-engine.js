// Shared 3D engine for every chapter lab (public/lab/*.js).
// One three.js scene + CSS2D labels + a tiny physics step: bodies either
// fall under gravity onto a floor height (bouncing with damping) or spring
// toward a target position. Enough to make data-structure operations feel
// physical without pulling in a full physics library.
//
// Look: soft studio lighting (a small baked room environment + one gentle
// key light), slightly rounded blocks, and no visible floor edge — the canvas
// is transparent over a warm paper gradient (lab.css) and a shadow-only
// ground keeps objects anchored. In stage mode a quiet "camera operator"
// keeps whatever the scene builds inside the frame (see autoFit below).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export { THREE };

const SMALL = typeof matchMedia === 'function' && matchMedia('(max-width: 640px)').matches;
// prefers-reduced-motion: no overshoot, squash, pulse or camera drift
const CALM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createLab(container) {
  const STAGE = document.body.classList.contains('stage');
  const scene = new THREE.Scene();
  scene.background = null; // the paper gradient comes from CSS behind the canvas
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  camera.position.set(0, 7, 16);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, SMALL ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.domElement.style.position = 'absolute';
  labels.domElement.style.inset = '0';
  labels.domElement.style.pointerEvents = 'none';
  labels.domElement.className = 'lab-labels';
  container.appendChild(labels.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 6;
  controls.maxDistance = 40;

  // Soft image-based light: a tiny procedural room, baked once (cheap on
  // phones and on a GTX1650), gives blocks gentle highlights on their edges.
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.5;
    pmrem.dispose();
  } catch (e) { /* no env map: the lights below still work */ }

  scene.add(new THREE.HemisphereLight('#fffaf1', '#dccbaf', 1.05));
  const sun = new THREE.DirectionalLight('#fff3df', 1.55);
  sun.position.set(4, 16, 7); // high and slightly in front: short shadows right under objects
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); // lower res = softer edges, cheaper
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.intensity = 0.75; // shadows on blocks themselves stay light
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 50 });
  scene.add(sun);

  // Shadow-only ground: no visible disc edge / horizon line, just soft contact shadows.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.ShadowMaterial({ color: '#4a3618', opacity: 0.08 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Everything a mode creates goes in `world` so switching modes is one clear().
  const world = new THREE.Group();
  scene.add(world);

  const bodies = new Set();
  const GRAVITY = -32;

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    camera.aspect = w / h;
    // narrow (phone) screens: widen the view so ring/row layouts aren't clipped
    camera.fov = camera.aspect < 0.9 ? 54 : 42;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  // ── Auto framing (stage mode) ──
  // Scenes aim the camera once with frameCamera(); content then grows,
  // moves and appears over time. Every few frames we measure what is on
  // screen (blocks + visible labels) and, if it spills outside the area
  // between the caption and the formula line, gently dolly back / re-centre.
  // It never fights the user: any orbit/zoom drag turns it off until the
  // next scene frames the camera again.
  const fit = {
    on: STAGE, user: false, frame: 0, lastFrameAt: -1e9,
    look: new THREE.Vector3(0, 0, 0), dir: new THREE.Vector3(0, 7, 16).normalize(), dist: Math.hypot(7, 16),
    scale: 1, goalScale: 1, shift: new THREE.Vector3(), goalShift: new THREE.Vector3(),
    bias: new THREE.Vector3(), goalBias: new THREE.Vector3(),
    // where frameCamera() last asked to look from; the camera glides there
    lookGoal: new THREE.Vector3(0, 0, 0), dirGoal: new THREE.Vector3(0, 7, 16).normalize(), distGoal: Math.hypot(7, 16),
  };
  controls.addEventListener('start', () => { fit.user = true; });
  const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _box = new THREE.Box3(), _size = new THREE.Vector3();
  const _right = new THREE.Vector3(), _up = new THREE.Vector3();
  function measure() {
    const W = container.clientWidth, H = container.clientHeight;
    if (!W || !H) return null;
    camera.updateMatrixWorld();
    world.updateMatrixWorld();
    const off = new Map();
    for (const b of bodies) {
      if (b.mode === 'fly') off.set(b.obj, null);
      else if (b.mode === 'fall' || b.mode === 'spring') off.set(b.obj, b.target.clone().sub(b.obj.position));
    }
    const r = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, n: 0, minY: Infinity, ax: 0, ay: 0, an: 0 };
    // where things are changing right now (bodies on their way somewhere)
    for (const b of bodies) {
      if (b.mode !== 'fall' && b.mode !== 'spring') continue;
      _q.copy(b.target).project(camera);
      if (_q.z > 1 || _q.z < -1) continue;
      r.ax += (_q.x + 1) / 2 * W; r.ay += (1 - _q.y) / 2 * H; r.an++;
    }
    const add = (p, hw, hh) => {
      _q.copy(p).project(camera);
      if (_q.z > 1 || _q.z < -1) return;
      const sx = (_q.x + 1) / 2 * W, sy = (1 - _q.y) / 2 * H;
      r.x0 = Math.min(r.x0, sx - hw); r.x1 = Math.max(r.x1, sx + hw);
      r.y0 = Math.min(r.y0, sy - hh); r.y1 = Math.max(r.y1, sy + hh);
      r.n++;
    };
    for (const top of world.children) {
      const d = off.get(top);
      if (d === null) continue;
      top.traverseVisible((o) => {
        if (o.isCSS2DObject) {
          const el = o.element, st = el.style;
          if (!el.textContent || st.visibility === 'hidden' || st.opacity === '0') return;
          o.getWorldPosition(_p); if (d) _p.add(d);
          add(_p, el.offsetWidth / 2, el.offsetHeight / 2);
          return;
        }
        if (!o.isMesh || !o.geometry || o.userData.noFit) return;
        const m = o.material;
        if (m && !Array.isArray(m) && m.transparent && m.opacity < 0.35) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        _box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
        if (_box.isEmpty()) return;
        if (d) _box.translate(d);
        _box.getSize(_size);
        const big = Math.max(_size.x, _size.y, _size.z), small = Math.min(_size.x, _size.y, _size.z);
        if (big > 40) return;                       // floors / backdrops are setting, not content
        if (big > 12 && small < 0.3 && _size.x * _size.y * _size.z < 1) return; // long axis rods / "infinite" lines
        r.minY = Math.min(r.minY, _box.min.y);
        for (let i = 0; i < 8; i++) {
          _p.set(i & 1 ? _box.max.x : _box.min.x, i & 2 ? _box.max.y : _box.min.y, i & 4 ? _box.max.z : _box.min.z);
          add(_p, 0, 0);
        }
      });
    }
    return r.n ? r : null;
  }
  function safeArea() {
    const W = container.clientWidth, H = container.clientHeight;
    const cr = container.getBoundingClientRect();
    let top = 14, bottom = H - 14;
    const cap = document.getElementById('caption'), fo = document.getElementById('formulaOv');
    if (cap && cap.classList.contains('on')) top = Math.max(top, cap.getBoundingClientRect().bottom - cr.top + 10);
    if (fo && fo.classList.contains('on')) bottom = Math.min(bottom, fo.getBoundingClientRect().top - cr.top - 10);
    if (bottom - top < H * 0.45) { top = H * 0.12; bottom = H * 0.9; }
    return { x0: 14, x1: W - 14, y0: top, y1: bottom };
  }
  function fitStep(r) {
    if (!r || appears.size) return; // wait until new objects have grown to full size
    const s = safeArea();
    const cw = r.x1 - r.x0, ch = r.y1 - r.y0, sw = s.x1 - s.x0, sh = s.y1 - s.y0;
    const need = Math.max(cw / sw, ch / sh); // > 1: spills out of the safe area
    let goal = fit.scale;
    if (need > 1.0) goal = fit.scale * need * 1.05;
    else if (need < 0.6) goal = fit.scale * need / 0.75; // lots of empty room: step in a little
    goal = Math.min(1.9, Math.max(0.85, goal));
    if (Math.abs(goal - fit.goalScale) / fit.goalScale > 0.05) fit.goalScale = goal;
    // re-centre: screen offset -> world offset on the camera's right/up plane
    const H = container.clientHeight;
    const ox = (r.x0 + r.x1) / 2 - (s.x0 + s.x1) / 2, oy = (r.y0 + r.y1) / 2 - (s.y0 + s.y1) / 2;
    const dist = fit.dist * fit.scale;
    const wpp = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / H;
    const spillX = cw > sw * 0.98 || r.x0 < s.x0 || r.x1 > s.x1;
    const spillY = ch > sh * 0.98 || r.y0 < s.y0 || r.y1 > s.y1;
    // only re-centre when something is cut off: a lopsided layout is often
    // deliberate (room kept for what the scene adds next)
    if (spillX || spillY) {
      _right.setFromMatrixColumn(camera.matrixWorld, 0);
      _up.setFromMatrixColumn(camera.matrixWorld, 1);
      const g = fit.shift.clone().addScaledVector(_right, ox * wpp).addScaledVector(_up, -oy * wpp);
      const lim = fit.dist * 0.45;
      if (g.length() > lim) g.setLength(lim);
      if (g.distanceTo(fit.goalShift) > fit.dist * 0.02) fit.goalShift.copy(g);
    }
    // lean the camera a little toward what is moving (small, slow, capped)
    if (!CALM && r.an) {
      _right.setFromMatrixColumn(camera.matrixWorld, 0);
      _up.setFromMatrixColumn(camera.matrixWorld, 1);
      const ax = r.ax / r.an - (s.x0 + s.x1) / 2, ay = r.ay / r.an - (s.y0 + s.y1) / 2;
      fit.goalBias.set(0, 0, 0).addScaledVector(_right, ax * wpp * 0.14).addScaledVector(_up, -ay * wpp * 0.14);
      const cap = fit.dist * 0.05;
      if (fit.goalBias.length() > cap) fit.goalBias.setLength(cap);
    } else fit.goalBias.set(0, 0, 0);
  }
  function applyFit(dt) {
    const k = dt >= 1 ? 1 : 1 - Math.exp(-dt * 2.4);
    // glide between framings (new scene, or a camera move inside one)
    const g = dt >= 1 ? 1 : 1 - Math.exp(-dt * 3.6);
    fit.look.lerp(fit.lookGoal, g);
    fit.dir.lerp(fit.dirGoal, g).normalize();
    fit.dist += (fit.distGoal - fit.dist) * g;
    fit.scale += (fit.goalScale - fit.scale) * k;
    fit.shift.lerp(fit.goalShift, k);
    fit.bias.lerp(fit.goalBias, dt >= 1 ? 1 : 1 - Math.exp(-dt * 1.1));
    controls.target.copy(fit.look).add(fit.shift).add(fit.bias);
    camera.position.copy(controls.target).addScaledVector(fit.dir, fit.dist * fit.scale);
  }
  // The shadow-only ground follows the lowest block, so shadows touch the
  // objects that cast them instead of floating as grey strips far below.
  let floorGoal = 0;
  function measureTick() {
    const r = measure();
    if (r && isFinite(r.minY)) floorGoal = Math.max(-2, Math.min(12, r.minY - 0.02));
    return r;
  }
  // ── Focus: when a scene highlights something (an emissive "glow", which is
  // how every chapter marks the current element), quietly fade the other
  // blocks and their labels toward the background so the eye lands on the
  // highlighted one. Colours are blended, never replaced: a tint() a scene
  // applies meanwhile is picked up as the new base colour.
  const PAPER = new THREE.Color('#f8f2e7');
  const _c = new THREE.Color();
  const dimmed = new Set();
  function isGlowing(m) { const e = m.emissive; return !!e && (e.r + e.g + e.b) > 0.04; }
  function focusTick() {
    const flying = new Set();
    for (const b of bodies) if (b.mode === 'fly') flying.add(b.obj);
    const meshes = [];
    let glowing = 0;
    for (const top of world.children) {
      if (flying.has(top)) continue;
      top.traverseVisible((o) => {
        const m = o.material;
        if (!o.isMesh || !m || Array.isArray(m) || !m.isMeshStandardMaterial || !m.color) return;
        meshes.push(o);
        if (isGlowing(m)) {
          glowing++;
          // gentle "breathing" on the highlighted block
          if (!CALM) { m.emissiveIntensity = 1 + 0.4 * Math.sin(performance.now() / 1000 * 3.4); m.userData.__pulse = true; }
        } else if (m.userData.__pulse) { m.emissiveIntensity = 1; delete m.userData.__pulse; }
      });
    }
    const focus = glowing > 0 && glowing <= meshes.length * 0.6 && meshes.length >= 3;
    const live = new Set();
    for (const o of meshes) {
      const m = o.material;
      const want = focus && !isGlowing(m) ? 1 : 0;
      let st = m.userData.__dim;
      if (!st) {
        if (!want) continue;
        st = m.userData.__dim = { base: m.color.clone(), t: 0, hex: m.color.getHex() };
      }
      if (m.color.getHex() !== st.hex) st.base.copy(m.color); // recoloured by the scene
      st.t += (want - st.t) * 0.35;
      if (!want && st.t < 0.02) { m.color.copy(st.base); delete m.userData.__dim; setLabelDim(o, false); continue; }
      m.color.copy(st.base).lerp(_c.copy(PAPER), 0.55 * st.t);
      st.hex = m.color.getHex();
      setLabelDim(o, st.t > 0.5);
      live.add(o);
    }
    for (const o of dimmed) if (!live.has(o)) {
      const st = o.material && o.material.userData.__dim;
      if (st) { o.material.color.copy(st.base); delete o.material.userData.__dim; }
      setLabelDim(o, false);
    }
    dimmed.clear(); for (const o of live) dimmed.add(o);
  }
  function setLabelDim(o, on) {
    for (const c of o.children) if (c.isCSS2DObject) c.element.classList.toggle('lab-dim', on);
  }

  function fitTick(dt) {
    const due = ++fit.frame % 8 === 0;
    if (fit.frame % 3 === 0) focusTick();
    const r = due ? measureTick() : null;
    floor.position.y += (floorGoal - floor.position.y) * Math.min(1, dt * 4);
    if (!fit.on || fit.user || !STAGE) return;
    if (due) fitStep(r);
    applyFit(dt);
  }

  // The study room says when the stage is scrolled out of view; motion keeps
  // stepping (so nothing jumps on return) but nothing is drawn, which is
  // what makes phones hot.
  let visible = true;
  function setVisible(v) { visible = !!v; }
  // per-frame callbacks (idle motion: blinking, breathing); clear() drops them
  const frameFns = new Set();
  function onFrame(fn) { frameFns.add(fn); return () => frameFns.delete(fn); }
  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    for (const b of bodies) stepBody(b, dt);
    scanAppears();
    stepAppears(dt);
    stepPops(dt);
    for (const fn of frameFns) { try { fn(dt, now / 1000); } catch (e) { frameFns.delete(fn); } }
    if (!visible) { requestAnimationFrame(tick); return; }
    fitTick(dt);
    controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  function stepBody(b, dt) {
    const p = b.obj.position;
    if (b.mode === 'fall') {
      b.vel.y += GRAVITY * dt;
      p.y += b.vel.y * dt;
      // settle sideways toward the column while falling
      p.x += (b.target.x - p.x) * Math.min(1, dt * 10);
      p.z += (b.target.z - p.z) * Math.min(1, dt * 10);
      if (p.y <= b.target.y) {
        p.y = b.target.y;
        if (Math.abs(b.vel.y) > 2.5) {
          if (!b.landed) { b.landed = true; pop(b.obj, Math.min(1, Math.abs(b.vel.y) / 14)); } // squash on impact
          b.vel.y = -b.vel.y * (CALM ? 0.15 : 0.3); // a soft bounce, losing energy
        } else {
          b.landed = false;
          b.vel.y = 0;
          b.mode = 'rest';
          b.onSettle && b.onSettle();
        }
      }
    } else if (b.mode === 'spring') {
      // spring toward target with a slight overshoot-and-settle (damping
      // ratio ~0.72; critically damped when reduced motion is on)
      for (const k of ['x', 'y', 'z']) {
        const a = (b.target[k] - p[k]) * 90 - b.vel[k] * (CALM ? 19 : 13.6);
        b.vel[k] += a * dt;
        p[k] += b.vel[k] * dt;
      }
      if (p.distanceTo(b.target) < 0.01 && b.vel.length() < 0.05) {
        p.copy(b.target);
        b.vel.set(0, 0, 0);
        b.mode = 'rest';
        if (b.travel > 0.6) pop(b.obj, 0.45); // small snap when it reaches its slot
        b.onSettle && b.onSettle();
      }
    } else if (b.mode === 'fly') {
      b.vel.y += GRAVITY * 0.35 * dt;
      p.addScaledVector(b.vel, dt);
      // drift away and fade, with only a gentle tumble
      b.obj.rotation.x += dt * 1.6;
      b.obj.rotation.z += dt * 1.1;
      b.life -= dt * 1.2;
      const s = 0.85 + 0.15 * Math.max(0, b.life);
      if (b.baseScale) b.obj.scale.copy(b.baseScale).multiplyScalar(s);
      b.obj.traverse((o) => { if (o.material && o.material.transparent) o.material.opacity = Math.max(0, b.life) * (o.material.userData.op0 ?? 1); });
      if (b.life <= 0) { removeBody(b); }
    }
  }

  function addBody(obj, opts = {}) {
    const b = { obj, vel: new THREE.Vector3(), target: obj.position.clone(), mode: 'rest', ...opts };
    bodies.add(b);
    world.add(obj);
    return b;
  }
  function removeBody(b) {
    bodies.delete(b);
    world.remove(b.obj);
    b.obj.traverse((o) => { if (o.element) o.element.remove(); });
  }
  function dropTo(b, target, onSettle) {
    b.target.copy(target); b.mode = 'fall'; b.onSettle = onSettle;
  }
  function springTo(b, target, onSettle) {
    b.travel = b.obj.position.distanceTo(target);
    b.target.copy(target); b.mode = 'spring'; b.onSettle = onSettle;
  }
  // squash-and-recover "snap" (~0.24 s); never stacks on the same object
  const pops = new Map();
  function pop(obj, amp) {
    if (CALM || !obj || !obj.scale || amp < 0.05) return;
    const p = pops.get(obj);
    if (p) { p.t = 0; p.amp = Math.max(p.amp, amp); return; }
    pops.set(obj, { base: obj.scale.clone(), last: null, t: 0, amp });
  }
  function stepPops(dt) {
    for (const [obj, p] of pops) {
      // the scene changed this object's scale itself: let it win, stop popping
      if (p.last && !obj.scale.equals(p.last)) { pops.delete(obj); continue; }
      p.t += dt;
      const u = p.t / 0.24;
      if (u >= 1 || !obj.parent) { obj.scale.copy(p.base); pops.delete(obj); continue; }
      const e = Math.sin(Math.PI * u) * (1 - u) * p.amp;
      obj.scale.set(p.base.x * (1 + 0.07 * e), p.base.y * (1 - 0.13 * e), p.base.z * (1 + 0.07 * e));
      p.last = (p.last || new THREE.Vector3()).copy(obj.scale);
    }
  }
  // New things don't just blink into existence: each object added to the
  // world grows in with a small overshoot, and a batch added together
  // (a scene building its layout) comes in as a quick ripple. Things at the
  // origin (edges, axes, groups drawn in world coordinates) and falling
  // bodies (they already move in) are left alone.
  const seen = new WeakSet(), appears = new Map();
  let appearBatch = 0;
  function scanAppears() {
    let n = 0;
    for (const o of world.children) {
      if (seen.has(o)) continue;
      seen.add(o);
      if (CALM || !o.scale || o.position.lengthSq() < 1e-6) continue;
      let falling = false;
      for (const b of bodies) if (b.obj === o && (b.mode === 'fall' || b.mode === 'fly')) { falling = true; break; }
      if (falling) continue;
      const base = o.scale.clone();
      appears.set(o, { base, t: -Math.min(0.28, (appearBatch + n++) * 0.03), last: null });
      o.scale.copy(base).multiplyScalar(0.001);
      appears.get(o).last = o.scale.clone();
    }
    appearBatch = n ? appearBatch + n : 0;
  }
  function stepAppears(dt) {
    for (const [o, a] of appears) {
      if (!o.parent || (a.last && !o.scale.equals(a.last))) { // removed, or the scene set the scale itself
        if (o.parent && a.last && o.scale.equals(a.last)) o.scale.copy(a.base);
        appears.delete(o); continue;
      }
      a.t += dt;
      const u = Math.max(0, Math.min(1, a.t / 0.36));
      if (u >= 1) { o.scale.copy(a.base); appears.delete(o); continue; }
      const c = 1.7, e = 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); // ease-out-back
      o.scale.copy(a.base).multiplyScalar(Math.max(0.001, e));
      a.last.copy(o.scale);
    }
  }
  function flyAway(b, dir = new THREE.Vector3(0, 9, 4)) {
    b.vel.copy(dir); b.mode = 'fly'; b.life = 1; b.baseScale = b.obj.scale.clone();
    b.obj.traverse((o) => {
      if (o.material) {
        const op0 = o.material.transparent ? o.material.opacity : 1;
        o.material = o.material.clone(); o.material.transparent = true; o.material.userData.op0 = op0;
      }
    });
    b.obj.traverse((o) => { if (o.element) o.element.style.opacity = '0'; });
  }
  function clear() {
    frameFns.clear();
    appears.clear(); appearBatch = 0;
    for (const b of [...bodies]) removeBody(b);
    while (world.children.length) {
      const o = world.children.pop();
      o.traverse((c) => { if (c.element) c.element.remove(); });
    }
  }
  function label(text, cls = '') {
    const el = document.createElement('div');
    el.className = 'lab-label ' + cls;
    el.textContent = text;
    return new CSS2DObject(el);
  }
  // Rounded blocks: one shared geometry per size (cheap even with hundreds
  // of cells); edges catch the environment light so blocks read as objects.
  const geoCache = new Map();
  function blockGeometry(w, h, d) {
    const key = w + ',' + h + ',' + d;
    let g = geoCache.get(key);
    if (!g) {
      const r = Math.min(0.09, Math.min(w, h, d) * 0.14);
      g = r > 0.012 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d);
      geoCache.set(key, g);
    }
    return g;
  }
  function box(color, size = [1.6, 0.9, 1.6]) {
    const m = new THREE.Mesh(
      blockGeometry(...size),
      new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0 })
    );
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function frameCamera(pos, look) {
    // Embedded beside the video (stage mode) the canvas is smaller and wide,
    // so step back a little to keep the whole structure in frame.
    if (STAGE) {
      pos = pos.map((v, i) => look[i] + (v - look[i]) * 1.18);
    }
    camera.position.set(...pos);
    controls.target.set(...look);
    // auto framing: a new scene (not a camera move inside one) starts fresh
    const now = performance.now();
    const d = Math.hypot(pos[0] - look[0], pos[1] - look[1], pos[2] - look[2]);
    if (d > 0.01) {
      const wasUser = fit.user; // the viewer had orbited: cut back, don't glide from a stale view
      const key = pos.concat(look).map((v) => v.toFixed(3)).join(',');
      // same framing as last time = the scene is looping: keep the fitted
      // view instead of jumping back and re-fitting every loop
      if (now - fit.lastFrameAt > 400 && key !== fit.key) {
        fit.goalScale = 1; fit.goalShift.set(0, 0, 0); fit.goalBias.set(0, 0, 0);
        if (wasUser || !(fit.on && !CALM && fit.lastFrameAt > -1e8)) { fit.scale = 1; fit.shift.set(0, 0, 0); fit.bias.set(0, 0, 0); }
      }
      if (now - fit.lastFrameAt > 400) fit.user = false;
      fit.key = key;
      fit.lookGoal.set(...look);
      fit.dirGoal.set(pos[0] - look[0], pos[1] - look[1], pos[2] - look[2]).normalize();
      fit.distGoal = d;
      // the very first framing (and reduced motion) cuts; later ones glide
      const glide = fit.on && !fit.user && !wasUser && !CALM && fit.lastFrameAt > -1e8;
      if (glide) {
        // stay where we are; applyFit() moves us toward the new goal
        controls.target.copy(fit.look).add(fit.shift).add(fit.bias);
        camera.position.copy(controls.target).addScaledVector(fit.dir, fit.dist * fit.scale);
      } else {
        fit.look.copy(fit.lookGoal); fit.dir.copy(fit.dirGoal); fit.dist = d;
        if (fit.on && !fit.user) applyFit(0);
      }
    }
    fit.lastFrameAt = now;
  }
  // Advance the simulation without waiting for animation frames (used when
  // the page is in a background tab, and for automated checks).
  function advance(seconds = 2) {
    for (let t = 0; t < seconds; t += 1 / 60) {
      for (const b of [...bodies]) stepBody(b, 1 / 60);
      scanAppears(); stepAppears(1 / 60);
      stepPops(1 / 60);
      const due = Math.round(t * 60) % 8 === 0; const r = due ? measureTick() : null;
      if (Math.round(t * 60) % 3 === 0) focusTick();
      floor.position.y += (floorGoal - floor.position.y) * (4 / 60);
      if (fit.on && !fit.user && STAGE) { if (due) fitStep(r); applyFit(1 / 60); }
    }
    controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
  }
  return { onFrame, advance, scene, world, camera, controls, addBody, removeBody, dropTo, springTo, flyAway, clear, label, box, frameCamera, bodies, renderer, setVisible };
}

// Distinct but harmonious block colours, picked by value so the same
// value always gets the same colour across operations.
const PALETTE = ['#2fc092', '#4b9ee2', '#9b7ef4', '#e55a9b', '#dd8238', '#31aab0', '#c08a1f', '#5c7a4a'];
export function colorFor(v) { return PALETTE[Math.abs(Number(v) || 0) % PALETTE.length]; }
