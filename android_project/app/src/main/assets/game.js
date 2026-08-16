/**
 * 3-Lane Neon Highway Racer - Full 3D WebGL Engine (Three.js)
 * Real 3D Chase Camera, 3D Car Meshes, 3D Road Environment, 3D Lighting, 3D Collectibles, & Police Sirens.
 */

class Game3D {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        
        this.state = 'MENU'; // MENU, PLAYING, PAUSED, GAMEOVER
        this.gameMode = 'ARCADE'; // ARCADE, TIME_ATTACK, ZEN
        
        // Settings & Options
        this.gfxQuality = localStorage.getItem('neon_gfx') || 'ULTRA'; // LOW, MEDIUM, ULTRA
        this.fpsTarget = localStorage.getItem('neon_fps') || '60'; // 30, 60, 120, MAX
        this.screenShakeEnabled = localStorage.getItem('neon_shake') !== 'false';
        
        // Game Stats
        this.score = 0;
        this.coins = parseInt(localStorage.getItem('neon_coins') || '0');
        this.highScore = parseInt(localStorage.getItem('neon_highscore') || '0');
        this.distance = 0;
        this.speed = 10;
        this.baseSpeed = 10;
        this.maxSpeed = 30;
        this.timeRemaining = 30;

        // 5-Lane 3D World Coordinates (X-axis: Far Left, Inner Left, Center, Inner Right, Far Right)
        this.laneX = [-7.2, -3.6, 0.0, 3.6, 7.2];
        this.currentLane = 2; // Center Lane (Lane 2)
        this.targetLane = 2;

        // Player Stats & Tuning
        this.player = {
            x: 0,
            y: 0.5,
            z: 0,
            tilt: 0,
            spinAngle: 0,
            isSpinning: false,
            spinTime: 0,
            selectedCar: parseInt(localStorage.getItem('neon_car') || '0'),
            underglowColor: localStorage.getItem('neon_underglow') || '#00f0ff',
            hasShield: false,
            hasMagnet: false,
            magnetTime: 0,
            nitroGauge: 100,
            isNitroActive: false,
            nitroTime: 0
        };

        // Car Garage Data (Toyota Supra MK4 Specifications)
        this.carGarage = [
            { id: 0, name: 'Toyota Supra MK4 (Orange JDM)', color: 0xff5500, secondary: 0x222222, price: 0, stat: 'افسانه‌ای JDM 2JZ' },
            { id: 1, name: 'Toyota Supra MK4 (Midnight Cyan)', color: 0x00f0ff, secondary: 0x0055ff, price: 150, stat: 'ضریب امتیاز ۲۰٪+' },
            { id: 2, name: 'Toyota Supra MK4 (Nitro Blaze)', color: 0xff0055, secondary: 0xffaa00, price: 300, stat: 'شارژ نیترو سریع‌تر' },
            { id: 3, name: 'Toyota Supra MK4 (Titan Shield)', color: 0x00ff66, secondary: 0x009944, price: 500, stat: 'شروع با سپر دفاعی' }
        ];

        this.unlockedCars = JSON.parse(localStorage.getItem('neon_unlocked_cars') || '[0]');

        // 3D Entities
        this.obstacles = [];
        this.collectibles = [];
        this.hazards = [];
        this.particles = [];
        this.floatingTexts = [];
        
        this.weather = 'CLEAR';
        this.weatherTimer = 0;
        this.screenShake = 0;

        this.lastSpawnTime = 0;
        this.lastCollectibleTime = 0;
        this.lastHazardTime = 0;
        this.keys = {};

        this.initDOM();
        this.initThreeJS();
        this.setupEvents();
        this.updateGarageUI();
        this.updateHUD();

