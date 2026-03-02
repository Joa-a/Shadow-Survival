// ── config.js ── Global constants & configuration ──
'use strict';

let canvas; // Set in Game.init() — used by all modules

const CONFIG = {
    PARTICLE_LIMIT: 120,
    ENEMY_LIMIT: 140,
    IS_MOBILE: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
};
