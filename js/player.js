// ── player.js ── Player class ──
'use strict';

class Player extends Entity {
    constructor(charData) {
        super(0, 0, 15, charData.hp, '#fff');
        this.charData    = charData;
        this.baseSpeed   = charData.speed;
        this.speed       = this.baseSpeed;
        this.pickupRange = 100;
        this.xp = 0; this.nextXp = 80; this.level = 1;
        this.weapons     = [];
        this.stats       = { damageMult: 1, reduction: 0, regen: 0, vampire: 0 };
        this.iframe      = 0;
        this.dir         = { x: 0, y: 1 };
        this.moving      = false;
        this.activeBuffs = { shield: 0, speed: 0, damage: 0 };
        this.trail       = [];
        this.vampireKillTracker = 0;
        this.addWeapon(charData.weapon);
    }

    addWeapon(id) {
        const existing = this.weapons.find(w => w.id === id);
        if (existing) {
            existing.levelUp();
            this._checkEvolutions(); // may trigger weapon evolution
        } else {
            const cls = WeaponFactory[id];
            if (cls) this.weapons.push(new cls(this));
        }
    }

    applyStatUpgrade(id) {
        this._unlockedPassives = this._unlockedPassives || new Set();
        switch(id) {
            case 'Boots':   this.speed *= 1.15;   break;
            case 'Spinach': {
                // Diminishing returns: each Spinach is worth less than the last
                // 1st:+0.22  2nd:+0.17  3rd:+0.13  4th:+0.10  5th:+0.09
                const accumulated = this.stats.damageMult - 1.0;
                const bonus = 0.22 / (1 + accumulated * 0.5);
                this.stats.damageMult += bonus;
                break;
            }
            case 'Armor':   this.stats.reduction  += 3;     break;
            case 'Magnet':  this.pickupRange *= 1.35;       break;
            case 'Regen':   this.stats.regen  += 0.4;       break;
            case 'Ultra':   Game.upgradeBurst();            break;
            case 'Vampire': this.stats.vampire += 1;        break;
        }
        this._unlockedPassives.add(id);
        this._checkEvolutions();
    }

    // ── Weapon Evolution check ─────────────────────────────────────
    // Called after every weapon level-up or passive unlock.
    // Requires: weapon at max level (8) + specific passive unlocked.
    _checkEvolutions() {
        this._unlockedPassives = this._unlockedPassives || new Set();
        if (typeof EVOLUTION_TABLE === 'undefined') return;
        for (const evo of EVOLUTION_TABLE) {
            const weapon      = this.weapons.find(w => w.id === evo.weapon);
            const atMaxLevel  = weapon && weapon.level >= 8;
            const hasPassive  = this._unlockedPassives.has(evo.passive);
            const alreadyDone = this.weapons.find(w => w.id === evo.result);
            if (atMaxLevel && hasPassive && !alreadyDone) {
                const idx = this.weapons.indexOf(weapon);
                const cls = WeaponFactory[evo.result];
                if (cls) {
                    this.weapons[idx] = new cls(this);
                    if (typeof Game !== 'undefined')
                        Game.showEvolutionBanner(UPGRADES_DB[evo.result]);
                }
            }
        }
    }

    update(dt, input) {
        if (this.iframe > 0) this.iframe -= dt;

        // HP regen
        if (this.stats.regen > 0)
            this.hp = Math.min(this.maxHp, this.hp + this.stats.regen * dt);

        // Buff timers
        for (const k of Object.keys(this.activeBuffs))
            if (this.activeBuffs[k] > 0) this.activeBuffs[k] -= dt;

        // Movement
        const speedMult = this.activeBuffs.speed > 0 ? 1.9 : 1;
        if (input.x !== 0 || input.y !== 0) {
            this.trail.unshift({ x: this.x, y: this.y, t: 0.3 });
            if (this.trail.length > 12) this.trail.pop();
            this.x += input.x * this.speed * speedMult * dt;
            this.y += input.y * this.speed * speedMult * dt;
            this.dir.x = input.x; this.dir.y = input.y;
            this.moving = true;
        } else { this.moving = false; }

        // Trail decay
        for (let i = this.trail.length - 1; i >= 0; i--) {
            this.trail[i].t -= dt * 2;
            if (this.trail[i].t <= 0) this.trail.splice(i, 1);
        }

        this.weapons.forEach(w => w.update(dt));
    }

    draw(ctx, off) {
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);

        // Trail — blue-white spirit trail
        const tc = this.activeBuffs.speed > 0 ? '#44ffaa' : this.activeBuffs.damage > 0 ? '#ff8844' : '#88aaff';
        for (let i = 0; i < this.trail.length; i++) {
            const tp    = this.trail[i];
            const alpha = tp.t / 0.3 * (1 - i / this.trail.length) * 0.35;
            const sx    = tp.x - off.x;
            const sy    = tp.y - off.y;
            ctx.globalAlpha = Math.max(0, alpha);
            ctx.fillStyle   = tc;
            ctx.beginPath();
            ctx.arc(sx, sy, this.r * (0.5 - i * 0.04), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Iframe flicker
        if (this.iframe > 0 && this.iframe < 5 && Math.floor(Date.now() / 55) % 2 === 0)
            ctx.globalAlpha = 0.3;

        // Invincible mega-glow (rune effect when iframe > 4)
        if (this.iframe > 4) {
            const t = Date.now() * 0.003;
            ctx.globalAlpha = 0.3 + Math.sin(t * 6) * 0.15;
            ctx.fillStyle = '#aa66ff';
            ctx.shadowColor = '#aa66ff'; ctx.shadowBlur = 40;
            ctx.beginPath(); ctx.arc(0, 0, this.r * 2.8, 0, Math.PI*2); ctx.fill();
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        }

        // Shield glow
        if (this.activeBuffs.shield > 0) {
            ctx.strokeStyle = 'rgba(80,180,255,0.8)'; ctx.lineWidth = 4;
            ctx.shadowColor = '#4af'; ctx.shadowBlur = 22;
            ctx.beginPath(); ctx.arc(0, 0, this.r + 10, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
        }
        // Damage buff glow (berserk rune)
        if (this.activeBuffs.damage > 0) {
            ctx.strokeStyle = 'rgba(255,200,0,0.8)'; ctx.lineWidth = 3;
            ctx.shadowColor = '#ffdd00'; ctx.shadowBlur = 18;
            ctx.beginPath(); ctx.arc(0, 0, this.r + 6, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
        }
        // Speed buff glow
        if (this.activeBuffs.speed > 0) {
            ctx.strokeStyle = 'rgba(68,255,140,0.7)'; ctx.lineWidth = 2;
            ctx.shadowColor = '#4fa'; ctx.shadowBlur = 12;
            ctx.beginPath(); ctx.arc(0, 0, this.r + 8, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Body — bright sorcerer core
        ctx.globalAlpha = 1;
        ctx.fillStyle   = '#ddeeff';
        ctx.shadowColor = '#8899ff'; ctx.shadowBlur = CONFIG.IS_MOBILE ? 10 : 22;
        ctx.beginPath(); ctx.arc(0, 0, this.r, 0, Math.PI * 2); ctx.fill();
        // Inner highlight
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(-this.r*0.25, -this.r*0.25, this.r*0.35, 0, Math.PI*2); ctx.fill();

        // Character icon
        ctx.font = (this.r * 0.9) + 'px serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillText(this.charData.icon, 0, 1);

        ctx.restore();
    }
}
