/*
 * ===================================================================
 * PEUGEOT PARS 3D RACER (پژو پارس سه‌بعدی HD - سلطان جاده)
 * Ultra-Lightweight & Bug-Free 3D Engine Architecture
 * ===================================================================
 */

class Game3D {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.state = 'MENU'; // MENU, PLAYING, PAUSED, GAMEOVER
        this.cameraMode = localStorage.getItem('neon_cammode') || 'CHASE'; // CHASE, COCKPIT, HOOD

        // Stats
        this.score = 0;
        this.coins = parseInt(localStorage.getItem('neon_coins') || '0');
        this.highScore = parseInt(localStorage.getItem('neon_highscore') || '0');
        this.distance = 0;
        this.speed = 12;
        this.baseSpeed = 12;

        // 5 Highway Lanes (X: -7.2, -3.6, 0.0, 3.6, 7.2)
        this.laneX = [-7.2, -3.6, 0.0, 3.6, 7.2];
        this.currentLane = 2; // Center lane
        this.targetLane = 2;

        // Player State
        this.player = {
            x: 0,
            y: 0,
            z: 0,
            tilt: 0,
            spinAngle: 0,
            isSpinning: false,
            spinTime: 0,
            selectedCar: 0,
            underglowColor: localStorage.getItem('neon_underglow') || '#00f0ff',
            stance: localStorage.getItem('neon_stance') || 'SHOOTI',
            sticker: localStorage.getItem('neon_sticker') || 'SOLTAN',
            hasShield: false,
            nitroGauge: 100,
            isNitroActive: false,
            nitroTime: 0
        };

        // Car Garage
        this.carGarage = [
            { id: 0, name: 'پژو پارس ELX HD (شوتی سلطان)', color: 0xffffff, stat: 'سلطان جاده - شتاب شوتی', modelType: 'PARS' }
        ];

        // 3D Groups & Arrays
        this.obstacles = [];
        this.collectibles = [];
        this.floatingTexts = [];
        this.lastSpawnTime = 0;
        this.lastCollectibleTime = 0;
        this.keys = {};

        this.initDOM();
        this.initThreeJS();
        this.buildPlayer3DCar();
        this.setupEvents();
        this.updateHUD();

        this.lastFrameTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    initDOM() {
        this.uiMenu = document.getElementById('menu-screen');
        this.uiPause = document.getElementById('pause-screen');
        this.uiGameOver = document.getElementById('gameover-screen');
        this.hudScore = document.getElementById('hud-score');
        this.hudCoins = document.getElementById('hud-coins');
        this.hudSpeed = document.getElementById('hud-speed');
        this.hudDistance = document.getElementById('hud-distance');
        this.powerupBar = document.getElementById('powerup-bar');
    }

