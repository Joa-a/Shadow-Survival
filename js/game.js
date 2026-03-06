// ── game.js ── Main Game Controller ──
'use strict';

const Game = {
    canvas:null, ctx:null, minimapCtx:null,
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
        const W = window.innerWidth;
        const H = window.innerHeight;

        // Mobile: zoom OUT aggressively so player sees more world and has time to dodge.
        const minDim = Math.min(W, H);
        if (minDim < 420) {
            this.zoom = 0.48;   // small phone — sees ~2x more world
        } else if (minDim < 520) {
            this.zoom = 0.52;   // normal phone
        } else if (minDim < 768) {
            this.zoom = 0.70;   // tablet
        } else {
            this.zoom = 1;      // desktop
        }

        canvas.width  = Math.round(W / this.zoom);
        canvas.height = Math.round(H / this.zoom);

        // Stretch canvas to fill the real viewport
        canvas.style.width  = W + 'px';
        canvas.style.height = H + 'px';
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
            const statBars = Object.entries(c.stats)
                .map(([k, v]) => `<span class="char-stat">${k.toUpperCase()} ${v}</span>`)
                .join('');
            const weaponName = UPGRADES_DB[c.weapon]?.name || c.weapon;
            const weaponIcon = UPGRADES_DB[c.weapon]?.icon || '?';
            card.innerHTML = `
                <div class="char-icon">${c.icon}</div>
                <h3>${c.name}</h3>
                <p>${c.desc}</p>
                <div class="char-stats">${statBars}</div>
                <div class="char-weapon-tag">${weaponIcon} ${weaponName}</div>
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
        this.runes = []; this.runeSpawnTimer = 0;
        this._wisps = null;
        this.nextKillMilestone = 0;
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
        if (this.particles.length > CONFIG.PARTICLE_LIMIT) return;
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
            // Pull all gems to player instantly
            this.gems.forEach(g => { g.x = this.player.x; g.y = this.player.y; });
        } else if (rune.id === 'clear') {
            // Kill 80% of non-boss enemies on screen
            const toClear = this.enemies.filter(e => !e.isBoss);
            const n = Math.floor(toClear.length * 0.8);
            for (let i = 0; i < n; i++) {
                const e = toClear[i];
                e.dead = true;
            }
            this.shake = 18;
        } else if (rune.id === 'berserk') {
            this.player.activeBuffs.damage = 8;
            this.player.activeBuffs.speed  = 5;
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
        const margin = 140;
        const hw = canvas.width  / 2 + margin;
        const hh = canvas.height / 2 + margin;
        let sx, sy;
        if (Math.random() < 0.5) {
            sx = (Math.random() < 0.5 ? -hw : hw);
            sy = (Math.random() * 2 - 1) * hh;
        } else {
            sx = (Math.random() * 2 - 1) * hw;
            sy = (Math.random() < 0.5 ? -hh : hh);
        }
        const x = this.player.x + sx;
        const y = this.player.y + sy;

        if (isBoss) {
            // Cycle through 4 distinct boss types
            const bossIdx = this.bossKills % 4;
            const BOSS_DEFS = [
                { bossType:0, name:'⚠ EL COLOSO ⚠',    color:'#ff1133', r:44, speed:90,  dmg:18, xp:100,
                  desc:'Un gigante de sangre y furia' },
                { bossType:1, name:'⚠ LA TEJEDORA ⚠',  color:'#cc44ff', r:34, speed:130, dmg:14, xp:110,
                  desc:'La araña del vacío eterno' },
                { bossType:2, name:'⚠ EL LICHE ⚠',     color:'#44eeff', r:36, speed:115, dmg:16, xp:120,
                  desc:'Señor de la muerte helada' },
                { bossType:3, name:'⚠ EL ABISMO ⚠',    color:'#8800ff', r:40, speed:145, dmg:20, xp:140,
                  desc:'El vacío que lo devora todo' },
            ];
            const bd  = BOSS_DEFS[bossIdx];
            const hpMult = (this.gameMode === 'frenetic' ? 1.4 : 1);
            const bossHp = (1200 + this.lastMinute * 400) * hpMult;
            const data = { type:'boss', bossType:bd.bossType, hp:bossHp,
                           speed: bd.speed * (this.gameMode==='frenetic'?1.25:1),
                           r:bd.r, color:bd.color, xp:bd.xp, dmg:bd.dmg, isBoss:true };
            const e = new Enemy(x, y, data, 1);

            // Despawn all regular enemies
            this.enemies.forEach(en => { if (!en.isBoss) en.dead = true; });
            this.enemies = [];
            this.enemies.push(e);
            this.currentBoss = e;

            // Arena color matches boss
            this.bossArena = { x: this.player.x, y: this.player.y, r: 760, color: bd.color };
            this.bossArenaAlpha = 0;

            document.getElementById('boss-hud').style.display   = 'flex';
            document.getElementById('boss-name').textContent    = bd.name;
            document.getElementById('boss-bar-fill').style.width = '100%';
            this.shake = 22;
            AudioEngine.sfxBoss();
            this.showWaveMessage(bd.name);
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

        // Boss bar
        if (this.currentBoss && !this.currentBoss.dead) {
            document.getElementById('boss-bar-fill').style.width = (this.currentBoss.hp / this.currentBoss.maxHp * 100) + '%';
        } else if (this.currentBoss && this.currentBoss.dead) {
            document.getElementById('boss-hud').style.display = 'none';
            this.bossKills++;
            this.currentBoss = null;
            this.bossArena = null; this._fogDmgFlash = 0;  // remove arena wall
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
    },

    // ─────────────────────────── MINIMAP ─────────────────────────
    drawMinimap() {
        const ctx   = this.minimapCtx;
        const W = 110, H = 110, range = 800;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(50,30,60,0.5)'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(W/2,0); ctx.lineTo(W/2,H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(W,H/2); ctx.stroke();
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
            ctx.fillStyle = '#4488ff'; ctx.fillRect(mm.x-1, mm.y-1, 2, 2);
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
            // Boss every 3 minutes only
            if (this.lastMinute % 3 === 0) this.spawnEnemy(true);
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
        const maxOnScreen = isFrenetic
            ? Math.min(CONFIG.ENEMY_LIMIT, Math.floor(25 + this.time / 3))
            : Math.min(CONFIG.ENEMY_LIMIT, Math.floor(12 + this.time / 4));
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

        // ── DEATH BAR (Magic Survival) ──────────────────────────────
        // Fills over time + accelerates with kills. At 100 → elite wave
        this.deathBar += dt * (2.5 + this.time / 120);
        if (this.kills > 0) this.deathBar += (this.kills % 5 === 0 ? 0.4 : 0);
        if (this.deathBar >= 100) {
            this.deathBar = 0;
            // Spawn a burst of elite enemies
            const burstCount = 4 + Math.floor(this.time / 60);
            for (let b = 0; b < burstCount; b++) {
                const angle2 = (Math.PI * 2 / burstCount) * b;
                const dist2  = Math.max(canvas.width, canvas.height) * 0.55;
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
        const runeInterval = isFrenetic ? 18 : 28;
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

        // Stun tick — restore enemy speed after stun expires
        for (const e of this.enemies) {
            if (e._stunTimer > 0) {
                e._stunTimer -= dt;
                if (e._stunTimer <= 0) {
                    e._stunTimer = 0;
                    e.speed = e._preStunSpeed || e.baseSpeed || e.speed || 100;
                }
            }
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
                    const rawDmg = Math.max(1, e.dmg - this.player.stats.reduction);
                    const dmg = Math.min(rawDmg, Math.ceil(this.player.maxHp * 0.28)); // no insta-kill
                    this.player.hp -= dmg; this.player.iframe = 0.65; this.shake = 7;
                    this.dmgFlash = 0.55; // synced with rAF loop — no setTimeout
                    if (this.player.hp <= 0) { this.player.hp = 0; this.gameOver(); return; }
                }
            }
            if (e.dead) {
                if (e.type === 'exploder') e.explode();
                if (e === this.currentBoss) this.shake = 20;
                this.kills++; this.combo++; this.comboTimer = 2.8;
                this.gems.push({ x:e.x, y:e.y, xp:e.xpValue * (e.elite?2:1) });
                this.spawnParticle(e.x, e.y, e.color, e.isBoss?20:10);
                AudioEngine.sfxKill();
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
                        AudioEngine.sfxHit();
                        this.spawnText(e.x, e.y, Math.floor(dmg), ic);
                        this.spawnParticle(e.x, e.y, e.color, 4);
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
                    const rawDmg2 = Math.max(1, ep.dmg - this.player.stats.reduction);
                    const dmg = Math.min(rawDmg2, Math.ceil(this.player.maxHp * 0.28)); // no insta-kill
                    this.player.hp -= dmg; this.player.iframe = 0.5; this.shake = 5;
                    if (this.player.hp <= 0) { this.player.hp = 0; this.gameOver(); return; }
                }
                ep.life = 0;
            }
            if (ep.life <= 0) this.enemyProjectiles.splice(i, 1);
        }

        // XP gems
        const pickupRange   = this.gameMode === 'frenetic' ? this.player.pickupRange * 2.0 : this.player.pickupRange;
        const gemPullSpeed  = this.gameMode === 'frenetic' ? 18 : 10;
        for (let i = this.gems.length-1; i >= 0; i--) {
            const g = this.gems[i];
            const d = M.dist(this.player.x, this.player.y, g.x, g.y);
            if (d < pickupRange) { g.x=M.lerp(g.x,this.player.x,dt*gemPullSpeed); g.y=M.lerp(g.y,this.player.y,dt*gemPullSpeed); }
            if (d < 16) {
                const xpGain = g.xp * (1 + this.combo * 0.015) * (this.gameMode === 'frenetic' ? 1.3 : 1);
                this.player.xp += xpGain;
                this.player.xp += xpGain;
                while (this.player.xp >= this.player.nextXp) {
                    this.player.xp -= this.player.nextXp;
                    // Hybrid XP curve: fast early (give player power quickly),
                    // medium mid-game, nearly linear late (always feel progress)
                    const _lv = this.player.level;
                    const _xpMult = _lv < 5 ? 1.55 : _lv < 12 ? 1.35 : 1.20;
                    this.player.nextXp = Math.floor(this.player.nextXp * _xpMult);
                    this.player.level++;
                    this.triggerLevelUp();
                }
                this.gems.splice(i, 1);
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
        // ── DARK FOREST background ─────────────────────────────────
        ctx.fillStyle = '#030a04'; ctx.fillRect(0, 0, canvas.width, canvas.height);

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
        const tOffX = (startTileX * tileSize - this.player.x) + canvas.width  / 2;
        const tOffY = (startTileY * tileSize - this.player.y) + canvas.height / 2;
        // How many tiles to draw — start far left/top to cover full screen
        const tilesX = Math.ceil(canvas.width  / tileSize) + 3;
        const tilesY = Math.ceil(canvas.height / tileSize) + 3;
        const startIX = -Math.ceil(canvas.width  / (2 * tileSize)) - 1;
        const startIY = -Math.ceil(canvas.height / (2 * tileSize)) - 1;

        ctx.fillStyle = '#030a04';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Ground patches — wx/wy are STABLE world tile indices, never float
        for (let ix = startIX; ix < startIX + tilesX + Math.abs(startIX); ix++) {
            for (let iy = startIY; iy < startIY + tilesY + Math.abs(startIY); iy++) {
                const wx = startTileX + ix;   // world tile X index (integer, stable)
                const wy = startTileY + iy;   // world tile Y index (integer, stable)
                const sx = tOffX + ix * tileSize;  // screen X
                const sy = tOffY + iy * tileSize;  // screen Y

                // Hash from stable world indices only
                const h = Math.abs((wx * 2341 + wy * 5683 + wx * wy * 137) % 100);
                const isMoss = h % 3 === 0;
                const L = isMoss ? 8 + (h % 6) : 5 + (h % 4);
                const S = isMoss ? 28 : 8;
                ctx.fillStyle = `hsl(120,${S}%,${L}%)`;
                ctx.fillRect(sx, sy, tileSize, tileSize);

                // Root lines — offsets based on hash only (stable)
                if (h % 4 === 0) {
                    ctx.strokeStyle = `rgba(0,${18 + h%12},0,0.22)`;
                    ctx.lineWidth = 0.8;
                    ctx.beginPath();
                    ctx.moveTo(sx + h%40, sy + (h*2)%40);
                    ctx.bezierCurveTo(
                        sx + h%50,           sy + 20,
                        sx + 30 + h%20,      sy + 30,
                        sx + tileSize-h%20,  sy + (h*3)%tileSize
                    );
                    ctx.stroke();
                }
            }
        }

        // Mortar lines aligned to stable tile grid
        ctx.strokeStyle = 'rgba(0,0,0,0.38)'; ctx.lineWidth = 1;
        for (let ix = startIX; ix < startIX + tilesX + Math.abs(startIX); ix++) {
            const sx = tOffX + ix * tileSize;
            ctx.beginPath(); ctx.moveTo(sx,0); ctx.lineTo(sx,canvas.height); ctx.stroke();
        }
        for (let iy = startIY; iy < startIY + tilesY + Math.abs(startIY); iy++) {
            const sy = tOffY + iy * tileSize;
            ctx.beginPath(); ctx.moveTo(0,sy); ctx.lineTo(canvas.width,sy); ctx.stroke();
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
            this._torchParticles = Array.from({length: 50}, () => ({
                torchIdx: Math.floor(Math.random() * this._torches.length),
                life: Math.random(),
                speed: 0.008 + Math.random() * 0.012,
                ox: (Math.random() - 0.5) * 8,
            }));
        }

        this._torches.forEach(t => {
            const sx = t.wx - off.x + canvas.width  / 2;
            const sy = t.wy - off.y + canvas.height / 2;
            if (sx < -80 || sx > canvas.width + 80 || sy < -80 || sy > canvas.height + 80) return;
            const [r,g,b] = t.col;
            const pulse = 0.7 + Math.sin(wt * t.flicker * 3 + t.phase) * 0.3;

            // floor glow
            const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 60 * pulse);
            glow.addColorStop(0,   `rgba(${r},${g},${b},${0.12 * pulse})`);
            glow.addColorStop(0.6, `rgba(${r},${g},${b},${0.04 * pulse})`);
            glow.addColorStop(1,   'transparent');
            ctx.fillStyle = glow;
            ctx.beginPath(); ctx.arc(sx, sy, 60 * pulse, 0, Math.PI * 2); ctx.fill();

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

        // Floating spores
        this._torchParticles.forEach(p => {
            p.life += p.speed;
            if (p.life > 1) { p.life = 0; p.torchIdx = Math.floor(Math.random() * this._torches.length); p.ox = (Math.random()-0.5)*8; }
            const t2  = this._torches[p.torchIdx];
            const [r,g,b] = t2.col;
            const sx2 = t2.wx - off.x + canvas.width  / 2 + p.ox + Math.sin(p.life * 8) * 4;
            const sy2 = t2.wy - off.y + canvas.height / 2 - p.life * 30;
            if (sx2 < -20 || sx2 > canvas.width + 20 || sy2 < -20 || sy2 > canvas.height + 20) return;
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
        this._wisps.forEach(w => {
            const wx2 = (w.x - off.x) % 1200 + canvas.width/2;
            const wy2 = (w.y - off.y) % 900  + canvas.height/2;
            const a   = 0.08 + Math.sin(wt * 0.3 + w.phase) * 0.04;
            ctx.globalAlpha = a;
            ctx.fillStyle   = w.col + '1)';
            ctx.beginPath(); ctx.arc(wx2, wy2, w.r, 0, Math.PI*2); ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Decorations (roots/stones overgrown)
        this.decorations.forEach(d => {
            const sx = d.x-off.x+canvas.width/2, sy = d.y-off.y+canvas.height/2;
            if (sx<-50||sx>canvas.width+50||sy<-50||sy>canvas.height+50) return;
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
            const sx = pu.x-off.x+canvas.width/2, sy = pu.y-off.y+canvas.height/2+Math.sin(pu.pulse)*5;
            ctx.save(); ctx.shadowColor=pu.color; ctx.shadowBlur=20;
            ctx.fillStyle=pu.color; ctx.globalAlpha=0.85+Math.sin(pu.pulse*2)*0.15;
            ctx.beginPath(); ctx.arc(sx,sy,pu.r,0,Math.PI*2); ctx.fill();
            ctx.globalAlpha=1; ctx.shadowBlur=0;
            ctx.font='13px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText(pu.icon,sx,sy); ctx.restore();
        });

        // Runes — Magic Survival style field pickups
        this.runes.forEach(rune => {
            const sx = rune.x - off.x + canvas.width/2;
            const sy = rune.y - off.y + canvas.height/2;
            if (sx < -60 || sx > canvas.width+60 || sy < -60 || sy > canvas.height+60) return;
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
            const sx = g.x-off.x+canvas.width/2, sy = g.y-off.y+canvas.height/2+Math.sin(gt + g.x*0.01)*3;
            const orb_pulse = 0.7 + Math.sin(gt*2 + g.y*0.01)*0.3;
            ctx.save();
            // Outer glow
            ctx.globalAlpha = 0.18 * orb_pulse;
            ctx.shadowColor = '#88aaff'; ctx.shadowBlur = 14;
            ctx.fillStyle = '#3355cc';
            ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI*2); ctx.fill();
            // Core orb
            ctx.globalAlpha = 0.9;
            ctx.shadowBlur = 8;
            ctx.fillStyle = '#6688ff';
            ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI*2); ctx.fill();
            // Highlight
            ctx.globalAlpha = 0.7;
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ccddff';
            ctx.beginPath(); ctx.arc(sx-1.5, sy-1.5, 1.8, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        });

        // Enemy projectiles
        this.enemyProjectiles.forEach(ep => {
            ctx.save(); ctx.shadowColor=ep.color; ctx.shadowBlur=CONFIG.IS_MOBILE?6:14;
            ctx.fillStyle=ep.color; ctx.globalAlpha=ep.life/80;
            ctx.beginPath(); ctx.arc(ep.x-off.x+canvas.width/2, ep.y-off.y+canvas.height/2, ep.r, 0, Math.PI*2);
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
                const W2 = canvas.width/2, H2 = canvas.height/2;

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
                ctx.moveTo(bolt.fromX-off.x+canvas.width/2, bolt.fromY-off.y+canvas.height/2);
                for (let s=1; s<=6; s++) {
                    const tx2 = M.lerp(bolt.fromX,bolt.toX,s/6) + M.rand(-12,12);
                    const ty2 = M.lerp(bolt.fromY,bolt.toY,s/6) + M.rand(-12,12);
                    ctx.lineTo(tx2-off.x+canvas.width/2, ty2-off.y+canvas.height/2);
                }
                ctx.stroke();
            }
            ctx.restore();
        });

        // Ultra whips render (Alaric)
        if (this.ultraWhips && this.ultraWhips.length) {
            this.ultraWhips.forEach(w => {
                const px = this.player.x, py = this.player.y;
                const sx = px - off.x + canvas.width/2;
                const sy = py - off.y + canvas.height/2;
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
                    const sx = p.x - off.x + canvas.width  / 2;
                    const sy = p.y - off.y + canvas.height / 2;
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
            const sx = t.x-off.x+canvas.width/2, sy = t.y-off.y+canvas.height/2;
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
            const sx = ar.x - off.x + canvas.width  / 2;
            const sy = ar.y - off.y + canvas.height / 2;
            const t2 = Date.now() * 0.002;
            const fa = this.bossArenaAlpha;

            ctx.save();

            // Single-pass fog: radial gradient from clear center → dense black outside
            // Uses clip to avoid redrawing the inside of the arena
            const fogGrad = ctx.createRadialGradient(sx, sy, ar.r * 0.78, sx, sy, ar.r * 1.6);
            fogGrad.addColorStop(0,    'rgba(0,0,0,0)');
            fogGrad.addColorStop(0.25, `rgba(15,0,25,${0.45 * fa})`);
            fogGrad.addColorStop(0.55, `rgba(6,0,12,${0.82 * fa})`);
            fogGrad.addColorStop(0.8,  `rgba(2,0,6,${0.96 * fa})`);
            fogGrad.addColorStop(1,    `rgba(0,0,2,${1.0  * fa})`);
            ctx.fillStyle = fogGrad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Hard black beyond 1.6× radius (single fillRect, no evenodd)
            if (ar.r * 1.6 < Math.max(canvas.width, canvas.height)) {
                ctx.save();
                ctx.globalAlpha = 0.98 * fa;
                ctx.fillStyle = '#000002';
                ctx.beginPath();
                ctx.rect(0, 0, canvas.width, canvas.height);
                ctx.arc(sx, sy, ar.r * 1.6, 0, Math.PI * 2, true);
                ctx.fill('evenodd');
                ctx.restore();
            }

            // Barrier ring (1 stroke only, no shadowBlur loop)
            const pulse = 0.6 + Math.sin(t2 * 2.4) * 0.4;
            const bCol  = ar.color || '#ff1133';
            ctx.beginPath(); ctx.arc(sx, sy, ar.r, 0, Math.PI * 2);
            ctx.strokeStyle = bCol + Math.round(0.7 * pulse * fa * 255).toString(16).padStart(2,'0');
            ctx.lineWidth = 3;
            ctx.shadowColor = bCol;
            ctx.shadowBlur  = 16;
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Inner glow ring (soft)
            ctx.beginPath(); ctx.arc(sx, sy, ar.r * 0.97, 0, Math.PI * 2);
            ctx.strokeStyle = bCol + '55';
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
            const fogFlash = ctx.createRadialGradient(canvas.width/2,canvas.height/2,0,canvas.width/2,canvas.height/2,canvas.width*0.7);
            fogFlash.addColorStop(0,   'transparent');
            fogFlash.addColorStop(0.6, `rgba(30,0,50,${(this._fogDmgFlash*0.4).toFixed(2)})`);
            fogFlash.addColorStop(1,   `rgba(10,0,20,${(this._fogDmgFlash*0.85).toFixed(2)})`);
            ctx.fillStyle = fogFlash;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Damage flash — drawn OUTSIDE the shake transform (screen-space)
        if (this.dmgFlash > 0.01) {
            ctx.save();
            ctx.fillStyle = `rgba(200,0,40,${this.dmgFlash.toFixed(2)})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
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
if (typeof Auth !== 'undefined') {
    Auth.init();
} else {
    Game.init();
}
