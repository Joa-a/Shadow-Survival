// ── spatial.js ── Spatial Hash Grid — O(K) collision queries ──
// Replaces the O(N×M) nested loop in game.js.
// Cell size 80px: covers the largest enemy diameter (32px) × 2.5
'use strict';

const SpatialHash = {
    CELL: 80,
    _map: new Map(),

    // ── Rebuild every frame at the start of update() ─────────────
    // Each enemy registers into every cell it overlaps (up to 4 cells).
    rebuild(enemies) {
        this._map.clear();
        for (const e of enemies) {
            const x0 = Math.floor((e.x - e.r) / this.CELL);
            const x1 = Math.floor((e.x + e.r) / this.CELL);
            const y0 = Math.floor((e.y - e.r) / this.CELL);
            const y1 = Math.floor((e.y + e.r) / this.CELL);
            for (let cx = x0; cx <= x1; cx++) {
                for (let cy = y0; cy <= y1; cy++) {
                    // Compact integer key — no string allocation per cell
                    const key = ((cx & 0xFFFF) << 16) | (cy & 0xFFFF);
                    let bucket = this._map.get(key);
                    if (!bucket) { bucket = []; this._map.set(key, bucket); }
                    bucket.push(e);
                }
            }
        }
    },

    // ── Query: returns a Set of candidates near point (x, y) ─────
    // radius: max distance you care about (usually projectile.r + largest_enemy_r)
    query(x, y, radius) {
        const result = new Set();
        const x0 = Math.floor((x - radius) / this.CELL);
        const x1 = Math.floor((x + radius) / this.CELL);
        const y0 = Math.floor((y - radius) / this.CELL);
        const y1 = Math.floor((y + radius) / this.CELL);
        for (let cx = x0; cx <= x1; cx++) {
            for (let cy = y0; cy <= y1; cy++) {
                const bucket = this._map.get(((cx & 0xFFFF) << 16) | (cy & 0xFFFF));
                if (bucket) for (const e of bucket) result.add(e);
            }
        }
        return result;
    },

    // ── queryArray: same but returns Array (faster for small sets) ─
    queryArray(x, y, radius) {
        const seen   = new Set();
        const result = [];
        const x0 = Math.floor((x - radius) / this.CELL);
        const x1 = Math.floor((x + radius) / this.CELL);
        const y0 = Math.floor((y - radius) / this.CELL);
        const y1 = Math.floor((y + radius) / this.CELL);
        for (let cx = x0; cx <= x1; cx++) {
            for (let cy = y0; cy <= y1; cy++) {
                const bucket = this._map.get(((cx & 0xFFFF) << 16) | (cy & 0xFFFF));
                if (bucket) for (const e of bucket) {
                    if (!seen.has(e)) { seen.add(e); result.push(e); }
                }
            }
        }
        return result;
    }
};
