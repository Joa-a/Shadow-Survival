// ── audio.js ── Web Audio Engine + Procedural BGM ──
'use strict';

const AudioEngine = {
    ctx: null,
    _lastHit:    0,
    _sfxMuted:   false,
    _musicMuted: false,

    // BGM state
    _bgmNodes:   [],    // all running music nodes (to stop cleanly)
    _bgmGain:    null,
    _bgmTheme:   null,  // 'normal' | 'boss' | null
    _bgmScheduleId: null,
    _bgmNextBeat:   0,
    _bgmBeat:       0,
    _bgmBpm:        96,

    setSfx(enabled)   { this._sfxMuted   = !enabled; try { localStorage.setItem('ss_sfx',   enabled?'1':'0'); } catch(e){} },
    setMusic(enabled) {
        this._musicMuted = !enabled;
        try { localStorage.setItem('ss_music', enabled?'1':'0'); } catch(e){}
        if (this._musicMuted) this.stopBgm();
        else if (this._bgmTheme) this.startBgm(this._bgmTheme);
    },
    loadPrefs() {
        try {
            const s = localStorage.getItem('ss_sfx');
            const m = localStorage.getItem('ss_music');
            if (s !== null) this._sfxMuted   = s === '0';
            if (m !== null) this._musicMuted = m === '0';
        } catch(e) {}
    },

    init() {
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch(e) { console.warn('Audio unavailable'); }
    },

    resume() { if (this.ctx?.state === 'suspended') this.ctx.resume(); },

    // ── SFX ─────────────────────────────────────────────────────
    playTone(freq, type, dur, vol = 0.07, detune = 0) {
        if (!this.ctx || this._sfxMuted) return;
        try {
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            o.type = type;
            o.frequency.setValueAtTime(freq, this.ctx.currentTime);
            if (detune) o.detune.setValueAtTime(detune, this.ctx.currentTime);
            g.gain.setValueAtTime(vol, this.ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
            o.connect(g); g.connect(this.ctx.destination);
            o.start(); o.stop(this.ctx.currentTime + dur);
        } catch(e) {}
    },

    sfxHit()    { const now=Date.now(); if(now-this._lastHit<60)return; this._lastHit=now; this.playTone(120+Math.random()*80,'square',0.07,0.035); },
    sfxLevel()  { this.playTone(440,'triangle',0.35,0.09); setTimeout(()=>this.playTone(660,'triangle',0.35,0.09),100); setTimeout(()=>this.playTone(880,'triangle',0.5,0.09),200); },
    sfxKill()   { this.playTone(80+Math.random()*40,'sine',0.12,0.06); },
    sfxPowerup(){ this.playTone(500,'sawtooth',0.12,0.07); setTimeout(()=>this.playTone(750,'sawtooth',0.2,0.07),80); },
    sfxBoss()   { this.playTone(40,'sawtooth',1.2,0.15); this.playTone(55,'square',0.8,0.10,500); },
    sfxLightning(){ this.playTone(300+Math.random()*200,'sawtooth',0.04,0.05); },
    sfxAchievement(){ [440,550,660,880].forEach((f,i)=>setTimeout(()=>this.playTone(f,'triangle',0.25,0.08),i*60)); },

    // ── BGM — Procedural Music Engine ────────────────────────────
    // Am pentatonic: A C D E G  (Hz for octaves 2–4)
    // Normal theme: 96bpm dark ambient/action
    // Boss theme:   120bpm intense, dissonant

    _noteHz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); },

    startBgm(theme = 'normal') {
        if (!this.ctx || this._musicMuted) return;
        if (this._bgmTheme === theme) return;
        this.stopBgm();
        this._bgmTheme = theme;

        // Master gain with fade-in
        const master = this.ctx.createGain();
        master.gain.setValueAtTime(0, this.ctx.currentTime);
        master.gain.linearRampToValueAtTime(theme === 'boss' ? 0.38 : 0.18, this.ctx.currentTime + 2.5);
        master.connect(this.ctx.destination);
        this._bgmGain = master;

        // Soft compressor to keep it clean
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -18; comp.ratio.value = 4;
        comp.connect(master);

        // Reverb-like delay
        const delay = this.ctx.createDelay(0.5);
        delay.delayTime.value = 0.22;
        const delayGain = this.ctx.createGain();
        delayGain.gain.value = 0.18;
        delay.connect(delayGain); delayGain.connect(comp);
        delay.connect(comp);

        this._bgmComp   = comp;
        this._bgmDelay  = delay;
        this._bgmBpm    = theme === 'boss' ? 120 : 72;
        this._bgmBeat   = 0;
        this._bgmNextBeat = this.ctx.currentTime;

        // Start drone layer (continuous)
        this._startDrone(theme, comp);

        // Start sequencer (beats)
        this._scheduleBgm(theme, comp, delay);
    },

    _startDrone(theme, dest) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        // Two detuned oscillators for a thick drone
        const freqs = theme === 'boss' ? [55, 41.2] : [55, 82.4];  // A1 / E1(boss) or A1 / E2
        freqs.forEach((f, i) => {
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            o.type = i === 0 ? 'sawtooth' : 'triangle';
            o.frequency.value = f;
            o.detune.value = i * 7;  // slight detune for warmth
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(theme === 'boss' ? 0.22 : 0.14, now + 3);
            // Slow LFO tremolo
            const lfo = this.ctx.createOscillator();
            const lfoGain = this.ctx.createGain();
            lfo.frequency.value = 0.3 + i * 0.07;
            lfoGain.gain.value  = 0.04;
            lfo.connect(lfoGain); lfoGain.connect(g.gain);
            lfo.start(now);
            o.connect(g); g.connect(dest);
            o.start(now);
            this._bgmNodes.push(o, lfo);
        });
    },

    _scheduleBgm(theme, dest, delay) {
        if (!this.ctx || this._bgmTheme !== theme) return;
        const beatSec  = 60 / this._bgmBpm;
        const lookahead = 0.2;   // schedule 200ms ahead
        const scheduleAhead = 0.5;

        const schedule = () => {
            if (!this.ctx || this._bgmTheme !== theme) return;
            while (this._bgmNextBeat < this.ctx.currentTime + scheduleAhead) {
                this._triggerBeat(theme, this._bgmBeat, this._bgmNextBeat, dest, delay);
                this._bgmBeat       = (this._bgmBeat + 1) % 32;
                this._bgmNextBeat  += beatSec;
            }
            this._bgmScheduleId = setTimeout(schedule, lookahead * 1000);
        };
        schedule();
    },

    _triggerBeat(theme, beat, t, dest, delay) {
        if (!this.ctx) return;
        const b = beat % 32;

        // ── Am pentatonic MIDI notes ─────────────────────────────
        const penta4 = [69,72,74,76,79];

        if (theme === 'normal') {
            // ── NORMAL THEME: sparse ambient — bass every 16 beats, very soft chords,
            //    NO melody arpeggio (that was the annoying part), minimal percussion ──

            // Bass: only on beats 0 and 16 (every ~8 bars at 96bpm = 10s cycle)
            if (b === 0 || b === 16) {
                this._schedNote(t, this._noteHz(45), 'sine', 0.14, 1.2, dest); // A2 sine, long fade
            }

            // Soft pad chord: every 8 beats, very low volume, long decay
            const normChords = [[57,60,64],[62,65,69],[60,64,67],[55,59,62]]; // Am Dm Cm Gm
            if (b % 8 === 0) {
                const chord = normChords[Math.floor(b / 8) % normChords.length];
                chord.forEach((midi, i) => {
                    const f = this._noteHz(midi);
                    this._schedNote(t + i * 0.04, f, 'triangle', 0.045, 1.8, delay);
                });
            }

            // Minimal kick: only on beat 0 every 16 beats
            if (b === 0 || b === 16) this._schedKick(t, 0.055, dest);
            // Very subtle snare: only every 16 beats
            if (b === 8 || b === 24) this._schedSnare(t, 0.03, dest);

        } else {
            // ── BOSS THEME: intense, aggressive, full sequencer ──────

            const bassBeats = [0,4,8,12,16,20,24,28];
            if (bassBeats.includes(b)) {
                this._schedNote(t, this._noteHz(45), 'sawtooth', 0.28, 0.55, dest);
            }
            if (b === 4 || b === 20) {
                this._schedNote(t, this._noteHz(33), 'sine', 0.18, 0.4, dest);
            }

            const bossChords = [[57,60,64],[55,58,62],[59,62,65],[53,57,60]];
            if (b % 4 === 0) {
                const chord = bossChords[Math.floor(b / 8) % bossChords.length];
                chord.forEach((midi, i) => {
                    const f = this._noteHz(midi);
                    setTimeout(() => {
                        if (!this.ctx) return;
                        this._schedNote(t + i * 0.012, f, 'triangle', 0.10, 0.35, delay);
                    }, 0);
                });
            }

            // Boss melody (aggressive arpeggio)
            const melPatBoss = [4,2,0,3,2,4,1,3, 0,4,2,1,3,0,4,2,
                                1,3,0,4,2,3,1,0, 4,1,3,2,0,4,3,1];
            const noteIdx = melPatBoss[b];
            if (noteIdx !== null && b % 2 === 1) {
                const f = this._noteHz(penta4[noteIdx % penta4.length] + 12);
                this._schedNote(t, f, 'triangle', 0.055, 0.18, delay);
            }

            if (b % 8 === 0 || b % 8 === 4) this._schedKick(t, 0.14, dest);
            if (b % 4 === 2) this._schedSnare(t, 0.09, dest);
            if (b % 2 === 1) this._schedHihat(t, 0.038, dest);
        }
    },

    _schedNote(t, freq, type, vol, dur, dest) {
        if (!this.ctx) return;
        try {
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            o.type = type; o.frequency.value = freq;
            g.gain.setValueAtTime(vol, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.connect(g); g.connect(dest);
            o.start(t); o.stop(t + dur + 0.05);
        } catch(e) {}
    },

    _schedKick(t, vol, dest) {
        if (!this.ctx) return;
        try {
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(160, t);
            o.frequency.exponentialRampToValueAtTime(30, t + 0.22);
            g.gain.setValueAtTime(vol, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
            o.connect(g); g.connect(dest);
            o.start(t); o.stop(t + 0.35);
        } catch(e) {}
    },

    _schedSnare(t, vol, dest) {
        if (!this.ctx) return;
        try {
            const buf    = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.12, this.ctx.sampleRate);
            const data   = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
            const src    = this.ctx.createBufferSource();
            const filt   = this.ctx.createBiquadFilter();
            const g      = this.ctx.createGain();
            src.buffer   = buf;
            filt.type    = 'bandpass'; filt.frequency.value = 1800; filt.Q.value = 0.8;
            g.gain.setValueAtTime(vol, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
            src.connect(filt); filt.connect(g); g.connect(dest);
            src.start(t); src.stop(t + 0.15);
        } catch(e) {}
    },

    _schedHihat(t, vol, dest) {
        if (!this.ctx) return;
        try {
            const buf  = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.04, this.ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
            const src  = this.ctx.createBufferSource();
            const filt = this.ctx.createBiquadFilter();
            const g    = this.ctx.createGain();
            src.buffer = buf;
            filt.type  = 'highpass'; filt.frequency.value = 7000;
            g.gain.setValueAtTime(vol, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
            src.connect(filt); filt.connect(g); g.connect(dest);
            src.start(t); src.stop(t + 0.06);
        } catch(e) {}
    },

    stopBgm(fade = 1.2) {
        if (this._bgmScheduleId) { clearTimeout(this._bgmScheduleId); this._bgmScheduleId = null; }
        if (this._bgmGain && this.ctx) {
            this._bgmGain.gain.cancelScheduledValues(this.ctx.currentTime);
            this._bgmGain.gain.setValueAtTime(this._bgmGain.gain.value, this.ctx.currentTime);
            this._bgmGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + fade);
        }
        this._bgmNodes.forEach(n => { try { n.stop(this.ctx?.currentTime + fade + 0.1 || 0); } catch(e){} });
        this._bgmNodes  = [];
        this._bgmTheme  = null;
        this._bgmGain   = null;
    },

    setBossTheme(active) {
        const wanted = active ? 'boss' : 'normal';
        if (this._bgmTheme !== wanted) this.startBgm(wanted);
    },

    pauseBgm() {
        if (this._bgmGain && this.ctx) {
            this._bgmGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
        }
    },
    resumeBgm() {
        if (this._bgmGain && this.ctx && !this._musicMuted) {
            const vol = this._bgmTheme === 'boss' ? 0.38 : 0.28;
            this._bgmGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.5);
        }
    },
};
