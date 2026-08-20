/*
 * ===================================================================
 * PEUGEOT PARS ELX 3D RACER SIMULATOR (پژو پارس سه‌بعدی HD - سلطان جاده)
 * ACESFilmic Tone Mapping, Procedural Asphalt, Day/Sunset/Night Cycles,
 * RPM & Gear Physics, Weight Transfer, 4-Wheel Suspension & Tire Slip
 * ===================================================================
 */

class Game3D {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.state = 'MENU'; // MENU, PLAYING, PAUSED, GAMEOVER
        this.cameraMode = localStorage.getItem('neon_cammode') || 'CHASE'; // CHASE, COCKPIT, HOOD
        this.timeOfDay = localStorage.getItem('neon_timeofday') || 'DAY'; // DAY, SUNSET, NIGHT

        // Racing Telemetry & Physics Stats
        this.score = 0;
        this.coins = parseInt(localStorage.getItem('neon_coins') || '0');
        this.highScore = parseInt(localStorage.getItem('neon_highscore') || '0');
        this.distance = 0;
        this.speed = 12.0;
        this.baseSpeed = 12.0;
        this.maxSpeed = 34.0;
        this.currentGear = 1;
        this.currentRPM = 1000;
        this.cameraShake = 0;

        // 5 Highway Lanes (X: -7.2, -3.6, 0.0, 3.6, 7.2)
        this.laneX = [-7.2, -3.6, 0.0, 3.6, 7.2];
        this.currentLane = 2; // Center lane
        this.targetLane = 2;

        // Player State & Custom Tuning
        this.player = {
            x: 0,
            y: 0,
            z: 0,
            tilt: 0,
            pitch: 0,
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

        // Iconic Iranian Car Garage
        this.carGarage = [
            { id: 0, name: 'پژو پارس ELX HD (شوتی سلطان)', color: 0xffffff, stat: 'سلطان جاده - شتاب شوتی', modelType: 'PARS' }
        ];

        // 3D Groups & Entities
        this.obstacles = [];
        this.collectibles = [];
        this.floatingTexts = [];
        this.exhaustParticles = [];
        this.tireSmokeParticles = [];
        this.wheels = [];
        this.frontWheels = [];
        this.buildingWindows = [];
        this.streetLampSpotlights = [];
        this.lastSpawnTime = 0;
        this.lastCollectibleTime = 0;
        this.keys = {};

        this.initDOM();
        this.initThreeJS();
        this.tuning = new TuningSystem(this);
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
        this.hudGearRPM = document.getElementById('hud-gear-rpm');
        this.powerupBar = document.getElementById('powerup-bar');
    }

