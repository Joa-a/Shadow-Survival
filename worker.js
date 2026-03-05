/**
 * SHADOW SURVIVOR — Leaderboard Worker (CORS fixed)
 * Cloudflare Workers + KV Storage
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

const toKey = name =>
  'score:' + name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 20);

export default {
  async fetch(request, env) {
    // CORS preflight — responde ANTES de cualquier lógica
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    // Wrap completo: errores internos tambien llevan CORS headers
    try {
      return await handle(request, env);
    } catch (err) {
      console.error('Worker crash:', err);
      return json({ error: 'Error interno: ' + err.message }, 500);
    }
  }
};

async function handle(request, env) {
  const url    = new URL(request.url);
  const method = request.method.toUpperCase();
  const path   = url.pathname.replace(/\/$/, '');

  // GET /scores
  if (method === 'GET' && (path === '/scores' || path === '')) {
    if (!env.SCORES) return json({ error: 'KV no configurado. Ve a Settings → KV Namespace Bindings → vincula SCORES.' }, 503);

    const list = await env.SCORES.list({ prefix: 'score:' });
    const entries = await Promise.all(
      list.keys.map(async k => {
        const v = await env.SCORES.get(k.name);
        return v ? JSON.parse(v) : null;
      })
    );
    const board = entries.filter(Boolean).sort((a, b) => b.time - a.time).slice(0, 100);
    return json(board);
  }

  // POST /scores
  if (method === 'POST' && path === '/scores') {
    if (!env.SCORES) return json({ error: 'KV no configurado.' }, 503);

    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'JSON invalido' }, 400); }

    const name = String(body.name || '').replace(/[<>"']/g, '').trim().slice(0, 16);
    if (!name) return json({ error: 'Nombre requerido' }, 400);

    const entry = {
      name,
      avatar: String(body.avatar || '👤').slice(0, 4),
      time:   Math.max(0, Math.floor(Number(body.time)  || 0)),
      kills:  Math.max(0, Math.floor(Number(body.kills) || 0)),
      level:  Math.max(1, Math.floor(Number(body.level) || 1)),
      mode:   body.mode === 'frenetic' ? 'frenetic' : 'normal',
      date:   new Date().toISOString(),
    };

    const key     = toKey(name);
    const prevRaw = await env.SCORES.get(key);
    const prev    = prevRaw ? JSON.parse(prevRaw) : null;

    if (!prev || entry.time > prev.time) {
      await env.SCORES.put(key, JSON.stringify(entry));
    }

    // Siempre calcular rank actual (aunque no haya batido record)
    const list2 = await env.SCORES.list({ prefix: 'score:' });
    const all2  = await Promise.all(list2.keys.map(async k => {
      const v = await env.SCORES.get(k.name); return v ? JSON.parse(v) : null;
    }));
    const board2 = all2.filter(Boolean).sort((a, b) => b.time - a.time);
    const rank   = board2.findIndex(e => e.name === name) + 1;

    return json({ saved: !prev || entry.time > prev.time, rank, total: board2.length });
  }

  return json({ ok: true, endpoints: ['GET /scores', 'POST /scores'] });
}
