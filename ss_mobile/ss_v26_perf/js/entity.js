// ── entity.js ── Base Entity class ──
'use strict';

class Entity {
    constructor(x, y, r, hp, color) {
        this.x = x; this.y = y; this.r = r;
        this.maxHp = hp; this.hp = hp;
        this.color = color;
        this.flash = 0;
        this.dead  = false;
    }

    takeDamage(amt) {
        if (this.dead) return;
        this.hp -= amt;
        this.flash = 0.12;
        if (this.hp <= 0) this.die();
    }

    die() { this.dead = true; }
}