    // Procedural Environment Reflection Map Generator
    createEnvMapTexture() {
        const envCanvas = document.createElement('canvas');
        envCanvas.width = 512;
        envCanvas.height = 256;
        const ctx = envCanvas.getContext('2d');

        const grad = ctx.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, '#5a82ba');   // Sky top
        grad.addColorStop(0.4, '#a0c4e8'); // Horizon
        grad.addColorStop(0.5, '#48443b'); // Ground horizon
        grad.addColorStop(1, '#28251e');   // Asphalt ground

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 256);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fillRect(100, 40, 220, 30);
        ctx.fillRect(320, 70, 160, 20);

        const texture = new THREE.CanvasTexture(envCanvas);
        texture.mapping = THREE.EquirectangularReflectionMapping;
        return texture;
    }

    // Procedural Asphalt Texture Generator with Tire Marks & Micro-Grain Detail
    createAsphaltTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Base dark asphalt
        ctx.fillStyle = '#22242b';
        ctx.fillRect(0, 0, 512, 512);

        // Asphalt micro-grain noise
        const imgData = ctx.getImageData(0, 0, 512, 512);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * 22;
            data[i] = Math.min(255, Math.max(0, data[i] + noise));
            data[i+1] = Math.min(255, Math.max(0, data[i+1] + noise));
            data[i+2] = Math.min(255, Math.max(0, data[i+2] + noise));
        }
        ctx.putImageData(imgData, 0, 0);

        // Procedural Tire Skid Marks
        ctx.strokeStyle = 'rgba(10, 10, 15, 0.45)';
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(140, 0); ctx.bezierCurveTo(145, 150, 135, 350, 140, 512);
        ctx.moveTo(370, 0); ctx.bezierCurveTo(365, 180, 375, 320, 370, 512);
        ctx.stroke();

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 40);
        return texture;
    }

    initThreeJS() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x608abf, 30, 250);

        this.envMap = this.createEnvMapTexture();
        this.scene.environment = this.envMap;

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
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.0));

        // Cinematic ACESFilmic Tone Mapping & Soft Shadow Maps
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.95);
        this.scene.add(this.hemiLight);

        this.sunLight = new THREE.DirectionalLight(0xfffaed, 1.45);
        this.sunLight.position.set(30, 60, -20);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 150;
        this.sunLight.shadow.camera.left = -25;
        this.sunLight.shadow.camera.right = 25;
        this.sunLight.shadow.camera.top = 25;
        this.sunLight.shadow.camera.bottom = -25;
        this.scene.add(this.sunLight);

        // Asphalt Highway Road with Procedural Detail Texture
        const roadGeo = new THREE.PlaneGeometry(24, 600);
        const asphaltTex = this.createAsphaltTexture();
        const roadMat = new THREE.MeshStandardMaterial({
            map: asphaltTex,
            bumpMap: asphaltTex,
            bumpScale: 0.04,
            roughness: 0.68,
            metalness: 0.15
        });
        this.roadMesh = new THREE.Mesh(roadGeo, roadMat);
        this.roadMesh.rotation.x = -Math.PI / 2;
        this.roadMesh.position.z = -200;
        this.roadMesh.receiveShadow = true;
        this.scene.add(this.roadMesh);

        // Soil Terrain
        const terrainMat = new THREE.MeshStandardMaterial({ color: 0x3d392e, roughness: 0.95 });
        const leftTerrain = new THREE.Mesh(new THREE.PlaneGeometry(160, 600), terrainMat);
        leftTerrain.rotation.x = -Math.PI / 2;
        leftTerrain.position.set(-92, -0.05, -200);
        leftTerrain.receiveShadow = true;
        this.scene.add(leftTerrain);

        const rightTerrain = new THREE.Mesh(new THREE.PlaneGeometry(160, 600), terrainMat);
        rightTerrain.rotation.x = -Math.PI / 2;
        rightTerrain.position.set(92, -0.05, -200);
        rightTerrain.receiveShadow = true;
        this.scene.add(rightTerrain);

        // Yellow Shoulder Lines
        const edgeLineGeo = new THREE.BoxGeometry(0.28, 0.04, 600);
        const edgeLineMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
        const leftEdge = new THREE.Mesh(edgeLineGeo, edgeLineMat);
        leftEdge.position.set(-10.8, 0.02, -200);
        this.scene.add(leftEdge);

        const rightEdge = new THREE.Mesh(edgeLineGeo, edgeLineMat);
        rightEdge.position.set(10.8, 0.02, -200);
        this.scene.add(rightEdge);

        // Steel Guardrails with Posts
        const guardrailMat = new THREE.MeshStandardMaterial({ color: 0xb5c4d4, metalness: 0.9, roughness: 0.2 });
        const railGeo = new THREE.BoxGeometry(0.22, 0.48, 600);

        const leftRail = new THREE.Mesh(railGeo, guardrailMat);
        leftRail.position.set(-11.4, 0.52, -200);
        leftRail.castShadow = true;
        this.scene.add(leftRail);

        const rightRail = new THREE.Mesh(railGeo, guardrailMat);
        rightRail.position.set(11.4, 0.52, -200);
        rightRail.castShadow = true;
        this.scene.add(rightRail);

        // Dashed Lane Dividers
        this.laneLinesGroup = new THREE.Group();
        const lineDividerPosX = [-5.4, -1.8, 1.8, 5.4];
        for (let z = 10; z > -400; z -= 12) {
            const lineGeo = new THREE.BoxGeometry(0.2, 0.04, 4.8);
            const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            lineDividerPosX.forEach(posX => {
                const divider = new THREE.Mesh(lineGeo, lineMat);
                divider.position.set(posX, 0.03, z);
                this.laneLinesGroup.add(divider);
            });
        }
        this.scene.add(this.laneLinesGroup);

        // Street Lights & Active Night Spotlights
        this.streetLightsGroup = new THREE.Group();
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x222533, metalness: 0.8, roughness: 0.2 });
        const lampLightMat = new THREE.MeshBasicMaterial({ color: 0xffcc44 });

        for (let z = 20; z > -420; z -= 35) {
            [-12.5, 12.5].forEach(xPos => {
                const poleGroup = new THREE.Group();
                const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 7.0, 12), poleMat);
                shaft.position.y = 3.5;
                shaft.castShadow = true;
                poleGroup.add(shaft);

                const armDir = xPos < 0 ? 1 : -1;
                const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.1), poleMat);
                arm.position.set(armDir * 0.8, 6.8, 0);
                poleGroup.add(arm);

                const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.3), lampLightMat);
                head.position.set(armDir * 1.5, 6.7, 0);
                poleGroup.add(head);

                const spot = new THREE.SpotLight(0xffaa33, 0.0, 30, Math.PI / 4, 0.5, 1);
                spot.position.set(armDir * 1.5, 6.5, 0);
                spot.target.position.set(armDir * 1.5, 0, 0);
                poleGroup.add(spot);
                poleGroup.add(spot.target);
                this.streetLampSpotlights.push(spot);

                poleGroup.position.set(xPos, 0, z);
                this.streetLightsGroup.add(poleGroup);
            });
        }
        this.scene.add(this.streetLightsGroup);

        // Scenery Variety: Roadside Pine & Broadleaf Trees
        this.roadsideTreesGroup = new THREE.Group();
        const trunkGeo = new THREE.CylinderGeometry(0.32, 0.48, 3.8, 10);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3b2213, roughness: 0.9 });
        const foliageGeo1 = new THREE.ConeGeometry(2.4, 3.5, 10);
        const foliageGeo2 = new THREE.ConeGeometry(1.8, 3.0, 10);
        const foliageMat1 = new THREE.MeshStandardMaterial({ color: 0x0c331a, roughness: 0.7 });
        const foliageMat2 = new THREE.MeshStandardMaterial({ color: 0x1e4620, roughness: 0.7 });

        for (let z = 10; z > -420; z -= 22) {
            [-18, 18].forEach(xPos => {
                const tree = new THREE.Group();
                const trunk = new THREE.Mesh(trunkGeo, trunkMat);
                trunk.position.y = 1.9;
                trunk.castShadow = true;
                tree.add(trunk);

                const fMat = Math.random() > 0.5 ? foliageMat1 : foliageMat2;
                const fol1 = new THREE.Mesh(foliageGeo1, fMat);
                fol1.position.y = 4.2;
                fol1.castShadow = true;
                tree.add(fol1);

                const fol2 = new THREE.Mesh(foliageGeo2, fMat);
                fol2.position.y = 5.8;
                fol2.castShadow = true;
                tree.add(fol2);

                tree.position.set(xPos + (Math.random() - 0.5) * 2, 0, z);
                this.roadsideTreesGroup.add(tree);
            });
        }
        this.scene.add(this.roadsideTreesGroup);

        // City Skyline with Emissive Night Window Glow Mesh
        this.citySkylineGroup = new THREE.Group();
        const buildingMat = new THREE.MeshStandardMaterial({ color: 0x181b26, roughness: 0.7 });
        const windowEmissiveMat = new THREE.MeshStandardMaterial({
            color: 0xffdd88,
            emissive: 0xffaa33,
            emissiveIntensity: 0.0
        });
        this.windowEmissiveMat = windowEmissiveMat;

        for (let z = 0; z > -420; z -= 38) {
            [-45, 45].forEach(xPos => {
                const height = 16 + Math.random() * 26;
                const width = 10 + Math.random() * 8;
                const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, width), buildingMat);
                building.position.set(xPos, height / 2, z);
                building.castShadow = true;

                const winMesh = new THREE.Mesh(new THREE.BoxGeometry(width + 0.05, height * 0.7, width + 0.05), windowEmissiveMat);
                winMesh.position.set(xPos, height / 2, z);
                this.buildingWindows.push(winMesh);
                this.citySkylineGroup.add(winMesh);

                this.citySkylineGroup.add(building);
            });
        }
        this.scene.add(this.citySkylineGroup);

        // Apply Initial Time of Day Preset
        this.setTimeOfDay(this.timeOfDay);
    }

    setTimeOfDay(mode) {
        this.timeOfDay = mode;
        try {
            localStorage.setItem('neon_timeofday', mode);
        } catch (e) {}

        if (!this.scene) return;
        if (!this.scene.fog) {
            this.scene.fog = new THREE.Fog(0x608abf, 30, 250);
        }

        const fogColorHex = mode === 'SUNSET' ? 0xc45c2c : (mode === 'NIGHT' ? 0x070a14 : 0x608abf);
        this.scene.background = new THREE.Color(fogColorHex);
        if (this.scene.fog && this.scene.fog.color) {
            this.scene.fog.color.setHex(fogColorHex);
        }

        if (mode === 'SUNSET') {
            if (this.sunLight) {
                this.sunLight.color.setHex(0xff9944);
                this.sunLight.intensity = 1.35;
            }
            if (this.hemiLight) {
                this.hemiLight.color.setHex(0xffaa66);
                this.hemiLight.groundColor.setHex(0x332211);
            }
            if (this.windowEmissiveMat) this.windowEmissiveMat.emissiveIntensity = 0.4;
            if (this.streetLampSpotlights) this.streetLampSpotlights.forEach(s => { if (s) s.intensity = 0.5; });
        } else if (mode === 'NIGHT') {
            if (this.sunLight) {
                this.sunLight.color.setHex(0x334466);
                this.sunLight.intensity = 0.25;
            }
            if (this.hemiLight) {
                this.hemiLight.color.setHex(0x112244);
                this.hemiLight.groundColor.setHex(0x050510);
            }
            if (this.windowEmissiveMat) this.windowEmissiveMat.emissiveIntensity = 1.2;
            if (this.streetLampSpotlights) this.streetLampSpotlights.forEach(s => { if (s) s.intensity = 2.0; });
        } else { // DAY
            if (this.sunLight) {
                this.sunLight.color.setHex(0xfffaed);
                this.sunLight.intensity = 1.45;
            }
            if (this.hemiLight) {
                this.hemiLight.color.setHex(0xffffff);
                this.hemiLight.groundColor.setHex(0x444444);
            }
            if (this.windowEmissiveMat) this.windowEmissiveMat.emissiveIntensity = 0.0;
            if (this.streetLampSpotlights) this.streetLampSpotlights.forEach(s => { if (s) s.intensity = 0.0; });
        }

        const todBtn = document.getElementById('tod-btn');
        if (todBtn) {
            const icons = { 'DAY': '☀️ روز', 'SUNSET': '🌅 غروب', 'NIGHT': '🌙 شب' };
            todBtn.innerText = icons[mode] || icons['DAY'];
        }
    }

    cycleTimeOfDay() {
        const modes = ['DAY', 'SUNSET', 'NIGHT'];
        const nextIdx = (modes.indexOf(this.timeOfDay) + 1) % modes.length;
        this.setTimeOfDay(modes[nextIdx]);
        audioMgr.playCoin();
    }

    createContactShadowTexture() {
        const shadowCanvas = document.createElement('canvas');
        shadowCanvas.width = 256;
        shadowCanvas.height = 256;
        const ctx = shadowCanvas.getContext('2d');

        const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
        grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.45)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 256);

        const texture = new THREE.CanvasTexture(shadowCanvas);
        return texture;
    }

    buildPlayer3DCar() {
        if (this.playerCarGroup) this.scene.remove(this.playerCarGroup);

        this.playerCarGroup = new THREE.Group();
        this.wheels = [];
        this.frontWheels = [];

        // HD PBR Automotive Metallic Paint Material
        const carMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 0.70,
            roughness: 0.16,
            envMap: this.envMap,
            envMapIntensity: 1.5
        });

        const darkTrimMat = new THREE.MeshStandardMaterial({ color: 0x111218, roughness: 0.85, metalness: 0.1 });
        const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, metalness: 0.98, roughness: 0.04 });
        const glassMat = new THREE.MeshStandardMaterial({
            color: 0x060814,
            metalness: 0.85,
            roughness: 0.08,
            transparent: true,
            opacity: 0.82,
            envMap: this.envMap,
            envMapIntensity: 1.8
        });

        // Dynamic Neon Underglow Light
        const underglowHex = parseInt((this.player.underglowColor || '#00f0ff').replace('#', '0x'));
        this.underglowLight = new THREE.PointLight(underglowHex, 2.8, 7);
        this.underglowLight.position.set(0, 0.15, 0);
        this.playerCarGroup.add(this.underglowLight);

        this.taillights = [];
        this.brakeLightMat = new THREE.MeshStandardMaterial({
            color: 0xff0033,
            emissive: 0x990022,
            emissiveIntensity: 0.4,
            roughness: 0.2
        });

        // Ambient Occlusion Contact Shadow Plane underneath chassis & tires
        const contactShadowGeo = new THREE.PlaneGeometry(2.3, 4.5);
        const contactShadowMat = new THREE.MeshBasicMaterial({
            map: this.createContactShadowTexture(),
            transparent: true,
            opacity: 0.75,
            depthWrite: false
        });
        const contactShadowMesh = new THREE.Mesh(contactShadowGeo, contactShadowMat);
        contactShadowMesh.rotation.x = -Math.PI / 2;
        contactShadowMesh.position.set(0, 0.01, 0);
        this.playerCarGroup.add(contactShadowMesh);

        // ===================================================================
        // PHOTOREALISTIC PEUGEOT PARS ELX 3D MODEL ASSEMBLY
        // ===================================================================

        // 1. Lower Main Body Chassis
        const bodyGeo = new THREE.BoxGeometry(1.76, 0.40, 4.02);
        const bodyMesh = new THREE.Mesh(bodyGeo, carMat);
        bodyMesh.position.y = 0.40;
        bodyMesh.castShadow = true;
        this.playerCarGroup.add(bodyMesh);

        // 2. Underbody Belly Pan & Suspension Linkages (سینی زیر شاسی)
        const bellyGeo = new THREE.BoxGeometry(1.65, 0.12, 3.80);
        const bellyMesh = new THREE.Mesh(bellyGeo, darkTrimMat);
        bellyMesh.position.set(0, 0.18, 0);
        this.playerCarGroup.add(bellyMesh);

        // 3. Front Hood / Bonnet (کاپوت شیب‌دار پژو پارس با خطوط درز)
        const bonnetGeo = new THREE.BoxGeometry(1.72, 0.11, 1.30);
        bonnetGeo.rotateX(0.065);
        const bonnetMesh = new THREE.Mesh(bonnetGeo, carMat);
        bonnetMesh.position.set(0, 0.58, -1.32);
        bonnetMesh.castShadow = true;
        this.playerCarGroup.add(bonnetMesh);

        // Panel Gap Seam between Hood and Fenders
        const hoodSeamGeo = new THREE.BoxGeometry(1.74, 0.01, 1.32);
        hoodSeamGeo.rotateX(0.065);
        const hoodSeamMesh = new THREE.Mesh(hoodSeamGeo, darkTrimMat);
        hoodSeamMesh.position.set(0, 0.575, -1.32);
        this.playerCarGroup.add(hoodSeamMesh);

        // 4. Front Bumper with Air Intake Grill & Fog Lights (سپر جلو پارس)
        const frontBumperGeo = new THREE.BoxGeometry(1.78, 0.30, 0.28);
        const frontBumperMesh = new THREE.Mesh(frontBumperGeo, carMat);
        frontBumperMesh.position.set(0, 0.32, -1.98);
        frontBumperMesh.castShadow = true;
        this.playerCarGroup.add(frontBumperMesh);

        const airGrillGeo = new THREE.BoxGeometry(1.10, 0.12, 0.08);
        const airGrillMesh = new THREE.Mesh(airGrillGeo, darkTrimMat);
        airGrillMesh.position.set(0, 0.26, -2.09);
        this.playerCarGroup.add(airGrillMesh);

        // 5. Front Grille & 3D Chrome Peugeot Lion Emblem Badge (آرم شیر پژو)
        const grilleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.14, 0.06), darkTrimMat);
        grilleMesh.position.set(0, 0.48, -2.00);
        this.playerCarGroup.add(grilleMesh);

        const badgeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.08), chromeMat);
        badgeMesh.position.set(0, 0.49, -2.01);
        this.playerCarGroup.add(badgeMesh);

        // 6. Multi-Layer Crystal Headlights (چراغ‌های پرژکتوری جلو پارس)
        const headHousingGeo = new THREE.BoxGeometry(0.42, 0.16, 0.08);
        const headReflectorGeo = new THREE.ConeGeometry(0.07, 0.08, 12);
        headReflectorGeo.rotateX(Math.PI / 2);

        const crystalHeadMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 0.95,
            roughness: 0.04,
            transparent: true,
            opacity: 0.88
        });

        [-0.62, 0.62].forEach(x => {
            const hlHousing = new THREE.Mesh(headHousingGeo, darkTrimMat);
            hlHousing.position.set(x, 0.50, -2.00);
            hlHousing.rotation.y = x > 0 ? -0.08 : 0.08;

            const reflector = new THREE.Mesh(headReflectorGeo, chromeMat);
            reflector.position.set(x, 0.50, -2.02);

            const hlLens = new THREE.Mesh(headHousingGeo, crystalHeadMat);
            hlLens.position.set(x, 0.50, -2.02);
            hlLens.rotation.y = x > 0 ? -0.08 : 0.08;

            this.playerCarGroup.add(hlHousing);
            this.playerCarGroup.add(reflector);
            this.playerCarGroup.add(hlLens);
        });

        // Headlight Beam throwing light on road
        this.headlightSpot = new THREE.SpotLight(0xfffaea, 2.5, 45, Math.PI / 6, 0.4, 1.2);
        this.headlightSpot.position.set(0, 0.55, -2.0);
        this.headlightSpotTarget = new THREE.Object3D();
        this.headlightSpotTarget.position.set(0, 0.1, -25.0);
        this.playerCarGroup.add(this.headlightSpot);
        this.playerCarGroup.add(this.headlightSpotTarget);
        this.headlightSpot.target = this.headlightSpotTarget;

        // 7. Sloped Windshield with Rubber Seal (شیشه جلو با چسب دور شیشه)
        const frontWinGeo = new THREE.BoxGeometry(1.46, 0.48, 0.82);
        frontWinGeo.rotateX(-0.52);
        const frontWinMesh = new THREE.Mesh(frontWinGeo, glassMat);
        frontWinMesh.position.set(0, 0.86, -0.72);
        this.playerCarGroup.add(frontWinMesh);

        const winSealGeo = new THREE.BoxGeometry(1.48, 0.50, 0.84);
        winSealGeo.rotateX(-0.52);
        const winSealMesh = new THREE.Mesh(winSealGeo, darkTrimMat);
        winSealMesh.position.set(0, 0.855, -0.72);
        this.playerCarGroup.add(winSealMesh);

        // 8. Cabin Roof & Side Pillar Frames (سقف و ستون‌های A, B, C)
        const roofGeo = new THREE.BoxGeometry(1.40, 0.08, 1.32);
        const roofMesh = new THREE.Mesh(roofGeo, carMat);
        roofMesh.position.set(0, 1.12, -0.08);
        roofMesh.castShadow = true;
        this.playerCarGroup.add(roofMesh);

        const sideGlassGeo = new THREE.BoxGeometry(1.46, 0.44, 1.28);
        const sideGlassMesh = new THREE.Mesh(sideGlassGeo, glassMat);
        sideGlassMesh.position.set(0, 0.88, -0.08);
        this.playerCarGroup.add(sideGlassMesh);

        // 9. Sloped Rear Glass Window (شیشه عقب شیب‌دار)
        const rearWinGeo = new THREE.BoxGeometry(1.42, 0.46, 0.76);
        rearWinGeo.rotateX(0.48);
        const rearWinMesh = new THREE.Mesh(rearWinGeo, glassMat);
        rearWinMesh.position.set(0, 0.86, 0.58);
        this.playerCarGroup.add(rearWinMesh);

        // 10. Sloped Rear Trunk Lid & Badges (صندوق عقب پژو پارس)
        const trunkGeo = new THREE.BoxGeometry(1.66, 0.12, 0.86);
        trunkGeo.rotateX(-0.04);
        const trunkMesh = new THREE.Mesh(trunkGeo, carMat);
        trunkMesh.position.set(0, 0.60, 1.45);
        trunkMesh.castShadow = true;
        this.playerCarGroup.add(trunkMesh);

        // Rear Trunk Chrome Badges (آرم شیر پژو و نوشته Pars ELX)
        const rearBadgeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.10, 0.06), chromeMat);
        rearBadgeMesh.position.set(0, 0.60, 1.89);
        this.playerCarGroup.add(rearBadgeMesh);

        const elxBadgeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.04), chromeMat);
        elxBadgeMesh.position.set(0.45, 0.60, 1.89);
        this.playerCarGroup.add(elxBadgeMesh);

        // 11. ELX Smoked Taillight Assemblies (چراغ‌های دودی عقب ELX)
        const tailHousingGeo = new THREE.BoxGeometry(0.48, 0.22, 0.08);
        [-0.56, 0.56].forEach(x => {
            const tl = new THREE.Mesh(tailHousingGeo, this.brakeLightMat);
            tl.position.set(x, 0.52, 1.89);
            this.playerCarGroup.add(tl);
            this.taillights.push(tl);
        });

        // 12. Rear Trunk Lip Spoiler (باله عقب پژو پارس)
        const spoilerGeo = new THREE.BoxGeometry(1.62, 0.06, 0.24);
        const spoilerMesh = new THREE.Mesh(spoilerGeo, carMat);
        spoilerMesh.position.set(0, 0.68, 1.82);
        spoilerMesh.castShadow = true;
        this.playerCarGroup.add(spoilerMesh);

        // 13. Rear Bumper with Iranian License Plate (سپر عقب و پلاک ایران ۶۶)
        const rearBumperGeo = new THREE.BoxGeometry(1.76, 0.32, 0.22);
        const rearBumperMesh = new THREE.Mesh(rearBumperGeo, carMat);
        rearBumperMesh.position.set(0, 0.32, 1.86);
        rearBumperMesh.castShadow = true;
        this.playerCarGroup.add(rearBumperMesh);

        const plateGeo = new THREE.BoxGeometry(0.46, 0.14, 0.06);
        const plateMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const plate = new THREE.Mesh(plateGeo, plateMat);
        plate.position.set(0, 0.36, 1.98);
        this.playerCarGroup.add(plate);

        // Dual Chrome Exhaust Pipes (اگزوز دوبل شوتی)
        const exhaustGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.36, 16);
        exhaustGeo.rotateX(Math.PI / 2);
        const exhaustL = new THREE.Mesh(exhaustGeo, chromeMat);
        exhaustL.position.set(-0.35, 0.22, 1.98);
        const exhaustR = new THREE.Mesh(exhaustGeo, chromeMat);
        exhaustR.position.set(-0.20, 0.22, 1.98);
        this.playerCarGroup.add(exhaustL);
        this.playerCarGroup.add(exhaustR);

        // 14. Black Side Door Moldings & Handles (زه مشکی و دستگیره درها)
        const sideMoldingGeo = new THREE.BoxGeometry(1.80, 0.08, 2.68);
        const sideMolding = new THREE.Mesh(sideMoldingGeo, darkTrimMat);
        sideMolding.position.set(0, 0.40, -0.08);
        this.playerCarGroup.add(sideMolding);

        // Door handles
        const handleGeo = new THREE.BoxGeometry(0.06, 0.04, 0.18);
        [[-0.91, 0.54, -0.3], [0.91, 0.54, -0.3], [-0.91, 0.54, 0.4], [0.91, 0.54, 0.4]].forEach(pos => {
            const handle = new THREE.Mesh(handleGeo, darkTrimMat);
            handle.position.set(pos[0], pos[1], pos[2]);
            this.playerCarGroup.add(handle);
        });

        // Fuel Filler Cap on Side Fender
        const fuelCapGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.04, 16);
        fuelCapGeo.rotateZ(Math.PI / 2);
        const fuelCap = new THREE.Mesh(fuelCapGeo, darkTrimMat);
        fuelCap.position.set(0.89, 0.58, 1.1);
        this.playerCarGroup.add(fuelCap);

        // 15. Side Rear-View Mirrors with LED Indicators (آینه‌های راهنمادار بغل)
        const mirrorGeo = new THREE.BoxGeometry(0.24, 0.12, 0.16);
        const indicatorGeo = new THREE.BoxGeometry(0.04, 0.03, 0.10);
        const indicatorMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

        [-0.90, 0.90].forEach(x => {
            const mirror = new THREE.Mesh(mirrorGeo, carMat);
            mirror.position.set(x, 0.80, -0.65);
            mirror.castShadow = true;

            const ind = new THREE.Mesh(indicatorGeo, indicatorMat);
            ind.position.set(x > 0 ? 0.10 : -0.10, 0, 0);
            mirror.add(ind);

            this.playerCarGroup.add(mirror);
        });

        // 16. Interior Cockpit Group
        this.cockpitGroup = new THREE.Group();

        const dashGeo = new THREE.BoxGeometry(1.44, 0.44, 0.68);
        const dashMat = new THREE.MeshStandardMaterial({ color: 0x181a22, roughness: 0.85, metalness: 0.1 });
        const dashboard = new THREE.Mesh(dashGeo, dashMat);
        dashboard.position.set(0, 0.83, -0.45);
        this.cockpitGroup.add(dashboard);

        const woodTrimGeo = new THREE.BoxGeometry(1.42, 0.08, 0.69);
        const woodTrimMat = new THREE.MeshStandardMaterial({ color: 0x663311, roughness: 0.4, metalness: 0.2 });
        const woodTrim = new THREE.Mesh(woodTrimGeo, woodTrimMat);
        woodTrim.position.set(0, 0.72, -0.45);
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

        this.steeringWheel.position.set(-0.35, 0.94, 0.02);
        this.steeringWheel.rotation.x = -0.3;
        this.cockpitGroup.add(this.steeringWheel);

        this.playerCarGroup.add(this.cockpitGroup);

        // 17. HD 5-Spoke Sport Rims, Tires, Vented Brake Discs & Red Calipers
        const tireGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.34, 32);
        const tireMat = new THREE.MeshStandardMaterial({ color: 0x111115, roughness: 0.85 });

        const rimGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.35, 16);
        const rimMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 0.95, roughness: 0.08 });

        const brakeDiscGeo = new THREE.CylinderGeometry(0.20, 0.20, 0.28, 20);
        const brakeDiscMat = new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.92, roughness: 0.22 });

        const caliperGeo = new THREE.BoxGeometry(0.08, 0.12, 0.18);
        const caliperMat = new THREE.MeshStandardMaterial({ color: 0xcc0011, roughness: 0.3 });

        tireGeo.rotateZ(Math.PI / 2);
        rimGeo.rotateZ(Math.PI / 2);
        brakeDiscGeo.rotateZ(Math.PI / 2);

        const wheelPositions = [
            [-0.90, 0.38, 1.20, true],   // Rear Left
            [0.90, 0.38, 1.20, true],    // Rear Right
            [-0.90, 0.38, -1.20, false], // Front Left
            [0.90, 0.38, -1.20, false]   // Front Right
        ];

        wheelPositions.forEach(pos => {
            const wheelAssembly = new THREE.Group();

            const tire = new THREE.Mesh(tireGeo, tireMat);
            const rim = new THREE.Mesh(rimGeo, rimMat);
            const disc = new THREE.Mesh(brakeDiscGeo, brakeDiscMat);
            const caliper = new THREE.Mesh(caliperGeo, caliperMat);

            caliper.position.set(pos[0] > 0 ? -0.06 : 0.06, 0.08, 0);

            tire.castShadow = true;
            wheelAssembly.add(tire);
            wheelAssembly.add(rim);
            wheelAssembly.add(disc);
            wheelAssembly.add(caliper);

            wheelAssembly.position.set(pos[0], pos[1], pos[2]);
            this.playerCarGroup.add(wheelAssembly);

            this.wheels.push(wheelAssembly);
            if (!pos[3]) this.frontWheels.push(wheelAssembly);
        });

        // 18. Stance Setup (SHOOTI vs LOW vs NORMAL)
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

        if (this.tuning) {
            this.tuning.applyVisualsToCar();
        }
    }

    setupEvents() {
        if (this.tuning) {
            this.tuning.bindUIEvents();
        }

        window.addEventListener('resize', () => this.onWindowResize());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.onWindowResize(), 150);
        });

        window.addEventListener('keydown', (e) => {
            if (e.repeat) return;
            this.keys[e.code] = true;
            if (e.code === 'KeyP' || e.code === 'Escape') this.togglePause();
            if (e.code === 'KeyC') this.toggleCameraMode();
            if (e.code === 'KeyT') this.cycleTimeOfDay();
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
            if (!el) return;
            let lastTrigger = 0;
            const handler = (e) => {
                const now = Date.now();
                if (now - lastTrigger < 300) return;
                lastTrigger = now;
                fn(e);
            };
            el.addEventListener('click', handler);
            el.addEventListener('touchstart', (e) => {
                handler(e);
            }, { passive: true });
        };

        addClick('camera-btn', () => this.toggleCameraMode());
        addClick('tod-btn', () => this.cycleTimeOfDay());
        addClick('radio-btn', () => this.cycleRadioStation());
        addClick('screenshot-btn', () => this.takeScreenshot());
        addClick('btn-menu-screenshot', () => this.takeScreenshot());
        addClick('btn-gameover-screenshot', () => this.takeScreenshot());
        addClick('pause-btn', () => this.togglePause());

        addClick('btn-start', () => { if (window.audioMgr) window.audioMgr.init(); this.startGame(); });
        addClick('btn-restart', () => { this.startGame(); });
        addClick('btn-resume', () => { this.togglePause(); });
        addClick('btn-open-tuning', () => { if (this.tuning) this.tuning.openGarage(); });
        addClick('btn-pause-menu', () => {
            this.state = 'MENU';
            if (this.uiPause) this.uiPause.classList.add('hidden');
            if (this.uiMenu) this.uiMenu.classList.remove('hidden');
        });

        // Touch Controls Helper
        const bindTouchButton = (btnId, onPress, onRelease) => {
            const btn = document.getElementById(btnId);
            if (!btn) return;
            let isPressed = false;

            const handlePress = (e) => {
                if (e && e.cancelable) e.preventDefault();
                if (isPressed) return;
                isPressed = true;
                btn.classList.add('active');
                if (onPress) onPress();
            };

            const handleRelease = (e) => {
                if (!isPressed) return;
                isPressed = false;
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

        // Touch Swipe Filter
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
        this.currentGear = 1;
        this.currentRPM = 1000;
        this.currentLane = 2;
        this.targetLane = 2;
        this.player.x = this.laneX[2];
        this.player.tilt = 0;
        this.player.pitch = 0;
        this.player.spinAngle = 0;
        this.player.isSpinning = false;
        this.player.nitroGauge = 100;
        this.player.isNitroActive = false;
        this.isGasPressed = false;
        this.isBrakePressed = false;

        this.lastFrameTime = performance.now();
        try { window.focus(); } catch (e) {}

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

        if (window.audioMgr) {
            window.audioMgr.init();
        }

        console.log("START CLICKED");
        console.log("GAME STATE:", this.state);
        console.log("GAME SPEED:", this.speed);
        console.log("CAR:", this.playerCarGroup);
        console.log("SCENE:", this.scene);
        console.log("CAMERA:", this.camera);
        console.log("RENDERER:", this.renderer);
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
        this.cameraShake = 0.8; // Trigger camera impact shake
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
        if (!this.lastFrameTime) this.lastFrameTime = timestamp;
        const delta = timestamp - this.lastFrameTime;
        this.lastFrameTime = timestamp;

        const dt = Math.min(Math.max(delta / 1000, 0.001), 0.1);

        if (this.state === 'PLAYING') {
            this.update(dt, timestamp);
        } else {
            this.updateGarageOrbit(dt, timestamp);
        }

        this.render();

        requestAnimationFrame((t) => this.loop(t));
    }

    updateGarageOrbit(dt, timestamp = performance.now()) {
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

        // Camera impact shake reduction
        let shakeX = 0;
        let shakeY = 0;
        if (this.cameraShake > 0) {
            this.cameraShake = Math.max(0, this.cameraShake - dt * 2.5);
            shakeX = (Math.random() - 0.5) * this.cameraShake * 0.4;
            shakeY = (Math.random() - 0.5) * this.cameraShake * 0.4;
        }

        this.camera.up.set(0, 1, 0);

        if (this.cameraMode === 'COCKPIT') {
            if (this.cockpitGroup) this.cockpitGroup.visible = true;

            const targetCamX = this.player.x - 0.35 + shakeX;
            const targetCamY = 1.02 + shakeY;
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

            const targetCamX = this.player.x + shakeX;
            const targetCamY = 0.82 + shakeY;
            const targetCamZ = -1.25;

            this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetCamX, dt * 20.0);
            this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetCamY, dt * 20.0);
            this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetCamZ, dt * 20.0);

            this.camera.lookAt(this.camera.position.x, 0.78 + this.cameraPitchOffset, -40.0);
        } else {
            if (this.cockpitGroup) this.cockpitGroup.visible = false;

            const targetCamX = this.player.x + shakeX;
            const targetCamY = 2.15 + shakeY;
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

    spawnExhaustSmokeParticle() {
        const particleGeo = new THREE.SphereGeometry(0.08, 8, 8);
        const particleMat = new THREE.MeshBasicMaterial({
            color: 0xaaaaaa,
            transparent: true,
            opacity: 0.4
        });
        const particle = new THREE.Mesh(particleGeo, particleMat);

        const sideX = (Math.random() - 0.5) * 0.2 - 0.28;
        particle.position.set(this.player.x + sideX, 0.24, 2.1);
        this.scene.add(particle);

        this.exhaustParticles.push({
            mesh: particle,
            life: 1.0,
            vz: 2.0 + Math.random() * 1.5,
            vy: 0.3 + Math.random() * 0.3
        });
    }

    spawnTireSmokeParticle(xPos, zPos) {
        const particleGeo = new THREE.SphereGeometry(0.14, 8, 8);
        const particleMat = new THREE.MeshBasicMaterial({
            color: 0xdddddd,
            transparent: true,
            opacity: 0.5
        });
        const particle = new THREE.Mesh(particleGeo, particleMat);
        particle.position.set(xPos, 0.15, zPos);
        this.scene.add(particle);

        this.tireSmokeParticles.push({
            mesh: particle,
            life: 0.8,
            vy: 0.4 + Math.random() * 0.3
        });
    }

    update(dt, timestamp = performance.now()) {
        // Inputs
        const isGasPressed = this.isGasPressed || this.keys['ArrowUp'] || this.keys['KeyW'];
        const isBrakePressed = this.isBrakePressed || this.keys['ArrowDown'] || this.keys['KeyS'];

        // Dynamic Taillights & Emissive Intensity
        if (this.taillights) {
            const glowEmissive = isBrakePressed ? 0xff0000 : 0x990022;
            const glowIntensity = isBrakePressed ? 2.5 : 0.4;
            this.taillights.forEach(l => {
                if (l.material.emissive) {
                    l.material.emissive.setHex(glowEmissive);
                    l.material.emissiveIntensity = glowIntensity;
                }
            });
        }

        // Tuning System Multipliers
        const tunedAccel = this.tuning ? (this.tuning.physicsStats.accelRate * 0.9) : 2.4;
        const tunedTopSpeed = this.tuning ? (this.tuning.physicsStats.topSpeedKmh / 9.5) : 34.0;
        const tunedBrakeMult = this.tuning ? this.tuning.physicsStats.brakePower : 1.0;
        const tunedGripMult = this.tuning ? this.tuning.physicsStats.gripFactor : 1.0;
        const tunedRpmLimit = this.tuning ? this.tuning.physicsStats.rpmLimit : 6800;
        const nitroLevel = this.tuning ? (this.tuning.data.nitro.level || 1) : 1;

        // Speed, Drag & Acceleration Physics Curve
        let targetSpeed = this.baseSpeed;
        let targetBodyPitch = 0;

        if (this.player.isNitroActive) {
            targetSpeed = tunedTopSpeed * (1.1 + nitroLevel * 0.05);
            targetBodyPitch = -0.05; // Squat back
            this.speed += (targetSpeed - this.speed) * dt * (4.5 + nitroLevel * 0.8);
            this.player.nitroTime--;
            this.player.nitroGauge = Math.max(0, (this.player.nitroTime / 180) * 100);

            if (this.player.nitroTime <= 0) this.player.isNitroActive = false;
        } else {
            this.baseSpeed = Math.min(16.0, this.baseSpeed + dt * 0.03);
            let accelRate = 1.8;
            if (isGasPressed) {
                targetSpeed = tunedTopSpeed * 0.85;
                accelRate = tunedAccel;
                targetBodyPitch = -0.035; // Squat back on acceleration
            } else if (isBrakePressed) {
                targetSpeed = 4.0;
                accelRate = 4.8 * tunedBrakeMult;
                targetBodyPitch = 0.065; // Nose dive on braking
            } else {
                targetSpeed = this.baseSpeed;
                accelRate = 1.8;
                targetBodyPitch = 0;
            }

            // Aerodynamic drag force (0.5 * Cd * A * v^2)
            const dragForce = 0.0008 * (this.speed * this.speed);
            this.speed = Math.max(2.0, this.speed - dragForce * dt * 10.0);

            this.speed += (targetSpeed - this.speed) * dt * accelRate;

            if (this.player.nitroGauge < 100) {
                this.player.nitroGauge = Math.min(100, this.player.nitroGauge + 0.15);
            }
        }

        // Gear & Simulated RPM Engine Calculation (Gears 1 through 5)
        const speedRatio = Math.min(1.0, this.speed / tunedTopSpeed);
        let newGear = 1;
        if (speedRatio > 0.8) newGear = 5;
        else if (speedRatio > 0.6) newGear = 4;
        else if (speedRatio > 0.4) newGear = 3;
        else if (speedRatio > 0.2) newGear = 2;

        if (newGear !== this.currentGear) {
            this.currentGear = newGear;
            audioMgr.playGearShift();
        }

        // Calculate RPM within current gear range (1000 - tunedRpmLimit RPM)
        const gearRatios = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
        const minGearSpeed = gearRatios[this.currentGear - 1];
        const maxGearSpeed = gearRatios[this.currentGear];
        const normalizedGearSpeed = (speedRatio - minGearSpeed) / (maxGearSpeed - minGearSpeed || 0.2);

        const rpmRange = tunedRpmLimit - 1200;
        this.currentRPM = 1200 + Math.min(1.0, Math.max(0.0, normalizedGearSpeed)) * rpmRange;
        audioMgr.updateEngineRPM(this.currentRPM, speedRatio);

        // Speed-Dependent FOV Camera Expansion
        const targetFov = 58 + (this.speed / 34.0) * 14;
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 0.08);
        this.camera.updateProjectionMatrix();

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

        // Smooth Player Lane Lerping & Body Roll Physics
        const targetX = this.laneX[this.targetLane];
        const diffX = targetX - this.player.x;
        this.player.x += diffX * 0.18;
        this.player.tilt = -diffX * 0.06; // Body Roll tilt

        // Tire Slip Calculation & Skid Effects
        const lateralSlip = Math.abs(diffX);
        if (lateralSlip > 1.2 || (isBrakePressed && this.speed > 18)) {
            audioMgr.triggerTireSkid(lateralSlip / 3.0);
            if (Math.random() < 0.4) {
                this.spawnTireSmokeParticle(this.player.x - 0.8, 1.2);
                this.spawnTireSmokeParticle(this.player.x + 0.8, 1.2);
            }
        } else {
            audioMgr.stopTireSkid();
        }

        // 4-Wheel Independent Suspension Bounce Simulation
        const suspensionBounce = Math.sin(timestamp * 0.015) * 0.012 * (this.speed / 20.0);
        this.player.pitch = THREE.MathUtils.lerp(this.player.pitch || 0, targetBodyPitch + suspensionBounce, dt * 8.0);

        // Wheel Rotation Matching Vehicle Speed & Steering Angle
        if (this.wheels) {
            this.wheels.forEach(w => {
                w.rotation.x += this.speed * dt * 0.35;
            });
        }

        if (this.frontWheels) {
            this.frontWheels.forEach(w => {
                w.rotation.y = -diffX * 0.45; // Front wheels turn into steering direction
            });
        }

        // Update Car Group Position & Pitch/Roll Weight Transfer
        if (this.playerCarGroup) {
            this.playerCarGroup.position.x = this.player.x;
            this.playerCarGroup.rotation.y = this.player.spinAngle;
            this.playerCarGroup.rotation.z = this.player.tilt;
            this.playerCarGroup.rotation.x = (this.player.stance === 'SHOOTI' ? -0.06 : 0) + this.player.pitch;
        }

        // Spawn Exhaust Smoke Particles
        if (Math.random() < 0.35) {
            this.spawnExhaustSmokeParticle();
        }

        // Update Exhaust Smoke Particles
        for (let i = this.exhaustParticles.length - 1; i >= 0; i--) {
            const p = this.exhaustParticles[i];
            p.life -= dt * 2.0;
            p.mesh.position.z += p.vz * dt;
            p.mesh.position.y += p.vy * dt;
            p.mesh.scale.addScalar(dt * 1.5);
            p.mesh.material.opacity = p.life * 0.4;

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.exhaustParticles.splice(i, 1);
            }
        }

        // Update Tire Smoke Particles
        for (let i = this.tireSmokeParticles.length - 1; i >= 0; i--) {
            const tp = this.tireSmokeParticles[i];
            tp.life -= dt * 2.5;
            tp.mesh.position.y += tp.vy * dt;
            tp.mesh.scale.addScalar(dt * 2.0);
            tp.mesh.material.opacity = tp.life * 0.5;

            if (tp.life <= 0) {
                this.scene.remove(tp.mesh);
                this.tireSmokeParticles.splice(i, 1);
            }
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
                    this.cameraShake = 0.5;
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
        bodyMesh.castShadow = true;
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
        mesh.castShadow = true;
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

        if (this.hudGearRPM) {
            this.hudGearRPM.innerText = `دنده ${this.currentGear} | ${Math.floor(this.currentRPM)} RPM`;
        }

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
