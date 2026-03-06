// ── enemy.js ── Enemy class ──
'use strict';

class Enemy extends Entity {
    constructor(x, y, data, diffMult) {
        super(x, y, data.r, data.hp * diffMult, data.color);
        this.type        = data.type;
        // Logarithmic speed scale — no hard cap, but flattens naturally
        // diffMult=1→1.0×  3→1.66×  9→2.33×  keeps game hard without hitscanning
        const speedScale = 1 + Math.log(Math.max(diffMult, 1)) * 0.6;
        this.speed       = data.speed * (0.88 + Math.random() * 0.24) * speedScale;
        this.baseSpeed   = this.speed;
        // dmg scales with difficulty but capped logarithmically to prevent insta-kills
        this.dmg         = data.dmg * (1 + Math.log(Math.max(diffMult, 1)) * 0.55);
        this.xpValue     = data.xp;
        this.behaviorTimer = 0;
        this.swingAngle  = 0;
        this.isBoss      = data.isBoss || false;
        this.patternTimer = 0; this.patternPhase = 0;
        this.bossType    = data.bossType || 0;
        this.charging    = false;
        this.chargeVx = 0; this.chargeVy = 0; this.chargeDur = 0;
        this.shootTimer  = 1 + Math.random() * 2;
        this.knockback   = { x: 0, y: 0 };
        this.angle       = 0;
        this.elite       = data.elite || false;
        if (this.elite) {
            this.maxHp *= 2.5; this.hp = this.maxHp;
            this.dmg *= 1.5; this.r *= 1.3;
        }
    }

    update(dt, px, py) {
        if (this.flash > 0) this.flash -= dt;
        this.x += this.knockback.x * dt;
        this.y += this.knockback.y * dt;
        this.knockback.x *= 0.85; this.knockback.y *= 0.85;

        const dist = M.dist(this.x, this.y, px, py);
        const ang  = M.angle(this.x, this.y, px, py);

        switch(this.type) {
            case 'boss':    this._updateBoss(dt, px, py, dist, ang); break;
            case 'swarm':   this._updateSwarm(dt, ang);              break;
            case 'ranged':  this._updateRanged(dt, ang, dist);       break;
            case 'exploder':this._updateExploder(dt, ang, dist);     break;
            case 'charger': this._updateCharger(dt, ang);            break;
            case 'phantom': this._updatePhantom(dt, px, py, ang);    break;
            default:
                this.x += Math.cos(ang) * this.speed * dt;
                this.y += Math.sin(ang) * this.speed * dt;
        }
    }

    _updateSwarm(dt, ang) {
        this.swingAngle += dt * 5.5;
        const sw = Math.sin(this.swingAngle) * 1.2;
        this.x += (Math.cos(ang) + Math.cos(ang + Math.PI/2) * sw) * this.speed * dt;
        this.y += (Math.sin(ang) + Math.sin(ang + Math.PI/2) * sw) * this.speed * dt;
    }

    _updateRanged(dt, ang, dist) {
        const kd = 220;
        if (dist < kd - 30)       { this.x -= Math.cos(ang)*this.speed*0.7*dt; this.y -= Math.sin(ang)*this.speed*0.7*dt; }
        else if (dist > kd + 30)  { this.x += Math.cos(ang)*this.speed*0.6*dt; this.y += Math.sin(ang)*this.speed*0.6*dt; }
        else                      { this.x -= Math.sin(ang)*this.speed*0.55*dt; this.y += Math.cos(ang)*this.speed*0.55*dt; }
        this.shootTimer -= dt;
        if (this.shootTimer <= 0) {
            this.shootTimer = 2.5 + Math.random() * 1.5;
            Game.enemyProjectiles.push({ x:this.x, y:this.y, vx:Math.cos(ang)*2.4, vy:Math.sin(ang)*2.4, r:7, dmg:8, life:300, color:this.color });
        }
    }

