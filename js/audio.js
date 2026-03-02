// ── audio.js ── Web Audio Engine ──
'use strict';

const AudioEngine = {
    ctx: null,
    _lastHit: 0,

    init() {
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch(e) { console.warn('Audio unavailable'); }
    },

    resume() {
        if (this.ctx?.state === 'suspended') this.ctx.resume();
    },

    playTone(freq, type, dur, vol = 0.07, detune = 0) {
        if (!this.ctx) return;
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

    sfxHit() {
        const now = Date.now();
        if (now - this._lastHit < 60) return;
        this._lastHit = now;
        this.playTone(120 + Math.random() * 80, 'square', 0.07, 0.035);
    },

    sfxLevel() {
        this.playTone(440, 'triangle', 0.35, 0.09);
        setTimeout(() => this.playTone(660, 'triangle', 0.35, 0.09), 100);
        setTimeout(() => this.playTone(880, 'triangle', 0.5,  0.09), 200);
    },

    sfxKill()      { this.playTone(80 + Math.random() * 40, 'sine', 0.12, 0.06); },
    sfxPowerup()   {
        this.playTone(500, 'sawtooth', 0.12, 0.07);
        setTimeout(() => this.playTone(750, 'sawtooth', 0.2, 0.07), 80);
    },
    sfxBoss()      {
        this.playTone(40, 'sawtooth', 1.2, 0.15);
        this.playTone(55, 'square',   0.8, 0.10, 500);
    },
    sfxLightning() { this.playTone(300 + Math.random() * 200, 'sawtooth', 0.04, 0.05); },
    sfxAchievement() {
        [440, 550, 660, 880].forEach((f, i) =>
            setTimeout(() => this.playTone(f, 'triangle', 0.25, 0.08), i * 60)
        );
    },
};
