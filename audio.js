// Web Audio API Synthesizer for 3-Lane Neon Game v2.0
class SoundManager {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.sfxVolume = 1.0;
        this.musicVolume = 0.6;
        this.currentTrack = 0;

        this.engineOsc = null;
        this.engineGain = null;
        
        // Jukebox Music BGM variables
        this.bgmTimer = null;
        this.isMusicPlaying = false;
        this.beatValue = 0; // Audio-reactive pulse value (0.0 to 1.0)
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

    // Engine Sound
    startEngineSound() {
        if (!this.ctx || this.isMuted) return;
        try {
            this.engineOsc = this.ctx.createOscillator();
            this.engineGain = this.ctx.createGain();

            this.engineOsc.type = 'sawtooth';
            this.engineOsc.frequency.setValueAtTime(55, this.ctx.currentTime);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(220, this.ctx.currentTime);

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
        const targetFreq = 50 + speedRatio * 90;
        this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
        if (this.engineGain) {
            this.engineGain.gain.setValueAtTime(0.04 * this.sfxVolume, this.ctx.currentTime);
        }
    }

    // Synthwave Jukebox BGM Generator
    startMusicJukebox() {
        if (!this.ctx || this.isMusicPlaying) return;
        this.isMusicPlaying = true;
        let step = 0;

        // 3 Synthwave Bassline patterns
        const tracks = [
            [110, 110, 146.83, 110, 130.81, 110, 164.81, 130.81], // Cyber Neon Drive
            [98, 98, 123.47, 98, 146.83, 123.47, 110, 98],        // Midnight Cruise
            [130.81, 164.81, 196, 164.81, 146.83, 174.61, 220, 196] // Retro Overdrive
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

            // Beat pulse for road line reactive glow
            this.beatValue = step % 4 === 0 ? 1.0 : 0.2;

            gain.gain.setValueAtTime(0.06 * this.musicVolume, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.18);

            step++;
        }, 180); // ~133 BPM
    }

    stopMusicJukebox() {
        if (this.bgmTimer) clearInterval(this.bgmTimer);
        this.isMusicPlaying = false;
    }

    switchTrack(trackIndex) {
        this.currentTrack = trackIndex % 3;
    }

    // Sound FX
    playLaneSwitch() {
        if (!this.ctx || this.isMuted) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(250, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.08);

        gain.gain.setValueAtTime(0.12 * this.sfxVolume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }

    playCoin() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(987.77, now);
        osc.frequency.setValueAtTime(1318.51, now + 0.06);

        gain.gain.setValueAtTime(0.15 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.2);
    }

    playPowerup() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.25);

        gain.gain.setValueAtTime(0.2 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.3);
    }

    playNitro() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.25);

        gain.gain.setValueAtTime(0.25 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.4);
    }

    playNearMiss() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.05);

        gain.gain.setValueAtTime(0.1 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.15);
    }

    playPoliceSiren() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(700, now);
        osc.frequency.linearRampToValueAtTime(1200, now + 0.2);
        osc.frequency.linearRampToValueAtTime(700, now + 0.4);

        gain.gain.setValueAtTime(0.1 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.4);
    }

    playCrash() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;

        const bufferSize = this.ctx.sampleRate * 0.4;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(800, now);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4 * this.sfxVolume, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);

        noise.start(now);
        noise.stop(now + 0.4);
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.engineGain) {
            this.engineGain.gain.value = this.isMuted ? 0 : 0.04 * this.sfxVolume;
        }
        return this.isMuted;
    }
}

const audioMgr = new SoundManager();
