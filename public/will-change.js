// will-change only while something animates. When a CSS animation or
// transition starts, the element gets `will-change` for exactly the
// compositor properties it animates (opacity / transform / translate / scale
// / rotate), so the browser can move it to its own layer before the first
// frame; when it ends or is cancelled, the hint is removed again, so nothing
// keeps a layer (memory, battery) after it has stopped moving. Looping
// animations (spinners) keep it while they run. Only properties the
// animation itself changes are hinted, so this never turns an element into a
// containing block for fixed children when its animation doesn't already.
(function () {
  const GPU = new Set(['opacity', 'transform', 'translate', 'scale', 'rotate']);
  const css = (p) => p.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
  function refresh(el) {
    if (!el || !el.style || !el.getAnimations) return;
    const props = new Set();
    for (const a of el.getAnimations()) {
      if (a.playState !== 'running' && a.playState !== 'pending') continue;
      const fx = a.effect;
      if (!fx || fx.target !== el || !fx.getKeyframes) continue;
      for (const k of fx.getKeyframes()) for (const p of Object.keys(k)) if (GPU.has(css(p))) props.add(css(p));
    }
    const value = [...props].join(', ');
    if (el.style.willChange !== value) el.style.willChange = value;
  }
  const onEvent = (e) => {
    // a transition that animates something we don't hint (color, border) needs no work
    if (e.propertyName && !GPU.has(e.propertyName) && !e.target.style.willChange) return;
    refresh(e.target);
  };
  for (const type of ['animationstart', 'animationend', 'animationcancel', 'transitionrun', 'transitionend', 'transitioncancel']) {
    document.addEventListener(type, onEvent, true);
  }
})();
