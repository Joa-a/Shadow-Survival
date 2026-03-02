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
        if (existing) { existing.levelUp(); }
        else {
            const cls = WeaponFactory[id];
            if (cls) this.weapons.push(new cls(this));
        }
    }

    applyStatUpgrade(id) {
        switch(id) {
            case 'Boots':   this.speed *= 1.15;             break;
            case 'Spinach': this.stats.damageMult += 0.22;  break;
            case 'Armor':   this.stats.reduction  += 3;     break;
            case 'Magnet':  this.pickupRange *= 1.35;       break;
            case 'Regen':   this.stats.regen  += 0.4;       break;
            case 'Ultra':   Game.upgradeBurst();            break;
            case 'Vampire': this.stats.vampire += 1;        break;
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

        // Trail
        for (let i = 0; i < this.trail.length; i++) {
            const tp    = this.trail[i];
            const alpha = tp.t / 0.3 * (1 - i / this.trail.length) * 0.4;
            const sx    = tp.x - off.x;
            const sy    = tp.y - off.y;
            ctx.globalAlpha = Math.max(0, alpha);
            ctx.fillStyle   = '#ff2255';
            ctx.beginPath();
            ctx.arc(sx, sy, this.r * (0.5 - i * 0.04), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Iframe flicker
        if (this.iframe > 0 && Math.floor(Date.now() / 55) % 2 === 0)
            ctx.globalAlpha = 0.3;

        // Shield glow
        if (this.activeBuffs.shield > 0) {
            ctx.strokeStyle = 'rgba(80,180,255,0.8)'; ctx.lineWidth = 4;
            ctx.shadowColor = '#4af'; ctx.shadowBlur = 22;
            ctx.beginPath(); ctx.arc(0, 0, this.r + 10, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
        }
        // Damage buff glow
        if (this.activeBuffs.damage > 0) {
            ctx.strokeStyle = 'rgba(255,80,80,0.7)'; ctx.lineWidth = 3;
            ctx.shadowColor = '#f55'; ctx.shadowBlur = 14;
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

        // Body
        ctx.globalAlpha = 1;
        ctx.fillStyle   = '#fff';
        ctx.shadowColor = '#ff2255'; ctx.shadowBlur = CONFIG.IS_MOBILE ? 8 : 18;
        ctx.beginPath(); ctx.arc(0, 0, this.r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // Character icon (small)
        ctx.font = `${this.r * 0.9}px serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillText(this.charData.icon, 0, 1);

        ctx.restore();
    }
}
