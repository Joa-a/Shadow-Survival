// ── config.js ── Global constants & configuration ──
'use strict';

let canvas; // Set in Game.init() — used by all modules

const CONFIG = {
    PARTICLE_LIMIT: 60,
    PARTICLE_LIMIT_MOBILE: 25,
    ENEMY_LIMIT: 350,
    ENEMY_LIMIT_MOBILE: 22,
    IS_MOBILE: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
};
