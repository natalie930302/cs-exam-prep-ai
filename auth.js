// One password for the whole site, set as SITE_PASSWORD (the cloud copy has
// it; the local server normally doesn't, and then nothing asks for it).
// Logging in stores a cookie holding a hash of the password, so changing the
// password logs every device out. middleware.js does the same check on
// Vercel before static files are served.
const crypto = require('node:crypto');

const COOKIE = 'csie_auth';
const OPEN = /^\/(login|api\/login|favicon\.svg|theme\.css)(\/|$|\?)/;
const password = () => process.env.SITE_PASSWORD || '';
const token = () => crypto.createHash('sha256').update('csie-prep:' + password()).digest('hex');

function cookieToken(req) {
  const m = /(?:^|;\s*)csie_auth=([0-9a-f]{64})/.exec(req.headers.cookie || '');
  return m ? m[1] : '';
}
function signedIn(req) {
  if (!password()) return true;
  const a = Buffer.from(cookieToken(req)), b = Buffer.from(token());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// everything except the login page needs the cookie
function requireLogin(req, res, next) {
  if (signedIn(req) || OPEN.test(req.path)) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: '請先登入' });
  res.redirect(302, '/login?next=' + encodeURIComponent(req.originalUrl));
}

function login(req, res) {
  const given = String((req.body || {}).password || '');
  const a = crypto.createHash('sha256').update(given).digest(), b = crypto.createHash('sha256').update(password()).digest();
  if (!password() || !crypto.timingSafeEqual(a, b)) {
    // a little wait makes guessing slow
    return setTimeout(() => res.status(401).json({ error: '密碼不對' }), 800);
  }
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader('Set-Cookie', `${COOKIE}=${token()}; Path=/; Max-Age=${180 * 86400}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`);
  res.json({ ok: true });
}

module.exports = { requireLogin, login, signedIn };
