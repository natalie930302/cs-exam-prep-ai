// 講義 Markdown (public/handouts/*.md): a small subset — headings, paragraphs,
// lists, bold, inline code, fenced blocks, tables and > callouts. Shared by the
// study room's 講義 tab and the per-subject 速記卡 page.
function mdEsc(x){ return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function mdInline(x){
  const codes = [];
  x = mdEsc(x).replace(/`([^`]+)`/g, function(m, c){ codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
  x = x.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  // made-up example numbers and textbook additions are tinted, so the reader sees what the lectures didn't teach
  x = x.replace(/（((?:示意|補充)[^）]{0,8})）/g, '<span class="ho-tag">（$1）</span>');
  return x.replace(/\u0000(\d+)\u0000/g, function(m, i){ return '<code>' + codes[i] + '</code>'; });
}
function mdToHtml(md){
  const lines = md.replace(/\r/g, '').split('\n'), out = [];
  let i = 0;
  const isBlockStart = function(l){ return /^(#{1,3}\s|```|>|\s*[-*]\s|\s*\d+\.\s|\|)/.test(l); };
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^(#{1,3})\s+(.*)$/))) { const n = m[1].length; out.push('<h' + (n + 1) + '>' + mdInline(m[2]) + '</h' + (n + 1) + '>'); i++; continue; }
    if (/^```/.test(l)) {
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push('<pre><code>' + mdEsc(buf.join('\n')) + '</code></pre>'); continue;
    }
    if (/^>/.test(l)) {
      const buf = [];
      while (i < lines.length && /^>/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      const kind = (buf[0].match(/^\*\*(重點|例題|陷阱|比喻|觀念)\*\*/) || [])[1];
      out.push('<div class="ho-call' + (kind ? ' ho-' + {'重點': 'key', '例題': 'ex', '陷阱': 'trap', '比喻': 'meta', '觀念': 'idea'}[kind] : '') + '">' + mdToHtml(buf.join('\n')) + '</div>'); continue;
    }
    if (/^\|/.test(l)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = function(r){ return r.replace(/^\||\|\s*$/g, '').split('|').map(function(c){ return c.trim(); }); };
      const body = rows.filter(function(r){ return !/^\|[\s:|-]+\|?\s*$/.test(r); });
      out.push('<div class="ho-table"><table>' + body.map(function(r, ri){
        const tag = ri === 0 && rows.length > 1 && /^\|[\s:|-]+\|?\s*$/.test(rows[1]) ? 'th' : 'td';
        return '<tr>' + cells(r).map(function(c){ return '<' + tag + '>' + mdInline(c) + '</' + tag + '>'; }).join('') + '</tr>';
      }).join('') + '</table></div>'); continue;
    }
    if (/^\s*([-*]|\d+\.)\s/.test(l)) {
      const ordered = /^\s*\d+\./.test(l), items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s|^\s{2,}\S/.test(lines[i])) {
        const li = lines[i++];
        if (/^\s{2,}/.test(li) && items.length) items[items.length - 1].sub.push(li.replace(/^\s{2}/, ''));
        else items.push({text: li.replace(/^\s*([-*]|\d+\.)\s+/, ''), sub: []});
      }
      out.push('<' + (ordered ? 'ol' : 'ul') + '>' + items.map(function(it){
        return '<li>' + mdInline(it.text) + (it.sub.length ? mdToHtml(it.sub.join('\n')) : '') + '</li>';
      }).join('') + '</' + (ordered ? 'ol' : 'ul') + '>'); continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) buf.push(lines[i++]);
    if (!buf.length) buf.push(lines[i++]);
    out.push('<p>' + mdInline(buf.join('\n')).replace(/\n/g, '<br>') + '</p>');
  }
  return out.join('');
}
