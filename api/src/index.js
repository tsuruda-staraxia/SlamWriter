// SlamWriter shared favorites API (Cloudflare Worker + D1)
//   GET    /riffs        -> newest 200 saved riffs
//   POST   /riffs        -> save {user, title, song, token}
//   DELETE /riffs/:id    -> delete own riff (X-Token header must match the token used to save)

const ORIGINS = ['https://tsuruda-staraxia.github.io', 'http://localhost:5178', 'http://127.0.0.1:5178'];
const PATS = ['twobass','twobass_half','blast','hammer','bomb','skank','dbeat','rock','slam','follow','none'];
const CYMS = ['hat','ride','china','crash'];
const MAX_PER_HOUR = 20, MAX_TOTAL = 5000, LIST_LIMIT = 200;

const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))]
  .map(b => b.toString(16).padStart(2, '0')).join('');
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const clean = (s, max) => typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '';

// Validate a packed song and return a normalised copy (or null if malformed)
function checkSong(s){
  if(!s || typeof s !== 'object') return null;
  if(!isInt(s.bpm,40,300) || !isInt(s.bars,1,16) || (s.res !== 16 && s.res !== 32)) return null;
  const C = s.bars * s.res;
  if(!Array.isArray(s.n) || s.n.length > C*7) return null;
  for(const e of s.n) if(!Array.isArray(e) || e.length !== 3 || !isInt(e[0],0,C-1) || !isInt(e[1],0,6) || !isInt(e[2],0,24)) return null;
  for(const k of ['pm','r']){
    if(!Array.isArray(s[k]) || s[k].length > C) return null;
    for(const c of s[k]) if(!isInt(c,0,C-1)) return null;
  }
  if(!Array.isArray(s.d) || s.d.length !== s.bars) return null;
  for(const d of s.d) if(!Array.isArray(d) || d.length !== 3 || !PATS.includes(d[0]) || !CYMS.includes(d[2])) return null;
  return { v:1, bpm:s.bpm, bars:s.bars, res:s.res, n:s.n, pm:s.pm, r:s.r, d:s.d.map(d => [d[0], d[1] ? 1 : 0, d[2]]) };
}

export default {
  async fetch(req, env){
    const origin = req.headers.get('Origin'), url = new URL(req.url);
    const cors = {
      'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Token',
      'Access-Control-Max-Age': '86400', 'Vary': 'Origin',
    };
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
    if(req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    try{
      if(url.pathname === '/riffs' && req.method === 'GET'){
        const { results } = await env.DB.prepare(
          'SELECT id, user, title, data, created_at FROM riffs ORDER BY created_at DESC LIMIT ?').bind(LIST_LIMIT).all();
        return json({ riffs: results.map(r => ({ id:r.id, user:r.user, title:r.title, created_at:r.created_at, song:JSON.parse(r.data) })) });
      }

      if(url.pathname === '/riffs' && req.method === 'POST'){
        if(origin && !ORIGINS.includes(origin)) return json({ error: 'origin not allowed' }, 403);
        const raw = await req.text();
        if(raw.length > 60000) return json({ error: 'too large' }, 413);
        let body; try{ body = JSON.parse(raw); }catch(e){ return json({ error: 'bad json' }, 400); }
        const user = clean(body.user, 24), title = clean(body.title, 48) || 'Untitled', song = checkSong(body.song);
        if(!user) return json({ error: 'user name required' }, 400);
        if(!song) return json({ error: 'invalid song' }, 400);
        if(typeof body.token !== 'string' || body.token.length < 16 || body.token.length > 100) return json({ error: 'invalid token' }, 400);
        const now = Date.now(), ipHash = await sha('ip:' + (req.headers.get('CF-Connecting-IP') || ''));
        const recent = await env.DB.prepare('SELECT COUNT(*) AS c FROM riffs WHERE ip_hash = ? AND created_at > ?').bind(ipHash, now - 3600e3).first();
        if(recent.c >= MAX_PER_HOUR) return json({ error: 'too many saves, try again later' }, 429);
        const total = await env.DB.prepare('SELECT COUNT(*) AS c FROM riffs').first();
        if(total.c >= MAX_TOTAL) return json({ error: 'the shared list is full' }, 507);
        const id = crypto.randomUUID();
        await env.DB.prepare('INSERT INTO riffs (id, user, title, data, token_hash, ip_hash, created_at) VALUES (?,?,?,?,?,?,?)')
          .bind(id, user, title, JSON.stringify(song), await sha(body.token), ipHash, now).run();
        return json({ riff: { id, user, title, created_at: now, song } }, 201);
      }

      const m = url.pathname.match(/^\/riffs\/([0-9a-f-]{36})$/);
      if(m && req.method === 'DELETE'){
        const token = req.headers.get('X-Token') || '';
        const res = await env.DB.prepare('DELETE FROM riffs WHERE id = ? AND token_hash = ?').bind(m[1], await sha(token)).run();
        return res.meta.changes ? json({ ok: true }) : json({ error: 'not found or not yours' }, 403);
      }
      return json({ error: 'not found' }, 404);
    }catch(e){
      return json({ error: 'server error' }, 500);
    }
  }
};
