/**
 * سلطان جاده ۳بعدی (Iranian Highway Legend 3D)
 * Real 3D Iranian Car Physics Engine & First-Person Peugeot Pars Cockpit
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
        this.cameraMode = localStorage.getItem('neon_cammode') || 'COCKPIT'; // COCKPIT, CHASE, HOOD
        
        // Game Stats
        this.score = 0;
        this.coins = parseInt(localStorage.getItem('neon_coins') || '0');
        this.highScore = parseInt(localStorage.getItem('neon_highscore') || '0');
        this.distance = 0;
        this.speed = 11;
        this.baseSpeed = 11;
        this.maxSpeed = 32;
        this.timeRemaining = 30;

        // 5-Lane 3D Highway Coordinates (X-axis: Far Left, Inner Left, Center, Inner Right, Far Right)
        this.laneX = [-7.2, -3.6, 0.0, 3.6, 7.2];
        this.currentLane = 2; // Center Lane (Lane 2)
        this.targetLane = 2;

        // Player Stats & Iranian Tuning Properties
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
            stance: localStorage.getItem('neon_stance') || 'SHOOTI', // SHOOTI, LOW, NORMAL
            sticker: localStorage.getItem('neon_sticker') || 'SOLTAN', // SOLTAN, SHOOTI, SALAR, NONE
            hasShield: false,
            hasMagnet: false,
            magnetTime: 0,
            nitroGauge: 100,
            isNitroActive: false,
            nitroTime: 0
        };

        // Iconic Iranian & JDM Car Garage Fleet
        this.carGarage = [
            { id: 0, name: 'پژو پارس ELX (شوتی سلطان)', color: 0xffffff, secondary: 0x111111, price: 0, stat: 'سلطان جاده - شتاب شوتی', modelType: 'PARS' },
            { id: 1, name: 'زانتیا ۲۰۰۰ (تنظیم هیدرولیک)', color: 0x2233aa, secondary: 0x111111, price: 120, stat: 'شتاب فوق‌العاده زانتیا', modelType: 'XANTIA' },
            { id: 2, name: 'پیکان جوانان (گوجه‌ای نوستالژیک)', color: 0xcc0000, secondary: 0xdddddd, price: 200, stat: 'کلاسیک محبوب ایرانی', modelType: 'PEYKAN' },
            { id: 3, name: 'پراید ۱۱۱ (اسپرت کف‌خواب)', color: 0x0088ff, secondary: 0x111111, price: 300, stat: 'فرمان‌دهی بسیار سریع', modelType: 'PRIDE' },
            { id: 4, name: 'پژو ۲۰۶ تیپ ۵ (GT اسپرت)', color: 0xcccccc, secondary: 0xff0055, price: 450, stat: 'شتاب توربو و باله عقب GT', modelType: 'P206' },
            { id: 5, name: 'سمند سورن توربو (مشکی سالار)', color: 0x11121c, secondary: 0x00f0ff, price: 600, stat: 'ملی توربو - بدنه مقاوم', modelType: 'SOREN' },
            { id: 6, name: 'تویوتا سوپرا (JDM King)', color: 0xff5500, secondary: 0x222222, price: 800, stat: 'افسانه‌ای JDM 2JZ', modelType: 'SUPRA' }
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
        return 0;
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
    // THREE.JS 3D ENGINE INITIALIZATION (Photorealistic Environment)
    // ==========================================
    initThreeJS() {
        // 1. Scene & Natural Atmospheric Sky Fog (Realistic Daylight/Dusk Horizon)
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x7090b4);
        this.scene.fog = new THREE.FogExp2(0x7090b4, 0.0035);

        // 2. Camera
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 1.08, 0.1);
        this.camera.lookAt(0, 0.98, -40);

        // 3. WebGL Renderer with Realistic Shading
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            powerPreference: "high-performance",
            precision: "mediump"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(1.0);

        // 4. Natural Daylight Sunlight & Sky Hemisphere Lighting
        const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x443322, 0.65);
        this.scene.add(hemiLight);

        const sunLight = new THREE.DirectionalLight(0xfffaeb, 1.25);
        sunLight.position.set(50, 80, -40);
        this.scene.add(sunLight);

        // 5. Realistic 5-Lane Highway Charcoal Asphalt Road
        const roadGeo = new THREE.PlaneGeometry(24, 600);
        const roadMat = new THREE.MeshStandardMaterial({
            color: 0x2a2c36,
            roughness: 0.8,
            metalness: 0.1
        });
        this.roadMesh = new THREE.Mesh(roadGeo, roadMat);
        this.roadMesh.rotation.x = -Math.PI / 2;
        this.roadMesh.position.z = -200;
        this.scene.add(this.roadMesh);

        // Realistic Roadside Soil Terrain (Khaki / Soil Ground)
        const terrainMat = new THREE.MeshStandardMaterial({ color: 0x444034, roughness: 0.95 });
        const leftTerrainGeo = new THREE.PlaneGeometry(160, 600);
        const leftTerrain = new THREE.Mesh(leftTerrainGeo, terrainMat);
        leftTerrain.rotation.x = -Math.PI / 2;
        leftTerrain.position.set(-92, -0.05, -200);
        this.scene.add(leftTerrain);

        const rightTerrainGeo = new THREE.PlaneGeometry(160, 600);
        const rightTerrain = new THREE.Mesh(rightTerrainGeo, terrainMat);
        rightTerrain.rotation.x = -Math.PI / 2;
        rightTerrain.position.set(92, -0.05, -200);
        this.scene.add(rightTerrain);

        // Solid Highway Yellow Shoulder Lines
        const edgeLineGeo = new THREE.BoxGeometry(0.25, 0.04, 600);
        const edgeLineMat = new THREE.MeshBasicMaterial({ color: 0xe6b800 });
        
        const leftEdge = new THREE.Mesh(edgeLineGeo, edgeLineMat);
        leftEdge.position.set(-10.8, 0.02, -200);
        this.scene.add(leftEdge);

        const rightEdge = new THREE.Mesh(edgeLineGeo, edgeLineMat);
        rightEdge.position.set(10.8, 0.02, -200);
        this.scene.add(rightEdge);

        // Realistic W-Beam Galvanized Steel Guardrails
        const guardrailMat = new THREE.MeshStandardMaterial({ color: 0x9fb1c2, metalness: 0.85, roughness: 0.25 });
        const railGeo = new THREE.BoxGeometry(0.2, 0.45, 600);

        const leftRail = new THREE.Mesh(railGeo, guardrailMat);
        leftRail.position.set(-11.4, 0.5, -200);
        this.scene.add(leftRail);

        const rightRail = new THREE.Mesh(railGeo, guardrailMat);
        rightRail.position.set(11.4, 0.5, -200);
        this.scene.add(rightRail);

        // Concrete Jersey Barriers (مانع نیوجرسی بتنی)
        const jerseyMat = new THREE.MeshStandardMaterial({ color: 0x80858e, roughness: 0.9 });
        const jerseyGeo = new THREE.BoxGeometry(0.4, 0.6, 600);

        const leftJersey = new THREE.Mesh(jerseyGeo, jerseyMat);
        leftJersey.position.set(-12.0, 0.3, -200);
        this.scene.add(leftJersey);

        const rightJersey = new THREE.Mesh(jerseyGeo, jerseyMat);
        rightJersey.position.set(12.0, 0.3, -200);
        this.scene.add(rightJersey);

        // Support Posts along Guardrails
        const postGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);
        for (let z = 10; z > -450; z -= 15) {
            const postL = new THREE.Mesh(postGeo, guardrailMat);
            postL.position.set(-11.4, 0.4, z);
            this.scene.add(postL);

            const postR = new THREE.Mesh(postGeo, guardrailMat);
            postR.position.set(11.4, 0.4, z);
            this.scene.add(postR);
        }

        // Realistic White Dashed Highway Lane Lines
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

        // 3D Street Lamp Poles with Warm Amber Downlights
        this.streetLightsGroup = new THREE.Group();
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x222533, metalness: 0.7, roughness: 0.3 });
        const lampLightMat = new THREE.MeshBasicMaterial({ color: 0xffcc44 });

        for (let z = 20; z > -420; z -= 35) {
            [-12.5, 12.5].forEach(xPos => {
                const poleGroup = new THREE.Group();
                const shaftGeo = new THREE.CylinderGeometry(0.12, 0.18, 7.0, 10);
                const shaft = new THREE.Mesh(shaftGeo, poleMat);
                shaft.position.y = 3.5;
                poleGroup.add(shaft);

                const armGeo = new THREE.BoxGeometry(1.8, 0.1, 0.1);
                const arm = new THREE.Mesh(armGeo, poleMat);
                const armDir = xPos < 0 ? 1 : -1;
                arm.position.set(armDir * 0.8, 6.8, 0);
                poleGroup.add(arm);

                const headGeo = new THREE.BoxGeometry(0.6, 0.15, 0.3);
                const head = new THREE.Mesh(headGeo, lampLightMat);
                head.position.set(armDir * 1.5, 6.7, 0);
                poleGroup.add(head);

                poleGroup.position.set(xPos, 0, z);
                this.streetLightsGroup.add(poleGroup);
            });
        }
        this.scene.add(this.streetLightsGroup);

        // 3D Roadside Trees
        this.roadsideTreesGroup = new THREE.Group();
        const trunkGeo = new THREE.CylinderGeometry(0.3, 0.45, 3.5, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.9 });
        const foliageGeo = new THREE.ConeGeometry(2.2, 5.0, 8);
        const foliageMat = new THREE.MeshStandardMaterial({ color: 0x0a2e18, roughness: 0.8 });

        for (let z = 10; z > -420; z -= 24) {
            [-17.0, 17.0].forEach(xPos => {
                const treeGroup = new THREE.Group();
                const trunk = new THREE.Mesh(trunkGeo, trunkMat);
                trunk.position.y = 1.75;
                const foliage = new THREE.Mesh(foliageGeo, foliageMat);
                foliage.position.y = 5.2;

                treeGroup.add(trunk);
                treeGroup.add(foliage);
                treeGroup.position.set(xPos + (Math.random() - 0.5) * 3, 0, z);
                this.roadsideTreesGroup.add(treeGroup);
            });
        }
        this.scene.add(this.roadsideTreesGroup);

        // 3D Overhead Iranian Highway Directional Gantries
        this.highwayGantriesGroup = new THREE.Group();
        const gantryMat = new THREE.MeshStandardMaterial({ color: 0x333748, metalness: 0.8, roughness: 0.2 });
        const gantrySignMat = new THREE.MeshStandardMaterial({ color: 0x006633, metalness: 0.3, roughness: 0.5 });

        [-120, -320].forEach(zPos => {
            const gantry = new THREE.Group();
            
            const towerGeo = new THREE.BoxGeometry(0.5, 9.0, 0.5);
            const towerL = new THREE.Mesh(towerGeo, gantryMat);
            towerL.position.set(-12.8, 4.5, 0);
            const towerR = new THREE.Mesh(towerGeo, gantryMat);
            towerR.position.set(12.8, 4.5, 0);
            gantry.add(towerL);
            gantry.add(towerR);

            const beamGeo = new THREE.BoxGeometry(26.0, 0.6, 0.6);
            const beam = new THREE.Mesh(beamGeo, gantryMat);
            beam.position.set(0, 8.8, 0);
            gantry.add(beam);

            const signGeo = new THREE.BoxGeometry(7.0, 2.2, 0.1);
            const signL = new THREE.Mesh(signGeo, gantrySignMat);
            signL.position.set(-4.5, 7.5, 0.3);
            const signR = new THREE.Mesh(signGeo, gantrySignMat);
            signR.position.set(4.5, 7.5, 0.3);
            gantry.add(signL);
            gantry.add(signR);

            gantry.position.z = zPos;
            this.highwayGantriesGroup.add(gantry);
        });
        this.scene.add(this.highwayGantriesGroup);

        // 3D City Horizon Skyscrapers
        this.buildCitySkyline();

        // Build Player 3D Car & First-Person Cockpit Interior
        this.buildPlayer3DCar();

        // 3D Rain Particle System
        this.init3DRain();
    }

    buildCitySkyline() {
        this.citySkylineGroup = new THREE.Group();
        const bldgMat = new THREE.MeshStandardMaterial({ color: 0x0c0e1e, roughness: 0.6, metalness: 0.4 });
        const windowColors = [0xffaa22, 0x00f0ff, 0xff0055, 0xffffff];

        for (let i = 0; i < 35; i++) {
            const width = 12 + Math.random() * 18;
            const height = 35 + Math.random() * 80;
            const depth = 15 + Math.random() * 20;

            const bldgGeo = new THREE.BoxGeometry(width, height, depth);
            const building = new THREE.Mesh(bldgGeo, bldgMat);

            const sideSign = (i % 2 === 0) ? 1 : -1;
            const posX = sideSign * (35 + Math.random() * 120);
            const posZ = -260 - Math.random() * 140;

            building.position.set(posX, height / 2 - 5, posZ);

            const winMat = new THREE.MeshBasicMaterial({ color: windowColors[i % windowColors.length] });
            const winGeo = new THREE.BoxGeometry(width * 0.7, height * 0.6, depth + 0.2);
            const winMesh = new THREE.Mesh(winGeo, winMat);
            building.add(winMesh);

            this.citySkylineGroup.add(building);
        }
        this.scene.add(this.citySkylineGroup);
    }

    buildPlayer3DCar() {
        if (this.playerCarGroup) this.scene.remove(this.playerCarGroup);

        const carData = this.carGarage[this.player.selectedCar] || this.carGarage[0];
        this.playerCarGroup = new THREE.Group();

        const carMat = new THREE.MeshPhongMaterial({
            color: carData.color,
            shininess: 90,
            specular: 0x777777
        });
        const darkTrimMat = new THREE.MeshBasicMaterial({ color: 0x11121c });
        const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.95, roughness: 0.1 });
        const glassMat = new THREE.MeshPhongMaterial({ color: 0x080915, shininess: 100, transparent: true, opacity: 0.9 });

        this.taillights = [];
        this.brakeLightMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });

        const modelType = carData.modelType || 'PARS';

        if (modelType === 'PEYKAN') {
            const bodyGeo = new THREE.BoxGeometry(1.75, 0.55, 3.8);
            const bodyMesh = new THREE.Mesh(bodyGeo, carMat);
            bodyMesh.position.y = 0.45;
            this.playerCarGroup.add(bodyMesh);

            const cabinGeo = new THREE.BoxGeometry(1.42, 0.52, 1.8);
            const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
            cabinMesh.position.set(0, 0.9, -0.1);
            this.playerCarGroup.add(cabinMesh);

            const roofGeo = new THREE.BoxGeometry(1.35, 0.08, 1.3);
            const roofMesh = new THREE.Mesh(roofGeo, carMat);
            roofMesh.position.set(0, 1.16, -0.1);
            this.playerCarGroup.add(roofMesh);

            const bumperGeo = new THREE.BoxGeometry(1.8, 0.14, 0.2);
            const bumperFront = new THREE.Mesh(bumperGeo, chromeMat);
            bumperFront.position.set(0, 0.32, -1.92);
            this.playerCarGroup.add(bumperFront);

            const bumperRear = new THREE.Mesh(bumperGeo, chromeMat);
            bumperRear.position.set(0, 0.32, 1.92);
            this.playerCarGroup.add(bumperRear);

            const roundHeadGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 16);
            roundHeadGeo.rotateX(Math.PI / 2);
            const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            [-0.65, -0.42, 0.42, 0.65].forEach(x => {
                const hl = new THREE.Mesh(roundHeadGeo, headMat);
                hl.position.set(x, 0.52, -1.91);
                this.playerCarGroup.add(hl);
            });

            const tailGeo = new THREE.BoxGeometry(0.22, 0.25, 0.08);
            [-0.6, 0.6].forEach(x => {
                const tl = new THREE.Mesh(tailGeo, this.brakeLightMat);
                tl.position.set(x, 0.52, 1.91);
                this.playerCarGroup.add(tl);
                this.taillights.push(tl);
            });

        } else if (modelType === 'PRIDE') {
            const bodyGeo = new THREE.BoxGeometry(1.68, 0.5, 3.4);
            const bodyMesh = new THREE.Mesh(bodyGeo, carMat);
            bodyMesh.position.y = 0.42;
            this.playerCarGroup.add(bodyMesh);

            const cabinGeo = new THREE.BoxGeometry(1.4, 0.55, 1.6);
            const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
            cabinMesh.position.set(0, 0.88, -0.1);
            this.playerCarGroup.add(cabinMesh);

            const roofGeo = new THREE.BoxGeometry(1.3, 0.08, 1.1);
            const roofMesh = new THREE.Mesh(roofGeo, carMat);
            roofMesh.position.set(0, 1.15, -0.1);
            this.playerCarGroup.add(roofMesh);

            const tailGeo = new THREE.BoxGeometry(0.35, 0.2, 0.08);
            [-0.55, 0.55].forEach(x => {
                const tl = new THREE.Mesh(tailGeo, this.brakeLightMat);
                tl.position.set(x, 0.52, 1.71);
                this.playerCarGroup.add(tl);
                this.taillights.push(tl);
            });

        } else if (modelType === 'P206') {
            const bodyGeo = new THREE.BoxGeometry(1.72, 0.52, 3.5);
            const bodyMesh = new THREE.Mesh(bodyGeo, carMat);
            bodyMesh.position.y = 0.44;
            this.playerCarGroup.add(bodyMesh);

            const cabinGeo = new THREE.BoxGeometry(1.42, 0.54, 1.7);
            const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
            cabinMesh.position.set(0, 0.9, -0.15);
            this.playerCarGroup.add(cabinMesh);

            const wingGeo = new THREE.BoxGeometry(1.5, 0.08, 0.35);
            const wing = new THREE.Mesh(wingGeo, carMat);
            wing.position.set(0, 1.22, 1.55);
            this.playerCarGroup.add(wing);

            const tailGeo = new THREE.BoxGeometry(0.32, 0.22, 0.08);
            [-0.58, 0.58].forEach(x => {
                const tl = new THREE.Mesh(tailGeo, this.brakeLightMat);
                tl.position.set(x, 0.54, 1.76);
                this.playerCarGroup.add(tl);
                this.taillights.push(tl);
            });

        } else if (modelType === 'SOREN') {
            const bodyGeo = new THREE.BoxGeometry(1.82, 0.54, 4.0);
            const bodyMesh = new THREE.Mesh(bodyGeo, carMat);
            bodyMesh.position.y = 0.46;
            this.playerCarGroup.add(bodyMesh);

            const cabinGeo = new THREE.BoxGeometry(1.48, 0.54, 2.0);
            const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
            cabinMesh.position.set(0, 0.92, -0.1);
            this.playerCarGroup.add(cabinMesh);

            const tailGeo = new THREE.BoxGeometry(0.42, 0.22, 0.08);
            [-0.6, 0.6].forEach(x => {
                const tl = new THREE.Mesh(tailGeo, this.brakeLightMat);
                tl.position.set(x, 0.54, 2.01);
                this.playerCarGroup.add(tl);
                this.taillights.push(tl);
            });

        } else if (modelType === 'XANTIA') {
            // XANTIA 2000 Sleek Liftback Body
            const bodyGeo = new THREE.BoxGeometry(1.84, 0.5, 4.1);
            const bodyMesh = new THREE.Mesh(bodyGeo, carMat);
            bodyMesh.position.y = 0.44;
            this.playerCarGroup.add(bodyMesh);

            const cabinGeo = new THREE.BoxGeometry(1.46, 0.52, 2.1);
            const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
            cabinMesh.position.set(0, 0.9, -0.05);
            this.playerCarGroup.add(cabinMesh);

            const tailGeo = new THREE.BoxGeometry(0.46, 0.22, 0.08);
            [-0.6, 0.6].forEach(x => {
                const tl = new THREE.Mesh(tailGeo, this.brakeLightMat);
                tl.position.set(x, 0.52, 2.05);
                this.playerCarGroup.add(tl);
                this.taillights.push(tl);
            });

        } else if (modelType === 'SUPRA') {
            const bodyGeo = new THREE.BoxGeometry(1.9, 0.5, 3.9);
            const bodyMesh = new THREE.Mesh(bodyGeo, carMat);
            bodyMesh.position.y = 0.45;
            this.playerCarGroup.add(bodyMesh);

            const glassGeo = new THREE.BoxGeometry(1.48, 0.52, 2.0);
            const glassMesh = new THREE.Mesh(glassGeo, glassMat);
            glassMesh.position.set(0, 0.88, -0.15);
            this.playerCarGroup.add(glassMesh);

            const wingPostGeo = new THREE.BoxGeometry(0.12, 0.6, 0.4);
            const postL = new THREE.Mesh(wingPostGeo, carMat);
            postL.position.set(-0.78, 1.0, 1.68);
            const postR = new THREE.Mesh(wingPostGeo, carMat);
            postR.position.set(0.78, 1.0, 1.68);
            this.playerCarGroup.add(postL);
            this.playerCarGroup.add(postR);

            const wingBladeGeo = new THREE.BoxGeometry(1.98, 0.1, 0.5);
            const wingBlade = new THREE.Mesh(wingBladeGeo, carMat);
            wingBlade.position.set(0, 1.32, 1.68);
            this.playerCarGroup.add(wingBlade);

            const circleLightGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.08, 16);
            circleLightGeo.rotateX(Math.PI / 2);
            [-0.62, -0.31, 0.31, 0.62].forEach(xPos => {
                const light = new THREE.Mesh(circleLightGeo, this.brakeLightMat);
                light.position.set(xPos, 0.55, 1.96);
                this.playerCarGroup.add(light);
                this.taillights.push(light);
            });

        } else {
            // PEUGEOT PARS ELX
            const bodyGeo = new THREE.BoxGeometry(1.8, 0.52, 4.0);
            const bodyMesh = new THREE.Mesh(bodyGeo, carMat);
            bodyMesh.position.y = 0.45;
            this.playerCarGroup.add(bodyMesh);

            const cabinGeo = new THREE.BoxGeometry(1.46, 0.52, 2.0);
            const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
            cabinMesh.position.set(0, 0.9, -0.1);
            this.playerCarGroup.add(cabinMesh);

            const roofGeo = new THREE.BoxGeometry(1.38, 0.08, 1.3);
            const roofMesh = new THREE.Mesh(roofGeo, carMat);
            roofMesh.position.set(0, 1.16, -0.1);
            this.playerCarGroup.add(roofMesh);

            const tailGeo = new THREE.BoxGeometry(0.48, 0.22, 0.08);
            [-0.58, 0.58].forEach(x => {
                const tl = new THREE.Mesh(tailGeo, this.brakeLightMat);
                tl.position.set(x, 0.54, 2.01);
                this.playerCarGroup.add(tl);
                this.taillights.push(tl);
            });
        }

        // ==========================================
        // REALISTIC PEUGEOT PARS 3D INTERIOR COCKPIT
        // ==========================================
        this.cockpitGroup = new THREE.Group();

        // 1. Dashboard Console Frame
        const dashGeo = new THREE.BoxGeometry(1.45, 0.45, 0.7);
        const dashMat = new THREE.MeshStandardMaterial({ color: 0x181a24, roughness: 0.85 });
        const dashboard = new THREE.Mesh(dashGeo, dashMat);
        dashboard.position.set(0, 0.85, -0.45);
        this.cockpitGroup.add(dashboard);

        // Center A/C Vent Panel & Controls
        const consoleGeo = new THREE.BoxGeometry(0.35, 0.3, 0.1);
        const consoleMat = new THREE.MeshBasicMaterial({ color: 0x090a12 });
        const centerConsole = new THREE.Mesh(consoleGeo, consoleMat);
        centerConsole.position.set(0, 0.82, -0.08);
        this.cockpitGroup.add(centerConsole);

        // 2. Peugeot Pars Steering Wheel (فرمان سه‌بعدی پژو پارس)
        const wheelRingGeo = new THREE.TorusGeometry(0.24, 0.035, 12, 24);
        const wheelHubGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.05, 16);
        wheelHubGeo.rotateX(Math.PI / 2);

        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111218, roughness: 0.6 });
        const logoMat = new THREE.MeshBasicMaterial({ color: 0xe0e0e0 }); // Peugeot Lion Emblem Silver

        this.steeringWheel = new THREE.Group();
        const ringMesh = new THREE.Mesh(wheelRingGeo, wheelMat);
        const hubMesh = new THREE.Mesh(wheelHubGeo, wheelMat);
        const logoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.06), logoMat);

        this.steeringWheel.add(ringMesh);
        this.steeringWheel.add(hubMesh);
        this.steeringWheel.add(logoMesh);

        // Steering Column Stem
        const colGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.4, 8);
        colGeo.rotateX(Math.PI / 3);
        const column = new THREE.Mesh(colGeo, wheelMat);
        column.position.set(-0.35, 0.85, -0.2);
        this.cockpitGroup.add(column);

        this.steeringWheel.position.set(-0.35, 0.96, 0.02);
        this.steeringWheel.rotation.x = -0.3; // Angle towards driver
        this.cockpitGroup.add(this.steeringWheel);

        // 3. Glowing Peugeot Speedometer Gauge Cluster Behind Wheel (صفحه کیلومتر پارس)
        const gaugeBoxGeo = new THREE.BoxGeometry(0.38, 0.18, 0.06);
        const gaugeMat = new THREE.MeshBasicMaterial({ color: 0x050714 });
        const gaugeBox = new THREE.Mesh(gaugeBoxGeo, gaugeMat);
        gaugeBox.position.set(-0.35, 0.98, -0.22);
        this.cockpitGroup.add(gaugeBox);

        const dialGeo = new THREE.CircleGeometry(0.06, 16);
        const dialMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        const speedoDial = new THREE.Mesh(dialGeo, dialMat);
        speedoDial.position.set(-0.41, 0.98, -0.18);
        const tachoDial = new THREE.Mesh(dialGeo, dialMat);
        tachoDial.position.set(-0.29, 0.98, -0.18);
        this.cockpitGroup.add(speedoDial);
        this.cockpitGroup.add(tachoDial);

        // 4. Rear View Mirror (آینه وسط)
        const mirrorGeo = new THREE.BoxGeometry(0.28, 0.09, 0.04);
        const mirrorMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.9, roughness: 0.1 });
        const mirror = new THREE.Mesh(mirrorGeo, mirrorMat);
        mirror.position.set(0, 1.25, -0.25);
        this.cockpitGroup.add(mirror);

        this.playerCarGroup.add(this.cockpitGroup);

        // Common Sport Alloy Wheels for all Cars
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

        // 3D Persian Rear Window Sticker Badge
        if (this.player.sticker && this.player.sticker !== 'NONE') {
            const stickerBadgeGeo = new THREE.BoxGeometry(0.85, 0.18, 0.05);
            let stickerColor = 0xffea00; // SOLTAN Yellow
            if (this.player.sticker === 'SHOOTI') stickerColor = 0xff0055;
            if (this.player.sticker === 'SALAR') stickerColor = 0x00f0ff;

            const stickerMat = new THREE.MeshBasicMaterial({ color: stickerColor });
            const stickerMesh = new THREE.Mesh(stickerBadgeGeo, stickerMat);
            stickerMesh.position.set(0, 0.92, 0.85);
            stickerMesh.rotation.x = -0.3;
            this.playerCarGroup.add(stickerMesh);
        }

        // 3D Neon Underglow PointLight
        const underglowHex = parseInt(this.player.underglowColor.replace('#', '0x'));
        this.underglowLight = new THREE.PointLight(underglowHex, 3.0, 8);
        this.underglowLight.position.set(0, 0.1, 0);
        this.playerCarGroup.add(this.underglowLight);

        // 3D Shield Globe Mesh
        const shieldGeo = new THREE.SphereGeometry(2.5, 16, 16);
        const shieldMat = new THREE.MeshBasicMaterial({ color: 0x00ff66, wireframe: true, transparent: true, opacity: 0.5 });
        this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
        this.shieldMesh.position.y = 0.6;
        this.shieldMesh.visible = false;
        this.playerCarGroup.add(this.shieldMesh);

        // Apply Iranian Tuning Stance Stance (SHOOTI vs LOW vs NORMAL)
        if (this.player.stance === 'SHOOTI') {
            this.playerCarGroup.rotation.x = -0.06; // Rear raised high
            this.playerCarGroup.position.y = 0.22;
        } else if (this.player.stance === 'LOW') {
            this.playerCarGroup.position.y = -0.12; // Lowered stance
            this.playerCarGroup.rotation.x = 0;
        } else {
            this.playerCarGroup.position.y = 0;
            this.playerCarGroup.rotation.x = 0;
        }

        this.playerCarGroup.position.x = this.laneX[this.currentLane];
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
            if (e.code === 'KeyC') this.toggleCameraMode();

            if (this.state === 'PLAYING' && !this.player.isSpinning) {
                if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.moveLane(-1);
                else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.moveLane(1);
                else if (e.code === 'Space') this.activateNitro();
            }
        });

        window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

        document.getElementById('camera-btn').addEventListener('click', () => this.toggleCameraMode());
        document.getElementById('btn-left').addEventListener('click', (e) => { e.preventDefault(); this.moveLane(-1); });
        document.getElementById('btn-right').addEventListener('click', (e) => { e.preventDefault(); this.moveLane(1); });
        document.getElementById('btn-nitro').addEventListener('click', (e) => { e.preventDefault(); this.activateNitro(); });

        // Gas & Brake Touch/Mouse Handlers
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

        // Iranian Shooti Stance Selector Handlers
        document.querySelectorAll('.stance-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.stance-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.player.stance = e.target.dataset.stance;
                localStorage.setItem('neon_stance', this.player.stance);
                this.buildPlayer3DCar();
            });
        });

        // Iranian Window Sticker Selector Handlers
        document.querySelectorAll('.sticker-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.sticker-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.player.sticker = e.target.dataset.sticker;
                localStorage.setItem('neon_sticker', this.player.sticker);
                this.buildPlayer3DCar();
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
        const modes = ['COCKPIT', 'CHASE', 'HOOD'];
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

    gameOver(reason = 'تصادف شدید در آزادراه') {
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
        // Auto Performance Monitor
        if (dt > 0.036) {
            this.lagFrames = (this.lagFrames || 0) + 1;
            if (this.lagFrames > 35) {
                this.renderer.setPixelRatio(1.0);
                if (this.rainSystem) this.rainSystem.visible = false;
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

        // Weather Cycle
        this.weatherTimer += dt;
        if (this.weatherTimer > 25) {
            this.weatherTimer = 0;
            const cycle = ['CLEAR', 'RAIN', 'TUNNEL'];
            this.weather = cycle[(cycle.indexOf(this.weather) + 1) % cycle.length];
            this.rainSystem.visible = (this.weather === 'RAIN');
        }

        // Speed & Throttle Physics Logic
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
                const rechargeRate = (this.player.selectedCar === 4) ? 0.25 : 0.12;
                this.player.nitroGauge = Math.min(100, this.player.nitroGauge + rechargeRate);
            }
        }

        // Taillight Glow
        if (this.taillights) {
            const glowColor = isBrakePressed ? 0xff0000 : 0x990022;
            this.taillights.forEach(l => l.material.color.setHex(glowColor));
        }

        audioMgr.updateEnginePitch(this.speed / 32.0);

        this.distance += (this.speed * dt * 2.5);
        const scoreMultiplier = (this.player.selectedCar === 1) ? 1.2 : 1.0;
        this.score += (this.speed * dt * 10) * scoreMultiplier;

        // 3D Road Line Animations
        this.laneLinesGroup.children.forEach(line => {
            line.position.z += this.speed * dt * 10.0;
            if (line.position.z > 15) line.position.z -= 410;
        });

        // Scenery Animations
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

        if (this.highwayGantriesGroup) {
            this.highwayGantriesGroup.children.forEach(gantry => {
                gantry.position.z += this.speed * dt * 10.0;
                if (gantry.position.z > 20) gantry.position.z -= 400;
            });
        }

        // Smooth Player Lane Lerping
        const targetX = this.laneX[this.targetLane];
        const diffX = targetX - this.player.x;
        this.player.x += diffX * 0.18;
        this.player.tilt = -diffX * 0.05;

        if (this.player.isSpinning) {
            this.player.spinAngle += dt * 15;
            this.player.spinTime -= dt;
            if (this.player.spinTime <= 0) {
                this.player.isSpinning = false;
                this.player.spinAngle = 0;
            }
        }

        // Update Car Position
        this.playerCarGroup.position.x = this.player.x;
        this.playerCarGroup.rotation.y = this.player.spinAngle;
        this.playerCarGroup.rotation.z = this.player.tilt;

        this.shieldMesh.visible = this.player.hasShield;

        // Camera Modes & Dynamic Steering Wheel Rotation
        const pitchTarget = isGasPressed ? -0.03 : (isBrakePressed ? 0.04 : 0.0);

        if (this.cameraMode === 'COCKPIT') {
            this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, this.player.x - 0.35, 0.2);
            this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, 1.08, 0.2);
            this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, 0.1, 0.2);
            this.camera.rotation.x = THREE.MathUtils.lerp(this.camera.rotation.x, pitchTarget, 0.08);

            if (this.steeringWheel) {
                this.steeringWheel.rotation.z = -diffX * 0.85;
            }
        } else if (this.cameraMode === 'HOOD') {
            this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, this.player.x, 0.2);
            this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, 0.75, 0.2);
            this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, -1.2, 0.2);
            this.camera.rotation.x = THREE.MathUtils.lerp(this.camera.rotation.x, pitchTarget, 0.08);
        } else {
            this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, this.player.x * 0.45, 0.1);
            this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, 2.1, 0.1);
            this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, 5.2, 0.1);
            this.camera.rotation.x = THREE.MathUtils.lerp(this.camera.rotation.x, pitchTarget, 0.08);
        }

        // Spawn Obstacles
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

        // Update Traffic Obstacles
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obs = this.obstacles[i];
            obs.z += (this.speed - obs.speed) * dt * 10.0;
            obs.mesh.position.z = obs.z;

            if (obs.type === 'police') {
                obs.sirenTimer = (obs.sirenTimer || 0) + dt;
                if (obs.sirenTimer > 0.4) {
                    obs.sirenTimer = 0;
                    audioMgr.playPoliceSiren();
                }
            }

            if (Math.abs(obs.z - this.player.z) < 2.8 && Math.abs(obs.x - this.player.x) < 1.6) {
                if (this.player.isNitroActive) {
                    this.scene.remove(obs.mesh);
                    this.obstacles.splice(i, 1);
                    this.score += 300;
                    this.addFloatingText('انفجار شوتی! +۳۰۰ ⚡', this.canvas.width / 2, 160, '#ffea00');
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
                    this.gameOver('تصادف شدید در آزادراه');
                    return;
                }
            }

            if (obs.z > 20) {
                this.scene.remove(obs.mesh);
                this.obstacles.splice(i, 1);
            }
        }

        // Update Collectibles
        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const item = this.collectibles[i];
            item.z += this.speed * dt * 10.0;
            item.mesh.position.z = item.z;
            item.mesh.rotation.y += dt * 3;

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

        // Update Hazards
        for (let i = this.hazards.length - 1; i >= 0; i--) {
            const h = this.hazards[i];
            h.z += this.speed * dt * 10.0;
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
        const lane = Math.floor(Math.random() * 5);
        const types = [
            { type: 'sedan', color: 0xe60000, speed: 2, scaleZ: 3.6 },
            { type: 'sports', color: 0xffaa00, speed: 4, scaleZ: 3.8 },
            { type: 'police', color: 0x002288, speed: 1, scaleZ: 3.6 },
            { type: 'truck', color: 0x8800cc, speed: 0, scaleZ: 6.0 }
        ];

        const selected = types[Math.floor(Math.random() * types.length)];
        const meshGroup = new THREE.Group();

        if (selected.type === 'truck') {
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

            const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.35, 12);
            const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
            wheelGeo.rotateZ(Math.PI / 2);

            [[-1.1, 0.4, 2.0], [1.1, 0.4, 2.0], [-1.1, 0.4, -0.5], [1.1, 0.4, -0.5], [-1.1, 0.4, -2.5], [1.1, 0.4, -2.5]].forEach(pos => {
                const w = new THREE.Mesh(wheelGeo, wheelMat);
                w.position.set(pos[0], pos[1], pos[2]);
                meshGroup.add(w);
            });
        } else {
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

            const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12);
            const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
            wheelGeo.rotateZ(Math.PI / 2);

            [[-0.95, 0.35, 1.1], [0.95, 0.35, 1.1], [-0.95, 0.35, -1.1], [0.95, 0.35, -1.1]].forEach(pos => {
                const w = new THREE.Mesh(wheelGeo, wheelMat);
                w.position.set(pos[0], pos[1], pos[2]);
                meshGroup.add(w);
            });

            const tailGeo = new THREE.BoxGeometry(0.4, 0.15, 0.1);
            const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
            const tailL = new THREE.Mesh(tailGeo, tailMat);
            tailL.position.set(-0.6, 0.5, selected.scaleZ / 2 + 0.05);
            const tailR = new THREE.Mesh(tailGeo, tailMat);
            tailR.position.set(0.6, 0.5, selected.scaleZ / 2 + 0.05);
            meshGroup.add(tailL);
            meshGroup.add(tailR);

            if (selected.type === 'police') {
                const sirenGeo = new THREE.BoxGeometry(0.6, 0.18, 0.3);
                const sirenMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                const sirenMesh = new THREE.Mesh(sirenGeo, sirenMat);
                sirenMesh.position.set(0, 1.25, 0);
                meshGroup.add(sirenMesh);
            }
        }

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
        } else if (rand > 0.7) {
            type = 'gem';
            color = 0x00f0ff;
            geo = new THREE.OctahedronGeometry(0.6);
        } else if (rand > 0.55 && this.gameMode === 'TIME_ATTACK') {
            type = 'time';
            color = 0xff007f;
            geo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        }

        geo.rotateX(Math.PI / 2);
        const mat = new THREE.MeshStandardMaterial({ color: color, metalness: 0.8, roughness: 0.2 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(this.laneX[lane], 0.8, -220);
        this.scene.add(mesh);

        this.collectibles.push({
            type: type,
            x: this.laneX[lane],
            z: -220,
            mesh: mesh
        });
    }

    spawn3DHazard() {
        const lane = Math.floor(Math.random() * 5);
        const oilGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.04, 16);
        const oilMat = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.1, metalness: 0.9 });
        const oilMesh = new THREE.Mesh(oilGeo, oilMat);
        oilMesh.position.set(this.laneX[lane], 0.02, -220);
        this.scene.add(oilMesh);

        this.hazards.push({
            type: 'oil',
            x: this.laneX[lane],
            z: -220,
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

        document.querySelectorAll('.stance-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.stance === this.player.stance);
        });
        document.querySelectorAll('.sticker-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.sticker === this.player.sticker);
        });
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.game = new Game3D();
});
