// Vercel Routing Middleware: runs before every request, static files
// included, so notes, subtitles and labs also need the login cookie.
// Same check as auth.js (cookie = sha256("csie-prep:" + SITE_PASSWORD)).
// The Claude connector's paths (MCP + OAuth, see mcp.js) check their own
// tokens instead of the cookie.
export const config = { matcher: ['/((?!login|api/login|favicon\\.svg|theme\\.css|mcp|authorize|token|register|revoke|\\.well-known/).*)'] };

export default async function middleware(request) {
  const password = process.env.SITE_PASSWORD || '';
  const pass = () => new Response(null, { headers: { 'x-middleware-next': '1' } });
  if (!password) return pass();
  const bytes = new TextEncoder().encode('csie-prep:' + password);
  const want = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const got = (/(?:^|;\s*)csie_auth=([0-9a-f]{64})/.exec(request.headers.get('cookie') || '') || [])[1];
  if (got === want) return pass();
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return Response.json({ error: '請先登入' }, { status: 401 });
  return Response.redirect(new URL('/login?next=' + encodeURIComponent(url.pathname + url.search), url), 302);
}
