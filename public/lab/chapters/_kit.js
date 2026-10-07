// Small helpers shared by the lecture-synced scenes that sync passes add to a
// chapter module (the "FRAG" fragments). The shell calls the module's stop()
// before every scene, so fresh() only has to clear the stage and aim the camera.
export default function kit(ctx) {
  const { THREE, lab, colorFor, controls, beat } = ctx;
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
  async function anim(tok, ms, fn) { const steps = Math.max(10, Math.min(30, Math.round(ms / 33))); for (let k = 1; k <= steps; k++) { fn(ease(k / steps)); await beat(tok, ms / steps); } }
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
    if (parent) m.userData.edge = line(parent.position.x, parent.position.y, x, y, z);
    return m;
  }
  return { V3, GOLD, GREEN, RED, GRAY, MONO, fresh, tag, cube, bodyOf, move, fly, kill, glow, tint, txt, relabel, showL, code, anim, line, arrow, ghostBox, lnode, tnode };
}
