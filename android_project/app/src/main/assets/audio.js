/*
 * IRANIAN HIGHWAY 3D RACER - SYNTHESIZED WEB AUDIO ENGINE & RADIO
 */

class AudioEngine {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.radioStations = [
            '📻 رادیو شوتی (Bass Remix)',
            '🎵 رادیو جاده چالوس (Nostalgia)',
            '⚡ رادیو سیستم (Deep Bass Electro)',
            '❌ رادیو خاموش'
        ];
        this.currentStationIdx = 0;
        this.isAudioUnlocked = false;
    }

    init() {
        if (this.ctx) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
            this.isAudioUnlocked = true;
        } catch (e) {
            console.error('AudioContext not supported:', e);
        }
    }

    playCoin() {
        if (!this.ctx || this.isMuted) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(988, this.ctx.currentTime); // B5
            osc.frequency.exponentialRampToValueAtTime(1318, this.ctx.currentTime + 0.12); // E6

            gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + 0.12);
        } catch (e) {}
    }

    playNitro() {
        if (!this.ctx || this.isMuted) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.4);

            gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + 0.4);
        } catch (e) {}
    }

    playCrash() {
        if (!this.ctx || this.isMuted) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(80, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 0.5);

            gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + 0.5);
        } catch (e) {}
    }

    playLaneSwitch() {
        if (!this.ctx || this.isMuted) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.08);

            gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + 0.08);
        } catch (e) {}
    }

    updateEnginePitch(ratio) {
        // Dynamic engine tone placeholder
    }

    nextRadioStation() {
        this.currentStationIdx = (this.currentStationIdx + 1) % this.radioStations.length;
        return this.radioStations[this.currentStationIdx];
    }
}

window.audioMgr = new AudioEngine();
