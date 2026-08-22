/*
 * ===================================================================
 * RADIN RACER 3D — PROFESSIONAL GRAPHICS QUALITY SYSTEM
 * Dynamic AUTO Performance Governor, Hysteresis & Zero-Garbage Pipeline
 * ===================================================================
 */

class SettingsSystem {
    constructor(game) {
        this.game = game;
        this.STORAGE_KEY_SETTINGS = 'radin_racer_settings_v3';
        this.STORAGE_KEY_GRAPHICS_PROFILE = 'radin_racer_graphics_profile';
        this.activeTab = 'graphics';

        // High Performance Controlled Quality Profiles
        this.PROFILES = {
            LOW: {
                profileName: 'LOW',
                renderScale: 70,           // 70% resolution scale
                shadowQuality: 'OFF',       // Shadows disabled
                shadowDistance: 50,        // 50m shadow distance
                treeQuality: 'LOW',        // Low LOD & 150m view distance
                treeDrawDistance: 150,
                envQuality: 'LOW',         // View distance 180m
                viewDistance: 180,
                textureQuality: 'LOW',
                particleQuality: 'LOW',    // Max 10 particles
                reflections: 'OFF',        // Reflections disabled
                antiAliasing: false,
                postProcessing: 'OFF',
                trafficDensity: 'LOW',     // 4 AI vehicles
                effectsQuality: 'LOW'
            },
            MEDIUM: {
                profileName: 'MEDIUM',
                renderScale: 85,           // 85% resolution scale
                shadowQuality: 'MEDIUM',    // Basic 512x512 shadows
                shadowDistance: 80,        // 80m shadow distance
                treeQuality: 'MEDIUM',     // Medium LOD & 280m view distance
                treeDrawDistance: 280,
                envQuality: 'MEDIUM',      // View distance 300m
                viewDistance: 300,
                textureQuality: 'MEDIUM',
                particleQuality: 'MEDIUM', // Max 25 particles
                reflections: 'LOW',        // Basic environment reflection
                antiAliasing: true,
                postProcessing: 'MEDIUM',
                trafficDensity: 'MEDIUM',  // 8 AI vehicles
                effectsQuality: 'MEDIUM'
            },
            HIGH: {
                profileName: 'HIGH',
                renderScale: 100,          // 100% resolution scale
                shadowQuality: 'HIGH',     // Soft 1024x1024 shadows
                shadowDistance: 150,       // 150m shadow distance
                treeQuality: 'HIGH',       // Full LOD & 450m view distance
                treeDrawDistance: 450,
                envQuality: 'HIGH',        // View distance 500m
                viewDistance: 500,
                textureQuality: 'HIGH',
                particleQuality: 'HIGH',   // Max 40 particles
                reflections: 'HIGH',       // Realtime HD environment map
                antiAliasing: true,
                postProcessing: 'HIGH',
                trafficDensity: 'HIGH',    // 14 AI vehicles
                effectsQuality: 'HIGH'
            }
        };

        // Saved Profile (AUTO, LOW, MEDIUM, HIGH)
        this.selectedProfile = localStorage.getItem(this.STORAGE_KEY_GRAPHICS_PROFILE) || 'AUTO';
        this.effectiveProfileLevel = 'MEDIUM'; // Active profile tier when in AUTO mode

        // Active parameter state object (cloned from active preset)
        this.activeParams = Object.assign({}, this.PROFILES.MEDIUM);

        this.defaultSettings = {
            version: 3,
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
                unitSystem: 'KM/H',
                absEnabled: true
            }
        };

        this.data = this.loadSettings();

        // Performance Telemetry & AUTO Governor State
        this.frameTimes = [];
        this.lastMonitorTime = performance.now();
        this.lastAdaptTime = performance.now();
        this.cooldownMs = 4000; // Minimum 4s between dynamic profile shifts
        this.lowFpsCount = 0;
        this.highFpsCount = 0;
        this.measuredFps = 60;