        // FPS Timing
        this.lastFrameTime = performance.now();
        this.frameInterval = this.getFrameInterval();
        requestAnimationFrame((t) => this.loop(t));
    }

    getFrameInterval() {
        if (this.fpsTarget === '30') return 1000 / 30;
        if (this.fpsTarget === '60') return 1000 / 60;
        if (this.fpsTarget === '120') return 1000 / 120;
        return 0; // MAX / Uncapped
    }

    initDOM() {
        this.uiMenu = document.getElementById('menu-screen');
        this.uiPause = document.getElementById('pause-screen');
        this.uiSettings = document.getElementById('settings-screen');
        this.uiGameOver = document.getElementById('gameover-screen');
        this.uiGarage = document.getElementById('garage-screen');
        
        this.hudScore = document.getElementById('hud-score');
        this.hudCoins = document.getElementById('hud-coins');
        this.hudSpeed = document.getElementById('hud-speed');
        this.hudDistance = document.getElementById('hud-distance');
        this.hudTimerCard = document.getElementById('hud-timer-card');
        this.hudTimer = document.getElementById('hud-timer');
        this.powerupBar = document.getElementById('powerup-bar');
    }

    // ==========================================
    // THREE.JS 3D ENGINE INITIALIZATION
    // ==========================================
    initThreeJS() {
        // 1. Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x060714);
        this.scene.fog = new THREE.FogExp2(0x060714, 0.008);

        // 2. Camera
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 4.2, 9);
        this.camera.lookAt(0, 1.2, -40);

        // 3. WebGL Renderer with High-Performance Settings
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: false,
            powerPreference: "high-performance",
            precision: "mediump"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(1.0); // 1.0 DPR for rock-solid 60 FPS performance

        // 4. 3D Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0x00f0ff, 0.8);
        dirLight.position.set(10, 30, 20);
        this.scene.add(dirLight);

        // 5. 3D Infinite 5-Lane Road Plane
        const roadGeo = new THREE.PlaneGeometry(22, 600);
        const roadMat = new THREE.MeshBasicMaterial({ color: 0x0c0e20 });
        this.roadMesh = new THREE.Mesh(roadGeo, roadMat);
        this.roadMesh.rotation.x = -Math.PI / 2;
        this.roadMesh.position.z = -200;
        this.scene.add(this.roadMesh);

        // 3D Neon Borders (Left & Right for 5-Lane Highway)
        const borderGeo = new THREE.BoxGeometry(0.3, 0.2, 600);
        const borderMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
        
        this.leftBorder = new THREE.Mesh(borderGeo, borderMat);
        this.leftBorder.position.set(-11.0, 0.1, -200);
        this.scene.add(this.leftBorder);

        this.rightBorder = new THREE.Mesh(borderGeo, borderMat);
        this.rightBorder.position.set(11.0, 0.1, -200);
        this.scene.add(this.rightBorder);

        // 3D Dashed Lane Divider Lines (4 Lines separating 5 Lanes)
        this.laneLinesGroup = new THREE.Group();
        const lineDividerPosX = [-5.4, -1.8, 1.8, 5.4];

        for (let z = 10; z > -400; z -= 12) {
            const lineGeo = new THREE.BoxGeometry(0.15, 0.05, 5);
            const lineMat = new THREE.MeshBasicMaterial({ color: 0xff007f });
            
            lineDividerPosX.forEach(posX => {
                const divider = new THREE.Mesh(lineGeo, lineMat);
                divider.position.set(posX, 0.05, z);
                this.laneLinesGroup.add(divider);
            });
        }
        this.scene.add(this.laneLinesGroup);

        // 3D Sun in Horizon
        const sunGeo = new THREE.SphereGeometry(18, 32, 32);
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xff007f });
        this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
        this.sunMesh.position.set(0, 10, -280);
        this.scene.add(this.sunMesh);

        // 6. Build Player 3D Car
        this.buildPlayer3DCar();

        // 7. 3D Rain Particle System
        this.init3DRain();
    }

    buildPlayer3DCar() {
        if (this.playerCarGroup) this.scene.remove(this.playerCarGroup);

        const carData = this.carGarage[this.player.selectedCar];
        this.playerCarGroup = new THREE.Group();

        // High-Performance Glossy Automotive Paint (MeshPhongMaterial for 60 FPS fluidity)
        const carMat = new THREE.MeshPhongMaterial({
            color: carData.color,
            shininess: 90,
            specular: 0x666666
        });

        const darkTrimMat = new THREE.MeshBasicMaterial({ color: 0x11121c });

        // 1. Toyota Supra MK4 Main Body Chassis
        const bodyGeo = new THREE.BoxGeometry(1.9, 0.5, 3.9);
        const bodyMesh = new THREE.Mesh(bodyGeo, carMat);
        bodyMesh.position.y = 0.45;
        this.playerCarGroup.add(bodyMesh);

        // Flared Side Skirts / Widebody Wheel Arches
        const skirtGeo = new THREE.BoxGeometry(2.05, 0.25, 3.6);
        const skirtMesh = new THREE.Mesh(skirtGeo, carMat);
        skirtMesh.position.y = 0.32;
        this.playerCarGroup.add(skirtMesh);

        // Curved Supra Bonnet / Hood Scoop
        const hoodGeo = new THREE.BoxGeometry(1.5, 0.12, 1.4);
        const hoodMesh = new THREE.Mesh(hoodGeo, carMat);
        hoodMesh.position.set(0, 0.72, -1.05);
        hoodMesh.rotation.x = -0.06;
        this.playerCarGroup.add(hoodMesh);

        // Front Lip Splitter & Grille Intake
        const lipGeo = new THREE.BoxGeometry(1.85, 0.15, 0.4);
        const lipMesh = new THREE.Mesh(lipGeo, darkTrimMat);
        lipMesh.position.set(0, 0.22, -1.95);
        this.playerCarGroup.add(lipMesh);

        // 2. Supra Aerodynamic Fastback Cockpit & Windshield
        const glassGeo = new THREE.BoxGeometry(1.48, 0.52, 2.0);
        const glassMat = new THREE.MeshPhongMaterial({ color: 0x080915, shininess: 100, transparent: true, opacity: 0.9 });
        const glassMesh = new THREE.Mesh(glassGeo, glassMat);
        glassMesh.position.set(0, 0.88, -0.15);
        this.playerCarGroup.add(glassMesh);

        // Roof Panel
        const roofGeo = new THREE.BoxGeometry(1.35, 0.08, 1.2);
        const roofMesh = new THREE.Mesh(roofGeo, carMat);
        roofMesh.position.set(0, 1.15, -0.15);
        this.playerCarGroup.add(roofMesh);

        // 3. AUTHENTIC HIGH REAR SPOILER WING (The Legendary Supra Wing)
        const wingPostGeo = new THREE.BoxGeometry(0.12, 0.6, 0.4);
        const postL = new THREE.Mesh(wingPostGeo, carMat);
        postL.position.set(-0.78, 1.0, 1.68);
        const postR = new THREE.Mesh(wingPostGeo, carMat);
        postR.position.set(0.78, 1.0, 1.68);
        this.playerCarGroup.add(postL);
        this.playerCarGroup.add(postR);

        // Aerofoil Top Wing Blade with Curved Endplates
        const wingBladeGeo = new THREE.BoxGeometry(1.98, 0.1, 0.5);
        const wingBlade = new THREE.Mesh(wingBladeGeo, carMat);
        wingBlade.position.set(0, 1.32, 1.68);
        wingBlade.rotation.x = -0.05;
        this.playerCarGroup.add(wingBlade);

        // 4. QUAD ROUND SUPRA TAILLIGHTS (4 Iconic Circular Lights)
        const tailFasciaGeo = new THREE.BoxGeometry(1.65, 0.32, 0.08);
        const tailFascia = new THREE.Mesh(tailFasciaGeo, darkTrimMat);
        tailFascia.position.set(0, 0.55, 1.96);
        this.playerCarGroup.add(tailFascia);

        const circleLightGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.08, 16);
        circleLightGeo.rotateX(Math.PI / 2);
        this.brakeLightMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });

        this.taillights = [];
        [-0.62, -0.31, 0.31, 0.62].forEach(xPos => {
            const light = new THREE.Mesh(circleLightGeo, this.brakeLightMat);
            light.position.set(xPos, 0.55, 1.98);
            this.playerCarGroup.add(light);
            this.taillights.push(light);
        });

        // 5. Supra Slanted Headlight Pods
        const headGeo = new THREE.BoxGeometry(0.48, 0.14, 0.12);
        const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const headL = new THREE.Mesh(headGeo, headMat);
        headL.position.set(-0.68, 0.52, -1.96);
        const headR = new THREE.Mesh(headGeo, headMat);
        headR.position.set(0.68, 0.52, -1.96);
        this.playerCarGroup.add(headL);
        this.playerCarGroup.add(headR);

        // 6. Sport Alloy Wheels with Red Brembo Brake Calipers
        const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.35, 20);
        const tireMat = new THREE.MeshStandardMaterial({ color: 0x111115, roughness: 0.8 });
        const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.36, 12);
        const rimMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, metalness: 0.95, roughness: 0.08 });
        const caliperGeo = new THREE.BoxGeometry(0.15, 0.22, 0.2);
        const caliperMat = new THREE.MeshBasicMaterial({ color: 0xcc0000 });

        wheelGeo.rotateZ(Math.PI / 2);
        rimGeo.rotateZ(Math.PI / 2);

        [[-1.0, 0.38, 1.2], [1.0, 0.38, 1.2], [-1.0, 0.38, -1.2], [1.0, 0.38, -1.2]].forEach(pos => {
            const tire = new THREE.Mesh(wheelGeo, tireMat);
            const rim = new THREE.Mesh(rimGeo, rimMat);
            const caliper = new THREE.Mesh(caliperGeo, caliperMat);

            tire.position.set(pos[0], pos[1], pos[2]);
            rim.position.set(pos[0], pos[1], pos[2]);
            caliper.position.set(pos[0] * 0.85, pos[1] + 0.05, pos[2]);

            this.playerCarGroup.add(tire);
            this.playerCarGroup.add(rim);
            this.playerCarGroup.add(caliper);
        });

        // 7. Chrome Dual Exhaust Canister Pipe
        const exhaustGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.4, 12);
        const exhaustMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.95, roughness: 0.05 });
        exhaustGeo.rotateX(Math.PI / 2);
        const exhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
        exhaust.position.set(0.6, 0.25, 2.0);
        this.playerCarGroup.add(exhaust);

        // 8. 3D Neon Underglow PointLight
        const underglowHex = parseInt(this.player.underglowColor.replace('#', '0x'));
        this.underglowLight = new THREE.PointLight(underglowHex, 3.0, 8);
        this.underglowLight.position.set(0, 0.1, 0);
        this.playerCarGroup.add(this.underglowLight);

        // 9. 3D Shield Globe Mesh
        const shieldGeo = new THREE.SphereGeometry(2.5, 16, 16);
        const shieldMat = new THREE.MeshBasicMaterial({ color: 0x00ff66, wireframe: true, transparent: true, opacity: 0.5 });
        this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
        this.shieldMesh.position.y = 0.6;
        this.shieldMesh.visible = false;
        this.playerCarGroup.add(this.shieldMesh);

        this.playerCarGroup.position.set(this.laneX[this.currentLane], 0, 0);
        this.scene.add(this.playerCarGroup);
    }

    init3DRain() {
        const count = 300;
        const rainGeo = new THREE.BufferGeometry();
        const rainPositions = new Float32Array(count * 3);

        for (let i = 0; i < count * 3; i += 3) {
            rainPositions[i] = (Math.random() - 0.5) * 40;
            rainPositions[i + 1] = Math.random() * 20;
            rainPositions[i + 2] = (Math.random() - 0.5) * 100 - 20;
        }

        rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
        const rainMat = new THREE.PointsMaterial({ color: 0x00f0ff, size: 0.15, transparent: true, opacity: 0.6 });
        this.rainSystem = new THREE.Points(rainGeo, rainMat);
        this.rainSystem.visible = false;
        this.scene.add(this.rainSystem);
    }

    setupEvents() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        window.addEventListener('keydown', (e) => {
            if (e.repeat) return;
            this.keys[e.code] = true;

            if (e.code === 'KeyP' || e.code === 'Escape') this.togglePause();

            if (this.state === 'PLAYING' && !this.player.isSpinning) {
                if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.moveLane(-1);
                else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.moveLane(1);
                else if (e.code === 'Space') this.activateNitro();
            }
        });

        window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

        document.getElementById('btn-left').addEventListener('click', (e) => { e.preventDefault(); this.moveLane(-1); });
        document.getElementById('btn-right').addEventListener('click', (e) => { e.preventDefault(); this.moveLane(1); });
        document.getElementById('btn-nitro').addEventListener('click', (e) => { e.preventDefault(); this.activateNitro(); });

        // Gas & Brake Touch/Mouse Press & Hold Handlers
        const btnGas = document.getElementById('btn-gas');
        const btnBrake = document.getElementById('btn-brake');

        const setGas = (val) => { this.isGasPressed = val; btnGas.classList.toggle('active', val); };
        const setBrake = (val) => { this.isBrakePressed = val; btnBrake.classList.toggle('active', val); };

        btnGas.addEventListener('mousedown', (e) => { e.preventDefault(); setGas(true); });
        btnGas.addEventListener('mouseup', () => setGas(false));
        btnGas.addEventListener('mouseleave', () => setGas(false));
        btnGas.addEventListener('touchstart', (e) => { e.preventDefault(); setGas(true); }, { passive: false });
        btnGas.addEventListener('touchend', () => setGas(false));

        btnBrake.addEventListener('mousedown', (e) => { e.preventDefault(); setBrake(true); });
        btnBrake.addEventListener('mouseup', () => setBrake(false));
        btnBrake.addEventListener('mouseleave', () => setBrake(false));
        btnBrake.addEventListener('touchstart', (e) => { e.preventDefault(); setBrake(true); }, { passive: false });
        btnBrake.addEventListener('touchend', () => setBrake(false));

        document.getElementById('pause-btn').addEventListener('click', () => this.togglePause());
        document.getElementById('settings-btn').addEventListener('click', () => {
            if (this.state === 'PLAYING') {
                this.prevStateBeforeSettings = 'PLAYING';
                this.state = 'PAUSED';
            }
            this.uiSettings.classList.remove('hidden');
        });

        // Settings Selectors
        document.querySelectorAll('.seg-btn[data-gfx]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.seg-btn[data-gfx]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.gfxQuality = e.target.dataset.gfx;
                localStorage.setItem('neon_gfx', this.gfxQuality);
                this.renderer.setPixelRatio(this.gfxQuality === 'LOW' ? 1.0 : Math.min(window.devicePixelRatio || 1, 2));
            });
        });

        document.querySelectorAll('.seg-btn[data-fps]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.seg-btn[data-fps]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.fpsTarget = e.target.dataset.fps;
                localStorage.setItem('neon_fps', this.fpsTarget);
                this.frameInterval = this.getFrameInterval();
            });
        });

        document.querySelectorAll('.seg-btn[data-track]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.seg-btn[data-track]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                audioMgr.switchTrack(parseInt(e.target.dataset.track));
            });
        });

        document.getElementById('btn-close-settings').addEventListener('click', () => {
            this.uiSettings.classList.add('hidden');
            if (this.prevStateBeforeSettings === 'PLAYING') {
                this.state = 'PLAYING';
                this.prevStateBeforeSettings = null;
            }
        });

        document.getElementById('btn-open-settings-pause').addEventListener('click', () => {
            this.uiSettings.classList.remove('hidden');
        });

        document.getElementById('btn-start').addEventListener('click', () => { audioMgr.init(); this.startGame(); });
        document.getElementById('btn-restart').addEventListener('click', () => { this.startGame(); });

        document.getElementById('btn-garage').addEventListener('click', () => {
            this.uiMenu.classList.add('hidden');
            this.uiGarage.classList.remove('hidden');
        });

        document.getElementById('btn-close-garage').addEventListener('click', () => {
            this.uiGarage.classList.add('hidden');
            this.uiMenu.classList.remove('hidden');
        });

        document.getElementById('btn-resume').addEventListener('click', () => { this.togglePause(); });

        // Underglow Tuning Colors
        document.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.addEventListener('click', (e) => {
                document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
                e.target.classList.add('active');
                this.player.underglowColor = e.target.dataset.underglow;
                localStorage.setItem('neon_underglow', this.player.underglowColor);
                if (this.underglowLight) {
                    this.underglowLight.color.setHex(parseInt(this.player.underglowColor.replace('#', '0x')));
                }
            });
        });

        // Touch Swipe
        let touchStartX = 0;
        window.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
        window.addEventListener('touchend', (e) => {
            if (this.state !== 'PLAYING') return;
            const diffX = e.changedTouches[0].clientX - touchStartX;
            if (Math.abs(diffX) > 40) {
                if (diffX < 0) this.moveLane(-1);
                else this.moveLane(1);
            }
        }, { passive: true });
    }

    moveLane(direction) {
        if (this.state !== 'PLAYING' || this.player.isSpinning) return;
        const newLane = this.targetLane + direction;
        if (newLane >= 0 && newLane <= 4) { // 5 Lanes (0, 1, 2, 3, 4)
            this.targetLane = newLane;
            audioMgr.playLaneSwitch();
        }
    }

    activateNitro() {
        if (this.state !== 'PLAYING' || this.player.isNitroActive || this.player.nitroGauge < 30) return;
        this.player.isNitroActive = true;
        this.player.nitroTime = 180;
        audioMgr.playNitro();
    }

    startGame() {
        this.state = 'PLAYING';
        this.score = 0;
        this.distance = 0;
        this.speed = this.baseSpeed;
        this.currentLane = 2;
        this.targetLane = 2;
        this.player.x = this.laneX[2];
        this.player.tilt = 0;
        this.player.spinAngle = 0;
        this.player.isSpinning = false;
        this.player.nitroGauge = 100;
        this.player.isNitroActive = false;

        this.timeRemaining = 30;
        if (this.gameMode === 'TIME_ATTACK') this.hudTimerCard.classList.remove('hidden');
        else this.hudTimerCard.classList.add('hidden');

        if (this.player.selectedCar === 3) {
            this.player.hasShield = true;
        } else {
            this.player.hasShield = false;
        }

        this.player.hasMagnet = false;

        // Clear 3D Entities
        this.obstacles.forEach(o => this.scene.remove(o.mesh));
        this.collectibles.forEach(c => this.scene.remove(c.mesh));
        this.hazards.forEach(h => this.scene.remove(h.mesh));
        this.obstacles = [];
        this.collectibles = [];
        this.hazards = [];

        this.buildPlayer3DCar();

        this.uiMenu.classList.add('hidden');
        this.uiPause.classList.add('hidden');
        this.uiGameOver.classList.add('hidden');
        this.uiGarage.classList.add('hidden');
        this.uiSettings.classList.add('hidden');

        audioMgr.init();
    }

    togglePause() {
        if (!this.uiSettings.classList.contains('hidden')) {
            this.uiSettings.classList.add('hidden');
            if (this.prevStateBeforeSettings === 'PLAYING') {
                this.state = 'PLAYING';
                this.prevStateBeforeSettings = null;
            }
            return;
        }

        if (this.state === 'PLAYING') {
            this.state = 'PAUSED';
            this.uiPause.classList.remove('hidden');
        } else if (this.state === 'PAUSED') {
            this.state = 'PLAYING';
            this.uiPause.classList.add('hidden');
        }
    }

    gameOver(reason = 'تصادف شدید در جاده سه‌بعدی') {
        if (this.gameMode === 'ZEN') return;

        this.state = 'GAMEOVER';
        audioMgr.playCrash();

        if (this.screenShakeEnabled) this.screenShake = 22;

        if (this.score > this.highScore) {
            this.highScore = Math.floor(this.score);
            localStorage.setItem('neon_highscore', this.highScore.toString());
        }
        localStorage.setItem('neon_coins', this.coins.toString());

        document.getElementById('gameover-reason').innerText = reason;
        document.getElementById('final-score').innerText = Math.floor(this.score).toLocaleString('fa-IR');
        document.getElementById('final-coins').innerText = this.coins.toLocaleString('fa-IR');
        document.getElementById('final-dist').innerText = Math.floor(this.distance) + ' متر';
        document.getElementById('final-highscore').innerText = this.highScore.toLocaleString('fa-IR');

        setTimeout(() => { this.uiGameOver.classList.remove('hidden'); }, 800);
    }

    loop(timestamp) {
        const delta = timestamp - this.lastFrameTime;

        if (this.frameInterval === 0 || delta >= this.frameInterval) {
            const dt = Math.min(delta / 1000, 0.1);
            this.lastFrameTime = timestamp - (delta % (this.frameInterval || 16.6));

            if (this.state === 'PLAYING') {
                this.update(dt);
            }

            this.render();
        }

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        // Auto Anti-Lag Performance Monitor
        if (dt > 0.036) {
            this.lagFrames = (this.lagFrames || 0) + 1;
            if (this.lagFrames > 35) {
                this.renderer.setPixelRatio(1.0);
                if (this.rainSystem) this.rainSystem.visible = false;
                this.addFloatingText('⚡ سیستم ضد-لگ هوشمند فعال شد (60 FPS)', this.canvas.width / 2, 160, '#ffea00');
                this.lagFrames = 0;
            }
        } else {
            this.lagFrames = 0;
        }

        if (this.gameMode === 'TIME_ATTACK') {
            this.timeRemaining -= dt;
            if (this.timeRemaining <= 0) {
                this.timeRemaining = 0;
                this.gameOver('زمان مسابقه به پایان رسید!');
                return;
            }
        }

        // Weather Transition
        this.weatherTimer += dt;
        if (this.weatherTimer > 25) {
            this.weatherTimer = 0;
            const cycle = ['CLEAR', 'RAIN', 'TUNNEL'];
            this.weather = cycle[(cycle.indexOf(this.weather) + 1) % cycle.length];
            this.rainSystem.visible = (this.weather === 'RAIN');
        }

        // Speed & Throttle/Brake Physics Logic (Gentle & Controlled Acceleration)
        let targetSpeed = this.baseSpeed;

        const isGasPressed = this.isGasPressed || this.keys['ArrowUp'] || this.keys['KeyW'];
        const isBrakePressed = this.isBrakePressed || this.keys['ArrowDown'] || this.keys['KeyS'];

        if (this.player.isNitroActive) {
            targetSpeed = 32.0;
            this.speed = targetSpeed;
            this.player.nitroTime--;
            this.player.nitroGauge = Math.max(0, (this.player.nitroTime / 180) * 100);

            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 70, 0.08);
            this.camera.updateProjectionMatrix();

            if (this.player.nitroTime <= 0) this.player.isNitroActive = false;
        } else {
            this.baseSpeed = Math.min(18, this.baseSpeed + dt * 0.05);

            let accelRate = 0.15;
            if (isGasPressed) {
                targetSpeed = 23.0; // Gentle max speed
                accelRate = 0.22; // Very slow, gradual, smooth acceleration curve
            } else if (isBrakePressed) {
                targetSpeed = 4.0; // Gentle braking
                accelRate = 1.0; 
            } else {
                targetSpeed = this.baseSpeed;
                accelRate = 0.15; 
            }

            this.speed += (targetSpeed - this.speed) * dt * accelRate;

            const targetFov = 60 + (this.speed / 30) * 8;
            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 0.08);
            this.camera.updateProjectionMatrix();

            if (this.player.nitroGauge < 100) {
                const rechargeRate = (this.player.selectedCar === 2) ? 0.25 : 0.12;
                this.player.nitroGauge = Math.min(100, this.player.nitroGauge + rechargeRate);
            }
        }

        // Taillight Brake Light Glow
        if (this.taillights) {
            const glowColor = isBrakePressed ? 0xff0000 : 0x990022;
            this.taillights.forEach(l => l.material.color.setHex(glowColor));
        }

        audioMgr.updateEnginePitch(this.speed / this.maxSpeed);

        this.distance += (this.speed * dt * 2);
        const scoreMultiplier = (this.player.selectedCar === 1) ? 1.2 : 1.0;
        this.score += (this.speed * dt * 10) * scoreMultiplier;

        // 3D Road Line Animations
        this.laneLinesGroup.children.forEach(line => {
            line.position.z += this.speed * dt * 12;
            if (line.position.z > 15) line.position.z -= 410;
        });

        // Smooth 3D Player Lane Lerping
        const targetX = this.laneX[this.targetLane];
        const diffX = targetX - this.player.x;
        this.player.x += diffX * 0.18;
        this.player.tilt = -diffX * 0.05; // 3D Car Roll / Tilt

        if (this.player.isSpinning) {
            this.player.spinAngle += dt * 15;
            this.player.spinTime -= dt;
            if (this.player.spinTime <= 0) {
                this.player.isSpinning = false;
                this.player.spinAngle = 0;
            }
        }

        // Update 3D Car Group Position & Rotation
        this.playerCarGroup.position.x = this.player.x;
        this.playerCarGroup.rotation.y = this.player.spinAngle;
        this.playerCarGroup.rotation.z = this.player.tilt;

        this.shieldMesh.visible = this.player.hasShield;

        // 3D Camera Chase Position
        this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, this.player.x * 0.45, 0.1);

        // Spawn 3D Obstacles
        const now = performance.now();
        if (now - this.lastSpawnTime > Math.max(700, 2200 - (this.distance * 0.3))) {
            this.spawn3DObstacle();
            this.lastSpawnTime = now;
        }

        if (now - this.lastCollectibleTime > 1100) {
            this.spawn3DCollectible();
            this.lastCollectibleTime = now;
        }

        if (now - this.lastHazardTime > 3500) {
            this.spawn3DHazard();
            this.lastHazardTime = now;
        }

        // Update 3D Traffic Obstacles
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obs = this.obstacles[i];
            obs.z += (this.speed - obs.speed) * dt * 8;
            obs.mesh.position.z = obs.z;

            // Police Lights Blinking
            if (obs.type === 'police') {
                obs.sirenTimer = (obs.sirenTimer || 0) + dt;
                if (obs.sirenTimer > 0.4) {
                    obs.sirenTimer = 0;
                    audioMgr.playPoliceSiren();
                }
            }

            // 3D Collision Detection with Player
            if (Math.abs(obs.z - this.player.z) < 2.8 && Math.abs(obs.x - this.player.x) < 1.6) {
                if (this.player.isNitroActive) {
                    this.scene.remove(obs.mesh);
                    this.obstacles.splice(i, 1);
                    this.score += 300;
                    this.addFloatingText('انفجار نیترو! +۳۰۰', this.canvas.width / 2, 160, '#ffea00');
                    audioMgr.playCrash();
                    continue;
                } else if (this.player.hasShield) {
                    this.player.hasShield = false;
                    this.scene.remove(obs.mesh);
                    this.obstacles.splice(i, 1);
                    audioMgr.playCrash();
                    this.addFloatingText('سپر تخریب شد!', this.canvas.width / 2, 160, '#00f0ff');
                    continue;
                } else {
                    this.gameOver('تصادف شدید در جاده سه‌بعدی');
                    return;
                }
            }

            if (obs.z > 20) {
                this.scene.remove(obs.mesh);
                this.obstacles.splice(i, 1);
            }
        }

        // Update 3D Collectibles
        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const item = this.collectibles[i];
            item.z += this.speed * dt * 8;
            item.mesh.position.z = item.z;
            item.mesh.rotation.y += dt * 3; // 3D Coin Rotation

            if (Math.abs(item.z - this.player.z) < 2.5 && Math.abs(item.x - this.player.x) < 1.8) {
                if (item.type === 'coin') {
                    this.coins++;
                    this.score += 100;
                    audioMgr.playCoin();
                } else if (item.type === 'time') {
                    this.timeRemaining += 5.0;
                    audioMgr.playPowerup();
                    this.addFloatingText('زمان +۵ ثانیه!', this.canvas.width / 2, 160, '#00ff66');
                } else if (item.type === 'gem') {
                    this.coins += 5;
                    this.score += 500;
                    audioMgr.playPowerup();
                    this.addFloatingText('الماس سه‌بعدی! +۵ سکه', this.canvas.width / 2, 160, '#00f0ff');
                } else if (item.type === 'shield') {
                    this.player.hasShield = true;
                    audioMgr.playPowerup();
                    this.addFloatingText('سپر فعال شد!', this.canvas.width / 2, 160, '#00ff66');
                }

                this.scene.remove(item.mesh);
                this.collectibles.splice(i, 1);
                continue;
            }

            if (item.z > 20) {
                this.scene.remove(item.mesh);
                this.collectibles.splice(i, 1);
            }
        }

        // Update 3D Hazards (Oil)
        for (let i = this.hazards.length - 1; i >= 0; i--) {
            const h = this.hazards[i];
            h.z += this.speed * dt * 8;
            h.mesh.position.z = h.z;

            if (Math.abs(h.z - this.player.z) < 2.0 && Math.abs(h.x - this.player.x) < 1.5) {
                if (!this.player.isSpinning) {
                    this.player.isSpinning = true;
                    this.player.spinTime = 1.0;
                    this.addFloatingText('⚠️ لغزش روی روغن!', this.canvas.width / 2, 160, '#ffea00');
                    audioMgr.playCrash();
                }
            }

            if (h.z > 20) {
                this.scene.remove(h.mesh);
                this.hazards.splice(i, 1);
            }
        }

        // Update Floating Texts
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.y -= dt * 40;
            ft.alpha -= dt * 0.8;
            if (ft.alpha <= 0) this.floatingTexts.splice(i, 1);
        }

        this.updateHUD();
    }

    spawn3DObstacle() {
        const lane = Math.floor(Math.random() * 5); // 5 Lanes (0 to 4)
        const types = [
            { type: 'sedan', color: 0xe60000, speed: 2, scaleZ: 3.6 },
            { type: 'sports', color: 0xffaa00, speed: 4, scaleZ: 3.8 },
            { type: 'police', color: 0x002288, speed: 1, scaleZ: 3.6 },
            { type: 'truck', color: 0x8800cc, speed: 0, scaleZ: 6.0 }
        ];

        const selected = types[Math.floor(Math.random() * types.length)];
        const meshGroup = new THREE.Group();

        if (selected.type === 'truck') {
            // 3D Heavy Truck Construction
            const cabGeo = new THREE.BoxGeometry(2.0, 1.4, 2.2);
            const cabMat = new THREE.MeshStandardMaterial({ color: selected.color, metalness: 0.6, roughness: 0.3 });
            const cabMesh = new THREE.Mesh(cabGeo, cabMat);
            cabMesh.position.set(0, 0.9, 1.8);
            meshGroup.add(cabMesh);

            const trailerGeo = new THREE.BoxGeometry(2.2, 2.0, 4.8);
            const trailerMat = new THREE.MeshStandardMaterial({ color: 0x222444, metalness: 0.4, roughness: 0.4 });
            const trailerMesh = new THREE.Mesh(trailerGeo, trailerMat);
            trailerMesh.position.set(0, 1.2, -1.2);
            meshGroup.add(trailerMesh);

            // Truck Wheels (6 Wheels)
            const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.35, 12);
            const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
            wheelGeo.rotateZ(Math.PI / 2);

            [[-1.1, 0.4, 2.0], [1.1, 0.4, 2.0], [-1.1, 0.4, -0.5], [1.1, 0.4, -0.5], [-1.1, 0.4, -2.5], [1.1, 0.4, -2.5]].forEach(pos => {
                const w = new THREE.Mesh(wheelGeo, wheelMat);
                w.position.set(pos[0], pos[1], pos[2]);
                meshGroup.add(w);
            });
        } else {
            // 3D Passenger / Police / Sports Car Construction
            const bodyGeo = new THREE.BoxGeometry(1.8, 0.7, selected.scaleZ);
            const bodyMat = new THREE.MeshStandardMaterial({ color: selected.color, metalness: 0.5, roughness: 0.3 });
            const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
            bodyMesh.position.y = 0.5;
            meshGroup.add(bodyMesh);

            // Windshield / Cabin
            const glassGeo = new THREE.BoxGeometry(1.4, 0.5, 1.8);
            const glassMat = new THREE.MeshStandardMaterial({ color: 0x050710, metalness: 0.9, roughness: 0.1 });
            const glassMesh = new THREE.Mesh(glassGeo, glassMat);
            glassMesh.position.set(0, 0.9, 0.1);
            meshGroup.add(glassMesh);

            // 4 Wheels
            const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12);
            const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
            wheelGeo.rotateZ(Math.PI / 2);

            [[-0.95, 0.35, 1.1], [0.95, 0.35, 1.1], [-0.95, 0.35, -1.1], [0.95, 0.35, -1.1]].forEach(pos => {
                const w = new THREE.Mesh(wheelGeo, wheelMat);
                w.position.set(pos[0], pos[1], pos[2]);
                meshGroup.add(w);
            });

            // Glowing Red Taillights (Facing Towards Player)
            const tailGeo = new THREE.BoxGeometry(0.4, 0.15, 0.1);
            const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
            const tailL = new THREE.Mesh(tailGeo, tailMat);
            tailL.position.set(-0.6, 0.5, selected.scaleZ / 2 + 0.05);
            const tailR = new THREE.Mesh(tailGeo, tailMat);
            tailR.position.set(0.6, 0.5, selected.scaleZ / 2 + 0.05);
            meshGroup.add(tailL);
            meshGroup.add(tailR);

            // 3D Police Siren Lights
            if (selected.type === 'police') {
                const sirenGeo = new THREE.BoxGeometry(0.8, 0.15, 0.2);
                const sirenMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
                const siren = new THREE.Mesh(sirenGeo, sirenMat);
                siren.position.set(0, 1.2, 0);
                meshGroup.add(siren);

                const policeLight = new THREE.PointLight(0x0088ff, 2.0, 8);
                policeLight.position.set(0, 1.5, 0);
                meshGroup.add(policeLight);
            }
        }

        const spawnZ = -140; // Visible spawn depth
        meshGroup.position.set(this.laneX[lane], 0, spawnZ);
        this.scene.add(meshGroup);

        this.obstacles.push({
            x: this.laneX[lane],
            z: spawnZ,
            lane: lane,
            speed: selected.speed,
            type: selected.type,
            mesh: meshGroup
        });
    }

    spawn3DCollectible() {
        const lane = Math.floor(Math.random() * 5); // 5 Lanes
        const rand = Math.random();
        let type = 'coin';
        
        if (this.gameMode === 'TIME_ATTACK' && rand < 0.35) type = 'time';
        else if (rand < 0.65) type = 'coin';
        else if (rand < 0.82) type = 'gem';
        else type = 'shield';

        const meshGroup = new THREE.Group();

        if (type === 'coin') {
            const coinGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.15, 16);
            const coinMat = new THREE.MeshStandardMaterial({ color: 0xffe600, metalness: 0.8, roughness: 0.2 });
            const coin = new THREE.Mesh(coinGeo, coinMat);
            coin.rotation.x = Math.PI / 2;
            coin.position.y = 0.8;
            meshGroup.add(coin);
        } else if (type === 'gem') {
            const gemGeo = new THREE.OctahedronGeometry(0.7);
            const gemMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, metalness: 0.9, roughness: 0.1 });
            const gem = new THREE.Mesh(gemGeo, gemMat);
            gem.position.y = 0.8;
            meshGroup.add(gem);
        } else {
            const shieldGeo = new THREE.SphereGeometry(0.7, 16, 16);
            const shieldMat = new THREE.MeshBasicMaterial({ color: 0x00ff66, wireframe: true });
            const shield = new THREE.Mesh(shieldGeo, shieldMat);
            shield.position.y = 0.8;
            meshGroup.add(shield);
        }

        meshGroup.position.set(this.laneX[lane], 0, -180);
        this.scene.add(meshGroup);

        this.collectibles.push({
            x: this.laneX[lane],
            z: -180,
            type: type,
            mesh: meshGroup
        });
    }

    spawn3DHazard() {
        const lane = Math.floor(Math.random() * 5); // 5 Lanes
        const oilGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.02, 16);
        const oilMat = new THREE.MeshBasicMaterial({ color: 0x050a12 });
        const oilMesh = new THREE.Mesh(oilGeo, oilMat);
        oilMesh.position.set(this.laneX[lane], 0.02, -180);
        this.scene.add(oilMesh);

        this.hazards.push({
            x: this.laneX[lane],
            z: -180,
            type: 'oil',
            mesh: oilMesh
        });
    }

    addFloatingText(text, x, y, color) {
        this.floatingTexts.push({ text: text, x: x, y: y, color: color, alpha: 1 });
    }

    updateHUD() {
        const speedKmh = Math.floor(this.speed * 9.5);
        this.hudScore.innerText = Math.floor(this.score).toLocaleString('fa-IR');
        this.hudCoins.innerText = this.coins.toLocaleString('fa-IR');
        this.hudSpeed.innerText = speedKmh + ' km/h';
        this.hudDistance.innerText = Math.floor(this.distance) + ' m';
        if (this.gameMode === 'TIME_ATTACK') this.hudTimer.innerText = Math.ceil(this.timeRemaining) + 's';

        // Speedometer Gauge Animation
        const needle = document.getElementById('speedo-needle');
        const arc = document.getElementById('speedo-arc');
        const kmhVal = document.getElementById('speedo-kmh');
        const gearBadge = document.getElementById('speedo-gear');

        if (needle && arc && kmhVal) {
            const clampSpeed = Math.min(300, Math.max(0, speedKmh));
            const angle = (clampSpeed / 300) * 240 - 120;
            needle.style.transform = `rotate(${angle}deg)`;
            arc.style.strokeDashoffset = (264 - (clampSpeed / 300) * 264).toString();
            kmhVal.innerText = clampSpeed.toLocaleString('fa-IR');

            // Gear Indicator
            let gear = 'D1';
            if (this.player.isNitroActive) gear = '⚡ NITRO';
            else if (clampSpeed < 45) gear = 'D1';
            else if (clampSpeed < 85) gear = 'D2';
            else if (clampSpeed < 135) gear = 'D3';
            else if (clampSpeed < 185) gear = 'D4';
            else if (clampSpeed < 235) gear = 'D5';
            else gear = 'D6';

            if (gearBadge) gearBadge.innerText = gear;
        }

        this.powerupBar.innerHTML = '';
        if (this.gameMode === 'ZEN') this.powerupBar.innerHTML += `<div class="powerup-badge" style="border-color:#00f0ff;">🧘 حالت زِن بی‌انتها</div>`;
        if (this.player.hasShield) this.powerupBar.innerHTML += `<div class="powerup-badge" style="border-color:#00ff66;">🛡️ سپر فعال</div>`;
        if (this.player.isNitroActive) this.powerupBar.innerHTML += `<div class="powerup-badge" style="border-color:#ffea00;">⚡ نیترو فعال!</div>`;
    }

    updateGarageUI() {
        const garageContainer = document.getElementById('garage-cars-list');
        if (!garageContainer) return;
        garageContainer.innerHTML = '';

        this.carGarage.forEach(car => {
            const isUnlocked = this.unlockedCars.includes(car.id);
            const isSelected = this.player.selectedCar === car.id;

            const card = document.createElement('div');
            card.className = `car-card ${isSelected ? 'selected' : ''}`;
            const colorHex = '#' + car.color.toString(16).padStart(6, '0');
            card.innerHTML = `
                <div style="width:40px; height:70px; background:${colorHex}; border-radius:8px; box-shadow:0 0 10px ${colorHex}; margin-bottom:5px;"></div>
                <div class="car-name">${car.name}</div>
                <div style="font-size:0.75rem; color:#888;">${car.stat}</div>
                <div class="car-price">
                    ${isUnlocked ? (isSelected ? '✔ انتخاب‌شده' : '<button class="btn-secondary" style="padding:4px 10px; font-size:0.75rem;">انتخاب</button>') : `🪙 ${car.price}`}
                </div>
            `;

            card.addEventListener('click', () => {
                if (isUnlocked) {
                    this.player.selectedCar = car.id;
                    localStorage.setItem('neon_car', car.id);
                    this.buildPlayer3DCar();
                    this.updateGarageUI();
                } else if (this.coins >= car.price) {
                    this.coins -= car.price;
                    this.unlockedCars.push(car.id);
                    this.player.selectedCar = car.id;
                    localStorage.setItem('neon_coins', this.coins);
                    localStorage.setItem('neon_unlocked_cars', JSON.stringify(this.unlockedCars));
                    localStorage.setItem('neon_car', car.id);
                    this.buildPlayer3DCar();
                    this.updateGarageUI();
                    this.updateHUD();
                } else {
                    alert('سکه کافی ندارید!');
                }
            });

            garageContainer.appendChild(card);
        });
    }

    // ==========================================
    // THREE.JS RENDER LOOP
    // ==========================================
    render() {
        this.renderer.render(this.scene, this.camera);
    }
}

// Instantiate Game on DOM Loaded
window.addEventListener('DOMContentLoaded', () => {
    window.game = new Game3D();
});
