// ── data.js ── Game data ──
'use strict';

// ═══ CHARACTERS ═══
const CHARACTERS = [
    {
        id:'warrior', name:'Alaric', icon:'\u2694\uFE0F', hp:70, speed:195,
        weapon:'Whip',
        desc:'HP alto, velocidad media. Látigo que barre en arco siguiendo el movimiento. Ultra: 5 latigazos simultáneos en todas las direcciones con daño masivo y gran retroceso.',
        stats:{hp:'\u25cf\u25cf\u25cf\u25cf\u25cb',spd:'\u25cf\u25cf\u25cf\u25cb\u25cb',atk:'\u25cf\u25cf\u25cf\u25cb\u25cb'}
    },
    {
        id:'mage', name:'Zale', icon:'\ud83d\udd2e', hp:35, speed:175,
        weapon:'MagicWand',
        desc:'Poco HP pero daño máximo. Dispara proyectiles mágicos a los enemigos más cercanos. Al subir de nivel apunta a más objetivos a la vez. Ultra: ráfaga de hasta 20 proyectiles + doble cadencia durante 3 segundos.',
        stats:{hp:'\u25cf\u25cf\u25cb\u25cb\u25cb',spd:'\u25cf\u25cf\u25cb\u25cb\u25cb',atk:'\u25cf\u25cf\u25cf\u25cf\u25cf'}
    },
    {
        id:'rogue', name:'Kael', icon:'\ud83d\udde1\uFE0F', hp:45, speed:260,
        weapon:'Knife',
        desc:'El personaje más rápido del juego. Lanza cuchillos reales hacia el enemigo más cercano; más cuchillos en abanico al subir de nivel. Ultra: +10% velocidad, +10% cadencia y -10% daño recibido durante varios segundos.',
        stats:{hp:'\u25cf\u25cf\u25cf\u25cb\u25cb',spd:'\u25cf\u25cf\u25cf\u25cf\u25cf',atk:'\u25cf\u25cf\u25cf\u25cb\u25cb'}
    },
    {
        id:'cleric', name:'Elora', icon:'\u2728', hp:55, speed:185,
        weapon:'HolyStrike',
        desc:'Buena resistencia, combate cuerpo a cuerpo. Golpe en cono de luz divina de corto alcance. Al subir de nivel aumenta el rango y el ángulo del cono. Ultra: 8 conos sagrados en 360° más 8 lanzas divinas en todas las direcciones.',
        stats:{hp:'\u25cf\u25cf\u25cf\u25cf\u25cb',spd:'\u25cf\u25cf\u25cb\u25cb\u25cb',atk:'\u25cf\u25cf\u25cf\u25cb\u25cb'}
    },
    {
        id:'hunter', name:'Ryxa', icon:'\ud83c\udff9', hp:40, speed:210,
        weapon:'CrossBow',
        desc:'Equilibrada en todo. Dispara flechas penetrantes con rango definido hacia el enemigo más cercano. Al subir de nivel aumenta el rango. Ultra: 10 flechas envenenadas que aplican veneno de 3 segundos a los impactados.',
        stats:{hp:'\u25cf\u25cf\u25cb\u25cb\u25cb',spd:'\u25cf\u25cf\u25cf\u25cb\u25cb',atk:'\u25cf\u25cf\u25cf\u25cf\u25cb'}
    },
    {
        id:'shaman', name:'Vorath', icon:'\ud83c\udf29\uFE0F', hp:50, speed:180,
        weapon:'Lightning',
        desc:'Especialista en alcance limitado. Cadena de rayos que salta entre enemigos cercanos; más cadenas al subir de nivel. Ultra: hasta 9 rayos caen sobre los enemigos, aturdiendo a cada uno impactado durante 1.8 segundos.',
        stats:{hp:'\u25cf\u25cf\u25cf\u25cb\u25cb',spd:'\u25cf\u25cf\u25cb\u25cb\u25cb',atk:'\u25cf\u25cf\u25cf\u25cf\u25cb'}
    },
];