    _updateExploder(dt, ang, dist) {
        if (dist < 130) this.speed = Math.min(this.baseSpeed*2.4, this.speed + this.baseSpeed*dt);
        else            this.speed = Math.max(this.baseSpeed, this.speed - this.baseSpeed*dt*0.5);
        this.x += Math.cos(ang)*this.speed*dt;
        this.y += Math.sin(ang)*this.speed*dt;
    }

    _updateCharger(dt, ang) {
        this.behaviorTimer += dt;
        if (this.charging) {
            this.x += this.chargeVx*dt; this.y += this.chargeVy*dt;
            this.chargeDur -= dt; if (this.chargeDur <= 0) this.charging = false;
        } else if (this.behaviorTimer > 2.8) {
            this.behaviorTimer = 0; this.charging = true;
            this.chargeVx = Math.cos(ang)*this.speed*4.2;
            this.chargeVy = Math.sin(ang)*this.speed*4.2;
            this.chargeDur = 0.32;
        } else {
            this.x += Math.cos(ang)*this.speed*0.5*dt;
            this.y += Math.sin(ang)*this.speed*0.5*dt;
        }
    }

    _updatePhantom(dt, px, py, ang) {
        this.behaviorTimer += dt;
        if (this.behaviorTimer > 4) {
            this.behaviorTimer = 0;
            const a2 = Math.random() * Math.PI * 2;
            const tpDist = 350 + Math.random() * 150;
            this.x = px + Math.cos(a2)*tpDist; this.y = py + Math.sin(a2)*tpDist;
            Game.spawnParticle(this.x, this.y, '#cc44ff', 8);
        }
        this.x += Math.cos(ang)*this.speed*0.8*dt;
        this.y += Math.sin(ang)*this.speed*0.8*dt;
    }

    _updateBoss(dt, px, py, dist, ang) {
        this.patternTimer += dt;
        this.angle        += dt * 0.8;
        this.spiralAngle   = (this.spiralAngle || 0) + dt * 5;
        switch(this.bossType) {
            case 0: this._boss0Coloso(dt, px, py, dist, ang);   break;
            case 1: this._boss1Tejedora(dt, px, py, dist, ang); break;
            case 2: this._boss2Liche(dt, px, py, dist, ang);    break;
            case 3: this._boss3Abismo(dt, px, py, dist, ang);   break;
        }
    }

    // ══════════════════════════════════════════════════════════════
    // BOSS 0 — EL COLOSO  (rojo, grande, lento, golpes sísmicos)
    // Forma: estrella de 6 puntas giratoria
    // Ataques: carga brutal, onda de choque, lluvia de meteoritos
    // ══════════════════════════════════════════════════════════════
    _boss0Coloso(dt, px, py, dist, ang) {
        if (this.charging) {
            this.x += this.chargeVx * dt; this.y += this.chargeVy * dt;
            this.chargeDur -= dt;
            if (this.chargeDur <= 0) {
                this.charging = false;
                // Shockwave on landing
                for (let i = 0; i < 20; i++) {
                    const a = (Math.PI*2/20)*i;
                    Game.enemyProjectiles.push({ x:this.x, y:this.y, vx:Math.cos(a)*2.2, vy:Math.sin(a)*2.2, r:13, dmg:12, life:260, color:'#ff3300' });
                }
                Game.shake = 18;
            }
        } else {
            this.x += Math.cos(ang) * this.speed * dt;
            this.y += Math.sin(ang) * this.speed * dt;
        }
        const interval = 3.2;
        if (this.patternTimer >= interval) {
            this.patternTimer = 0;
            this.patternPhase = (this.patternPhase + 1) % 4;
            const ph = this.patternPhase;
            if (ph === 0) {
                // BRUTAL CHARGE
                this.charging = true; this.chargeVx = Math.cos(ang)*800; this.chargeVy = Math.sin(ang)*800; this.chargeDur = 0.5;
                Game.shake = 14;
            } else if (ph === 1) {
                // METEOR RAIN — 5 aimed shots with spread
                for (let s = -2; s <= 2; s++) {
                    const a = ang + s * 0.22;
                    Game.enemyProjectiles.push({ x:this.x, y:this.y, vx:Math.cos(a)*6, vy:Math.sin(a)*6, r:12, dmg:14, life:200, color:'#ff4400' });
                }
            } else if (ph === 2) {
                // STOMP RING — slow massive orbs
                for (let i = 0; i < 10; i++) {
                    const a = (Math.PI*2/10)*i + this.angle;
                    Game.enemyProjectiles.push({ x:this.x, y:this.y, vx:Math.cos(a)*1.8, vy:Math.sin(a)*1.8, r:16, dmg:15, life:380, color:'#cc2200' });
                }
                Game.shake = 12;
            } else {
                // DOUBLE CHARGE
                this.charging = true; this.chargeVx = Math.cos(ang)*650; this.chargeVy = Math.sin(ang)*650; this.chargeDur = 0.35;
                setTimeout(() => {
                    if (!this.dead) { this.charging = true; this.chargeVx = Math.cos(ang)*650; this.chargeVy = Math.sin(ang)*650; this.chargeDur = 0.35; }
                }, 600);
            }
        }
    }

