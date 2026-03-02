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
