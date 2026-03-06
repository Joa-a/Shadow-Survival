// ── weapons.js ── Weapon System — Part 2 Complete Overhaul ──
'use strict';

// ─── Bezier helper for whip curve ──────────────────────────────
function _bezPt(p0, p1, p2, t) {
    return (1-t)*(1-t)*p0 + 2*(1-t)*t*p1 + t*t*p2;
}

// ═══════════════════════════════════════════════════════════════
//  BASE WEAPON
// ═══════════════════════════════════════════════════════════════
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
        this.cooldown  = Math.max(this.cooldown * 0.82, 0.10);
    }
    get dmg() {
        const buff = this.player.activeBuffs.damage > 0 ? 2.1 : 1;
        return this.baseDmg * this.player.stats.damageMult * buff;
    }
    // Subclasses can override
    draw(ctx, off) {}
}

// ═══════════════════════════════════════════════════════════════
//  WEAPON FACTORY
// ═══════════════════════════════════════════════════════════════
const WeaponFactory = {

// ─────────────────────────────────────────────────────────────
//  WHIP (Alaric)
//  A real whip: sweeps a tapered bezier curve from the player's
//  body outward, following the direction of movement or nearest
//  enemy. NOT a rectangle. Arc widens by level.
// ─────────────────────────────────────────────────────────────
'Whip': class extends Weapon {
    constructor(p) {
        super(p, 'Whip', 14, 1.3);
        this.swingPhase  = 0;
        this.swingActive = false;
        this.swingAngle  = 0;       // center direction of swing
        this.swingArc    = Math.PI * 0.85;   // total arc width (radians)
        this.swingLen    = 130;     // whip reach in px
        this.hitSet      = new Set();
    }

    levelUp() {
        super.levelUp();
        this.swingLen += 18;
        this.swingArc  = Math.min(Math.PI * 1.15, this.swingArc + 0.05);
    }

    // Direction the player is facing (or moving). Falls back to right.
    _facingAngle() {
        const dx = this.player.dir ? this.player.dir.x : 0;
        const dy = this.player.dir ? this.player.dir.y : 0;
        if (Math.abs(dx) + Math.abs(dy) < 0.01) return 0;
        return Math.atan2(dy, dx);
    }

    update(dt) {
        // ── Running swing phase ─────────────────────────────────
        if (this.swingActive) {
            this.swingPhase += dt * 2.2;
            if (this.swingPhase >= 1) {
                this.swingPhase  = 0;
                this.swingActive = false;
                this.hitSet.clear();
            }

            const halfArc = this.swingArc / 2;
            const px = this.player.x, py = this.player.y;

            for (const e of Game.enemies) {
                if (this.hitSet.has(e)) continue;
                const dx = e.x - px, dy = e.y - py;
                const dist = Math.hypot(dx, dy);
                if (dist > this.swingLen + e.r) continue;

                // Angle difference from swing center
                let diff = Math.atan2(dy, dx) - this.swingAngle;
                while (diff >  Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;

                if (Math.abs(diff) <= halfArc + 0.1) {
                    const ic  = Math.random() < 0.18;
                    const dmg = this.dmg * (ic ? 2.2 : 1);
                    e.takeDamage(dmg);
                    const n = M.norm(dx, dy);
                    e.knockback.x = n.x * 400;
                    e.knockback.y = n.y * 400;
                    Game.spawnParticle(e.x, e.y, '#ff44aa', 5);
                    Game.spawnText(e.x, e.y, Math.floor(dmg), ic);
                    AudioEngine.sfxHit();
                    this.hitSet.add(e);
                }
            }
        }

        // ── Cooldown / fire ─────────────────────────────────────
        this.timer -= dt;
        if (this.timer <= 0 && !this.swingActive) {
            this.timer       = this.cooldown;
            this.swingActive = true;
            this.swingPhase  = 0;
            this.hitSet.clear();

            const target = Game.getClosestEnemy(this.player.x, this.player.y);
            this.swingAngle = target
                ? M.angle(this.player.x, this.player.y, target.x, target.y)
                : this._facingAngle();

            AudioEngine.playTone(175, 'sawtooth', 0.13, 0.06);
        }
    }

    draw(ctx, off) {
        if (!this.swingActive) return;

        // Ease in-out so the whip has a snap-like feel
        const raw  = this.swingPhase;
        const ease = raw < 0.5 ? 2*raw*raw : -1+(4-2*raw)*raw;

        const startAng  = this.swingAngle - this.swingArc / 2;
        const currAng   = startAng + this.swingArc * ease;
        const fadeOut   = Math.max(0, 1 - raw * 1.5);

        const cx = canvas.width  / 2;
        const cy = canvas.height / 2;

        // Tip world position
        const tipX = Math.cos(currAng) * this.swingLen;
        const tipY = Math.sin(currAng) * this.swingLen;

        // Bezier control point: midway between start and current angle,
        // slightly inside (0.5x) to create natural whip curve
        const midAng = startAng + this.swingArc * ease * 0.45;
        const cpX    = Math.cos(midAng) * this.swingLen * 0.52;
        const cpY    = Math.sin(midAng) * this.swingLen * 0.52;

        ctx.save();
        ctx.translate(cx, cy);

        // ── 1. Ghost arc trail (path swept by tip) ────────────────
        ctx.globalAlpha = fadeOut * 0.28;
        ctx.strokeStyle = '#ff2255';
        ctx.shadowColor = '#ff2255';
        ctx.shadowBlur  = 6;
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.arc(0, 0, this.swingLen, startAng, currAng);
        ctx.stroke();
        ctx.setLineDash([]);

        // ── 2. Whip body — tapered bezier segments ────────────────
        const SEGS = 14;
        for (let s = 0; s < SEGS; s++) {
            const t1 = s       / SEGS;
            const t2 = (s + 1) / SEGS;

            const x1 = _bezPt(0, cpX, tipX, t1);
            const y1 = _bezPt(0, cpY, tipY, t1);
            const x2 = _bezPt(0, cpX, tipX, t2);
            const y2 = _bezPt(0, cpY, tipY, t2);

            // Taper: thick at base (~9px), thin at tip (~0.5px)
            const thickness = Math.max(0.5, 9.5 * (1 - t1) * (1 - t1 * 0.5));
            const hue   = 318 + t1 * 35;
            const lum   = 55  + t1 * 20;
            const alpha = fadeOut * (0.95 - t1 * 0.45);

            ctx.globalAlpha = Math.max(0, alpha);
            ctx.strokeStyle = `hsl(${hue},82%,${lum}%)`;
            ctx.shadowColor = '#ff2255';
            ctx.shadowBlur  = Math.max(1, 15 - s * 1.1);
            ctx.lineWidth   = thickness;
            ctx.lineCap     = 'round';

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        // ── 3. Crack tip spark ────────────────────────────────────
        ctx.globalAlpha = fadeOut * 0.95;
        ctx.fillStyle   = '#ffffff';
        ctx.shadowColor = '#ffbbdd';
        ctx.shadowBlur  = 22;
        ctx.beginPath();
        ctx.arc(tipX, tipY, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Mini sparks around tip
        if (raw < 0.6 && raw > 0.1) {
            for (let i = 0; i < 3; i++) {
                const sa = currAng + (Math.random() - 0.5) * 1.4;
                const sd = 6 + Math.random() * 12;
                ctx.globalAlpha = fadeOut * 0.5 * Math.random();
                ctx.fillStyle   = '#ff88bb';
                ctx.shadowBlur  = 10;
                ctx.beginPath();
                ctx.arc(tipX + Math.cos(sa)*sd, tipY + Math.sin(sa)*sd, 1.5, 0, Math.PI*2);
                ctx.fill();
            }
        }

        ctx.restore();
    }
},

// ─────────────────────────────────────────────────────────────
//  MAGIC WAND — Homing orb(s) to nearest enemies
// ─────────────────────────────────────────────────────────────
'MagicWand': class extends Weapon {
    constructor(p) { super(p, 'MagicWand', 15, 0.95); }
    update(dt) {
        this.timer -= dt;
        if (this.timer > 0 || !Game.enemies.length) return;
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
                r:6, life:2, dmg:this.dmg, color:'#4466ff', weaponLevel:this.level
            });
        }
    }
},

// ─────────────────────────────────────────────────────────────
//  KNIFE (Kael) — Throws a real rendered dagger as projectile.
//  The dagger spins while flying and looks like an actual knife.
//  Multiple daggers fan out at higher levels.
// ─────────────────────────────────────────────────────────────
'Knife': class extends Weapon {
    constructor(p) { super(p, 'Knife', 11, 0.52); }

    _facingAngle() {
        const dx = this.player.dir ? this.player.dir.x : 0;
        const dy = this.player.dir ? this.player.dir.y : 0;
        if (Math.abs(dx) + Math.abs(dy) < 0.01) return 0;
        return Math.atan2(dy, dx);
    }

    update(dt) {
        this.timer -= dt;
        if (this.timer > 0) return;
        this.timer = this.cooldown;

        const target  = Game.getClosestEnemy(this.player.x, this.player.y);
        const baseAng = target
            ? M.angle(this.player.x, this.player.y, target.x, target.y)
            : this._facingAngle();

        const count  = this.level;
        const spread = count > 1 ? 0.17 : 0;

        for (let k = 0; k < count; k++) {
            const offset = (k - (count - 1) / 2) * spread;
            const ang    = baseAng + offset;
            Game.projectiles.push({
                type:  'dagger',
                x:     this.player.x,
                y:     this.player.y,
                vx:    Math.cos(ang) * 740,
                vy:    Math.sin(ang) * 740,
                r:     8,
                life:  1.5,
                dmg:   this.dmg,
                weaponLevel: this.level,
                ang:   ang,
                spin:  ang,      // continuously updated in game.js
                color: '#c8e0ff'
            });
        }
        AudioEngine.playTone(540, 'triangle', 0.07, 0.04);
    }
},

// ─────────────────────────────────────────────────────────────
//  BIBLE — Orbiting holy books
// ─────────────────────────────────────────────────────────────
'Bible': class extends Weapon {
    constructor(p) {
        super(p, 'Bible', 9, 3);
        this.angle  = 0;
        this.orbitR = 88;
    }
    update(dt) {
        this.angle  += dt * (3.8 + this.level * 0.35);
        this.orbitR  = 88 + this.level * 10;
        const orbs   = this.level >= 5 ? 5 : this.level >= 4 ? 4 : this.level >= 3 ? 3 : this.level >= 2 ? 2 : 1;
        for (let o = 0; o < orbs; o++) {
            const a  = this.angle + (Math.PI * 2 / orbs) * o;
            const bx = this.player.x + Math.cos(a) * this.orbitR;
            const by = this.player.y + Math.sin(a) * this.orbitR;
            for (const e of Game.enemies) {
                if (M.dist(bx, by, e.x, e.y) < e.r + 20) {
                    e.takeDamage(this.dmg * dt * 5);
                    e.knockback.x = Math.cos(a) * 200;
                    e.knockback.y = Math.sin(a) * 200;
                }
            }
        }
    }
    draw(ctx, off) {
        const orbs = this.level >= 5 ? 5 : this.level >= 4 ? 4 : this.level >= 3 ? 3 : this.level >= 2 ? 2 : 1;
        for (let o = 0; o < orbs; o++) {
            const a  = this.angle + (Math.PI * 2 / orbs) * o;
            const sx = (this.player.x + Math.cos(a) * this.orbitR) - off.x + canvas.width  / 2;
            const sy = (this.player.y + Math.sin(a) * this.orbitR) - off.y + canvas.height / 2;
            ctx.save();
            ctx.shadowColor = '#cc99ff';
            ctx.shadowBlur  = CONFIG.IS_MOBILE ? 8 : 20;
            // Book body
            ctx.fillStyle = '#eeddff';
            ctx.fillRect(sx-9, sy-13, 18, 26);
            // Spine
            ctx.fillStyle = '#cc88ff';
            ctx.fillRect(sx-9, sy-13, 3, 26);
            // Gold cross
            ctx.fillStyle   = '#ffd700';
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur  = 8;
            ctx.fillRect(sx-1, sy-9,  2, 14);
            ctx.fillRect(sx-6, sy-4, 12,  2);
            ctx.restore();
        }
    }
},

// ─────────────────────────────────────────────────────────────
//  GARLIC — Persistent damage aura
// ─────────────────────────────────────────────────────────────
'Garlic': class extends Weapon {
    constructor(p) {
        super(p, 'Garlic', 4, 0.1);
        this.auraR = 65;
    }
    update(dt) {
        this.auraR = 65 + this.level * 12;
        if (Math.random() > 0.5) return;
        for (const e of Game.enemies) {
            if (M.dist(this.player.x, this.player.y, e.x, e.y) < e.r + this.auraR) {
                e.hp   -= this.dmg * dt * 6;
                e.flash = Math.max(e.flash, 0.05);
            }
        }
    }
    draw(ctx, off) {
        const t  = Date.now() * 0.004;
        const p1 = 0.07 + Math.sin(t)        * 0.05;
        const p2 = 0.04 + Math.sin(t * 1.7)  * 0.03;
        ctx.save();
        // Outer ring
        ctx.globalAlpha = p1;
        ctx.strokeStyle = 'rgba(140,255,140,0.9)';
        ctx.lineWidth   = 2;
        ctx.shadowColor = '#88ff88';
        ctx.shadowBlur  = 16;
        ctx.beginPath();
        ctx.arc(canvas.width/2, canvas.height/2, this.auraR, 0, Math.PI*2);
        ctx.stroke();
        // Inner fill
        ctx.globalAlpha = p2;
        const g = ctx.createRadialGradient(
            canvas.width/2, canvas.height/2, 0,
            canvas.width/2, canvas.height/2, this.auraR
        );
        g.addColorStop(0, 'rgba(140,255,140,0.2)');
        g.addColorStop(1, 'rgba(140,255,140,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(canvas.width/2, canvas.height/2, this.auraR, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    }
},

// ─────────────────────────────────────────────────────────────
//  HOLY STRIKE (Elora) — Melee close-range radiant cone blast.
//  STRICTLY short range (125px base). Fast cooldown (~0.9s) so
//  it feels like actual melee. Wide cone (≈130°). Heavy damage.
//  Visual: divine cone of golden light that expands quickly.
// ─────────────────────────────────────────────────────────────
'HolyStrike': class extends Weapon {
    constructor(p) {
        super(p, 'HolyStrike', 22, 0.95);  // fast cooldown for melee feel
        this.active   = false;
        this.phase    = 0;     // 0→1 over ~0.18s
        this.angle    = 0;     // swing direction
        this.range    = 125;   // hard melee range
        this.coneArc  = Math.PI * 0.72;   // ~130° cone
        this.hitSet   = new Set();
    }

    levelUp() {
        super.levelUp();
        this.range   = Math.min(175, this.range   + 10);
        this.coneArc = Math.min(Math.PI * 1.05, this.coneArc + 0.055);
    }

    _facingAngle() {
        const dx = this.player.dir ? this.player.dir.x : 0;
        const dy = this.player.dir ? this.player.dir.y : 0;
        if (Math.abs(dx) + Math.abs(dy) < 0.01) return 0;
        return Math.atan2(dy, dx);
    }

    update(dt) {
        // ── Active animation phase ──────────────────────────────
        if (this.active) {
            this.phase += dt * 5.5;   // ~0.18s duration

            // Damage window: first 70% of animation
            if (this.phase < 0.7) {
                for (const e of Game.enemies) {
                    if (this.hitSet.has(e)) continue;
                    const dx   = e.x - this.player.x;
                    const dy   = e.y - this.player.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist > this.range + e.r) continue;

                    let diff = Math.atan2(dy, dx) - this.angle;
                    while (diff >  Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;

                    if (Math.abs(diff) < this.coneArc / 2) {
                        const ic = Math.random() < 0.28;
                        const d  = this.dmg * (ic ? 2.4 : 1);
                        e.takeDamage(d);
                        const n = dist > 0 ? M.norm(dx, dy) : { x:1, y:0 };
                        e.knockback.x = n.x * 300;
                        e.knockback.y = n.y * 300;
                        Game.spawnParticle(e.x, e.y, '#ffffaa', 7);
                        Game.spawnText(e.x, e.y, Math.floor(d), ic);
                        AudioEngine.sfxHit();
                        this.hitSet.add(e);
                    }
                }
            }

            if (this.phase >= 1) {
                this.active = false;
                this.phase  = 0;
                this.hitSet.clear();
            }
        }

        // ── Fire on cooldown ────────────────────────────────────
        this.timer -= dt;
        if (this.timer <= 0 && !this.active) {
            this.timer  = this.cooldown;
            this.active = true;
            this.phase  = 0;
            this.hitSet.clear();

            // Aim at closest enemy within 2× range, else use facing
            const target = Game.getClosestEnemyInRange(
                this.player.x, this.player.y, this.range * 2.2
            );
            this.angle = target
                ? M.angle(this.player.x, this.player.y, target.x, target.y)
                : this._facingAngle();

            // Holy chord
            AudioEngine.playTone(660, 'sine', 0.12, 0.07);
            setTimeout(() => AudioEngine.playTone(830, 'sine', 0.09, 0.06), 35);
            setTimeout(() => AudioEngine.playTone(990, 'sine', 0.07, 0.05), 70);
        }
    }

    draw(ctx, off) {
        if (!this.active) return;

        const alpha = Math.max(0, 1 - this.phase);
        const r     = this.range * (0.3 + this.phase * 0.7);
        const a1    = this.angle - this.coneArc / 2;
        const a2    = this.angle + this.coneArc / 2;
        const cx    = canvas.width  / 2;
        const cy    = canvas.height / 2;

        ctx.save();
        ctx.translate(cx, cy);

        // ── Filled cone gradient ─────────────────────────────────
        ctx.globalAlpha = alpha * 0.68;
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        grad.addColorStop(0,    'rgba(255,255,200,0.98)');
        grad.addColorStop(0.30, 'rgba(255,230, 80,0.75)');
        grad.addColorStop(0.65, 'rgba(255,180, 30,0.40)');
        grad.addColorStop(1,    'rgba(255,150,  0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r, a1, a2);
        ctx.closePath();
        ctx.fill();

        // ── Shockwave ring at edge ───────────────────────────────
        ctx.globalAlpha = alpha * 0.5;
        ctx.strokeStyle  = '#ffd700';
        ctx.shadowColor  = '#ffd700';
        ctx.shadowBlur   = 18;
        ctx.lineWidth    = 3 * (1 - this.phase * 0.6);
        ctx.beginPath();
        ctx.arc(0, 0, r, a1, a2);
        ctx.stroke();

        // ── Edge beams ───────────────────────────────────────────
        ctx.globalAlpha = alpha * 0.88;
        ctx.strokeStyle  = 'rgba(255,255,180,0.92)';
        ctx.shadowColor  = '#ffffff';
        ctx.shadowBlur   = 28;
        ctx.lineWidth    = 2.5;
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a1)*r, Math.sin(a1)*r); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a2)*r, Math.sin(a2)*r); ctx.stroke();

        // ── Central spine ray ────────────────────────────────────
        ctx.globalAlpha = alpha * 0.95;
        ctx.strokeStyle  = '#ffffff';
        ctx.shadowColor  = '#ffffa0';
        ctx.shadowBlur   = 34;
        ctx.lineWidth    = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(this.angle)*r*0.88, Math.sin(this.angle)*r*0.88);
        ctx.stroke();

        // ── Holy cross glyph at origin ───────────────────────────
        if (this.phase < 0.45) {
            const cf = (0.45 - this.phase) / 0.45;
            ctx.globalAlpha = cf * 0.9;
            ctx.fillStyle   = '#ffffff';
            ctx.shadowColor = '#ffffc0';
            ctx.shadowBlur  = 24;
            const cs = 11 + this.phase * 8;
            ctx.fillRect(-1.5, -cs, 3, cs*2);
            ctx.fillRect(-cs, -1.5, cs*2, 3);
        }

        ctx.restore();
    }
},

