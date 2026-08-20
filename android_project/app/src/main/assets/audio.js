/*
 * IRANIAN HIGHWAY 3D RACER - SYNTHESIZED WEB AUDIO SIMULATOR & RADIO
 * Dual-Oscillator RPM Synthesis, Tire Skid Noise, Gear Shift & Wind Effects
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

        // Dynamic Engine Audio Nodes
        this.engineOsc1 = null;
        this.engineOsc2 = null;
        this.engineGain = null;
        this.masterGain = null;
        this.masterVolumeLevel = 1.0;
        this.isEngineRunning = false;

        // Tire Skid Noise Nodes
        this.skidNoiseNode = null;
        this.skidGain = null;
        this.isSkidding = false;
    }

    init() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') {
                this.ctx.resume().catch(() => {});
            }
            return;
        }
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
            if (this.ctx.state === 'suspended') {
                this.ctx.resume().catch(() => {});
            }
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(this.masterVolumeLevel, this.ctx.currentTime);
            this.masterGain.connect(this.ctx.destination);

            this.isAudioUnlocked = true;
            this.setupEngineSound();
            this.setupTireSkidSound();
        } catch (e) {
            console.error('AudioContext not supported:', e);
        }
    }

    setMasterVolume(vol) {
        this.masterVolumeLevel = Math.max(0.0, Math.min(1.0, vol));
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setTargetAtTime(this.masterVolumeLevel, this.ctx.currentTime, 0.03);
        }
    }

    getDestination() {
        return this.masterGain || (this.ctx ? this.ctx.destination : null);
    }

    setupEngineSound() {
        if (!this.ctx) return;
        try {
            this.engineOsc1 = this.ctx.createOscillator();
            this.engineOsc2 = this.ctx.createOscillator();

            this.engineOsc1.type = 'sawtooth';
            this.engineOsc2.type = 'triangle';

            this.engineGain = this.ctx.createGain();
            this.engineGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

            this.engineOsc1.connect(this.engineGain);
            this.engineOsc2.connect(this.engineGain);
            this.engineGain.connect(this.getDestination());

            this.engineOsc1.start();
            this.engineOsc2.start();
            this.isEngineRunning = true;
        } catch (e) {}
    }

    setupTireSkidSound() {
        if (!this.ctx) return;
        try {
            // White noise buffer for tire skid
            const bufferSize = this.ctx.sampleRate * 1.0;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            this.skidNoiseNode = this.ctx.createBufferSource();
            this.skidNoiseNode.buffer = buffer;
            this.skidNoiseNode.loop = true;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1200, this.ctx.currentTime);
            filter.Q.setValueAtTime(3.0, this.ctx.currentTime);

            this.skidGain = this.ctx.createGain();
            this.skidGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

            this.skidNoiseNode.connect(filter);
            filter.connect(this.skidGain);
            this.skidGain.connect(this.ctx.destination);

            this.skidNoiseNode.start();
        } catch (e) {}
    }

    updateEngineRPM(rpm, loadRatio = 0.5) {
        if (!this.ctx || !this.isEngineRunning || this.isMuted) return;
        try {
            // Calculate base frequency from RPM (1000 RPM -> ~55 Hz, 7000 RPM -> ~320 Hz)
            const baseFreq = 55 + (rpm / 7000) * 265;
            const currentTime = this.ctx.currentTime;

            this.engineOsc1.frequency.setTargetAtTime(baseFreq, currentTime, 0.04);
            this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.5, currentTime, 0.04);

            const targetGain = 0.05 + loadRatio * 0.12;
            this.engineGain.gain.setTargetAtTime(targetGain, currentTime, 0.05);
        } catch (e) {}
    }

    triggerTireSkid(intensity = 1.0) {
        if (!this.ctx || !this.skidGain || this.isMuted) return;
        try {
            const gain = Math.min(0.25, intensity * 0.25);
            this.skidGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.02);
        } catch (e) {}
    }

    stopTireSkid() {
        if (!this.ctx || !this.skidGain) return;
        try {
            this.skidGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.05);
        } catch (e) {}
    }

    playGearShift() {
        if (!this.ctx || this.isMuted) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(220, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.06);

            gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);

            osc.connect(gain);
            gain.connect(this.getDestination());

            osc.start();
            osc.stop(this.ctx.currentTime + 0.06);
        } catch (e) {}
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
            gain.connect(this.getDestination());

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
            gain.connect(this.getDestination());

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
            gain.connect(this.getDestination());

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
            gain.connect(this.getDestination());

            osc.start();
            osc.stop(this.ctx.currentTime + 0.08);
        } catch (e) {}
    }

    updateEnginePitch(ratio) {
        const rpm = 1000 + ratio * 6000;
        this.updateEngineRPM(rpm, ratio);
    }

    nextRadioStation() {
        this.currentStationIdx = (this.currentStationIdx + 1) % this.radioStations.length;
        return this.radioStations[this.currentStationIdx];
    }
}

window.audioMgr = new AudioEngine();
