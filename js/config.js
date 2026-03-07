// ── config.js ── Global constants & configuration ──
'use strict';

let canvas; // Set in Game.init() — used by all modules

const CONFIG = {
    PARTICLE_LIMIT: 60,
    ENEMY_LIMIT: 350,
    IS_MOBILE: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
};
