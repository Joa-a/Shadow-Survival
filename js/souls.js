// ── souls.js ── Persistent Souls currency & shop ──
'use strict';

const Souls = {
    // ── Anti-duplication sync architecture ──────────────────────
    // _confirmed = last value ACKed by server (or loaded from it)
    // _pending   = earned since last successful server sync
    // total shown = _confirmed + _pending
    // On successful save: _confirmed = total, _pending = 0
    // On load: _confirmed = serverValue, _pending stays separate
    // This means reconnecting NEVER double-counts.
    _confirmed: { total: 0, owned: [], passives: {}, skin: 'default' },
    _pending:   0,          // souls earned but not yet ACKed by server
    _syncTimer: null,
    _saving:    false,      // prevent concurrent saves

    // ── Getters ───────────────────────────────────────────────────
    get total()        { return this._confirmed.total + this._pending; },
    get owned()        { return this._confirmed.owned; },
    get passives()     { return this._confirmed.passives; },
    get equippedSkin() { return this._confirmed.skin; },

    // Setters for non-total fields (owned, passives, skin)
    set owned(v)        { this._confirmed.owned    = v; this._scheduleSave(); },
    set passives(v)     { this._confirmed.passives = v; this._scheduleSave(); },
    set equippedSkin(v) { this._confirmed.skin     = v; this._scheduleSave(); },

    _apiUrl()  { return (typeof Auth !== 'undefined' && Auth.API_URL)     ? Auth.API_URL         : null; },
    _userName(){ return (typeof Auth !== 'undefined' && Auth.currentUser) ? Auth.currentUser.name : null; },

    // ── Load ──────────────────────────────────────────────────────
    async load() {
        // Restore any pending delta from localStorage first
        try {
            const p = parseInt(localStorage.getItem('ss_souls_pending') || '0');
            this._pending = Math.max(0, p);
        } catch(e) {}

        const name = this._userName();
        const api  = this._apiUrl();
        if (name && api) {
            try {
                const res = await fetch(`${api}/souls?name=${encodeURIComponent(name)}`);
                if (res.ok) {
                    const d = await res.json();
                    // Server value is ground truth for confirmed — pending stays separate
                    this._confirmed = {
                        total:    d.total    || 0,
                        owned:    d.owned    || [],
                        passives: d.passives || {},
                        skin:     d.skin     || 'default',
                    };
                    // If we have pending, schedule a save to push it to server
                    if (this._pending > 0) this._scheduleSave();
                    return;
                }
            } catch(e) { console.warn('[Souls] Server load failed, using local', e); }
        }

        // Offline fallback — restore confirmed from localStorage
        try {
            const saved = localStorage.getItem('ss_souls_confirmed');
            if (saved) this._confirmed = JSON.parse(saved);
        } catch(e) {}
    },

    // ── Save ──────────────────────────────────────────────────────
    _persistLocal() {
        // Always persist both parts to localStorage so nothing is lost
        try {
            localStorage.setItem('ss_souls_confirmed', JSON.stringify(this._confirmed));
            localStorage.setItem('ss_souls_pending',   String(this._pending));
        } catch(e) {}
    },

    _scheduleSave() {
        this._persistLocal();
        if (this._syncTimer) clearTimeout(this._syncTimer);
        this._syncTimer = setTimeout(() => this._saveToServer(), 3000);
    },

    async _saveToServer() {
        if (this._saving) return; // prevent concurrent saves
        const name = this._userName();
        const api  = this._apiUrl();
        if (!name || !api) return;
        this._saving = true;
        try {
            // Snapshot total at save time — this is what we tell the server
            const totalToSave = this._confirmed.total + this._pending;
            const payload = {
                name,
                total:    totalToSave,
                owned:    this._confirmed.owned,
                passives: this._confirmed.passives,
                skin:     this._confirmed.skin,
            };
            const res = await fetch(`${api}/souls`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(payload),
            });
            if (res.ok) {
                // Server ACKed — move pending into confirmed, clear pending
                this._confirmed.total = totalToSave;
                this._pending = 0;
                this._persistLocal();
            }
        } catch(e) {
            console.warn('[Souls] Server save failed, will retry', e);
            // pending stays intact — will retry on next scheduleSave
        } finally {
            this._saving = false;
        }
    },

    async flush() {
        if (this._syncTimer) clearTimeout(this._syncTimer);
        await this._saveToServer();
    },

    // ── Add souls (only increments pending) ───────────────────────
    add(amount) {
        this._pending += Math.max(0, Math.floor(amount));
        this._scheduleSave();
        const el = document.getElementById('souls-hud');
        if (el) {
            el.textContent = '👻 ' + this.total;
            el.classList.remove('souls-flash');
            void el.offsetWidth;
            el.classList.add('souls-flash');
        }
    },

    buy(itemId) {
        const item = SHOP_ITEMS.find(i => i.id === itemId);
        if (!item) return false;
        if (this.owned.includes(itemId)) return false;
        if (this.total < item.cost) return false;
        // Deduct from pending first, then from confirmed
        const cost = item.cost;
        if (this._pending >= cost) {
            this._pending -= cost;
        } else {
            const remainder = cost - this._pending;
            this._pending = 0;
            this._confirmed.total = Math.max(0, this._confirmed.total - remainder);
        }
        const o = this.owned;
        o.push(itemId);
        this._confirmed.owned = o;
        this._scheduleSave();
        return true;
    },

    has(itemId) { return this.owned.includes(itemId); },

    equipSkin(skinId) {
        if (skinId === 'default' || this.has(skinId)) {
            this.equippedSkin = skinId;
            return true;
        }
        return false;
    },

    togglePassive(passiveId) {
        const p = this.passives;
        p[passiveId] = !p[passiveId];
        this.passives = p;
    },

    isPassiveActive(passiveId) {
        return !!this.passives[passiveId];
    },

    // ── Shop render ───────────────────────────────────────────────
    renderShop() {
        const container = document.getElementById('souls-shop-content');
        if (!container) return;
        const total = this.total;
        const owned = this.owned;
        const equipped = this.equippedSkin;

        // Group items
        const skins    = SHOP_ITEMS.filter(i => i.type === 'skin');
        const passives = SHOP_ITEMS.filter(i => i.type === 'passive');
        const chars    = SHOP_ITEMS.filter(i => i.type === 'character');

        let html = `<div class="shop-souls-total">👻 ${total} almas disponibles</div>`;

        // Skins
        html += `<div class="shop-section-title">✨ SKINS</div><div class="shop-grid">`;
        skins.forEach(item => {
            const isOwned    = owned.includes(item.id);
            const isEquipped = equipped === item.id;
            const canAfford  = total >= item.cost;
            html += `<div class="shop-item ${isOwned?'shop-owned':''} ${isEquipped?'shop-equipped':''} ${!isOwned&&!canAfford?'shop-cant-afford':''}">
                <div class="shop-item-icon" style="background:${item.color};box-shadow:0 0 12px ${item.color}44"></div>
                <div class="shop-item-name">${item.name}</div>
                <div class="shop-item-desc">${item.desc}</div>
                ${isEquipped
                    ? `<button class="shop-btn shop-btn-equipped" disabled>✓ EQUIPADA</button>`
                    : isOwned
                    ? `<button class="shop-btn shop-btn-equip" onclick="Souls.equipSkin('${item.id}');Souls.renderShop()">EQUIPAR</button>`
                    : `<button class="shop-btn ${canAfford?'shop-btn-buy':'shop-btn-locked'}" onclick="Souls._tryBuy('${item.id}')" ${!canAfford?'disabled':''}>
                        ${canAfford?'👻 '+item.cost:'🔒 '+item.cost}</button>`
                }
            </div>`;
        });
        html += `</div>`;

        // Passives
        html += `<div class="shop-section-title">⚡ MEJORAS PASIVAS</div><div class="shop-grid">`;
        passives.forEach(item => {
            const isOwned   = owned.includes(item.id);
            const isActive  = this.isPassiveActive(item.id);
            const canAfford = total >= item.cost;
            html += `<div class="shop-item ${isOwned?'shop-owned':''} ${!isOwned&&!canAfford?'shop-cant-afford':''}">
                <div class="shop-item-icon shop-item-icon-text">${item.icon}</div>
                <div class="shop-item-name">${item.name}</div>
                <div class="shop-item-desc">${item.desc}</div>
                ${isOwned
                    ? `<button class="shop-btn ${isActive?'shop-btn-equipped':'shop-btn-equip'}" onclick="Souls.togglePassive('${item.id}');Souls.renderShop()">
                        ${isActive?'✓ ACTIVA':'ACTIVAR'}</button>`
                    : `<button class="shop-btn ${canAfford?'shop-btn-buy':'shop-btn-locked'}" onclick="Souls._tryBuy('${item.id}')" ${!canAfford?'disabled':''}>
                        ${canAfford?'👻 '+item.cost:'🔒 '+item.cost}</button>`
                }
            </div>`;
        });
        html += `</div>`;

        // Characters
        html += `<div class="shop-section-title">⚔ PERSONAJES</div><div class="shop-grid">`;
        chars.forEach(item => {
            const isOwned   = owned.includes(item.id);
            const canAfford = total >= item.cost;
            html += `<div class="shop-item ${isOwned?'shop-owned':''} ${!isOwned&&!canAfford?'shop-cant-afford':''}">
                <div class="shop-item-icon shop-item-icon-text">${item.icon}</div>
                <div class="shop-item-name">${item.name}</div>
                <div class="shop-item-desc">${item.desc}</div>
                ${isOwned
                    ? `<div class="shop-btn shop-btn-equipped">✓ DESBLOQUEADO</div>`
                    : `<button class="shop-btn ${canAfford?'shop-btn-buy':'shop-btn-locked'}" onclick="Souls._tryBuy('${item.id}')" ${!canAfford?'disabled':''}>
                        ${canAfford?'👻 '+item.cost:'🔒 '+item.cost}</button>`
                }
            </div>`;
        });
        html += `</div>`;

        container.innerHTML = html;
    },

    _tryBuy(itemId) {
        const ok = this.buy(itemId);
        if (ok) {
            const item = SHOP_ITEMS.find(i => i.id === itemId);
            if (item?.type === 'skin') this.equipSkin(itemId);
            if (item?.type === 'passive') {
                const p = this.passives;
                p[itemId] = true;
                this.passives = p;
            }
            this.renderShop();
        }
    },

    // ── Apply passives to player at game start ────────────────────
    applyPassives(player) {
        const p = this.passives;
        if (p['passive_hp'])      player.maxHp = Math.floor(player.maxHp * 1.12);
        if (p['passive_xp'])      player._xpBonus = 1;        // +1 xp per gem
        if (p['passive_speed'])   player.speed   *= 1.08;
        if (p['passive_cooldown']) player._cdBonus = 0.92;    // 8% less cooldown
    },

    // ── Apply skin color to player ────────────────────────────────
    getSkinColor() {
        const skin = SHOP_ITEMS.find(i => i.id === this.equippedSkin);
        return skin?.color || '#ddeeff';
    },
};

