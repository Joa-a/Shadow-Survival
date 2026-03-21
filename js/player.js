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
        // Kael ultra buff timers — initialized to 0 so comparisons are safe
        this.kaelUltraDmgReduct = 0;
        this.kaelUltraAttack    = 0;
        this.kaelUltraSpeed     = 0;
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
        this._statCounts       = this._statCounts || {};
        switch(id) {
            case 'Boots':   this.speed *= 1.15;   break;
            case 'Spinach': {
                // #7: Flat +12% per stack, max 5 stacks
                const spinCount = this._statCounts['Spinach'] || 0;
                if (spinCount < 5) {
                    this.stats.damageMult += 0.12;
                    this._statCounts['Spinach'] = spinCount + 1;
                }
                break;
            }
            case 'Armor':   this.stats.reduction  += 3;     break;
            case 'Magnet': {
                // #8: +20px per stack, max 5 stacks → base 100 + 100 = 200 (+100%)
                const magCount = this._statCounts['Magnet'] || 0;
                if (magCount < 5) {
                    this.pickupRange += 20;
                    this._statCounts['Magnet'] = magCount + 1;
                }
                break;
            }
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
    // Returns array of evolutions the player can trigger right now
    getPendingEvolutions() {
        this._unlockedPassives   = this._unlockedPassives   || new Set();
        this._evolvedBaseWeapons = this._evolvedBaseWeapons || new Set();
        if (typeof EVOLUTION_TABLE === 'undefined') return [];
        const pending = [];
        for (const evo of EVOLUTION_TABLE) {
            const weapon      = this.weapons.find(w => w.id === evo.weapon);
            const atMaxLevel  = weapon && weapon.level >= 8;
            const hasPassive  = this._unlockedPassives.has(evo.passive);
            const alreadyDone = this.weapons.find(w => w.id === evo.result)
                             || this._evolvedBaseWeapons.has(evo.weapon);
            if (atMaxLevel && hasPassive && !alreadyDone) pending.push(evo);
        }
        return pending;
    }

    // Called when player confirms an evolution from the UI
    applyEvolution(evo) {
        this._evolvedBaseWeapons = this._evolvedBaseWeapons || new Set();
        const weapon = this.weapons.find(w => w.id === evo.weapon);
        if (!weapon) return;
        const idx = this.weapons.indexOf(weapon);
        const cls = WeaponFactory[evo.result];
        if (cls) {
            this.weapons[idx] = new cls(this);
            this._evolvedBaseWeapons.add(evo.weapon); // prevent base from reappearing
        }
    }

    _checkEvolutions() {
        // No longer auto-evolves. Evolution is now player-triggered.
        // getPendingEvolutions() + applyEvolution() handle it.
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
        ctx.translate(Game.lw / 2, Game.lh / 2);

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

        // Body — skin color from shop or default
        const _sc = this._skinColor || '#ddeeff';
        const _equippedSkin = (typeof Souls !== 'undefined') ? Souls.equippedSkin : 'default';
        const _isEspectro   = _equippedSkin === 'skin_espectro' && this.charData.id === 'warrior';
        const _isArcano     = _equippedSkin === 'skin_arcano'   && this.charData.id === 'mage';
        const _t = Date.now() * 0.001;

        if (_isEspectro) {
            this._drawEspectro(ctx, _t);
        } else if (_isArcano) {
            this._drawArcano(ctx, _t);
        } else {
            ctx.globalAlpha = 1;
            ctx.fillStyle   = _sc;
            ctx.shadowColor = _sc; ctx.shadowBlur = CONFIG.IS_MOBILE ? 10 : 22;
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
        }

        // ── Characteristic weapon visual ────────────────────────
        this._drawWeaponVisual(ctx, off);

        ctx.restore();
    }

    // ── ESPECTRO SKIN — silueta sombría con acento dorado ─────────
    _drawEspectro(ctx, t) {
        const r = this.r;
        const whip    = this.weapons.find(w => w.id === 'Whip');
        const isSwing = !!(whip && whip.swingActive);
        const prog    = isSwing ? whip.swingPhase : 0;

        // Bob vertical suave (idle y durante movimiento)
        const bob     = Math.sin(t * 4.5) * r * 0.06;
        // Inclinación al atacar
        const lean    = isSwing ? Math.sin(prog * Math.PI) * 0.18 : 0;
        // Capa ondeando
        const capeWave = Math.sin(t * 3.2) * 0.08;

        ctx.save();
        ctx.translate(0, bob);
        ctx.rotate(lean);

        const gold   = `#ffcc44`;
        const dark   = `#0a0a12`;
        const mid    = `#1a1020`;

        // ── 1. SOMBRA DEL SUELO ───────────────────────────────────
        ctx.globalAlpha = 0.3 + Math.sin(t * 3) * 0.05;
        ctx.fillStyle   = '#000000';
        ctx.beginPath();
        ctx.ellipse(0, r * 1.15, r * 0.9, r * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();

        // ── 2. CUERPO — silueta cónica (capa) ────────────────────
        ctx.globalAlpha = 1;
        ctx.shadowColor = gold;
        ctx.shadowBlur  = 8 + Math.sin(t * 2) * 4;

        // Capa exterior (forma de gota oscura)
        const capeGrad = ctx.createRadialGradient(0, 0, r * 0.2, 0, r * 0.3, r * 1.4);
        capeGrad.addColorStop(0,   mid);
        capeGrad.addColorStop(0.6, dark);
        capeGrad.addColorStop(1,   '#050508');
        ctx.fillStyle = capeGrad;

        ctx.beginPath();
        ctx.moveTo(0, -r * 1.35);       // punta capucha
        // Lado izquierdo de la capa (ondea)
        ctx.bezierCurveTo(
            -r * 0.55, -r * 0.6,
            -r * (0.85 + capeWave), r * 0.4,
            -r * (0.5 + capeWave * 0.5), r * 1.1
        );
        // Borde inferior
        ctx.bezierCurveTo(-r * 0.2, r * 1.25, r * 0.2, r * 1.25, r * (0.5 + capeWave * 0.5), r * 1.1);
        // Lado derecho de la capa
        ctx.bezierCurveTo(
            r * (0.85 - capeWave), r * 0.4,
            r * 0.55, -r * 0.6,
            0, -r * 1.35
        );
        ctx.closePath();
        ctx.fill();

        // ── 3. CAPUCHA — círculo oscuro en la cabeza ─────────────
        ctx.shadowBlur = 0;
        ctx.fillStyle  = dark;
        ctx.beginPath();
        ctx.arc(0, -r * 0.72, r * 0.42, 0, Math.PI * 2);
        ctx.fill();

        // ── 4. OJOS — dos puntos dorados que brillan ─────────────
        const eyePulse = 0.7 + Math.sin(t * 5.5) * 0.3;
        const eyeGlow  = isSwing ? 1.0 : eyePulse;
        ctx.globalAlpha = eyeGlow;
        ctx.fillStyle   = gold;
        ctx.shadowColor = gold;
        ctx.shadowBlur  = 10 + eyeGlow * 8;
        // Ojo izquierdo
        ctx.beginPath(); ctx.arc(-r * 0.13, -r * 0.76, r * 0.07, 0, Math.PI * 2); ctx.fill();
        // Ojo derecho
        ctx.beginPath(); ctx.arc( r * 0.13, -r * 0.76, r * 0.07, 0, Math.PI * 2); ctx.fill();

        // ── 5. BORDE DORADO DE LA CAPA (acento) ──────────────────
        ctx.globalAlpha = 0.5 + Math.sin(t * 2.8) * 0.15;
        ctx.strokeStyle = gold;
        ctx.shadowColor = gold;
        ctx.shadowBlur  = 6;
        ctx.lineWidth   = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.35);
        ctx.bezierCurveTo(
            -r * 0.55, -r * 0.6,
            -r * (0.85 + capeWave), r * 0.4,
            -r * (0.5 + capeWave * 0.5), r * 1.1
        );
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.35);
        ctx.bezierCurveTo(
            r * 0.55, -r * 0.6,
            r * (0.85 - capeWave), r * 0.4,
            r * (0.5 + capeWave * 0.5), r * 1.1
        );
        ctx.stroke();

        // ── 6. PARTÍCULA FLOTANTE de energía dorada ──────────────
        const orbAng = t * 2.2;
        const orbR   = r * 1.0;
        ctx.globalAlpha = 0.55 + Math.sin(t * 4) * 0.2;
        ctx.fillStyle   = gold;
        ctx.shadowColor = gold;
        ctx.shadowBlur  = 14;
        ctx.beginPath();
        ctx.arc(
            Math.cos(orbAng) * orbR,
            Math.sin(orbAng) * orbR * 0.4 - r * 0.2,
            r * 0.07, 0, Math.PI * 2
        );
        ctx.fill();

        ctx.globalAlpha = 1;
        ctx.shadowBlur  = 0;
        ctx.restore();
    }

    // ── ARCANO SKIN — Zale: sombra mágica con partículas azules ──
    _drawArcano(ctx, t) {
        const r = this.r;
        // Init particle system once
        if (!this._arcanoParticles) {
            this._arcanoParticles = Array.from({length: 18}, (_, i) => ({
                a:     (i / 18) * Math.PI * 2,
                orbitR: 28 + Math.random() * 16,
                speed:  0.5 + Math.random() * 0.8,
                size:   1.2 + Math.random() * 2,
                phase:  Math.random() * Math.PI * 2,
                // burst state
                bursting: false,
                bx: 0, by: 0, bvx: 0, bvy: 0, blife: 0,
            }));
        }

        // Detect attack (Wand fires when projectile just spawned)
        const wand = this.weapons.find(w => w.id === 'MagicWand');
        const isAttacking = !!(wand && wand.timer < 0.08);
        const faceAng = this._aimAngle || 0;

        const bob = Math.sin(t * 4.2) * r * 0.05;
        const lean = isAttacking ? 0.12 : 0;
        const cw   = Math.sin(t * 3.0) * 0.07;

        ctx.save();
        ctx.translate(0, bob);
        ctx.rotate(lean);

        // ── 1. Shadow on ground ──────────────────────────────────
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(0, r * 1.12, r * 0.85, r * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();

        // ── 2. Cape body ─────────────────────────────────────────
        ctx.globalAlpha = 1;
        const capeGrad = ctx.createRadialGradient(0, 0, r*0.2, 0, r*0.3, r*1.4);
        capeGrad.addColorStop(0,   '#0d0d2a');
        capeGrad.addColorStop(0.6, '#060618');
        capeGrad.addColorStop(1,   '#020210');
        ctx.fillStyle   = capeGrad;
        ctx.shadowColor = '#4466ff';
        ctx.shadowBlur  = 10 + Math.sin(t*2)*4;
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.35);
        ctx.bezierCurveTo(-r*(0.52+cw), -r*0.55, -r*(0.88+cw), r*0.45, -r*0.52, r*1.1);
        ctx.bezierCurveTo(-r*0.18, r*1.22, r*0.18, r*1.22, r*0.52, r*1.1);
        ctx.bezierCurveTo(r*(0.88-cw), r*0.45, r*(0.52-cw), -r*0.55, 0, -r*1.35);
        ctx.closePath();
        ctx.fill();

        // ── 3. Hood ───────────────────────────────────────────────
        ctx.shadowBlur = 0;
        ctx.fillStyle  = '#070718';
        ctx.beginPath();
        ctx.arc(0, -r*0.72, r*0.43, 0, Math.PI*2);
        ctx.fill();

        // ── 4. Eyes — blue glowing ────────────────────────────────
        const ep = 0.6 + Math.sin(t*5.5)*0.4;
        const eg = isAttacking ? 1.0 : ep;
        ctx.globalAlpha = eg;
        ctx.fillStyle   = '#4466ff';
        ctx.shadowColor = '#4466ff';
        ctx.shadowBlur  = 12 + eg * 8;
        ctx.beginPath(); ctx.arc(-r*0.13, -r*0.77, r*0.07, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc( r*0.13, -r*0.77, r*0.07, 0, Math.PI*2); ctx.fill();

        // ── 5. Cape edge accent (blue) ────────────────────────────
        ctx.globalAlpha = 0.45 + Math.sin(t*2.5)*0.15;
        ctx.strokeStyle = '#4466ff';
        ctx.shadowColor = '#4466ff';
        ctx.shadowBlur  = 5;
        ctx.lineWidth   = 1.1;
        ctx.beginPath();
        ctx.moveTo(0, -r*1.35);
        ctx.bezierCurveTo(-r*(0.52+cw), -r*0.55, -r*(0.88+cw), r*0.45, -r*0.52, r*1.1);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -r*1.35);
        ctx.bezierCurveTo(r*(0.52-cw), -r*0.55, r*(0.88-cw), r*0.45, r*0.52, r*1.1);
        ctx.stroke();

        // ── 6. Particles ─────────────────────────────────────────
        const particles = this._arcanoParticles;
        particles.forEach(p => {
            if (isAttacking && !p.bursting) {
                // All particles converge toward the facing angle (tight cone, not spread)
                p.bursting = true;
                p.bx = Math.cos(p.a) * p.orbitR;
                p.by = Math.sin(p.a) * p.orbitR * 0.5 - r*0.2;
                // Tight spread: ±15° around faceAng so they fly together
                const spread = (Math.random() - 0.5) * 0.26;
                const spd    = 220 + Math.random() * 80;
                p.bvx = Math.cos(faceAng + spread) * spd;
                p.bvy = Math.sin(faceAng + spread) * spd;
                p.blife = 1.0;
            }

            if (p.bursting) {
                p.blife -= 0.038;
                if (p.blife <= 0) { p.bursting = false; return; }
                p.bx += p.bvx * 0.016;
                p.by += p.bvy * 0.016;

                ctx.globalAlpha = p.blife * 0.9;
                ctx.fillStyle   = '#4466ff';
                ctx.shadowColor = '#4466ff';
                ctx.shadowBlur  = 10;
                ctx.beginPath();
                ctx.arc(p.bx, p.by, p.size * (0.5 + p.blife), 0, Math.PI*2);
                ctx.fill();
            } else {
                // Orbit
                p.a += p.speed * 0.016;
                const px = Math.cos(p.a) * p.orbitR;
                const py = Math.sin(p.a) * p.orbitR * 0.5 - r*0.2;
                const alpha = 0.35 + Math.sin(t*3+p.phase)*0.45;
                ctx.globalAlpha = Math.max(0.05, alpha);
                ctx.fillStyle   = '#4466ff';
                ctx.shadowColor = '#4466ff';
                ctx.shadowBlur  = 6;
                ctx.beginPath();
                ctx.arc(px, py, p.size, 0, Math.PI*2);
                ctx.fill();
            }
        });

        ctx.globalAlpha = 1;
        ctx.shadowBlur  = 0;
        ctx.restore();
    }

    _drawWeaponVisual(ctx, off) {
        const t   = Date.now() * 0.001;
        const id  = this.charData.id;
        const r   = this.r;

        // Aim angle: toward closest enemy. Smooth-interpolates so visuals don't snap.
        // Falls back to movement direction when no enemies are nearby.
        let targetAng;
        const closest = (typeof Game !== 'undefined') ? Game.getClosestEnemy(this.x, this.y) : null;
        if (closest) {
            targetAng = Math.atan2(closest.y - this.y, closest.x - this.x);
        } else if (this.dir && (Math.abs(this.dir.x) + Math.abs(this.dir.y)) > 0.01) {
            targetAng = Math.atan2(this.dir.y, this.dir.x);
        } else {
            targetAng = this._aimAngle || 0;
        }

        // Smooth rotation — lerp on the unit circle to avoid angle-wrap artifacts
        if (this._aimAngle === undefined) this._aimAngle = targetAng;
        let diff = targetAng - this._aimAngle;
        while (diff >  Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this._aimAngle += diff * Math.min(1, 12 * (1 / 60)); // ~12 rad/s turn speed
        const faceAng = this._aimAngle;

        ctx.save();

        if (false) {
            // placeholder
        } else if (id === 'warrior') {
            // ── ALARIC — Filo Dorado skin — espada canvas (nítida, sin sprites) ─
            const equippedSkin = (typeof Souls !== 'undefined') ? Souls.equippedSkin : 'default';
            if (equippedSkin === 'skin_alaric_golden') {
                const whip    = this.weapons.find(w => w.id === 'Whip');
                const isSwing = !!(whip && whip.swingActive);
                const prog    = isSwing ? whip.swingPhase : 0;

                // ease-in-out: arranca rápido, frena al final
                const ease = prog < 0.5
                    ? 2 * prog * prog
                    : -1 + (4 - 2 * prog) * prog;

                // Ángulo actual: idle apunta al enemigo,
                // swing barre desde +halfArc hasta -halfArc (curva de la punta)
                let drawAng;
                if (isSwing && whip) {
                    const halfArc = whip.swingArc / 2;
                    drawAng = whip.swingAngle + halfArc - whip.swingArc * ease;
                } else {
                    drawAng = faceAng;
                }

                const L  = r * 5.2;    // longitud total de la espada
                const LB = L * 0.72;   // longitud de la hoja (blade)
                const LH = L * 0.18;   // longitud del mango (hilt)
                const LG = L * 0.10;   // guarda (crossguard)

                // ── Rastro de movimiento (3 fantasmas) ──────────────────
                if (isSwing && whip) {
                    const halfArc = whip.swingArc / 2;
                    for (let gi = 3; gi >= 1; gi--) {
                        const gp  = Math.max(0, prog - gi * 0.07);
                        const ge  = gp < 0.5 ? 2*gp*gp : -1+(4-2*gp)*gp;
                        const ga  = whip.swingAngle + halfArc - whip.swingArc * ge;
                        const alf = (1 - gi / 4) * 0.22 * Math.sin(prog * Math.PI);

                        ctx.save();
                        ctx.rotate(ga);
                        ctx.globalAlpha = alf;

                        // Hoja fantasma (solo el trazo dorado)
                        ctx.strokeStyle = '#ffcc00';
                        ctx.lineWidth   = 2.5;
                        ctx.lineCap     = 'round';
                        ctx.shadowBlur  = 0;
                        ctx.beginPath();
                        ctx.moveTo(LH * 0.3, 0);
                        ctx.lineTo(LH * 0.3 + LB * 0.9, -LB * 0.04);
                        ctx.stroke();

                        ctx.restore();
                    }
                }

                // ── Espada principal ─────────────────────────────────────
                ctx.save();
                ctx.rotate(drawAng);

                const swingGlow = isSwing ? Math.sin(prog * Math.PI) : 0;

                // 1. MANGO — rectángulo con degradado marrón-dorado
                const hiltGrad = ctx.createLinearGradient(0, -r*0.25, 0, r*0.25);
                hiltGrad.addColorStop(0,   '#6b3a1f');
                hiltGrad.addColorStop(0.4, '#c8872a');
                hiltGrad.addColorStop(1,   '#6b3a1f');
                ctx.fillStyle   = hiltGrad;
                ctx.shadowBlur  = 0;
                ctx.beginPath();
                ctx.roundRect(-LH * 0.05, -r * 0.22, LH * 0.9, r * 0.44, 3);
                ctx.fill();

                // Envoltorio del mango (líneas)
                ctx.strokeStyle = '#3a1a00';
                ctx.lineWidth   = 1.2;
                ctx.globalAlpha = 0.7;
                for (let wi2 = 0; wi2 < 4; wi2++) {
                    const wx = LH * 0.15 + wi2 * LH * 0.18;
                    ctx.beginPath();
                    ctx.moveTo(wx, -r * 0.22);
                    ctx.lineTo(wx,  r * 0.22);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;

                // 2. GUARDA — barra perpendicular dorada
                const guardGrad = ctx.createLinearGradient(LH, -LG * 1.6, LH, LG * 1.6);
                guardGrad.addColorStop(0,   '#3a2000');
                guardGrad.addColorStop(0.35,'#ffcc44');
                guardGrad.addColorStop(0.65,'#ffcc44');
                guardGrad.addColorStop(1,   '#3a2000');
                ctx.fillStyle   = guardGrad;
                ctx.shadowColor = '#ffaa00';
                ctx.shadowBlur  = 6 + swingGlow * 8;
                ctx.beginPath();
                ctx.roundRect(LH * 0.75, -LG * 1.6, LH * 0.5, LG * 3.2, 2);
                ctx.fill();

                // 3. HOJA — forma trapezoidal negra con borde dorado
                // Cuerpo negro de la hoja
                ctx.shadowBlur  = 0;
                ctx.fillStyle   = '#0a0800';
                ctx.beginPath();
                ctx.moveTo(LH * 1.15,  r * 0.18);   // base ancha (hilt-side)
                ctx.lineTo(LH * 1.15 + LB * 0.85, r * 0.04); // taper
                ctx.lineTo(LH * 1.15 + LB,        0);          // tip
                ctx.lineTo(LH * 1.15 + LB * 0.85, -r * 0.04);
                ctx.lineTo(LH * 1.15,  -r * 0.18);
                ctx.closePath();
                ctx.fill();

                // Borde superior (filo) — línea dorada brillante
                const edgeAlpha = 0.6 + swingGlow * 0.35;
                ctx.globalAlpha = edgeAlpha;
                ctx.strokeStyle = '#ffe066';
                ctx.shadowColor = '#ffcc00';
                ctx.shadowBlur  = 4 + swingGlow * 14;
                ctx.lineWidth   = 1.8;
                ctx.lineCap     = 'round';
                ctx.beginPath();
                ctx.moveTo(LH * 1.15, -r * 0.18);
                ctx.lineTo(LH * 1.15 + LB * 0.85, -r * 0.04);
                ctx.lineTo(LH * 1.15 + LB, 0);
                ctx.stroke();

                // Vena dorada central (grieta del arma)
                ctx.globalAlpha = 0.45 + swingGlow * 0.4;
                ctx.strokeStyle = '#ffcc00';
                ctx.shadowColor = '#ffdd44';
                ctx.shadowBlur  = 3 + swingGlow * 10;
                ctx.lineWidth   = 1.0;
                ctx.beginPath();
                ctx.moveTo(LH * 1.3,  r * 0.06);
                ctx.bezierCurveTo(
                    LH * 1.3 + LB * 0.3,  r * 0.02,
                    LH * 1.3 + LB * 0.65, -r * 0.02,
                    LH * 1.3 + LB * 0.9,  0
                );
                ctx.stroke();

                // 4. PUNTA — punto de luz al atacar
                if (isSwing) {
                    ctx.globalAlpha = swingGlow * 0.9;
                    ctx.fillStyle   = '#ffffff';
                    ctx.shadowColor = '#ffcc00';
                    ctx.shadowBlur  = 18;
                    ctx.beginPath();
                    ctx.arc(LH * 1.15 + LB, 0, 3.5, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.globalAlpha = 1;
                ctx.shadowBlur  = 0;
                ctx.restore();
            }
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
