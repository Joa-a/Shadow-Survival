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
      avatar: String(body.avatar || '👤').slice(0, 6),
      time:   Math.max(0, Math.floor(Number(body.time)  || 0)),
      kills:  Math.max(0, Math.floor(Number(body.kills) || 0)),
      level:  Math.max(1, Math.floor(Number(body.level) || 1)),
      mode:   body.mode === 'frenetic' ? 'frenetic' : 'normal',
      map:    ['dark_forest','cemetery'].includes(body.map) ? body.map : 'dark_forest',
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

  // POST /register — check + reserve username with PIN
  if (method === 'POST' && path === '/register') {
    if (!env.SCORES) return json({ error: 'KV no configurado.' }, 503);

    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'JSON invalido' }, 400); }

    const raw  = String(body.name || '').trim().replace(/[<>"'&]/g, '');
    const name = raw.slice(0, 16);
    if (name.length < 2) return json({ ok: false, error: 'Mínimo 2 caracteres' });

    const pin = String(body.pin || '').replace(/\D/g,'').slice(0, 6);
    if (pin.length !== 6) return json({ ok: false, error: 'PIN debe ser 6 dígitos' });

    const regKey = 'user:' + name.toLowerCase().replace(/\s+/g,'_');
    const exists = await env.SCORES.get(regKey);
    if (exists) return json({ ok: false, error: 'Ese nombre ya está tomado ⚔️' });

    const pinHash = await hashPin(pin, name);
    const userData = {
      name,
      avatar:       body.avatar || '👤',
      pinHash,
      registeredAt: new Date().toISOString(),
    };
    await env.SCORES.put(regKey, JSON.stringify(userData));
    return json({ ok: true, name, avatar: userData.avatar });
  }

  // POST /recover — login from new device with name + PIN
  if (method === 'POST' && path === '/recover') {
    if (!env.SCORES) return json({ ok: false, error: 'KV no configurado.' });

    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'JSON invalido' }, 400); }

    const name   = String(body.name || '').trim().slice(0, 16);
    const pin    = String(body.pin  || '').replace(/\D/g,'').slice(0, 6);
    const regKey = 'user:' + name.toLowerCase().replace(/\s+/g,'_');

    const raw = await env.SCORES.get(regKey);
    if (!raw) return json({ ok: false, error: 'Cuenta no encontrada' });

    const userData = JSON.parse(raw);
    const pinHash  = await hashPin(pin, name);

    if (pinHash !== userData.pinHash)
      return json({ ok: false, error: 'PIN incorrecto ❌' });

    return json({ ok: true, name: userData.name, avatar: userData.avatar });
  }

  // POST /check-name — availability check
  if (method === 'POST' && path === '/check-name') {
    if (!env.SCORES) return json({ available: true });
    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'JSON invalido' }, 400); }
    const regKey = 'user:' + String(body.name||'').trim().slice(0,16).toLowerCase().replace(/\s+/g,'_');
    const exists = await env.SCORES.get(regKey);
    return json({ available: !exists });
  }


  // GET /souls?name=xxx — load soul data for a user
  if (method === 'GET' && path === '/souls') {
    if (!env.SCORES) return json({ error: 'KV no configurado.' }, 503);
    const name = url.searchParams.get('name') || '';
    if (!name) return json({ error: 'Nombre requerido' }, 400);
    const key = 'souls:' + name.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 20);
    const raw = await env.SCORES.get(key);
    if (!raw) return json({ total: 0, owned: [], passives: {}, skin: 'default' });
    return json(JSON.parse(raw));
  }

  // POST /souls — save soul data for a user
  if (method === 'POST' && path === '/souls') {
    if (!env.SCORES) return json({ error: 'KV no configurado.' }, 503);
    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'JSON invalido' }, 400); }
    const name = String(body.name || '').trim().slice(0, 16);
    if (!name) return json({ error: 'Nombre requerido' }, 400);
    const key = 'souls:' + name.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 20);
    const data = {
      total:    Math.max(0, Math.floor(Number(body.total)  || 0)),
      owned:    Array.isArray(body.owned)   ? body.owned   : [],
      passives: typeof body.passives === 'object' ? body.passives : {},
      skin:     String(body.skin || 'default').slice(0, 32),
      updated:  new Date().toISOString(),
    };
    await env.SCORES.put(key, JSON.stringify(data));
    return json({ ok: true });
  }

  return json({ ok: true, endpoints: ['GET /scores', 'POST /scores', 'GET /souls', 'POST /souls', 'POST /register', 'POST /recover', 'POST /check-name'] });
}

// Simple SHA-256 PIN hash using Web Crypto (available in Workers)
async function hashPin(pin, salt) {
  const data    = new TextEncoder().encode(pin + ':' + salt.toLowerCase());
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('');
}
