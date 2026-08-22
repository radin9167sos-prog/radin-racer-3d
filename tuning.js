/*
 * ===================================================================
 * RADIN RACER 3D — HIGH PERFORMANCE PRO TUNING SYSTEM & DYNO
 * Modular, Event-Driven, Zero-Garbage Performance Architecture
 * ===================================================================
 */

class TuningSystem {
    constructor(game) {
        this.game = game;
        this.STORAGE_KEY = 'radin_racer_tuning_v2';
        this.activeTab = 'engine';

        // Default Stock Specification (Peugeot Pars ELX Base)
        this.defaultData = {
            version: 2,
            engine: {
                stage: 1, // 1 to 5
                airIntake: 1,
                turbo: 0, // 0: None, 1: Single, 2: Twin Turbo
                supercharger: 0,
                intercooler: 1,
                fuelSystem: 1
            },
            transmission: {
                gearsCount: 5,
                finalDrive: 4.10,
                ratios: [3.45, 2.12, 1.48, 1.12, 0.91, 0.75]
            },
            suspension: {
                stance: 'SHOOTI', // SHOOTI, LOW, NORMAL, TRACK
                height: 0, // Slider -5 to +5
                stiffness: 1.0, // 0.5 to 2.0
                damping: 1.0
            },
            brakes: {
                power: 1.0, // 1.0 to 2.5
                biasFront: 60, // 40% to 80%
                absEnabled: true
            },
            tires: {
                type: 'Street', // Street, Sport, SemiSlick, Racing
                pressure: 32, // 24 to 40 psi
                width: 195 // 185 to 245 mm
            },
            aero: {
                frontDownforce: 1.0,
                rearDownforce: 1.0,
                spoilerType: 1
            },
            weight: {
                stage: 0 // 0: Stock (1180kg), 1: 1080kg, 2: 980kg, 3: 880kg
            },
            drivetrain: {
                type: 'FWD' // FWD, RWD, AWD
            },
            nitro: {
                level: 1 // 1 to 5
            },
            ecu: {
                remapStage: 'STAGE_1', // STAGE_1, STAGE_2, STAGE_3, SHOOTI_MAX
                revLimitOffset: 0,     // 0 to +1700 RPM (Cutoff 6800 to 8500 RPM)
                throttleResponse: 1.0, // 1.0 to 2.5
                popAndBang: 'OFF'      // OFF, POPS, FLAMES
            },
            exhaust: {
                type: 'Stock' // Stock, Sport, Racing
            },
            visual: {
                carColor: '#ffffff',
                rimColor: '#d8d8d8',
                windowTint: '#060814',
                underglowColor: '#00f0ff',
                licensePlate: 'ایران ۶۶'
            }
        };

        // Load saved tuning or fallback to default
        this.data = this.loadSettings();

        // Cached Performance Physics Multipliers (Calculated ONCE when tuning changes)
        this.physicsStats = {
            hp: 110,
            torque: 155,
            weightKg: 1180,
            topSpeedKmh: 215,
            accelRate: 2.4,
            gripFactor: 1.0,
            brakePower: 1.0,
            rpmLimit: 6800,
            downforceTotal: 1.0,
            dragCoeff: 0.32
        };

        this.presets = {
            'STOCK': JSON.parse(JSON.stringify(this.defaultData)),
            'STREET': {
                ...this.defaultData,
                engine: { stage: 2, airIntake: 2, turbo: 1, supercharger: 0, intercooler: 2, fuelSystem: 2 },
                weight: { stage: 1 },
                tires: { type: 'Sport', pressure: 30, width: 205 },
                suspension: { stance: 'LOW', height: -2, stiffness: 1.3, damping: 1.2 }
            },
            'SPORT': {
                ...this.defaultData,
                engine: { stage: 3, airIntake: 3, turbo: 1, supercharger: 0, intercooler: 3, fuelSystem: 3 },
                weight: { stage: 2 },
                tires: { type: 'SemiSlick', pressure: 28, width: 225 },
                suspension: { stance: 'TRACK', height: -3, stiffness: 1.6, damping: 1.5 },
                drivetrain: { type: 'AWD' }
            },
            'TRACK': {
                ...this.defaultData,
                engine: { stage: 4, airIntake: 4, turbo: 2, supercharger: 0, intercooler: 4, fuelSystem: 4 },
                weight: { stage: 3 },
                tires: { type: 'Racing', pressure: 26, width: 235 },
                suspension: { stance: 'TRACK', height: -4, stiffness: 1.9, damping: 1.8 },
                aero: { frontDownforce: 2.2, rearDownforce: 2.5, spoilerType: 2 },
                drivetrain: { type: 'AWD' }
            },
            'DRIFT': {
                ...this.defaultData,
                engine: { stage: 4, airIntake: 4, turbo: 2, supercharger: 0, intercooler: 3, fuelSystem: 4 },
                weight: { stage: 2 },
                tires: { type: 'Sport', pressure: 36, width: 215 },
                suspension: { stance: 'LOW', height: -3, stiffness: 1.8, damping: 1.2 },
                drivetrain: { type: 'RWD' }
            },
            'DRAG': {
                ...this.defaultData,
                engine: { stage: 5, airIntake: 5, turbo: 2, supercharger: 1, intercooler: 5, fuelSystem: 5 },
                nitro: { level: 5 },
                weight: { stage: 3 },
                tires: { type: 'Racing', pressure: 22, width: 245 },
                drivetrain: { type: 'AWD' }
            },
            'MAX PERFORMANCE': {
                ...this.defaultData,
                engine: { stage: 5, airIntake: 5, turbo: 2, supercharger: 1, intercooler: 5, fuelSystem: 5 },
                nitro: { level: 5 },
                weight: { stage: 3 },
                tires: { type: 'Racing', pressure: 26, width: 245 },
                suspension: { stance: 'TRACK', height: -4, stiffness: 2.0, damping: 2.0 },
                aero: { frontDownforce: 2.5, rearDownforce: 2.5, spoilerType: 2 },
                drivetrain: { type: 'AWD' },
                ecu: { throttleResponse: 2.0, revLimitOffset: 1200 }
            }
        };

        this.init();
    }