    // ══════════════════════════════════════════════════════════════
    // BOSS 1 — LA TEJEDORA  (morada, araña, telas y veneno)
    // Forma: octágono con patas
    // Ataques: telaraña radial, veneno espiral, disparos homing
    // ══════════════════════════════════════════════════════════════
    _boss1Tejedora(dt, px, py, dist, ang) {
        // Moves in arcs, not straight lines
        this.webAngle = (this.webAngle || 0) + dt * 1.2;
        const arcAng  = ang + Math.sin(this.webAngle) * 0.7;
        this.x += Math.cos(arcAng) * this.speed * dt;
        this.y += Math.sin(arcAng) * this.speed * dt;

        const interval = 2.6;
        if (this.patternTimer >= interval) {
            this.patternTimer = 0;
            this.patternPhase = (this.patternPhase + 1) % 4;
            const ph = this.patternPhase;
            if (ph === 0) {
                // WEB BURST — 24 thin fast shots in ring
                for (let i = 0; i < 24; i++) {
                    const a = (Math.PI*2/24)*i;
                    Game.enemyProjectiles.push({ x:this.x, y:this.y, vx:Math.cos(a)*4.5, vy:Math.sin(a)*4.5, r:6, dmg:8, life:220, color:'#cc44ff' });
                }
                Game.shake = 10;
            } else if (ph === 1) {
                // POISON SPIRAL — 3 rotating arms continuous
                for (let arm = 0; arm < 3; arm++) {
                    for (let j = 0; j < 5; j++) {
                        const a = this.spiralAngle + (Math.PI*2/3)*arm + j * 0.35;
                        const delay = j * 80;
                        setTimeout(() => {
                            if (!this.dead) Game.enemyProjectiles.push({ x:this.x, y:this.y, vx:Math.cos(a)*3.8, vy:Math.sin(a)*3.8, r:7, dmg:7, life:240, color:'#aa22ff' });
                        }, delay);
                    }
                }
            } else if (ph === 2) {
                // HOMING SPIDERS — 4 slow homing orbs
                for (let i = 0; i < 4; i++) {
                    const a = ang + (i - 1.5) * 0.5;
                    const proj = { x:this.x, y:this.y, vx:Math.cos(a)*2, vy:Math.sin(a)*2, r:9, dmg:10, life:350, color:'#dd66ff', homing:true };
                    Game.enemyProjectiles.push(proj);
                }
            } else {
                // CLOSE WEB — dense ring that expands slowly
                for (let i = 0; i < 12; i++) {
                    const a = (Math.PI*2/12)*i + this.angle * 0.5;
                    Game.enemyProjectiles.push({ x:this.x, y:this.y, vx:Math.cos(a)*1.2, vy:Math.sin(a)*1.2, r:11, dmg:9, life:500, color:'#9900cc' });
                }
            }
        }
    }

