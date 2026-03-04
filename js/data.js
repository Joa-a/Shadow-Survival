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

// ═══ ACHIEVEMENTS — persisted in localStorage, earned only ONCE per device ═══
const ACHIEVEMENT_DEFS = [
    { id:'first_blood',  name:'Primera Sangre',  desc:'Mata tu primer enemigo',   condition: g => g.kills >= 1       },
    { id:'combo10',      name:'Combo Asesino',   desc:'Alcanza x10 combo',        condition: g => g.combo >= 10      },
    { id:'level5',       name:'Superviviente',   desc:'Llega al nivel 5',         condition: g => g.player?.level>=5 },
    { id:'kills50',      name:'Cazador',         desc:'50 eliminaciones',         condition: g => g.kills >= 50      },
    { id:'kills100',     name:'Exterminador',    desc:'100 eliminaciones',        condition: g => g.kills >= 100     },
    { id:'survive3min',  name:'Resistente',      desc:'Sobrevive 3 minutos',      condition: g => g.time >= 180      },
    { id:'bossslayer',   name:'Mata-Jefes',      desc:'Derrota a un Jefe',        condition: g => g.bossKills >= 1   },
];

// Persistent achievement storage
const AchievementStore = {
    _key: 'ss_achievements_v1',
    _earned: null,
    load() {
        try {
            const raw = localStorage.getItem(this._key);
            this._earned = raw ? new Set(JSON.parse(raw)) : new Set();
        } catch(e) { this._earned = new Set(); }
    },
    isEarned(id) { return this._earned && this._earned.has(id); },
    earn(id) {
        if (!this._earned) this.load();
        this._earned.add(id);
        try { localStorage.setItem(this._key, JSON.stringify([...this._earned])); } catch(e) {}
    },
    getAll() { return this._earned ? [...this._earned] : []; }
};
AchievementStore.load();

// ═══ ENEMY TEMPLATES ═══
const ENEMY_TYPES = [
    { type:'swarm',    hp:22,  speed:125, r:9,  color:'#ff44aa', xp:3,  dmg:5  },
    { type:'chase',    hp:32,  speed:105, r:11, color:'#8844ff', xp:5,  dmg:7  },
    { type:'ranged',   hp:40,  speed:80,  r:12, color:'#44aaff', xp:8,  dmg:9  },
    { type:'charger',  hp:55,  speed:95,  r:14, color:'#ffaa00', xp:12, dmg:13 },
    { type:'exploder', hp:65,  speed:55,  r:18, color:'#00ff88', xp:16, dmg:9  },
    { type:'phantom',  hp:45,  speed:90,  r:13, color:'#cc44ff', xp:14, dmg:11 },
];
