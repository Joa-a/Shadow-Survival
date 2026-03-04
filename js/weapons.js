// ── weapons.js ── Complete Weapon System ──
'use strict';

// ─── BASE WEAPON ───────────────────────────────────────────────
class Weapon {
    constructor(player, id, baseDmg, cooldown) {
        this.player   = player;
        this.id       = id;
        this.level    = 1;
        this.baseDmg  = baseDmg;
        this.cooldown = cooldown;
        this.timer    = 0;
    }
    levelUp() {
        this.level++;
        this.baseDmg  *= 1.22;
        this.cooldown  = Math.max(this.cooldown * 0.82, 0.12);
    }
    get dmg() {
        const buff = this.player.activeBuffs.damage > 0 ? 2.1 : 1;
        return this.baseDmg * this.player.stats.damageMult * buff;
    }
    // Optional hooks subclasses can override
    draw(ctx, off) {}
    drawProjectiles(ctx, off) {}
}

// ═══════════════════════════════════════════════════════════════
//  WEAPON FACTORY
// ═══════════════════════════════════════════════════════════════
const WeaponFactory = {

// ─────────────────────────────────────────────────────────────
//  WHIP — Arc swing that follows facing direction
//  Fixed: No longer just a horizontal rectangle.
//  Now draws a proper arc/sweep in the direction the player faces,
//  with a realistic whip curve using bezier segments.
// ─────────────────────────────────────────────────────────────
'Whip': class extends Weapon {
    constructor(p) {
        super(p, 'Whip', 13, 1.35);
        this.swingPhase  = 0;   // 0-1 progress of current swing
        this.swingActive = false;
        this.swingAngle  = 0;   // Center angle of the arc
        this.swingArc    = Math.PI * 0.9; // Width of arc in radians
        this.swingLen    = 120; // Length of whip
        this.hitEnemies  = new Set(); // enemies hit this swing
    }
    levelUp() {
        super.levelUp();
        this.swingLen = 120 + this.level * 18;
    }
    update(dt) {
        if (this.swingActive) {
            this.swingPhase += dt / (this.cooldown * 0.5);
            if (this.swingPhase >= 1) {
                this.swingPhase  = 0;
                this.swingActive = false;
                this.hitEnemies.clear();
            }
            // Hit detection: sweep enemies within the arc
            const p = this.player;
            Game.enemies.forEach(e => {
                if (this.hitEnemies.has(e)) return;
                const dx = e.x - p.x, dy = e.y - p.y;
                const dist = Math.hypot(dx, dy);
                if (dist > this.swingLen + e.r) return;
                // Angle from player to enemy
                const ang = Math.atan2(dy, dx);
                // Normalize angle difference
                let diff = ang - this.swingAngle;
                while (diff >  Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                if (Math.abs(diff) < this.swingArc / 2 + 0.2) {
                    const ic = Math.random() < 0.18;
                    e.takeDamage(this.dmg * (ic ? 2.2 : 1));
                    // Knockback away from player
                    const nd = M.norm(dx, dy);
                    e.knockback.x = nd.x * 380;
                    e.knockback.y = nd.y * 380;
                    Game.spawnParticle(e.x, e.y, '#dd6699', 5);
                    Game.spawnText(e.x, e.y, Math.floor(this.dmg * (ic ? 2.2 : 1)), ic);
                    AudioEngine.sfxHit();
                    this.hitEnemies.add(e);
                }
            });
        }

        this.timer -= dt;
        if (this.timer <= 0 && !this.swingActive) {
            this.timer = this.cooldown;
            this.swingActive = true;
            this.swingPhase  = 0;
            this.hitEnemies.clear();
            // Face direction, or toward closest enemy
            const target = Game.getClosestEnemy(this.player.x, this.player.y);
            if (target) {
                this.swingAngle = M.angle(this.player.x, this.player.y, target.x, target.y);
            } else {
                this.swingAngle = Math.atan2(this.player.dir.y, this.player.dir.x);
            }
            AudioEngine.playTone(180, 'sawtooth', 0.12, 0.06);
        }
    }
    draw(ctx, off) {
        if (!this.swingActive) return;
        const p   = this.player;
        const cx  = canvas.width  / 2;
        const cy  = canvas.height / 2;
        // Easing: arc sweeps from startAngle to endAngle
        const ease = t => t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
        const t    = ease(this.swingPhase);
        const startAng = this.swingAngle - this.swingArc / 2;
        const currentAng = startAng + this.swingArc * t;

        ctx.save();
        ctx.translate(cx, cy);

        // Draw whip as a series of thick bezier-like arc strokes
        const segments = 10;
        for (let s = 0; s < segments; s++) {
            const pct1 = s / segments;
            const pct2 = (s + 1) / segments;
            // Whip tapers from thick at base to thin at tip
            const thickness = Math.max(1, 9 * (1 - s / segments));
            const r1 = this.swingLen * pct1;
            const r2 = this.swingLen * pct2;

            // Sweep current angle for drawing the full arc up to swingPhase
            const ang1 = startAng + this.swingArc * pct1;
            const ang2 = startAng + this.swingArc * pct2;

            // Only draw up to current phase
            const drawPct = t;
            const d1 = startAng + this.swingArc * Math.min(drawPct, pct1);
            const d2 = startAng + this.swingArc * Math.min(drawPct, pct2);

            const alpha = (0.9 - s / segments * 0.7) * Math.min(1, (1 - this.swingPhase) * 3);
            ctx.globalAlpha = Math.max(0, alpha);

            const hue = 330 + s * 3;
            ctx.strokeStyle = `hsl(${hue},80%,${65 - s * 4}%)`;
            ctx.shadowColor  = '#ff2255';
            ctx.shadowBlur   = 12 - s;
            ctx.lineWidth    = thickness;
            ctx.lineCap      = 'round';

            ctx.beginPath();
            ctx.arc(0, 0, r1 + (r2 - r1) * 0.5, d1, d2);
            ctx.stroke();
        }

        // Tip spark at current position
        const tipX = Math.cos(currentAng) * this.swingLen;
        const tipY = Math.sin(currentAng) * this.swingLen;
        ctx.globalAlpha = 0.9;
        ctx.fillStyle   = '#ffaacc';
        ctx.shadowColor = '#ff2255';
        ctx.shadowBlur  = 18;
        ctx.beginPath();
        ctx.arc(tipX, tipY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
},

// ─────────────────────────────────────────────────────────────
//  MAGIC WAND — Homing bolt, targets closest N enemies
// ─────────────────────────────────────────────────────────────
'MagicWand': class extends Weapon {
    constructor(p) { super(p, 'MagicWand', 15, 0.95); }
    update(dt) {
        this.timer -= dt;
        if (this.timer <= 0 && Game.enemies.length > 0) {
            this.timer = this.cooldown;
            const sorted = [...Game.enemies].sort((a, b) =>
                M.dist(this.player.x, this.player.y, a.x, a.y) -
                M.dist(this.player.x, this.player.y, b.x, b.y)
            );
            const n = Math.min(this.level, sorted.length);
            for (let i = 0; i < n; i++) {
                const ang = M.angle(this.player.x, this.player.y, sorted[i].x, sorted[i].y);
                Game.projectiles.push({
                    type:'bolt', x:this.player.x, y:this.player.y,
                    vx:Math.cos(ang)*540, vy:Math.sin(ang)*540,
                    r:6, life:2, dmg:this.dmg, color:'#4466ff'
                });
            }
        }
    }
},

// ─────────────────────────────────────────────────────────────
//  KNIFE — Kael's weapon: shoots a REAL KNIFE projectile
//  Drawn as a proper dagger silhouette with blade + handle
// ─────────────────────────────────────────────────────────────
'Knife': class extends Weapon {
    constructor(p) { super(p, 'Knife', 11, 0.55); }
    update(dt) {
        this.timer -= dt;
        if (this.timer <= 0) {
            this.timer = this.cooldown;
            const target = Game.getClosestEnemy(this.player.x, this.player.y);
            const ang = target
                ? M.angle(this.player.x, this.player.y, target.x, target.y)
                : Math.atan2(this.player.dir.y, this.player.dir.x);
            // At higher levels, spread multiple knives in a fan
            const count  = this.level;
            const spread = count > 1 ? 0.18 : 0;
            for (let k = 0; k < count; k++) {
                const offset = (k - (count - 1) / 2) * spread;
                const a = ang + offset;
                Game.projectiles.push({
                    type:'dagger',          // distinct render type
                    x: this.player.x,
                    y: this.player.y,
                    vx: Math.cos(a) * 720,
                    vy: Math.sin(a) * 720,
                    r: 7,
                    life: 1.5,
                    dmg: this.dmg,
                    ang: a,
                    spin: 0,               // for rotation while flying
                    color: '#c8e0ff'
                });
            }
            AudioEngine.playTone(520, 'triangle', 0.06, 0.04);
        }
    }
},

// ─────────────────────────────────────────────────────────────
//  BIBLE — Orbiting holy books / glowing orbs
// ─────────────────────────────────────────────────────────────
'Bible': class extends Weapon {
    constructor(p) {
        super(p, 'Bible', 9, 3);
        this.angle  = 0;
        this.orbitR = 90;
    }
    update(dt) {
        this.angle  += dt * (3.8 + this.level * 0.35);
        this.orbitR  = 90 + this.level * 10;
        const orbs   = this.level >= 3 ? 3 : (this.level >= 2 ? 2 : 1);
        for (let o = 0; o < orbs; o++) {
            const a  = this.angle + (Math.PI * 2 / orbs) * o;
            const bx = this.player.x + Math.cos(a) * this.orbitR;
            const by = this.player.y + Math.sin(a) * this.orbitR;
            Game.enemies.forEach(e => {
                if (M.dist(bx, by, e.x, e.y) < e.r + 20) {
                    e.takeDamage(this.dmg * dt * 5);
                    e.knockback.x = Math.cos(a) * 200;
                    e.knockback.y = Math.sin(a) * 200;
                }
            });
        }
    }
    draw(ctx, off) {
        const orbs = this.level >= 3 ? 3 : (this.level >= 2 ? 2 : 1);
        for (let o = 0; o < orbs; o++) {
            const a  = this.angle + (Math.PI * 2 / orbs) * o;
            const sx = (this.player.x + Math.cos(a) * this.orbitR) - off.x + canvas.width  / 2;
            const sy = (this.player.y + Math.sin(a) * this.orbitR) - off.y + canvas.height / 2;
            ctx.save();
            // Glow
            ctx.shadowColor = '#cc99ff';
            ctx.shadowBlur  = CONFIG.IS_MOBILE ? 8 : 18;
            // Book body
            ctx.fillStyle = '#eeddff';
            ctx.fillRect(sx - 9, sy - 13, 18, 26);
            // Gold cross
            ctx.fillStyle = '#ffd700';
            ctx.fillRect(sx - 1, sy - 9, 2, 14);
            ctx.fillRect(sx - 6, sy - 4, 12, 2);
            ctx.restore();
        }
    }
},

// ─────────────────────────────────────────────────────────────
//  GARLIC — AoE aura, Elora's melee companion weapon
// ─────────────────────────────────────────────────────────────
'Garlic': class extends Weapon {
    constructor(p) {
        super(p, 'Garlic', 4, 0.1);
        this.auraR = 65;
    }
    update(dt) {
        this.auraR = 65 + this.level * 12;
        if (Math.random() > 0.5) return;
        Game.enemies.forEach(e => {
            if (M.dist(this.player.x, this.player.y, e.x, e.y) < e.r + this.auraR) {
                e.hp   -= this.dmg * dt * 6;
                e.flash = Math.max(e.flash, 0.05);
            }
        });
    }
    draw(ctx, off) {
        ctx.save();
        const pulse  = 0.1 + Math.sin(Date.now() * 0.004) * 0.06;
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = 'rgba(140,255,140,0.8)';
        ctx.lineWidth   = 2;
        ctx.shadowColor = '#88ff88';
        ctx.shadowBlur  = 14;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, this.auraR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
},

// ─────────────────────────────────────────────────────────────
//  HOLY STRIKE — Elora's unique close-range radiant blast
//  Short-range cone of divine light. Melee/close distance only.
//  Range capped to 130px. Deals heavy burst damage in a cone.
// ─────────────────────────────────────────────────────────────
'HolyStrike': class extends Weapon {
    constructor(p) {
        super(p, 'HolyStrike', 20, 1.8);
        this.strikeAngle   = 0;
        this.strikeActive  = false;
        this.strikePhase   = 0;
        this.maxRange      = 130;
        this.coneArc       = Math.PI * 0.75; // cone width
        this.hitEnemies    = new Set();
    }
    levelUp() {
        super.levelUp();
        this.maxRange = 130 + this.level * 10;
        this.coneArc  = Math.min(Math.PI * 1.1, this.coneArc + 0.05);
    }
    update(dt) {
        if (this.strikeActive) {
            this.strikePhase += dt * 5;
            // Damage within cone
            if (this.strikePhase < 0.8) {
                const p = this.player;
                Game.enemies.forEach(e => {
                    if (this.hitEnemies.has(e)) return;
                    const dx = e.x - p.x, dy = e.y - p.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist > this.maxRange + e.r) return;
                    let diff = Math.atan2(dy, dx) - this.strikeAngle;
                    while (diff >  Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    if (Math.abs(diff) < this.coneArc / 2) {
                        const ic = Math.random() < 0.25;
                        e.takeDamage(this.dmg * (ic ? 2.4 : 1));
                        e.knockback.x = (dx / dist) * 280;
                        e.knockback.y = (dy / dist) * 280;
                        Game.spawnParticle(e.x, e.y, '#ffffaa', 6);
                        Game.spawnText(e.x, e.y, Math.floor(this.dmg * (ic ? 2.4 : 1)), ic);
                        AudioEngine.sfxHit();
                        this.hitEnemies.add(e);
                    }
                });
            }
            if (this.strikePhase >= 1) {
                this.strikeActive = false;
                this.strikePhase  = 0;
                this.hitEnemies.clear();
            }
        }
        this.timer -= dt;
        if (this.timer <= 0 && !this.strikeActive) {
            this.timer = this.cooldown;
            this.strikeActive = true;
            this.strikePhase  = 0;
            this.hitEnemies.clear();
            // Aim toward closest enemy within range, else face direction
            const target = Game.getClosestEnemy(this.player.x, this.player.y);
            if (target && M.dist(this.player.x, this.player.y, target.x, target.y) < this.maxRange * 1.5) {
                this.strikeAngle = M.angle(this.player.x, this.player.y, target.x, target.y);
            } else {
                this.strikeAngle = Math.atan2(this.player.dir.y, this.player.dir.x);
            }
            AudioEngine.playTone(660, 'sine', 0.15, 0.08);
            AudioEngine.playTone(880, 'sine', 0.1,  0.06);
        }
    }
    draw(ctx, off) {
        if (!this.strikeActive) return;
        const alpha  = Math.max(0, 1 - this.strikePhase);
        const radius = this.maxRange * (0.5 + this.strikePhase * 0.5);
        const cx     = canvas.width  / 2;
        const cy     = canvas.height / 2;

        ctx.save();
        ctx.translate(cx, cy);

        // Outer glow cone
        const grad = ctx.createConicalGradient
            ? null  // not standard, fallback below
            : null;

        // Draw as a radial filled arc sector
        ctx.globalAlpha = alpha * 0.6;
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        g.addColorStop(0,   'rgba(255,255,180,0.9)');
        g.addColorStop(0.5, 'rgba(255,215,80,0.5)');
        g.addColorStop(1,   'rgba(255,215,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, this.strikeAngle - this.coneArc / 2, this.strikeAngle + this.coneArc / 2);
        ctx.closePath();
        ctx.fill();

        // Bright edge lines
        ctx.globalAlpha = alpha * 0.85;
        ctx.strokeStyle  = '#fff8a0';
        ctx.shadowColor  = '#ffd700';
        ctx.shadowBlur   = 22;
        ctx.lineWidth    = 3;
        const a1 = this.strikeAngle - this.coneArc / 2;
        const a2 = this.strikeAngle + this.coneArc / 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a1) * radius, Math.sin(a1) * radius);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a2) * radius, Math.sin(a2) * radius);
        ctx.stroke();
        // Center ray
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(this.strikeAngle) * radius * 0.9, Math.sin(this.strikeAngle) * radius * 0.9);
        ctx.stroke();

        ctx.restore();
    }
},

// ─────────────────────────────────────────────────────────────
//  LIGHTNING — Chain electricity, Vorath's weapon
//  FIXED: Range now capped to 350px (no longer infinite)
// ─────────────────────────────────────────────────────────────
'Lightning': class extends Weapon {
    constructor(p) {
        super(p, 'Lightning', 18, 0.9);
        this.chains     = 1;
        this.maxRange   = 350; // hard cap on initial target range
        this.chainRange = 200; // max range to chain to next target
    }
    levelUp() {
        super.levelUp();
        if (this.level % 2 === 0) this.chains++;
        this.maxRange   = Math.min(500, this.maxRange   + 20);
        this.chainRange = Math.min(280, this.chainRange + 15);
    }
    update(dt) {
        this.timer -= dt;
        if (this.timer <= 0 && Game.enemies.length > 0) {
            this.timer = this.cooldown;
            // First target MUST be within maxRange
            const target = Game.getClosestEnemyInRange(this.player.x, this.player.y, this.maxRange);
            if (!target) return;

            let hit = [target], last = target;
            for (let c = 0; c < this.chains; c++) {
                const next = Game.enemies
                    .filter(e => !hit.includes(e) && M.dist(last.x, last.y, e.x, e.y) < this.chainRange)
                    .sort((a, b) => M.dist(last.x, last.y, a.x, a.y) - M.dist(last.x, last.y, b.x, b.y))[0];
                if (!next) break;
                hit.push(next);
                last = next;
            }
            hit.forEach((e, i) => {
                e.takeDamage(this.dmg * (1 - i * 0.2));
                e.flash = 0.2;
                AudioEngine.sfxLightning();
                Game.lightningBolts.push({
                    fromX: i === 0 ? this.player.x : hit[i - 1].x,
                    fromY: i === 0 ? this.player.y : hit[i - 1].y,
                    toX: e.x, toY: e.y,
                    life: 0.12, maxLife: 0.12
                });
                Game.spawnParticle(e.x, e.y, '#aaff00', 5);
            });
            Game.shake = Math.min(Game.shake + 3, 8);
        }
    }
},

// ─────────────────────────────────────────────────────────────
//  CROSSBOW — Ryxa's piercing arrow
//  FIXED: Range capped to 500px max flight distance
// ─────────────────────────────────────────────────────────────
'CrossBow': class extends Weapon {
    constructor(p) {
        super(p, 'CrossBow', 22, 1.6);
        this.maxRange = 480; // max travel before disappearing
    }
    levelUp() {
        super.levelUp();
        this.maxRange = Math.min(700, this.maxRange + 30);
    }
    update(dt) {
        this.timer -= dt;
        if (this.timer <= 0) {
            this.timer = this.cooldown;
            // Target closest enemy within a reasonable range
            const target = Game.getClosestEnemyInRange(this.player.x, this.player.y, this.maxRange * 0.8);
            const ang = target
                ? M.angle(this.player.x, this.player.y, target.x, target.y)
                : Math.atan2(this.player.dir.y, this.player.dir.x);
            Game.projectiles.push({
                type:     'arrow',
                x:        this.player.x,
                y:        this.player.y,
                vx:       Math.cos(ang) * 820,
                vy:       Math.sin(ang) * 820,
                r:        5,
                life:     this.maxRange / 820, // time = distance/speed
                dmg:      this.dmg,
                ang,
                piercing: true,
                pierced:  [],
                maxPierce: 2 + this.level,
                color:    '#ffe066'
            });
            AudioEngine.playTone(400, 'triangle', 0.08, 0.05);
        }
    }
},

// ─────────────────────────────────────────────────────────────
//  FLAME — Fire zone weapon
// ─────────────────────────────────────────────────────────────
'Flame': class extends Weapon {
    constructor(p) {
        super(p, 'Flame', 6, 0.5);
        this.flames = [];
    }
    update(dt) {
        this.timer -= dt;
        if (this.timer <= 0) {
            this.timer = this.cooldown;
            this.flames.push({
                x: this.player.x, y: this.player.y,
                r: 40 + this.level * 8,
                life: 2.5 + this.level * 0.4,
                maxLife: 2.5 + this.level * 0.4,
                flickers: Array.from({length:12}, () => Math.random() * Math.PI * 2)
            });
        }
        for (let i = this.flames.length - 1; i >= 0; i--) {
            const f = this.flames[i];
            f.life -= dt;
            if (f.life <= 0) { this.flames.splice(i, 1); continue; }
            Game.enemies.forEach(e => {
                if (M.dist(f.x, f.y, e.x, e.y) < e.r + f.r) {
                    e.hp   -= this.dmg * dt * 4;
                    e.flash = Math.max(e.flash, 0.04);
                }
            });
        }
    }
    draw(ctx, off) {
        const t = Date.now() * 0.003;
        this.flames.forEach(f => {
            const sx    = f.x - off.x + canvas.width  / 2;
            const sy    = f.y - off.y + canvas.height / 2;
            const ratio = f.life / f.maxLife;
            ctx.save();
            ctx.globalAlpha = ratio * 0.55;
            const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, f.r);
            grad.addColorStop(0,   'rgba(255,220,60,0.95)');
            grad.addColorStop(0.4, 'rgba(255,90,20,0.7)');
            grad.addColorStop(1,   'rgba(180,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(sx, sy, f.r, 0, Math.PI * 2);
            ctx.fill();
            // Flame flicker petals
            ctx.globalAlpha = ratio * 0.35;
            ctx.fillStyle = 'rgba(255,160,20,0.6)';
            f.flickers.forEach((a, i) => {
                const fa  = a + t * (1 + i * 0.15);
                const fr  = f.r * (0.5 + Math.sin(t * 3 + i) * 0.25);
                const fpx = sx + Math.cos(fa) * fr;
                const fpy = sy + Math.sin(fa) * fr;
                ctx.beginPath();
                ctx.arc(fpx, fpy, 6 + Math.sin(t * 4 + i) * 3, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.restore();
        });
    }
},

}; // end WeaponFactory

// ─────────────────────────────────────────────────────────────
//  DRAW ROUTER — called from game.js draw loop for projectiles
// ─────────────────────────────────────────────────────────────
function drawProjectile(ctx, p, off) {
    const sx = p.x - off.x + canvas.width  / 2;
    const sy = p.y - off.y + canvas.height / 2;
    ctx.save();

    if (p.type === 'dagger') {
        // Full dagger shape: blade + guard + handle
        ctx.translate(sx, sy);
        ctx.rotate(p.ang);
        // Blade
        ctx.shadowColor = '#99ccff';
        ctx.shadowBlur  = CONFIG.IS_MOBILE ? 6 : 14;
        // Blade body (slightly curved polygon)
        ctx.fillStyle = '#ddeeff';
        ctx.beginPath();
        ctx.moveTo(20, 0);          // tip
        ctx.lineTo(2, -3);          // upper edge
        ctx.lineTo(-6, -2.5);       // base of blade
        ctx.lineTo(-6,  2.5);
        ctx.lineTo(2,  3);
        ctx.closePath();
        ctx.fill();
        // Blade edge highlight
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(2, -1.5);
        ctx.lineTo(-4, -1);
        ctx.lineTo(-4,  0);
        ctx.lineTo(2,  0.5);
        ctx.closePath();
        ctx.fill();
        // Blood groove (fuller)
        ctx.fillStyle = 'rgba(120,180,255,0.4)';
        ctx.fillRect(-5, -0.7, 18, 1.4);
        // Cross guard
        ctx.fillStyle = '#888844';
        ctx.shadowColor = '#ffdd44';
        ctx.shadowBlur  = 6;
        ctx.fillRect(-8, -5, 3, 10);
        // Handle
        ctx.fillStyle = '#553322';
        ctx.shadowBlur = 0;
        ctx.fillRect(-18, -3, 11, 6);
        // Pommel
        ctx.fillStyle = '#887744';
        ctx.beginPath();
        ctx.arc(-18, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        // Handle wrap lines
        ctx.strokeStyle = '#331100';
        ctx.lineWidth   = 0.8;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(-15 + i * 3, -3);
            ctx.lineTo(-15 + i * 3,  3);
            ctx.stroke();
        }

    } else if (p.type === 'arrow') {
        ctx.translate(sx, sy);
        ctx.rotate(p.ang);
        ctx.shadowColor = '#ffe090';
        ctx.shadowBlur  = 10;
        // Shaft
        ctx.fillStyle = '#a06820';
        ctx.fillRect(-22, -1.5, 30, 3);
        // Arrow head
        ctx.fillStyle = '#e8e8e8';
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-2, -5);
        ctx.lineTo(0,  0);
        ctx.lineTo(-2,  5);
        ctx.closePath();
        ctx.fill();
        // Nock
        ctx.fillStyle = '#885522';
        ctx.fillRect(-24, -2, 4, 4);
        // Fletching (feathers)
        ctx.fillStyle = 'rgba(200,80,80,0.7)';
        ctx.beginPath();
        ctx.moveTo(-18, 0);
        ctx.lineTo(-24, -7);
        ctx.lineTo(-21, 0);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-18, 0);
        ctx.lineTo(-24,  7);
        ctx.lineTo(-21, 0);
        ctx.closePath();
        ctx.fill();

    } else if (p.type === 'bolt') {
        ctx.shadowColor = p.color || '#ffdd44';
        ctx.shadowBlur  = CONFIG.IS_MOBILE ? 7 : 16;
        ctx.fillStyle   = p.color || '#ffe066';
        ctx.beginPath();
        ctx.arc(sx, sy, p.r || 6, 0, Math.PI * 2);
        ctx.fill();
        // Inner core
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(sx, sy, (p.r || 6) * 0.4, 0, Math.PI * 2);
        ctx.fill();

    } else if (p.type === 'whip') {
        // Whip is drawn by the weapon itself in the weapon draw pass
        // nothing here
    } else {
        // Generic fallback
        ctx.shadowColor = p.color || '#ffdd44';
        ctx.shadowBlur  = 14;
        ctx.fillStyle   = p.color || '#ffe066';
        ctx.beginPath();
        ctx.arc(sx, sy, p.r || 6, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}