    // ══════════════════════════════════════════════════════════════
    // BOSS 2 — EL LICHE  (cian/negro, corona, hielo y muerte)
    // Forma: corona flotante con cristales giratorios
    // Ataques: ráfaga de carámbanos, teletransporte, barrera de hielo
    // ══════════════════════════════════════════════════════════════
    _boss2Liche(dt, px, py, dist, ang) {
        this.teleportCooldown = (this.teleportCooldown || 0) - dt;
        if (this.charging) {
            this.x += this.chargeVx * dt; this.y += this.chargeVy * dt;
            this.chargeDur -= dt;
            if (this.chargeDur <= 0) this.charging = false;
        } else {
            // Keeps distance — backs away if too close
            const targetDist = 280;
            const moveDir    = dist < targetDist ? -1 : 1;
            this.x += Math.cos(ang) * this.speed * moveDir * dt;
            this.y += Math.sin(ang) * this.speed * moveDir * dt;
        }
        const interval = 2.4;
        if (this.patternTimer >= interval) {
            this.patternTimer = 0;
            this.patternPhase = (this.patternPhase + 1) % 5;
            const ph = this.patternPhase;
            if (ph === 0) {
                // ICE SHARD FAN — 7 fast shards aimed at player
                for (let s = -3; s <= 3; s++) {
                    const a = ang + s * 0.18;
                    Game.enemyProjectiles.push({ x:this.x, y:this.y, vx:Math.cos(a)*6.5, vy:Math.sin(a)*6.5, r:7, dmg:11, life:160, color:'#44eeff' });
                }
            } else if (ph === 1) {
                // TELEPORT behind player + burst
                this.x = px + Math.cos(ang + Math.PI) * 200;
                this.y = py + Math.sin(ang + Math.PI) * 200;
                Game.spawnParticle(this.x, this.y, '#44eeff', 14);
                Game.shake = 8;
                for (let i = 0; i < 8; i++) {
                    const a = (Math.PI*2/8)*i;
                    Game.enemyProjectiles.push({ x:this.x, y:this.y, vx:Math.cos(a)*4, vy:Math.sin(a)*4, r:8, dmg:10, life:200, color:'#88ffff' });
                }
            } else if (ph === 2) {
                // ICE WALL — row of 8 slow orbs across path
                for (let i = -4; i <= 4; i++) {
                    const perp = ang + Math.PI/2;
                    const ox2  = Math.cos(perp) * i * 55;
                    const oy2  = Math.sin(perp) * i * 55;
                    Game.enemyProjectiles.push({ x:this.x+ox2, y:this.y+oy2, vx:Math.cos(ang)*2.5, vy:Math.sin(ang)*2.5, r:10, dmg:9, life:320, color:'#00ccff' });
                }
            } else if (ph === 3) {
                // SKULL VOLLEY — 3 big aimed shots
                for (let s = -1; s <= 1; s++) {
                    const a = ang + s * 0.3;
                    Game.enemyProjectiles.push({ x:this.x, y:this.y, vx:Math.cos(a)*5, vy:Math.sin(a)*5, r:12, dmg:14, life:200, color:'#002244' });
                }
            } else {
                // BLIZZARD — 30 random direction slow shots
                for (let i = 0; i < 30; i++) {
                    const a = Math.random() * Math.PI * 2;
                    Game.enemyProjectiles.push({ x:this.x, y:this.y, vx:Math.cos(a)*2, vy:Math.sin(a)*2, r:6, dmg:7, life:360, color:'#88ddff' });
                }
                Game.shake = 12;
            }
        }
    }

