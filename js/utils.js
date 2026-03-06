// ── utils.js ── Math utilities ──
'use strict';

const M = {
    dist:    (x1, y1, x2, y2) => Math.sqrt((x2-x1)**2 + (y2-y1)**2),
    lerp:    (a, b, t)        => a + (b-a)*t,
    clamp:   (v, mn, mx)      => Math.max(mn, Math.min(mx, v)),
    rand:    (mn, mx)         => Math.random()*(mx-mn)+mn,
    randInt: (mn, mx)         => Math.floor(Math.random()*(mx-mn+1))+mn,
    angle:   (x1, y1, x2, y2) => Math.atan2(y2-y1, x2-x1),
    norm:    (dx, dy)         => { const d = Math.hypot(dx,dy)||1; return {x:dx/d, y:dy/d}; },
};

// ── Combat math helpers (used by game.js collision handler) ──────

// P(crit) = 12% base + 2% per weapon level + 1% per 5 combo, hard-cap 35%
function calcCritChance(weaponLevel, combo) {
    return Math.min(0.35,
        0.12 + weaponLevel * 0.02 + Math.floor(combo / 5) * 0.01);
}

// Crit multiplier: logarithmic so it grows fast early, flattens in late-game
// Lv1→1.72×  Lv4→1.95×  Lv8→2.15×
function calcCritMult(weaponLevel) {
    return 1.6 + 0.17 * Math.log(weaponLevel + 1);
}

// Knockback force: proportional to damage relative to enemy max-HP,
// square-root applied to flatten the curve at high damage values.
// 10% HP dmg→295 px/s   50%→412 px/s   100%→500 px/s
function calcKnockback(rawDamage, enemyMaxHp) {
    const ratio = rawDamage / Math.max(enemyMaxHp, 1);
    return 200 + 300 * Math.sqrt(Math.min(ratio, 1.0));
}
