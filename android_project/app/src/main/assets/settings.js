/*
 * ===================================================================
 * RADIN RACER 3D — PRO SETTINGS SYSTEM & ADAPTIVE AUTO GRAPHICS ENGINE
 * Event-Driven, Performance-First, Stutter-Resistant Architecture
 * ===================================================================
 */

class SettingsSystem {
    constructor(game) {
        this.game = game;
        this.STORAGE_KEY = 'radin_racer_settings_v2';
        this.activeTab = 'graphics';

        this.defaultSettings = {
            version: 2,
            graphics: {
                preset: 'AUTO', // AUTO, VERY_LOW, LOW, MEDIUM, HIGH, ULTRA
                autoGraphics: true,
                targetFps: 60, // 30, 45, 60, 90, 120
                resolutionScale: 100, // 50 to 100%
                shadowQuality: 'MEDIUM', // OFF, LOW, MEDIUM, HIGH
                reflections: 'MEDIUM', // OFF, LOW, HIGH
                antiAliasing: true,
                trafficDensity: 'MEDIUM' // LOW, MEDIUM, HIGH
            },
            display: {
                fullscreen: false,
                fpsCounter: true,
                uiScale: 100
            },
            audio: {
                masterVolume: 100,
                engineVolume: 100,
                sfxVolume: 100,
                radioVolume: 100
            },
            controls: {
                sensitivity: 1.0,
                steeringAssist: true,
                touchControls: true
            },
            gameplay: {
                cameraShake: true,
                unitSystem: 'KM/H', // KM/H, MPH
                absEnabled: true
            },
            performance: {
                performanceMode: false,
                qualityMode: false,
                dynamicResolution: true
            }
        };

        this.data = this.loadSettings();

        // Performance Monitor Telemetry
        this.frameTimes = [];
        this.lastMonitorTime = performance.now();
        this.stableCycles = 0;
        this.lowFpsCycles = 0;
        this.measuredFps = 60;
        this.frameStutterMs = 0;

        this.qualityLevels = {
            'VERY_LOW': { shadowQuality: 'OFF', reflections: 'OFF', resolutionScale: 75, antiAliasing: false, trafficDensity: 'LOW' },
            'LOW':      { shadowQuality: 'LOW', reflections: 'OFF', resolutionScale: 85, antiAliasing: false, trafficDensity: 'LOW' },
            'MEDIUM':   { shadowQuality: 'MEDIUM', reflections: 'LOW', resolutionScale: 95, antiAliasing: true,  trafficDensity: 'MEDIUM' },
            'HIGH':     { shadowQuality: 'MEDIUM', reflections: 'HIGH', resolutionScale: 100, antiAliasing: true, trafficDensity: 'MEDIUM' },
            'ULTRA':    { shadowQuality: 'HIGH', reflections: 'HIGH', resolutionScale: 100, antiAliasing: true,  trafficDensity: 'HIGH' }
        };

        this.init();
    }

    init() {
        this.detectHardwareCapabilities();
        this.applySettingsToEngine();
    }