    // ══════════════════════════════════════════════════════════════
    // BOSS 3 — EL ABISMO  (violeta oscuro, anomalía, vacío)
    // Forma: orbe pulsante con anillos distorsionados
    // Ataques: rayo de vacío (línea), agujeros negros, fractura
    // ══════════════════════════════════════════════════════════════
    _boss3Abismo(dt, px, py, dist, ang) {
        // Teleports frequently and moves fast
        this.abismoTimer = (this.abismoTimer || 0) + dt;
        if (this.abismoTimer > 4.5) {
            this.abismoTimer = 0;
            // Teleport to random spot near player
            const ta = Math.random() * Math.PI * 2;
            this.x = px + Math.cos(ta) * 300;
            this.y = py + Math.sin(ta) * 300;
            Game.spawnParticle(this.x, this.y, '#8800ff', 16);
        }
        this.x += Math.cos(ang) * this.speed * dt;
        this.y += Math.sin(ang) * this.speed * dt;

        const interval = 2.2;
        if (this.patternTimer >= interval) {
            this.patternTimer = 0;
            this.patternPhase = (this.patternPhase + 1) % 5;
            const ph = this.patternPhase;
            if (ph === 0) {
                // VOID RAY — dense line of bullets toward player
                for (let i = 0; i < 8; i++) {
                    setTimeout(() => {
                        if (!this.dead) Game.enemyProjectiles.push({ x:this.x, y:this.y, vx:Math.cos(ang)*7, vy:Math.sin(ang)*7, r:8, dmg:11, life:150, color:'#aa44ff' });
                    }, i * 60);
                }
            } else if (ph === 1) {
                // BLACK HOLES — 4 orbs that pull player
                for (let i = 0; i < 4; i++) {
                    const a = (Math.PI*2/4)*i + this.angle;
                    Game.enemyProjectiles.push({ x:this.x+Math.cos(a)*100, y:this.y+Math.sin(a)*100, vx:0, vy:0, r:15, dmg:8, life:480, color:'#440088', pull:true });
                }
                Game.shake = 10;
            } else if (ph === 2) {
                // REALITY SHATTER — 4 bursts from different positions
                for (let q = 0; q < 4; q++) {
                    const oa = (Math.PI*2/4)*q;
                    const ox2 = this.x + Math.cos(oa)*80, oy2 = this.y + Math.sin(oa)*80;
                    setTimeout(() => {
                        if (!this.dead) {
                            for (let i = 0; i < 8; i++) {
                                const a2 = (Math.PI*2/8)*i;
                                Game.enemyProjectiles.push({ x:ox2, y:oy2, vx:Math.cos(a2)*3.5, vy:Math.sin(a2)*3.5, r:7, dmg:9, life:200, color:'#6600cc' });
                            }
                        }
                    }, q * 120);
                }
            } else if (ph === 3) {
                // VOID SPIRAL — continuous fast spiral
                for (let i = 0; i < 18; i++) {
                    const a = (Math.PI*2/18)*i + this.spiralAngle;
                    Game.enemyProjectiles.push({ x:this.x, y:this.y, vx:Math.cos(a)*5, vy:Math.sin(a)*5, r:7, dmg:9, life:190, color:'#bb00ff' });
                }
                Game.shake = 10;
            } else {
                // DIMENSIONAL RIFT — aimed + ring combo
                for (let s = -2; s <= 2; s++) {
                    const a = ang + s * 0.2;
                    Game.enemyProjectiles.push({ x:this.x, y:this.y, vx:Math.cos(a)*5.5, vy:Math.sin(a)*5.5, r:9, dmg:13, life:180, color:'#ff00ff' });
                }
                for (let i = 0; i < 6; i++) {
                    const a = (Math.PI*2/6)*i;
                    Game.enemyProjectiles.push({ x:this.x, y:this.y, vx:Math.cos(a)*2, vy:Math.sin(a)*2, r:11, dmg:10, life:320, color:'#660099' });
                }
            }
        }
    }

