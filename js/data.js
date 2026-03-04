// ── data.js ── Game data ──
'use strict';

// ═══ CHARACTERS ═══
const CHARACTERS = [
    {
        id:'warrior', name:'Alaric', icon:'\u2694\uFE0F', hp:70, speed:195,
        weapon:'Whip',
        desc:'Tanque con l\u00e1tigo en arco. El l\u00e1tigo sigue la direcci\u00f3n del jugador.',
        stats:{hp:'\u25cf\u25cf\u25cf\u25cf\u25cb',spd:'\u25cf\u25cf\u25cf\u25cb\u25cb',atk:'\u25cf\u25cf\u25cf\u25cb\u25cb'}
    },
    {
        id:'mage', name:'Zale', icon:'\ud83d\udd2e', hp:35, speed:175,
        weapon:'MagicWand',
        desc:'Fr\u00e1gil pero devastador. La varita persigue enemigos.',
        stats:{hp:'\u25cf\u25cf\u25cb\u25cb\u25cb',spd:'\u25cf\u25cf\u25cb\u25cb\u25cb',atk:'\u25cf\u25cf\u25cf\u25cf\u25cf'}
    },
    {
        id:'rogue', name:'Kael', icon:'\ud83d\udde1\uFE0F', hp:45, speed:260,
        weapon:'Knife',
        desc:'Velocísimo. Lanza cuchillos reales como proyectiles.',
        stats:{hp:'\u25cf\u25cf\u25cf\u25cb\u25cb',spd:'\u25cf\u25cf\u25cf\u25cf\u25cf',atk:'\u25cf\u25cf\u25cf\u25cb\u25cb'}
    },
    {
        id:'cleric', name:'Elora', icon:'\u2728', hp:55, speed:185,
        weapon:'HolyStrike',
        desc:'Golpe sagrado de corto alcance. Aura protectora. Cuerpo a cuerpo.',
        stats:{hp:'\u25cf\u25cf\u25cf\u25cf\u25cb',spd:'\u25cf\u25cf\u25cb\u25cb\u25cb',atk:'\u25cf\u25cf\u25cf\u25cb\u25cb'}
    },
    {
        id:'hunter', name:'Ryxa', icon:'\ud83c\udff9', hp:40, speed:210,
        weapon:'CrossBow',
        desc:'Arquera de alcance limitado. Flechas penetrantes con rango definido.',
        stats:{hp:'\u25cf\u25cf\u25cb\u25cb\u25cb',spd:'\u25cf\u25cf\u25cf\u25cb\u25cb',atk:'\u25cf\u25cf\u25cf\u25cf\u25cb'}
    },
    {
        id:'shaman', name:'Vorath', icon:'\ud83c\udf29\uFE0F', hp:50, speed:180,
        weapon:'Lightning',
        desc:'Cadenas el\u00e9ctricas de alcance limitado. Rayo salta entre enemigos cercanos.',
        stats:{hp:'\u25cf\u25cf\u25cf\u25cb\u25cb',spd:'\u25cf\u25cf\u25cb\u25cb\u25cb',atk:'\u25cf\u25cf\u25cf\u25cf\u25cb'}
    },
];

