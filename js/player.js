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

        // Kael ultra timers
        if (this.kaelUltraDmgReduct > 0) this.kaelUltraDmgReduct -= dt;
        if (this.kaelUltraAttack    > 0) this.kaelUltraAttack    -= dt;
        if (this.kaelUltraSpeed     > 0) this.kaelUltraSpeed     -= dt;

        // Movement
        const speedMult = (this.activeBuffs.speed > 0 ? 1.9 : 1) * (this.kaelUltraSpeed > 0 ? 1.1 : 1);
        if (input.x !== 0 || input.y !== 0) {
            this.trail.unshift({ x: this.x, y: this.y, t: 0.3 });
            if (this.trail.length > 12) this.trail.pop();
            this.x += input.x * this.speed * speedMult * dt;
            this.y += input.y * this.speed * speedMult * dt;
            // Hard wall at arena edge
            if (typeof Game !== 'undefined' && Game.bossArena) {
                const ar   = Game.bossArena;
                const dx   = this.x - ar.x, dy = this.y - ar.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist > ar.r - this.r - 4) {
                    const push = ar.r - this.r - 4;
                    this.x = ar.x + (dx / dist) * push;
                    this.y = ar.y + (dy / dist) * push;
                }
            }
            this.dir.x = input.x; this.dir.y = input.y;
            this.moving = true;
        } else { this.moving = false; }

        // Boss fog damage — always runs (not just when moving)
        if (typeof Game !== 'undefined' && Game.bossArena) {
            const ar   = Game.bossArena;
            const dx   = this.x - ar.x, dy = this.y - ar.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const fogStart = ar.r * 0.82;
            if (dist > fogStart) {
                const depth = Math.min(1, (dist - fogStart) / (ar.r * 0.18));
                // Gentle: 0.5 HP/s at edge → 4 HP/s deep in fog
                const dmgRate = (0.5 + depth * depth * 3.5) * dt;
                this.hp = Math.max(0, this.hp - dmgRate);
                Game._fogDmgFlash = Math.min(0.7, (Game._fogDmgFlash || 0) + depth * 0.04);
            }
        }

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

        // ── Characteristic weapon visual ────────────────────────
        this._drawWeaponVisual(ctx, off);

        ctx.restore();
    }

    _drawWeaponVisual(ctx, off) {
        const t   = Date.now() * 0.001;
        const id  = this.charData.id;
        const r   = this.r;
        // facing direction angle (for aiming weapons)
        const faceAng = (this.dir && (Math.abs(this.dir.x) + Math.abs(this.dir.y)) > 0.01)
            ? Math.atan2(this.dir.y, this.dir.x) : 0;

        ctx.save();

        if (id === 'warrior') {
            // ── ALARIC — Whip ─────────────────────────────────────
            // Swinging leather whip on the right side
            const swingAng = faceAng + Math.sin(t * 4) * 0.6;
            const whipLen  = r * 2.8;
            ctx.strokeStyle = '#8B4513';
            ctx.lineWidth   = 3;
            ctx.shadowColor = '#cc6622'; ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.moveTo(Math.cos(faceAng) * r, Math.sin(faceAng) * r);
            // bezier whip curve
            const cx1 = Math.cos(swingAng + 0.4) * whipLen * 0.5;
            const cy1 = Math.sin(swingAng + 0.4) * whipLen * 0.5;
            const tx2 = Math.cos(swingAng) * whipLen;
            const ty2 = Math.sin(swingAng) * whipLen;
            ctx.quadraticCurveTo(cx1, cy1, tx2, ty2);
            ctx.stroke();
            // tip spark
            ctx.globalAlpha = 0.7 + Math.sin(t * 8) * 0.3;
            ctx.fillStyle   = '#ff8822';
            ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.arc(tx2, ty2, 3, 0, Math.PI*2); ctx.fill();

        } else if (id === 'mage') {
            // ── ZALE — Magic Wand ─────────────────────────────────
            // Staff held in front, orbiting arcane orb at tip
            const staffAng = faceAng + Math.PI * 0.15;
            const staffLen = r * 2.2;
            const tipX = Math.cos(staffAng) * staffLen;
            const tipY = Math.sin(staffAng) * staffLen;
            // Staff body
            ctx.strokeStyle = '#8855cc';
            ctx.lineWidth   = 3.5;
            ctx.shadowColor = '#aa55ff'; ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(Math.cos(staffAng + Math.PI) * r * 0.5, Math.sin(staffAng + Math.PI) * r * 0.5);
            ctx.lineTo(tipX, tipY);
            ctx.stroke();
            // Orbiting arcane orb at tip
            const orbAng = t * 3;
            const orbR   = 5;
            ctx.globalAlpha = 0.85 + Math.sin(t * 5) * 0.15;
            ctx.fillStyle   = '#cc88ff';
            ctx.shadowColor = '#ff88ff'; ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.arc(tipX + Math.cos(orbAng) * 6, tipY + Math.sin(orbAng) * 6, orbR, 0, Math.PI*2);
            ctx.fill();
            // Star at staff tip
            ctx.fillStyle = '#ffffff'; ctx.shadowBlur = 20;
            ctx.beginPath(); ctx.arc(tipX, tipY, 3.5, 0, Math.PI*2); ctx.fill();

        } else if (id === 'rogue') {
            // ── KAEL — Knives ─────────────────────────────────────
            // Two knives held on each side, spinning on attack
            const spinRate = this.moving ? t * 6 : t * 1.5;
            for (let side = -1; side <= 1; side += 2) {
                const kAng  = faceAng + side * (Math.PI * 0.35) + Math.sin(t * 5) * 0.15;
                const kDist = r * 1.4;
                const kx    = Math.cos(kAng) * kDist;
                const ky    = Math.sin(kAng) * kDist;
                ctx.save();
                ctx.translate(kx, ky);
                ctx.rotate(kAng + spinRate * 0.5);
                ctx.strokeStyle = '#ccddee';
                ctx.lineWidth   = 2.5;
                ctx.shadowColor = '#88ccff'; ctx.shadowBlur = 7;
                ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.stroke();
                // blade glint
                ctx.globalAlpha = 0.5 + Math.sin(t * 7 + side) * 0.4;
                ctx.fillStyle   = '#ffffff';
                ctx.beginPath(); ctx.arc(5, 0, 2, 0, Math.PI*2); ctx.fill();
                ctx.restore();
            }

        } else if (id === 'cleric') {
            // ── ELORA — Holy Strike ───────────────────────────────
            // Glowing mace/scepter with holy light at tip
            const maceAng = faceAng - Math.PI * 0.2;
            const maceLen = r * 2.0;
            const mx = Math.cos(maceAng) * maceLen;
            const my = Math.sin(maceAng) * maceLen;
            // Handle
            ctx.strokeStyle = '#aa8844';
            ctx.lineWidth   = 4;
            ctx.shadowColor = '#ffdd88'; ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.moveTo(Math.cos(maceAng + Math.PI) * r * 0.5, Math.sin(maceAng + Math.PI) * r * 0.5);
            ctx.lineTo(mx, my);
            ctx.stroke();
            // Holy orb at tip — pulsing
            const pulse = 0.7 + Math.sin(t * 3) * 0.3;
            ctx.globalAlpha = pulse;
            ctx.fillStyle   = '#ffffaa';
            ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 22 * pulse;
            ctx.beginPath(); ctx.arc(mx, my, 6 * pulse, 0, Math.PI*2); ctx.fill();
            // Cross glow
            ctx.globalAlpha = 0.4 * pulse;
            ctx.fillStyle   = '#ffffff'; ctx.shadowBlur = 14;
            ctx.beginPath(); ctx.arc(mx, my, 10 * pulse, 0, Math.PI*2); ctx.fill();

        } else if (id === 'hunter') {
            // ── RYXA — Crossbow ───────────────────────────────────
            // Crossbow aimed forward, arrow nocked and ready
            const bowAng = faceAng;
            const bowLen = r * 1.8;
            const bx = Math.cos(bowAng) * bowLen;
            const by = Math.sin(bowAng) * bowLen;
            ctx.save();
            ctx.translate(bx, by);
            ctx.rotate(bowAng);
            // Stock
            ctx.strokeStyle = '#774422';
            ctx.lineWidth   = 3;
            ctx.shadowColor = '#aa6633'; ctx.shadowBlur = 4;
            ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.stroke();
            // Limbs
            ctx.strokeStyle = '#553311'; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-8, -9); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-8,  9); ctx.stroke();
            // String
            ctx.strokeStyle = '#ccbbaa'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-8, -9); ctx.lineTo(-6, 0); ctx.lineTo(-8, 9); ctx.stroke();
            // Arrow nocked — bobbing slightly
            const arrowPulse = Math.sin(t * 2.5) * 0.5;
            ctx.fillStyle   = '#cc9944';
            ctx.shadowColor = '#ffcc66'; ctx.shadowBlur = 5;
            ctx.beginPath(); ctx.rect(0, -1.5, 14, 3); ctx.fill();
            // Arrowhead
            ctx.fillStyle = '#dddddd';
            ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(10, -4); ctx.lineTo(10, 4); ctx.closePath(); ctx.fill();
            ctx.restore();

        } else if (id === 'shaman') {
            // ── VORATH — Lightning Staff ──────────────────────────
            // Tall staff with crackling lightning orb at top
            const stAng = faceAng + Math.PI * 0.1;
            const stLen = r * 2.5;
            const stx = Math.cos(stAng) * stLen;
            const sty = Math.sin(stAng) * stLen;
            // Staff
            ctx.strokeStyle = '#4a3a6a';
            ctx.lineWidth   = 4;
            ctx.shadowColor = '#8866cc'; ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.moveTo(Math.cos(stAng + Math.PI) * r * 0.4, Math.sin(stAng + Math.PI) * r * 0.4);
            ctx.lineTo(stx, sty);
            ctx.stroke();
            // Lightning orb — pulsing electric
            const ltPulse = 0.6 + Math.sin(t * 7) * 0.4;
            ctx.globalAlpha = ltPulse;
            ctx.fillStyle   = '#88ddff';
            ctx.shadowColor = '#44aaff'; ctx.shadowBlur = 18 * ltPulse;
            ctx.beginPath(); ctx.arc(stx, sty, 6, 0, Math.PI*2); ctx.fill();
            // Lightning bolts radiating from orb
            ctx.globalAlpha = 0.7 * ltPulse;
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.shadowBlur = 8;
            for (let li = 0; li < 4; li++) {
                const la = t * 5 + li * Math.PI * 0.5;
                ctx.beginPath();
                ctx.moveTo(stx, sty);
                ctx.lineTo(stx + Math.cos(la) * 8 + Math.sin(t*10)*3,
                           sty + Math.sin(la) * 8 + Math.cos(t*10)*3);
                ctx.stroke();
            }
        }

        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        ctx.restore();
    }
}