    initThreeJS() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x7090b4);
        this.scene.fog = new THREE.FogExp2(0x7090b4, 0.0025);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 1.35, 3.8);
        this.camera.lookAt(0, 0.55, 0.2);

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            preserveDrawingBuffer: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(1.0);

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.85);
        this.scene.add(hemiLight);

        const sunLight = new THREE.DirectionalLight(0xffffff, 1.25);
        sunLight.position.set(30, 60, -20);
        this.scene.add(sunLight);

        // Asphalt Highway Road
        const roadGeo = new THREE.PlaneGeometry(24, 600);
        const roadMat = new THREE.MeshStandardMaterial({ color: 0x262833, roughness: 0.7, metalness: 0.1 });
        this.roadMesh = new THREE.Mesh(roadGeo, roadMat);
        this.roadMesh.rotation.x = -Math.PI / 2;
        this.roadMesh.position.z = -200;
        this.scene.add(this.roadMesh);

        // Soil Terrain
        const terrainMat = new THREE.MeshStandardMaterial({ color: 0x444034, roughness: 0.95 });
        const leftTerrain = new THREE.Mesh(new THREE.PlaneGeometry(160, 600), terrainMat);
        leftTerrain.rotation.x = -Math.PI / 2;
        leftTerrain.position.set(-92, -0.05, -200);
        this.scene.add(leftTerrain);

        const rightTerrain = new THREE.Mesh(new THREE.PlaneGeometry(160, 600), terrainMat);
        rightTerrain.rotation.x = -Math.PI / 2;
        rightTerrain.position.set(92, -0.05, -200);
        this.scene.add(rightTerrain);

        // Yellow Shoulder Lines
        const edgeLineGeo = new THREE.BoxGeometry(0.25, 0.04, 600);
        const edgeLineMat = new THREE.MeshBasicMaterial({ color: 0xe6b800 });
        const leftEdge = new THREE.Mesh(edgeLineGeo, edgeLineMat);
        leftEdge.position.set(-10.8, 0.02, -200);
        this.scene.add(leftEdge);

        const rightEdge = new THREE.Mesh(edgeLineGeo, edgeLineMat);
        rightEdge.position.set(10.8, 0.02, -200);
        this.scene.add(rightEdge);

        // Steel Guardrails
        const guardrailMat = new THREE.MeshStandardMaterial({ color: 0x9fb1c2, metalness: 0.85, roughness: 0.25 });
        const railGeo = new THREE.BoxGeometry(0.2, 0.45, 600);

        const leftRail = new THREE.Mesh(railGeo, guardrailMat);
        leftRail.position.set(-11.4, 0.5, -200);
        this.scene.add(leftRail);

        const rightRail = new THREE.Mesh(railGeo, guardrailMat);
        rightRail.position.set(11.4, 0.5, -200);
        this.scene.add(rightRail);

        // Dashed Lane Dividers
        this.laneLinesGroup = new THREE.Group();
        const lineDividerPosX = [-5.4, -1.8, 1.8, 5.4];
        for (let z = 10; z > -400; z -= 12) {
            const lineGeo = new THREE.BoxGeometry(0.18, 0.04, 4.5);
            const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            lineDividerPosX.forEach(posX => {
                const divider = new THREE.Mesh(lineGeo, lineMat);
                divider.position.set(posX, 0.03, z);
                this.laneLinesGroup.add(divider);
            });
        }
        this.scene.add(this.laneLinesGroup);

        // Street Lights
        this.streetLightsGroup = new THREE.Group();
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x222533, metalness: 0.7, roughness: 0.3 });
        const lampLightMat = new THREE.MeshBasicMaterial({ color: 0xffcc44 });

        for (let z = 20; z > -420; z -= 35) {
            [-12.5, 12.5].forEach(xPos => {
                const poleGroup = new THREE.Group();
                const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 7.0, 10), poleMat);
                shaft.position.y = 3.5;
                poleGroup.add(shaft);

                const armDir = xPos < 0 ? 1 : -1;
                const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.1), poleMat);
                arm.position.set(armDir * 0.8, 6.8, 0);
                poleGroup.add(arm);

                const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.3), lampLightMat);
                head.position.set(armDir * 1.5, 6.7, 0);
                poleGroup.add(head);

                poleGroup.position.set(xPos, 0, z);
                this.streetLightsGroup.add(poleGroup);
            });
        }
        this.scene.add(this.streetLightsGroup);

        // Roadside Trees
        this.roadsideTreesGroup = new THREE.Group();
        const trunkGeo = new THREE.CylinderGeometry(0.3, 0.45, 3.5, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.9 });
        const foliageGeo = new THREE.ConeGeometry(2.2, 5.0, 8);
        const foliageMat = new THREE.MeshStandardMaterial({ color: 0x0a2e18, roughness: 0.8 });

        for (let z = 10; z > -420; z -= 24) {
            [-18, 18].forEach(xPos => {
                const tree = new THREE.Group();
                const trunk = new THREE.Mesh(trunkGeo, trunkMat);
                trunk.position.y = 1.75;
                tree.add(trunk);

                const foliage = new THREE.Mesh(foliageGeo, foliageMat);
                foliage.position.y = 5.0;
                tree.add(foliage);

                tree.position.set(xPos + (Math.random() - 0.5) * 2, 0, z);
                this.roadsideTreesGroup.add(tree);
            });
        }
        this.scene.add(this.roadsideTreesGroup);

        // City Skyline
        this.citySkylineGroup = new THREE.Group();
        const buildingMat = new THREE.MeshStandardMaterial({ color: 0x1a1d28, roughness: 0.7 });
        for (let z = 0; z > -420; z -= 40) {
            [-45, 45].forEach(xPos => {
                const height = 15 + Math.random() * 25;
                const width = 10 + Math.random() * 8;
                const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, width), buildingMat);
                building.position.set(xPos, height / 2, z);
                this.citySkylineGroup.add(building);
            });
        }
        this.scene.add(this.citySkylineGroup);
    }

    buildPlayer3DCar() {
        if (this.playerCarGroup) this.scene.remove(this.playerCarGroup);

        this.playerCarGroup = new THREE.Group();

        const carMat = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            shininess: 90,
            specular: 0x666666
        });
        const darkTrimMat = new THREE.MeshBasicMaterial({ color: 0x11121c });
        const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.95, roughness: 0.1 });
        const glassMat = new THREE.MeshPhongMaterial({
            color: 0x080915,
            shininess: 100,
            transparent: true,
            opacity: 0.88
        });

        // Dynamic Neon Underglow Light
        const underglowHex = parseInt((this.player.underglowColor || '#00f0ff').replace('#', '0x'));
        this.underglowLight = new THREE.PointLight(underglowHex, 2.8, 7);
        this.underglowLight.position.set(0, 0.15, 0);
        this.playerCarGroup.add(this.underglowLight);

        this.taillights = [];
        this.brakeLightMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });

        // ==========================================
        // ULTRA-DETAILED PEUGEOT PARS ELX 3D MODEL
        // ==========================================
        // Main Body Frame
        const bodyGeo = new THREE.BoxGeometry(1.82, 0.48, 4.05);
        const bodyMesh = new THREE.Mesh(bodyGeo, carMat);
        bodyMesh.position.y = 0.44;
        this.playerCarGroup.add(bodyMesh);

        // Sloped Hood / Bonnet (کاپوت شیب‌دار پارس)
        const bonnetGeo = new THREE.BoxGeometry(1.78, 0.12, 1.25);
        bonnetGeo.rotateX(0.06);
        const bonnetMesh = new THREE.Mesh(bonnetGeo, carMat);
        bonnetMesh.position.set(0, 0.62, -1.35);
        this.playerCarGroup.add(bonnetMesh);

        // Cabin Glass & Roof Frame
        const cabinGeo = new THREE.BoxGeometry(1.48, 0.52, 2.05);
        const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
        cabinMesh.position.set(0, 0.9, -0.1);
        this.playerCarGroup.add(cabinMesh);

        const roofGeo = new THREE.BoxGeometry(1.38, 0.08, 1.35);
        const roofMesh = new THREE.Mesh(roofGeo, carMat);
        roofMesh.position.set(0, 1.16, -0.1);
        this.playerCarGroup.add(roofMesh);

        // Side Door Protective Rubber Moldings (زه مشکی بغل درها)
        const sideMoldingGeo = new THREE.BoxGeometry(1.86, 0.08, 2.8);
        const sideMolding = new THREE.Mesh(sideMoldingGeo, darkTrimMat);
        sideMolding.position.set(0, 0.42, -0.1);
        this.playerCarGroup.add(sideMolding);

        // Crystal Headlights (چراغ‌های کریستالی جلو)
        const headGeo = new THREE.BoxGeometry(0.38, 0.16, 0.08);
        const crystalHeadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9, roughness: 0.1 });
        [-0.62, 0.62].forEach(x => {
            const hl = new THREE.Mesh(headGeo, crystalHeadMat);
            hl.position.set(x, 0.52, -2.01);
            this.playerCarGroup.add(hl);
        });

        // Center Peugeot Chrome Lion Emblem Badge (آرم شیر پژو)
        const grilleBadgeGeo = new THREE.BoxGeometry(0.18, 0.12, 0.08);
        const grilleBadge = new THREE.Mesh(grilleBadgeGeo, chromeMat);
        grilleBadge.position.set(0, 0.52, -2.02);
        this.playerCarGroup.add(grilleBadge);

        // ELX Smoked Taillights (چراغ‌های دودی عقب ELX)
        const tailGeo = new THREE.BoxGeometry(0.48, 0.22, 0.08);
        [-0.58, 0.58].forEach(x => {
            const tl = new THREE.Mesh(tailGeo, this.brakeLightMat);
            tl.position.set(x, 0.54, 2.03);
            this.playerCarGroup.add(tl);
            this.taillights.push(tl);
        });

        // Iranian License Plate (پلاک ایران ۶۶)
        const plateGeo = new THREE.BoxGeometry(0.45, 0.14, 0.06);
        const plateMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const plate = new THREE.Mesh(plateGeo, plateMat);
        plate.position.set(0, 0.42, 2.04);
        this.playerCarGroup.add(plate);

        // Dual Chrome Exhaust Pipes (اگزوز دوبل شوتی)
        const exhaustGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.35, 12);
        exhaustGeo.rotateX(Math.PI / 2);
        const exhaustL = new THREE.Mesh(exhaustGeo, chromeMat);
        exhaustL.position.set(-0.35, 0.28, 2.08);
        const exhaustR = new THREE.Mesh(exhaustGeo, chromeMat);
        exhaustR.position.set(-0.22, 0.28, 2.08);
        this.playerCarGroup.add(exhaustL);
        this.playerCarGroup.add(exhaustR);

        // Interior Cockpit Group
        this.cockpitGroup = new THREE.Group();

        // Dashboard Console Frame & Walnut Wood Trim
        const dashGeo = new THREE.BoxGeometry(1.48, 0.48, 0.72);
        const dashMat = new THREE.MeshStandardMaterial({ color: 0x181a22, roughness: 0.85, metalness: 0.1 });
        const dashboard = new THREE.Mesh(dashGeo, dashMat);
        dashboard.position.set(0, 0.85, -0.45);
        this.cockpitGroup.add(dashboard);

        const woodTrimGeo = new THREE.BoxGeometry(1.46, 0.08, 0.73);
        const woodTrimMat = new THREE.MeshStandardMaterial({ color: 0x663311, roughness: 0.4, metalness: 0.2 });
        const woodTrim = new THREE.Mesh(woodTrimGeo, woodTrimMat);
        woodTrim.position.set(0, 0.74, -0.45);
        this.cockpitGroup.add(woodTrim);

        // Peugeot 3-Spoke Leather Steering Wheel
        const wheelRingGeo = new THREE.TorusGeometry(0.24, 0.035, 16, 32);
        const wheelHubGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.05, 20);
        wheelHubGeo.rotateX(Math.PI / 2);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111218, roughness: 0.7 });
        const logoMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, metalness: 0.95, roughness: 0.05 });

        this.steeringWheel = new THREE.Group();
        const ringMesh = new THREE.Mesh(wheelRingGeo, wheelMat);
        const hubMesh = new THREE.Mesh(wheelHubGeo, wheelMat);
        const logoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.065), logoMat);

        const spokeGeo = new THREE.BoxGeometry(0.04, 0.18, 0.03);
        const spokeL = new THREE.Mesh(spokeGeo, wheelMat);
        spokeL.position.set(-0.11, -0.06, 0);
        spokeL.rotation.z = 0.7;
        const spokeR = new THREE.Mesh(spokeGeo, wheelMat);
        spokeR.position.set(0.11, -0.06, 0);
        spokeR.rotation.z = -0.7;
        const spokeB = new THREE.Mesh(spokeGeo, wheelMat);
        spokeB.position.set(0, -0.14, 0);

        this.steeringWheel.add(ringMesh);
        this.steeringWheel.add(hubMesh);
        this.steeringWheel.add(logoMesh);
        this.steeringWheel.add(spokeL);
        this.steeringWheel.add(spokeR);
        this.steeringWheel.add(spokeB);

        this.steeringWheel.position.set(-0.35, 0.96, 0.02);
        this.steeringWheel.rotation.x = -0.3;
        this.cockpitGroup.add(this.steeringWheel);

        this.playerCarGroup.add(this.cockpitGroup);

        // Sport Alloy Wheels
        const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.35, 20);
        const tireMat = new THREE.MeshStandardMaterial({ color: 0x111115, roughness: 0.8 });
        const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.36, 12);
        const rimMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, metalness: 0.95, roughness: 0.08 });

        wheelGeo.rotateZ(Math.PI / 2);
        rimGeo.rotateZ(Math.PI / 2);

        [[-0.95, 0.38, 1.2], [0.95, 0.38, 1.2], [-0.95, 0.38, -1.2], [0.95, 0.38, -1.2]].forEach(pos => {
            const tire = new THREE.Mesh(wheelGeo, tireMat);
            const rim = new THREE.Mesh(rimGeo, rimMat);
            tire.position.set(pos[0], pos[1], pos[2]);
            rim.position.set(pos[0], pos[1], pos[2]);
            this.playerCarGroup.add(tire);
            this.playerCarGroup.add(rim);
        });

        // Iranian Rear Window Sticker
        if (this.player.sticker && this.player.sticker !== 'NONE') {
            const stickerBadgeGeo = new THREE.BoxGeometry(0.85, 0.18, 0.05);
            let stickerColor = 0xffea00;
            if (this.player.sticker === 'SHOOTI') stickerColor = 0xff0055;
            if (this.player.sticker === 'SALAR') stickerColor = 0x00f0ff;

            const stickerMat = new THREE.MeshBasicMaterial({ color: stickerColor });
            const stickerMesh = new THREE.Mesh(stickerBadgeGeo, stickerMat);
            stickerMesh.position.set(0, 0.92, 0.85);
            stickerMesh.rotation.x = -0.3;
            this.playerCarGroup.add(stickerMesh);
        }

        // 3D Shield Energy Bubble
        const shieldGeo = new THREE.SphereGeometry(2.3, 32, 32);
        const shieldMat = new THREE.MeshStandardMaterial({
            color: 0x00ff88,
            emissive: 0x00ff66,
            emissiveIntensity: 0.6,
            roughness: 0.1,
            metalness: 0.2,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide
        });
        this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
        this.shieldMesh.position.set(0, 0.7, 0);
        this.shieldMesh.visible = false;
        this.playerCarGroup.add(this.shieldMesh);

        // Stance Setup (SHOOTI vs LOW vs NORMAL)
        if (this.player.stance === 'SHOOTI') {
            this.playerCarGroup.rotation.x = -0.06;
            this.playerCarGroup.position.y = 0.22;
        } else if (this.player.stance === 'LOW') {
            this.playerCarGroup.position.y = -0.12;
            this.playerCarGroup.rotation.x = 0;
        } else {
            this.playerCarGroup.position.y = 0;
            this.playerCarGroup.rotation.x = 0;
        }

        this.playerCarGroup.position.x = this.laneX[this.currentLane];
        this.scene.add(this.playerCarGroup);
    }

    setupEvents() {
        window.addEventListener('resize', () => this.onWindowResize());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.onWindowResize(), 150);
        });

        window.addEventListener('keydown', (e) => {
            if (e.repeat) return;
            this.keys[e.code] = true;
            if (e.code === 'KeyP' || e.code === 'Escape') this.togglePause();
            if (e.code === 'KeyC') this.toggleCameraMode();
            if (e.code === 'KeyR') this.cycleRadioStation();

            if (this.state === 'PLAYING' && !this.player.isSpinning) {
                if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.moveLane(-1);
                else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.moveLane(1);
                else if (e.code === 'Space') this.activateNitro();
            }
        });

        window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

        const unlockAudio = () => { if (window.audioMgr) window.audioMgr.init(); };
        window.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
        window.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });
        window.addEventListener('click', unlockAudio, { once: true, passive: true });

        const addClick = (id, fn) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', fn);
        };

        addClick('camera-btn', () => this.toggleCameraMode());
        addClick('radio-btn', () => this.cycleRadioStation());
        addClick('screenshot-btn', () => this.takeScreenshot());
        addClick('btn-menu-screenshot', () => this.takeScreenshot());
        addClick('btn-gameover-screenshot', () => this.takeScreenshot());
        addClick('pause-btn', () => this.togglePause());

        addClick('btn-start', () => { audioMgr.init(); this.startGame(); });
        addClick('btn-restart', () => { this.startGame(); });
        addClick('btn-resume', () => { this.togglePause(); });
        addClick('btn-pause-menu', () => {
            this.state = 'MENU';
            if (this.uiPause) this.uiPause.classList.add('hidden');
            if (this.uiMenu) this.uiMenu.classList.remove('hidden');
        });

        // Touch Controls Helper
        const bindTouchButton = (btnId, onPress, onRelease) => {
            const btn = document.getElementById(btnId);
            if (!btn) return;

            const handlePress = (e) => {
                if (e.cancelable) e.preventDefault();
                btn.classList.add('active');
                if (onPress) onPress();
            };

            const handleRelease = (e) => {
                btn.classList.remove('active');
                if (onRelease) onRelease();
            };

            btn.addEventListener('touchstart', handlePress, { passive: false });
            btn.addEventListener('touchend', handleRelease);
            btn.addEventListener('touchcancel', handleRelease);
            btn.addEventListener('mousedown', handlePress);
            btn.addEventListener('mouseup', handleRelease);
            btn.addEventListener('mouseleave', handleRelease);
        };

        bindTouchButton('btn-left', () => this.moveLane(-1), null);
        bindTouchButton('btn-right', () => this.moveLane(1), null);
        bindTouchButton('btn-nitro', () => this.activateNitro(), null);
        bindTouchButton('btn-gas', () => { this.isGasPressed = true; }, () => { this.isGasPressed = false; });
        bindTouchButton('btn-brake', () => { this.isBrakePressed = true; }, () => { this.isBrakePressed = false; });

        // Touch Swipe
        let touchStartX = 0;
        let touchStartY = 0;
        window.addEventListener('touchstart', (e) => {
            if (e.target.closest('#touch-controls, .overlay-screen, button, input, .modal-card')) return;
            if (e.changedTouches && e.changedTouches[0]) {
                touchStartX = e.changedTouches[0].clientX;
                touchStartY = e.changedTouches[0].clientY;
            }
        }, { passive: true });

        window.addEventListener('touchend', (e) => {
            if (this.state !== 'PLAYING') return;
            if (e.target.closest('#touch-controls, .overlay-screen, button, input, .modal-card')) return;
            if (e.changedTouches && e.changedTouches[0]) {
                const diffX = e.changedTouches[0].clientX - touchStartX;
                const diffY = e.changedTouches[0].clientY - touchStartY;
                if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
                    if (diffX < 0) this.moveLane(-1);
                    else this.moveLane(1);
                }
            }
        }, { passive: true });
    }

    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        if (this.camera && this.renderer) {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        }
    }

    moveLane(direction) {
        if (this.state !== 'PLAYING' || this.player.isSpinning) return;
        const newLane = this.targetLane + direction;
        if (newLane >= 0 && newLane <= 4) {
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

    toggleCameraMode() {
        const modes = ['CHASE', 'COCKPIT', 'HOOD'];
        const nextIdx = (modes.indexOf(this.cameraMode) + 1) % modes.length;
        this.cameraMode = modes[nextIdx];
        localStorage.setItem('neon_cammode', this.cameraMode);

        const names = {
            'COCKPIT': '🎥 نمای داخل کابین (پشت فرمان پارس)',
            'CHASE': '🏎️ نمای بیرون (تعقیب دید کامل)',
            'HOOD': '💨 نمای روی کاپوت (سرعت هیجانی)'
        };

        this.addFloatingText(names[this.cameraMode], this.canvas.width / 2, 160, '#00f0ff');
        audioMgr.playCoin();
    }

    takeScreenshot() {
        this.render();
        try {
            const dataURL = this.canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `Sultan_3D_Screenshot_${Date.now()}.png`;
            link.href = dataURL;
            link.click();
            this.addFloatingText('📸 اسکرین‌شات با موفقیت ذخیره شد!', this.canvas.width / 2, 160, '#00f0ff');
            audioMgr.playCoin();
        } catch (e) {
            console.error(e);
        }
    }

    cycleRadioStation() {
        const stationName = audioMgr.nextRadioStation();
        const radioBtn = document.getElementById('radio-btn');
        if (radioBtn) radioBtn.innerText = stationName;
        this.addFloatingText('🎵 رادیو: ' + stationName, this.canvas.width / 2, 160, '#ffaa00');
        audioMgr.playCoin();
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

        // Clear Obstacles
        this.obstacles.forEach(o => this.scene.remove(o.mesh));
        this.collectibles.forEach(c => this.scene.remove(c.mesh));
        this.obstacles = [];
        this.collectibles = [];

        this.buildPlayer3DCar();

        // Snap camera position for start
        if (this.camera) {
            if (this.cameraMode === 'COCKPIT') {
                this.camera.position.set(this.player.x - 0.35, 1.02, 0.12);
                this.camera.lookAt(this.player.x - 0.35, 0.95, -40.0);
            } else if (this.cameraMode === 'HOOD') {
                this.camera.position.set(this.player.x, 0.82, -1.25);
                this.camera.lookAt(this.player.x, 0.78, -40.0);
            } else {
                this.camera.position.set(this.player.x, 2.15, 5.4);
                this.camera.lookAt(this.player.x, 0.95, -40.0);
            }
        }

        if (this.uiMenu) this.uiMenu.classList.add('hidden');
        if (this.uiPause) this.uiPause.classList.add('hidden');
        if (this.uiGameOver) this.uiGameOver.classList.add('hidden');

        audioMgr.init();
    }

    togglePause() {
        if (this.state === 'PLAYING') {
            this.state = 'PAUSED';
            if (this.uiPause) this.uiPause.classList.remove('hidden');
        } else if (this.state === 'PAUSED') {
            this.state = 'PLAYING';
            if (this.uiPause) this.uiPause.classList.add('hidden');
        }
    }

    gameOver(reason = 'تصادف شدید در آزادراه') {
        this.state = 'GAMEOVER';
        audioMgr.playCrash();

        if (this.score > this.highScore) {
            this.highScore = Math.floor(this.score);
            localStorage.setItem('neon_highscore', this.highScore.toString());
        }
        localStorage.setItem('neon_coins', this.coins.toString());

        const rEl = document.getElementById('gameover-reason');
        const sEl = document.getElementById('final-score');
        const cEl = document.getElementById('final-coins');
        const dEl = document.getElementById('final-dist');
        const hEl = document.getElementById('final-highscore');

        if (rEl) rEl.innerText = reason;
        if (sEl) sEl.innerText = Math.floor(this.score).toLocaleString('fa-IR');
        if (cEl) cEl.innerText = this.coins.toLocaleString('fa-IR');
        if (dEl) dEl.innerText = Math.floor(this.distance) + ' متر';
        if (hEl) hEl.innerText = this.highScore.toLocaleString('fa-IR');

        setTimeout(() => {
            if (this.uiGameOver) this.uiGameOver.classList.remove('hidden');
        }, 800);
    }

    loop(timestamp) {
        const delta = timestamp - this.lastFrameTime;

        if (delta >= 16.6) {
            const dt = Math.min(delta / 1000, 0.1);
            this.lastFrameTime = timestamp;

            if (this.state === 'PLAYING') {
                this.update(dt);
            } else {
                this.updateGarageOrbit(dt);
            }

            this.render();
        }

        requestAnimationFrame((t) => this.loop(t));
    }

    updateGarageOrbit(dt) {
        if (!this.playerCarGroup) {
            this.buildPlayer3DCar();
            return;
        }

        if (this.cockpitGroup) this.cockpitGroup.visible = false;

        this.menuOrbitAngle = (this.menuOrbitAngle || 0) + dt * 0.45;

        // Front-Quarter Showcase Orbit (Peugeot Pars is ALWAYS 100% visible)
        const camX = Math.sin(this.menuOrbitAngle) * 3.8;
        const camZ = 3.8 + Math.cos(this.menuOrbitAngle) * 1.8;

        this.camera.position.set(this.player.x + camX, 1.35, camZ);
        this.camera.lookAt(this.player.x, 0.55, 0.2);

        this.updateTopBarHUD();
    }

    update3DCamera(dt) {
        if (!this.camera) return;

        const isGasPressed = this.isGasPressed || this.keys['ArrowUp'] || this.keys['KeyW'];
        const isBrakePressed = this.isBrakePressed || this.keys['ArrowDown'] || this.keys['KeyS'];

        const targetPitchOffset = isGasPressed ? -0.08 : (isBrakePressed ? 0.12 : 0.0);
        this.cameraPitchOffset = THREE.MathUtils.lerp(this.cameraPitchOffset || 0, targetPitchOffset, dt * 10.0);

        const targetX = this.laneX[this.targetLane];
        const diffX = targetX - this.player.x;

        this.camera.up.set(0, 1, 0);

        if (this.cameraMode === 'COCKPIT') {
            if (this.cockpitGroup) this.cockpitGroup.visible = true;

            const targetCamX = this.player.x - 0.35;
            const targetCamY = 1.02;
            const targetCamZ = 0.12;

            this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetCamX, dt * 20.0);
            this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetCamY, dt * 20.0);
            this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetCamZ, dt * 20.0);

            this.camera.lookAt(this.camera.position.x, 0.95 + this.cameraPitchOffset, -40.0);

            if (this.steeringWheel) {
                this.steeringWheel.rotation.z = -diffX * 0.85;
            }
        } else if (this.cameraMode === 'HOOD') {
            if (this.cockpitGroup) this.cockpitGroup.visible = false;

            const targetCamX = this.player.x;
            const targetCamY = 0.82;
            const targetCamZ = -1.25;

            this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetCamX, dt * 20.0);
            this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetCamY, dt * 20.0);
            this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetCamZ, dt * 20.0);

            this.camera.lookAt(this.camera.position.x, 0.78 + this.cameraPitchOffset, -40.0);
        } else {
            if (this.cockpitGroup) this.cockpitGroup.visible = false;

            const targetCamX = this.player.x;
            const targetCamY = 2.15;
            const targetCamZ = 5.4;

            this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetCamX, dt * 18.0);
            this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetCamY, dt * 18.0);
            this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetCamZ, dt * 18.0);

            this.camera.lookAt(this.camera.position.x, 0.95 + this.cameraPitchOffset, -40.0);
        }
    }

    updateTopBarHUD() {
        const menuCoins = document.getElementById('menu-coins');
        const menuHighscore = document.getElementById('menu-highscore');
        const carNameEl = document.getElementById('menu-selected-car-name');

        if (menuCoins) menuCoins.innerText = '🪙 ' + this.coins.toLocaleString('fa-IR');
        if (menuHighscore) menuHighscore.innerText = '🏆 ' + this.highScore.toLocaleString('fa-IR');
        if (carNameEl) carNameEl.innerText = 'پژو پارس ELX HD (شوتی سلطان)';
    }

    update(dt) {
        // Speed Physics
        let targetSpeed = this.baseSpeed;
        const isGasPressed = this.isGasPressed || this.keys['ArrowUp'] || this.keys['KeyW'];
        const isBrakePressed = this.isBrakePressed || this.keys['ArrowDown'] || this.keys['KeyS'];

        if (this.player.isNitroActive) {
            targetSpeed = 32.0;
            this.speed += (targetSpeed - this.speed) * dt * 5.0;
            this.player.nitroTime--;
            this.player.nitroGauge = Math.max(0, (this.player.nitroTime / 180) * 100);

            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 72, 0.1);
            this.camera.updateProjectionMatrix();

            if (this.player.nitroTime <= 0) this.player.isNitroActive = false;
        } else {
            this.baseSpeed = Math.min(16.0, this.baseSpeed + dt * 0.03);
            let accelRate = 1.8;
            if (isGasPressed) {
                targetSpeed = 24.0;
                accelRate = 2.4;
            } else if (isBrakePressed) {
                targetSpeed = 4.5;
                accelRate = 4.5;
            } else {
                targetSpeed = this.baseSpeed;
                accelRate = 1.8;
            }

            this.speed += (targetSpeed - this.speed) * dt * accelRate;
            const targetFov = 58 + (this.speed / 30) * 12;
            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 0.08);
            this.camera.updateProjectionMatrix();

            if (this.player.nitroGauge < 100) {
                this.player.nitroGauge = Math.min(100, this.player.nitroGauge + 0.15);
            }
        }

        // Taillights Glow
        if (this.taillights) {
            const glowColor = isBrakePressed ? 0xff0000 : 0x990022;
            this.taillights.forEach(l => l.material.color.setHex(glowColor));
        }

        audioMgr.updateEnginePitch(this.speed / 32.0);

        this.distance += (this.speed * dt * 2.5);
        this.score += (this.speed * dt * 10);

        // Animate Road Dividers
        this.laneLinesGroup.children.forEach(line => {
            line.position.z += this.speed * dt * 10.0;
            if (line.position.z > 15) line.position.z -= 410;
        });

        // Animate Scenery
        if (this.streetLightsGroup) {
            this.streetLightsGroup.children.forEach(pole => {
                pole.position.z += this.speed * dt * 10.0;
                if (pole.position.z > 20) pole.position.z -= 440;
            });
        }

        if (this.roadsideTreesGroup) {
            this.roadsideTreesGroup.children.forEach(tree => {
                tree.position.z += this.speed * dt * 10.0;
                if (tree.position.z > 20) tree.position.z -= 440;
            });
        }

        // Smooth Player Lane Lerping
        const targetX = this.laneX[this.targetLane];
        const diffX = targetX - this.player.x;
        this.player.x += diffX * 0.18;
        this.player.tilt = -diffX * 0.05;

        // Update Car Group Position
        if (this.playerCarGroup) {
            this.playerCarGroup.position.x = this.player.x;
            this.playerCarGroup.rotation.y = this.player.spinAngle;
            this.playerCarGroup.rotation.z = this.player.tilt;
        }

        if (this.shieldMesh) this.shieldMesh.visible = this.player.hasShield;

        // Update Camera
        this.update3DCamera(dt);

        // Spawn Obstacles & Items
        const now = performance.now();
        if (now - this.lastSpawnTime > Math.max(700, 2200 - (this.distance * 0.3))) {
            this.spawn3DObstacle();
            this.lastSpawnTime = now;
        }

        if (now - this.lastCollectibleTime > 1100) {
            this.spawn3DCollectible();
            this.lastCollectibleTime = now;
        }

        // Update Obstacles
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obs = this.obstacles[i];
            obs.z += (this.speed - obs.speed) * dt * 10.0;
            obs.mesh.position.z = obs.z;

            // Collision Check
            if (Math.abs(obs.z - 0) < 2.0 && Math.abs(obs.x - this.player.x) < 1.4) {
                if (this.player.hasShield) {
                    this.player.hasShield = false;
                    audioMgr.playCrash();
                    this.scene.remove(obs.mesh);
                    this.obstacles.splice(i, 1);
                    this.addFloatingText('🛡️ سپر شکست!', this.canvas.width / 2, 180, '#00ff66');
                } else {
                    this.gameOver('تصادف شدید با خودرو در آزادراه!');
                    return;
                }
            } else if (obs.z > 25) {
                this.scene.remove(obs.mesh);
                this.obstacles.splice(i, 1);
            }
        }

        // Update Collectibles
        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const item = this.collectibles[i];
            item.z += this.speed * dt * 10.0;
            item.mesh.position.z = item.z;
            item.mesh.rotation.y += dt * 3.0;

            if (Math.abs(item.z - 0) < 1.8 && Math.abs(item.x - this.player.x) < 1.4) {
                if (item.type === 'coin') {
                    this.coins += 10;
                    audioMgr.playCoin();
                    this.addFloatingText('+۱۰ 🪙', this.canvas.width / 2, 200, '#ffea00');
                } else if (item.type === 'shield') {
                    this.player.hasShield = true;
                    audioMgr.playCoin();
                    this.addFloatingText('🛡️ سپر فعال شد!', this.canvas.width / 2, 200, '#00ff66');
                }
                this.scene.remove(item.mesh);
                this.collectibles.splice(i, 1);
                this.updateHUD();
            } else if (item.z > 25) {
                this.scene.remove(item.mesh);
                this.collectibles.splice(i, 1);
            }
        }

        this.updateHUD();
    }

    spawn3DObstacle() {
        const lane = Math.floor(Math.random() * 5);
        const obstacleTypes = [
            { type: 'truck', color: 0xaa2222, speed: 6, scaleZ: 4.5 },
            { type: 'car', color: 0x22aa55, speed: 8, scaleZ: 3.8 },
            { type: 'sedan', color: 0x5555aa, speed: 7, scaleZ: 3.9 }
        ];

        const selected = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
        const meshGroup = new THREE.Group();

        const bodyGeo = new THREE.BoxGeometry(1.8, 0.7, selected.scaleZ);
        const bodyMat = new THREE.MeshStandardMaterial({ color: selected.color, metalness: 0.5, roughness: 0.3 });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.position.y = 0.5;
        meshGroup.add(bodyMesh);

        const glassGeo = new THREE.BoxGeometry(1.4, 0.5, 1.8);
        const glassMat = new THREE.MeshStandardMaterial({ color: 0x050710, metalness: 0.9, roughness: 0.1 });
        const glassMesh = new THREE.Mesh(glassGeo, glassMat);
        glassMesh.position.set(0, 0.9, 0.1);
        meshGroup.add(glassMesh);

        meshGroup.position.set(this.laneX[lane], 0, -220);
        this.scene.add(meshGroup);

        this.obstacles.push({
            type: selected.type,
            x: this.laneX[lane],
            z: -220,
            speed: selected.speed,
            mesh: meshGroup
        });
    }

    spawn3DCollectible() {
        const lane = Math.floor(Math.random() * 5);
        const rand = Math.random();

        let type = 'coin';
        let color = 0xffea00;
        let geo = new THREE.CylinderGeometry(0.5, 0.5, 0.12, 16);

        if (rand > 0.85) {
            type = 'shield';
            color = 0x00ff66;
            geo = new THREE.IcosahedronGeometry(0.6, 1);
        }

        geo.rotateX(Math.PI / 2);
        const mat = new THREE.MeshStandardMaterial({ color: color, metalness: 0.8, roughness: 0.2 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(this.laneX[lane], 0.7, -220);
        this.scene.add(mesh);

        this.collectibles.push({
            type: type,
            x: this.laneX[lane],
            z: -220,
            mesh: mesh
        });
    }

    addFloatingText(text, x, y, color) {
        this.floatingTexts.push({ text: text, x: x, y: y, color: color, alpha: 1 });
    }

    updateHUD() {
        const speedKmh = Math.floor(this.speed * 9.5);
        if (this.hudScore) this.hudScore.innerText = Math.floor(this.score).toLocaleString('fa-IR');
        if (this.hudCoins) this.hudCoins.innerText = this.coins.toLocaleString('fa-IR');
        if (this.hudSpeed) this.hudSpeed.innerText = speedKmh + ' km/h';
        if (this.hudDistance) this.hudDistance.innerText = Math.floor(this.distance) + ' m';

        if (this.powerupBar) {
            this.powerupBar.innerHTML = '';
            if (this.player.hasShield) this.powerupBar.innerHTML += `<div class="powerup-badge" style="border-color:#00ff66;">🛡️ سپر فعال</div>`;
            if (this.player.isNitroActive) this.powerupBar.innerHTML += `<div class="powerup-badge" style="border-color:#ffea00;">⚡ نیترو فعال!</div>`;
        }
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}

function bootGameEngine() {
    if (!window.game) {
        window.game = new Game3D();
    }
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(bootGameEngine, 1);
} else {
    window.addEventListener('DOMContentLoaded', bootGameEngine);
}
