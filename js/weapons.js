// ── weapons.js ── Weapon base class + all weapon implementations ──
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
}

// ─── WEAPON FACTORY ────────────────────────────────────────────
const WeaponFactory = {

    // ── Whip ──
    'Whip': class extends Weapon {
        constructor(p) { super(p, 'Whip', 13, 1.35); }
        update(dt) {
            this.timer -= dt;
            if (this.timer <= 0) {
                this.timer = this.cooldown;
                const dir = this.player.dir.x >= 0 ? 1 : -1;
                Game.projectiles.push({
                    type:'whip', x:this.player.x, y:this.player.y,
                    w:160+this.level*20, h:40, dir, life:0.22, dmg:this.dmg
                });
            }
        }
    },

    // ── Magic Wand ──
    'MagicWand': class extends Weapon {
        constructor(p) { super(p, 'MagicWand', 15, 0.95); }
        update(dt) {
            this.timer -= dt;
            if (this.timer <= 0 && Game.enemies.length > 0) {
                this.timer = this.cooldown;
                const sorted = [...Game.enemies].sort((a,b) =>
                    M.dist(this.player.x,this.player.y,a.x,a.y) -
                    M.dist(this.player.x,this.player.y,b.x,b.y)
                );
                const n = Math.min(this.level, sorted.length);
                for (let i=0; i<n; i++) {
                    const ang = M.angle(this.player.x,this.player.y,sorted[i].x,sorted[i].y);
                    Game.projectiles.push({
                        type:'bolt', x:this.player.x, y:this.player.y,
                        vx:Math.cos(ang)*540, vy:Math.sin(ang)*540,
                        r:6, life:2, dmg:this.dmg, color:'#4466ff'
                    });
                }
            }
        }
    },

    // ── Knife ──
    'Knife': class extends Weapon {
        constructor(p) { super(p, 'Knife', 11, 0.55); }
        update(dt) {
            this.timer -= dt;
            if (this.timer <= 0) {
                this.timer = this.cooldown;
                const target = Game.getClosestEnemy(this.player.x, this.player.y);
                const ang = target
                    ? M.angle(this.player.x, this.player.y, target.x, target.y)
                    : M.angle(0, 0, this.player.dir.x, this.player.dir.y);
                for (let k=0; k<this.level; k++) {
                    const spread = (k - (this.level-1)/2) * 0.16;
                    Game.projectiles.push({
                        type:'knife', x:this.player.x, y:this.player.y,
                        vx:Math.cos(ang+spread)*720, vy:Math.sin(ang+spread)*720,
                        r:5, life:1.5, dmg:this.dmg, ang:ang+spread
                    });
                }
            }
        }
    },

    // ── Bible (orbiting orbs) ──
    'Bible': class extends Weapon {
        constructor(p) { super(p, 'Bible', 9, 3); this.angle = 0; this.orbitR = 90; }
        update(dt) {
            this.angle  += dt * (3.8 + this.level * 0.35);
            this.orbitR  = 90 + this.level * 10;
            const orbs   = this.level >= 3 ? 3 : (this.level >= 2 ? 2 : 1);
            for (let o=0; o<orbs; o++) {
                const a  = this.angle + (Math.PI*2/orbs)*o;
                const bx = this.player.x + Math.cos(a)*this.orbitR;
                const by = this.player.y + Math.sin(a)*this.orbitR;
                Game.enemies.forEach(e => {
                    if (M.dist(bx,by,e.x,e.y) < e.r+20) {
                        e.takeDamage(this.dmg*dt*5);
                        e.knockback.x = Math.cos(a)*200;
                        e.knockback.y = Math.sin(a)*200;
                    }
                });
            }
        }
        draw(ctx, off) {
            const orbs = this.level >= 3 ? 3 : (this.level >= 2 ? 2 : 1);
            for (let o=0; o<orbs; o++) {
                const a  = this.angle + (Math.PI*2/orbs)*o;
                const sx = (this.player.x + Math.cos(a)*this.orbitR) - off.x + canvas.width/2;
                const sy = (this.player.y + Math.sin(a)*this.orbitR) - off.y + canvas.height/2;
                ctx.save();
                ctx.fillStyle   = '#eeddff';
                ctx.shadowColor = '#aa88ff'; ctx.shadowBlur = CONFIG.IS_MOBILE ? 5 : 14;
                ctx.fillRect(sx-9, sy-13, 18, 26);
                ctx.restore();
            }
        }
    },

    // ── Garlic (damage aura) ──
    'Garlic': class extends Weapon {
        constructor(p) { super(p, 'Garlic', 4, 0.1); this.auraR = 65; }
        update(dt) {
            this.auraR = 65 + this.level * 12;
            if (Math.random() > 0.5) return;
            Game.enemies.forEach(e => {
                if (M.dist(this.player.x,this.player.y,e.x,e.y) < e.r+this.auraR) {
                    e.hp   -= this.dmg * dt * 6;
                    e.flash = Math.max(e.flash, 0.05);
                }
            });
        }
        draw(ctx, off) {
            ctx.save();
            const pulse = 0.1 + Math.sin(Date.now()*0.004)*0.06;
            ctx.globalAlpha  = pulse;
            ctx.strokeStyle  = 'rgba(140,255,140,0.8)'; ctx.lineWidth = 2;
            ctx.shadowColor  = '#88ff88'; ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.arc(canvas.width/2, canvas.height/2, this.auraR, 0, Math.PI*2);
            ctx.stroke();
            ctx.restore();
        }
    },

    // ── Lightning (chain) ──
    'Lightning': class extends Weapon {
        constructor(p) { super(p, 'Lightning', 18, 0.9); this.chains = 1; }
        levelUp() { super.levelUp(); if (this.level % 2 === 0) this.chains++; }
        update(dt) {
            this.timer -= dt;
            if (this.timer <= 0 && Game.enemies.length > 0) {
                this.timer = this.cooldown;
                const target = Game.getClosestEnemy(this.player.x, this.player.y);
                if (!target) return;
                let hit = [target], last = target;
                for (let c=0; c<this.chains; c++) {
                    const next = Game.enemies
                        .filter(e => !hit.includes(e) && M.dist(last.x,last.y,e.x,e.y)<180)
                        .sort((a,b)=>M.dist(last.x,last.y,a.x,a.y)-M.dist(last.x,last.y,b.x,b.y))[0];
                    if (!next) break;
                    hit.push(next); last = next;
                }
                hit.forEach((e, i) => {
                    e.takeDamage(this.dmg * (1 - i * 0.2));
                    e.flash = 0.2;
                    AudioEngine.sfxLightning();
                    Game.lightningBolts.push({
                        fromX: i === 0 ? this.player.x : hit[i-1].x,
                        fromY: i === 0 ? this.player.y : hit[i-1].y,
                        toX: e.x, toY: e.y,
                        life: 0.1, maxLife: 0.1
                    });
                    Game.spawnParticle(e.x, e.y, '#aaff00', 5);
                });
                Game.shake = Math.min(Game.shake+3, 8);
            }
        }
    },

    // ── CrossBow (piercing arrow) ──
    'CrossBow': class extends Weapon {
        constructor(p) { super(p, 'CrossBow', 22, 1.6); }
        update(dt) {
            this.timer -= dt;
            if (this.timer <= 0) {
                this.timer = this.cooldown;
                const target = Game.getClosestEnemy(this.player.x, this.player.y);
                const ang = target
                    ? M.angle(this.player.x,this.player.y,target.x,target.y)
                    : M.angle(0,0,this.player.dir.x,this.player.dir.y);
                Game.projectiles.push({
                    type:'arrow', x:this.player.x, y:this.player.y,
                    vx:Math.cos(ang)*820, vy:Math.sin(ang)*820,
                    r:5, life:2.5, dmg:this.dmg, ang,
                    piercing:true, pierced:[], color:'#ffe066'
                });
            }
        }
    },

    // ── Flame (fire zone) ──
    'Flame': class extends Weapon {
        constructor(p) { super(p, 'Flame', 6, 0.5); this.flames = []; }
        update(dt) {
            this.timer -= dt;
            if (this.timer <= 0) {
                this.timer = this.cooldown;
                this.flames.push({
                    x:this.player.x, y:this.player.y,
                    r:40+this.level*8,
                    life:2.5+this.level*0.4, maxLife:2.5+this.level*0.4
                });
            }
            for (let i=this.flames.length-1; i>=0; i--) {
                const f = this.flames[i];
                f.life -= dt;
                if (f.life <= 0) { this.flames.splice(i,1); continue; }
                Game.enemies.forEach(e => {
                    if (M.dist(f.x,f.y,e.x,e.y) < e.r+f.r) {
                        e.hp   -= this.dmg * dt * 4;
                        e.flash = Math.max(e.flash, 0.04);
                    }
                });
            }
        }
        draw(ctx, off) {
            this.flames.forEach(f => {
                const sx    = f.x - off.x + canvas.width/2;
                const sy    = f.y - off.y + canvas.height/2;
                const alpha = (f.life/f.maxLife)*0.5;
                ctx.save();
                ctx.globalAlpha = alpha;
                const grad = ctx.createRadialGradient(sx,sy,0,sx,sy,f.r);
                grad.addColorStop(0,   'rgba(255,200,50,0.9)');
                grad.addColorStop(0.5, 'rgba(255,80,20,0.6)');
                grad.addColorStop(1,   'rgba(255,0,0,0)');
                ctx.fillStyle = grad;
                ctx.beginPath(); ctx.arc(sx,sy,f.r,0,Math.PI*2); ctx.fill();
                ctx.restore();
            });
        }
    },
};