// ═══ UPGRADES ═══
const UPGRADES_DB = {
    'Whip':       { name:'L\u00e1tigo',       icon:'\u3030\uFE0F', desc:'Arco de ataque en direcci\u00f3n del jugador. Aumenta radio al subir.', type:'weapon' },
    'MagicWand':  { name:'Varita',       icon:'\ud83e\ude84', desc:'Proyectil al enemigo m\u00e1s cercano. Multi-objetivo al subir.',    type:'weapon' },
    'Knife':      { name:'Cuchillo',     icon:'\ud83d\udd2a', desc:'Cuchillo real como proyectil. M\u00e1s cuchillos al subir.',       type:'weapon' },
    'Bible':      { name:'Orbe Sagrado', icon:'\ud83d\udcd6', desc:'Orbe orbital con cruz dorada. Hasta 3 orbes al m\u00e1x.',           type:'weapon' },
    'Garlic':     { name:'Aura',         icon:'\ud83e\uddc4', desc:'Da\u00f1o constante cerca del jugador.',                            type:'weapon' },
    'HolyStrike': { name:'Golpe Santo',  icon:'\ud83d\udcab', desc:'Cono de luz divina cuerpo a cuerpo. Solo corto alcance.',          type:'weapon' },
    'Lightning':  { name:'Rayo',         icon:'\u26a1', desc:'Cadena el\u00e9ctrica limitada a 350px. Salta entre enemigos.',            type:'weapon' },
    'CrossBow':   { name:'Ballesta',     icon:'\ud83c\udff9', desc:'Flecha penetrante con rango definido. No viaja al infinito.',       type:'weapon' },
    'Flame':      { name:'Llama',        icon:'\ud83d\udd25', desc:'Zona de fuego persistente con efectos de llama.',                  type:'weapon' },
    'Boots':      { name:'Botas',        icon:'\ud83d\udc9f', desc:'Velocidad de movimiento +15%.',                                    type:'stat'   },
    'Spinach':    { name:'Espinaca',     icon:'\ud83e\udd6c', desc:'Da\u00f1o total +22%.',                                            type:'stat'   },
    'Armor':      { name:'Armadura',     icon:'\ud83d\udee1\uFE0F', desc:'Reduce da\u00f1o recibido en 3.',                             type:'stat'   },
    'Magnet':     { name:'Im\u00e1n',    icon:'\ud83e\uddf2', desc:'Radio de recogida de gemas +35%.',                                type:'stat'   },
    'Regen':      { name:'Regen',        icon:'\ud83d\udc9a', desc:'Regenera 0.4 HP/segundo.',                                         type:'stat'   },
    'Ultra':      { name:'Ultra+',       icon:'\ud83c\udf00', desc:'+1 carga, -15s recarga, +potencia.',                              type:'stat'   },
    'Vampire':    { name:'Vampiro',      icon:'\ud83e\dddb', desc:'Roba 1 HP por cada 5 kills.',                                       type:'stat'   },
};

// ═══════════════════════════════════════════════════════════════
//  ACHIEVEMENTS — persisted in localStorage, awarded ONCE per device forever.
//  Each def has: id, icon, name, desc, condition(game→bool),
//  and optionally: progress(game→[current,max]) for progress bar display.
// ═══════════════════════════════════════════════════════════════
const ACHIEVEMENT_DEFS = [
    // ── Combat milestones ──────────────────────────────────────
    {
        id:'first_blood', icon:'🩸', name:'Primera Sangre',
        desc:'Mata tu primer enemigo',
        condition: g => g.kills >= 1,
        progress:  g => [Math.min(g.kills, 1), 1],
    },
    {
        id:'kills50', icon:'⚔️', name:'Cazador',
        desc:'50 eliminaciones en una partida',
        condition: g => g.kills >= 50,
        progress:  g => [Math.min(g.kills, 50), 50],
    },
    {
        id:'kills100', icon:'💀', name:'Exterminador',
        desc:'100 eliminaciones en una partida',
        condition: g => g.kills >= 100,
        progress:  g => [Math.min(g.kills, 100), 100],
    },
    {
        id:'kills300', icon:'☠️', name:'Ángel de la Muerte',
        desc:'300 eliminaciones en una partida',
        condition: g => g.kills >= 300,
        progress:  g => [Math.min(g.kills, 300), 300],
    },
    // ── Combo ─────────────────────────────────────────────────
    {
        id:'combo10', icon:'🔥', name:'Combo Asesino',
        desc:'Alcanza x10 combo',
        condition: g => g.combo >= 10,
        progress:  g => [Math.min(g.combo, 10), 10],
    },
    {
        id:'combo20', icon:'💥', name:'Imparable',
        desc:'Alcanza x20 combo',
        condition: g => g.combo >= 20,
        progress:  g => [Math.min(g.combo, 20), 20],
    },
    // ── Level / Survival ──────────────────────────────────────
    {
        id:'level5', icon:'⬆️', name:'Superviviente',
        desc:'Llega al nivel 5',
        condition: g => g.player?.level >= 5,
        progress:  g => [Math.min(g.player?.level||0, 5), 5],
    },
    {
        id:'level10', icon:'🌟', name:'Veterano',
        desc:'Llega al nivel 10',
        condition: g => g.player?.level >= 10,
        progress:  g => [Math.min(g.player?.level||0, 10), 10],
    },
    {
        id:'survive3min', icon:'⏱️', name:'Resistente',
        desc:'Sobrevive 3 minutos',
        condition: g => g.time >= 180,
        progress:  g => [Math.min(Math.floor(g.time), 180), 180],
    },
    {
        id:'survive7min', icon:'🌙', name:'Noche Eterna',
        desc:'Sobrevive 7 minutos',
        condition: g => g.time >= 420,
        progress:  g => [Math.min(Math.floor(g.time), 420), 420],
    },
    // ── Boss / Special ────────────────────────────────────────
    {
        id:'bossslayer', icon:'👹', name:'Mata-Jefes',
        desc:'Derrota a un Jefe',
        condition: g => g.bossKills >= 1,
        progress:  g => [Math.min(g.bossKills, 1), 1],
    },
    {
        id:'boss3', icon:'🏆', name:'Cazador de Titanes',
        desc:'Derrota 3 Jefes en una partida',
        condition: g => g.bossKills >= 3,
        progress:  g => [Math.min(g.bossKills, 3), 3],
    },
];