        this.init();
    }

    init() {
        this.setProfile(this.selectedProfile, false);
        this.applySettingsToEngine();
        this.bindUIEvents();
    }

    loadSettings() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY_SETTINGS);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.version === 3) {
                    return parsed;
                }
            }
        } catch (e) {}
        return JSON.parse(JSON.stringify(this.defaultSettings));
    }

    saveSettings() {
        try {
            localStorage.setItem(this.STORAGE_KEY_SETTINGS, JSON.stringify(this.data));
            localStorage.setItem(this.STORAGE_KEY_GRAPHICS_PROFILE, this.selectedProfile);
        } catch (e) {}
    }

    resetToDefault() {
        this.data = JSON.parse(JSON.stringify(this.defaultSettings));
        this.setProfile('AUTO', true);
        this.saveSettings();
        this.applySettingsToEngine();
        this.updateUI();
    }

    // Set Graphics Profile (AUTO, LOW, MEDIUM, HIGH)
    setProfile(profileName, userInitiated = true) {
        if (!['AUTO', 'LOW', 'MEDIUM', 'HIGH'].includes(profileName)) {
            profileName = 'AUTO';
        }

        this.selectedProfile = profileName;

        if (userInitiated) {
            this.saveSettings();
        }

        if (profileName === 'AUTO') {
            // In AUTO mode, start from current effective profile or MEDIUM
            this.effectiveProfileLevel = this.effectiveProfileLevel || 'MEDIUM';
            this.activeParams = Object.assign({}, this.PROFILES[this.effectiveProfileLevel]);
        } else {
            // Manual profile choice lock
            this.effectiveProfileLevel = profileName;
            this.activeParams = Object.assign({}, this.PROFILES[profileName]);
        }

        this.applySettingsToEngine();
        this.updateUI();
    }

    // Direct Engine Parameter Applicator (Zero Allocation, Instant Parameters Update)
    applySettingsToEngine() {
        if (!this.game) return;

        const p = this.activeParams;
        const renderer = this.game.renderer;
        const camera = this.game.camera;
        const scene = this.game.scene;
        const sunLight = this.game.sunLight;

        // 1. Render Resolution Scale & Pixel Ratio
        if (renderer) {
            const baseDpr = Math.min(window.devicePixelRatio || 1, 2.0);
            const targetDpr = baseDpr * (p.renderScale / 100);
            renderer.setPixelRatio(targetDpr);
        }

        // 2. Shadows Quality & Shadow Distance
        if (renderer && renderer.shadowMap) {
            const shadowEnabled = (p.shadowQuality !== 'OFF');
            renderer.shadowMap.enabled = shadowEnabled;

            if (sunLight) {
                sunLight.castShadow = shadowEnabled;
                if (shadowEnabled) {
                    const mapSize = (p.shadowQuality === 'HIGH') ? 1024 : 512;
                    sunLight.shadow.mapSize.set(mapSize, mapSize);
                    sunLight.shadow.camera.far = p.shadowDistance || 80;
                }
            }
        }

        // 3. Camera View Distance & Environment Fog
        if (camera && scene) {
            camera.far = p.viewDistance || 300;
            camera.updateProjectionMatrix();

            if (scene.fog) {
                scene.fog.far = p.viewDistance * 0.85;
                scene.fog.near = Math.max(10, p.viewDistance * 0.12);
            }
        }

        // 4. Traffic Density
        if (this.game.trafficManager) {
            let maxCars = 8;
            if (p.trafficDensity === 'LOW') maxCars = 4;
            else if (p.trafficDensity === 'MEDIUM') maxCars = 8;
            else if (p.trafficDensity === 'HIGH') maxCars = 14;
            this.game.trafficManager.maxActiveVehicles = maxCars;
        }

        // 5. Environmental Reflections
        if (scene) {
            if (p.reflections === 'OFF') {
                scene.environment = null;
            } else {
                scene.environment = this.game.envMap || null;
            }
        }

        // 6. Active Particle Limit
        if (this.game) {
            let maxParticles = 25;
            if (p.particleQuality === 'LOW') maxParticles = 10;
            else if (p.particleQuality === 'MEDIUM') maxParticles = 25;
            else if (p.particleQuality === 'HIGH') maxParticles = 40;
            this.game.maxActiveParticles = maxParticles;
        }

        // 7. FPS Counter Display
        const fpsBadge = document.getElementById('fps-badge');
        if (fpsBadge) {
            if (this.data.display.fpsCounter) fpsBadge.classList.remove('hidden');
            else fpsBadge.classList.add('hidden');
        }

        // 8. Audio Master Volume
        if (window.audioMgr && window.audioMgr.setMasterVolume) {
            window.audioMgr.setMasterVolume((this.data.audio.masterVolume || 100) / 100);
        }

        this.updateUIValuesOnly();
    }

    // Telemetry Recorder invoked inside loop(dt)
    recordFrame(dt) {
        const frameMs = dt * 1000;
        this.frameTimes.push(frameMs);
        if (this.frameTimes.length > 90) this.frameTimes.shift();

        const now = performance.now();
        if (now - this.lastMonitorTime > 2500) {
            this.evaluatePerformance(now);
            this.lastMonitorTime = now;
        }
    }

    // AUTO Mode Dynamic Performance Governor (Hysteresis & Cooldown Protected)
    evaluatePerformance(now) {
        if (this.frameTimes.length < 20) return;

        const totalMs = this.frameTimes.reduce((a, b) => a + b, 0);
        const avgMs = totalMs / this.frameTimes.length;
        this.measuredFps = Math.round(1000 / (avgMs || 16.6));

        // Update FPS badge UI
        const fpsValEl = document.getElementById('fps-badge-val');
        if (fpsValEl) {
            fpsValEl.innerText = this.measuredFps + ' FPS';
        }

        // Update Status Overlay Live Items
        this.updateStatusOverlayLive();

        // If not in AUTO mode, exit governor
        if (this.selectedProfile !== 'AUTO') return;

        // Check cooldown
        if (now - this.lastAdaptTime < this.cooldownMs) return;

        // Rule A: FPS < 25 for several seconds -> Step DOWN 1 quality tier or decrease bottleneck parameter
        if (this.measuredFps < 25) {
            this.lowFpsCount++;
            this.highFpsCount = 0;

            if (this.lowFpsCount >= 2) {
                this.stepDownAutoQuality(now);
                this.lowFpsCount = 0;
            }
        }
        // Rule B: FPS 25 to 50 -> Hold current quality (Hysteresis - prevent oscillation)
        else if (this.measuredFps >= 25 && this.measuredFps <= 50) {
            this.lowFpsCount = 0;
            this.highFpsCount = 0;
        }
        // Rule C: FPS > 50 for several seconds -> Step UP 1 quality tier
        else if (this.measuredFps > 50) {
            this.highFpsCount++;
            this.lowFpsCount = 0;

            if (this.highFpsCount >= 4) {
                this.stepUpAutoQuality(now);
                this.highFpsCount = 0;
            }
        }
    }

    // Step DOWN Quality (Ordered Reduction: RenderScale -> Shadows -> Trees -> View Distance -> Traffic)
    stepDownAutoQuality(now) {
        const p = this.activeParams;

        if (p.renderScale > 85) {
            p.renderScale = 85;
        } else if (p.shadowQuality === 'HIGH') {
            p.shadowQuality = 'MEDIUM';
            p.shadowDistance = 80;
        } else if (p.treeQuality === 'HIGH') {
            p.treeQuality = 'MEDIUM';
            p.treeDrawDistance = 280;
        } else if (p.viewDistance > 300) {
            p.envQuality = 'MEDIUM';
            p.viewDistance = 300;
        } else if (p.renderScale > 70) {
            p.renderScale = 70;
        } else if (p.shadowQuality === 'MEDIUM') {
            p.shadowQuality = 'OFF';
            p.shadowDistance = 40;
        } else if (p.treeQuality === 'MEDIUM') {
            p.treeQuality = 'LOW';
            p.treeDrawDistance = 150;
        } else if (p.viewDistance > 180) {
            p.envQuality = 'LOW';
            p.viewDistance = 180;
        } else if (p.trafficDensity === 'HIGH' || p.trafficDensity === 'MEDIUM') {
            p.trafficDensity = 'LOW';
        }

        // Update effective tier label
        if (p.renderScale <= 70 && p.shadowQuality === 'OFF') {
            this.effectiveProfileLevel = 'LOW';
        } else {
            this.effectiveProfileLevel = 'MEDIUM';
        }

        this.lastAdaptTime = now;
        this.applySettingsToEngine();
    }

    // Step UP Quality
    stepUpAutoQuality(now) {
        const p = this.activeParams;

        if (p.renderScale < 85) {
            p.renderScale = 85;
            p.viewDistance = 300;
        } else if (p.shadowQuality === 'OFF') {
            p.shadowQuality = 'MEDIUM';
            p.shadowDistance = 80;
        } else if (p.treeQuality === 'LOW') {
            p.treeQuality = 'MEDIUM';
            p.treeDrawDistance = 280;
        } else if (p.renderScale < 100) {
            p.renderScale = 100;
        } else if (p.shadowQuality === 'MEDIUM') {
            p.shadowQuality = 'HIGH';
            p.shadowDistance = 150;
        } else if (p.treeQuality === 'MEDIUM') {
            p.treeQuality = 'HIGH';
            p.treeDrawDistance = 450;
        } else if (p.viewDistance < 500) {
            p.envQuality = 'HIGH';
            p.viewDistance = 500;
        }

        if (p.renderScale >= 100 && p.shadowQuality === 'HIGH') {
            this.effectiveProfileLevel = 'HIGH';
        } else {
            this.effectiveProfileLevel = 'MEDIUM';
        }

        this.lastAdaptTime = now;
        this.applySettingsToEngine();
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

        // Graphics Quality Profile Buttons [ AUTO ] [ LOW ] [ MEDIUM ] [ HIGH ]
        const gfxBtns = modal.querySelectorAll('.gfx-btn');
        gfxBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const profile = e.currentTarget.getAttribute('data-gfx-profile');
                if (profile) {
                    this.setProfile(profile, true);
                }
            });
        });

        // Dropdown Select Binding
        const bindSelect = (id, fn) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', (e) => {
                fn(e);
                this.saveSettings();
                this.applySettingsToEngine();
            });
        };

        bindSelect('set-input-preset', (e) => this.setProfile(e.target.value, true));
        bindSelect('set-input-traffic-density', (e) => {
            this.activeParams.trafficDensity = e.target.value;
        });
        bindSelect('set-input-fps-badge', (e) => {
            this.data.display.fpsCounter = (e.target.value === 'true');
        });
        bindSelect('set-input-unit-system', (e) => {
            this.data.gameplay.unitSystem = e.target.value;
        });
    }

    updateUI() {
        // Highlight active profile button
        const modal = document.getElementById('settings-screen');
        if (modal) {
            const gfxBtns = modal.querySelectorAll('.gfx-btn');
            gfxBtns.forEach(btn => {
                if (btn.getAttribute('data-gfx-profile') === this.selectedProfile) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });

            const selPreset = document.getElementById('set-input-preset');
            if (selPreset) selPreset.value = this.selectedProfile;

            const selTraffic = document.getElementById('set-input-traffic-density');
            if (selTraffic) selTraffic.value = this.activeParams.trafficDensity;
        }

        this.updateStatusOverlayLive();
    }

    updateUIValuesOnly() {
        this.updateUI();
    }

    // Live Status Monitor Card Updater
    updateStatusOverlayLive() {
        const p = this.activeParams;

        // Profile Text
        const profileEl = document.getElementById('gfx-stat-profile');
        if (profileEl) {
            if (this.selectedProfile === 'AUTO') {
                profileEl.innerText = `AUTO (${this.effectiveProfileLevel} Active)`;
            } else {
                profileEl.innerText = `${this.selectedProfile} (Locked)`;
            }
        }

        // FPS
        const fpsEl = document.getElementById('gfx-stat-fps');
        if (fpsEl) fpsEl.innerText = `${this.measuredFps} FPS`;

        // Render Scale
        const scaleEl = document.getElementById('gfx-stat-scale');
        if (scaleEl) scaleEl.innerText = `${p.renderScale}%`;

        // Shadows
        const shadowEl = document.getElementById('gfx-stat-shadows');
        if (shadowEl) shadowEl.innerText = p.shadowQuality;

        // Trees
        const treeEl = document.getElementById('gfx-stat-trees');
        if (treeEl) treeEl.innerText = p.treeQuality;

        // Distance
        const distEl = document.getElementById('gfx-stat-distance');
        if (distEl) distEl.innerText = `${p.viewDistance}m`;

        // Traffic
        const trafficEl = document.getElementById('gfx-stat-traffic');
        if (trafficEl) trafficEl.innerText = p.trafficDensity;
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
