// ── game.js ── Main Game Controller ──
'use strict';

const Game = {
    canvas:null, ctx:null, minimapCtx:null,
    lw: 800, lh: 600,   // logical canvas dimensions — set by resize(), used everywhere
    player:null,
    enemies:[], projectiles:[], gems:[], particles:[], decorations:[],
    texts:[], enemyProjectiles:[], powerUps:[], lightningBolts:[],
    currentBoss:null,
    state:'LOADING',          // LOADING → LANDING → START → PLAY → PAUSE → LEVELUP → GAMEOVER
    gameMode: 'normal',        // 'normal' | 'frenetic'
    kills:0, time:0, combo:0, comboTimer:0,
    shake:0, difficulty:1, lastMinute:0,
    powerUpTimer:0, spawnTimer:0,
    input:{ x:0, y:0, up:0, down:0, left:0, right:0 },
    joyId:null, joyStart:{x:0,y:0},
    selectedChar:null, lastTime_loop:0,
    burstLevel:1, burstCharges:1, burstMaxCharges:1, burstMaxCooldown:120, burstCooldown:0,
    hitstopFrames:0, dmgFlash:0,

    bossKills:0,
    // ── Magic Survival mechanics ──
    deathBar: 0,           // 0-100: fills over time → triggers elite wave at 100
    deathBarTimer: 0,
    runes: [],             // field rune pickups
    runeSpawnTimer: 0,
    killMilestones:[25,50,100,200,500],
    nextKillMilestone:0,
    landingParticles:[],
    landingCtx:null,

    // ─────────────────────────── INIT ────────────────────────────
    init() {
        canvas          = document.getElementById('game');
        this.canvas     = canvas;
        this.ctx        = canvas.getContext('2d', { alpha:false });
        this.minimapCtx = document.getElementById('minimap-canvas').getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.runLoadingScreen();
        this.initDecorations();
        requestAnimationFrame(t => this.loop(t));
    },

    resize() {
        const W   = window.innerWidth;
        const H   = window.innerHeight;
        const dpr = window.devicePixelRatio || 1;

        // Mobile zoom: player sees more world to dodge
        const minDim = Math.min(W, H);
        if      (minDim < 420) this.zoom = 0.48;
        else if (minDim < 520) this.zoom = 0.52;
        else if (minDim < 768) this.zoom = 0.70;
        else                   this.zoom = 1;

        // Logical draw space (all drawing code uses these dimensions)
        Game.lw = Math.round(W / this.zoom);
        Game.lh = Math.round(H / this.zoom);

        // Physical canvas pixels = logical × DPR → crisp on Retina/HiDPI
        canvas.width  = Math.round(Game.lw * dpr);
        canvas.height = Math.round(Game.lh * dpr);

        // CSS size = real viewport
        canvas.style.width  = W + 'px';
        canvas.style.height = H + 'px';

        // Scale so 1 draw unit = 1 logical pixel (DPR handled internally)
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this._dpr = dpr;
    },

    // ─────────────────────────── LOADING SCREEN ──────────────────
    // ── Delegated to Intro module ──
    runLoadingScreen() {
        Intro.startLoading(() => {
            Intro.showTitle(() => {
                this.showCharSelect();
            });
        });
    },

    showCharSelect() {
        this.state = 'START';
        this.initCharSelection();
        this.initControls();
        document.getElementById('start-screen').style.display = 'flex';
    },

    // ─────────────────────────── UI SETUP ────────────────────────
    initCharSelection() {
        const grid = document.getElementById('char-selection');
        grid.innerHTML = '';
        CHARACTERS.forEach(c => {
            const card = document.createElement('div');
            card.className = 'char-card';

            // Convert dot stats to bar percentages
            const statBars = Object.entries(c.stats).map(([k, v]) => {
                const filled = (v.match(/●/g) || []).length;
                const total  = filled + (v.match(/○/g) || []).length;
                const pct    = Math.round(filled / total * 100);
                const labels = { hp:'VIDA', spd:'VEL', atk:'ATK' };
                const colors = { hp:'#ff4466', spd:'#44ff88', atk:'#ffaa22' };
                return `<div class="csr-row">
                    <span class="csr-label">${labels[k]||k.toUpperCase()}</span>
                    <div class="csr-bar"><div class="csr-fill" style="width:${pct}%;background:${colors[k]||'#aaa'};box-shadow:0 0 6px ${colors[k]||'#aaa'}"></div></div>
                    <span class="csr-num">${filled}/${total}</span>
                </div>`;
            }).join('');

            const weaponName = UPGRADES_DB[c.weapon]?.name || c.weapon;
            const weaponIcon = UPGRADES_DB[c.weapon]?.icon || '?';
            const weaponDesc = UPGRADES_DB[c.weapon]?.desc || '';
            card.innerHTML = `
                <div class="char-icon">${c.icon}</div>
                <h3>${c.name}</h3>
                <p>${c.desc}</p>
                <div class="char-stats-bars">${statBars}</div>
                ${c.id !== 'warrior' ? `<div class="char-weapon-tag" title="${weaponDesc}">${weaponIcon} ${weaponName}</div>` : ''}
            `;
            const sel = () => {
                document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedChar = c;
            };
            card.onclick = sel;
            card.addEventListener('touchend', e => { e.preventDefault(); sel(); });
            grid.appendChild(card);
        });
        this.selectedChar = CHARACTERS[0];
        grid.children[0].classList.add('selected');
    },

    initControls() {
        const startBtn = document.getElementById('btn-start-game');
        if (startBtn._bound) return;
        startBtn._bound = true;
        startBtn.onclick = () => this.start();
        startBtn.addEventListener('touchend', e => { e.preventDefault(); this.start(); });

        // Leaderboard trigger buttons (start screen + game over)
        const openLB = () => {
            if (typeof Auth !== 'undefined') Auth.renderLeaderboard('lb-list');
            document.getElementById('lb-modal').style.display = 'flex';
        };
        const closeLB = () => {
            document.getElementById('lb-modal').style.display = 'none';
        };
        ['btn-show-lb','go-show-lb','pause-show-lb'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) { btn.onclick = openLB; btn.ontouchend = e => { e.preventDefault(); openLB(); }; }
        });
        ['lb-close-btn','lb-close-btn2'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) { btn.onclick = closeLB; }
        });

        // Mode selector buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            const select = () => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('mode-active'));
                btn.classList.add('mode-active');
                this.gameMode = btn.dataset.mode;
            };
            btn.onclick = select;
            btn.addEventListener('touchend', e => { e.preventDefault(); select(); });
        });

        const pauseBtn = document.getElementById('pause-btn');
        pauseBtn.onclick = () => this.togglePause();
        pauseBtn.addEventListener('touchend', e => { e.preventDefault(); this.togglePause(); });

        document.addEventListener('touchstart', () => AudioEngine.resume(), { once:true });

        // Joystick
        const joyBase = document.getElementById('joy-base');
        joyBase.addEventListener('touchstart', e => {
            e.preventDefault();
            const t = e.changedTouches[0];
            this.joyId = t.identifier;
            const rect = joyBase.getBoundingClientRect();
            this.joyStart = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }, { passive:false });

        window.addEventListener('touchmove', e => {
            if (this.joyId === null) return;
            for (const t of e.changedTouches) {
                if (t.identifier === this.joyId) {
                    const dx = t.clientX - this.joyStart.x;
                    const dy = t.clientY - this.joyStart.y;
                    const dist = Math.hypot(dx, dy), max = 62;
                    this.input.x = dx / Math.max(dist, max);
                    this.input.y = dy / Math.max(dist, max);
                    const stick = document.getElementById('stick');
                    stick.style.transform = `translate(calc(-50% + ${M.clamp(dx,-max,max)}px), calc(-50% + ${M.clamp(dy,-max,max)}px))`;
                }
            }
        });

        window.addEventListener('touchend', e => {
            for (const t of e.changedTouches) {
                if (t.identifier === this.joyId) {
                    this.joyId  = null;
                    this.input.x = 0; this.input.y = 0;
                    document.getElementById('stick').style.transform = 'translate(-50%,-50%)';
                }
            }
        });

        document.getElementById('btn-burst').addEventListener('touchstart', e => { e.preventDefault(); this.triggerBurst(); }, { passive:false });
        document.getElementById('btn-burst').addEventListener('click', () => this.triggerBurst());
        window.addEventListener('keydown', e => { if (e.key === ' ') { e.preventDefault(); this.triggerBurst(); } });
        window.addEventListener('keydown', e => this.handleKey(e, true));
        window.addEventListener('keyup',   e => this.handleKey(e, false));
    },

    handleKey(e, isDown) {
        const v = isDown ? 1 : 0;
        if (e.key==='ArrowUp'    || e.key==='w' || e.key==='W') this.input.up    = v;
        if (e.key==='ArrowDown'  || e.key==='s' || e.key==='S') this.input.down  = v;
        if (e.key==='ArrowLeft'  || e.key==='a' || e.key==='A') this.input.left  = v;
        if (e.key==='ArrowRight' || e.key==='d' || e.key==='D') this.input.right = v;
        let kx = (this.input.right||0) - (this.input.left||0);
        let ky = (this.input.down||0)  - (this.input.up||0);
        const mag = Math.hypot(kx, ky);
        if (mag > 0) { this.input.x = kx/mag; this.input.y = ky/mag; }
        else if (this.joyId === null) { this.input.x = 0; this.input.y = 0; }
    },

    // ─────────────────────────── BURST ───────────────────────────
    triggerBurst() {
        if (this.state !== 'PLAY' || !this.player || this.burstCharges <= 0) return;
        this.burstCharges--;
        this.burstCooldown = this.burstMaxCooldown;

        const charId = this.player.charData?.id || '';
        const dmgBase = (40 + this.burstLevel * 18) * this.player.stats.damageMult *
                        (this.player.activeBuffs.damage > 0 ? 2 : 1);

        if (charId === 'shaman') {
            // ── VORATH ULTRA: Tormenta de Rayos ─────────────────────
            this._ultraVorath(dmgBase);
        } else if (charId === 'warrior') {
            // ── ALARIC ULTRA: Tormenta de Látigos ────────────────────
            this._ultraAlaric(dmgBase);
        } else if (charId === 'mage') {
            // ── ZALE ULTRA: Frenesi Arcano ────────────────────────────
            this._ultraZale(dmgBase);
        } else if (charId === 'rogue') {
            // ── KAEL ULTRA: Sombra Letal ──────────────────────────────
            this._ultraKael();
        } else if (charId === 'cleric') {
            // ── ELORA ULTRA: Erupción Divina ──────────────────────────
            this._ultraElora(dmgBase);
        } else if (charId === 'hunter') {
            // ── RYXA ULTRA: Lluvia Venenosa ───────────────────────────
            this._ultraRyxa(dmgBase);
        } else {
            // ── DEFAULT ULTRA: radial bolt burst ────────────────────
            const N = 8 + this.burstLevel * 2;
            for (let i = 0; i < N; i++) {
                const a = (Math.PI * 2 / N) * i;
                this.projectiles.push({ type:'bolt', x:this.player.x, y:this.player.y,
                    vx:Math.cos(a)*520, vy:Math.sin(a)*520, r:9, life:1.4, dmg:dmgBase, color:'#ffd700' });
            }
            this.shake = 10;
        }
        AudioEngine.sfxLevel();
        this._updateBurstUI();
    },

    _ultraVorath(dmgBase) {
        const strikes = 8 + this.burstLevel;
        const stunDur = 1.8 + this.burstLevel * 0.3;
        const areaR   = 90;
        const dmg     = dmgBase * 1.6;

        for (let i = 0; i < strikes; i++) {
            setTimeout(() => {
                if (this.state !== 'PLAY') return;

                // Random position around player
                const angle  = Math.random() * Math.PI * 2;
                const radius = 80 + Math.random() * 320;
                const tx = this.player.x + Math.cos(angle) * radius;
                const ty = this.player.y + Math.sin(angle) * radius;

                // Screen shake per strike
                this.shake = Math.max(this.shake, 8);

                // Visual: lightning bolt stored in lightningBolts array
                this.lightningBolts.push({
                    x: tx, y: ty,
                    life: 0.55,
                    maxLife: 0.55,
                    r: areaR,
                    segments: this._buildLightningSegments(tx, ty),
                });

                // Spawn glow particles
                for (let p = 0; p < 10; p++) {
                    this.spawnParticle(
                        tx + (Math.random()-0.5)*areaR,
                        ty + (Math.random()-0.5)*areaR,
                        '#88ddff', 6
                    );
                }

                // Damage + stun all enemies in area
                for (const e of this.enemies) {
                    if (e.dead) continue;
                    const dx = e.x - tx, dy = e.y - ty;
                    if (dx*dx + dy*dy < (areaR + e.r) * (areaR + e.r)) {
                        e.takeDamage(dmg);
                        // Stun: freeze speed temporarily
                        e._stunTimer = stunDur;
                        e._preStunSpeed = e.speed;
                        e.speed = 0;
                        this.spawnParticle(e.x, e.y, '#ffffff', 8);
                    }
                }
            }, i * 120);
        }
        // Big shake at start
        this.shake = 18;
    },

    _ultraAlaric(dmgBase) {
        const dmg     = dmgBase * 1.5;
        const whipLen = 260;                       // 2× normal whip length
        const arc     = Math.PI * 1.1;             // sweep arc per whip
        const numWhips = 5;

        // Launch 5 whips at evenly spaced angles
        for (let i = 0; i < numWhips; i++) {
            const baseAngle = (Math.PI * 2 / numWhips) * i;

            // Store ultra whip visual + hit data
            this.ultraWhips = this.ultraWhips || [];
            this.ultraWhips.push({
                angle:    baseAngle,
                arc:      arc,
                len:      whipLen,
                phase:    0,
                maxPhase: 1,
                hitSet:   new Set(),
                dmg:      dmg,
                color:    '#ff88cc',
            });
        }

        // Deal damage via whip sweep ticks (handled in update)
        this.shake = 14;
        AudioEngine.sfxLevel();
    },

    _ultraZale(dmgBase) {
        const dmg       = dmgBase * 1.4;
        const maxShots  = Math.min(20, 8 + this.burstLevel * 3);  // 8–20 shots
        const VARIANTS  = ['boltSwirl', 'boltStar', 'boltPulse'];

        // Activate double fire-rate buff
        this.zaleUltraTimer = 3.0;

        // Sort all enemies by distance, pick up to maxShots targets (repeat closer ones if needed)
        const sorted = [...this.enemies]
            .filter(e => !e.dead)
            .sort((a, b) =>
                M.dist(this.player.x, this.player.y, a.x, a.y) -
                M.dist(this.player.x, this.player.y, b.x, b.y)
            );

        // Build shot list — fill up to maxShots cycling through available enemies
        const shots = [];
        for (let i = 0; i < maxShots; i++) {
            if (sorted.length === 0) break;
            shots.push(sorted[i % sorted.length]);
        }

        // Fire each shot with a short stagger (60ms apart) so they stream out
        shots.forEach((target, i) => {
            setTimeout(() => {
                if (this.state !== 'PLAY' || target.dead) return;

                const px  = this.player.x, py = this.player.y;
                const ang = M.angle(px, py, target.x, target.y);

                // Small random spread so multi-shots to same enemy look different
                const spread = (Math.random() - 0.5) * 0.18;

                // Muzzle flash particle burst at player position
                for (let p = 0; p < 4; p++) {
                    const pa = ang + (Math.random() - 0.5) * 0.8;
                    this.spawnParticle(
                        px + Math.cos(ang) * 20,
                        py + Math.sin(ang) * 20,
                        '#88aaff', 3
                    );
                }

                this.projectiles.push({
                    type:  VARIANTS[i % 3],
                    x: px, y: py,
                    vx: Math.cos(ang + spread) * 580,
                    vy: Math.sin(ang + spread) * 580,
                    r: 10, life: 2.4, dmg,
                    color: '#4488ff',
                    born:  Date.now(),
                    zaleUltra: true,   // flag for extra trail rendering
                    targetId:  target, // track for lock-on line
                });

                this.shake = Math.max(this.shake, 4);
            }, i * 65);
        });

        this.shake = 16;
    },

    _ultraKael() {
        const dur = 6 + this.burstLevel;   // buff duration in seconds
        // -10% incoming damage = +10% reduction equivalent via damageMult
        // +10% attack speed via kaelUltraTimer ticking weapons faster
        // +10% movement speed stacked on top of existing logic
        this.player.kaelUltraDmgReduct = dur;   // countdown timer
        this.player.kaelUltraAttack    = dur;
        this.player.kaelUltraSpeed     = dur;

        // Visual flash
        this.shake = 8;
        for (let i = 0; i < 14; i++) {
            const a = (Math.PI*2/14)*i;
            this.spawnParticle(
                this.player.x + Math.cos(a)*30,
                this.player.y + Math.sin(a)*30,
                '#44ffcc', 5
            );
        }
    },

    _ultraElora(dmgBase) {
        const dmg      = dmgBase * 0.7;       // reduced damage per hit
        const range    = 160 + this.burstLevel * 20;
        const numCones = 8;                   // 8 directions = full 360°
        const coneArc  = (Math.PI * 2) / numCones;

        // Store active ultra cones for rendering
        this.eloraUltraCones = [];
        for (let i = 0; i < numCones; i++) {
            this.eloraUltraCones.push({
                angle:   (Math.PI * 2 / numCones) * i,
                arc:     coneArc * 0.9,
                range,
                phase:   0,
                hitSet:  new Set(),
                dmg,
            });
        }
        this.eloraUltraTimer = 0.35;  // animation duration

        // Launch spears in 8 directions (reduced damage)
        const spearDmg = dmgBase * 0.45;
        for (let i = 0; i < numCones; i++) {
            const a = (Math.PI * 2 / numCones) * i;
            this.projectiles.push({
                type:  'holySpear',
                x: this.player.x, y: this.player.y,
                vx: Math.cos(a) * 420, vy: Math.sin(a) * 420,
                r: 7, life: 1.8, dmg: spearDmg,
                color: '#ffffaa',
            });
        }

        this.shake = 14;
        // Holy sound burst
        AudioEngine.sfxLevel();
    },

    _ultraRyxa(dmgBase) {
        const count   = 10;
        const dmg     = dmgBase * 0.85;       // per arrow
        const poisonDmg = dmgBase * 0.12;     // poison tick damage

        // Sort enemies by distance — prioritize nearest
        const sorted = [...this.enemies]
            .filter(e => !e.dead)
            .sort((a, b) =>
                M.dist(this.player.x, this.player.y, a.x, a.y) -
                M.dist(this.player.x, this.player.y, b.x, b.y)
            );

        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                if (this.state !== 'PLAY') return;

                // Pick target cycling through nearest enemies
                const target = sorted.length
                    ? sorted[i % sorted.length]
                    : null;

                let ang;
                if (target && !target.dead) {
                    // Small spread per arrow so burst looks like a volley
                    const spread = (Math.random() - 0.5) * 0.22;
                    ang = M.angle(this.player.x, this.player.y, target.x, target.y) + spread;
                } else {
                    ang = (Math.PI * 2 / count) * i;
                }

                // Muzzle particle
                this.spawnParticle(
                    this.player.x + Math.cos(ang) * 22,
                    this.player.y + Math.sin(ang) * 22,
                    '#44ff88', 3
                );

                this.projectiles.push({
                    type:       'poisonArrow',
                    x: this.player.x, y: this.player.y,
                    vx: Math.cos(ang) * 600, vy: Math.sin(ang) * 600,
                    r: 6, life: 1.6, dmg,
                    poison: true,
                    poisonDmg,
                    color: '#44ff44',
                });
            }, i * 75);
        }

        this.shake = 10;
    },

    _buildLightningSegments(tx, ty) {
        // Build zigzag segments from sky to target
        const segs = [];
        const topY = ty - 400;
        let cx = tx + (Math.random()-0.5)*40, cy = topY;
        const steps = 8;
        for (let s = 0; s < steps; s++) {
            const nx = tx + (Math.random()-0.5)*(60*(1-s/steps));
            const ny = topY + (ty - topY) * ((s+1)/steps);
            segs.push({ x1:cx, y1:cy, x2:nx, y2:ny });
            cx = nx; cy = ny;
        }
        return segs;
    },

    _updateBurstUI() {
        const btn = document.getElementById('btn-burst');
        if (!btn) return;
        if (this.burstCharges > 0) {
            btn.style.borderColor = '#ffd700';
            btn.style.boxShadow   = '0 0 22px #ffd700';
            btn.style.opacity     = '1';
            btn.innerHTML = 'ULTRA<br>' + '⚡'.repeat(this.burstCharges);
        } else {
            const pct = Math.round((1 - this.burstCooldown / this.burstMaxCooldown) * 100);
            btn.style.borderColor = '#444';
            btn.style.boxShadow   = 'none';
            btn.style.opacity     = '0.5';
            btn.innerHTML = `<span style="font-size:9px;color:#777">${pct}%</span>`;
        }
    },

    upgradeBurst() {
        this.burstLevel++;
        this.burstMaxCooldown = Math.max(25, this.burstMaxCooldown - 15);
        this.burstMaxCharges  = Math.min(3, this.burstMaxCharges + 1);
        this.burstCharges     = Math.min(this.burstMaxCharges, this.burstCharges + 1);
        this._updateBurstUI();
    },

    // ─────────────────────────── START ───────────────────────────
    start() {
        AudioEngine.init(); AudioEngine.resume();
        this.player           = new Player(this.selectedChar);
        this.enemies          = []; this.projectiles       = []; this.gems             = [];
        this.particles        = []; this.texts             = []; this.enemyProjectiles = [];
        this.powerUps         = []; this.lightningBolts    = []; this.currentBoss      = null;
        this.kills            = 0;  this.time              = 0;  this.difficulty       = 1;
        this.lastMinute       = 0;  this.combo             = 0;  this.comboTimer       = 0;
        this.shake            = 0;  this.powerUpTimer      = 0;  this.spawnTimer       = 0;
        this.burstLevel       = 1;  this.burstCharges      = 1;  this.burstMaxCharges  = 1;
        this.burstMaxCooldown = 120; this.burstCooldown    = 0;  this.bossKills        = 0;
        this.hitstopFrames = 0; this.dmgFlash = 0;
        this.deathBar = 0; this.deathBarTimer = 0;
        this._lastDeathBarKills = 0;
        this._levelupCooldown   = 0;
        this._gemMergeFrame     = 0;
        this.runes = []; this.runeSpawnTimer = 0;
        this.lifeOrbs = []; this.goldTimer = 0;
        this._wisps = null;
        this.nextKillMilestone = 0;
        // Ultra/boss state reset
        this.bossArena       = null;  this.bossArenaAlpha = 0;
        this.bossSpawning    = null;
        this.ultraWhips      = [];
        this.eloraUltraCones = null;  this.eloraUltraTimer = 0;
        this.zaleUltraTimer  = 0;
        this._fogDmgFlash    = 0;
        this._updateBurstUI();
        this.state = 'PLAY';
        document.getElementById('start-screen').style.display    = 'none';
        document.getElementById('boss-hud').style.display        = 'none';
        document.getElementById('gameover-screen').style.display = 'none';
        // Show player name in HUD
        if (typeof Auth !== 'undefined') Auth._showLoggedIn();

        // Show/hide frenetic badge
        const badge = document.getElementById('frenetic-badge');
        if (badge) badge.style.display = this.gameMode === 'frenetic' ? 'block' : 'none';
        AudioEngine.sfxPowerup();
        this.updateWeaponBar();
    },

    togglePause() {
        if (this.state === 'PLAY') {
            this.state = 'PAUSE';
            document.getElementById('pause-btn').textContent = '▶ REANUDAR';
            this._showPauseScreen();
        } else if (this.state === 'PAUSE') {
            this.state = 'PLAY';
            document.getElementById('pause-btn').textContent = '⏸ PAUSA';
            document.getElementById('pause-screen').style.display = 'none';
        }
    },

    _showPauseScreen() {
        const p = this.player;
        const m = Math.floor(this.time / 60), s = Math.floor(this.time % 60);
        const earnedCount = AchievementStore.getCount();
        const totalCount  = AchievementStore.getTotalCount();

        // Build achievement rows for pause screen
        const achRows = ACHIEVEMENT_DEFS.map(def => {
            const done = AchievementStore.isEarned(def.id);
            let progressHTML = '';
            if (!done && def.progress) {
                const [cur, max] = def.progress(this);
                const pct = Math.min(100, Math.round(cur / max * 100));
                progressHTML = `<div class="ach-progress-bar"><div class="ach-progress-fill" style="width:${pct}%"></div></div><span class="ach-progress-label">${cur}/${max}</span>`;
            }
            return `<div class="ach-row ${done ? 'ach-done' : 'ach-locked'}">
                <span class="ach-row-icon">${done ? def.icon : '🔒'}</span>
                <div class="ach-row-info">
                    <div class="ach-row-name">${done ? def.name : '???'}</div>
                    <div class="ach-row-desc">${done ? def.desc : (def.progress ? progressHTML : 'Desbloquea para ver')}</div>
                </div>
            </div>`;
        }).join('');

        document.getElementById('pause-stats').innerHTML = `
            <div class="pause-stat"><div class="ps-label">TIEMPO</div><div class="ps-value">${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}</div></div>
            <div class="pause-stat"><div class="ps-label">KILLS</div><div class="ps-value">${this.kills}</div></div>
            <div class="pause-stat"><div class="ps-label">NIVEL</div><div class="ps-value">${p.level}</div></div>
            <div class="pause-stat"><div class="ps-label">HP</div><div class="ps-value">${Math.ceil(p.hp)}/${p.maxHp}</div></div>
        `;

        // Achievement gallery section
        const gallery = document.getElementById('pause-ach-gallery');
        if (gallery) {
            document.getElementById('pause-ach-count').textContent = `${earnedCount} / ${totalCount} LOGROS`;
            gallery.innerHTML = achRows;
        }

        document.getElementById('pause-screen').style.display = 'flex';
    },

    // ─────────────────────────── HELPERS ─────────────────────────
    getClosestEnemy(x, y) {
        let closest = null, minDist = Infinity;
        for (const e of this.enemies) {
            const d = M.dist(x, y, e.x, e.y);
            if (d < minDist) { minDist = d; closest = e; }
        }
        return closest;
    },

    // New helper: only enemies within a max range
    getClosestEnemyInRange(x, y, range) {
        let closest = null, minDist = range;
        for (const e of this.enemies) {
            const d = M.dist(x, y, e.x, e.y);
            if (d < minDist) { minDist = d; closest = e; }
        }
        return closest;
    },

    spawnParticle(x, y, color, count = 6) {
        if (this.particles.length > (CONFIG.IS_MOBILE ? CONFIG.PARTICLE_LIMIT_MOBILE : CONFIG.PARTICLE_LIMIT)) return;
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 6;
            this.particles.push({
                x, y, color,
                vx: Math.cos(a)*s, vy: Math.sin(a)*s - Math.random()*1.5,
                gravity: 0.1 + Math.random()*0.1,
                friction: 0.9 + Math.random()*0.05,
                life: 0.6 + Math.random()*0.5, maxLife: 1.1,
                r: 2 + Math.random()*3
            });
        }
    },

    spawnText(x, y, value, isCrit = false) {
        this.texts.push({
            x, y,
            text:   isCrit ? `✦${value}` : `${value}`,
            life:   1.0, maxLife: 1.0,
            vy:     -(0.9 + Math.random()*0.5),
            vx:     (Math.random() - 0.5)*0.6,
            curve:  (Math.random() - 0.5)*0.025,
            isCrit
        });
    },

    spawnPowerUp(x, y) {
        const types  = ['shield','speed','damage'];
        const colors = { shield:'#44aaff', speed:'#44ff88', damage:'#ff4444' };
        const icons  = { shield:'🛡', speed:'⚡', damage:'🔥' };
        const t      = types[M.randInt(0, types.length - 1)];
        this.powerUps.push({ x, y, type:t, color:colors[t], icon:icons[t], r:14, pulse:0 });
    },

    _spawnRune() {
        const RUNE_TYPES = [
            { id:'invincible', icon:'🔮', color:'#aa66ff', label:'INVENCIBLE', glow:'rgba(170,102,255,' },
            { id:'magnet',     icon:'🧲', color:'#44ccff', label:'ATRACCIÓN',  glow:'rgba(68,204,255,' },
            { id:'clear',      icon:'💥', color:'#ff4422', label:'PURGAR',     glow:'rgba(255,68,34,'  },
            { id:'berserk',    icon:'⚡', color:'#ffdd00', label:'FRENESÍ',    glow:'rgba(255,221,0,'  },
            { id:'freeze',     icon:'❄️', color:'#88ddff', label:'CONGELAR',   glow:'rgba(136,221,255,'},
            { id:'drain',      icon:'🩸', color:'#ff2255', label:'DRENAJE',    glow:'rgba(255,34,85,'  },
        ];
        const type = RUNE_TYPES[Math.floor(Math.random() * RUNE_TYPES.length)];
        const a = Math.random() * Math.PI * 2;
        const d = M.rand(120, 280);
        this.runes.push({
            ...type,
            x: this.player.x + Math.cos(a) * d,
            y: this.player.y + Math.sin(a) * d,
            r: 16, pulse: 0, life: 18,
        });
    },

    _applyRune(rune) {
        AudioEngine.sfxPowerup();
        this.spawnParticle(rune.x, rune.y, rune.color, 20);
        this.showWaveMessage(`${rune.icon} ${rune.label}`);
        if (rune.id === 'invincible') {
            this.player.iframe = 6;
            this.player.activeBuffs.shield = 6;
        } else if (rune.id === 'magnet') {
            this.gems.forEach(g => { g.x = this.player.x; g.y = this.player.y; });
            this.lifeOrbs.forEach(lo => { lo.x = this.player.x; lo.y = this.player.y; });
        } else if (rune.id === 'clear') {
            const toClear = this.enemies.filter(e => !e.isBoss);
            const n = Math.floor(toClear.length * 0.8);
            for (let i = 0; i < n; i++) toClear[i].dead = true;
            this.shake = 18;
        } else if (rune.id === 'berserk') {
            this.player.activeBuffs.damage = 8;
            this.player.activeBuffs.speed  = 5;
        } else if (rune.id === 'freeze') {
            // Freeze all enemies 65% for 5 seconds
            for (const e of this.enemies) {
                if (e.isBoss) continue;
                if (!e._frozenBase) e._frozenBase = e.baseSpeed;
                e.speed = e.baseSpeed * 0.30;
                e._freezeTimer = 5;
                this.spawnParticle(e.x, e.y, '#88ddff', 3);
            }
            this.shake = 6;
        } else if (rune.id === 'drain') {
            // Leech up to 15 HP from every nearby enemy
            const drainRange = 320;
            let drained = 0;
            for (const e of this.enemies) {
                if (M.dist(this.player.x, this.player.y, e.x, e.y) < drainRange) {
                    const d = Math.min(e.hp * 0.35, 20);
                    e.hp -= d; e.flash = 0.35;
                    drained += d;
                    this.spawnParticle(e.x, e.y, '#ff2255', 4);
                    // Visual drain line
                    this.lightningBolts.push({ fromX:e.x, fromY:e.y, toX:this.player.x, toY:this.player.y, life:0.22, maxLife:0.22 });
                }
            }
            const healed = Math.min(Math.floor(drained * 0.45), this.player.maxHp - this.player.hp);
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + healed);
            if (healed > 0) this.spawnText(this.player.x, this.player.y-22, '+'+healed+' HP', false);
            this.shake = 10;
        } else if (rune.id === 'gold') {
            // Double XP gain for 15 seconds
            this.goldTimer = 15;
            this.showWaveMessage('✨ BONANZA 2× XP — 15s');
        }
    },

    _updateDeathBarHUD() {
        const bar = document.getElementById('death-bar-fill');
        if (bar) {
            bar.style.width = this.deathBar + '%';
            bar.classList.toggle('danger', this.deathBar > 75);
        }
        const pct = document.getElementById('death-bar-pct');
        if (pct) pct.textContent = Math.floor(this.deathBar) + '%';
    },

    _showRankAnnouncement(rank) {
        const medals = {1:'🥇', 2:'🥈', 3:'🥉'};
        const msg = rank <= 3
            ? `${medals[rank]} ¡PUESTO #${rank} EN EL RANKING!`
            : `🏆 RANKING #${rank}`;
        const el = document.getElementById('wave-indicator');
        if (el) {
            el.textContent       = msg;
            el.style.transition  = 'opacity 0s';
            el.style.opacity     = '1';
            el.style.color       = rank <= 3 ? '#ffd700' : '#aa88ff';
            // Fade out after 4 seconds
            setTimeout(() => {
                el.style.transition = 'opacity 0.8s';
                el.style.opacity    = '0';
                el.style.color      = '';
            }, 4000);
        }
    },

    showWaveMessage(msg) {
        const el = document.getElementById('wave-indicator');
        el.textContent    = msg;
        el.style.opacity  = '1';
        setTimeout(() => el.style.opacity = '0', 2000);
    },

    initDecorations() {
        for (let i = 0; i < 180; i++) {
            this.decorations.push({
                x:    M.rand(-4000, 4000),
                y:    M.rand(-4000, 4000),
                type: Math.random() > 0.5 ? 'rock' : 'crystal',
                size: M.rand(8, 32),
                hue:  M.randInt(240, 310)
            });
        }
    },

    // ─────────────────────────── SPAWN ───────────────────────────
    spawnEnemy(isBoss = false) {
        // Spawn well outside the visible area.
        // hw/hh = half the world canvas + generous margin so enemies
        // are never visible when they appear.
        // Spawn on a ring far outside the visible area — never on top of player
        // Spawn strictly outside visible area — min dist = screen diagonal + buffer
        const halfW = Game.lw / 2, halfH = Game.lh / 2;
        const screenCorner = Math.sqrt(halfW * halfW + halfH * halfH);
        const minSpawnDist = screenCorner + 80;
        const maxSpawnDist = minSpawnDist + 200;
        const spawnAngle   = Math.random() * Math.PI * 2;
        const spawnDist    = minSpawnDist + Math.random() * (maxSpawnDist - minSpawnDist);
        const x = this.player.x + Math.cos(spawnAngle) * spawnDist;
        const y = this.player.y + Math.sin(spawnAngle) * spawnDist;

        if (isBoss) {
            const bossIdx = this.bossKills % 4;
            const BOSS_DEFS = [
                { bossType:0, name:'⚠ EL COLOSO ⚠',    color:'#ff1133', r:44, speed:90,  dmg:18, xp:100 },
                { bossType:1, name:'⚠ LA TEJEDORA ⚠',  color:'#cc44ff', r:34, speed:130, dmg:14, xp:110 },
                { bossType:2, name:'⚠ EL LICHE ⚠',     color:'#44eeff', r:36, speed:115, dmg:16, xp:120 },
                { bossType:3, name:'⚠ EL ABISMO ⚠',    color:'#8800ff', r:40, speed:145, dmg:20, xp:140 },
            ];
            const bd      = BOSS_DEFS[bossIdx];
            const hpMult  = (this.gameMode === 'frenetic' ? 1.4 : 1);
            const bossHp  = (1200 + this.lastMinute * 400) * hpMult;

            // Despawn all regular enemies immediately
            this.enemies.forEach(en => { if (!en.isBoss) en.dead = true; });
            this.enemies = [];

            // Arena centered on player (locked here, not on boss)
            this.bossArena      = { x: this.player.x, y: this.player.y, r: 760, color: bd.color };
            this.bossArenaAlpha = 0;

            // Show HUD and warning immediately
            document.getElementById('boss-hud').style.display   = 'flex';
            document.getElementById('boss-name').textContent    = bd.name;
            document.getElementById('boss-bar-fill').style.width = '100%';
            this.shake = 22;
            AudioEngine.sfxBoss();
            this.showWaveMessage(bd.name);

            // 3-second ritual summon before boss becomes active
            this.bossSpawning = {
                timer:    3.0,
                x:        this.bossArena.x,
                y:        this.bossArena.y,
                bd,
                bossHp,
                color:    bd.color,
            };
            return;
        }

        const t    = this.time;
        let pool   = [ENEMY_TYPES[0], ENEMY_TYPES[0]];
        if (t > 30)  pool.push(ENEMY_TYPES[1], ENEMY_TYPES[1], ENEMY_TYPES[0]);
        if (t > 60)  pool.push(ENEMY_TYPES[1], ENEMY_TYPES[2]);
        if (t > 120) pool.push(ENEMY_TYPES[2], ENEMY_TYPES[2], ENEMY_TYPES[3]);
        if (t > 180) pool.push(ENEMY_TYPES[3], ENEMY_TYPES[4]);
        if (t > 240) pool.push(ENEMY_TYPES[4], ENEMY_TYPES[5]);
        if (t > 300) pool.push(ENEMY_TYPES[5], ENEMY_TYPES[5]);
        // New enemy types: berserk, necromancer, shadow — aparecen solo después de 5 minutos
        if (t > 300) pool.push(ENEMY_TYPES[6]);
        if (t > 360) pool.push(ENEMY_TYPES[7], ENEMY_TYPES[6]);
        if (t > 420) pool.push(ENEMY_TYPES[8], ENEMY_TYPES[8]);

        // Ranged enemies removed — only bosses can shoot projectiles
        pool = pool.filter(e => e.type !== 'ranged');
        if (!pool.length) pool = [ENEMY_TYPES[0]]; // fallback to swarm

        const data   = pool[M.randInt(0, pool.length - 1)];
        const hpMult = t < 60 ? 1 : 1 + (t - 60) / 180;
        const elite  = t > 120 && Math.random() < (this.gameMode === 'frenetic' ? 0.13 : 0.07);
        const enemy  = new Enemy(x, y, { ...data, elite }, hpMult);
        // Frenetic: enemies 35% faster and drop 50% more XP
        if (this.gameMode === 'frenetic') {
            enemy.speed    *= 1.35;
            enemy.baseSpeed = enemy.speed;
            enemy.xpValue   = Math.ceil(enemy.xpValue * 1.5);
        }
        this.enemies.push(enemy);
    },

    // ─────────────────────────── LEVEL UP ────────────────────────
    triggerLevelUp() {
        this.state = 'LEVELUP';
        AudioEngine.sfxLevel();
        const flash = document.getElementById('flash');
        flash.style.transition = 'opacity 0s'; flash.style.opacity = '1';
        setTimeout(() => { flash.style.transition = 'opacity 0.18s'; flash.style.opacity = '0'; }, 80);

        document.getElementById('txt-levelup-num').textContent = `NIVEL ${this.player.level} — ELIGE UNA MEJORA`;

        const container = document.getElementById('upgrade-options');
        container.innerHTML = '';
        const allKeys   = Object.keys(UPGRADES_DB).filter(k => !UPGRADES_DB[k].evolved);
        const unowned   = allKeys.filter(k => UPGRADES_DB[k].type==='weapon' && !this.player.weapons.find(w => w.id===k));
        const owned     = allKeys.filter(k => UPGRADES_DB[k].type==='weapon' &&  this.player.weapons.find(w => w.id===k));
        const stats     = allKeys.filter(k => UPGRADES_DB[k].type==='stat');
        const pool      = [...unowned, ...owned, ...stats].sort(() => Math.random() - 0.5).slice(0, 3);

        pool.forEach(k => {
            const up     = UPGRADES_DB[k];
            const isOwned = this.player.weapons.find(w => w.id === k);
            const div    = document.createElement('div');
            div.className = 'upgrade-item';
            const badge  = up.type === 'weapon'
                ? `<span class="upgrade-type-badge badge-weapon">${isOwned ? 'MEJORAR' : 'NUEVA'}</span>`
                : `<span class="upgrade-type-badge badge-stat">STAT</span>`;
            // Build bonus pills — show what this upgrade actually improves
            const bonusPills = (up.bonus || [])
                .map(b => `<span class="upgrade-bonus-pill">${b}</span>`)
                .join('');
            div.innerHTML = `${badge}<div class="upgrade-icon">${up.icon}</div><div class="upgrade-info"><h4>${up.name}${isOwned?' +':''}</h4><p>${up.desc}</p>${bonusPills ? `<div class="upgrade-bonus-row">${bonusPills}</div>` : ''}</div>`;
            const apply = () => {
                if (up.type === 'weapon') this.player.addWeapon(k);
                else this.player.applyStatUpgrade(k);
                this.state = 'PLAY';
                document.getElementById('levelup-screen').style.display = 'none';
                this.updateWeaponBar();
            };
            div.onclick = apply;
            div.addEventListener('touchend', e => { e.preventDefault(); apply(); });
            container.appendChild(div);
        });
        document.getElementById('levelup-screen').style.display = 'flex';
    },

    updateWeaponBar() {
        const bar = document.getElementById('weapon-bar');
        bar.innerHTML = '';
        if (!this.player) return;
        this.player.weapons.forEach(w => {
            const up  = UPGRADES_DB[w.id];
            const div = document.createElement('div');
            div.className = 'weapon-icon';
            div.innerHTML = `${up?.icon || '?'}<span class="wlvl">Lv${w.level}</span>`;
            div.title     = up?.name || w.id;
            bar.appendChild(div);
        });
    },

    // ─────────────────────────── ACHIEVEMENTS ────────────────────
    checkAchievements() {
        ACHIEVEMENT_DEFS.forEach(def => {
            if (AchievementStore.isEarned(def.id)) return; // already earned globally — skip
            if (def.condition(this)) {
                const justEarned = AchievementStore.earn(def.id); // returns true only if newly earned
                if (justEarned) this.showAchievement(def);
            }
        });
    },

    showAchievement(def) {
        AudioEngine.sfxAchievement();
        // Rich popup: icon + name + desc + progress counter
        const total = AchievementStore.getCount();
        const max   = AchievementStore.getTotalCount();
        document.getElementById('ach-icon').textContent = def.icon || '🏆';
        document.getElementById('ach-name').textContent = def.name;
        document.getElementById('ach-desc').textContent = def.desc;
        document.getElementById('ach-counter').textContent = `${total} / ${max}`;
        const popup = document.getElementById('achievement-popup');
        // Clear any running timer so queued achievements don't overlap strangely
        if (this._achTimer) clearTimeout(this._achTimer);
        popup.classList.add('show');
        this._achTimer = setTimeout(() => popup.classList.remove('show'), 3800);
    },

    showEvolutionBanner(def) {
        if (!def) return;
        AudioEngine.sfxLevel();
        AudioEngine.sfxAchievement();
        this.shake = Math.min(this.shake + 14, 20);
        this.dmgFlash = 0.2; // brief golden tint
        const flash = document.getElementById('flash');
        if (flash) {
            flash.style.background = 'rgba(255,215,0,0.22)';
            flash.style.transition = 'opacity 0s'; flash.style.opacity = '1';
            setTimeout(() => {
                flash.style.transition = 'opacity 0.45s'; flash.style.opacity = '0';
                flash.style.background = '';
            }, 220);
        }
        const el = document.getElementById('kill-milestone');
        if (el) {
            el.textContent       = `⚡ EVOLUCIÓN: ${def.name}`;
            el.style.color       = '#ffd700';
            el.style.fontSize    = '20px';
            el.style.transform   = 'translate(-50%,-50%) scale(1)';
            el.style.opacity     = '1';
            setTimeout(() => {
                el.style.transform = 'translate(-50%,-50%) scale(0)';
                el.style.opacity   = '0';
                el.style.fontSize  = '';
                el.style.color     = '';
            }, 3200);
        }
    },

    checkKillMilestone() {
        if (this.nextKillMilestone < this.killMilestones.length &&
            this.kills >= this.killMilestones[this.nextKillMilestone]) {
            const n  = this.killMilestones[this.nextKillMilestone++];
            const el = document.getElementById('kill-milestone');
            el.textContent              = `${n} KILLS!`;
            el.style.transform          = 'translate(-50%,-50%) scale(1)';
            el.style.opacity            = '1';
            setTimeout(() => {
                el.style.transform = 'translate(-50%,-50%) scale(0)';
                el.style.opacity   = '0';
            }, 1500);
        }
    },

    // ─────────────────────────── HUD ─────────────────────────────
    updateHUD() {
        const dt = this._dt || 0.016;   // fallback 60fps
        const p = this.player;
        document.getElementById('xp-fill').style.width   = (p.xp / p.nextXp * 100) + '%';
        document.getElementById('xp-label').textContent  = `XP ${Math.floor(p.xp)} / ${p.nextXp}`;
        document.getElementById('hp-fill').style.width   = Math.max(0, p.hp / p.maxHp * 100) + '%';
        document.getElementById('hp-label').textContent  = `HP ${Math.ceil(p.hp)} / ${p.maxHp}`;
        document.getElementById('txt-lvl').textContent   = p.level;
        document.getElementById('txt-kills').textContent = this.kills;
        const m = Math.floor(this.time / 60), s = Math.floor(this.time % 60);
        document.getElementById('txt-time').textContent  = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;

        const badge = document.getElementById('combo-badge');
        if (this.combo > 4) {
            badge.style.display = 'flex';
            document.getElementById('txt-combo').textContent = 'x' + this.combo;
        } else { badge.style.display = 'none'; }

        // Boss summoning ritual countdown (3s before boss goes active)
        if (this.bossSpawning && this.state === 'PLAY') {
            this.bossSpawning.timer -= dt;
            // Shake pulses every 0.5s during ritual
            if (Math.floor(this.bossSpawning.timer * 2) !== Math.floor((this.bossSpawning.timer + dt) * 2)) {
                this.shake = Math.max(this.shake, 6);
            }
            if (this.bossSpawning.timer <= 0) {
                // Summon the actual enemy now
                const bs = this.bossSpawning;
                this.bossSpawning = null;
                const data = { type:'boss', bossType:bs.bd.bossType, hp:bs.bossHp,
                               speed: bs.bd.speed * (this.gameMode==='frenetic'?1.25:1),
                               r:bs.bd.r, color:bs.bd.color, xp:bs.bd.xp, dmg:bs.bd.dmg, isBoss:true };
                const e = new Enemy(bs.x, bs.y, data, 1);
                this.enemies.push(e);
                this.currentBoss = e;
                this.shake = 28;
                // Big spawn particle burst
                for (let i = 0; i < 24; i++) {
                    const a = (Math.PI*2/24)*i;
                    this.spawnParticle(bs.x + Math.cos(a)*60, bs.y + Math.sin(a)*60, bs.color, 10);
                }
            }
        }

        // Boss bar
        if (this.currentBoss && !this.currentBoss.dead) {
            document.getElementById('boss-bar-fill').style.width = (this.currentBoss.hp / this.currentBoss.maxHp * 100) + '%';
        } else if (this.currentBoss && this.currentBoss.dead) {
            document.getElementById('boss-hud').style.display = 'none';
            this.bossKills++;
            this.currentBoss = null;
            this.bossArena = null; this._fogDmgFlash = 0;  // remove arena wall
            // Boss reward: full level up + full heal
            this.player.level++;
            this.player.xp = 0;
            const _lv2    = this.player.level;
            const _xpMult2 = _lv2 < 5 ? 1.55 : _lv2 < 12 ? 1.35 : 1.20;
            this.player.nextXp = Math.floor(this.player.nextXp * _xpMult2);
            this.player.hp = this.player.maxHp;
            this.spawnText(this.player.x, this.player.y - 40, '¡NIVEL UP!', true);
            this.spawnText(this.player.x, this.player.y - 65, '❤️ CURADO', false);
            this.triggerLevelUp();
        }

        // Buff pills
        const buffBar = document.getElementById('buff-bar');
        buffBar.innerHTML = '';
        const bd = { shield:{icon:'🛡',color:'#44aaff'}, speed:{icon:'⚡',color:'#44ff88'}, damage:{icon:'🔥',color:'#ff5555'} };
        for (const [k, v] of Object.entries(p.activeBuffs)) {
            if (v > 0) {
                const pill = document.createElement('div');
                pill.className         = 'buff-pill';
                pill.style.borderColor = bd[k].color;
                pill.style.color       = bd[k].color;
                pill.textContent       = `${bd[k].icon} ${v.toFixed(1)}s`;
                buffBar.appendChild(pill);
            }
        }
        // Gold timer pill
        if (this.goldTimer > 0) {
            const gp = document.createElement('div');
            gp.className = 'buff-pill';
            gp.style.borderColor = '#ffd700';
            gp.style.color       = '#ffd700';
            gp.textContent = `✨ ×2 XP ${this.goldTimer.toFixed(1)}s`;
            buffBar.appendChild(gp);
        }
    },

    // ─────────────────────────── MINIMAP ─────────────────────────
    drawMinimap() {
        const ctx   = this.minimapCtx;
        const W = 110, H = 110, range = 800;

        // Draw map floor texture as minimap background
        if (this._mapImg && this._mapImg.complete && this._mapImg.naturalWidth) {
            const iw = this._mapImg.naturalWidth, ih = this._mapImg.naturalHeight;
            // Scale: minimap shows 'range*2' world units across W pixels
            // So 1 world unit = W/(range*2) minimap pixels
            const scale = W / (range * 2);
            // Player world pos maps to minimap center
            // World origin offset on minimap
            const ox = W/2 - this.player.x * scale;
            const oy = H/2 - this.player.y * scale;
            const miw = iw * scale, mih = ih * scale;
            const startX = Math.floor((-ox) / miw) * miw + ox;
            const startY = Math.floor((-oy) / mih) * mih + oy;
            ctx.save();
            ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
            for (let tx = startX - miw; tx < W + miw; tx += miw) {
                for (let ty = startY - mih; ty < H + mih; ty += mih) {
                    ctx.drawImage(this._mapImg, tx, ty, miw, mih);
                }
            }
            // Dark overlay so dots stay visible
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
        } else {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, 0, W, H);
        }
        if (!this.player) return;
        const toMM = (wx, wy) => ({
            x: (wx - this.player.x) / range * W/2 + W/2,
            y: (wy - this.player.y) / range * H/2 + H/2
        });
        this.enemies.forEach(e => {
            const mm = toMM(e.x, e.y);
            if (mm.x<0||mm.x>W||mm.y<0||mm.y>H) return;
            ctx.fillStyle = e.isBoss ? '#ff0033' : '#ff4466';
            ctx.beginPath(); ctx.arc(mm.x, mm.y, e.isBoss?4:2, 0, Math.PI*2); ctx.fill();
        });
        this.gems.slice(0, 30).forEach(g => {
            const mm = toMM(g.x, g.y);
            if (mm.x<0||mm.x>W||mm.y<0||mm.y>H) return;
            const tier = g.tier || 0;
            ctx.fillStyle = tier === 2 ? '#ff8800' : tier === 1 ? '#ffcc00' : '#4488ff';
            const mr = tier === 2 ? 3 : tier === 1 ? 2 : 1;
            ctx.beginPath(); ctx.arc(mm.x, mm.y, mr, 0, Math.PI*2); ctx.fill();
        });
        this.lifeOrbs.forEach(lo => {
            const mm = toMM(lo.x, lo.y);
            if (mm.x<0||mm.x>W||mm.y<0||mm.y>H) return;
            ctx.fillStyle = '#44ff88'; ctx.shadowColor='#44ff88'; ctx.shadowBlur=3;
            ctx.beginPath(); ctx.arc(mm.x, mm.y, 2.5, 0, Math.PI*2); ctx.fill();
            ctx.shadowBlur = 0;
        });
        this.powerUps.forEach(pu => {
            const mm = toMM(pu.x, pu.y);
            if (mm.x<0||mm.x>W||mm.y<0||mm.y>H) return;
            ctx.fillStyle = pu.color; ctx.beginPath(); ctx.arc(mm.x, mm.y, 3, 0, Math.PI*2); ctx.fill();
        });
        ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#ff2255'; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(W/2, H/2, 4, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
    },

    // ─────────────────────────── UPDATE ──────────────────────────
    update(dt) {
        if (this.state !== 'PLAY') return;
        this._dt = dt;   // cached for updateHUD() called from draw()

        this.time += dt;
        // 3-phase difficulty curve — no permanent cap
        // Phase 1 (0-2 min): gentle ramp, player learns
        // Phase 2 (2-8 min): controlled acceleration
        // Phase 3 (8+ min): slow exponential, always increasing
        const _t = this.time;
        this.difficulty = _t < 120  ? 1 + _t / 120 * 0.5
                        : _t < 480  ? 1.5 + (_t - 120) / 360 * 2.0
                        :             3.5 * Math.pow(1.008, _t - 480);

        const curMin = Math.floor(this.time / 60);
        if (curMin > this.lastMinute) {
            this.lastMinute = curMin;
            // Normal: boss every 3 min. Frenético: every 2 min
            const bossInterval = (this.gameMode === 'frenetic') ? 2 : 3;
            if (this.lastMinute % bossInterval === 0 && !this.currentBoss && !this.bossSpawning) this.spawnEnemy(true);
        }

        if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.combo = 0; }

        if (this.burstCooldown > 0) {
            this.burstCooldown -= dt;
            if (this.burstCooldown <= 0) {
                this.burstCooldown = 0;
                if (this.burstCharges < this.burstMaxCharges) {
                    this.burstCharges++;
                    if (this.burstCharges < this.burstMaxCharges) this.burstCooldown = this.burstMaxCooldown;
                }
            }
            this._updateBurstUI();
        }

        this.player.update(dt, this.input);

        // Enemy spawn ramp — 3 phases matching difficulty curve
        const isFrenetic = this.gameMode === 'frenetic';
        // Aggressive spawn ramp — screen packed by 5-10 min
        const spawnBase = this.time < 60
            ? Math.max(0.5, 2.2 - this.time / 35)            // 0-1 min: quick start
            : this.time < 180
            ? Math.max(0.22, 0.9 - (this.time - 60) / 180)   // 1-3 min: builds fast
            : this.time < 360
            ? Math.max(0.12, 0.3 - (this.time - 180) / 500)  // 3-6 min: dense
            : Math.max(0.08, 0.16 - (this.time - 360) / 900); // 6+ min: relentless
        // Frenetic: 2.5x faster spawns
        const spawnInterval = isFrenetic ? spawnBase / 2.5 : spawnBase;
        const enemyLimit = CONFIG.IS_MOBILE ? CONFIG.ENEMY_LIMIT_MOBILE : CONFIG.ENEMY_LIMIT;
        const maxOnScreen = isFrenetic
            ? Math.min(enemyLimit, Math.floor(25 + this.time / 3))
            : Math.min(enemyLimit, Math.floor(12 + this.time / 4));
        this.spawnTimer += dt;
        // No regular enemy spawns while a boss is alive
        if (!this.currentBoss && this.spawnTimer >= spawnInterval && this.enemies.filter(e => !e.isBoss).length < maxOnScreen) {
            this.spawnTimer = 0;
            this.spawnEnemy();
        }

        // Power-up spawn — frenetic: 2× faster
        this.powerUpTimer += dt;
        const powerUpInterval = isFrenetic ? 7 : 14;
        if (this.powerUpTimer > powerUpInterval) {
            this.powerUpTimer = 0;
            const a = Math.random() * Math.PI * 2, d = M.rand(140, 320);
            this.spawnPowerUp(this.player.x + Math.cos(a)*d, this.player.y + Math.sin(a)*d);
            // Frenetic: spawn a second powerup occasionally
            if (isFrenetic && Math.random() < 0.4) {
                const a2 = Math.random() * Math.PI * 2;
                this.spawnPowerUp(this.player.x + Math.cos(a2)*d, this.player.y + Math.sin(a2)*d);
            }
        }

        // ── DEATH BAR ──────────────────────────────────────────────
        // Fills slowly over time. At 100 → elite wave. Min 45s between waves.
        if (!this._deathBarCooldown) this._deathBarCooldown = 0;
        if (this._deathBarCooldown > 0) {
            this._deathBarCooldown -= dt;
        } else {
            this.deathBar += dt * (1.2 + this.time / 300);  // much gentler rate
            if (this.kills > (this._lastDeathBarKills || 0) && this.kills % 10 === 0) {
                this._lastDeathBarKills = this.kills;
                this.deathBar += 4;
            }
        }
        if (this.deathBar >= 100) {
            this.deathBar = 0;
            this._deathBarCooldown = 45;   // at least 45s before next dark wave
            // Spawn a burst of elite enemies
            const burstCount = 4 + Math.floor(this.time / 60);
            for (let b = 0; b < burstCount; b++) {
                const angle2 = (Math.PI * 2 / burstCount) * b;
                const halfW2 = Game.lw / 2, halfH2 = Game.lh / 2;
                const dist2  = Math.sqrt(halfW2*halfW2 + halfH2*halfH2) + 100;
                const ex = this.player.x + Math.cos(angle2) * dist2;
                const ey = this.player.y + Math.sin(angle2) * dist2;
                const t2 = this.time;
                const pool2 = t2 < 120 ? [ENEMY_TYPES[0],ENEMY_TYPES[1]] : [ENEMY_TYPES[2],ENEMY_TYPES[3],ENEMY_TYPES[5]];
                const data2 = pool2[Math.floor(Math.random()*pool2.length)];
                const hm2   = 1 + (t2 < 60 ? 0 : (t2-60)/180);
                const elite2 = new Enemy(ex, ey, {...data2, elite:true}, hm2 * 1.5);
                if (this.gameMode === 'frenetic') { elite2.speed *= 1.35; }
                this.enemies.push(elite2);
            }
            this.shake = 10;
            this.showWaveMessage('☠ OLEADA OSCURA');
            AudioEngine.sfxBoss && AudioEngine.sfxBoss();
        }
        this._updateDeathBarHUD();

        // ── RUNE SPAWNS (Magic Survival) ────────────────────────────
        this.runeSpawnTimer += dt;
        const runeInterval = isFrenetic ? 55 : 80;
        if (this.runeSpawnTimer >= runeInterval) {
            this.runeSpawnTimer = 0;
            this._spawnRune();
        }
        // Rune collection
        for (let i = this.runes.length - 1; i >= 0; i--) {
            const rune = this.runes[i];
            rune.pulse += dt * 2.5;
            rune.life  -= dt;
            if (rune.life <= 0) { this.runes.splice(i, 1); continue; }
            if (M.dist(this.player.x, this.player.y, rune.x, rune.y) < this.player.r + rune.r + 8) {
                this._applyRune(rune);
                this.runes.splice(i, 1);
            }
        }

        // Power-up collection
        for (let i = this.powerUps.length-1; i >= 0; i--) {
            const pu = this.powerUps[i]; pu.pulse += dt * 3;
            if (M.dist(this.player.x, this.player.y, pu.x, pu.y) < this.player.r + pu.r + 10) {
                this.player.activeBuffs[pu.type] = (pu.type==='shield'?5.5:pu.type==='speed'?4.5:7);
                AudioEngine.sfxPowerup();
                this.spawnParticle(pu.x, pu.y, pu.color, 12);
                this.powerUps.splice(i, 1);
            }
        }

        if (this.shake > 0) this.shake *= 0.86;

        // Zale ultra timer (double fire rate)
        if (this.zaleUltraTimer > 0) {
            this.zaleUltraTimer = Math.max(0, this.zaleUltraTimer - dt);
        }

        // Stun tick — restore enemy speed after stun expires
        for (const e of this.enemies) {
            // Poison DOT tick
            if (e._poisonTimer > 0) {
                e._poisonTimer -= dt;
                e.hp -= (e._poisonDmg || 0) * dt;
                e.flash = Math.max(e.flash || 0, 0.06);
                if (e._poisonTimer <= 0) e._poisonTimer = 0;
            }

            if (e._stunTimer > 0) {
                e._stunTimer -= dt;
                if (e._stunTimer <= 0) {
                    e._stunTimer = 0;
                    e.speed = e._preStunSpeed || e.baseSpeed || e.speed || 100;
                }
            }
            // Freeze decay
            if (e._freezeTimer > 0) {
                e._freezeTimer -= dt;
                if (e._freezeTimer <= 0) {
                    e._freezeTimer = 0;
                    e.speed = e._frozenBase || e.baseSpeed || e.speed;
                }
            }
        }

        // Gold (XP×2) timer
        if (this.goldTimer > 0) this.goldTimer -= dt;

        // Life orbs: drift toward player, collect on contact
        for (let i = this.lifeOrbs.length - 1; i >= 0; i--) {
            const lo = this.lifeOrbs[i];
            lo.pulse += dt * 3;
            const ld = M.dist(this.player.x, this.player.y, lo.x, lo.y);
            if (ld < this.player.pickupRange) {
                const la = M.angle(lo.x, lo.y, this.player.x, this.player.y);
                const spd = Math.min(220, 80 + (1 - ld / this.player.pickupRange) * 300);
                lo.x += Math.cos(la) * spd * dt;
                lo.y += Math.sin(la) * spd * dt;
            }
            if (M.dist(this.player.x, this.player.y, lo.x, lo.y) < this.player.r + lo.r + 4) {
                this.player.hp = Math.min(this.player.maxHp, this.player.hp + lo.hp);
                this.spawnText(this.player.x, this.player.y - 22, '+' + lo.hp + ' HP', false);
                this.spawnParticle(lo.x, lo.y, '#44ff88', 9);
                AudioEngine.playTone(550, 'sine', 0.08, 0.06);
                this.lifeOrbs.splice(i, 1);
            }
        }

        // Elora ultra cones tick
        if (this.eloraUltraCones && this.eloraUltraCones.length) {
            this.eloraUltraTimer = Math.max(0, (this.eloraUltraTimer || 0) - dt);
            for (const cone of this.eloraUltraCones) {
                cone.phase = Math.min(1, cone.phase + dt * 5.5);
                if (cone.phase < 0.7) {
                    for (const e of this.enemies) {
                        if (e.dead || cone.hitSet.has(e)) continue;
                        const dx = e.x - this.player.x, dy = e.y - this.player.y;
                        if (Math.hypot(dx, dy) > cone.range + e.r) continue;
                        let diff = Math.atan2(dy, dx) - cone.angle;
                        while (diff >  Math.PI) diff -= Math.PI*2;
                        while (diff < -Math.PI) diff += Math.PI*2;
                        if (Math.abs(diff) < cone.arc / 2) {
                            const crit = Math.random() < 0.2;
                            const d = cone.dmg * (crit ? 2.2 : 1);
                            e.takeDamage(d);
                            const n = M.norm(dx, dy);
                            e.knockback.x = n.x * 280; e.knockback.y = n.y * 280;
                            this.spawnParticle(e.x, e.y, '#ffffaa', 6);
                            this.spawnText(e.x, e.y, Math.floor(d), crit);
                            cone.hitSet.add(e);
                        }
                    }
                }
            }
            if (this.eloraUltraTimer <= 0) this.eloraUltraCones = null;
        }

        // Ultra whips tick (Alaric ultra)
        if (this.ultraWhips && this.ultraWhips.length) {
            for (let wi = this.ultraWhips.length - 1; wi >= 0; wi--) {
                const w = this.ultraWhips[wi];
                w.phase += dt * 2.4;
                if (w.phase >= w.maxPhase) { this.ultraWhips.splice(wi, 1); continue; }

                const halfArc  = w.arc / 2;
                const raw      = w.phase;
                const ease     = raw < 0.5 ? 2*raw*raw : -1+(4-2*raw)*raw;
                const currAng  = w.angle - halfArc + w.arc * ease;

                for (const e of this.enemies) {
                    if (e.dead || w.hitSet.has(e)) continue;
                    const dx = e.x - this.player.x, dy = e.y - this.player.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist > w.len + e.r) continue;
                    let diff = Math.atan2(dy, dx) - w.angle;
                    while (diff >  Math.PI) diff -= Math.PI*2;
                    while (diff < -Math.PI) diff += Math.PI*2;
                    if (Math.abs(diff) <= halfArc + 0.12) {
                        const crit = Math.random() < 0.2;
                        const dmg  = w.dmg * (crit ? 2.2 : 1);
                        e.takeDamage(dmg);
                        const n = M.norm(dx, dy);
                        e.knockback.x = n.x * 500; e.knockback.y = n.y * 500;
                        this.spawnParticle(e.x, e.y, '#ff66cc', 6);
                        this.spawnText(e.x, e.y, Math.floor(dmg), crit);
                        w.hitSet.add(e);
                    }
                }
            }
        }

        // Enemy update + player collision (spatial hash used for projectiles above)
        for (let i = this.enemies.length-1; i >= 0; i--) {
            const e = this.enemies[i];
            e.update(dt, this.player.x, this.player.y);

            // Physical separation: push enemy out of player body so they cant overlap
            const dx  = e.x - this.player.x;
            const dy  = e.y - this.player.y;
            const d   = Math.sqrt(dx * dx + dy * dy) || 0.001;
            const min = e.r + this.player.r;
            if (d < min) {
                const push = (min - d) / d;
                e.x += dx * push;
                e.y += dy * push;
            }

            if (d < min && this.player.iframe <= 0) {
                if (this.player.activeBuffs.shield > 0) {
                    this.player.activeBuffs.shield = 0; this.shake = 5; this.player.iframe = 0.5;
                } else {
                    const rawDmg = Math.max(1, (e.dmg - this.player.stats.reduction) * (this.player.kaelUltraDmgReduct > 0 ? 0.9 : 1));
                    const dmg = Math.min(rawDmg, Math.ceil(this.player.maxHp * 0.28)); // no insta-kill
                    this.player.hp -= dmg; this.player.iframe = 0.65; this.shake = 7;
                    this.dmgFlash = 0.55; // synced with rAF loop — no setTimeout
                    if (this.player.hp <= 0) { this.player.hp = 0; this.gameOver(); return; }
                }
            }
            if (e.dead) {
                if (e.type === 'exploder') e.explode();
                // Necromancer: spawn 3 swarm minions on death
                if (e.type === 'necromancer' && !e._spawned) {
                    e._spawned = true;
                    for (let m = 0; m < 3; m++) {
                        const ma = (Math.PI*2/3)*m + Math.random()*0.5;
                        const md = 45 + Math.random()*25;
                        const hm = 1 + (this.time < 60 ? 0 : (this.time-60)/180);
                        this.enemies.push(new Enemy(
                            e.x + Math.cos(ma)*md, e.y + Math.sin(ma)*md,
                            {...ENEMY_TYPES[0]}, hm
                        ));
                    }
                    Game.spawnParticle(e.x, e.y, '#33ffcc', 16);
                    this.showWaveMessage('💀 INVOCACIÓN PÓSTUMA');
                }
                if (e === this.currentBoss) this.shake = 20;
                this.kills++; this.combo++; this.comboTimer = 2.8;
                const xpMult = (this.goldTimer > 0 ? 2 : 1) * (this.gameMode === 'frenetic' ? 1.5 : 1);
                // Elites drop 5x XP (big gem), bosses handled below
                const xpAmount = e.xpValue * (e.elite ? 5 : 1) * xpMult;
                const gemTier  = e.elite ? 2 : 0;   // elite gems are gold tier
                this.gems.push({ x:e.x, y:e.y, xp: xpAmount, tier: gemTier });
                this.spawnParticle(e.x, e.y, e.color, e.isBoss?20:10);
                AudioEngine.sfxKill();
                // Life orb drop (8% chance, bosses always drop)
                if (e.isBoss || Math.random() < 0.08)
                    this.lifeOrbs.push({ x:e.x, y:e.y, hp: e.isBoss ? 20 : 8, r:10, pulse:0 });
                if (Math.random() < 0.10) this.spawnPowerUp(e.x, e.y);
                // Vampire
                if (this.player.stats.vampire > 0) {
                    this.player.vampireKillTracker++;
                    if (this.player.vampireKillTracker >= 5) {
                        this.player.vampireKillTracker = 0;
                        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
                        this.spawnText(this.player.x, this.player.y - 20, '+1', false);
                    }
                }
                this.enemies.splice(i, 1);
                this.checkKillMilestone();
            }
        }

        // Enemy-enemy separation — grid-bucketed to stay O(N) with big hordes
        // Only compare enemies in the same or adjacent grid cells (cell = 40px)
        const CELL = 40;
        const sepGrid = new Map();
        for (const e of this.enemies) {
            const key = `${Math.floor(e.x/CELL)},${Math.floor(e.y/CELL)}`;
            if (!sepGrid.has(key)) sepGrid.set(key, []);
            sepGrid.get(key).push(e);
        }
        for (const [key, cell] of sepGrid) {
            const [cx, cy] = key.split(',').map(Number);
            for (let di = -1; di <= 1; di++) {
                for (let dj = -1; dj <= 1; dj++) {
                    const nkey = `${cx+di},${cy+dj}`;
                    if (!sepGrid.has(nkey)) continue;
                    const ncell = sepGrid.get(nkey);
                    for (const a of cell) {
                        for (const b of ncell) {
                            if (a === b) continue;
                            const dx = a.x - b.x, dy = a.y - b.y;
                            const d  = Math.sqrt(dx*dx + dy*dy) || 0.001;
                            const min = (a.r + b.r) * 0.88;
                            if (d < min) {
                                const push = ((min - d) / d) * 0.25;
                                a.x += dx * push; a.y += dy * push;
                            }
                        }
                    }
                }
            }
        }

        // Player projectiles — Spatial Hash O(K) + scaled crits + knockback
        SpatialHash.rebuild(this.enemies); // one rebuild per frame
        for (let i = this.projectiles.length-1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.life -= dt;
            if (p.type !== 'whip') {
                p.x += p.vx * dt; p.y += p.vy * dt;
                if (p.type === 'dagger') { /* no spin — dagger points in direction of travel */ }
                // Query only nearby enemies — O(K) instead of O(N)
                const candidates = SpatialHash.queryArray(p.x, p.y, (p.r || 5) + 40);
                for (const e of candidates) {
                    if (p.pierced && p.pierced.includes(e)) continue;
                    if (M.dist(p.x, p.y, e.x, e.y) < e.r + (p.r || 5)) {
                        const wLv = p.weaponLevel || 1;
                        const ic  = Math.random() < calcCritChance(wLv, this.combo);
                        const dmg = p.dmg * (ic ? calcCritMult(wLv) : 1);
                        e.takeDamage(dmg);
                        // Poison arrow — apply DOT
                        if (p.poison && p.poisonDmg) {
                            e._poisonTimer = 3.0;
                            e._poisonDmg   = p.poisonDmg;
                        }
                        AudioEngine.sfxHit();
                        this.spawnText(e.x, e.y, Math.floor(dmg), ic);
                        this.spawnParticle(e.x, e.y, p.poison ? '#44ff88' : e.color, 4);
                        // Scaled knockback
                        const kb = calcKnockback(dmg, e.maxHp);
                        const nd = M.norm(p.x - e.x, p.y - e.y);
                        e.knockback.x -= nd.x * kb;
                        e.knockback.y -= nd.y * kb;
                        // Hit-stop on crits (mobile: 2 frames, desktop: 4)
                        if (ic) this.hitstopFrames = Math.max(this.hitstopFrames, CONFIG.IS_MOBILE ? 2 : 4);
                        if (p.piercing) {
                            if (!p.pierced) p.pierced = [];
                            p.pierced.push(e);
                            if (p.pierced.length >= (p.maxPierce || 3)) p.life = 0;
                        } else { p.life = 0; }
                        break;
                    }
                }
            }
            if (p.life <= 0) this.projectiles.splice(i, 1);
        }

        // Enemy projectiles
        for (let i = this.enemyProjectiles.length-1; i >= 0; i--) {
            const ep = this.enemyProjectiles[i];
            // Homing — steers toward player slowly
            if (ep.homing) {
                const hdx = this.player.x - ep.x, hdy = this.player.y - ep.y;
                const hd  = Math.sqrt(hdx*hdx+hdy*hdy) || 1;
                const spd = Math.sqrt(ep.vx*ep.vx+ep.vy*ep.vy);
                ep.vx += (hdx/hd) * spd * 0.055;
                ep.vy += (hdy/hd) * spd * 0.055;
                const ns = Math.sqrt(ep.vx*ep.vx+ep.vy*ep.vy);
                ep.vx = ep.vx/ns*spd; ep.vy = ep.vy/ns*spd;
            }
            // Pull — attracts player toward orb
            if (ep.pull) {
                const pdx = ep.x - this.player.x, pdy = ep.y - this.player.y;
                const pd  = Math.sqrt(pdx*pdx+pdy*pdy) || 1;
                if (pd < 300) {
                    const pull = (1 - pd/300) * 55 * (1/60);
                    this.player.x += (pdx/pd) * pull;
                    this.player.y += (pdy/pd) * pull;
                    // Clamp player to arena wall after pull
                    if (this.bossArena) {
                        const _ar = this.bossArena;
                        const _dx = this.player.x - _ar.x, _dy = this.player.y - _ar.y;
                        const _d  = Math.sqrt(_dx*_dx+_dy*_dy);
                        if (_d > _ar.r - this.player.r - 4) {
                            const _p = _ar.r - this.player.r - 4;
                            this.player.x = _ar.x + (_dx/_d)*_p;
                            this.player.y = _ar.y + (_dy/_d)*_p;
                        }
                    }
                }
            }
            ep.x += ep.vx; ep.y += ep.vy; ep.life--;

            // Bible orbs block enemy projectiles
            let blockedByOrb = false;
            const bibleWeapon = this.player.weapons.find(w => w.id === 'Bible' || w.id === 'HolyNova');
            if (bibleWeapon && ep.life > 0) {
                const numOrbs = bibleWeapon.level >= 5 ? 5 : bibleWeapon.level >= 4 ? 4 : bibleWeapon.level >= 3 ? 3 : bibleWeapon.level >= 2 ? 2 : 1;
                for (let o = 0; o < numOrbs; o++) {
                    const orbAngle = bibleWeapon.angle + (Math.PI * 2 / numOrbs) * o;
                    const orbX = this.player.x + Math.cos(orbAngle) * bibleWeapon.orbitR;
                    const orbY = this.player.y + Math.sin(orbAngle) * bibleWeapon.orbitR;
                    if (M.dist(ep.x, ep.y, orbX, orbY) < ep.r + 22) {
                        ep.life = 0; blockedByOrb = true;
                        this.spawnParticle(ep.x, ep.y, '#cc99ff', 5);
                        break;
                    }
                }
            }

            if (!blockedByOrb && ep.dmg > 0 && M.dist(ep.x, ep.y, this.player.x, this.player.y) < ep.r + this.player.r && this.player.iframe <= 0) {
                if (this.player.activeBuffs.shield > 0) { this.player.activeBuffs.shield = 0; }
                else {
                    const rawDmg2 = Math.max(1, (ep.dmg - this.player.stats.reduction) * (this.player.kaelUltraDmgReduct > 0 ? 0.9 : 1));
                    const dmg = Math.min(rawDmg2, Math.ceil(this.player.maxHp * 0.28)); // no insta-kill
                    this.player.hp -= dmg; this.player.iframe = 0.5; this.shake = 5;
                    if (this.player.hp <= 0) { this.player.hp = 0; this.gameOver(); return; }
                }
                ep.life = 0;
            }
            if (ep.life <= 0) this.enemyProjectiles.splice(i, 1);
        }

        // ── GEM MERGING ─────────────────────────────────────────────
        // Tier 0 (blue, r≈5): 10 within 40px → merge into tier 1 (yellow, r≈9)
        // Tier 1 (yellow, r≈9): 10 within 65px → merge into tier 2 (orange, r≈16)
        // Runs every 6 frames to avoid per-frame overhead
        if (!this._gemMergeFrame) this._gemMergeFrame = 0;
        this._gemMergeFrame++;
        if (this._gemMergeFrame % 6 === 0 && this.gems.length > 10) {
            const MERGE_COUNT  = [10,   10  ];  // how many of tier N merge into tier N+1
            const MERGE_RADIUS = [40,   65  ];  // max cluster radius per tier
            const MAX_TIER     = 1;             // tier 2 = final, no further merging

            for (let tier = 0; tier <= MAX_TIER; tier++) {
                const candidates = this.gems.filter(g => (g.tier || 0) === tier);
                if (candidates.length < MERGE_COUNT[tier]) continue;

                // Grid-bucket to find clusters quickly
                const cellSize = MERGE_RADIUS[tier];
                const cells = new Map();
                for (const g of candidates) {
                    const cx = Math.floor(g.x / cellSize);
                    const cy = Math.floor(g.y / cellSize);
                    const key = cx + ',' + cy;
                    if (!cells.has(key)) cells.set(key, []);
                    cells.get(key).push(g);
                }

                const toRemove = new Set();
                for (const [, cell] of cells) {
                    if (cell.length < MERGE_COUNT[tier]) continue;
                    // Take exactly MERGE_COUNT gems from this cell
                    const group = cell.slice(0, MERGE_COUNT[tier]);
                    if (group.some(g => toRemove.has(g))) continue;

                    // Check they're all within MERGE_RADIUS of each other's centroid
                    const cx = group.reduce((s, g) => s + g.x, 0) / group.length;
                    const cy2 = group.reduce((s, g) => s + g.y, 0) / group.length;
                    const allClose = group.every(g =>
                        M.dist(g.x, g.y, cx, cy2) <= MERGE_RADIUS[tier]);
                    if (!allClose) continue;

                    // Merge: sum all XP, place at centroid, bump tier
                    const totalXp = group.reduce((s, g) => s + g.xp, 0);
                    group.forEach(g => toRemove.add(g));
                    this.gems.push({ x: cx, y: cy2, xp: totalXp, tier: tier + 1 });
                    // Brief flash at merge point
                    this.spawnParticle(cx, cy2, tier === 0 ? '#ffdd44' : '#ff8800', 5);
                }

                if (toRemove.size > 0)
                    this.gems = this.gems.filter(g => !toRemove.has(g));
            }
        }

        // XP gems
        const pickupRange  = this.gameMode === 'frenetic' ? this.player.pickupRange * 2.0 : this.player.pickupRange;
        const gemPullSpeed = this.gameMode === 'frenetic' ? 18 : 10;
        // Cooldown so rapid gem pickups don't chain into back-to-back level-up screens
        if (this._levelupCooldown > 0) this._levelupCooldown -= dt;

        for (let i = this.gems.length - 1; i >= 0; i--) {
            const g = this.gems[i];
            const d = M.dist(this.player.x, this.player.y, g.x, g.y);
            if (d < pickupRange) {
                g.x = M.lerp(g.x, this.player.x, dt * gemPullSpeed);
                g.y = M.lerp(g.y, this.player.y, dt * gemPullSpeed);
            }
            if (d < 16) {
                const xpGain = g.xp * (1 + this.combo * 0.015) * (this.gameMode === 'frenetic' ? 1.3 : 1);
                this.player.xp += xpGain;
                this.gems.splice(i, 1);

                if (this.player.xp >= this.player.nextXp && this._levelupCooldown <= 0) {
                    this.player.xp -= this.player.nextXp;
                    const _lv    = this.player.level;
                    const _xpMult = _lv < 5 ? 1.55 : _lv < 12 ? 1.35 : 1.20;
                    this.player.nextXp = Math.floor(this.player.nextXp * _xpMult);
                    this.player.level++;
                    this._levelupCooldown = 0.35;   // 350ms window — pick upgrade, then next gem fires
                    this.triggerLevelUp();
                    return;   // stop this frame; resume after player picks upgrade
                }
            }
        }

        // Particles
        for (const p of this.particles) {
            p.vy += p.gravity; p.vx *= p.friction; p.vy *= p.friction;
            p.x  += p.vx; p.y += p.vy; p.life -= dt;
        }
        this.particles = this.particles.filter(p => p.life > 0);

        // Texts
        for (const t of this.texts) { t.vx+=t.curve; t.x+=t.vx; t.y+=t.vy; t.vy*=0.96; t.life-=dt; }
        this.texts = this.texts.filter(t => t.life > 0);

        // Lightning decay
        for (let i = this.lightningBolts.length-1; i >= 0; i--) {
            this.lightningBolts[i].life -= dt;
            if (this.lightningBolts[i].life <= 0) this.lightningBolts.splice(i, 1);
        }

        // Damage flash decay — synced with frame loop
        if (this.dmgFlash > 0) this.dmgFlash = Math.max(0, this.dmgFlash - dt * 4.2);

        this.updateHUD();
        this.drawMinimap();
        this.checkAchievements();
    },

    // ─────────────────────────── DRAW ────────────────────────────
    draw() {
        const ctx = this.ctx;
        const dpr = this._dpr || 1;
        // On mobile: patch ctx to skip all shadowBlur (biggest Canvas2D perf win)
        if (CONFIG.IS_MOBILE && !ctx._mobilePatchApplied) {
            ctx._mobilePatchApplied = true;
            const _orig = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowBlur');
            Object.defineProperty(ctx, 'shadowBlur', { set: ()=>{}, get: ()=>0 });
            Object.defineProperty(ctx, 'shadowColor', { set: ()=>{}, get: ()=>'transparent' });
        }
        // Reapply DPR transform — assigning canvas.width resets the context transform
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // ── DARK FOREST background ─────────────────────────────────
        ctx.fillStyle = '#030a04'; ctx.fillRect(0, 0, Game.lw, Game.lh);

        if (this.state === 'LOADING' || this.state === 'LANDING') return;
        if (this.state === 'START') return;

        ctx.save();
        if (this.shake > 0.5)
            ctx.translate((Math.random()*2-1)*this.shake, (Math.random()*2-1)*this.shake);

        const off = { x: this.player.x, y: this.player.y };
        const wt  = Date.now() * 0.0003;

        // ── DARK FOREST FLOOR ──────────────────────────────────────
        const tileSize = 72;
        // Stable world-tile origin: floor player pos to tile grid
        const startTileX = Math.floor(this.player.x / tileSize);
        const startTileY = Math.floor(this.player.y / tileSize);
        // Pixel offset of top-left tile on screen
        const tOffX = (startTileX * tileSize - this.player.x) + Game.lw  / 2;
        const tOffY = (startTileY * tileSize - this.player.y) + Game.lh / 2;
        // How many tiles to draw — start far left/top to cover full screen
        const tilesX = Math.ceil(Game.lw  / tileSize) + 3;
        const tilesY = Math.ceil(Game.lh / tileSize) + 3;
        const startIX = -Math.ceil(Game.lw  / (2 * tileSize)) - 1;
        const startIY = -Math.ceil(Game.lh / (2 * tileSize)) - 1;

        // ── MAP FLOOR — image texture fixed in world space, no seams ──
        if (!this._mapImg) {
            this._mapImg = new Image();
            this._mapImg.src = 'assets/map_floor.jpg';
        }

        if (this._mapImg.complete && this._mapImg.naturalWidth) {
            const iw = this._mapImg.naturalWidth;
            const ih = this._mapImg.naturalHeight;
            const cx = Game.lw / 2, cy = Game.lh / 2;
            const ox = cx - this.player.x;
            const oy = cy - this.player.y;
            const startX = Math.floor((-ox) / iw) * iw + ox;
            const startY = Math.floor((-oy) / ih) * ih + oy;

            // ── Offscreen cache: only rebuild when scroll exceeds 1 tile ──
            if (!this._mapCache || !this._mapCacheCtx) {
                this._mapCache    = document.createElement('canvas');
                this._mapCache.width  = Game.lw  + iw * 2;
                this._mapCache.height = Game.lh + ih * 2;
                this._mapCacheCtx = this._mapCache.getContext('2d');
                this._mapCacheOriginX = null; // force first draw
            }
            // Rebuild cache if origin shifted by >= 1 tile
            if (this._mapCacheOriginX === null ||
                Math.abs(startX - this._mapCacheOriginX) >= iw ||
                Math.abs(startY - this._mapCacheOriginY) >= ih) {
                this._mapCacheOriginX = startX;
                this._mapCacheOriginY = startY;
                const c = this._mapCacheCtx;
                c.clearRect(0, 0, this._mapCache.width, this._mapCache.height);
                for (let tx = startX - iw; tx < Game.lw + iw * 2; tx += iw) {
                    for (let ty = startY - ih; ty < Game.lh + ih * 2; ty += ih) {
                        c.drawImage(this._mapImg, tx - startX + iw, ty - startY + ih, iw, ih);
                    }
                }
            }
            // Single blit per frame — very cheap
            ctx.drawImage(this._mapCache, startX - iw, startY - ih);
        } else {
            ctx.fillStyle = '#0c1408';
            ctx.fillRect(0, 0, Game.lw, Game.lh);
        }

        // ── GLOWING MUSHROOMS (replace torches) ────────────────────
        if (!this._torches) {
            this._torches = [];
            for (let tx2 = -1200; tx2 <= 1200; tx2 += 280) {
                for (let ty2 = -1200; ty2 <= 1200; ty2 += 280) {
                    const seed = Math.abs((tx2 * 31 + ty2 * 17) % 100);
                    this._torches.push({
                        wx: tx2 + (seed % 80) - 40,
                        wy: ty2 + ((seed * 3) % 80) - 40,
                        phase: Math.random() * Math.PI * 2,
                        flicker: 0.5 + Math.random() * 0.8,
                        col: [
                            [0,255,120],   // green
                            [80,200,255],  // cyan
                            [180,255,80],  // yellow-green
                        ][Math.floor(Math.random()*3)],
                    });
                }
            }
            this._torchParticles = Array.from({length: 20}, () => ({
                torchIdx: Math.floor(Math.random() * this._torches.length),
                life: Math.random(),
                speed: 0.008 + Math.random() * 0.012,
                ox: (Math.random() - 0.5) * 8,
            }));
        }

        this._torches.forEach(t => {
            const sx = t.wx - off.x + Game.lw  / 2;
            const sy = t.wy - off.y + Game.lh / 2;
            if (sx < -80 || sx > Game.lw + 80 || sy < -80 || sy > Game.lh + 80) return;
            const [r,g,b] = t.col;
            const pulse = 0.7 + Math.sin(wt * t.flicker * 3 + t.phase) * 0.3;

            // floor glow — simple alpha fill (no gradient = much cheaper)
            ctx.globalAlpha = 0.09 * pulse;
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.beginPath(); ctx.arc(sx, sy, 55 * pulse, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;

            // mushroom stem
            ctx.fillStyle = '#1a2a14';
            ctx.fillRect(sx - 2, sy - 4, 4, 8);
            // mushroom cap
            ctx.fillStyle = `rgba(${r},${g},${b},${0.85 * pulse})`;
            ctx.beginPath(); ctx.ellipse(sx, sy - 5, 7 * pulse, 5 * pulse, 0, Math.PI, 0); ctx.fill();
            // cap shine
            ctx.fillStyle = `rgba(255,255,255,${0.3 * pulse})`;
            ctx.beginPath(); ctx.ellipse(sx - 1, sy - 6, 3, 2, -0.3, Math.PI, 0); ctx.fill();
            // spots
            ctx.fillStyle = `rgba(255,255,255,${0.5 * pulse})`;
            ctx.beginPath(); ctx.arc(sx - 2, sy - 5, 1, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(sx + 2, sy - 6, 0.8, 0, Math.PI*2); ctx.fill();
        });

        // Floating spores: skip on mobile
        if (!CONFIG.IS_MOBILE) this._torchParticles.forEach(p => {
            p.life += p.speed;
            if (p.life > 1) { p.life = 0; p.torchIdx = Math.floor(Math.random() * this._torches.length); p.ox = (Math.random()-0.5)*8; }
            const t2  = this._torches[p.torchIdx];
            const [r,g,b] = t2.col;
            const sx2 = t2.wx - off.x + Game.lw  / 2 + p.ox + Math.sin(p.life * 8) * 4;
            const sy2 = t2.wy - off.y + Game.lh / 2 - p.life * 30;
            if (sx2 < -20 || sx2 > Game.lw + 20 || sy2 < -20 || sy2 > Game.lh + 20) return;
            ctx.globalAlpha = (1 - p.life) * 0.55;
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.beginPath(); ctx.arc(sx2, sy2, 1.2, 0, Math.PI*2); ctx.fill();
        });
        ctx.globalAlpha = 1;

        // ── FOREST MIST (green wisps) ───────────────────────────────
        if (!this._wisps) {
            this._wisps = Array.from({length: 20}, () => ({
                x: Math.random()*2000 - 1000, y: Math.random()*2000 - 1000,
                r: 40 + Math.random()*70, phase: Math.random()*Math.PI*2,
                col: Math.random()<0.5 ? 'rgba(0,40,10,' : 'rgba(0,20,30,'
            }));
        }
        // Wisps: skip on mobile, every-other-frame on desktop
        if (!this._wispFrame) this._wispFrame = 0;
        this._wispFrame++;
        if (CONFIG.IS_MOBILE) this._wispFrame = 1; // always skip on mobile
        if (this._wispFrame % 2 === 0) {
            this._wisps.forEach(w => {
                const wx2 = (w.x - off.x) % 1200 + Game.lw/2;
                const wy2 = (w.y - off.y) % 900  + Game.lh/2;
                if (wx2 < -w.r || wx2 > Game.lw + w.r || wy2 < -w.r || wy2 > Game.lh + w.r) return;
                const a   = 0.08 + Math.sin(wt * 0.3 + w.phase) * 0.04;
                ctx.globalAlpha = a;
                ctx.fillStyle   = w.col + '1)';
                ctx.beginPath(); ctx.arc(wx2, wy2, w.r, 0, Math.PI*2); ctx.fill();
            });
            ctx.globalAlpha = 1;
        }

        // Decorations (roots/stones overgrown)
        this.decorations.forEach(d => {
            const sx = d.x-off.x+Game.lw/2, sy = d.y-off.y+Game.lh/2;
            if (sx<-50||sx>Game.lw+50||sy<-50||sy>Game.lh+50) return;
            ctx.globalAlpha = 0.55;
            if (d.type==='rock') {
                ctx.fillStyle = `hsl(120,${8+d.hue%10}%,${8+d.hue%5}%)`;
                ctx.fillRect(sx - d.size/2, sy - d.size/2, d.size, d.size * 0.7);
                // moss on top
                ctx.fillStyle = `hsl(120,30%,${10+d.hue%8}%)`;
                ctx.fillRect(sx - d.size/2, sy - d.size/2, d.size, d.size * 0.2);
            } else {
                ctx.fillStyle = `hsl(120,25%,${8+d.hue%6}%)`;
                ctx.beginPath(); ctx.arc(sx, sy, d.size/2, 0, Math.PI*2); ctx.fill();
            }
            ctx.globalAlpha = 1;
        });

        // Weapon persistent draws (flame zones, garlic, whip arc, holy strike)
        this.player.weapons.forEach(w => { if (w.draw) w.draw(ctx, off); });

        // Power-ups
        this.powerUps.forEach(pu => {
            const sx = pu.x-off.x+Game.lw/2, sy = pu.y-off.y+Game.lh/2+Math.sin(pu.pulse)*5;
            ctx.save(); ctx.shadowColor=pu.color; ctx.shadowBlur=20;
            ctx.fillStyle=pu.color; ctx.globalAlpha=0.85+Math.sin(pu.pulse*2)*0.15;
            ctx.beginPath(); ctx.arc(sx,sy,pu.r,0,Math.PI*2); ctx.fill();
            ctx.globalAlpha=1; ctx.shadowBlur=0;
            ctx.font='13px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText(pu.icon,sx,sy); ctx.restore();
        });

        // Runes — Magic Survival style field pickups
        this.runes.forEach(rune => {
            const sx = rune.x - off.x + Game.lw/2;
            const sy = rune.y - off.y + Game.lh/2;
            if (sx < -60 || sx > Game.lw+60 || sy < -60 || sy > Game.lh+60) return;
            const rp  = 0.6 + Math.sin(rune.pulse * 2.2) * 0.4;
            const fadePct = Math.min(1, rune.life / 4);
            ctx.save();
            ctx.globalAlpha = 0.15 * rp * fadePct;
            ctx.fillStyle = rune.color;
            ctx.shadowColor = rune.color; ctx.shadowBlur = 30;
            ctx.beginPath(); ctx.arc(sx, sy, rune.r * 2.5, 0, Math.PI*2); ctx.fill();
            ctx.globalAlpha = 0.35 * rp * fadePct;
            ctx.shadowBlur = 18;
            ctx.beginPath(); ctx.arc(sx, sy, rune.r * 1.6, 0, Math.PI*2); ctx.fill();
            ctx.globalAlpha = 0.9 * fadePct;
            ctx.shadowBlur = 12;
            ctx.beginPath(); ctx.arc(sx, sy, rune.r, 0, Math.PI*2); ctx.fill();
            ctx.globalAlpha = fadePct;
            ctx.shadowBlur = 0;
            ctx.font = (rune.r * 1.1) + 'px serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(rune.icon, sx, sy);
            ctx.fillStyle = rune.color;
            ctx.font = '7px sans-serif';
            ctx.fillText(rune.label, sx, sy + rune.r + 10);
            ctx.restore();
        });

        // Mana Orbs (XP) — Magic Survival style glowing spheres
        const gt = Date.now() * 0.003;
        this.gems.forEach(g => {
            const tier = g.tier || 0;
            const sx   = g.x - off.x + Game.lw  / 2;
            const sy   = g.y - off.y + Game.lh / 2 + Math.sin(gt + g.x * 0.01) * 3;
            const pulse = 0.7 + Math.sin(gt * 2 + g.y * 0.01) * 0.3;

            // Tier-based visual parameters
            // tier 0: blue  (original)  r≈5
            // tier 1: yellow (merged ×10) r≈9
            // tier 2: orange (merged ×100) r≈16
            const configs = [
                { outer:'#3355cc', core:'#6688ff', hi:'#ccddff', glow:'#88aaff', coreR:5,  outerR:9,  shadowR:14 },
                { outer:'#cc8800', core:'#ffcc00', hi:'#ffffaa', glow:'#ffdd44', coreR:9,  outerR:15, shadowR:22 },
                { outer:'#cc4400', core:'#ff7700', hi:'#ffcc88', glow:'#ff8800', coreR:16, outerR:26, shadowR:34 },
            ];
            const cfg = configs[Math.min(tier, configs.length - 1)];

            ctx.save();
            // Outer glow
            ctx.globalAlpha = (tier > 0 ? 0.3 : 0.18) * pulse;
            ctx.shadowColor = cfg.glow; ctx.shadowBlur = cfg.shadowR;
            ctx.fillStyle   = cfg.outer;
            ctx.beginPath(); ctx.arc(sx, sy, cfg.outerR, 0, Math.PI * 2); ctx.fill();

            // Core orb
            ctx.globalAlpha = 0.92;
            ctx.shadowBlur  = tier > 0 ? 12 : 8;
            ctx.fillStyle   = cfg.core;
            ctx.beginPath(); ctx.arc(sx, sy, cfg.coreR, 0, Math.PI * 2); ctx.fill();

            // Highlight shine
            ctx.globalAlpha = 0.7;
            ctx.shadowBlur  = 0;
            ctx.fillStyle   = cfg.hi;
            ctx.beginPath(); ctx.arc(sx - cfg.coreR * 0.28, sy - cfg.coreR * 0.28,
                                     cfg.coreR * 0.35, 0, Math.PI * 2); ctx.fill();

            // Tier 1+: spinning ring
            if (tier >= 1) {
                ctx.globalAlpha = 0.55 * pulse;
                ctx.strokeStyle = cfg.glow; ctx.lineWidth = 1.5;
                ctx.shadowColor = cfg.glow; ctx.shadowBlur = 8;
                ctx.setLineDash([4, 3]);
                ctx.beginPath();
                ctx.arc(sx, sy, cfg.outerR * 0.88 + Math.sin(gt * 3 + g.x) * 2, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Tier 2: extra outer pulse ring
            if (tier >= 2) {
                ctx.globalAlpha = 0.25 * pulse;
                ctx.strokeStyle = cfg.glow; ctx.lineWidth = 2;
                ctx.shadowBlur = 18;
                ctx.beginPath(); ctx.arc(sx, sy, cfg.outerR + 6 + Math.sin(gt * 4) * 3, 0, Math.PI * 2);
                ctx.stroke();
            }

            ctx.restore();
        });

        // Life Orbs — healing pickups
        this.lifeOrbs.forEach(lo => {
            const sx  = lo.x - off.x + Game.lw/2;
            const sy2 = lo.y - off.y + Game.lh/2 + Math.sin(gt*2 + lo.x*0.02) * 2.5;
            const lp  = 0.7 + Math.sin(lo.pulse * 2) * 0.3;
            ctx.save();
            // Outer heal glow
            ctx.globalAlpha = 0.22 * lp;
            ctx.fillStyle   = '#44ff88';
            ctx.shadowColor = '#00cc44'; ctx.shadowBlur = 16;
            ctx.beginPath(); ctx.arc(sx, sy2, 14, 0, Math.PI*2); ctx.fill();
            // Core
            ctx.globalAlpha = 0.92;
            ctx.shadowBlur  = 8;
            ctx.fillStyle   = '#33dd66';
            ctx.beginPath(); ctx.arc(sx, sy2, 7, 0, Math.PI*2); ctx.fill();
            // Cross symbol
            ctx.globalAlpha = 1;
            ctx.shadowBlur  = 0;
            ctx.fillStyle   = '#ffffff';
            ctx.fillRect(sx-1.5, sy2-5, 3, 10);
            ctx.fillRect(sx-5, sy2-1.5, 10, 3);
            ctx.restore();
        });

        // Enemy projectiles
        this.enemyProjectiles.forEach(ep => {
            ctx.save(); ctx.shadowColor=ep.color; ctx.shadowBlur=CONFIG.IS_MOBILE?6:14;
            ctx.fillStyle=ep.color; ctx.globalAlpha=ep.life/80;
            ctx.beginPath(); ctx.arc(ep.x-off.x+Game.lw/2, ep.y-off.y+Game.lh/2, ep.r, 0, Math.PI*2);
            ctx.fill(); ctx.restore();
        });

        // Enemies
        this.enemies.forEach(e => e.draw(ctx, off));

        // Lightning bolts
        this.lightningBolts.forEach(bolt => {
            ctx.save();
            const alpha = bolt.life / bolt.maxLife;

            if (bolt.segments) {
                // ── Vorath skyfall lightning ─────────────────────
                const W2 = Game.lw/2, H2 = Game.lh/2;

                // Impact area glow
                const sx2 = bolt.x - off.x + W2, sy2 = bolt.y - off.y + H2;
                const glow = ctx.createRadialGradient(sx2,sy2,0,sx2,sy2,bolt.r);
                glow.addColorStop(0,   `rgba(180,230,255,${alpha*0.55})`);
                glow.addColorStop(0.5, `rgba(80,160,255,${alpha*0.25})`);
                glow.addColorStop(1,   'transparent');
                ctx.fillStyle = glow;
                ctx.beginPath(); ctx.arc(sx2,sy2,bolt.r,0,Math.PI*2); ctx.fill();

                // Bright impact circle
                if (alpha > 0.6) {
                    ctx.globalAlpha = (alpha-0.6)/0.4;
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath(); ctx.arc(sx2,sy2,bolt.r*0.35,0,Math.PI*2); ctx.fill();
                    ctx.globalAlpha = 1;
                }

                // Zigzag bolt segments
                ctx.shadowColor = '#aaeeff'; ctx.shadowBlur = 14;
                bolt.segments.forEach((seg, si) => {
                    // Outer thick bolt (white-blue)
                    ctx.strokeStyle = `rgba(200,240,255,${alpha*0.9})`;
                    ctx.lineWidth   = 3 + (1-si/bolt.segments.length)*2;
                    ctx.beginPath();
                    ctx.moveTo(seg.x1-off.x+W2, seg.y1-off.y+H2);
                    ctx.lineTo(seg.x2-off.x+W2, seg.y2-off.y+H2);
                    ctx.stroke();
                    // Inner bright core
                    ctx.strokeStyle = `rgba(255,255,255,${alpha*0.7})`;
                    ctx.lineWidth   = 1;
                    ctx.stroke();
                });

                // Stun star on stunned enemies near this bolt
                for (const e of this.enemies) {
                    if (e._stunTimer > 0) {
                        const esx = e.x - off.x + W2, esy = e.y - off.y + H2;
                        ctx.shadowColor = '#ffff00'; ctx.shadowBlur = 6;
                        ctx.fillStyle   = '#ffee00';
                        ctx.font        = '14px serif';
                        ctx.textAlign   = 'center';
                        ctx.fillText('⚡', esx, esy - e.r - 8 + Math.sin(Date.now()*0.008)*3);
                    }
                }
            } else {
                // ── Default chain lightning bolt ─────────────────
                ctx.strokeStyle = `rgba(200,255,100,${alpha*0.9})`;
                ctx.lineWidth   = 2 + Math.random()*2; ctx.shadowColor='#aaff00'; ctx.shadowBlur=10;
                ctx.beginPath();
                ctx.moveTo(bolt.fromX-off.x+Game.lw/2, bolt.fromY-off.y+Game.lh/2);
                for (let s=1; s<=6; s++) {
                    const tx2 = M.lerp(bolt.fromX,bolt.toX,s/6) + M.rand(-12,12);
                    const ty2 = M.lerp(bolt.fromY,bolt.toY,s/6) + M.rand(-12,12);
                    ctx.lineTo(tx2-off.x+Game.lw/2, ty2-off.y+Game.lh/2);
                }
                ctx.stroke();
            }
            ctx.restore();
        });

        // Elora ultra cones rendering
        if (this.eloraUltraCones) {
            const cx = Game.lw/2, cy = Game.lh/2;
            this.eloraUltraCones.forEach(cone => {
                const alpha = Math.max(0, 1 - cone.phase);
                const r2    = cone.range * (0.3 + cone.phase * 0.7);
                const a1    = cone.angle - cone.arc / 2;
                const a2    = cone.angle + cone.arc / 2;
                ctx.save();
                // Cone gradient fill
                const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r2);
                cg.addColorStop(0,   `rgba(255,255,200,${alpha * 0.7})`);
                cg.addColorStop(0.6, `rgba(255,220,80,${alpha * 0.45})`);
                cg.addColorStop(1,   `rgba(255,180,0,0)`);
                ctx.fillStyle   = cg;
                ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 18 * alpha;
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.arc(cx, cy, r2, a1, a2);
                ctx.closePath(); ctx.fill();
                // Cone edge lines
                ctx.strokeStyle = `rgba(255,255,150,${alpha * 0.6})`;
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(a1)*r2, cy+Math.sin(a1)*r2); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(a2)*r2, cy+Math.sin(a2)*r2); ctx.stroke();
                ctx.restore();
            });
        }

        // Zale ultra — lock-on lines from player to each zaleUltra projectile
        if (this.zaleUltraTimer > 0) {
            const px2 = this.player.x - off.x + Game.lw/2;
            const py2 = this.player.y - off.y + Game.lh/2;
            this.projectiles.forEach(p => {
                if (!p.zaleUltra) return;
                const ex2 = p.x - off.x + Game.lw/2;
                const ey2 = p.y - off.y + Game.lh/2;
                ctx.save();
                ctx.globalAlpha = Math.min(0.35, p.life / 2.4 * 0.35);
                ctx.strokeStyle = '#4488ff';
                ctx.lineWidth   = 1;
                ctx.setLineDash([6, 8]);
                ctx.beginPath(); ctx.moveTo(px2, py2); ctx.lineTo(ex2, ey2);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();
            });
        }

        // Ultra whips render (Alaric)
        if (this.ultraWhips && this.ultraWhips.length) {
            this.ultraWhips.forEach(w => {
                const px = this.player.x, py = this.player.y;
                const sx = px - off.x + Game.lw/2;
                const sy = py - off.y + Game.lh/2;
                const raw    = w.phase;
                const ease   = raw < 0.5 ? 2*raw*raw : -1+(4-2*raw)*raw;
                const halfArc  = w.arc / 2;
                const startAng = w.angle - halfArc;
                const currAng  = startAng + w.arc * ease;
                const fadeOut  = Math.max(0, 1 - raw * 1.4);

                ctx.save();
                ctx.translate(sx, sy);

                // Ghost arc trail
                ctx.globalAlpha = 0.18 * fadeOut;
                ctx.fillStyle   = '#ff88cc';
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, w.len, startAng, currAng);
                ctx.closePath(); ctx.fill();

                // Whip body — tapered bezier from base to tip
                const tipX = Math.cos(currAng) * w.len;
                const tipY = Math.sin(currAng) * w.len;
                const midX = Math.cos(currAng - halfArc * 0.5) * w.len * 0.5;
                const midY = Math.sin(currAng - halfArc * 0.5) * w.len * 0.5;

                for (let seg = 6; seg >= 1; seg--) {
                    const t1 = (seg - 1) / 6, t2 = seg / 6;
                    const thick = (1 - t1) * 5.5 + 0.5;
                    ctx.beginPath();
                    ctx.moveTo(midX*t1*2, midY*t1*2);
                    ctx.lineTo(midX*t2*2, midY*t2*2);
                    ctx.strokeStyle = `rgba(255,120,200,${fadeOut * (0.5 + t1*0.5)})`;
                    ctx.lineWidth   = thick;
                    ctx.shadowColor = '#ff44aa';
                    ctx.shadowBlur  = 12 * fadeOut;
                    ctx.stroke();
                }

                // Outer whip segment (mid to tip)
                ctx.beginPath();
                ctx.moveTo(midX, midY);
                ctx.quadraticCurveTo(
                    Math.cos(currAng)*w.len*0.75, Math.sin(currAng)*w.len*0.75,
                    tipX, tipY
                );
                ctx.strokeStyle = `rgba(255,180,230,${fadeOut * 0.9})`;
                ctx.lineWidth   = 2;
                ctx.shadowColor = '#ff88cc';
                ctx.shadowBlur  = 18 * fadeOut;
                ctx.stroke();

                // Tip spark
                ctx.globalAlpha = fadeOut * 0.9;
                ctx.fillStyle   = '#ffffff';
                ctx.shadowColor = '#ff44aa';
                ctx.shadowBlur  = 20;
                ctx.beginPath(); ctx.arc(tipX, tipY, 5, 0, Math.PI*2); ctx.fill();

                ctx.restore();
            });
        }

        // Player projectiles — use drawProjectile router
        this.projectiles.forEach(p => {
            drawProjectile(ctx, p, off);
        });

        // Bible draw handled in the unified weapon draw pass above

        // Particles — batched by color: one path + fill per color group
        // Avoids per-particle shadowBlur calls (GPU killer on mobile)
        if (this.particles.length) {
            const byColor = new Map();
            for (const p of this.particles) {
                if (!byColor.has(p.color)) byColor.set(p.color, []);
                byColor.get(p.color).push(p);
            }
            ctx.shadowBlur = CONFIG.IS_MOBILE ? 0 : 7;
            for (const [color, group] of byColor) {
                ctx.fillStyle  = color;
                ctx.shadowColor = color;
                ctx.beginPath();
                for (const p of group) {
                    const alpha = Math.max(0, p.life / p.maxLife);
                    const r = p.r * (0.3 + alpha * 0.7); // size-fade: cheaper than globalAlpha
                    if (r < 0.5) continue;
                    const sx = p.x - off.x + Game.lw  / 2;
                    const sy = p.y - off.y + Game.lh / 2;
                    ctx.moveTo(sx + r, sy);
                    ctx.arc(sx, sy, r, 0, Math.PI * 2);
                }
                ctx.fill();
            }
            ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = 1;

        // Player
        this.player.draw(ctx, off);

        // Floating damage numbers
        ctx.textAlign = 'center';
        for (const t of this.texts) {
            const alpha = Math.max(0, t.life/t.maxLife);
            const scale = t.isCrit ? 1.1+(1-alpha)*0.5 : 1;
            const sx = t.x-off.x+Game.lw/2, sy = t.y-off.y+Game.lh/2;
            ctx.save(); ctx.globalAlpha=alpha;
            ctx.translate(sx,sy); ctx.scale(scale,scale);
            if (t.isCrit) { ctx.font='bold 20px "Orbitron",monospace'; ctx.fillStyle='#ffd700'; ctx.shadowColor='#ffd700'; ctx.shadowBlur=16; }
            else          { ctx.font='bold 13px Rajdhani,sans-serif';  ctx.fillStyle='#ffaa88'; }
            ctx.fillText(t.text, 0, 0); ctx.restore();
        }
        ctx.globalAlpha = 1;

        // ── BOSS ARENA ───────────────────────────────────────────
        if (this.bossArena) {
            this.bossArenaAlpha = Math.min(1, (this.bossArenaAlpha || 0) + 0.018);
            const ar = this.bossArena;
            const sx = ar.x - off.x + Game.lw  / 2;
            const sy = ar.y - off.y + Game.lh / 2;
            const t2 = Date.now() * 0.002;
            const fa = this.bossArenaAlpha;

            ctx.save();

            // ── Cached fog: only rebuild when alpha changes by 0.05+ ────────
            // Fog is centered at (0,0) of the cache canvas and blitted by offset
            const fogSize = Math.ceil(ar.r * 1.7);
            const cacheW  = fogSize * 2, cacheH = fogSize * 2;
            if (!this._fogCache || !this._fogCacheCtx) {
                this._fogCache    = document.createElement('canvas');
                this._fogCache.width  = cacheW;
                this._fogCache.height = cacheH;
                this._fogCacheCtx = this._fogCache.getContext('2d');
                this._fogCacheAlpha = -1; // force rebuild
            }
            const alphaStep = Math.floor(fa * 20) / 20; // quantize to 0.05 steps
            if (this._fogCacheAlpha !== alphaStep) {
                this._fogCacheAlpha = alphaStep;
                const fc  = this._fogCacheCtx;
                const cx2 = cacheW / 2, cy2 = cacheH / 2;
                fc.clearRect(0, 0, cacheW, cacheH);
                // Radial fog gradient (rebuilt ~20 times total as alpha ramps up)
                const fg = fc.createRadialGradient(cx2, cy2, ar.r * 0.78, cx2, cy2, ar.r * 1.6);
                fg.addColorStop(0,    'rgba(0,0,0,0)');
                fg.addColorStop(0.25, `rgba(15,0,25,${0.45 * alphaStep})`);
                fg.addColorStop(0.55, `rgba(6,0,12,${0.82 * alphaStep})`);
                fg.addColorStop(0.8,  `rgba(2,0,6,${0.96 * alphaStep})`);
                fg.addColorStop(1,    `rgba(0,0,2,${1.0  * alphaStep})`);
                fc.fillStyle = fg;
                fc.fillRect(0, 0, cacheW, cacheH);
                // Hard black beyond radius
                fc.globalAlpha = 0.98 * alphaStep;
                fc.fillStyle = '#000002';
                fc.beginPath();
                fc.rect(0, 0, cacheW, cacheH);
                fc.arc(cx2, cy2, ar.r * 1.6, 0, Math.PI * 2, true);
                fc.fill('evenodd');
                fc.globalAlpha = 1;
            }
            // Single cheap blit per frame
            ctx.drawImage(this._fogCache, sx - cacheW/2, sy - cacheH/2);

            // Barrier ring (1 stroke only, no shadowBlur loop)
            // Boss spawning ritual visual
            if (this.bossSpawning) {
                const bs    = this.bossSpawning;
                const prog  = 1 - (bs.timer / 3.0);   // 0→1 over 3s
                const rsx   = bs.x - off.x + Game.lw  / 2;
                const rsy   = bs.y - off.y + Game.lh / 2;
                const bcol  = bs.color;
                const pulse2 = 0.5 + Math.sin(t2 * 6) * 0.5;

                // Countdown text
                const secs = Math.ceil(bs.timer);
                ctx.save();
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.font = 'bold 52px Rajdhani, sans-serif';
                ctx.globalAlpha = 0.9;
                ctx.fillStyle   = bcol;
                ctx.shadowColor = bcol; ctx.shadowBlur = 30;
                ctx.fillText(secs, rsx, rsy - 80);
                ctx.font = '16px Rajdhani, sans-serif';
                ctx.globalAlpha = 0.7;
                ctx.fillStyle = '#ffffff';
                ctx.fillText('INVOCANDO...', rsx, rsy - 46);
                ctx.shadowBlur = 0;

                // Expanding ritual ring
                const ritR = prog * 120;
                ctx.beginPath(); ctx.arc(rsx, rsy, ritR, 0, Math.PI*2);
                ctx.strokeStyle = bcol;
                ctx.globalAlpha = (1 - prog) * 0.8 * pulse2;
                ctx.lineWidth = 4; ctx.stroke();

                // Inner pulsing glow at center
                const ig = ctx.createRadialGradient(rsx, rsy, 0, rsx, rsy, 50 * (0.5 + prog * 0.5));
                ig.addColorStop(0,   bcol + 'cc');
                ig.addColorStop(0.5, bcol + '44');
                ig.addColorStop(1,   'transparent');
                ctx.globalAlpha = 0.6 * pulse2;
                ctx.fillStyle = ig;
                ctx.beginPath(); ctx.arc(rsx, rsy, 50 * (0.5 + prog * 0.5), 0, Math.PI*2); ctx.fill();

                // Rotating rune symbols converging to center
                const RUNES2 = ['⚠','☠','⚡','💀','🔥','⚔'];
                ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                for (let i = 0; i < 6; i++) {
                    const baseAngle2 = (Math.PI*2/6)*i + t2 * 1.5;
                    const runeR = (1 - prog) * 180 + 30;
                    ctx.globalAlpha = Math.min(1, prog * 2) * 0.8;
                    ctx.fillStyle   = bcol;
                    ctx.shadowColor = bcol; ctx.shadowBlur = 10;
                    ctx.fillText(RUNES2[i],
                        rsx + Math.cos(baseAngle2) * runeR,
                        rsy + Math.sin(baseAngle2) * runeR);
                }
                ctx.shadowBlur = 0;
                ctx.restore();
            }

            const pulse = 0.6 + Math.sin(t2 * 2.4) * 0.4;
            const bCol  = ar.color || '#ff1133';
            ctx.beginPath(); ctx.arc(sx, sy, ar.r, 0, Math.PI * 2);
            // Parse hex color to rgba to avoid invalid 9-char CSS color bug
            const _a4 = Math.round(0.7 * pulse * fa * 255);
            const _r4 = parseInt(bCol.slice(1,3),16), _g4 = parseInt(bCol.slice(3,5),16), _b4 = parseInt(bCol.slice(5,7),16);
            ctx.strokeStyle = `rgba(${_r4},${_g4},${_b4},${(_a4/255).toFixed(2)})`;
            ctx.lineWidth = 3;
            ctx.shadowColor = bCol;
            ctx.shadowBlur  = 16;
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Inner glow ring (soft)
            ctx.beginPath(); ctx.arc(sx, sy, ar.r * 0.97, 0, Math.PI * 2);
            const _r5 = parseInt(bCol.slice(1,3),16), _g5 = parseInt(bCol.slice(3,5),16), _b5 = parseInt(bCol.slice(5,7),16);
            ctx.strokeStyle = `rgba(${_r5},${_g5},${_b5},0.33)`;
            ctx.lineWidth = 8;
            ctx.stroke();

            // Runes on barrier (6 only for perf)
            const RUNES = ['⚔','☠','⚠','⚡','💀','🔥'];
            ctx.font = '14px serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2 + t2 * 0.22;
                ctx.globalAlpha = (0.5 + Math.sin(t2*2.5+i)*0.3) * fa;
                ctx.fillStyle   = '#ff2244';
                ctx.fillText(RUNES[i], sx + Math.cos(angle) * ar.r, sy + Math.sin(angle) * ar.r);
            }
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        ctx.restore();

        // Fog damage flash (purple-black vignette when in boss fog)
        if (this._fogDmgFlash > 0.01) {
            this._fogDmgFlash *= 0.88;
            const fogFlash = ctx.createRadialGradient(Game.lw/2,Game.lh/2,0,Game.lw/2,Game.lh/2,Game.lw*0.7);
            fogFlash.addColorStop(0,   'transparent');
            fogFlash.addColorStop(0.6, `rgba(30,0,50,${(this._fogDmgFlash*0.4).toFixed(2)})`);
            fogFlash.addColorStop(1,   `rgba(10,0,20,${(this._fogDmgFlash*0.85).toFixed(2)})`);
            ctx.fillStyle = fogFlash;
            ctx.fillRect(0, 0, Game.lw, Game.lh);
        }

        // Damage flash — drawn OUTSIDE the shake transform (screen-space)
        if (this.dmgFlash > 0.01) {
            ctx.save();
            ctx.fillStyle = `rgba(200,0,40,${this.dmgFlash.toFixed(2)})`;
            ctx.fillRect(0, 0, Game.lw, Game.lh);
            ctx.restore();
        }
    },

    // ─────────────────────────── GAME OVER ───────────────────────
    async gameOver() {
        if (this.state === 'GAMEOVER') return;
        this.state = 'GAMEOVER';
        const m = Math.floor(this.time/60), s = Math.floor(this.time%60);
        const weapons = this.player.weapons.map(w => UPGRADES_DB[w.id]?.icon||'?').join(' ');
        // Build new-this-session highlights
        const newIds  = AchievementStore.getNewThisSession();
        const newHTML = newIds.length
            ? newIds.map(id => {
                const d = ACHIEVEMENT_DEFS.find(x => x.id === id);
                return d ? `<span class="go-ach-badge">${d.icon} ${d.name}</span>` : '';
              }).join('')
            : '<span style="color:#443344;font-size:10px">Ninguno esta partida</span>';
        AchievementStore.clearSession();

        document.getElementById('game-over-stats').innerHTML = `
            <div class="stat-row"><span>Kills:</span><span>${this.kills}</span></div>
            <div class="stat-row"><span>Tiempo:</span><span>${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}</span></div>
            <div class="stat-row"><span>Nivel:</span><span>${this.player.level}</span></div>
            <div class="stat-row"><span>Combo:</span><span>${this.combo}</span></div>
            <div class="stat-row"><span>Jefes:</span><span>${this.bossKills}</span></div>
            <div class="stat-row"><span>Armas:</span><span>${weapons}</span></div>
            <div class="stat-row"><span>Logros totales:</span><span>${AchievementStore.getCount()}/${AchievementStore.getTotalCount()}</span></div>
            <div class="stat-row go-ach-row"><span>Esta partida:</span><div class="go-ach-list">${newHTML}</div></div>
        `;
        // Submit score to leaderboard — await because submitScore is async
        if (typeof Auth !== 'undefined' && Auth.currentUser) {
            try {
                const rank = await Auth.submitScore({
                    timeSec:  this.time,
                    kills:    this.kills,
                    level:    this.player.level,
                    mode:     this.gameMode || 'normal',
                });
                if (rank) this._showRankAnnouncement(rank);
            } catch(e) {
                console.warn('submitScore error:', e);
            }
        }

        setTimeout(() => document.getElementById('gameover-screen').style.display = 'flex', 500);
    },

    // ─────────────────────────── MAIN LOOP ───────────────────────
    loop(now) {
        const dt = Math.min((now - (this.lastTime_loop||now)) / 1000, 0.08);
        this.lastTime_loop = now;
        if (this.hitstopFrames > 0) {
            // Hit-stop: freeze update but keep drawing — sells the weight of crits
            this.hitstopFrames--;
            this.draw();
        } else if (this.state !== 'PAUSE') {
            this.update(dt);
            this.draw();
        }
        requestAnimationFrame(t => this.loop(t));
    }
};

// Boot — show login first, then game init
document.addEventListener('DOMContentLoaded', () => {
    // Pre-fill input if device already has a locked account
    if (typeof Auth !== 'undefined') {
        const locked = Auth._getLockedAccount();
        if (locked) {
            const input = document.getElementById('login-input');
            const hint  = document.getElementById('login-hint');
            const sub   = document.getElementById('login-sub');
            if (input) {
                input.value       = locked.name;
                input.disabled    = true;
                input.style.color = '#aaccff';
                input.title       = 'Cuenta vinculada a este dispositivo';
            }
            if (hint) hint.textContent = `✅ Cuenta "${locked.name}" — introduce tu PIN de 6 dígitos`;
            if (sub)  sub.textContent  = 'BIENVENIDO DE VUELTA';
        }
        Auth.init();
    } else {
        Game.init();
    }
});