// ═══════════════════════════════════════════════════════════════
//  ACHIEVEMENT STORE — localStorage persistence.
//  Achievements are earned ONCE globally, persist across sessions.
//  Session-new awards are tracked separately to avoid re-popups.
// ═══════════════════════════════════════════════════════════════
const AchievementStore = {
    _key:        'ss_achievements_v1',
    _earned:     null,   // Set of earned IDs (all time)
    _newThisSession: new Set(),   // IDs earned THIS session only

    load() {
        try {
            const raw    = localStorage.getItem(this._key);
            this._earned = raw ? new Set(JSON.parse(raw)) : new Set();
        } catch(e) { this._earned = new Set(); }
        this._newThisSession.clear();
    },

    isEarned(id) {
        return !!(this._earned && this._earned.has(id));
    },

    earn(id) {
        if (!this._earned) this.load();
        if (this._earned.has(id)) return false;   // already earned — no popup
        this._earned.add(id);
        this._newThisSession.add(id);
        try {
            localStorage.setItem(this._key, JSON.stringify([...this._earned]));
        } catch(e) {}
        return true;   // newly earned — show popup
    },

    getAll()       { return this._earned ? [...this._earned] : []; },
    getCount()     { return this._earned ? this._earned.size : 0; },
    getTotalCount(){ return ACHIEVEMENT_DEFS.length; },

    // For game-over summary — which were newly earned this session
    getNewThisSession() { return [...this._newThisSession]; },
    clearSession()      { this._newThisSession.clear(); },
};
AchievementStore.load();

// ═══════════════════════════════════════════════════════════════
//  WEAPON EVOLUTIONS — max-level weapon + passive = evolved weapon
//  Evolved weapons have evolved:true so they don't appear in upgrade pool.
// ═══════════════════════════════════════════════════════════════

// Add evolved entries to UPGRADES_DB
UPGRADES_DB['ThunderStorm'] = {
    name:'Tormenta Eterna',   icon:'🌩',
    desc:'Rayo omnipresente. Golpea toda la pantalla en cadena. Evolución: Rayo + Armadura.',
    type:'weapon', evolved:true
};
UPGRADES_DB['DeathScythe'] = {
    name:'Guadaña Espectral', icon:'🌀',
    desc:'Látigo espectral 360°. Drena vida en cada golpe. Evolución: Látigo + Vampiro.',
    type:'weapon', evolved:true
};
UPGRADES_DB['HolyNova'] = {
    name:'Nova Sagrada',      icon:'✝️',
    desc:'Explosión divina omnidireccional. Empuja y destruye. Evolución: Golpe Santo + Orbe.',
    type:'weapon', evolved:true
};

// Recipe table: weapon at Lv8 + passive → result
const EVOLUTION_TABLE = [
    { weapon:'Lightning',  passive:'Armor',   result:'ThunderStorm' },
    { weapon:'Whip',       passive:'Vampire', result:'DeathScythe'  },
    { weapon:'HolyStrike', passive:'Bible',   result:'HolyNova'     },
];

// ═══ ENEMY TEMPLATES ═══
const ENEMY_TYPES = [
    { type:'swarm',    hp:22,  speed:125, r:9,  color:'#ff44aa', xp:3,  dmg:5  },
    { type:'chase',    hp:32,  speed:105, r:11, color:'#8844ff', xp:5,  dmg:7  },
    { type:'ranged',   hp:40,  speed:80,  r:12, color:'#44aaff', xp:8,  dmg:9  },
    { type:'charger',  hp:55,  speed:95,  r:14, color:'#ffaa00', xp:12, dmg:13 },
    { type:'exploder', hp:65,  speed:55,  r:18, color:'#00ff88', xp:16, dmg:9  },
    { type:'phantom',  hp:45,  speed:90,  r:13, color:'#cc44ff', xp:14, dmg:11 },
];
