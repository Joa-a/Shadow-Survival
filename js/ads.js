// ── ads.js ── Rewarded Ad Bridge ─────────────────────────────────────────
// Separates ad SDK from game logic completely.
// In browser: simulates a 3-second "ad" so all reward flows work without SDK.
// In Capacitor + AdMob: replace _showNativeAd() with the real AdMob call.
//
// HOW TO CONNECT ADMOB (when you build the APK):
//   1. npm install @capacitor-community/admob
//   2. In _showNativeAd(), replace the simulation with:
//
//      import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob';
//
//      await AdMob.prepareRewardVideoAd({ adId: 'YOUR_AD_UNIT_ID' });
//      AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
//          this._onRewarded(this._pendingRewardType);
//      });
//      await AdMob.showRewardVideoAd();
//
// ─────────────────────────────────────────────────────────────────────────
'use strict';

const AdsManager = {

    // ── State ─────────────────────────────────────────────────────
    _usedThisSession: new Set(), // tracks which rewards were already claimed
    _pendingRewardType: null,
    _isShowing: false,

    // ── Reward definitions ────────────────────────────────────────
    REWARDS: {
        starter_chest: {
            label:     '🎁 Cofre Inicial',
            detail:    'Empieza con 1 upgrade aleatorio',
            cooldown:  'once',   // can only claim once per session
        },
        revive: {
            label:     '💀 Revivir',
            detail:    'Continúa donde caíste con 30% HP',
            cooldown:  'once',
        },
        reroll: {
            label:     '🎲 Re-Roll',
            detail:    'Cambia las 3 opciones de upgrade',
            cooldown:  'always', // can use multiple times
        },
        xp_boost: {
            label:     '⚡ Impulso XP',
            detail:    '+25% XP durante 60 segundos',
            cooldown:  'once',
        },
    },

    // ── Public API ────────────────────────────────────────────────

    // Can this reward be claimed right now?
    canClaim(type) {
        const r = this.REWARDS[type];
        if (!r) return false;
        if (r.cooldown === 'once' && this._usedThisSession.has(type)) return false;
        return true;
    },

    // Request an ad for a given reward type.
    // onGranted() is called if the user watches the full ad.
    request(type, onGranted) {
        if (!this.canClaim(type)) return;
        if (this._isShowing) return;
        this._pendingRewardType = type;
        this._pendingCallback   = onGranted;
        this._showAdOverlay(type);
    },

    // Reset between sessions (called in Game.start())
    resetSession() {
        this._usedThisSession.clear();
        this._isShowing = false;
        this._pendingRewardType = null;
    },

    // ── Internal ──────────────────────────────────────────────────

    _showAdOverlay(type) {
        this._isShowing = true;
        const reward    = this.REWARDS[type];
        const overlay   = document.getElementById('ad-overlay');
        const bar       = document.getElementById('ad-progress-bar');
        const label     = document.getElementById('ad-reward-label');
        const btn       = document.getElementById('ad-skip-btn');

        if (!overlay) { this._onRewarded(type); return; } // fallback if no HTML

        label.textContent = `${reward.label} — ${reward.detail}`;
        btn.style.display = 'none';
        bar.style.width   = '0%';
        overlay.style.display = 'flex';

        // ── Simulate a 3-second ad (replace with real AdMob call here) ──
        this._showNativeAd(type);
    },

    // Replace this method body with real AdMob SDK call in Capacitor build
    _showNativeAd(type) {
        const bar      = document.getElementById('ad-progress-bar');
        const btn      = document.getElementById('ad-skip-btn');
        const DURATION = 3000; // ms — match your AdMob min watch time
        const start    = Date.now();

        const tick = () => {
            const pct = Math.min(1, (Date.now() - start) / DURATION);
            if (bar) bar.style.width = (pct * 100) + '%';
            if (pct < 1) {
                requestAnimationFrame(tick);
            } else {
                // Ad finished — reward granted automatically
                if (btn) { btn.textContent = '✔ RECLAMAR'; btn.style.display = 'block'; }
                // Auto-grant after 400ms so user sees the complete bar
                setTimeout(() => this._onRewarded(type), 400);
            }
        };
        requestAnimationFrame(tick);
    },

    _onRewarded(type) {
        this._isShowing = false;
        const overlay = document.getElementById('ad-overlay');
        if (overlay) overlay.style.display = 'none';

        const r = this.REWARDS[type];
        if (r?.cooldown === 'once') this._usedThisSession.add(type);

        if (this._pendingCallback) {
            this._pendingCallback(type);
            this._pendingCallback = null;
        }
    },

    _cancelAd() {
        this._isShowing = false;
        this._pendingCallback = null;
        const overlay = document.getElementById('ad-overlay');
        if (overlay) overlay.style.display = 'none';
    },
};
