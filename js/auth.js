// ── auth.js ── Login, Sesión & Ranking Global (Cloudflare Worker) ─
'use strict';

const Auth = {
    // ════════════════════════════════════════════════════
    //  ⚙️  CONFIGURACIÓN — pega aquí tu URL del Worker
    //  Ej: https://shadow-survivor.tunombre.workers.dev
    //  Instrucciones: README_SERVIDOR.md
    // ════════════════════════════════════════════════════
    API_URL: 'YOUR_WORKER_URL',

    // ─────────────────────────────────────────────────
    STORAGE_KEY:  'ss_session',
    currentUser:  null,
    _board:       [],
    _boardLoaded: false,

    get _configured() {
        return this.API_URL && this.API_URL !== 'YOUR_WORKER_URL';
    },

    _key(name) { return name.replace(/[.#$[\]/]/g, '_').slice(0, 16); },

    // ──────────────── INIT ────────────────────────────
    init() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) this.currentUser = JSON.parse(saved);
        } catch(e) { this.currentUser = null; }

        if (this.currentUser) { this._showLoggedIn(); this._hideLoginScreen(); }
        else                  { this._showLoginScreen(); }
    },

    // ──────────────── LOGIN UI ────────────────────────
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
        name = (name || '').trim().replace(/[<>"']/g, '').slice(0, 16);
        if (!name) { this._loginError('Escribe un nombre de guerrero'); return; }

        const btn = document.getElementById('login-btn');
        if (btn) btn.textContent = '⏳ Entrando…';

        this.currentUser = { name, avatar: this._pickAvatar(name), joinedAt: Date.now() };
        try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.currentUser)); } catch(e) {}

        if (btn) btn.textContent = '⚔️  ENTRAR';
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
            el.textContent  = this.currentUser.avatar + ' ' + this.currentUser.name;
            el.style.display = 'block';
        }
    },

    _pickAvatar(name) {
        const a = ['👤','🧙','⚔️','🏹','🔮','👁️','💀','🌙','⚡','🔥','❄️','🌀','🛡️','🗡️'];
        let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
        return a[h % a.length];
    },

    // ──────────────── SUBMIT SCORE ────────────────────
    async submitScore({ timeSec, kills, level, mode }) {
        if (!this.currentUser) return null;

        const entry = {
            name:   this.currentUser.name,
            avatar: this.currentUser.avatar,
            time:   Math.floor(timeSec),
            kills:  kills  || 0,
            level:  level  || 1,
            mode:   mode   || 'normal',
        };

        // Intentar enviar al servidor propio
        if (this._configured) {
            try {
                const res  = await fetch(`${this.API_URL}/scores`, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify(entry),
                });
                const data = await res.json();
                if (data.rank) return data.rank;
            } catch(err) {
                console.warn('Worker offline, usando local:', err);
            }
        }

        // Fallback local si no hay servidor o hay error de red
        return this._submitLocal(entry);
    },

    _submitLocal(entry) {
        let board = [];
        try { board = JSON.parse(localStorage.getItem('ss_leaderboard') || '[]'); } catch(e) {}
        const idx = board.findIndex(e => e.name === entry.name);
        if (idx !== -1) { if (entry.time > board[idx].time) board[idx] = entry; }
        else board.push(entry);
        board.sort((a, b) => b.time - a.time); board.splice(100);
        try { localStorage.setItem('ss_leaderboard', JSON.stringify(board)); } catch(e) {}
        this._board = board; this._boardLoaded = true;
        return (board.findIndex(e => e.name === entry.name) + 1) || null;
    },

    // ──────────────── RENDER LEADERBOARD ──────────────
    async renderLeaderboard(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '<div class="lb-loading">⏳ Cargando ranking…</div>';

        let board = [];
        let isGlobal = false;

        if (this._configured) {
            try {
                const res = await fetch(`${this.API_URL}/scores`);
                if (res.ok) {
                    board    = await res.json();
                    isGlobal = true;
                    this._board = board; this._boardLoaded = true;
                }
            } catch(err) {
                board = this._boardLoaded
                    ? this._board
                    : (() => { try { return JSON.parse(localStorage.getItem('ss_leaderboard')||'[]'); } catch(e) { return []; } })();
            }
        } else {
            try { board = JSON.parse(localStorage.getItem('ss_leaderboard') || '[]'); } catch(e) {}
            board.sort((a, b) => b.time - a.time);
        }

        if (!board.length) {
            container.innerHTML = `<div class="lb-empty">🌙 Sé el primero en aparecer aquí<br>
                <span style="font-size:9px;color:#2e1840;margin-top:6px;display:block">
                ${this._configured ? '🌐 Servidor activo y esperando' : '⚠️ Configura tu servidor en auth.js para ranking global'}
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
            const m = Math.floor(e.time/60), s = e.time%60;
            const time = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
            const dateStr = e.date ? new Date(e.date).toLocaleDateString('es',{month:'short',day:'numeric'}) : '';
            return `<div class="lb-row ${e.name===myName?'lb-me':''}">
                <span class="lb-medal">${medals[i]||'<span class="lb-rank">#'+(i+1)+'</span>'}</span>
                <span class="lb-avatar">${e.avatar||'👤'}</span>
                <div class="lb-info">
                    <span class="lb-name">${e.name}${e.mode==='frenetic'?'<span class="lb-mode-frenetic">⚡</span>':''}</span>
                    <span class="lb-date">${dateStr}</span>
                </div>
                <div class="lb-stats">
                    <span class="lb-time">${time}</span>
                    <span class="lb-kills">☠${e.kills}</span>
                </div>
            </div>`;
        }).join('');

        container.innerHTML = header + rows;
    },
};
