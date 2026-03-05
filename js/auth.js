// ── auth.js ── Login, Sesión & Ranking Global (Cloudflare Worker) ──────────
// ⚙️  ÚNICA LÍNEA QUE TIENES QUE CAMBIAR:
//     Pega aquí la URL de tu Worker después de hacer el deploy.
//     Ejemplo: 'https://shadow-survivor.tunombre.workers.dev'
// ─────────────────────────────────────────────────────────────────────────
'use strict';

const Auth = {

    API_URL: 'https://shadow-survival-ranking.eljefekiller2-0.workers.dev',

    STORAGE_KEY: 'ss_session',
    currentUser: null,
    _board:       [],
    _boardLoaded: false,

    get _configured() {
        return typeof this.API_URL === 'string'
            && this.API_URL.startsWith('http')
            && !this.API_URL.includes('YOUR_WORKER_URL');
    },

    // ── INIT ───────────────────────────────────────────────────
    init() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) this.currentUser = JSON.parse(saved);
        } catch(e) { this.currentUser = null; }

        if (this.currentUser) { this._showLoggedIn(); this._hideLoginScreen(); }
        else                  { this._showLoginScreen(); }
    },

    // ── LOGIN UI ───────────────────────────────────────────────
    _showLoginScreen() {
        const el = document.getElementById('login-screen');
        if (el) el.style.display = 'flex';
        setTimeout(() => { const i = document.getElementById('login-input'); if(i) i.focus(); }, 120);
    },

    _hideLoginScreen() {
        const el = document.getElementById('login-screen');
        if (el) el.style.display = 'none';
        if (typeof Game !== 'undefined' && Game.init) Game.init();
    },

    _loginError(msg) {
        const el = document.getElementById('login-error');
        if (el) { el.textContent = msg; el.style.opacity = '1'; }
    },

    login(name) {
        name = (name || '').trim().replace(/[<>"'&]/g, '').slice(0, 16);
        if (name.length < 2) { this._loginError('Mínimo 2 caracteres'); return; }
        this.currentUser = { name, avatar: this._pickAvatar(name), joinedAt: Date.now() };
        try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.currentUser)); } catch(e) {}
        this._showLoggedIn();
        this._hideLoginScreen();
    },

    logout() {
        this.currentUser = null; this._board = []; this._boardLoaded = false;
        try { localStorage.removeItem(this.STORAGE_KEY); } catch(e) {}
        location.reload();
    },

    _showLoggedIn() {
        const el = document.getElementById('hud-player-name');
        if (el && this.currentUser) {
            el.textContent   = this.currentUser.avatar + ' ' + this.currentUser.name;
            el.style.display = 'block';
        }
    },

    _pickAvatar(name) {
        const a = ['👤','🧙','⚔️','🏹','🔮','👁️','💀','🌙','⚡','🔥','❄️','🌀','🛡️','🗡️'];
        let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
        return a[h % a.length];
    },

    // ── SUBMIT SCORE ───────────────────────────────────────────
    // DEBE usarse con await: const rank = await Auth.submitScore({...})
    async submitScore({ timeSec, kills, level, mode }) {
        if (!this.currentUser) return null;

        const entry = {
            name:   this.currentUser.name,
            avatar: this.currentUser.avatar,
            time:   Math.floor(timeSec),
            kills:  kills  || 0,
            level:  level  || 1,
            mode:   mode   || 'normal',
            date:   new Date().toISOString(),
        };

        if (this._configured) {
            try {
                const res = await fetch(`${this.API_URL}/scores`, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify(entry),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                // Worker devuelve: { ok: true, rank: 3, board: [...] }
                // Worker devuelve: { saved: true, rank: 3, total: 42 }
                // O si no es personal best: { saved: false, best: X, sent: Y }
                if (data.saved === true && typeof data.rank === 'number') {
                    return data.rank;
                }
                if (data.saved === false) {
                    // No batió su récord — buscar su rank actual en el board local
                    // (el Worker no devuelve rank en este caso)
                    console.info('[Auth] Score no superó personal best, rank no actualizado');
                    return null;
                }
                throw new Error('Respuesta inesperada: ' + JSON.stringify(data).slice(0, 80));
            } catch(err) {
                console.warn('[Auth] Worker error, usando local:', err.message);
            }
        }

        return this._submitLocal(entry);
    },

    _submitLocal(entry) {
        let board = [];
        try { board = JSON.parse(localStorage.getItem('ss_leaderboard') || '[]'); } catch(e) {}
        const idx = board.findIndex(e => e.name === entry.name);
        if (idx !== -1) { if (entry.time > board[idx].time) board[idx] = entry; }
        else board.push(entry);
        board.sort((a, b) => b.time - a.time);
        board.splice(100);
        try { localStorage.setItem('ss_leaderboard', JSON.stringify(board)); } catch(e) {}
        this._board = board; this._boardLoaded = true;
        return (board.findIndex(e => e.name === entry.name) + 1) || null;
    },

    // ── RENDER LEADERBOARD ─────────────────────────────────────
    async renderLeaderboard(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '<div class="lb-loading">⏳ Cargando ranking…</div>';

        let board = [], isGlobal = false;

        if (this._configured) {
            try {
                const res = await fetch(`${this.API_URL}/scores`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                // Acepta: { ok:true, scores:[...] }  O  array directo [...]
                board = Array.isArray(data)         ? data
                      : Array.isArray(data.scores)  ? data.scores
                      : Array.isArray(data.board)   ? data.board
                      : [];
                isGlobal = true;
                this._board = board; this._boardLoaded = true;
            } catch(err) {
                console.warn('[Auth] No se pudo cargar ranking global:', err.message);
                board = this._boardLoaded
                    ? this._board
                    : (() => { try { return JSON.parse(localStorage.getItem('ss_leaderboard')||'[]'); } catch(e) { return []; } })();
            }
        } else {
            try { board = JSON.parse(localStorage.getItem('ss_leaderboard') || '[]'); } catch(e) {}
            board.sort((a, b) => b.time - a.time);
        }

        this._renderBoard(container, board, isGlobal);
    },

    _renderBoard(container, board, isGlobal) {
        if (!board.length) {
            container.innerHTML = `<div class="lb-empty">🌙 Sé el primero en aparecer aquí<br>
                <span style="font-size:9px;color:#2e1840;margin-top:6px;display:block">
                ${this._configured ? '🌐 Servidor activo y esperando' : '⚠️ Configura tu Worker en auth.js para ranking global'}
                </span></div>`;
            return;
        }

        const myName = this.currentUser?.name;
        const medals = ['🥇','🥈','🥉'];
        const myRank = board.findIndex(e => e.name === myName) + 1;

        const header = `<div class="lb-total">
            ${board.length} guerrero${board.length!==1?'s':''} ·
            Tu posición: <strong>${myRank ? '#'+myRank : '—'}</strong>
            <span class="lb-${isGlobal?'global':'local'}-tag">${isGlobal?'🌐 global':'📱 local'}</span>
        </div>`;

        const rows = board.slice(0, 20).map((e, i) => {
            const mm = Math.floor(e.time/60), ss = e.time%60;
            const t  = `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
            const dt = e.date ? new Date(e.date).toLocaleDateString('es',{month:'short',day:'numeric'}) : '';
            const pos = medals[i] || `<span class="lb-rank">#${i+1}</span>`;
            return `<div class="lb-row ${e.name===myName?'lb-me':''}">
                <span class="lb-medal">${pos}</span>
                <span class="lb-avatar">${e.avatar||'👤'}</span>
                <div class="lb-info">
                    <span class="lb-name">${e.name}</span>
                    <span class="lb-date">${dt}</span>
                </div>
                <div class="lb-stats">
                    <span class="lb-time">${t}</span>
                    <span class="lb-kills">☠${e.kills}</span>
                </div>
            </div>`;
        }).join('');

        container.innerHTML = header + rows;
    },
};