    draw(ctx, off) {
        const sx = this.x - off.x + canvas.width/2;
        const sy = this.y - off.y + canvas.height/2;
        if (sx < -80 || sx > canvas.width+80 || sy < -80 || sy > canvas.height+80) return;

        ctx.save();
        const t   = Date.now() * 0.001;
        const col = this.flash > 0 ? '#ffffff' : this.color;
        const glowColor = this.isBoss ? '#ff2244' : (this.elite ? '#ffcc44' : this.color);
        const pulse = 0.7 + Math.sin(t * 2 + this.x * 0.01) * 0.3;

        // Outer aura ring
        ctx.globalAlpha = 0.12 * pulse;
        ctx.fillStyle = glowColor;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = CONFIG.IS_MOBILE ? 10 : 22;
        ctx.beginPath(); ctx.arc(sx, sy, this.r * 2.2, 0, Math.PI*2); ctx.fill();

        // Mid glow ring
        ctx.globalAlpha = 0.25 * pulse;
        ctx.shadowBlur = CONFIG.IS_MOBILE ? 8 : 16;
        ctx.beginPath(); ctx.arc(sx, sy, this.r * 1.55, 0, Math.PI*2); ctx.fill();

        // Core body — translucent spirit
        ctx.globalAlpha = this.type === 'phantom' ? 0.55 + Math.sin(t * 3)*0.2 : 0.82;
        ctx.shadowBlur  = CONFIG.IS_MOBILE ? 6 : 12;
        ctx.fillStyle   = col;
        ctx.beginPath();
        if (this.type === 'charger' || this.elite) {
            this._drawStar(ctx, sx, sy, 5, this.r, this.r * 0.42);
        } else if (this.type === 'exploder') {
            // Pulsing square spirit
            const rot = t * 0.8;
            ctx.save(); ctx.translate(sx, sy); ctx.rotate(rot);
            ctx.rect(-this.r, -this.r, this.r*2, this.r*2);
            ctx.restore();
        } else {
            ctx.arc(sx, sy, this.r, 0, Math.PI*2);
        }
        ctx.fill();

        // Inner bright core dot
        ctx.globalAlpha = 0.9;
        ctx.shadowBlur  = 0;
        ctx.fillStyle   = '#ffffff';
        ctx.beginPath(); ctx.arc(sx, sy, this.r * 0.28, 0, Math.PI*2); ctx.fill();

        // Boss unique shapes
        if (this.isBoss) {
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;
            if (this.bossType === 0) {
                // EL COLOSO — red spiky star + lava rings
                ctx.fillStyle = this.flash > 0 ? '#fff' : '#ff1133';
                ctx.shadowColor = '#ff3300'; ctx.shadowBlur = 20;
                this._drawStar(ctx, sx, sy, 6, this.r, this.r * 0.45);
                ctx.fill();
                ctx.globalAlpha = 0.35;
                ctx.strokeStyle = '#ff5500'; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.arc(sx,sy,this.r+14+Math.sin(this.angle*1.5)*5,0,Math.PI*2); ctx.stroke();
                ctx.beginPath(); ctx.arc(sx,sy,this.r+28+Math.cos(this.angle)*6,0,Math.PI*2); ctx.stroke();
                // Cracks
                ctx.globalAlpha = 0.5; ctx.strokeStyle='#ff6600'; ctx.lineWidth=2;
                for(let i=0;i<6;i++){
                    const ca=(Math.PI*2/6)*i+this.angle*0.3;
                    ctx.beginPath(); ctx.moveTo(sx,sy);
                    ctx.lineTo(sx+Math.cos(ca)*this.r*0.9,sy+Math.sin(ca)*this.r*0.9); ctx.stroke();
                }
            } else if (this.bossType === 1) {
                // LA TEJEDORA — purple octagon + legs
                ctx.fillStyle = this.flash>0?'#fff':'#cc44ff';
                ctx.shadowColor='#aa00ff'; ctx.shadowBlur=22;
                ctx.beginPath();
                for(let i=0;i<8;i++){
                    const a=(Math.PI*2/8)*i+this.angle*0.4;
                    i===0?ctx.moveTo(sx+Math.cos(a)*this.r,sy+Math.sin(a)*this.r)
                         :ctx.lineTo(sx+Math.cos(a)*this.r,sy+Math.sin(a)*this.r);
                }
                ctx.closePath(); ctx.fill();
                // 8 spider legs
                ctx.globalAlpha=0.6; ctx.strokeStyle='#9900cc'; ctx.lineWidth=2;
                for(let i=0;i<8;i++){
                    const la=(Math.PI*2/8)*i+this.angle*0.5;
                    const lx1=sx+Math.cos(la)*this.r, ly1=sy+Math.sin(la)*this.r;
                    const mid=(Math.PI*2/8)*i+(Math.PI*2/16)+this.angle*0.5;
                    const lx2=sx+Math.cos(la)*this.r*1.7+Math.sin(this.angle+i)*8;
                    const ly2=sy+Math.sin(la)*this.r*1.7+Math.cos(this.angle+i)*8;
                    ctx.beginPath(); ctx.moveTo(lx1,ly1);
                    ctx.quadraticCurveTo(sx+Math.cos(mid)*this.r*1.4,sy+Math.sin(mid)*this.r*1.4,lx2,ly2);
                    ctx.stroke();
                }
                // Web pattern in center
                ctx.globalAlpha=0.25; ctx.strokeStyle='#ffffff'; ctx.lineWidth=1;
                ctx.beginPath(); ctx.arc(sx,sy,this.r*0.5,0,Math.PI*2); ctx.stroke();
                ctx.beginPath(); ctx.arc(sx,sy,this.r*0.25,0,Math.PI*2); ctx.stroke();
            } else if (this.bossType === 2) {
                // EL LICHE — icy crown + floating crystals
                ctx.fillStyle = this.flash>0?'#fff':'#002233';
                ctx.shadowColor='#44eeff'; ctx.shadowBlur=24;
                ctx.beginPath(); ctx.arc(sx,sy,this.r,0,Math.PI*2); ctx.fill();
                // Crown spikes
                ctx.fillStyle=this.flash>0?'#fff':'#44eeff';
                for(let i=0;i<7;i++){
                    const ca=(Math.PI*2/7)*i+this.angle*0.2;
                    const ix=sx+Math.cos(ca)*(this.r+4), iy=sy+Math.sin(ca)*(this.r+4);
                    ctx.beginPath();
                    ctx.moveTo(ix,iy);
                    ctx.lineTo(ix+Math.cos(ca+0.3)*14,iy+Math.sin(ca+0.3)*14);
                    ctx.lineTo(ix+Math.cos(ca)*22,iy+Math.sin(ca)*22);
                    ctx.lineTo(ix+Math.cos(ca-0.3)*14,iy+Math.sin(ca-0.3)*14);
                    ctx.closePath(); ctx.fill();
                }
                // Orbiting ice crystals
                ctx.globalAlpha=0.85;
                for(let i=0;i<3;i++){
                    const ca=(Math.PI*2/3)*i+this.angle*1.5;
                    const cx2=sx+Math.cos(ca)*(this.r+26), cy2=sy+Math.sin(ca)*(this.r+26);
                    ctx.fillStyle='#88ffff';
                    ctx.save(); ctx.translate(cx2,cy2); ctx.rotate(ca*2);
                    ctx.fillRect(-5,-10,10,20); ctx.restore();
                }
                ctx.globalAlpha=0.3; ctx.strokeStyle='#44eeff'; ctx.lineWidth=2;
                ctx.beginPath(); ctx.arc(sx,sy,this.r+36,0,Math.PI*2); ctx.stroke();
            } else {
                // EL ABISMO — void orb with distortion rings
                const vt = Date.now()*0.002;
                ctx.fillStyle = this.flash>0?'#fff':'#330055';
                ctx.shadowColor='#8800ff'; ctx.shadowBlur=30;
                ctx.beginPath(); ctx.arc(sx,sy,this.r,0,Math.PI*2); ctx.fill();
                // Distorted outer rings
                for(let ring=0;ring<4;ring++){
                    const rr=this.r+(ring+1)*12+Math.sin(vt*3+ring)*5;
                    ctx.globalAlpha=0.18-ring*0.03;
                    ctx.strokeStyle='#bb00ff'; ctx.lineWidth=2;
                    ctx.beginPath(); ctx.arc(sx,sy,rr,0,Math.PI*2); ctx.stroke();
                }
                // Void cracks radiating out
                ctx.globalAlpha=0.5; ctx.strokeStyle='#ffffff'; ctx.lineWidth=1;
                for(let i=0;i<8;i++){
                    const ca=(Math.PI*2/8)*i+this.angle*0.6;
                    const len=this.r*0.7+Math.sin(vt*4+i)*8;
                    ctx.beginPath(); ctx.moveTo(sx,sy);
                    ctx.lineTo(sx+Math.cos(ca)*len,sy+Math.sin(ca)*len); ctx.stroke();
                }
                // Bright void core
                ctx.globalAlpha=0.8;
                const cg=ctx.createRadialGradient(sx,sy,0,sx,sy,this.r*0.6);
                cg.addColorStop(0,'rgba(255,255,255,0.9)');
                cg.addColorStop(0.4,'rgba(180,0,255,0.5)');
                cg.addColorStop(1,'transparent');
                ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(sx,sy,this.r*0.6,0,Math.PI*2); ctx.fill();
            }
            ctx.shadowBlur=0; ctx.globalAlpha=0.9;
            // Shared: white core dot + HP bar above
            ctx.fillStyle='#ffffff';
            ctx.beginPath(); ctx.arc(sx,sy,this.r*0.2,0,Math.PI*2); ctx.fill();
        }
        if (this.elite && !this.isBoss) {
            ctx.globalAlpha = 0.4;
            ctx.strokeStyle = '#ffaa00'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(sx,sy,this.r+8,0,Math.PI*2); ctx.stroke();
        }

        // HP bar (non-boss)
        if (!this.isBoss && this.hp < this.maxHp) {
            ctx.shadowBlur = 0; ctx.globalAlpha = 1;
            const bw = this.r * 2.2, bh = 4;
            ctx.fillStyle = '#180008';
            ctx.fillRect(sx-bw/2, sy-this.r-9, bw, bh);
            ctx.fillStyle = this.elite ? '#ffaa00' : this.color;
            ctx.fillRect(sx-bw/2, sy-this.r-9, bw*(this.hp/this.maxHp), bh);
        }
        ctx.restore();
    }