    loadSettings() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.version === 2) {
                    return parsed;
                }
            }
        } catch (e) {}
        return JSON.parse(JSON.stringify(this.defaultSettings));
    }

    saveSettings() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {}
    }

    resetToDefault() {
        this.data = JSON.parse(JSON.stringify(this.defaultSettings));
        this.saveSettings();
        this.applySettingsToEngine();
        this.updateUI();
    }

    // Hardware Detection & Initial Benchmark
    detectHardwareCapabilities() {
        const cores = navigator.hardwareConcurrency || 4;
        const memory = navigator.deviceMemory || 4;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (this.data.graphics.preset === 'AUTO') {
            if (isMobile || cores <= 4 || memory < 4) {
                this.applyPresetValues('MEDIUM');
            } else {
                this.applyPresetValues('HIGH');
            }
        }
    }

    applyPresetValues(presetName) {
        const p = this.qualityLevels[presetName];
        if (p) {
            Object.assign(this.data.graphics, p);
        }
    }

    setPreset(presetName) {
        this.data.graphics.preset = presetName;
        if (presetName !== 'AUTO') {
            this.data.graphics.autoGraphics = false;
            this.applyPresetValues(presetName);
        } else {
            this.data.graphics.autoGraphics = true;
            this.detectHardwareCapabilities();
        }
        this.saveSettings();
        this.applySettingsToEngine();
        this.updateUI();
    }

    // Apply Settings Directly to Three.js Renderer & Game Logic (Zero Garbage)
    applySettingsToEngine() {
        if (!this.game) return;

        const g = this.data.graphics;
        const disp = this.data.display;
        const perf = this.data.performance;

        // 1. Resolution Scale & Pixel Ratio
        let scale = (g.resolutionScale || 100) / 100;
        if (perf.performanceMode) scale = Math.min(scale, 0.85);

        const dpr = Math.min(window.devicePixelRatio || 1, 2.0) * scale;
        if (this.game.renderer) {
            this.game.renderer.setPixelRatio(dpr);
        }

        // 2. Shadows Quality
        if (this.game.renderer && this.game.renderer.shadowMap) {
            const shadowState = (g.shadowQuality !== 'OFF') && !perf.performanceMode;
            this.game.renderer.shadowMap.enabled = shadowState;
            if (this.game.dirLight) {
                this.game.dirLight.castShadow = shadowState;
                if (g.shadowQuality === 'HIGH') {
                    this.game.dirLight.shadow.mapSize.width = 1024;
                    this.game.dirLight.shadow.mapSize.height = 1024;
                } else {
                    this.game.dirLight.shadow.mapSize.width = 512;
                    this.game.dirLight.shadow.mapSize.height = 512;
                }
            }
        }

        // 3. Audio Volume Sync
        const a = this.data.audio;
        if (window.audioMgr) {
            if (window.audioMgr.setMasterVolume) {
                window.audioMgr.setMasterVolume(a.masterVolume / 100);
            }
        }

        // 4. FPS Counter Badge Display
        const fpsBadge = document.getElementById('fps-badge');
        if (fpsBadge) {
            if (disp.fpsCounter) fpsBadge.classList.remove('hidden');
            else fpsBadge.classList.add('hidden');
        }
    }

    // Record Frame Telemetry inside loop(dt)
    recordFrame(dt) {
        const frameMs = dt * 1000;
        this.frameTimes.push(frameMs);
        if (this.frameTimes.length > 120) this.frameTimes.shift();

        // Check Adaptive Auto Graphics every 3000ms
        const now = performance.now();
        if (now - this.lastMonitorTime > 3000) {
            this.evaluatePerformance(now);
            this.lastMonitorTime = now;
        }
    }

    // Adaptive Performance Evaluation Logic (Rules 26-34)
    evaluatePerformance(now) {
        if (this.frameTimes.length < 30) return;

        const totalMs = this.frameTimes.reduce((a, b) => a + b, 0);
        const avgMs = totalMs / this.frameTimes.length;
        this.measuredFps = Math.round(1000 / (avgMs || 16.6));

        // Update FPS badge text
        const fpsValEl = document.getElementById('fps-badge-val');
        if (fpsValEl) {
            fpsValEl.innerText = this.measuredFps + ' FPS';
        }

        if (!this.data.graphics.autoGraphics) return;

        const targetFps = this.data.graphics.targetFps || 60;

        // If FPS is significantly below target (< 80% target FPS)
        if (this.measuredFps < targetFps * 0.8) {
            this.lowFpsCycles++;
            this.stableCycles = 0;

            if (this.lowFpsCycles >= 2) {
                this.stepDownGraphicsQuality();
                this.lowFpsCycles = 0;
            }
        } else if (this.measuredFps >= targetFps - 3) {
            this.stableCycles++;
            this.lowFpsCycles = 0;

            if (this.stableCycles >= 4) {
                this.stepUpGraphicsQuality();
                this.stableCycles = 0;
            }
        }
    }

    // Smart Tiered Reduction (Rule #33: Shadows -> Reflections -> Resolution Scale)
    stepDownGraphicsQuality() {
        const g = this.data.graphics;

        if (g.shadowQuality === 'HIGH') {
            g.shadowQuality = 'MEDIUM';
        } else if (g.reflections === 'HIGH') {
            g.reflections = 'LOW';
        } else if (g.shadowQuality === 'MEDIUM') {
            g.shadowQuality = 'LOW';
        } else if (g.resolutionScale > 75) {
            g.resolutionScale = Math.max(75, g.resolutionScale - 10);
        } else if (g.shadowQuality === 'LOW') {
            g.shadowQuality = 'OFF';
        }

        this.applySettingsToEngine();
        this.updateUIValuesOnly();
    }

    // Gradual Quality Restoration
    stepUpGraphicsQuality() {
        const g = this.data.graphics;

        if (g.resolutionScale < 100) {
            g.resolutionScale = Math.min(100, g.resolutionScale + 10);
        } else if (g.shadowQuality === 'OFF') {
            g.shadowQuality = 'LOW';
        } else if (g.shadowQuality === 'LOW') {
            g.shadowQuality = 'MEDIUM';
        }

        this.applySettingsToEngine();
        this.updateUIValuesOnly();
    }

    bindUIEvents() {
        const modal = document.getElementById('settings-screen');
        if (!modal) return;

        // Tabs
        const tabBtns = modal.querySelectorAll('.settings-tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetTab = e.currentTarget.getAttribute('data-tab');
                if (targetTab) {
                    this.activeTab = targetTab;
                    tabBtns.forEach(b => b.classList.remove('active'));
                    e.currentTarget.classList.add('active');

                    const contents = modal.querySelectorAll('.settings-tab-content');
                    contents.forEach(c => c.classList.add('hidden'));

                    const activeContent = document.getElementById(`set-tab-${targetTab}`);
                    if (activeContent) activeContent.classList.remove('hidden');
                }
            });
        });

        // Close Button
        const btnClose = document.getElementById('btn-settings-close');
        if (btnClose) {
            btnClose.addEventListener('click', () => this.closeSettings());
        }

        // Reset Button
        const btnReset = document.getElementById('btn-settings-reset');
        if (btnReset) {
            btnReset.addEventListener('click', () => this.resetToDefault());
        }

        // Preset Buttons
        const presetBtns = modal.querySelectorAll('.set-preset-btn');
        presetBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const p = e.currentTarget.getAttribute('data-preset');
                if (p) this.setPreset(p);
            });
        });

        // Mode Toggles (Performance 🚀 vs Quality 🎨)
        const btnPerfMode = document.getElementById('btn-mode-performance');
        if (btnPerfMode) {
            btnPerfMode.addEventListener('click', () => {
                this.data.performance.performanceMode = !this.data.performance.performanceMode;
                if (this.data.performance.performanceMode) this.data.performance.qualityMode = false;
                this.saveSettings();
                this.applySettingsToEngine();
                this.updateUIValuesOnly();
            });
        }

        const bindInput = (id, fn) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', (e) => {
                fn(e);
                this.saveSettings();
                this.applySettingsToEngine();
                this.updateUIValuesOnly();
            });
        };

        const bindSelect = (id, fn) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', (e) => {
                fn(e);
                this.saveSettings();
                this.applySettingsToEngine();
                this.updateUIValuesOnly();
            });
        };

        bindSelect('set-input-preset', (e) => this.setPreset(e.target.value));
        bindSelect('set-input-target-fps', (e) => { this.data.graphics.targetFps = parseInt(e.target.value); });
        bindInput('set-input-res-scale', (e) => { this.data.graphics.resolutionScale = parseInt(e.target.value); });
        bindSelect('set-input-shadows', (e) => { this.data.graphics.shadowQuality = e.target.value; });
        bindSelect('set-input-reflections', (e) => { this.data.graphics.reflections = e.target.value; });
        bindInput('set-input-master-vol', (e) => { this.data.audio.masterVolume = parseInt(e.target.value); });
        bindSelect('set-input-fps-badge', (e) => { this.data.display.fpsCounter = (e.target.value === 'true'); });
        bindSelect('set-input-unit-system', (e) => { this.data.gameplay.unitSystem = e.target.value; });
    }

    updateUI() {
        this.updateUIValuesOnly();
    }

    updateUIValuesOnly() {
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };
        const setTxt = (id, txt) => {
            const el = document.getElementById(id);
            if (el) el.innerText = txt;
        };

        const g = this.data.graphics;
        setVal('set-input-preset', g.preset);
        setVal('set-input-target-fps', g.targetFps);
        setVal('set-input-res-scale', g.resolutionScale);
        setTxt('set-res-scale-val', g.resolutionScale + '%');
        setVal('set-input-shadows', g.shadowQuality);
        setVal('set-input-reflections', g.reflections);
        setVal('set-input-master-vol', this.data.audio.masterVolume);
        setVal('set-input-fps-badge', this.data.display.fpsCounter ? 'true' : 'false');
        setVal('set-input-unit-system', this.data.gameplay.unitSystem);

        const btnPerf = document.getElementById('btn-mode-performance');
        if (btnPerf) {
            if (this.data.performance.performanceMode) btnPerf.classList.add('active');
            else btnPerf.classList.remove('active');
        }
    }

    openSettings() {
        const modal = document.getElementById('settings-screen');
        if (modal) {
            modal.classList.remove('hidden');
            this.updateUI();
        }
    }

    closeSettings() {
        const modal = document.getElementById('settings-screen');
        if (modal) {
            modal.classList.add('hidden');
        }
        if (this.game) {
            try { window.focus(); } catch (e) {}
        }
    }
}
