// Small helpers shared by the lecture-synced scenes that sync passes add to a
// chapter module (the "FRAG" fragments). The shell calls the module's stop()
// before every scene, so fresh() only has to clear the stage and aim the camera.
export default function kit(ctx) {
  const { THREE, lab, colorFor, controls, beat } = ctx;
  // next lecture step: waits until the lecturer says it (see lab-shell step())
  const step = (tok) => ctx.step(tok);
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', RED = '#7a1010', GRAY = '#d8cfc0';
  const MONO = { whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '11px', fontWeight: '600' };
  function fresh(pos, look) { lab.clear(); if (controls) controls(''); lab.frameCamera(pos, look); }
  function tag(text, cls, x, y, z = 0) { const l = lab.label(text, cls || ''); l.position.set(x, y, z); lab.world.add(l); return l; }
  // a value cube; dropH > 0 makes it fall into place from that height
  function cube(text, color, size, x, y, z = 0, dropH = 0) {
    const m = lab.box(color, size);
    if (text !== null && text !== undefined && text !== '') { m.userData.lbl = lab.label(String(text), 'val'); m.add(m.userData.lbl); }
    if (dropH > 0) { m.position.set(x, y + dropH, z); lab.dropTo(lab.addBody(m), V3(x, y, z)); }
    else { m.position.set(x, y, z); lab.world.add(m); }
    return m;
  }
  function bodyOf(o) { for (const b of lab.bodies) if (b.obj === o) return b; return lab.addBody(o); }
  const move = (o, x, y, z = 0) => lab.springTo(bodyOf(o), V3(x, y, z));
  // where o will rest: the landing / spring target while it is still falling or moving, else its position
  // (edges drawn right after a drop or move use this, so they meet the node once it lands)
  function land(o) { for (const b of lab.bodies) if (b.obj === o && (b.mode === 'fall' || b.mode === 'spring')) return b.target; return o.position; }
  const fly = (o, dir) => lab.flyAway(bodyOf(o), dir || V3((Math.random() - 0.5) * 6, 8, 4));
  function kill(o) {
    if (!o) return;
    for (const b of lab.bodies) if (b.obj === o) { lab.removeBody(b); return; }
    lab.world.remove(o); o.traverse((c) => { if (c.element) c.element.remove(); });
  }
  const glow = (m, c) => { m.material.emissive = new THREE.Color(c || '#000000'); };
  const tint = (m, c) => { m.material.color.set(c); };
  const txt = (l, t) => { l.element.textContent = t; };
  const relabel = (m, t) => { if (m.userData.lbl) txt(m.userData.lbl, String(t)); };
  const showL = (l, on) => { l.element.style.visibility = on ? '' : 'hidden'; };
  // a code / pseudocode panel: one monospace label per line, hl(i) lights the current line
  function code(lines, x, yTop, dy = 0.56, z = 0) {
    const w = Math.max(...lines.map((s) => s.length));
    const ls = lines.map((s, i) => { const l = tag(s.padEnd(w, ' '), '', x, yTop - i * dy, z); Object.assign(l.element.style, MONO); return l; });
    return { ls, hl(i) { ls.forEach((l, k) => { l.element.className = 'lab-label' + (k === i ? ' ptr alt' : ''); }); }, kill() { ls.forEach(kill); } };
  }
  // eased (in-out sine) and smoother for longer moves; still ends exactly at t = 1
  const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease = (t) => (REDUCED ? t : 0.5 - 0.5 * Math.cos(Math.PI * t));
  async function anim(tok, ms, fn) { if (ctx.behind && ctx.behind(tok)) { fn(1); return beat(tok, 0); } const steps = Math.max(10, Math.min(30, Math.round(ms / 33))); for (let k = 1; k <= steps; k++) { fn(ease(k / steps)); await beat(tok, ms / steps); } }
  function line(x1, y1, x2, y2, z = 0, color = '#a99470') {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(x1, y1, z), V3(x2, y2, z)]), new THREE.LineBasicMaterial({ color }));
    lab.world.add(l); return l;
  }
  // a pointer arrow from a to b (Vector3s); kill() it to remove
  function arrow(a, b, color = 0x6e5f49) {
    const d = b.clone().sub(a); const len = Math.max(0.05, d.length());
    const h = new THREE.ArrowHelper(d.normalize(), a, len, color, Math.min(0.35, len * 0.4), 0.22);
    lab.world.add(h); return h;
  }
  function ghostBox(color, w, h, d) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false }));
    lab.world.add(m); return m;
  }
  // a linked-list node (data box + link box) at (x,y,z); returns the group
  function lnode(v, x, y, z = 0, color) {
    const g = new THREE.Group();
    const d = lab.box(color || colorFor(v), [1.0, 0.7, 1.0]); d.add(lab.label(String(v), 'val'));
    const k = lab.box('#d8c29b', [0.45, 0.7, 1.0]); k.position.x = 0.73;
    g.add(d, k); g.userData.data = d; g.position.set(x, y, z); lab.world.add(g); return g;
  }
  // a binary-tree node sphere-ish cube with an edge line to its parent (if given)
  function tnode(v, x, y, z = 0, parent = null, color) {
    const m = cube(v, color || colorFor(v), [0.9, 0.9, 0.9], x, y, z);
    if (parent) { const p = land(parent); m.userData.edge = line(p.x, p.y, x, y, z); }
    return m;
  }
  // ── pictures with a purpose (lecture-synced scenes) ──
  // a picture: big glyph (emoji) with a short name under it; cls 'sm' | 'lg'
  function icon(glyph, name, x, y, z = 0, cls = '') {
    const l = lab.label('', 'icon ' + cls);
    l.element.innerHTML = '<span class="g"></span>' + (name ? '<span class="t"></span>' : '');
    l.element.querySelector('.g').textContent = glyph;
    if (name) l.element.querySelector('.t').textContent = name;
    l.position.set(x, y, z); lab.world.add(l); return l;
  }
  const rename = (l, name) => { const t = l.element.querySelector('.t'); if (t) t.textContent = name; };
  const dim = (l, on = true) => l.element.classList.toggle('off', on);
  // a region (memory section, function frame, device): a soft floor panel and its name
  function zone(name, x, y, z, w, d, color = '#e9dcc4') {
    const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    t.position.set(x, y, z); t.receiveShadow = true; lab.world.add(t);
    const l = tag(name, 'zone', x - w / 2 + 0.2, y + 0.05, z - d / 2 - 0.25); l.center.set(0, 0.5);
    t.userData.name = l; return t;
  }
  // a label that moves along a straight path (data travelling, a hand following an arrow)
  async function travel(tok, l, a, b, ms = 900) {
    await anim(tok, ms, (u) => l.position.lerpVectors(a, b, u));
  }
  // take an object off the stage together with every label nested in it
  // (a group's name/value labels would otherwise stay on the page)
  function remove(l) {
    if (!l) return;
    if (l.parent) l.parent.remove(l); else lab.world.remove(l);
    if (l.traverse) l.traverse((c) => { if (c.element) c.element.remove(); }); else if (l.element) l.element.remove();
    if (l.userData && l.userData.name) remove(l.userData.name);
  }
  // ── cute characters and props (friendly pictures instead of bare blocks) ──
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.55 }, o));
  const SPH = new THREE.SphereGeometry(1, 20, 14);
  function ball(c, r, x, y, z, o) { const m = new THREE.Mesh(SPH, mat(c, o)); m.scale.setScalar(r); m.position.set(x, y, z); return m; }
  // a buddy: a rounded block with eyes, cheeks and a mouth that breathes,
  // blinks and shows a mood. It holds a value on its belly and its name above.
  //   b.set(v)  b.mood('happy'|'sad'|'wow'|'calm')  await b.hop(tok)  b.look(dx)
  function buddy(name, v, color, x, y, z = 0, size = 1) {
    const g = new THREE.Group(); g.position.set(x, y, z);
    const w = 1.15 * size, h = 1.0 * size, d = 0.95 * size;
    const body = lab.box(color, [w, h, d]); body.position.y = h / 2; g.add(body);
    const fz = d / 2 + 0.01, ey = h * 0.66;
    const eyes = [-1, 1].map((sx) => {
      const e = new THREE.Group(); e.position.set(sx * w * 0.2, ey, fz);
      e.add(ball('#ffffff', 0.13 * size, 0, 0, 0));
      const p = ball('#2b2118', 0.075 * size, 0, -0.01, 0.07 * size, { roughness: 0.3 }); e.add(p); e.userData.p = p;
      e.add(ball('#ffffff', 0.025 * size, 0.03 * size, 0.03 * size, 0.13 * size, { emissive: '#ffffff' }));
      g.add(e); return e;
    });
    [-1, 1].forEach((sx) => { const c = ball('#ff9aa8', 0.08 * size, sx * w * 0.34, ey - 0.17 * size, fz - 0.03, { transparent: true, opacity: 0.75 }); c.scale.z = 0.02; g.add(c); });
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.09 * size, 0.022 * size, 6, 16, Math.PI), mat('#2b2118'));
    mouth.position.set(0, ey - 0.2 * size, fz); g.add(mouth);
    const val = lab.label(v === '' || v == null ? ' ' : String(v), 'val'); val.position.set(0, h * 0.26, fz + 0.02); g.add(val);
    const nm = name ? lab.label(name, 'ptr') : null; if (nm) { nm.position.set(0, h + 0.35, 0); g.add(nm); }
    lab.world.add(g);
    let mood = 'calm', jump = 0, blinkAt = 1 + Math.random() * 3, lookX = 0;
    const setMouth = (m) => {
      mood = m;
      if (m === 'happy') { mouth.rotation.z = Math.PI; mouth.scale.set(1.25, 1.25, 1); }
      else if (m === 'sad') { mouth.rotation.z = 0; mouth.scale.set(1, 0.8, 1); mouth.position.y = ey - 0.26 * size; return; }
      else if (m === 'wow') { mouth.rotation.z = Math.PI; mouth.scale.set(0.7, 1.6, 1); }
      else { mouth.rotation.z = Math.PI; mouth.scale.set(1, 0.7, 1); }
      mouth.position.y = ey - 0.2 * size;
    };
    setMouth('calm');
    const t0 = Math.random() * 6;
    lab.onFrame && lab.onFrame((dt, t) => {
      if (!g.parent) return;
      const breathe = 1 + Math.sin((t + t0) * 2.2) * 0.025;
      body.scale.set(1 / Math.sqrt(breathe), breathe, 1 / Math.sqrt(breathe));
      body.position.y = (h * breathe) / 2;
      const bl = (t % 4 + t0) % 4 < 0.12 ? 0.1 : 1;
      eyes.forEach((e) => { e.scale.y = bl; e.position.y = ey * breathe; e.userData.p.position.x += (lookX * 0.05 * size - e.userData.p.position.x) * Math.min(1, dt * 8); });
      if (jump > 0) { jump = Math.max(0, jump - dt * 2.4); g.position.y = y + Math.sin(jump * Math.PI) * 0.6 * size; }
    });
    return {
      g, body, val,
      set(nv) { val.element.textContent = nv === '' || nv == null ? ' ' : String(nv); lab.pop ? lab.pop(body, 1) : null; },
      mood: setMouth,
      look(dx) { lookX = Math.max(-1, Math.min(1, dx)); },
      async hop(tok) { jump = 1; await anim(tok, 420, () => {}); },
      glow(c) { body.material.emissive = new THREE.Color(c || '#000000'); },
      name: nm,
    };
  }
  // small 3D props: what a thing IS, drawn as a thing (not an emoji)
  function prop(kind, x, y, z = 0, s = 1, label) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s);
    const add = (m, px, py, pz) => { m.position.set(px, py, pz); g.add(m); return m; };
    const B = (c, w, h, d) => lab.box(c, [w, h, d]);
    if (kind === 'cpu') {
      add(B('#5d6b7a', 1.2, 0.18, 1.2), 0, 0.09, 0); add(B('#c9d3dc', 0.6, 0.06, 0.6), 0, 0.21, 0);
      for (let i = -2; i <= 2; i++) { add(B('#d9b45a', 0.08, 0.05, 0.25), i * 0.22, 0.05, 0.72); add(B('#d9b45a', 0.08, 0.05, 0.25), i * 0.22, 0.05, -0.72); add(B('#d9b45a', 0.25, 0.05, 0.08), 0.72, 0.05, i * 0.22); add(B('#d9b45a', 0.25, 0.05, 0.08), -0.72, 0.05, i * 0.22); }
    } else if (kind === 'monitor') {
      add(B('#3d4450', 1.6, 1.05, 0.12), 0, 1.05, 0); add(B('#9fd3f0', 1.42, 0.88, 0.02), 0, 1.05, 0.07);
      add(B('#3d4450', 0.14, 0.45, 0.14), 0, 0.3, -0.05); add(B('#3d4450', 0.7, 0.08, 0.45), 0, 0.04, 0);
    } else if (kind === 'keyboard') {
      add(B('#e6e1d8', 1.7, 0.12, 0.7), 0, 0.06, 0);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) add(B('#ffffff', 0.15, 0.07, 0.15), -0.66 + c * 0.19, 0.15, -0.2 + r * 0.2);
    } else if (kind === 'printer') {
      add(B('#d9d4cb', 1.4, 0.6, 0.9), 0, 0.3, 0); add(B('#ffffff', 0.9, 0.04, 0.6), 0, 0.64, -0.1); add(B('#ffffff', 0.9, 0.02, 0.4), 0, 0.35, 0.55);
    } else if (kind === 'disk') {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.6, 28), mat('#8a94a6')); add(c, 0, 0.3, 0);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.61, 0.61, 0.04, 28), mat('#b9c2d0')); add(t, 0, 0.45, 0);
      const t2 = t.clone(); add(t2, 0, 0.18, 0);
    } else if (kind === 'file') {
      add(B('#ffffff', 0.8, 1.05, 0.06), 0, 0.53, 0);
      for (let i = 0; i < 4; i++) add(B('#b9c2d0', 0.55, 0.05, 0.02), 0, 0.8 - i * 0.17, 0.04);
      add(B('#f3d36b', 0.25, 0.25, 0.07), 0.27, 0.93, 0.01);
    } else if (kind === 'warehouse') {
      add(B('#f3dcc0', 1.8, 0.9, 1.3), 0, 0.45, 0);
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 1.25, 0.6, 4, 1), mat('#d08a4a')); roof.rotation.y = Math.PI / 4; add(roof, 0, 1.2, 0);
      add(B('#a9683a', 0.6, 0.6, 0.04), 0, 0.3, 0.66);
    } else if (kind === 'lock') {
      add(B('#e2b13c', 0.6, 0.5, 0.3), 0, 0.25, 0);
      const sh = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 20, Math.PI), mat('#9aa3ad')); add(sh, 0, 0.5, 0);
    } else if (kind === 'parcel') {
      add(B('#d9a86c', 0.9, 0.7, 0.9), 0, 0.35, 0); add(B('#b8844b', 0.92, 0.12, 0.2), 0, 0.71, 0); add(B('#b8844b', 0.2, 0.12, 0.92), 0, 0.71, 0);
    } else if (kind === 'note') {
      add(B('#fff1a6', 0.7, 0.04, 0.5), 0, 0.02, 0);
    }
    if (label) { const l = lab.label(label, 'say'); l.position.set(0, kind === 'monitor' ? 1.8 : 1.3, 0); g.add(l); g.userData.label = l; }
    lab.world.add(g); return g;
  }
  // a gentle bob for props (things that are "alive" on screen)
  function bob(o, amp = 0.08, speed = 2) { const y0 = o.position.y, t0 = Math.random() * 6; if (lab.onFrame) lab.onFrame((dt, t) => { if (o.parent) o.position.y = y0 + Math.sin((t + t0) * speed) * amp; }); }
  return { V3, GOLD, GREEN, RED, GRAY, MONO, fresh, tag, cube, bodyOf, move, land, fly, kill, glow, tint, txt, relabel, showL, code, anim, line, arrow, ghostBox, lnode, tnode, step, icon, rename, dim, zone, travel, remove, buddy, prop, bob };
}
