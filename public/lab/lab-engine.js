// Shared 3D engine for every chapter lab (public/lab/*.js).
// One three.js scene + CSS2D labels + a tiny physics step: bodies either
// fall under gravity onto a floor height (bouncing with damping) or spring
// toward a target position. Enough to make data-structure operations feel
// physical without pulling in a full physics library.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

export { THREE };

export function createLab(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#fbf7f0');
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  camera.position.set(0, 7, 16);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.domElement.style.position = 'absolute';
  labels.domElement.style.inset = '0';
  labels.domElement.style.pointerEvents = 'none';
  container.appendChild(labels.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 6;
  controls.maxDistance = 40;

  scene.add(new THREE.HemisphereLight('#ffffff', '#e8dcc6', 1.6));
  const sun = new THREE.DirectionalLight('#ffffff', 1.8);
  sun.position.set(6, 14, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 });
  scene.add(sun);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(30, 64),
    new THREE.MeshStandardMaterial({ color: '#f1e8d8', roughness: 1 })
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

  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    for (const b of bodies) stepBody(b, dt);
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
          b.vel.y = -b.vel.y * 0.32; // bounce, losing energy
        } else {
          b.vel.y = 0;
          b.mode = 'rest';
          b.onSettle && b.onSettle();
        }
      }
    } else if (b.mode === 'spring') {
      // critically-damped-ish spring toward target
      for (const k of ['x', 'y', 'z']) {
        const a = (b.target[k] - p[k]) * 90 - b.vel[k] * 16;
        b.vel[k] += a * dt;
        p[k] += b.vel[k] * dt;
      }
      if (p.distanceTo(b.target) < 0.01 && b.vel.length() < 0.05) {
        p.copy(b.target);
        b.vel.set(0, 0, 0);
        b.mode = 'rest';
        b.onSettle && b.onSettle();
      }
    } else if (b.mode === 'fly') {
      b.vel.y += GRAVITY * 0.35 * dt;
      p.addScaledVector(b.vel, dt);
      b.obj.rotation.x += dt * 4;
      b.obj.rotation.z += dt * 3;
      b.life -= dt;
      b.obj.traverse((o) => { if (o.material && o.material.transparent) o.material.opacity = Math.max(0, b.life); });
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
    b.target.copy(target); b.mode = 'spring'; b.onSettle = onSettle;
  }
  function flyAway(b, dir = new THREE.Vector3(0, 9, 4)) {
    b.vel.copy(dir); b.mode = 'fly'; b.life = 1;
    b.obj.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; } });
    b.obj.traverse((o) => { if (o.element) o.element.style.opacity = '0'; });
  }
  function clear() {
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
  function box(color, size = [1.6, 0.9, 1.6]) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(...size),
      new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 })
    );
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function frameCamera(pos, look) {
    // Embedded beside the video (stage mode) the canvas is smaller and wide,
    // so step back a little to keep the whole structure in frame.
    if (document.body.classList.contains('stage')) {
      pos = pos.map((v, i) => look[i] + (v - look[i]) * 1.18);
    }
    camera.position.set(...pos);
    controls.target.set(...look);
  }
  // Advance the simulation without waiting for animation frames (used when
  // the page is in a background tab, and for automated checks).
  function advance(seconds = 2) {
    for (let t = 0; t < seconds; t += 1 / 60) for (const b of [...bodies]) stepBody(b, 1 / 60);
    controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
  }
  return { advance, scene, world, camera, controls, addBody, removeBody, dropTo, springTo, flyAway, clear, label, box, frameCamera, bodies };
}

// Distinct but harmonious block colours, picked by value so the same
// value always gets the same colour across operations.
const PALETTE = ['#2fc092', '#4b9ee2', '#9b7ef4', '#e55a9b', '#dd8238', '#31aab0', '#c08a1f', '#5c7a4a'];
export function colorFor(v) { return PALETTE[Math.abs(Number(v) || 0) % PALETTE.length]; }
