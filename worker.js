// ═══════════════════════════════════════════════════════════════════════
//  SHADOW SURVIVOR — Cloudflare Worker (backend de ranking global)
//
//  DEPLOY EN 3 PASOS:
//  1. Ve a https://dash.cloudflare.com → Workers & Pages → Create Worker
//  2. Pega TODO este archivo en el editor
//  3. Clic en "Deploy" → copia la URL → pégala en auth.js (API_URL)
//
//  REQUIERE: KV namespace llamado "SCORES"
//  → En el dashboard del Worker: Settings → Variables → KV Namespaces
//  → Add binding: Variable name = SCORES, selecciona o crea namespace
//
//  ENDPOINTS:
//    POST /scores   body: { name, avatar, time, kills, level, mode, date }
//                   resp: { ok: true, rank: 3, board: [...top20] }
//
//    GET  /scores   resp: { ok: true, scores: [...top100] }
//
//  CORS: acepta cualquier origen (para abrir el HTML localmente)
// ═══════════════════════════════════════════════════════════════════════

const CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

const KV_KEY   = 'leaderboard';   // único key donde guardamos el array JSON
const MAX_ROWS = 100;             // máximo de entradas guardadas

// ── Entry point ────────────────────────────────────────────────────────
export default {
    async fetch(request, env) {
        // Preflight CORS
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: CORS });
        }

        const url  = new URL(request.url);
        const path = url.pathname.replace(/\/$/, ''); // strip trailing slash

        try {
            if (path === '/scores' || path === '') {
                if (request.method === 'POST') return handlePost(request, env);
                if (request.method === 'GET')  return handleGet(env);
            }
            return json({ ok: false, error: 'Not found' }, 404);
        } catch(err) {
            console.error('Worker error:', err);
            return json({ ok: false, error: 'Internal error' }, 500);
        }
    }
};

// ── POST /scores ────────────────────────────────────────────────────────
async function handlePost(request, env) {
    let entry;
    try {
        entry = await request.json();
    } catch(e) {
        return json({ ok: false, error: 'JSON inválido' }, 400);
    }

    // Validate required fields
    if (!entry.name || typeof entry.time !== 'number') {
        return json({ ok: false, error: 'name y time son obligatorios' }, 400);
    }

    // Sanitize
    entry.name   = String(entry.name).replace(/[<>"'&]/g, '').slice(0, 16);
    entry.avatar = String(entry.avatar || '👤').slice(0, 4);
    entry.time   = Math.max(0, Math.floor(entry.time));
    entry.kills  = Math.max(0, Math.floor(entry.kills  || 0));
    entry.level  = Math.max(1, Math.floor(entry.level  || 1));
    entry.mode   = String(entry.mode || 'normal').slice(0, 20);
    entry.date   = entry.date || new Date().toISOString();

    // Load current board
    let board = await loadBoard(env);

    // Keep only best score per player (by survival time)
    const existing = board.findIndex(e => e.name === entry.name);
    if (existing !== -1) {
        if (entry.time > board[existing].time) {
            board[existing] = entry;   // personal best beaten
        }
        // if not better, still record (so rank is current)
    } else {
        board.push(entry);
    }

    // Sort by time descending, keep top MAX_ROWS
    board.sort((a, b) => b.time - a.time);
    board = board.slice(0, MAX_ROWS);

    // Persist
    await env.SCORES.put(KV_KEY, JSON.stringify(board));

    // Find rank (1-indexed)
    const rank = board.findIndex(e => e.name === entry.name) + 1;

    return json({
        ok:    true,
        rank:  rank || null,
        total: board.length,
        board: board.slice(0, 20),   // return top 20 so client can cache
    });
}

// ── GET /scores ─────────────────────────────────────────────────────────
async function handleGet(env) {
    const board = await loadBoard(env);
    return json({ ok: true, scores: board, total: board.length });
}

// ── Helpers ─────────────────────────────────────────────────────────────
async function loadBoard(env) {
    try {
        const raw = await env.SCORES.get(KV_KEY);
        if (!raw) return [];
        const board = JSON.parse(raw);
        return Array.isArray(board) ? board : [];
    } catch(e) {
        return [];
    }
}

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}