// ═══ UPGRADES ═══
const UPGRADES_DB = {
    'Whip':       { name:'L\u00e1tigo',       icon:'\u3030\uFE0F', desc:'Barre en arco (~130°) hacia donde se mueve el jugador. Cada nivel añade alcance y amplía el arco hasta ~207°.', type:'weapon', bonus:["+radio de ataque", "+daño"] },
    'MagicWand':  { name:'Varita',       icon:'\ud83e\ude84', desc:'Proyectil mágico al enemigo más cercano cada ~1s. Al subir de nivel dispara a más enemigos simultáneamente (Lv1→1 objetivo, Lv5→5 objetivos).',    type:'weapon', bonus:["+objetivos simultáneos", "+daño"] },
    'Knife':      { name:'Cuchillo',     icon:'\ud83d\udd2a', desc:'Lanza cuchillos hacia el enemigo m\u00e1s cercano cada 0.5s. Al subir de nivel lanza m\u00e1s cuchillos en abanico al mismo tiempo.',       type:'weapon', bonus:["+cuchillos lanzados", "+velocidad proyectil"] },
    'Bible':      { name:'Orbe Sagrado', icon:'\ud83d\udcd6', desc:'Orbes que orbitan alrededor del jugador dañando al contacto. Nivel 1: 1 orbe → hasta 5 orbes a nivel máximo. El radio y la velocidad aumentan con cada nivel.',           type:'weapon', bonus:["+orbes orbitales", "+daño"] },
    'Garlic':     { name:'Aura',         icon:'\ud83e\uddc4', desc:'Aura invisible que daña continuamente a todos los enemigos en rango. Rango inicial 65px, aumenta +12px por nivel.',                            type:'weapon', bonus:["+radio del aura", "+daño/segundo"] },
    'HolyStrike': { name:'Golpe Santo',  icon:'\ud83d\udcab', desc:'Cono de luz divina de corto alcance (~125px) con ~130° de arco. Cada nivel añade rango y amplía el cono. Alta probabilidad de crítico (28%).',          type:'weapon', bonus:["+daño del cono", "+ángulo de ataque"] },
    'Lightning':  { name:'Rayo',         icon:'\u26a1', desc:'Rayo que alcanza hasta 350px. Salta al siguiente enemigo cercano: Lv1→1 cadena, +1 cadena cada 2 niveles. El daño se reduce un 20% por salto.',            type:'weapon', bonus:["+cadenas de rayo", "+daño"] },
    'CrossBow':   { name:'Ballesta',     icon:'\ud83c\udff9', desc:'Flecha rápida (820px/s) con rango de 480px. Apunta al enemigo más cercano dentro del rango. Perfora hasta 3 enemigos. El rango aumenta +35px por nivel.',       type:'weapon', bonus:["+penetración", "+daño"] },
    'Flame':      { name:'Llama',        icon:'\ud83d\udd25', desc:'Deja una zona de fuego en el suelo que dura ~2.5s y daña a todo lo que toque. Radio y duración aumentan con cada nivel.',                  type:'weapon', bonus:["+área de fuego", "+daño/segundo"] },
    'Boots':      { name:'Botas',        icon:'\ud83d\udc9f', desc:'Cada mejora aumenta la velocidad de movimiento un 15%. Acumulable.',                                    type:'stat', bonus:["⚡ Velocidad +15%"] },
    'Spinach':    { name:'Espinaca',     icon:'\ud83e\udd6c', desc:'Cada mejora añade +22% al multiplicador de daño global. Afecta a todas las armas. Acumulable.',                                            type:'stat', bonus:["\u2694\uFE0F Daño total +22%"] },
    'Armor':      { name:'Armadura',     icon:'\ud83d\udee1\uFE0F', desc:'Reduce todo el daño recibido en 3 puntos fijos. Acumulable. Necesario para evolucionar el Rayo.',                             type:'stat', bonus:["\uD83D\uDEE1\uFE0F Reducción de daño +3"] },
    'Magnet':     { name:'Im\u00e1n',    icon:'\ud83e\uddf2', desc:'Aumenta el radio en el que las gemas se acercan automáticamente al jugador en un 35%. Acumulable.',                                type:'stat', bonus:["🧲 Radio recogida +35%"] },
    'Regen':      { name:'Regen',        icon:'\ud83d\udc9a', desc:'Regenera 0.4 HP cada segundo de forma pasiva. Acumulable.',                                         type:'stat', bonus:["❤️ Regeneración +0.4 HP/s"] },
    'Ultra':      { name:'Ultra+',       icon:'\ud83c\udf00', desc:'Añade +1 carga de Ultra disponible y reduce el tiempo de recarga en 15 segundos. También aumenta la potencia del Ultra.',                              type:'stat', bonus:["⚡ +1 carga Ultra", "⏱ -15s recarga"] },
    'Vampire':    { name:'Vampiro',      icon:'\ud83e\dddb', desc:'Recupera 1 HP por cada 5 enemigos eliminados. Acumulable. Necesario para evolucionar el Látigo.',                                       type:'stat', bonus:["🩸 +1 HP cada 5 kills"] },
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
    desc:'Fusión de Rayo + Armadura. Tres orbes eléctricos orbitan al jugador. Cada orbe lanza cadenas masivas a hasta 15 enemigos cercanos cada 0.75s.',
    type:'weapon', evolved:true
};
UPGRADES_DB['DeathScythe'] = {
    name:'Guadaña Espectral', icon:'🌀',
    desc:'Fusión de Látigo + Vampiro. Barrido espectral de 360° que roba vida con cada golpe. Aura pasiva que absorbe HP de los enemigos cercanos constantemente.',
    type:'weapon', evolved:true
};
UPGRADES_DB['HolyNova'] = {
    name:'Nova Sagrada',      icon:'✝️',
    desc:'Fusión de Golpe Santo + Orbe Sagrado. Explosión divina de gran área + 6 rayos en forma de cruz. Deja una zona consagrada en el suelo que quema a todo enemigo que entre.',
    type:'weapon', evolved:true
};

