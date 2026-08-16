// Web Audio API Synthesizer for Iranian Highway Racing 3D (سلطان جاده ۳بعدی)
class SoundManager {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.sfxVolume = 1.0;
        this.musicVolume = 0.6;
        this.currentTrack = 0;

        this.engineOsc = null;
        this.engineGain = null;
        
        this.bgmTimer = null;
        this.isMusicPlaying = false;
        this.beatValue = 0;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.startEngineSound();
            this.startMusicJukebox();
        } else if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // Engine Sound Synthesis
    startEngineSound() {
        if (!this.ctx || this.isMuted) return;
        try {
            this.engineOsc = this.ctx.createOscillator();
            this.engineGain = this.ctx.createGain();

            this.engineOsc.type = 'sawtooth';
            this.engineOsc.frequency.setValueAtTime(55, this.ctx.currentTime);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(240, this.ctx.currentTime);

            this.engineGain.gain.setValueAtTime(0.04 * this.sfxVolume, this.ctx.currentTime);

            this.engineOsc.connect(filter);
            filter.connect(this.engineGain);
            this.engineGain.connect(this.ctx.destination);

            this.engineOsc.start();
        } catch (e) {
            console.warn('Engine sound init:', e);
        }
    }

    updateEnginePitch(speedRatio) {
        if (!this.engineOsc || !this.ctx || this.isMuted) return;
        const targetFreq = 50 + Math.min(1.0, speedRatio) * 110;
        this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.08);
        if (this.engineGain) {
            this.engineGain.gain.setValueAtTime(0.04 * this.sfxVolume, this.ctx.currentTime);
        }
    }

    playBackfire() {
        if (!this.ctx || this.isMuted) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const now = this.ctx.currentTime;

            osc.type = 'square';
            osc.frequency.setValueAtTime(140, now);
            osc.frequency.exponentialRampToValueAtTime(30, now + 0.08);

            gain.gain.setValueAtTime(0.12 * this.sfxVolume, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.08);
        } catch (e) {}
    }

    playLaneSwitch() {
        if (!this.ctx || this.isMuted) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const now = this.ctx.currentTime;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(540, now + 0.06);

            gain.gain.setValueAtTime(0.05 * this.sfxVolume, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.06);
        } catch (e) {}
    }

    playNitro() {
        if (!this.ctx || this.isMuted) return;
        try {
            const bufferSize = this.ctx.sampleRate * 0.4;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1200, this.ctx.currentTime);
            filter.Q.setValueAtTime(3, this.ctx.currentTime);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.15 * this.sfxVolume, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            noise.start();
        } catch (e) {}
    }

    playCoin() {
        if (!this.ctx || this.isMuted) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const now = this.ctx.currentTime;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(987.77, now);
            osc.frequency.setValueAtTime(1318.51, now + 0.08);

            gain.gain.setValueAtTime(0.08 * this.sfxVolume, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.2);
        } catch (e) {}
    }

    playPowerup() {
        if (!this.ctx || this.isMuted) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const now = this.ctx.currentTime;

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);

            gain.gain.setValueAtTime(0.1 * this.sfxVolume, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.25);
        } catch (e) {}
    }

    playCrash() {
        if (!this.ctx || this.isMuted) return;
        try {
            const bufferSize = this.ctx.sampleRate * 0.5;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.3 * this.sfxVolume, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);

            noise.connect(gain);
            gain.connect(this.ctx.destination);
            noise.start();
        } catch (e) {}
    }

    playPoliceSiren() {
        if (!this.ctx || this.isMuted) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const now = this.ctx.currentTime;

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.linearRampToValueAtTime(1000, now + 0.2);
            osc.frequency.linearRampToValueAtTime(600, now + 0.4);

            gain.gain.setValueAtTime(0.05 * this.sfxVolume, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.4);
        } catch (e) {}
    }

    // Synthwave Jukebox BGM Generator
    startMusicJukebox() {
        if (!this.ctx || this.isMusicPlaying) return;
        this.isMusicPlaying = true;
        let step = 0;

        const tracks = [
            [110, 110, 146.83, 110, 130.81, 110, 164.81, 130.81], // Midnight Iran Drive
            [98, 98, 123.47, 98, 146.83, 123.47, 110, 98],        // Shooti Overdrive
            [130.81, 164.81, 196, 164.81, 146.83, 174.61, 220, 196] // Persian Speedway
        ];

        this.bgmTimer = setInterval(() => {
            if (this.isMuted || this.musicVolume <= 0 || !this.ctx) return;

            const pattern = tracks[this.currentTrack] || tracks[0];
            const freq = pattern[step % pattern.length];

            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = step % 4 === 0 ? 'sawtooth' : 'triangle';
            osc.frequency.setValueAtTime(freq, now);

            this.beatValue = step % 4 === 0 ? 1.0 : 0.2;

            gain.gain.setValueAtTime(0.06 * this.musicVolume, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.18);
            step++;
        }, 220);
    }

    switchTrack(trackIdx) {
        this.currentTrack = trackIdx;
    }
}

window.audioMgr = new SoundManager();
