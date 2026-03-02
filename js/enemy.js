// ── enemy.js ── Enemy class ──
'use strict';

class Enemy extends Entity {
    constructor(x, y, data, diffMult) {
        super(x, y, data.r, data.hp * diffMult, data.color);
        this.type        = data.type;
        this.speed       = data.speed * (0.88 + Math.random() * 0.24) * Math.min(diffMult, 2.2);
        this.baseSpeed   = this.speed;
        this.dmg         = data.dmg * diffMult;
        this.xpValue     = data.xp;
        this.behaviorTimer = 0;
        this.swingAngle  = 0;
        this.isBoss      = data.isBoss || false;
        this.patternTimer = 0; this.patternPhase = 0;
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
            this.x = px + Math.cos(a2)*120; this.y = py + Math.sin(a2)*120;
            Game.spawnParticle(this.x, this.y, '#cc44ff', 8);
        }
        this.x += Math.cos(ang)*this.speed*0.8*dt;
        this.y += Math.sin(ang)*this.speed*0.8*dt;
    }

    _updateBoss(dt, px, py, dist, ang) {
        this.patternTimer += dt; this.angle += dt * 0.8;
        if (this.charging) {
            this.x += this.chargeVx*dt; this.y += this.chargeVy*dt;
            this.chargeDur -= dt; if (this.chargeDur <= 0) this.charging = false;
        } else {
            this.x += Math.cos(ang)*this.speed*dt; this.y += Math.sin(ang)*this.speed*dt;
        }
        if (this.patternTimer >= 3.5) {
            this.patternTimer = 0; this.patternPhase = (this.patternPhase+1)%3;
            if (this.patternPhase === 0) {
                // Charge
                this.charging = true;
                this.chargeVx = Math.cos(ang)*620; this.chargeVy = Math.sin(ang)*620;
                this.chargeDur = 0.4; Game.shake = 10;
            } else if (this.patternPhase === 1) {
                // 360° burst
                const N = 16;
                for (let i=0;i<N;i++) {
                    const a = (Math.PI*2/N)*i;
                    Game.enemyProjectiles.push({x:this.x,y:this.y,vx:Math.cos(a)*3,vy:Math.sin(a)*3,r:9,dmg:14,life:280,color:'#ff1144'});
                }
                Game.shake = 14;
            } else {
                // Spiral burst
                for (let i=0;i<8;i++) {
                    const a = (Math.PI*2/8)*i + this.angle;
                    Game.enemyProjectiles.push({x:this.x,y:this.y,vx:Math.cos(a)*4.5,vy:Math.sin(a)*4.5,r:7,dmg:10,life:200,color:'#ff8800'});
                }
            }
        }
    }

    draw(ctx, off) {
        const sx = this.x - off.x + canvas.width/2;
        const sy = this.y - off.y + canvas.height/2;
        if (sx < -80 || sx > canvas.width+80 || sy < -80 || sy > canvas.height+80) return;

        ctx.save();
        const col = this.flash > 0 ? '#ffffff' : this.color;
        ctx.fillStyle   = col;
        ctx.shadowColor = this.isBoss ? '#ff0033' : (this.elite ? '#ffaa00' : this.color);
        ctx.shadowBlur  = CONFIG.IS_MOBILE ? 6 : (this.isBoss ? 24 : (this.elite ? 16 : 10));

        ctx.beginPath();
        if (this.type === 'charger' || this.elite) {
            this._drawStar(ctx, sx, sy, 5, this.r, this.r*0.42);
        } else if (this.type === 'exploder') {
            ctx.rect(sx-this.r, sy-this.r, this.r*2, this.r*2);
        } else if (this.type === 'phantom') {
            ctx.globalAlpha = 0.7 + Math.sin(Date.now()*0.005)*0.2;
            ctx.arc(sx, sy, this.r, 0, Math.PI*2);
        } else {
            ctx.arc(sx, sy, this.r, 0, Math.PI*2);
        }
        ctx.fill();

        // Boss rings
        if (this.isBoss) {
            ctx.globalAlpha = 0.3;
            ctx.strokeStyle = '#ff6688'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(sx,sy,this.r+12+Math.sin(this.angle)*4,0,Math.PI*2); ctx.stroke();
            ctx.beginPath(); ctx.arc(sx,sy,this.r+22+Math.cos(this.angle)*4,0,Math.PI*2); ctx.stroke();
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
            Game.player.hp -= 22; Game.player.iframe = 0.5; Game.shake = 12;
        }
        Game.spawnParticle(this.x, this.y, '#00ff88', 20);
        for (let i=0;i<10;i++) {
            const a = (Math.PI*2/10)*i;
            Game.enemyProjectiles.push({x:this.x,y:this.y,vx:Math.cos(a)*6,vy:Math.sin(a)*6,r:6,dmg:0,life:18,color:'#00ff88'});
        }
    }
}