// ─────────────────────────────────────────────────────────────
//  LIGHTNING (Vorath) — Chain electricity.
//  FIXED: First target must be within maxRange (350px base).
//  Shows a dashed range-indicator ring when no target in range.
// ─────────────────────────────────────────────────────────────
'Lightning': class extends Weapon {
    constructor(p) {
        super(p, 'Lightning', 18, 0.88);
        this.chains     = 1;
        this.maxRange   = 350;   // max to FIRST target
        this.chainRange = 200;   // max between chained targets
        this.noTargetFlash = 0;  // fades in when no target in range
    }

    levelUp() {
        super.levelUp();
        if (this.level % 2 === 0) this.chains++;
        this.maxRange   = Math.min(500, this.maxRange   + 22);
        this.chainRange = Math.min(280, this.chainRange + 15);
    }

    update(dt) {
        if (this.noTargetFlash > 0) this.noTargetFlash -= dt * 2.5;

        this.timer -= dt;
        if (this.timer > 0 || !Game.enemies.length) return;

        this.timer = this.cooldown;
        const first = Game.getClosestEnemyInRange(this.player.x, this.player.y, this.maxRange);
        if (!first) {
            this.noTargetFlash = 1.0;  // show range ring
            return;
        }

        let hit = [first], last = first;
        for (let c = 0; c < this.chains; c++) {
            const next = Game.enemies
                .filter(e => !hit.includes(e) && M.dist(last.x, last.y, e.x, e.y) < this.chainRange)
                .sort((a, b) => M.dist(last.x, last.y, a.x, a.y) - M.dist(last.x, last.y, b.x, b.y))[0];
            if (!next) break;
            hit.push(next); last = next;
        }

        hit.forEach((e, i) => {
            e.takeDamage(this.dmg * Math.pow(0.8, i));
            e.flash = 0.2;
            AudioEngine.sfxLightning();
            Game.lightningBolts.push({
                fromX: i === 0 ? this.player.x : hit[i-1].x,
                fromY: i === 0 ? this.player.y : hit[i-1].y,
                toX: e.x, toY: e.y,
                life: 0.13, maxLife: 0.13
            });
            Game.spawnParticle(e.x, e.y, '#aaff44', 5);
        });

        Game.shake = Math.min(Game.shake + 3, 8);
    }

    draw(ctx, off) {
        if (this.noTargetFlash <= 0) return;
        const cx = canvas.width  / 2;
        const cy = canvas.height / 2;
        ctx.save();
        ctx.globalAlpha = this.noTargetFlash * 0.38;
        ctx.strokeStyle  = '#aaff00';
        ctx.shadowColor  = '#aaff00';
        ctx.shadowBlur   = 10;
        ctx.lineWidth    = 1.5;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(cx, cy, this.maxRange, 0, Math.PI*2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }
},

// ─────────────────────────────────────────────────────────────
//  CROSSBOW (Ryxa) — Piercing arrow with strict range cap.
//  FIXED: life = maxRange/SPEED so arrow disappears exactly
//  at maxRange distance. Targets enemies within that range only.
// ─────────────────────────────────────────────────────────────
'CrossBow': class extends Weapon {
    constructor(p) {
        super(p, 'CrossBow', 23, 1.55);
        this.maxRange = 480;
        this.SPEED    = 820;
    }

    levelUp() {
        super.levelUp();
        this.maxRange = Math.min(700, this.maxRange + 35);
    }

    _facingAngle() {
        const dx = this.player.dir ? this.player.dir.x : 0;
        const dy = this.player.dir ? this.player.dir.y : 0;
        if (Math.abs(dx) + Math.abs(dy) < 0.01) return 0;
        return Math.atan2(dy, dx);
    }

    update(dt) {
        this.timer -= dt;
        if (this.timer > 0) return;
        this.timer = this.cooldown;

        const target = Game.getClosestEnemyInRange(
            this.player.x, this.player.y, this.maxRange * 0.85
        );
        const ang = target
            ? M.angle(this.player.x, this.player.y, target.x, target.y)
            : this._facingAngle();

        Game.projectiles.push({
            type:      'arrow',
            x:         this.player.x,
            y:         this.player.y,
            vx:        Math.cos(ang) * this.SPEED,
            vy:        Math.sin(ang) * this.SPEED,
            r:         5,
            life:      this.maxRange / this.SPEED,  // exact range cap
            dmg:       this.dmg,
            ang,
            piercing:  true,
            pierced:   [],
            maxPierce: 2 + this.level,
            weaponLevel: this.level,
            color:     '#ffe066'
        });

        AudioEngine.playTone(420, 'triangle', 0.09, 0.05);
    }
},

// ─────────────────────────────────────────────────────────────
//  FLAME — Persistent fire zones
// ─────────────────────────────────────────────────────────────
'Flame': class extends Weapon {
    constructor(p) {
        super(p, 'Flame', 6, 0.48);
        this.flames = [];
    }
    update(dt) {
        this.timer -= dt;
        if (this.timer <= 0) {
            this.timer = this.cooldown;
            this.flames.push({
                x: this.player.x, y: this.player.y,
                r:       40 + this.level * 8,
                life:    2.5 + this.level * 0.4,
                maxLife: 2.5 + this.level * 0.4,
                petals:  Array.from({length:14}, (_, i) => ({
                    a: (Math.PI*2/14)*i + Math.random()*0.4,
                    s: 0.8 + Math.random()*1.2,
                    p: Math.random()*Math.PI*2
                }))
            });
        }
        for (let i = this.flames.length-1; i >= 0; i--) {
            const f = this.flames[i];
            f.life -= dt;
            if (f.life <= 0) { this.flames.splice(i,1); continue; }
            for (const e of Game.enemies) {
                if (M.dist(f.x, f.y, e.x, e.y) < e.r + f.r) {
                    e.hp   -= this.dmg * dt * 4;
                    e.flash = Math.max(e.flash, 0.04);
                }
            }
        }
    }
    draw(ctx, off) {
        const now = Date.now() * 0.003;
        this.flames.forEach(f => {
            const sx  = f.x - off.x + canvas.width  / 2;
            const sy  = f.y - off.y + canvas.height / 2;
            const rat = f.life / f.maxLife;
            ctx.save();
            ctx.globalAlpha = rat * 0.55;
            const g = ctx.createRadialGradient(sx,sy,0,sx,sy,f.r);
            g.addColorStop(0,   'rgba(255,230, 80,0.95)');
            g.addColorStop(0.4, 'rgba(255,110, 20,0.70)');
            g.addColorStop(0.75,'rgba(200, 30, 10,0.40)');
            g.addColorStop(1,   'rgba(180,  0,  0,0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(sx,sy,f.r,0,Math.PI*2); ctx.fill();
            // Flicker petals
            ctx.globalAlpha = rat * 0.38;
            f.petals.forEach(p => {
                const fa  = p.a + now * p.s;
                const pr  = f.r * (0.42 + Math.sin(now*3.5+p.p)*0.22);
                const px  = sx + Math.cos(fa)*pr;
                const py  = sy + Math.sin(fa)*pr;
                ctx.fillStyle   = `rgba(255,${80+Math.floor(Math.random()*80)},10,0.7)`;
                ctx.shadowColor = '#ff6600';
                ctx.shadowBlur  = 7;
                ctx.beginPath(); ctx.arc(px,py,5+Math.sin(now*4+p.p)*2.5,0,Math.PI*2); ctx.fill();
            });
            ctx.restore();
        });
    }
},


// ─────────────────────────────────────────────────────────────
//  THUNDER STORM — Evolution of Lightning + Armor
//  Chains through ALL enemies on screen. No range limit.
// ─────────────────────────────────────────────────────────────
'ThunderStorm': class extends Weapon {
    constructor(p) {
        super(p, 'ThunderStorm', 70, 1.0);
        this.chains = 10;
    }
    update(dt) {
        this.timer -= dt;
        if (this.timer > 0 || !Game.enemies.length) return;
        this.timer = this.cooldown;
        const targets = [...Game.enemies]
            .filter(e => !e.dead)
            .sort((a, b) => M.dist(Game.player.x, Game.player.y, a.x, a.y)
                          - M.dist(Game.player.x, Game.player.y, b.x, b.y))
            .slice(0, this.chains);
        let prev = { x: Game.player.x, y: Game.player.y };
        targets.forEach((e, i) => {
            const dmg = this.dmg * Math.pow(0.88, i);
            e.takeDamage(dmg);
            Game.spawnText(e.x, e.y, Math.floor(dmg), i === 0);
            Game.spawnParticle(e.x, e.y, '#aaff44', 5);
            Game.lightningBolts.push({ fromX:prev.x, fromY:prev.y, toX:e.x, toY:e.y, life:0.18, maxLife:0.18 });
            prev = e;
        });
        if (targets.length) { AudioEngine.sfxLightning(); Game.shake = Math.min(Game.shake + 6, 14); }
    }
},

// ─────────────────────────────────────────────────────────────
//  DEATH SCYTHE — Evolution of Whip + Vampire
//  360° scythe sweep + 3 HP lifesteal per enemy hit.
// ─────────────────────────────────────────────────────────────
'DeathScythe': class extends Weapon {
    constructor(p) {
        super(p, 'DeathScythe', 55, 1.4);
        this.range = 165; this.swingActive = false; this.phase = 0;
    }
    update(dt) {
        this.timer -= dt;
        if (this.swingActive) {
            this.phase += dt * 4.5;
            if (this.phase >= 1.0) { this.swingActive = false; this.phase = 0; return; }
            const hit = Game.enemies.filter(e =>
                !e.dead && M.dist(Game.player.x, Game.player.y, e.x, e.y) < this.range);
            hit.forEach(e => {
                if (e._scytheHit) return; e._scytheHit = true;
                setTimeout(() => { if (e) e._scytheHit = false; }, 300);
                const dmg = this.dmg;
                e.takeDamage(dmg);
                Game.spawnText(e.x, e.y, Math.floor(dmg), false);
                Game.player.hp = Math.min(Game.player.maxHp, Game.player.hp + 3);
                Game.spawnParticle(e.x, e.y, '#cc44ff', 5);
                const kb = calcKnockback(dmg, e.maxHp);
                const nd = M.norm(e.x - Game.player.x, e.y - Game.player.y);
                e.knockback.x += nd.x * kb; e.knockback.y += nd.y * kb;
            });
        } else if (this.timer <= 0) {
            this.timer = this.cooldown; this.swingActive = true; this.phase = 0;
        }
    }
    draw(ctx, off) {
        if (!this.swingActive) return;
        const cx = canvas.width / 2, cy = canvas.height / 2;
        const t  = this.phase;
        ctx.save();
        ctx.globalAlpha = (1 - t) * 0.45;
        ctx.strokeStyle = '#cc44ff'; ctx.lineWidth = 18 * (1 - t);
        ctx.shadowColor = '#aa00ff'; ctx.shadowBlur = 24;
        ctx.beginPath(); ctx.arc(cx, cy, this.range, 0, Math.PI * 2); ctx.stroke();
        // Spinning spectral arc
        ctx.globalAlpha = (1 - t) * 0.7;
        const sweep = Math.PI * 2 * t;
        ctx.beginPath(); ctx.arc(cx, cy, this.range * 0.85, sweep, sweep + Math.PI * 0.9);
        ctx.strokeStyle = '#ff88ff'; ctx.lineWidth = 6; ctx.stroke();
        ctx.restore();
    }
},

// ─────────────────────────────────────────────────────────────
//  HOLY NOVA — Evolution of HolyStrike + Bible
//  Full-screen radial blast with massive knockback.
// ─────────────────────────────────────────────────────────────
'HolyNova': class extends Weapon {
    constructor(p) {
        super(p, 'HolyNova', 85, 2.2);
        this.range = 300; this.blastActive = false; this.phase = 0; this._fired = false;
    }
    update(dt) {
        this.timer -= dt;
        if (this.blastActive) {
            this.phase += dt * 3.5;
            if (this.phase >= 1.0) { this.blastActive = false; this.phase = 0; this._fired = false; }
        } else if (this.timer <= 0) {
            this.timer = this.cooldown;
            this.blastActive = true; this.phase = 0; this._fired = false;
            AudioEngine.sfxLevel(); Game.shake = Math.min(Game.shake + 10, 18);
            Game.enemies.filter(e => !e.dead &&
                M.dist(Game.player.x, Game.player.y, e.x, e.y) < this.range
            ).forEach(e => {
                const dmg = this.dmg; e.takeDamage(dmg);
                Game.spawnText(e.x, e.y, Math.floor(dmg), true);
                Game.spawnParticle(e.x, e.y, '#ffe080', 8);
                const kb = calcKnockback(dmg, e.maxHp) * 1.8;
                const nd = M.norm(e.x - Game.player.x, e.y - Game.player.y);
                e.knockback.x += nd.x * kb; e.knockback.y += nd.y * kb;
            });
        }
    }
    draw(ctx, off) {
        if (!this.blastActive) return;
        const cx = canvas.width / 2, cy = canvas.height / 2;
        const t  = this.phase, r = this.range * (0.1 + t * 0.9);
        ctx.save();
        ctx.globalAlpha = (1 - t) * 0.6;
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grd.addColorStop(0,   'rgba(255,255,220,0.9)');
        grd.addColorStop(0.4, 'rgba(255,215,0,0.6)');
        grd.addColorStop(0.85,'rgba(200,100,20,0.2)');
        grd.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = (1 - t) * 0.9;
        ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3 + (1 - t) * 4;
        ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    }
},

}; // ─── end WeaponFactory ──────────────────────────────────────────


// ═══════════════════════════════════════════════════════════════
//  PROJECTILE DRAW ROUTER
//  Called from game.js draw loop for every active projectile.
// ═══════════════════════════════════════════════════════════════
function drawProjectile(ctx, p, off) {
    const sx = p.x - off.x + canvas.width  / 2;
    const sy = p.y - off.y + canvas.height / 2;
    // Frustum cull
    if (sx < -70 || sx > canvas.width+70 || sy < -70 || sy > canvas.height+70) return;

    ctx.save();

    switch (p.type) {

    // ── DAGGER — Kael's thrown knife (full silhouette) ───────────
    case 'dagger': {
        ctx.translate(sx, sy);
        ctx.rotate(p.ang);   // fixed: always points in direction of travel

        // Motion blur ghost
        ctx.globalAlpha = 0.2;
        ctx.fillStyle   = '#88bbff';
        ctx.beginPath();
        ctx.ellipse(-20, 0, 16, 4, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // ── Blade ─────────────────────────────────────────────────
        ctx.shadowColor = '#aaccff';
        ctx.shadowBlur  = CONFIG.IS_MOBILE ? 7 : 16;

        ctx.fillStyle = '#cce0ff';
        ctx.beginPath();
        ctx.moveTo( 22,  0);
        ctx.lineTo(  1, -3.5);
        ctx.lineTo( -6, -2.8);
        ctx.lineTo( -6,  2.8);
        ctx.lineTo(  1,  3.5);
        ctx.closePath();
        ctx.fill();

        // Blade highlight edge
        ctx.fillStyle = '#eef5ff';
        ctx.beginPath();
        ctx.moveTo(22,  0);
        ctx.lineTo( 1, -1.5);
        ctx.lineTo(-5, -0.8);
        ctx.lineTo(-5,  0.5);
        ctx.lineTo( 1,  0.8);
        ctx.closePath();
        ctx.fill();

        // Fuller (blood groove)
        ctx.globalAlpha = 0.4;
        ctx.fillStyle   = 'rgba(100,160,255,0.5)';
        ctx.fillRect(-5, -0.8, 20, 1.6);
        ctx.globalAlpha = 1;

        // Ricasso bevel
        ctx.fillStyle = '#99aacc';
        ctx.fillRect(-7, -3, 2, 6);

        // ── Cross-guard ───────────────────────────────────────────
        ctx.shadowColor = '#ddcc44';
        ctx.shadowBlur  = 5;
        ctx.fillStyle   = '#aa9933';
        ctx.fillRect(-10, -5.5, 4, 11);

        // ── Handle ────────────────────────────────────────────────
        ctx.shadowBlur = 0;
        ctx.fillStyle  = '#5c3018';
        // Main grip
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(-21, -3.2, 12, 6.4, 1.5);
        } else {
            ctx.rect(-21, -3.2, 12, 6.4);
        }
        ctx.fill();
        // Wrap lines
        ctx.strokeStyle = '#3a1a08';
        ctx.lineWidth   = 0.9;
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(-19 + i*2.8, -3.2);
            ctx.lineTo(-19 + i*2.8,  3.2);
            ctx.stroke();
        }

        // ── Pommel ────────────────────────────────────────────────
        ctx.fillStyle   = '#aa9933';
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur  = 4;
        ctx.beginPath();
        ctx.arc(-21, 0, 4.2, 0, Math.PI*2);
        ctx.fill();
        // Pommel gem
        ctx.fillStyle = '#224488';
        ctx.beginPath();
        ctx.arc(-21, 0, 2, 0, Math.PI*2);
        ctx.fill();
        break;
    }

    // ── ARROW — Ryxa's crossbow bolt ─────────────────────────────
    case 'arrow': {
        ctx.translate(sx, sy);
        ctx.rotate(p.ang);

        ctx.shadowColor = '#ffe090';
        ctx.shadowBlur  = 10;

        // ── Shaft ─────────────────────────────────────────────────
        ctx.fillStyle = '#8b5e1a';
        ctx.fillRect(-24, -1.5, 28, 3);
        // Highlight
        ctx.fillStyle   = 'rgba(255,210,130,0.4)';
        ctx.fillRect(-22, -1.5, 26, 1);

        // ── Broadhead ─────────────────────────────────────────────
        ctx.fillStyle   = '#e0e0e0';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur  = 8;
        ctx.beginPath();
        ctx.moveTo( 10,  0);
        ctx.lineTo( -2, -5);
        ctx.lineTo(  1,  0);
        ctx.lineTo( -2,  5);
        ctx.closePath();
        ctx.fill();
        // Edge
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-1, -2.5);
        ctx.lineTo( 1,  0);
        ctx.closePath();
        ctx.fill();

        // ── Nock ──────────────────────────────────────────────────
        ctx.fillStyle  = '#5c3018';
        ctx.shadowBlur = 0;
        ctx.fillRect(-26, -2, 3, 4);

        // ── Fletching (3-vane) ────────────────────────────────────
        const vaneColors = ['rgba(200,60,60,0.8)','rgba(200,60,60,0.5)','rgba(240,200,70,0.75)'];
        vaneColors.forEach((vc, vi) => {
            ctx.fillStyle   = vc;
            ctx.globalAlpha = 0.85;
            ctx.beginPath();
            ctx.moveTo(-16 + vi*2,  0);
            ctx.lineTo(-24,        -8 + vi);
            ctx.lineTo(-20 + vi,    0);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-16 + vi*2,  0);
            ctx.lineTo(-24,         8 - vi);
            ctx.lineTo(-20 + vi,    0);
            ctx.closePath();
            ctx.fill();
        });
        ctx.globalAlpha = 1;
        break;
    }

    // ── BOLT — Magic wand orb ─────────────────────────────────────
    case 'bolt': {
        const r = p.r || 6;
        // Outer glow
        ctx.globalAlpha = 0.35;
        ctx.fillStyle   = p.color || '#4466ff';
        ctx.shadowColor = p.color || '#4466ff';
        ctx.shadowBlur  = CONFIG.IS_MOBILE ? 10 : 22;
        ctx.beginPath(); ctx.arc(sx, sy, r * 2, 0, Math.PI*2); ctx.fill();
        // Main orb
        ctx.globalAlpha = 1;
        ctx.fillStyle   = p.color || '#4466ff';
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2); ctx.fill();
        // Core
        ctx.fillStyle   = '#ffffff';
        ctx.shadowBlur  = 0;
        ctx.globalAlpha = 0.65;
        ctx.beginPath(); ctx.arc(sx, sy, r*0.38, 0, Math.PI*2); ctx.fill();
        break;
    }

    // Whip is handled entirely by Weapon.draw() — nothing here
    case 'whip': break;

    // ── Generic fallback ──────────────────────────────────────────
    default: {
        ctx.shadowColor = p.color || '#ffdd44';
        ctx.shadowBlur  = 14;
        ctx.fillStyle   = p.color || '#ffe066';
        ctx.beginPath(); ctx.arc(sx, sy, p.r||6, 0, Math.PI*2); ctx.fill();
        break;
    }

    }
    ctx.restore();
}