// Recipe table: weapon at Lv8 + passive → result
const EVOLUTION_TABLE = [
    { weapon:'Lightning',  passive:'Armor',   result:'ThunderStorm' },
    { weapon:'Whip',       passive:'Vampire', result:'DeathScythe'  },
    { weapon:'HolyStrike', passive:'Bible',   result:'HolyNova'     },
];

// ═══ ENEMY TEMPLATES ═══
// ── DARK FOREST enemies (wisps, spirits, phantoms)
const ENEMY_TYPES_FOREST = [
    { type:'swarm',      hp:14,  speed:120, r:9,  color:'#c0d8ff', xp:3,  dmg:5  },  // pale blue wisp
    { type:'chase',      hp:20,  speed:100, r:11, color:'#d0aaff', xp:5,  dmg:7  },  // pale violet
    { type:'ranged',     hp:26,  speed:78,  r:12, color:'#aaffee', xp:8,  dmg:9  },  // pale teal
    { type:'charger',    hp:36,  speed:90,  r:14, color:'#ffddaa', xp:12, dmg:13 },  // pale amber
    { type:'exploder',   hp:42,  speed:52,  r:18, color:'#aaffaa', xp:16, dmg:9  },  // pale green
    { type:'phantom',    hp:30,  speed:85,  r:13, color:'#ffffff', xp:14, dmg:11 },  // pure white spirit
    { type:'berserk',    hp:36,  speed:125, r:13, color:'#ff8822', xp:16, dmg:13 },  // orange rager
    { type:'necromancer',hp:44,  speed:52,  r:16, color:'#33ffcc', xp:22, dmg:9  },  // teal summoner
    { type:'shadow',     hp:24,  speed:112, r:11, color:'#aa22ff', xp:14, dmg:10 },  // purple phantom
];

// ── CEMETERY enemies (undead, skeletons, wraiths, ghouls)
const ENEMY_TYPES_CEMETERY = [
    { type:'swarm',      hp:12,  speed:95,  r:9,  color:'#c8c8b0', xp:3,  dmg:5  },  // bone chip — slow
    { type:'chase',      hp:22,  speed:85,  r:12, color:'#88ff88', xp:5,  dmg:8  },  // ghoul — greenish
    { type:'ranged',     hp:24,  speed:70,  r:11, color:'#aaeedd', xp:8,  dmg:10 },  // wraith archer
    { type:'charger',    hp:38,  speed:88,  r:15, color:'#eecc88', xp:12, dmg:14 },  // armored skeleton
    { type:'exploder',   hp:32,  speed:48,  r:20, color:'#88ee88', xp:16, dmg:12 },  // bloated corpse
    { type:'phantom',    hp:28,  speed:80,  r:13, color:'#ddddff', xp:14, dmg:11 },  // banshee
    { type:'berserk',    hp:38,  speed:105, r:13, color:'#ff6644', xp:16, dmg:14 },  // revenant
    { type:'necromancer',hp:72,  speed:48,  r:16, color:'#88ffaa', xp:22, dmg:9  },  // lich
    { type:'shadow',     hp:40,  speed:100, r:11, color:'#cc88ff', xp:14, dmg:10 },  // death shade
];

// Default alias (used as fallback)
const ENEMY_TYPES = ENEMY_TYPES_FOREST;