    _drawStar(ctx, cx, cy, spikes, outer, inner) {
        let rot = -Math.PI/2; const step = Math.PI/spikes;
        ctx.beginPath(); ctx.moveTo(cx, cy-outer);
        for (let i=0; i<spikes; i++) {
            ctx.lineTo(cx+Math.cos(rot)*outer, cy+Math.sin(rot)*outer); rot+=step;
            ctx.lineTo(cx+Math.cos(rot)*inner, cy+Math.sin(rot)*inner); rot+=step;
        }
        ctx.closePath();
    }

    explode() {
        const R = 100;
        Game.enemies.forEach(e => {
            if (e !== this && M.dist(this.x, this.y, e.x, e.y) < R) {
                e.hp -= 35; e.flash = 0.2;
            }
        });
        if (M.dist(this.x,this.y,Game.player.x,Game.player.y)<R && Game.player.iframe<=0) {
            const expDmg = Math.min(22, Math.ceil(Game.player.maxHp * 0.28));
            Game.player.hp -= expDmg; Game.player.iframe = 0.5; Game.shake = 12;
        }
        Game.spawnParticle(this.x, this.y, '#00ff88', 20);
        for (let i=0;i<10;i++) {
            const a = (Math.PI*2/10)*i;
            Game.enemyProjectiles.push({x:this.x,y:this.y,vx:Math.cos(a)*6,vy:Math.sin(a)*6,r:6,dmg:0,life:18,color:'#00ff88'});
        }
    }
}
