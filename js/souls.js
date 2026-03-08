// ── souls.js ── Persistent Souls currency & shop ──
'use strict';

const Souls = {
    // ── Data ──────────────────────────────────────────────────────
    _key: 'ss_souls',
    _ownedKey: 'ss_owned',
    _passivesKey: 'ss_passives',

    get total() {
        try { return parseInt(localStorage.getItem(this._key) || '0'); } catch(e) { return 0; }
    },
    set total(v) {
        try { localStorage.setItem(this._key, Math.max(0, Math.floor(v))); } catch(e) {}
    },

    get owned() {
        try { return JSON.parse(localStorage.getItem(this._ownedKey) || '[]'); } catch(e) { return []; }
    },
    set owned(v) {
        try { localStorage.setItem(this._ownedKey, JSON.stringify(v)); } catch(e) {}
    },

    get equippedSkin() {
        try { return localStorage.getItem('ss_skin') || 'default'; } catch(e) { return 'default'; }
    },
    set equippedSkin(v) {
        try { localStorage.setItem('ss_skin', v); } catch(e) {}
    },

    get passives() {
        try { return JSON.parse(localStorage.getItem(this._passivesKey) || '{}'); } catch(e) { return {}; }
    },
    set passives(v) {
        try { localStorage.setItem(this._passivesKey, JSON.stringify(v)); } catch(e) {}
    },

    add(amount) {
        this.total = this.total + amount;
        // Flash the HUD counter
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
        this.total = this.total - item.cost;
        const o = this.owned;
        o.push(itemId);
        this.owned = o;
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

    // Characters (locked by default — check CHARACTERS array)
    { id:'char_ryxa',   type:'character', icon:'🏹', name:'Ryxa',   desc:'Cazadora de élite con flechas venenosas', cost:500 },
    { id:'char_vorath', type:'character', icon:'⚡', name:'Vorath', desc:'Chamán del trueno, maestro del rayo',     cost:500 },
];
