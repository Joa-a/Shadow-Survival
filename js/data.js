// ── data.js ── Game data: characters, upgrades, achievements ──
'use strict';

// ═══ CHARACTERS ═══
const CHARACTERS = [
    { id:'warrior', name:'Alaric',  icon:'⚔️', hp:70,  speed:195, weapon:'Whip',      desc:'Tanque con látigo perforante.',  stats:{hp:'●●●●○',spd:'●●●○○',atk:'●●●○○'} },
    { id:'mage',    name:'Zale',    icon:'🔮', hp:35,  speed:175, weapon:'MagicWand', desc:'Frágil pero devastador.',        stats:{hp:'●●○○○',spd:'●●○○○',atk:'●●●●●'} },
    { id:'rogue',   name:'Kael',    icon:'🗡️', hp:45,  speed:260, weapon:'Knife',     desc:'Velocísimo. Esquiva o muere.',   stats:{hp:'●●●○○',spd:'●●●●●',atk:'●●●○○'} },
    { id:'cleric',  name:'Elora',   icon:'✨', hp:55,  speed:185, weapon:'Bible',     desc:'Aura defensiva equilibrada.',    stats:{hp:'●●●●○',spd:'●●○○○',atk:'●●○○○'} },
    { id:'hunter',  name:'Ryxa',    icon:'🏹', hp:40,  speed:210, weapon:'CrossBow',  desc:'Arquera de largo alcance.',      stats:{hp:'●●○○○',spd:'●●●○○',atk:'●●●●○'} },
    { id:'shaman',  name:'Vorath',  icon:'🌩️', hp:50,  speed:180, weapon:'Lightning', desc:'Cadenas eléctricas en cadena.',  stats:{hp:'●●●○○',spd:'●●○○○',atk:'●●●●○'} },
];

// ═══ UPGRADES ═══
const UPGRADES_DB = {
    'Whip':       { name:'Látigo',       icon:'〰️', desc:'Ataque horizontal perforante.',       type:'weapon' },
    'MagicWand':  { name:'Varita',       icon:'🪄', desc:'Proyectil al enemigo más cercano.',    type:'weapon' },
    'Knife':      { name:'Daga',         icon:'🔪', desc:'Dagas veloces en tu dirección.',       type:'weapon' },
    'Bible':      { name:'Orbe Sagrado', icon:'📖', desc:'Orbe que gira y daña alrededor.',      type:'weapon' },
    'Garlic':     { name:'Aura',         icon:'🧄', desc:'Daño constante cerca del jugador.',    type:'weapon' },
    'Lightning':  { name:'Rayo',         icon:'⚡', desc:'Cadena eléctrica que salta enemigos.',  type:'weapon' },
    'CrossBow':   { name:'Ballesta',     icon:'🏹', desc:'Flecha penetrante de alta velocidad.', type:'weapon' },
    'Flame':      { name:'Llama',        icon:'🔥', desc:'Zona de fuego persistente.',           type:'weapon' },
    'Boots':      { name:'Botas',        icon:'👟', desc:'Velocidad de movimiento +15%.',        type:'stat'   },
    'Spinach':    { name:'Espinaca',     icon:'🥬', desc:'Daño total +22%.',                     type:'stat'   },
    'Armor':      { name:'Armadura',     icon:'🛡️', desc:'Reduce daño recibido en 3.',           type:'stat'   },
    'Magnet':     { name:'Imán',         icon:'🧲', desc:'Radio de recogida de gemas +35%.',     type:'stat'   },
    'Regen':      { name:'Regen',        icon:'💚', desc:'Regenera 0.4 HP/segundo.',             type:'stat'   },
    'Ultra':      { name:'Ultra+',       icon:'⚡', desc:'+1 carga, -15s recarga, +potencia.',   type:'stat'   },
    'Vampire':    { name:'Vampiro',      icon:'🧛', desc:'Roba 1 HP por cada 5 kills.',          type:'stat'   },
};

// ═══ ACHIEVEMENTS ═══
const ACHIEVEMENTS = [
    { id:'first_blood', name:'Primera Sangre', desc:'Mata tu primer enemigo',    condition: g => g.kills >= 1,       earned: false },
    { id:'combo10',     name:'Combo Asesino',  desc:'Alcanza x10 combo',         condition: g => g.combo >= 10,      earned: false },
    { id:'level5',      name:'Superviviente',  desc:'Llega al nivel 5',          condition: g => g.player?.level>=5, earned: false },
    { id:'kills50',     name:'Cazador',        desc:'50 eliminaciones',          condition: g => g.kills >= 50,      earned: false },
    { id:'kills100',    name:'Exterminador',   desc:'100 eliminaciones',         condition: g => g.kills >= 100,     earned: false },
    { id:'survive3min', name:'Resistente',     desc:'Sobrevive 3 minutos',       condition: g => g.time >= 180,      earned: false },
    { id:'bossslayer',  name:'Mata-Jefes',     desc:'Derrota a un Jefe',         condition: g => g.bossKills >= 1,   earned: false },
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
