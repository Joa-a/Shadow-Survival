// ── auth.js ── Login, Sesión & Ranking Global (Cloudflare Worker) ──────────
'use strict';

const Auth = {

    API_URL: 'https://shadow-survival-ranking.eljefekiller2-0.workers.dev',

    STORAGE_KEY:  'ss_session',
    LOCKED_KEY:   'ss_account_locked',  // once set, this device owns this account forever
    currentUser:  null,
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

        if (this.currentUser) {
            this._showLoggedIn();
            this._hideLoginScreen();
        } else {
            this._showLoginScreen();
        }
    },

    // ── LOGIN UI ───────────────────────────────────────────────
    _showLoginScreen() {
        const el = document.getElementById('login-screen');
        if (el) el.style.display = 'flex';
        setTimeout(() => {
            const i = document.getElementById('login-input');
            if (i) i.focus();
        }, 120);

        const input = document.getElementById('login-input');
        const pin   = document.getElementById('login-pin');
        const btn   = document.getElementById('login-btn');

        // Only allow digits in PIN field
        if (pin) {
            pin.addEventListener('input', () => {
                pin.value = pin.value.replace(/\D/g, '').slice(0, 6);
            });
            pin.addEventListener('keydown', e => { if (e.key === 'Enter') btn && btn.click(); });
        }
        if (input) {
            input.addEventListener('keydown', e => { if (e.key === 'Enter') pin && pin.focus(); });
        }
        if (btn) {
            btn.addEventListener('click', () => {
                this.attemptLogin(input ? input.value : '', pin ? pin.value : '');
            });
        }
    },

    _hideLoginScreen() {
        const el = document.getElementById('login-screen');
        if (el) el.style.display = 'none';
        if (typeof Game !== 'undefined' && Game.init) Game.init();
    },

    _loginError(msg) {
        const el = document.getElementById('login-error');
        if (el) {
            el.textContent = msg;
            el.style.opacity = '1';
        }
        const btn = document.getElementById('login-btn');
        if (btn) { btn.disabled = false; btn.textContent = '⚔️  ENTRAR'; }
    },

    _loginLoading(msg) {
        const btn = document.getElementById('login-btn');
        if (btn) { btn.disabled = true; btn.textContent = msg || '⏳ Verificando…'; }
        const el = document.getElementById('login-error');
        if (el) el.textContent = '';
    },

    // ── ATTEMPT LOGIN / REGISTER ───────────────────────────────
    async attemptLogin(rawName, rawPin) {
        const name = (rawName || '').trim().replace(/[<>"'&]/g, '').slice(0, 16);
        const pin  = (rawPin  || '').replace(/\D/g, '').slice(0, 6);

        if (name.length < 2) { this._loginError('Mínimo 2 caracteres en el nombre'); return; }
        if (!/^[a-zA-Z0-9 _\-áéíóúüñÁÉÍÓÚÜÑ]+$/.test(name)) {
            this._loginError('Solo letras, números y guiones en el nombre'); return;
        }
        if (pin.length !== 6) { this._loginError('PIN debe tener exactamente 6 dígitos'); return; }

        this._loginLoading('⏳ Verificando…');
        const avatar = this._pickAvatar(name);

        // Try server
        if (this._configured) {
            try {
                const res = await fetch(`${this.API_URL}/register`, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ name, pin, avatar }),
                });
                const data = await res.json();

                if (!data.ok) {
                    // Name taken — try to login with PIN
                    const res2 = await fetch(`${this.API_URL}/recover`, {
                        method:  'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body:    JSON.stringify({ name, pin }),
                    });
                    const data2 = await res2.json();
                    if (data2.ok) {
                        this._lockAccount(name, data2.avatar || avatar, pin);
                        this._finishLogin(name, data2.avatar || avatar);
                        return;
                    }
                    this._loginError(data2.error || data.error || 'Nombre tomado o PIN incorrecto');
                    return;
                }

                // New account registered
                this._lockAccount(name, avatar, pin);
                this._finishLogin(name, avatar);
                return;

            } catch(err) {
                console.warn('[Auth] Server unreachable, local fallback:', err.message);
            }
        }

        // Offline fallback — one account per device, PIN stored locally
        const locked = this._getLockedAccount();
        if (locked) {
            if (locked.name.toLowerCase() !== name.toLowerCase()) {
                this._loginError(`Este dispositivo ya tiene la cuenta "${locked.name}"`);
                return;
            }
            if (locked.pin !== pin) {
                this._loginError('PIN incorrecto');
                return;
            }
            this._finishLogin(name, locked.avatar || avatar);
            return;
        }
        // First time offline
        this._lockAccount(name, avatar, pin);
        this._finishLogin(name, avatar);
    },

    _finishLogin(name, avatar) {
        this.currentUser = { name, avatar, joinedAt: Date.now() };
        try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.currentUser)); } catch(e) {}
        this._showLoggedIn();
        this._hideLoginScreen();
    },

    // ── ACCOUNT LOCK (one account per device) ─────────────────
    // Once a name is registered on this device it can never be changed.
    _lockAccount(name, avatar, pin) {
        const data = { name, avatar, pin: pin || '', lockedAt: Date.now() };
        try { localStorage.setItem(this.LOCKED_KEY, JSON.stringify(data)); } catch(e) {}
    },

    _getLockedAccount() {
        try {
            const raw = localStorage.getItem(this.LOCKED_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch(e) { return null; }
    },

    logout() {
        // NOTE: logout does NOT remove the lock — the name stays reserved forever on this device.
        this.currentUser = null;
        this._board = []; this._boardLoaded = false;
        try { localStorage.removeItem(this.STORAGE_KEY); } catch(e) {}
        location.reload();
    },

    _showLoggedIn() {
        const el = document.getElementById('hud-player-name');
        if (el && this.currentUser) {
            el.textContent   = this.currentUser.avatar + ' ' + this.currentUser.name;
            el.style.display = 'block';
        }

        // If device has a locked account, pre-fill input and disable it
        const locked = this._getLockedAccount();
        const input  = document.getElementById('login-input');
        if (locked && input) {
            input.value    = locked.name;
            input.disabled = true;
            input.title    = 'Esta cuenta está vinculada a este dispositivo';
        }
    },

    _pickAvatar(name) {
        const a = ['👤','🧙','⚔️','🏹','🔮','👁️','💀','🌙','⚡','🔥','❄️','🌀','🛡️','🗡️'];
        let h = 0;
        for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
        return a[h % a.length];
    },

    // ── SUBMIT SCORE ───────────────────────────────────────────
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
                if (data.saved === true && typeof data.rank === 'number') return data.rank;
                if (data.saved === false) return null;
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
                board = Array.isArray(data)        ? data
                      : Array.isArray(data.scores) ? data.scores
                      : Array.isArray(data.board)  ? data.board
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

        const myName  = this.currentUser?.name;
        const medals  = ['🥇','🥈','🥉'];
        const myRank  = board.findIndex(e => e.name === myName) + 1;

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
