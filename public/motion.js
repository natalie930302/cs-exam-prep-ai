// Every component that appears or goes away animates, and a component that
// goes away finishes fading out before it is actually hidden or removed.
//
// - el.hidden = true / false (used all over the site) is wrapped: hiding plays
//   a short fade-out first and only then sets the attribute; showing sets it
//   and plays a fade-in. Reading el.hidden returns the requested state right
//   away, so code that checks it keeps working.
// - el.fadeRemove(cb) fades an element out, then removes it.
// - Containers that swap one child for another in place (tab panels, the
//   main sections) hide their old child instantly, otherwise both would be on
//   screen during the fade; the new one still fades in.
// - prefers-reduced-motion: everything is instant.
(function () {
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  const calm = () => !!(reduce && reduce.matches);
  const SWAP = '.st-panel, .sec, .sp, [data-motion="none"]';
  const desc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'hidden');
  if (!desc || !desc.set) return;
  const LEAVE_MS = 200;

  function shown(el) {
    return el.isConnected && !desc.get.call(el) && getComputedStyle(el).display !== 'none';
  }
  function finish(el) {
    el.classList.remove('m-leave');
    clearTimeout(el.__mTimer);
    el.__mTimer = null;
  }
  function leave(el, done) {
    el.__mPending = true;
    el.classList.remove('m-enter');
    el.classList.add('m-leave');
    clearTimeout(el.__mTimer);
    el.__mTimer = setTimeout(function () {
      if (el.__mPending !== true) return; // shown again meanwhile
      finish(el);
      el.__mPending = undefined;
      done();
    }, LEAVE_MS);
  }
  function enter(el) {
    el.classList.remove('m-enter');
    void el.offsetWidth; // restart the animation
    el.classList.add('m-enter');
    clearTimeout(el.__mEnterTimer);
    el.__mEnterTimer = setTimeout(function () { el.classList.remove('m-enter'); }, 400);
  }

  Object.defineProperty(HTMLElement.prototype, 'hidden', {
    configurable: true,
    enumerable: desc.enumerable,
    get: function () { return this.__mPending !== undefined ? this.__mPending : desc.get.call(this); },
    set: function (v) {
      const el = this;
      v = !!v;
      if (calm() || !el.isConnected || el.matches(SWAP)) {
        if (el.__mTimer) { finish(el); el.__mPending = undefined; }
        desc.set.call(el, v);
        if (!v && !calm() && el.isConnected && !el.matches('[data-motion="none"]')) enter(el);
        return;
      }
      if (v) {
        if (el.__mPending === true || !shown(el)) { desc.set.call(el, true); return; }
        leave(el, function () { desc.set.call(el, true); });
      } else {
        const wasHidden = el.__mPending === true || desc.get.call(el);
        if (el.__mTimer) { finish(el); el.__mPending = undefined; }
        desc.set.call(el, false);
        if (wasHidden) enter(el);
      }
    },
  });

  Element.prototype.fadeRemove = function (cb) {
    const el = this;
    if (calm() || !el.isConnected) { el.remove(); if (cb) cb(); return; }
    if (el.__mRemoving) return;
    el.__mRemoving = true;
    el.classList.add('m-leave');
    setTimeout(function () { el.remove(); if (cb) cb(); }, LEAVE_MS);
  };
})();
