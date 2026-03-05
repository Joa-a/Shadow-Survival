// ── intro.js ── Loading Screen + Title Screen ──
'use strict';

const Intro = {

    // ═══════════════════════════════════════════════
    //  LOADING SCREEN
    // ═══════════════════════════════════════════════
    _loadCanvas:  null,
    _loadCtx:     null,
    _loadProgress: 0,       // 0-100
    _loadTarget:   0,
    _loadDone:     false,
    _loadRAF:      null,
    _loadSteps: [
        { label: 'INICIALIZANDO MOTOR...',   end: 15  },
        { label: 'GENERANDO MUNDO...',       end: 30  },
        { label: 'CARGANDO ENEMIGOS...',     end: 48  },
        { label: 'PREPARANDO ARMAS...',      end: 63  },
        { label: 'CALIBRANDO SOMBRAS...',    end: 77  },
        { label: 'INVOCANDO OSCURIDAD...',   end: 90  },
        { label: 'LISTO.',                   end: 100 },
    ],
    _loadCurrentStep: 0,
    _loadParticles: [],
    _loadStartTime: 0,
    _totalDuration: 3200,   // ms total de carga falsa

    startLoading(onComplete) {
        this._onLoadComplete = onComplete;
        this._loadStartTime  = performance.now();
        this._loadProgress   = 0;
        this._loadTarget     = 0;
        this._loadDone       = false;
        this._loadCurrentStep = 0;
        this._loadParticles  = [];

        // Canvas de carga
        const el = document.getElementById('loading-screen');
        el.style.display = 'flex';
        this._loadCanvas = document.getElementById('loading-canvas');
        this._loadCtx    = this._loadCanvas.getContext('2d');
        this._resizeLoadCanvas();
        window.addEventListener('resize', () => this._resizeLoadCanvas());

        // Generar partículas de fondo
        for (let i = 0; i < 80; i++) {
            this._loadParticles.push({
                x:   Math.random() * window.innerWidth,
                y:   Math.random() * window.innerHeight,
                vy:  -(0.3 + Math.random() * 1.2),
                vx:  (Math.random() - 0.5) * 0.4,
                r:   0.5 + Math.random() * 2.5,
                alpha: 0.1 + Math.random() * 0.6,
                hue:  Math.random() > 0.7 ? 340 : 260,
            });
        }

        this._loadRAF = requestAnimationFrame(t => this._loadLoop(t));
    },

    _resizeLoadCanvas() {
        if (!this._loadCanvas) return;
        const dpr = window.devicePixelRatio || 1;
        const W   = window.innerWidth;
        const H   = window.innerHeight;
        this._loadCanvas.width  = W * dpr;
        this._loadCanvas.height = H * dpr;
        this._loadCanvas.style.width  = W + 'px';
        this._loadCanvas.style.height = H + 'px';
        const ctx = this._loadCanvas.getContext('2d');
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },

    _loadLoop(now) {
        if (this._loadDone) return;

        const elapsed = now - this._loadStartTime;
        const pct     = Math.min(1, elapsed / this._totalDuration);

        // Advance step targets
        for (let i = 0; i < this._loadSteps.length; i++) {
            const step = this._loadSteps[i];
            const stepPct = step.end / 100;
            if (pct >= stepPct - 0.01) {
                this._loadCurrentStep = i;
            }
        }
        this._loadTarget   = Math.min(100, pct * 100);
        this._loadProgress = M.lerp(this._loadProgress, this._loadTarget, 0.08);

        this._drawLoading(now);

        if (pct >= 1 && this._loadProgress >= 99.5) {
            this._finishLoading();
            return;
        }
        this._loadRAF = requestAnimationFrame(t => this._loadLoop(t));
    },

    _drawLoading(now) {
        const ctx = this._loadCtx;
        const dpr = window.devicePixelRatio || 1;
        this._loadCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this._loadCtx.imageSmoothingEnabled = false;
        const W  = window.innerWidth;
        const H  = window.innerHeight;
        const cx = W / 2, cy = H / 2;

        // Background
        ctx.fillStyle = '#03010a';
        ctx.fillRect(0, 0, W, H);

        // Radial glow center
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.6);
        grd.addColorStop(0,   'rgba(255,34,85,0.06)');
        grd.addColorStop(0.5, 'rgba(60,0,90,0.04)');
        grd.addColorStop(1,   'transparent');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, W, H);

        // Scanlines
        ctx.fillStyle = 'rgba(0,0,0,0.03)';
        for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);

        // Floating particles
        this._loadParticles.forEach(p => {
            p.y += p.vy;
            p.x += p.vx;
            if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
            ctx.save();
            ctx.globalAlpha = p.alpha * (0.5 + Math.sin(now * 0.002 + p.x) * 0.5);
            ctx.fillStyle   = `hsl(${p.hue}, 80%, 65%)`;
            ctx.shadowColor = `hsl(${p.hue}, 80%, 65%)`;
            ctx.shadowBlur  = 8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        // ── LOGO ──
        const logoY  = cy - 100;
        const pulse  = Math.sin(now * 0.0025) * 0.3 + 0.7;

        // Moon glyph
        ctx.save();
        ctx.font        = `${clamp(40, 6, 80)}px serif`;
        ctx.textAlign   = 'center';
        ctx.textBaseline= 'middle';
        ctx.globalAlpha = pulse;
        ctx.fillStyle   = '#ff2255';
        ctx.shadowColor = '#ff2255';
        ctx.shadowBlur  = 30 * pulse;
        ctx.fillText('☽', cx, logoY - 30);
        ctx.restore();

        // Title
        ctx.save();
        ctx.font        = `900 ${clamp(24, 20, 44)}px 'Orbitron', sans-serif`;
        ctx.textAlign   = 'center';
        ctx.textBaseline= 'middle';
        ctx.fillStyle   = '#ff2255';
        ctx.shadowColor = '#ff2255';
        ctx.shadowBlur  = 20 * pulse;
        ctx.fillText('SHADOW SURVIVOR', cx, logoY + 16);
        ctx.shadowBlur  = 0;
        ctx.fillStyle   = 'rgba(255,255,255,0.12)';
        ctx.font        = `${clamp(9, 8, 13)}px 'Orbitron', sans-serif`;
        ctx.letterSpacing = '6px';
        ctx.fillText('ETERNAL NIGHT EDITION', cx, logoY + 46);
        ctx.restore();

        // ── PROGRESS BAR ──
        const barW = Math.min(440, W * 0.75);
        const barH = 3;
        const barX = cx - barW / 2;
        const barY = cy + 40;

        // Track
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(barX, barY, barW, barH);

        // Glow fill
        const fillW = barW * (this._loadProgress / 100);
        const barGrd = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        barGrd.addColorStop(0,   '#440015');
        barGrd.addColorStop(0.5, '#ff2255');
        barGrd.addColorStop(1,   '#ff88aa');
        ctx.save();
        ctx.shadowColor = '#ff2255';
        ctx.shadowBlur  = 12;
        ctx.fillStyle   = barGrd;
        ctx.fillRect(barX, barY, fillW, barH);
        ctx.restore();

        // Leading dot
        if (fillW > 4) {
            ctx.save();
            ctx.fillStyle   = '#ffffff';
            ctx.shadowColor = '#ff2255';
            ctx.shadowBlur  = 18;
            ctx.beginPath();
            ctx.arc(barX + fillW, barY + barH / 2, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Percent
        ctx.save();
        ctx.font        = `${clamp(10, 9, 12)}px 'Orbitron', sans-serif`;
        ctx.textAlign   = 'right';
        ctx.textBaseline= 'middle';
        ctx.fillStyle   = 'rgba(255,34,85,0.7)';
        ctx.fillText(Math.floor(this._loadProgress) + '%', barX + barW, barY - 10);
        ctx.restore();

        // Step label
        const stepLabel = this._loadSteps[this._loadCurrentStep]?.label || '';
        ctx.save();
        ctx.font        = `${clamp(9, 8, 11)}px 'Orbitron', sans-serif`;
        ctx.textAlign   = 'left';
        ctx.textBaseline= 'middle';
        ctx.globalAlpha = 0.5;
        ctx.fillStyle   = '#cc8899';
        ctx.fillText(stepLabel, barX, barY - 10);
        ctx.restore();

        // Corner decorations
        this._drawCornerDeco(ctx, W, H, now);

        // Version tag
        ctx.save();
        ctx.font        = '9px monospace';
        ctx.fillStyle   = 'rgba(80,50,80,0.6)';
        ctx.textAlign   = 'right';
        ctx.textBaseline= 'bottom';
        ctx.fillText('v2.0.0 · ETERNAL NIGHT', W - 14, H - 14);
        ctx.restore();
    },

    _drawCornerDeco(ctx, W, H, now) {
        const t     = now * 0.001;
        const alpha = 0.18 + Math.sin(t) * 0.06;
        const len   = 28;
        ctx.save();
        ctx.strokeStyle = `rgba(255,34,85,${alpha})`;
        ctx.lineWidth   = 1.5;
        // Top-left
        ctx.beginPath(); ctx.moveTo(16, 16 + len); ctx.lineTo(16, 16); ctx.lineTo(16 + len, 16); ctx.stroke();
        // Top-right
        ctx.beginPath(); ctx.moveTo(W - 16 - len, 16); ctx.lineTo(W - 16, 16); ctx.lineTo(W - 16, 16 + len); ctx.stroke();
        // Bottom-left
        ctx.beginPath(); ctx.moveTo(16, H - 16 - len); ctx.lineTo(16, H - 16); ctx.lineTo(16 + len, H - 16); ctx.stroke();
        // Bottom-right
        ctx.beginPath(); ctx.moveTo(W - 16 - len, H - 16); ctx.lineTo(W - 16, H - 16); ctx.lineTo(W - 16, H - 16 - len); ctx.stroke();
        ctx.restore();
    },

    _finishLoading() {
        this._loadDone = true;
        const el = document.getElementById('loading-screen');
        el.style.transition = 'opacity 0.7s ease';
        el.style.opacity    = '0';
        setTimeout(() => {
            el.style.display = 'none';
            el.style.opacity = '1';
            el.style.transition = '';
            this._onLoadComplete?.();
        }, 720);
    },

    // ═══════════════════════════════════════════════
    //  TITLE SCREEN
    // ═══════════════════════════════════════════════
    _titleCanvas:   null,
    _titleCtx:      null,
    _titleRAF:      null,
    _titleDone:     false,
    _titleStars:    [],
    _titleMeteors:  [],
    _titleLoreIdx:  0,
    _titleLoreChar: 0,
    _titleLoreTimer: 0,
    _titleBlinkTimer: 0,
    _titleReady:    false,   // true once lore finishes typing
    _titleEnterAlpha: 0,

    _LORE_LINES: [
        'La oscuridad llegó sin aviso.',
        'Los Horrores Antiguos despertaron bajo la luna roja.',
        'Eres el último superviviente.',
        'Lucha. Mejora. Sobrevive a la Noche Eterna.',
    ],
    _titleTyped: '',      // full typed string so far

    showTitle(onComplete) {
        this._onTitleComplete = onComplete;
        this._titleDone       = false;
        this._titleReady      = false;
        this._titleLoreIdx    = 0;
        this._titleLoreChar   = 0;
        this._titleLoreTimer  = 0;
        this._titleTyped      = '';
        this._titleEnterAlpha = 0;
        this._titleStars      = [];
        this._titleMeteors    = [];

        const el = document.getElementById('title-screen');
        el.style.display = 'flex';
        el.style.opacity = '0';
        el.style.transition = 'opacity 0.5s ease';
        setTimeout(() => { el.style.opacity = '1'; }, 20);

        this._titleCanvas = document.getElementById('title-canvas');
        this._titleCtx    = this._titleCanvas.getContext('2d');
        this._resizeTitleCanvas();
        window.addEventListener('resize', () => this._resizeTitleCanvas());

        // Generate stars
        for (let i = 0; i < 200; i++) {
            this._titleStars.push({
                x:     Math.random() * window.innerWidth,
                y:     Math.random() * window.innerHeight,
                r:     0.3 + Math.random() * 1.8,
                alpha: 0.2 + Math.random() * 0.8,
                speed: 0.1 + Math.random() * 0.3,
                twinkle: Math.random() * Math.PI * 2,
            });
        }

        // Attach "any key / tap" listener
        this._titleKeyHandler = () => this._advanceTitle();
        window.addEventListener('keydown', this._titleKeyHandler, { once: true });

        const btn = document.getElementById('title-continue-btn');
        if (btn) btn.onclick = () => this._advanceTitle();

        this._titleLastTime = performance.now();
        this._titleRAF = requestAnimationFrame(t => this._titleLoop(t));
    },

    _resizeTitleCanvas() {
        if (!this._titleCanvas) return;
        const dpr = window.devicePixelRatio || 1;
        const W   = window.innerWidth;
        const H   = window.innerHeight;
        this._titleCanvas.width  = W * dpr;
        this._titleCanvas.height = H * dpr;
        this._titleCanvas.style.width  = W + 'px';
        this._titleCanvas.style.height = H + 'px';
        // Scale context so font sizes use CSS pixels (same as before)
        const ctx = this._titleCanvas.getContext('2d');
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },

    _titleLoop(now) {
        if (this._titleDone) return;
        const dt = Math.min((now - (this._titleLastTime || now)) / 1000, 0.05);
        this._titleLastTime = now;

        // Advance typewriter
        this._titleLoreTimer += dt;
        const typeSpeed = 0.032; // seconds per character
        if (this._titleLoreIdx < this._LORE_LINES.length) {
            while (this._titleLoreTimer >= typeSpeed) {
                this._titleLoreTimer -= typeSpeed;
                const line = this._LORE_LINES[this._titleLoreIdx];
                if (this._titleLoreChar < line.length) {
                    this._titleTyped += line[this._titleLoreChar];
                    this._titleLoreChar++;
                } else {
                    // Line done — move to next
                    this._titleLoreIdx++;
                    this._titleLoreChar = 0;
                    if (this._titleLoreIdx < this._LORE_LINES.length) {
                        this._titleTyped += '\n';
                        this._titleLoreTimer = -0.3; // tiny pause before next line
                    } else {
                        this._titleReady = true;
                    }
                }
            }
        }

        if (this._titleReady) {
            this._titleEnterAlpha = Math.min(1, this._titleEnterAlpha + dt * 2);
        }

        // Sporadic meteor
        if (Math.random() < 0.008) {
            this._titleMeteors.push({
                x:   Math.random() * window.innerWidth,
                y:   -20,
                vx:  2 + Math.random() * 4,
                vy:  3 + Math.random() * 5,
                life: 1, maxLife: 1,
                len: 60 + Math.random() * 80,
            });
        }
        this._titleMeteors = this._titleMeteors.filter(m => {
            m.x += m.vx; m.y += m.vy; m.life -= dt * 1.5; return m.life > 0;
        });

        this._drawTitle(now);
        this._titleRAF = requestAnimationFrame(t => this._titleLoop(t));
    },

    _drawTitle(now) {
        const ctx = this._titleCtx;
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;   // crisp text, no blur
        const W  = window.innerWidth;
        const H  = window.innerHeight;
        const cx = W / 2;

        // Deep space background
        ctx.fillStyle = '#02010c';
        ctx.fillRect(0, 0, W, H);

        // Nebula blobs
        const blobs = [
            { x: cx * 0.4, y: H * 0.3, r: W * 0.4, color: 'rgba(100,0,180,0.035)' },
            { x: cx * 1.6, y: H * 0.6, r: W * 0.35, color: 'rgba(180,0,60,0.03)'  },
            { x: cx,       y: H * 0.9, r: W * 0.5,  color: 'rgba(0,30,120,0.025)' },
        ];
        blobs.forEach(b => {
            const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
            g.addColorStop(0, b.color); g.addColorStop(1, 'transparent');
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        });

        // Stars
        const t = now * 0.001;
        this._titleStars.forEach(s => {
            s.y += s.speed;
            if (s.y > H + 5) { s.y = -5; s.x = Math.random() * W; }
            const tw = Math.sin(t * 2 + s.twinkle);
            ctx.globalAlpha = s.alpha * (0.6 + tw * 0.4);
            ctx.fillStyle   = tw > 0.5 ? '#ffffff' : '#cc88ff';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Meteors
        this._titleMeteors.forEach(m => {
            ctx.save();
            ctx.globalAlpha = m.life;
            ctx.strokeStyle = '#ffddaa';
            ctx.lineWidth   = 1.5;
            ctx.shadowColor = '#ff8844';
            ctx.shadowBlur  = 8;
            ctx.beginPath();
            ctx.moveTo(m.x, m.y);
            ctx.lineTo(m.x - m.vx / (m.vx + m.vy) * m.len, m.y - m.vy / (m.vx + m.vy) * m.len);
            ctx.stroke();
            ctx.restore();
        });

        // ── GIANT MOON BACKDROP ──
        const moonR  = Math.min(W, H) * 0.28;
        const moonX  = cx;
        const moonY  = H * 0.34;
        const moonPulse = 0.85 + Math.sin(t * 0.6) * 0.15;

        // Moon glow rings
        for (let ring = 4; ring >= 1; ring--) {
            const rg = ctx.createRadialGradient(moonX, moonY, moonR * 0.8, moonX, moonY, moonR * (1 + ring * 0.35));
            rg.addColorStop(0,   `rgba(255,20,60,${0.04 * moonPulse})`);
            rg.addColorStop(1,   'transparent');
            ctx.fillStyle = rg;
            ctx.fillRect(0, 0, W, H);
        }

        // Moon disc
        const mg = ctx.createRadialGradient(moonX - moonR * 0.2, moonY - moonR * 0.2, moonR * 0.1, moonX, moonY, moonR);
        mg.addColorStop(0,   '#4a1020');
        mg.addColorStop(0.6, '#1a0510');
        mg.addColorStop(1,   '#0a0208');
        ctx.save();
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
        ctx.fillStyle = mg;
        ctx.fill();

        // Moon craters
        const craters = [
            { ox: -0.25, oy: -0.15, r: 0.18 },
            { ox:  0.30, oy:  0.20, r: 0.12 },
            { ox: -0.10, oy:  0.30, r: 0.08 },
        ];
        craters.forEach(c => {
            const cg = ctx.createRadialGradient(
                moonX + c.ox * moonR, moonY + c.oy * moonR, 0,
                moonX + c.ox * moonR, moonY + c.oy * moonR, c.r * moonR
            );
            cg.addColorStop(0,   'rgba(0,0,0,0.4)');
            cg.addColorStop(1,   'transparent');
            ctx.fillStyle = cg;
            ctx.beginPath();
            ctx.arc(moonX + c.ox * moonR, moonY + c.oy * moonR, c.r * moonR, 0, Math.PI * 2);
            ctx.fill();
        });

        // Moon rim glow
        ctx.strokeStyle = `rgba(255,60,80,${0.25 * moonPulse})`;
        ctx.lineWidth   = 2;
        ctx.shadowColor = '#ff2255';
        ctx.shadowBlur  = 20;
        ctx.stroke();
        ctx.restore();

        // Scanlines over everything
        ctx.fillStyle = 'rgba(0,0,0,0.025)';
        for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);

        // ── GAME TITLE ──
        const titleY   = H * 0.62;
        const titleSize = clamp(28, 22, 56);
        const glowAlpha = 0.6 + Math.sin(t * 1.2) * 0.4;

        ctx.save();
        ctx.textAlign   = 'center';
        ctx.textBaseline= 'middle';

        // Title shadow layers
        for (let s = 3; s >= 1; s--) {
            ctx.globalAlpha = 0.15 * s * glowAlpha;
            ctx.fillStyle   = '#ff2255';
            ctx.font        = `900 ${titleSize + s * 2}px 'Orbitron', sans-serif`;
            ctx.fillText('SHADOW SURVIVOR', cx, titleY);
        }
        // Main title
        ctx.globalAlpha = 1;
        ctx.fillStyle   = '#ff2255';
        ctx.shadowColor = '#ff2255';
        ctx.shadowBlur  = 24 * glowAlpha;
        ctx.font        = `900 ${titleSize}px 'Orbitron', sans-serif`;
        ctx.fillText('SHADOW SURVIVOR', cx, titleY);

        // Subtitle
        ctx.shadowBlur  = 0;
        ctx.globalAlpha = 0.55;
        ctx.fillStyle   = '#cc4466';
        ctx.font        = `${clamp(9, 8, 12)}px 'Orbitron', sans-serif`;
        ctx.fillText('ETERNAL NIGHT EDITION', cx, titleY + titleSize * 0.9);
        ctx.restore();

        // ── TYPEWRITER LORE ──
        const loreY     = titleY + titleSize * 1.5 + 18;
        const loreSize  = clamp(10, 9, 14);
        const lines     = this._titleTyped.split('\n');

        ctx.save();
        ctx.textAlign   = 'center';
        ctx.textBaseline= 'top';
        ctx.font        = `${loreSize}px 'Rajdhani', sans-serif`;
        lines.forEach((line, i) => {
            const alpha = Math.min(1, (lines.length - i) * 0.35 + 0.4);
            ctx.globalAlpha = alpha;
            ctx.fillStyle   = i === lines.length - 1 ? '#ddaacc' : '#886688';
            ctx.shadowColor = '#ff2255';
            ctx.shadowBlur  = i === lines.length - 1 ? 6 : 0;
            ctx.fillText(line, cx, loreY + i * (loreSize + 8));
        });

        // Cursor blink on last incomplete line
        if (!this._titleReady) {
            const lastLine = lines[lines.length - 1] || '';
            const tw = ctx.measureText(lastLine).width;
            const cursorX = cx + tw / 2 + 3;
            const cursorY = loreY + (lines.length - 1) * (loreSize + 8);
            ctx.globalAlpha = Math.sin(now * 0.008) > 0 ? 0.9 : 0;
            ctx.fillStyle   = '#ff4488';
            ctx.fillRect(cursorX, cursorY, 2, loreSize);
        }
        ctx.restore();

        // ── CONTINUE PROMPT ──
        if (this._titleReady) {
            const blink  = 0.4 + Math.abs(Math.sin(now * 0.003)) * 0.6;
            const promptY = loreY + lines.length * (loreSize + 8) + 30;
            ctx.save();
            ctx.textAlign   = 'center';
            ctx.textBaseline= 'middle';
            ctx.globalAlpha = blink * this._titleEnterAlpha;
            ctx.font        = `${clamp(10, 9, 13)}px 'Orbitron', sans-serif`;
            ctx.fillStyle   = '#ff2255';
            ctx.shadowColor = '#ff2255';
            ctx.shadowBlur  = 10;
            ctx.fillText('▶  PRESIONA CUALQUIER TECLA  ◀', cx, promptY);
            ctx.shadowBlur  = 0;
            ctx.restore();
        }

        // Corner decos
        this._drawCornerDeco(this._titleCtx, W, H, now);
    },

    _advanceTitle() {
        if (!this._titleReady) {
            // Skip typing instantly
            this._titleTyped = this._LORE_LINES.join('\n');
            this._titleReady  = true;
            this._titleLoreIdx = this._LORE_LINES.length;
            return;
        }
        this._closeTitleScreen();
    },

    _closeTitleScreen() {
        this._titleDone = true;
        window.removeEventListener('keydown', this._titleKeyHandler);
        const el = document.getElementById('title-screen');
        el.style.transition = 'opacity 0.55s ease';
        el.style.opacity    = '0';
        setTimeout(() => {
            el.style.display = 'none';
            el.style.opacity = '1';
            el.style.transition = '';
            this._onTitleComplete?.();
        }, 570);
    },

    // ═══════════════════════════════════════════════
    //  SHARED HELPER
    // ═══════════════════════════════════════════════
    _drawCornerDeco(ctx, W, H, now) {
        const alpha = 0.15 + Math.sin(now * 0.001) * 0.05;
        const len   = 26;
        ctx.save();
        ctx.strokeStyle = `rgba(255,34,85,${alpha})`;
        ctx.lineWidth   = 1.5;
        ctx.beginPath(); ctx.moveTo(16, 16 + len); ctx.lineTo(16, 16);       ctx.lineTo(16 + len, 16);       ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W-16-len, 16);  ctx.lineTo(W-16, 16);    ctx.lineTo(W-16, 16+len);       ctx.stroke();
        ctx.beginPath(); ctx.moveTo(16, H-16-len);  ctx.lineTo(16, H-16);    ctx.lineTo(16+len, H-16);       ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W-16-len, H-16);ctx.lineTo(W-16, H-16);  ctx.lineTo(W-16, H-16-len);     ctx.stroke();
        ctx.restore();
    },
};

// Helper — scale pixel value, mobile-aware
// On mobile (<= 600px) uses 430px as reference so text is readable
function clamp(val, vmin, vmax) {
    const W = window.innerWidth;
    // Mobile: use 430px reference, scale to screen, minimum 100% of val
    // Desktop: scale from 1280px reference
    const ref   = W <= 600 ? 430 : 1280;
    const scale = W <= 600
        ? Math.max(1.0, W / ref)    // mobile: never smaller than base
        : Math.max(0.7, W / ref);   // desktop: allow some shrinkage
    return Math.max(vmin, Math.min(vmax, val * scale));
}