    init() {
        this.recalculatePhysics();
        this.bindUIEvents();
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
        return JSON.parse(JSON.stringify(this.defaultData));
    }

    saveSettings() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {}
    }

    resetToStock() {
        this.data = JSON.parse(JSON.stringify(this.defaultData));
        this.saveSettings();
        this.recalculatePhysics();
        this.updateUI();
        this.applyVisualsToCar();
    }

    applyPreset(name) {
        if (this.presets[name]) {
            this.data = JSON.parse(JSON.stringify(this.presets[name]));
            this.saveSettings();
            this.recalculatePhysics();
            this.updateUI();
            this.applyVisualsToCar();
        }
    }

    // Event-Driven Physics Parameter Recalculation (Only called when tuning changes!)
    recalculatePhysics() {
        const e = this.data.engine;
        const w = this.data.weight;
        const t = this.data.tires;
        const a = this.data.aero;
        const b = this.data.brakes;
        const ecu = this.data.ecu || {};

        // ECU Remap HP & Torque Multipliers
        const remapHpMap = { 'STAGE_1': 15, 'STAGE_2': 35, 'STAGE_3': 60, 'SHOOTI_MAX': 95 };
        const remapTorqueMap = { 'STAGE_1': 20, 'STAGE_2': 45, 'STAGE_3': 75, 'SHOOTI_MAX': 120 };
        const remapHp = remapHpMap[ecu.remapStage] || 15;
        const remapTorque = remapTorqueMap[ecu.remapStage] || 20;

        // Base HP Calculation
        let hp = 110 + (e.stage - 1) * 65 + remapHp; // Stage 1: 110, Stage 5: 370 HP + Remap Boost
        if (e.turbo === 1) hp += 35;
        if (e.turbo === 2) hp += 70;
        if (e.supercharger === 1) hp += 45;
        hp += (e.airIntake - 1) * 8;
        hp += (e.fuelSystem - 1) * 10;
        this.physicsStats.hp = Math.round(hp);

        // Torque Calculation (Nm)
        let torque = 155 + (e.stage - 1) * 80 + (e.turbo * 40) + remapTorque;
        this.physicsStats.torque = Math.round(torque);

        // Weight Reduction
        const weightMap = [1180, 1080, 980, 880];
        this.physicsStats.weightKg = weightMap[w.stage] || 1180;

        // RPM Limit Cutoff (6800 to 8500 RPM)
        this.physicsStats.rpmLimit = 6800 + (parseInt(ecu.revLimitOffset) || 0);
        this.physicsStats.popAndBang = ecu.popAndBang || 'OFF';

        // Acceleration Rate (power-to-weight ratio multiplier)
        const powerToWeight = this.physicsStats.hp / this.physicsStats.weightKg;
        this.physicsStats.accelRate = 1.8 + (powerToWeight * 12.0) * (parseFloat(ecu.throttleResponse) || 1.0);

        // Top Speed Kmh
        const gearRatioMultiplier = (4.10 / (this.data.transmission.finalDrive || 4.10));
        this.physicsStats.topSpeedKmh = Math.round((195 + (hp * 0.35)) * gearRatioMultiplier);

        // Tire Grip Factor
        const tireGripMap = { 'Street': 1.0, 'Sport': 1.35, 'SemiSlick': 1.70, 'Racing': 2.10 };
        const baseGrip = tireGripMap[t.type] || 1.0;
        const pressureOpt = 1.0 - Math.abs(t.pressure - 30) * 0.015;
        this.physicsStats.gripFactor = baseGrip * Math.max(0.8, pressureOpt);

        // Brake Power Factor
        this.physicsStats.brakePower = b.power * (1.0 + (1180 - this.physicsStats.weightKg) / 1000);

        // Downforce
        this.physicsStats.downforceTotal = (a.frontDownforce + a.rearDownforce) / 2.0;

        // Sync with active Game3D physics instance
        if (this.game) {
            this.game.baseSpeed = 12.0 + (this.physicsStats.hp / 80.0);
            this.game.maxSpeed = (this.physicsStats.topSpeedKmh / 9.5);
        }
    }

    // Event-driven Visual Mesh & Material Applicator (Reuses existing materials, zero garbage!)
    applyVisualsToCar() {
        if (!this.game || !this.game.playerCarGroup) return;

        const vis = this.data.visual;

        // 1. Update Body Paint Material Color
        this.game.playerCarGroup.traverse((child) => {
            if (child.isMesh && child.material) {
                // If main body material (Metallic White / Tuned Paint)
                if (child.material.metalness > 0.6 && child.material.roughness < 0.25 && child.material.envMap) {
                    if (vis.carColor) child.material.color.setStyle(vis.carColor);
                }
            }
        });

        // 2. Update Underglow PointLight
        if (this.game.underglowLight && vis.underglowColor) {
            this.game.underglowLight.color.setStyle(vis.underglowColor);
        }

        // 3. Update Stance & Suspension Height in 3D
        const s = this.data.suspension;
        let heightOffset = (s.height || 0) * 0.03;

        if (s.stance === 'SHOOTI') {
            this.game.playerCarGroup.rotation.x = -0.06;
            this.game.playerCarGroup.position.y = 0.22 + heightOffset;
        } else if (s.stance === 'LOW') {
            this.game.playerCarGroup.position.y = -0.12 + heightOffset;
            this.game.playerCarGroup.rotation.x = 0;
        } else if (s.stance === 'TRACK') {
            this.game.playerCarGroup.position.y = -0.18 + heightOffset;
            this.game.playerCarGroup.rotation.x = 0.01;
        } else { // NORMAL
            this.game.playerCarGroup.position.y = 0.0 + heightOffset;
            this.game.playerCarGroup.rotation.x = 0;
        }
    }

    // Render Performance Dyno Curve on 2D Canvas (Only called when Tuning UI changes!)
    renderDynoCanvas(canvas) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);

        // Background & Grid Lines
        ctx.fillStyle = 'rgba(8, 12, 24, 0.95)';
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
        ctx.lineWidth = 1;

        for (let x = 40; x < w; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, 0); ctx.lineTo(x, h - 25);
            ctx.stroke();
        }
        for (let y = 20; y < h - 25; y += 30) {
            ctx.beginPath();
            ctx.moveTo(40, y); ctx.lineTo(w, y);
            ctx.stroke();
        }

        const maxHp = Math.max(500, this.physicsStats.hp + 50);
        const maxRpm = this.physicsStats.rpmLimit || 7000;

        // Render HP Curve (Cyan Line)
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 3;
        ctx.beginPath();

        for (let rpm = 1000; rpm <= maxRpm; rpm += 200) {
            const normRpm = (rpm - 1000) / (maxRpm - 1000);
            const hpCurve = Math.sin(normRpm * Math.PI * 0.85) * this.physicsStats.hp;
            const px = 40 + normRpm * (w - 50);
            const py = (h - 30) - (hpCurve / maxHp) * (h - 45);

            if (rpm === 1000) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Render Torque Curve (Gold Line)
        ctx.strokeStyle = '#ffea00';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();

        const maxTorque = Math.max(600, this.physicsStats.torque + 50);
        for (let rpm = 1000; rpm <= maxRpm; rpm += 200) {
            const normRpm = (rpm - 1000) / (maxRpm - 1000);
            const torqueCurve = Math.sin((normRpm + 0.15) * Math.PI * 0.7) * this.physicsStats.torque;
            const px = 40 + normRpm * (w - 50);
            const py = (h - 30) - (torqueCurve / maxTorque) * (h - 45);

            if (rpm === 1000) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Legend
        ctx.font = '12px Segoe UI, Tahoma';
        ctx.fillStyle = '#00f0ff';
        ctx.fillText(`⚡ اسب بخار: ${this.physicsStats.hp} HP`, 50, 20);
        ctx.fillStyle = '#ffea00';
        ctx.fillText(`💪 گشتاور: ${this.physicsStats.torque} Nm`, 180, 20);
    }

    // UI Creation & Dynamic Rendering Helpers
    bindUIEvents() {
        const tuningModal = document.getElementById('tuning-screen');
        if (!tuningModal) return;

        // Tab Switching
        const tabBtns = tuningModal.querySelectorAll('.tuning-tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetTab = e.currentTarget.getAttribute('data-tab');
                if (targetTab) {
                    this.activeTab = targetTab;
                    tabBtns.forEach(b => b.classList.remove('active'));
                    e.currentTarget.classList.add('active');

                    const contents = tuningModal.querySelectorAll('.tuning-tab-content');
                    contents.forEach(c => c.classList.add('hidden'));

                    const activeContent = document.getElementById(`tab-content-${targetTab}`);
                    if (activeContent) activeContent.classList.remove('hidden');

                    if (targetTab === 'dyno') {
                        const dynoCanvas = document.getElementById('dyno-canvas');
                        this.renderDynoCanvas(dynoCanvas);
                    }
                }
            });
        });

        // Preset Buttons
        const presetBtns = tuningModal.querySelectorAll('.preset-btn');
        presetBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const pName = e.currentTarget.getAttribute('data-preset');
                if (pName) this.applyPreset(pName);
            });
        });

        // Reset Button
        const btnReset = document.getElementById('btn-tuning-reset');
        if (btnReset) {
            btnReset.addEventListener('click', () => this.resetToStock());
        }

        // Close Button
        const btnClose = document.getElementById('btn-tuning-close');
        if (btnClose) {
            btnClose.addEventListener('click', () => this.closeGarage());
        }

        // Real-Time Control Inputs (Sliders & Selects)
        const bindInput = (id, path, isFloat = false) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', (e) => {
                const val = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value);
                this.setNestedValue(this.data, path, val);
                this.recalculatePhysics();
                this.updateUIValuesOnly();
                this.applyVisualsToCar();
                this.saveSettings();
            });
        };

        const bindSelect = (id, path) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', (e) => {
                this.setNestedValue(this.data, path, e.target.value);
                this.recalculatePhysics();
                this.updateUIValuesOnly();
                this.applyVisualsToCar();
                this.saveSettings();
            });
        };

        bindInput('input-engine-stage', 'engine.stage');
        bindInput('input-turbo', 'engine.turbo');
        bindInput('input-supercharger', 'engine.supercharger');
        bindSelect('input-remap-stage', 'ecu.remapStage');
        bindInput('input-rev-limit', 'ecu.revLimitOffset');
        bindInput('input-throttle-resp', 'ecu.throttleResponse', true);
        bindSelect('input-pop-bang', 'ecu.popAndBang');
        bindInput('input-weight-stage', 'weight.stage');
        bindSelect('input-drivetrain', 'drivetrain.type');
        bindSelect('input-tire-type', 'tires.type');
        bindInput('input-tire-pressure', 'tires.pressure');
        bindSelect('input-stance', 'suspension.stance');
        bindInput('input-susp-height', 'suspension.height');
        bindInput('input-brake-power', 'brakes.power', true);
        bindInput('input-brake-bias', 'brakes.biasFront');
        bindInput('input-nitro-level', 'nitro.level');
        bindSelect('input-color-car', 'visual.carColor');
        bindSelect('input-color-underglow', 'visual.underglowColor');
    }

    setNestedValue(obj, path, val) {
        const parts = path.split('.');
        let current = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) current[parts[i]] = {};
            current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = val;
    }

    updateUI() {
        this.updateUIValuesOnly();
        const dynoCanvas = document.getElementById('dyno-canvas');
        if (dynoCanvas) this.renderDynoCanvas(dynoCanvas);
    }

    // Lightweight DOM Updates (Only changes values and progress bars!)
    updateUIValuesOnly() {
        const setTxt = (id, txt) => {
            const el = document.getElementById(id);
            if (el) el.innerText = txt;
        };
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };
        const setBar = (id, pct) => {
            const el = document.getElementById(id);
            if (el) el.style.width = Math.min(100, Math.max(0, pct)) + '%';
        };

        const s = this.physicsStats;
        setTxt('stat-hp-val', s.hp + ' HP');
        setTxt('stat-torque-val', s.torque + ' Nm');
        setTxt('stat-weight-val', s.weightKg + ' kg');
        setTxt('stat-top-speed-val', s.topSpeedKmh + ' km/h');

        // Progress bars
        setBar('bar-hp', (s.hp / 550) * 100);
        setBar('bar-torque', (s.torque / 650) * 100);
        setBar('bar-speed', (s.topSpeedKmh / 360) * 100);
        setBar('bar-grip', (s.gripFactor / 2.2) * 100);

        // Control Inputs Sync
        if (!this.data.ecu) {
            this.data.ecu = { remapStage: 'STAGE_1', revLimitOffset: 0, throttleResponse: 1.0, popAndBang: 'OFF' };
        }
        setVal('input-engine-stage', this.data.engine.stage);
        setVal('input-turbo', this.data.engine.turbo);
        setVal('input-supercharger', this.data.engine.supercharger);

        // ECU Remap UI Sync
        setVal('input-remap-stage', this.data.ecu.remapStage || 'STAGE_1');
        setVal('input-rev-limit', this.data.ecu.revLimitOffset || 0);
        setTxt('rev-limit-val', (6800 + (parseInt(this.data.ecu.revLimitOffset) || 0)) + ' RPM');
        setVal('input-throttle-resp', this.data.ecu.throttleResponse || 1.0);
        setTxt('throttle-resp-val', (parseFloat(this.data.ecu.throttleResponse) || 1.0) + 'x');
        setVal('input-pop-bang', this.data.ecu.popAndBang || 'OFF');

        setVal('input-weight-stage', this.data.weight.stage);
        setVal('input-drivetrain', this.data.drivetrain.type);
        setVal('input-tire-type', this.data.tires.type);
        setVal('input-tire-pressure', this.data.tires.pressure);
        setVal('input-stance', this.data.suspension.stance);
        setVal('input-susp-height', this.data.suspension.height);
        setVal('input-brake-power', this.data.brakes.power);
        setVal('input-brake-bias', this.data.brakes.biasFront);
        setVal('input-nitro-level', this.data.nitro.level);
        if (this.data.visual.carColor) setVal('input-color-car', this.data.visual.carColor);
        if (this.data.visual.underglowColor) setVal('input-color-underglow', this.data.visual.underglowColor);
    }

    openGarage() {
        const tuningModal = document.getElementById('tuning-screen');
        if (tuningModal) {
            tuningModal.classList.remove('hidden');
            this.updateUI();
            this.applyVisualsToCar();
        }
    }

    closeGarage() {
        const tuningModal = document.getElementById('tuning-screen');
        if (tuningModal) {
            tuningModal.classList.add('hidden');
        }
        if (this.game) {
            try { window.focus(); } catch (e) {}
        }
    }
}