// ── Shop catalog ──────────────────────────────────────────────────
const SHOP_ITEMS = [
    // Skins
    { id:'skin_crimson',  type:'skin', name:'Llama Carmesí',  desc:'Aura roja sangre',          cost:150, color:'#ff3344' },
    { id:'skin_emerald',  type:'skin', name:'Espíritu Esmeralda', desc:'Verde veneno brillante', cost:150, color:'#22ff88' },
    { id:'skin_gold',     type:'skin', name:'Núcleo Dorado',   desc:'Brillo áureo oscuro',       cost:300, color:'#ffcc22' },
    { id:'skin_void',     type:'skin', name:'Vacío Violeta',   desc:'Oscuridad pura',            cost:300, color:'#aa44ff' },
    { id:'skin_ice',      type:'skin', name:'Tormenta Glacial',desc:'Azul hielo pulsante',       cost:500, color:'#44ddff' },
    { id:'skin_shadow',   type:'skin', name:'Sombra Eterna',   desc:'Gris ceniza espectral',     cost:800, color:'#888899' },

    // Passives
    { id:'passive_hp',       type:'passive', icon:'❤️', name:'+12% Vida máx',   desc:'Empiezas cada partida con más vida',             cost:120 },
    { id:'passive_xp',       type:'passive', icon:'✨', name:'+1 XP por gema',  desc:'Cada gema recogida da 1 XP extra',               cost:120 },
    { id:'passive_speed',    type:'passive', icon:'👟', name:'+8% Velocidad',   desc:'Te mueves un poco más rápido desde el inicio',   cost:200 },
    { id:'passive_cooldown', type:'passive', icon:'⚡', name:'-8% Cooldown',    desc:'Tus armas disparan un poco más seguido',         cost:300 },

    // Characters — all locked except Alaric
    { id:'char_zale',   type:'character', icon:'🔮', name:'Zale',   desc:'Mago de daño máximo, proyectiles mágicos', cost:250 },
    { id:'char_kael',   type:'character', icon:'🗡️', name:'Kael',   desc:'El más rápido, maestro del cuchillo',      cost:250 },
    { id:'char_elora',  type:'character', icon:'✨', name:'Elora',  desc:'Clérigo resistente, golpe de luz divina',  cost:250 },
    { id:'char_ryxa',   type:'character', icon:'🏹', name:'Ryxa',   desc:'Cazadora con flechas venenosas',           cost:250 },
    { id:'char_vorath', type:'character', icon:'⚡', name:'Vorath', desc:'Chamán del trueno, maestro del rayo',      cost:250 },
];
