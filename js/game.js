// ── game.js ── Main Game Controller ──
'use strict';

const Game = {
    canvas:null, ctx:null, minimapCtx:null,
    player:null,
    enemies:[], projectiles:[], gems:[], particles:[], decorations:[],
    texts:[], enemyProjectiles:[], powerUps:[], lightningBolts:[],
    currentBoss:null,
    state:'LOADING',          // LOADING → LANDING → START → PLAY → PAUSE → LEVELUP → GAMEOVER
    kills:0, time:0, combo:0, comboTimer:0,
    shake:0, difficulty:1, lastMinute:0,
    powerUpTimer:0, spawnTimer:0,
    input:{ x:0, y:0, up:0, down:0, left:0, right:0 },
    joyId:null, joyStart:{x:0,y:0},
    selectedChar:null, lastTime_loop:0,
    burstLevel:1, burstCharges:1, burstMaxCharges:1, burstMaxCooldown:120, burstCooldown:0,
    bossKills:0,
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
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;

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
        const N   = 8 + this.burstLevel * 2;
        const dmg = (40 + this.burstLevel * 18) * this.player.stats.damageMult *
                    (this.player.activeBuffs.damage > 0 ? 2 : 1);
        for (let i = 0; i < N; i++) {
            const a = (Math.PI * 2 / N) * i;
            this.projectiles.push({ type:'bolt', x:this.player.x, y:this.player.y, vx:Math.cos(a)*520, vy:Math.sin(a)*520, r:9, life:1.4, dmg, color:'#ffd700' });
        }
        this.shake = 10;
        AudioEngine.sfxLevel();
        this._updateBurstUI();
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
        this.nextKillMilestone = 0;
        this._updateBurstUI();
        this.state = 'PLAY';
        document.getElementById('start-screen').style.display    = 'none';
        document.getElementById('boss-hud').style.display        = 'none';
        document.getElementById('gameover-screen').style.display = 'none';
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
        const angle = Math.random() * Math.PI * 2;
        const dist  = Math.max(canvas.width, canvas.height) * 0.62;
        const x     = this.player.x + Math.cos(angle) * dist;
        const y     = this.player.y + Math.sin(angle) * dist;

        if (isBoss) {
            const bossHp = 350 + this.lastMinute * 200;
            const data   = { type:'boss', hp:bossHp, speed:115 + this.lastMinute*10, r:32, color:'#ff1144', xp:80, dmg:15, isBoss:true };
            const e      = new Enemy(x, y, data, 1);
            this.enemies.push(e);
            this.currentBoss = e;
            document.getElementById('boss-hud').style.display   = 'flex';
            document.getElementById('boss-name').textContent    = `⚠ HORROR ANTIGUO #${this.lastMinute} ⚠`;
            document.getElementById('boss-bar-fill').style.width = '100%';
            this.shake = 16;
            AudioEngine.sfxBoss();
            this.showWaveMessage('¡JEFE APARECE!');
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

        const data   = pool[M.randInt(0, pool.length - 1)];
        const hpMult = t < 60 ? 1 : Math.min(1 + (t - 60) / 180, 5);
        const elite  = t > 120 && Math.random() < 0.07;
        this.enemies.push(new Enemy(x, y, { ...data, elite }, hpMult));
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
        const allKeys   = Object.keys(UPGRADES_DB);
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
            div.innerHTML = `${badge}<div class="upgrade-icon">${up.icon}</div><div class="upgrade-info"><h4>${up.name}${isOwned?' +':''}</h4><p>${up.desc}</p></div>`;
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

        this.time       += dt;
        this.difficulty  = 1 + (this.time / 60) * 0.3;

        const curMin = Math.floor(this.time / 60);
        if (curMin > this.lastMinute) { this.lastMinute = curMin; this.spawnEnemy(true); }

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

        // Enemy spawn ramp
        const spawnInterval = Math.max(0.45, 4.0 - (this.time / 300) * 3.6);
        const maxOnScreen   = Math.min(CONFIG.ENEMY_LIMIT, Math.floor(4 + this.time / 10));
        this.spawnTimer += dt;
        if (this.spawnTimer >= spawnInterval && this.enemies.filter(e => !e.isBoss).length < maxOnScreen) {
            this.spawnTimer = 0;
            this.spawnEnemy();
        }

        // Power-up spawn
        this.powerUpTimer += dt;
        if (this.powerUpTimer > 14) {
            this.powerUpTimer = 0;
            const a = Math.random() * Math.PI * 2, d = M.rand(140, 320);
            this.spawnPowerUp(this.player.x + Math.cos(a)*d, this.player.y + Math.sin(a)*d);
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

        // Enemy update + player collision
        for (let i = this.enemies.length-1; i >= 0; i--) {
            const e = this.enemies[i];
            e.update(dt, this.player.x, this.player.y);
            const d = M.dist(this.player.x, this.player.y, e.x, e.y);
            if (d < e.r + this.player.r && this.player.iframe <= 0) {
                if (this.player.activeBuffs.shield > 0) {
                    this.player.activeBuffs.shield = 0; this.shake = 5; this.player.iframe = 0.5;
                } else {
                    const dmg = Math.max(1, e.dmg - this.player.stats.reduction);
                    this.player.hp -= dmg; this.player.iframe = 0.65; this.shake = 7;
                    const df = document.getElementById('dmg-flash');
                    df.style.background = 'rgba(200,0,40,0.55)';
                    setTimeout(() => df.style.background = 'rgba(200,0,40,0)', 130);
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

        // Player projectiles — dagger and arrow update + collision
        for (let i = this.projectiles.length-1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.life -= dt;
            if (p.type !== 'whip') {
                p.x += p.vx * dt; p.y += p.vy * dt;
                // Daggers spin as they fly
                if (p.type === 'dagger') { p.spin = (p.spin !== undefined ? p.spin : p.ang) + dt * 14; }
                for (let j = this.enemies.length-1; j >= 0; j--) {
                    const e = this.enemies[j];
                    // Skip already-pierced enemies
                    if (p.pierced && p.pierced.includes(e)) continue;
                    if (M.dist(p.x, p.y, e.x, e.y) < e.r + (p.r||5)) {
                        const ic  = Math.random() < 0.18;
                        const dmg = p.dmg * (ic ? 2.2 : 1);
                        e.takeDamage(dmg);
                        AudioEngine.sfxHit();
                        this.spawnText(e.x, e.y, Math.floor(dmg), ic);
                        this.spawnParticle(e.x, e.y, e.color, 4);
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
            ep.x += ep.vx; ep.y += ep.vy; ep.life--;
            if (ep.dmg > 0 && M.dist(ep.x, ep.y, this.player.x, this.player.y) < ep.r + this.player.r && this.player.iframe <= 0) {
                if (this.player.activeBuffs.shield > 0) { this.player.activeBuffs.shield = 0; }
                else {
                    const dmg = Math.max(1, ep.dmg - this.player.stats.reduction);
                    this.player.hp -= dmg; this.player.iframe = 0.5; this.shake = 5;
                    if (this.player.hp <= 0) { this.player.hp = 0; this.gameOver(); return; }
                }
                ep.life = 0;
            }
            if (ep.life <= 0) this.enemyProjectiles.splice(i, 1);
        }

        // XP gems
        for (let i = this.gems.length-1; i >= 0; i--) {
            const g = this.gems[i];
            const d = M.dist(this.player.x, this.player.y, g.x, g.y);
            if (d < this.player.pickupRange) { g.x=M.lerp(g.x,this.player.x,dt*10); g.y=M.lerp(g.y,this.player.y,dt*10); }
            if (d < 16) {
                const xpGain = g.xp * (1 + this.combo * 0.015);
                this.player.xp += xpGain;
                while (this.player.xp >= this.player.nextXp) {
                    this.player.xp    -= this.player.nextXp;
                    this.player.nextXp = Math.floor(this.player.nextXp * 1.7);
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

        this.updateHUD();
        this.drawMinimap();
        this.checkAchievements();
    },

    // ─────────────────────────── DRAW ────────────────────────────
    draw() {
        const ctx = this.ctx;
        ctx.fillStyle = '#04010e'; ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (this.state === 'LOADING' || this.state === 'LANDING') return;
        if (this.state === 'START') return;

        ctx.save();
        if (this.shake > 0.5)
            ctx.translate((Math.random()*2-1)*this.shake, (Math.random()*2-1)*this.shake);

        const off = { x: this.player.x, y: this.player.y };

        // Background grid
        const gs   = 80;
        const gOff = { x:((this.player.x%gs)+gs)%gs, y:((this.player.y%gs)+gs)%gs };
        ctx.strokeStyle = 'rgba(30,15,45,0.4)'; ctx.lineWidth = 0.5;
        for (let x = -gOff.x; x < canvas.width+gs; x+=gs) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
        for (let y = -gOff.y; y < canvas.height+gs; y+=gs) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }

        // Decorations
        this.decorations.forEach(d => {
            const sx = d.x-off.x+canvas.width/2, sy = d.y-off.y+canvas.height/2;
            if (sx<-50||sx>canvas.width+50||sy<-50||sy>canvas.height+50) return;
            if (d.type==='rock') { ctx.fillStyle=`hsl(${d.hue},25%,9%)`; ctx.fillRect(sx,sy,d.size,d.size); }
            else { ctx.fillStyle=`hsl(${d.hue},45%,14%)`; ctx.beginPath(); ctx.arc(sx,sy,d.size/2,0,Math.PI*2); ctx.fill(); }
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

        // XP Gems
        const gt = Date.now() * 0.003;
        this.gems.forEach(g => {
            const sx=g.x-off.x+canvas.width/2, sy=g.y-off.y+canvas.height/2+Math.sin(gt)*2;
            ctx.save(); ctx.shadowColor='#4466ff'; ctx.shadowBlur=10; ctx.fillStyle='#3355dd';
            ctx.beginPath(); ctx.arc(sx,sy,5,0,Math.PI*2); ctx.fill(); ctx.restore();
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
            ctx.strokeStyle = `rgba(200,255,100,${bolt.life/bolt.maxLife*0.9})`;
            ctx.lineWidth   = 2 + Math.random()*2; ctx.shadowColor='#aaff00'; ctx.shadowBlur=10;
            ctx.beginPath();
            ctx.moveTo(bolt.fromX-off.x+canvas.width/2, bolt.fromY-off.y+canvas.height/2);
            for (let s=1; s<=6; s++) {
                const tx = M.lerp(bolt.fromX,bolt.toX,s/6) + M.rand(-12,12);
                const ty = M.lerp(bolt.fromY,bolt.toY,s/6) + M.rand(-12,12);
                ctx.lineTo(tx-off.x+canvas.width/2, ty-off.y+canvas.height/2);
            }
            ctx.stroke(); ctx.restore();
        });

        // Player projectiles — use drawProjectile router
        this.projectiles.forEach(p => {
            drawProjectile(ctx, p, off);
        });

        // Bible draw handled in the unified weapon draw pass above

        // Particles
        for (const p of this.particles) {
            const alpha = Math.max(0, p.life/p.maxLife);
            ctx.globalAlpha=alpha; ctx.fillStyle=p.color;
            ctx.beginPath(); ctx.arc(p.x-off.x+canvas.width/2,p.y-off.y+canvas.height/2,p.r*(0.4+alpha*0.6),0,Math.PI*2); ctx.fill();
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
        ctx.restore();
    },

    // ─────────────────────────── GAME OVER ───────────────────────
    gameOver() {
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
        setTimeout(() => document.getElementById('gameover-screen').style.display = 'flex', 500);
    },

    // ─────────────────────────── MAIN LOOP ───────────────────────
    loop(now) {
        const dt = Math.min((now - (this.lastTime_loop||now)) / 1000, 0.08);
        this.lastTime_loop = now;
        if (this.state !== 'PAUSE') { this.update(dt); this.draw(); }
        requestAnimationFrame(t => this.loop(t));
    }
};

Game.init();
